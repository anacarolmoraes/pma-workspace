#!/usr/bin/env node
// session-start — hook SessionStart: injeta o ESTADO VIVO na abertura da sessão.
//
// PRD F4.2. Não reinjeta CLAUDE.md / IA_CONTEXT.md / USER.md — o Claude Code já os
// carrega; repetir é desperdício de token. Injeta só o volátil, que ninguém sabe
// sem consultar: intimações não tratadas, prazos curtos, e o alarme de heartbeat
// parado (silêncio do DJEN não pode ser indistinguível de "nada novo").
//
// TETO DURO: 20 linhas. Acima disso injeta só a contagem e o caminho — um hook
// que estoura contexto em toda sessão é pior que hook nenhum.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PENDENTES = path.join(RAIZ, 'skills', 'pesquisa-djen', 'monitor', 'PENDENTES.md');
const LAST_OK = path.join(RAIZ, 'skills', 'pesquisa-djen', 'monitor', 'last_ok.json');
const COBERTURA = path.join(RAIZ, 'skills', 'pesquisa-djen', 'monitor', 'cobertura.json');
const USUARIO = path.join(RAIZ, 'perfil', 'usuario.md');
const AMBIENTE = path.join(RAIZ, 'perfil', 'ambiente.json');

const MAX_LINHAS = 20;

// Limiares são política do escritório: perfil/monitor-djen.json. O hook nunca
// derruba a sessão, então cada leitura tem padrão de segurança.
function config() {
  const padrao = {
    horas_sem_rodar: 36,
    dias_prazo_curto: 7,
    prazo_edcl: 5,
  };
  try {
    const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'monitor-djen.json'), 'utf8'));
    return {
      horas_sem_rodar: c.alerta?.horas_sem_rodar ?? padrao.horas_sem_rodar,
      dias_prazo_curto: c.alerta?.dias_prazo_curto ?? padrao.dias_prazo_curto,
      prazo_edcl: c.prazos_referencia?.embargos_declaracao ?? padrao.prazo_edcl,
    };
  } catch {
    return padrao;
  }
}

const CFG = config();
const HORAS_ALERTA = CFG.horas_sem_rodar;
const DIAS_PRAZO_CURTO = CFG.dias_prazo_curto;

// Contagem em dias ÚTEIS vem do mesmo núcleo que o monitor usa — duas contas
// diferentes para o mesmo prazo divergiriam. Se o módulo não carregar, cai para
// dias corridos e AVISA, em vez de mentir um número.
let diasUteisRestantes = null;
let hojeLocal = null;
try {
  ({ diasUteisRestantes, hojeLocal } = require(path.join(RAIZ, 'skills', 'pesquisa-djen', 'lib', 'prazo-core.js')));
} catch {
  /* segue em dias corridos */
}

const ler = (p) => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
};

const hoje = () => new Date();
// Dia civil de Brasília (não UTC): depois das 21h o ISO já é amanhã.
const hojeIso = () => (hojeLocal ? hojeLocal() : new Date().toISOString().slice(0, 10));
const diasAte = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const h = new Date(`${hojeIso()}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d - h) / 86400000);
};

// Dias ÚTEIS até a data, pelo núcleo do monitor (feriado local + recesso). Sem
// o núcleo, devolve null: melhor não mostrar contagem do que mostrar errada.
const uteisAte = (iso, tribunal) => {
  if (!diasUteisRestantes) return null;
  try {
    return diasUteisRestantes(iso, undefined, { tribunal });
  } catch {
    return null;
  }
};

// A fila é uma tabela markdown cujas colunas mudam com o tempo (a de embargos
// entrou depois). Ler por POSIÇÃO fixa quebra em silêncio quando isso acontece
// — e um alerta de prazo que falha calado é pior que alerta nenhum. Por isso as
// colunas são localizadas pelo nome no cabeçalho.
function lerFila() {
  const txt = ler(PENDENTES);
  if (!txt) return [];

  const linhas = txt.split('\n').filter((l) => l.trim().startsWith('|'));
  if (!linhas.length) return [];

  const cabecalho = linhas[0].split('|').map((c) => c.trim().toLowerCase());
  const acharCol = (...termos) => cabecalho.findIndex((c) => termos.some((t) => c.includes(t)));

  const iStatus = acharCol('status');
  const iProcesso = acharCol('processo');
  const iOrgao = acharCol('tribunal', 'órgão', 'orgao');
  const iEdcl = acharCol('embargos');
  const iFatal = acharCol('fatal');
  if (iStatus < 0 || iFatal < 0) return [];

  const dataDe = (c) => {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(c || '');
    return m ? m[1] : null;
  };

  const itens = [];
  for (const linha of linhas.slice(1)) {
    const cols = linha.split('|').map((c) => c.trim());
    if (!/^ABERTA$/i.test(cols[iStatus] || '')) continue;
    const orgao = iOrgao > -1 ? cols[iOrgao] || '' : '';
    const celulaEdcl = iEdcl > -1 ? cols[iEdcl] || '' : '';
    itens.push({
      processo: iProcesso > -1 ? cols[iProcesso] : '(sem número)',
      orgao,
      tribunal: orgao.split('/')[0].trim(),
      edclIso: dataDe(celulaEdcl),
      // `?` = rótulo de documento ambíguo; o prazo existe, o cabimento é que
      // não está confirmado. Vale contar separado para não afogar as decisões.
      edclDuvida: celulaEdcl.includes('?'),
      prazoIso: dataDe(cols[iFatal]),
      prazoTexto: cols[iFatal] || '(sem prazo calculado)',
    });
  }
  return itens;
}

// Tribunais que apareceram na última varredura e não têm calendário local.
function coberturaIncompleta() {
  const txt = ler(COBERTURA);
  if (!txt) return [];
  try {
    return JSON.parse(txt).sem_calendario_local || [];
  } catch {
    return [];
  }
}

function alertaHeartbeat() {
  const txt = ler(LAST_OK);
  if (!txt) return 'O monitor do DJEN nunca registrou execução bem-sucedida — a vigilância de intimações NÃO está ativa.';
  try {
    const { timestamp } = JSON.parse(txt);
    const horas = (hoje() - new Date(timestamp)) / 3600000;
    if (horas > HORAS_ALERTA) {
      return `O monitor do DJEN não roda há ${Math.floor(horas)} h — silêncio NÃO significa "nada novo". Conferir a tarefa agendada.`;
    }
  } catch {
    return 'Estado do monitor do DJEN ilegível — conferir a tarefa agendada.';
  }
  return null;
}

// Máquina recém-clonada: identificar quem é a pessoa e conferir a instalação
// vem ANTES de despejar a operação do escritório. Enquanto isso não estiver
// resolvido, o hook não injeta mais nada.
function primeiroUso() {
  const semUsuario = !fs.existsSync(USUARIO);
  const semAmbiente = !fs.existsSync(AMBIENTE);
  if (!semUsuario && !semAmbiente) return null;

  const linhas = ['## Primeiro uso deste computador (injetado pelo hook)'];

  if (semAmbiente) {
    linhas.push(
      '⚙️  **Instalação não concluída** — `perfil/ambiente.json` não existe. Rodar `node scripts/setup.js` ' +
        'e relatar o resultado antes de qualquer tarefa que dependa de Python, PDF ou geração de `.docx`.',
    );
  }

  if (semUsuario) {
    linhas.push(
      '👤 **Usuário não identificado** — `perfil/usuario.md` não existe. Acionar a skill `onboarding-usuario` ' +
        'AGORA: entrevistar a pessoa e gravar o perfil. Sem isso, assinatura, comarca e tratamento saem errados.',
    );
  }

  return linhas.join('\n');
}

function montar() {
  const inicio = primeiroUso();
  if (inicio) return inicio;

  const linhas = [];
  const alerta = alertaHeartbeat();
  if (alerta) linhas.push(`⚠️  **DJEN:** ${alerta}`);

  const fila = lerFila();
  if (fila.length) {
    linhas.push(`📥 **Intimações não tratadas: ${fila.length}** (fila em \`skills/pesquisa-djen/monitor/PENDENTES.md\`)`);

    // Embargos primeiro: é o prazo mais curto, e é o que se perde calado.
    const comPrazo = fila
      .filter((i) => i.edclIso)
      .map((i) => ({ ...i, uteis: uteisAte(i.edclIso, i.tribunal) }))
      .filter((i) => i.uteis !== null)
      .sort((a, b) => a.uteis - b.uteis);

    // VENCIDO vem antes de tudo. Até 01/10/2026 o filtro `uteis >= 0` apagava do
    // alerta exatamente a linha mais urgente: a decisão ABERTA cujo prazo já passou.
    const vencidos = comPrazo.filter((i) => i.uteis < 0 && !i.edclDuvida);
    const noPrazo = comPrazo.filter((i) => i.uteis >= 0);
    const emb = noPrazo.filter((i) => !i.edclDuvida);
    const duvida = noPrazo.filter((i) => i.edclDuvida);

    if (vencidos.length) {
      linhas.push(`⛔ **Embargos VENCIDOS — ${vencidos.length} decisão(ões) ainda ABERTA(S) com os ${CFG.prazo_edcl} d.ú. passados:**`);
      for (const i of vencidos.slice(0, 6)) {
        linhas.push(`   - ${i.processo} (${i.tribunal}) — venceu ${i.edclIso}, há **${-i.uteis}** dia(s) útil(eis). Marcar TRATADA se já resolvida; senão, avaliar o recurso principal.`);
      }
      if (vencidos.length > 6) linhas.push(`   - … e mais ${vencidos.length - 6} na fila.`);
    }

    if (emb.length) {
      linhas.push(`🔴 **Embargos de declaração (${CFG.prazo_edcl} d.ú.) — ${emb.length} decisão(ões) no prazo:**`);
      for (const i of emb.slice(0, 6)) {
        const quanto = i.uteis === 0 ? '**VENCE HOJE**' : `faltam **${i.uteis}** dia(s) útil(eis)`;
        linhas.push(`   - ${i.processo} (${i.tribunal}) — até ${i.edclIso}, ${quanto}`);
      }
    }

    if (duvida.length) {
      const menor = duvida[0];
      linhas.push(
        `🟡 **${duvida.length} comunicação(ões) de tipo ambíguo** (rótulo "Outros") ainda dentro dos ` +
          `${CFG.prazo_edcl} dias — a mais próxima vence ${menor.edclIso}. Abrir para ver se é decisão.`,
      );
    }

    const fatalVencido = fila.filter((i) => {
      const d = i.prazoIso ? diasAte(i.prazoIso) : null;
      return d !== null && d < 0;
    });
    if (fatalVencido.length) {
      linhas.push(`⛔ **Recurso principal com fatal já passado e linha ainda ABERTA — ${fatalVencido.length}.** Triar na fila: ou foi tratado sem marcar, ou o prazo se perdeu.`);
    }

    const curtos = fila.filter((i) => {
      const d = i.prazoIso ? diasAte(i.prazoIso) : null;
      return d !== null && d >= 0 && d <= DIAS_PRAZO_CURTO;
    });

    if (curtos.length) {
      linhas.push(`🟠 **Recurso principal em ≤ ${DIAS_PRAZO_CURTO} dias — ${curtos.length}:**`);
      for (const i of curtos.slice(0, 5)) {
        linhas.push(`   - ${i.processo} (${i.tribunal}) — fatal ${i.prazoTexto}`);
      }
    }

    // Atuação nacional: a busca cobre todos os tribunais, mas o calendário de
    // feriado local não. A data desses sai conservadora (igual ou anterior à
    // real), e a conferência no tribunal é obrigatória.
    const sem = coberturaIncompleta();
    if (sem.length) {
      linhas.push(
        `📅 **Sem calendário de feriado local: ${sem.join(', ')}** — prazo desses tribunais é ` +
          `estimativa conservadora; conferir no tribunal antes de contar com a data.`,
      );
    }
  }

  if (!linhas.length) return null;

  linhas.unshift('## Estado da operação (injetado pelo hook — não está no CLAUDE.md)');
  linhas.push('');
  linhas.push('_A fila não substitui a conferência no eproc/DJEN oficial antes de protocolar._');

  if (linhas.length > MAX_LINHAS) {
    // Mesmo no modo compacto, o vencido não some: é a linha que justifica o hook.
    // Leva o título ⛔ e os itens indentados logo abaixo dele.
    const vencidas = [];
    let dentro = false;
    for (const l of linhas) {
      if (l.startsWith('⛔')) dentro = true;
      else if (!l.startsWith('   ')) dentro = false;
      if (dentro) vencidas.push(l);
    }
    return [
      '## Estado da operação (injetado pelo hook)',
      alerta ? `⚠️  **DJEN:** ${alerta}` : '',
      ...vencidas,
      `📥 **${fila.length} intimações não tratadas.** Fila completa: \`skills/pesquisa-djen/monitor/PENDENTES.md\` — ler antes de planejar o dia.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return linhas.join('\n');
}

try {
  const ctx = montar();
  if (ctx) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx },
      }),
    );
  }
} catch {
  // Hook falha em modo permissivo: nunca derrubar a abertura da sessão.
}
process.exit(0);

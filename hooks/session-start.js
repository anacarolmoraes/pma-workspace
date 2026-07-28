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
const USUARIO = path.join(RAIZ, 'perfil', 'usuario.md');
const AMBIENTE = path.join(RAIZ, 'perfil', 'ambiente.json');

const MAX_LINHAS = 20;
const HORAS_ALERTA = 36;
const DIAS_PRAZO_CURTO = 5;

const ler = (p) => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
};

const hoje = () => new Date();
const diasAte = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d - hoje()) / 86400000);
};

// Linha da fila: | STATUS | processo | tribunal/órgão | disponibilização | tipo | prazo | caso |
function lerFila() {
  const txt = ler(PENDENTES);
  if (!txt) return [];
  const itens = [];
  for (const linha of txt.split('\n')) {
    if (!linha.trim().startsWith('|')) continue;
    const cols = linha.split('|').map((c) => c.trim());
    if (cols.length < 8) continue;
    const [, status, processo, orgao, , , prazo] = cols;
    if (!/^ABERTA$/i.test(status)) continue;
    const mPrazo = /(\d{4}-\d{2}-\d{2})/.exec(prazo || '');
    itens.push({
      processo,
      orgao,
      prazoIso: mPrazo ? mPrazo[1] : null,
      prazoTexto: prazo || '(sem prazo calculado)',
    });
  }
  return itens;
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
    const curtos = fila.filter((i) => {
      const d = i.prazoIso ? diasAte(i.prazoIso) : null;
      return d !== null && d <= DIAS_PRAZO_CURTO;
    });

    linhas.push(`📥 **Intimações não tratadas: ${fila.length}** (fila em \`skills/pesquisa-djen/monitor/PENDENTES.md\`)`);

    if (curtos.length) {
      linhas.push(`🔴 **Prazo em ≤ ${DIAS_PRAZO_CURTO} dias — ${curtos.length}:**`);
      for (const i of curtos.slice(0, 8)) {
        linhas.push(`   - ${i.processo} (${i.orgao}) — fatal ${i.prazoTexto}`);
      }
    }
  }

  if (!linhas.length) return null;

  linhas.unshift('## Estado da operação (injetado pelo hook — não está no CLAUDE.md)');
  linhas.push('');
  linhas.push('_A fila não substitui a conferência no eproc/DJEN oficial antes de protocolar._');

  if (linhas.length > MAX_LINHAS) {
    return [
      '## Estado da operação (injetado pelo hook)',
      alerta ? `⚠️  **DJEN:** ${alerta}` : '',
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

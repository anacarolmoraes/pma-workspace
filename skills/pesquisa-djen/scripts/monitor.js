#!/usr/bin/env node
// monitor — vigia de intimações no DJEN para as OABs do escritório.
//
// PRD F5. Determinístico de ponta a ponta: fetch HTTP + diff de IDs + contagem de
// dias úteis. ZERO LLM — data fatal não pode sair de modelo probabilístico.
//
// O que faz:
//   1. consulta o DJEN para cada OAB marcada em perfil/advogados.json
//   2. compara com o estado (IDs já vistos) em monitor/seen.json
//   3. para cada intimação NOVA, calcula termo inicial e data fatal de referência
//   4. ACRESCENTA à fila monitor/PENDENTES.md (nunca remove; quem marca TRATADA é a titular)
//   5. registra monitor/last_ok.json — sem isso, silêncio é indistinguível de "nada novo"
//
// Uso: node monitor.js [--dias 10] [--prazo-ref 15]
// Saída: 0 = nada novo · 10 = HÁ INTIMAÇÕES NOVAS · 1 = erro
'use strict';

const fs = require('fs');
const path = require('path');
const { setTimeout: esperar } = require('timers/promises');
const { calcularPrazo, feriadosLocais, hojeLocal } = require('../lib/prazo-core.js');
const { classificar } = require('../lib/tipo-documento.js');

const SKILL = path.resolve(__dirname, '..');
const RAIZ = path.resolve(SKILL, '..', '..');
const DIR = path.join(SKILL, 'monitor');
const SEEN = path.join(DIR, 'seen.json');
const LOG = path.join(DIR, 'novas_intimacoes.log');
const PENDENTES = path.join(DIR, 'PENDENTES.md');
const LAST_OK = path.join(DIR, 'last_ok.json');
const COBERTURA = path.join(DIR, 'cobertura.json');
const ERROS = path.join(DIR, 'erros.log');

fs.mkdirSync(DIR, { recursive: true });

// ── Parâmetros ─────────────────────────────────────────────────────────────
// Ordem de precedência: linha de comando > perfil/monitor-djen.json > padrão.
// A configuração é do escritório e mora no perfil; a linha de comando existe
// para teste pontual, não para virar o jeito normal de rodar.
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

function carregarConfig() {
  const padrao = {
    janela_dias: 10,
    prazos_referencia: { embargos_declaracao: 5, recurso_principal: 15 },
  };
  try {
    const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'monitor-djen.json'), 'utf8'));
    return {
      janela_dias: c.janela_dias ?? padrao.janela_dias,
      prazos_referencia: { ...padrao.prazos_referencia, ...(c.prazos_referencia || {}) },
    };
  } catch {
    return padrao;
  }
}

const CFG = carregarConfig();
const DIAS_JANELA = parseInt(arg('dias', String(CFG.janela_dias)), 10); // janela larga: seen.json deduplica
const PRAZO_REF = parseInt(arg('prazo-ref', String(CFG.prazos_referencia.recurso_principal)), 10);
const PRAZO_EDCL = parseInt(arg('prazo-edcl', String(CFG.prazos_referencia.embargos_declaracao)), 10);

// ── Advogados: fonte única em perfil/advogados.json (PRD F1.2) ─────────────
function carregarOABs() {
  const arquivo = path.join(RAIZ, 'perfil', 'advogados.json');
  try {
    const { advogados } = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const lista = advogados
      .filter((a) => a.monitorar_djen !== false)
      .map((a) => ({ numero: a.oab_numero, uf: a.oab_uf, nome: a.nome_assinatura || a.nome_completo }));
    if (!lista.length) throw new Error('nenhum advogado com monitorar_djen');
    return lista;
  } catch (e) {
    throw new Error(
      `Não foi possível ler as OABs de perfil/advogados.json (${e.message}). ` +
        `O monitor não tem OAB hardcoded por decisão de arquitetura — corrija o perfil.`,
    );
  }
}

// ── Catálogo de processos → caso (preenchido pela skill abrir-caso, se existir) ──
function carregarCatalogo() {
  try {
    const bruto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'clientes', '_processos.json'), 'utf8'));
    const mapa = new Map();
    for (const [caso, procs] of Object.entries(bruto)) {
      // Chave iniciada por `_` é metadado do gerador (_comentario, _gerado_em,
      // _origem), não caso. Sem esta linha, o comentário do arquivo vira uma
      // entrada do catálogo.
      if (caso.startsWith('_')) continue;
      for (const p of [].concat(procs)) mapa.set(String(p).replace(/\D/g, ''), caso);
    }
    return mapa;
  } catch {
    return new Map();
  }
}

// ── DJEN ───────────────────────────────────────────────────────────────────
const d2s = (d) => d.toISOString().slice(0, 10);

// ⚠️ REGRA DURA: a consulta é NACIONAL. Filtra-se por OAB, nunca por tribunal.
// O escritório atua no Brasil inteiro — a fila já recebe TJTO, TJGO, TJMG e TJSP.
// Acrescentar `siglaTribunal` aqui faria a intimação de qualquer tribunal fora da
// lista sumir sem aviso, e prazo perdido em silêncio é o pior modo de falha deste
// sistema. `ufOab` NÃO é filtro de tribunal: identifica a seccional da inscrição.
//
// Rede é o modo de falha mais comum aqui (DJEN fora do ar, DNS, TLS). Uma falha
// aborta a execução inteira e NADA é gravado — `seen.json` e a fila só avançam
// depois que todas as OABs respondem —, então a recuperação é sempre uma execução
// nova e completa, sem risco de intimação ficar pelo caminho. Estas tentativas
// curtas cobrem o soluço de rede; queda longa é coberta pela retentativa de 30 em
// 30 min da tarefa agendada (ver monitor.ps1).
const TENTATIVAS = 3;
const ESPERA_MS = [5000, 15000];

const ITENS_POR_PAGINA = 100;
const PAUSA_PAGINA_MS = 300; // a API tem rate limit real; não atropelar
const MAX_PAGINAS = 50; // 5.000 comunicações: inalcançável na prática, é trava de laço

async function buscarPagina(oab, inicio, fim, pagina) {
  const q = new URLSearchParams({
    numeroOab: oab.numero,
    ufOab: oab.uf,
    dataDisponibilizacaoInicio: inicio,
    dataDisponibilizacaoFim: fim,
    itensPorPagina: String(ITENS_POR_PAGINA),
    pagina: String(pagina),
  });
  const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${q}`;

  for (let tentativa = 1; ; tentativa++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const erro = new Error(`DJEN HTTP ${res.status} (OAB ${oab.numero}/${oab.uf}, página ${pagina})`);
        // 5xx e 429 passam com o tempo; 4xx restante é requisição errada (OAB
        // inválida, parâmetro fora do contrato) e repetir só atrasa o alarme.
        erro.transitorio = res.status >= 500 || res.status === 429;
        throw erro;
      }
      const data = await res.json();
      // `count` é o total da BUSCA, não o tamanho da página (verificado contra a
      // API: 58 comunicações devolvidas de 5 em 5 dão o mesmo conjunto de IDs que
      // uma página de 100).
      return { count: data.count ?? 0, items: data.items || [] };
    } catch (e) {
      // Falha de rede (`fetch failed`) não tem status: é transitória por padrão.
      const transitorio = e.transitorio ?? true;
      if (!transitorio || tentativa >= TENTATIVAS) throw e;
      const espera = ESPERA_MS[tentativa - 1];
      console.error(`Aviso: ${e.message} — tentativa ${tentativa}/${TENTATIVAS}, repetindo em ${espera / 1000}s.`);
      await esperar(espera);
    }
  }
}

// ⚠️ REGRA DURA: consulta PAGINADA até esgotar. Pedir só a primeira página era um
// teto silencioso — passando de ITENS_POR_PAGINA na janela, o excedente sumia sem
// aviso, que é a mesma classe de falha que a regra da busca nacional existe para
// impedir. Nada de `break` por comodidade: só para quando a página vem vazia ou
// quando o acumulado alcança o `count` da própria API.
async function consultar(oab, inicio, fim) {
  const itens = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const { count, items } = await buscarPagina(oab, inicio, fim, pagina);
    itens.push(...items);

    if (!items.length || itens.length >= count) return itens;
    await esperar(PAUSA_PAGINA_MS);
  }

  // Inalcançável em operação normal. Se acontecer, a API mudou de contrato (ex.:
  // passou a ignorar `pagina`) — e aí falhar alto é melhor do que truncar calado:
  // vira retentativa, e o dead man's switch de 36 h avisa se não resolver.
  throw new Error(
    `DJEN: paginação passou de ${MAX_PAGINAS} páginas para a OAB ${oab.numero}/${oab.uf} ` +
      `(${inicio}..${fim}) — contrato da API mudou; conferir antes de confiar na fila.`,
  );
}

// ── Fila PENDENTES.md ──────────────────────────────────────────────────────
const CABECALHO = `# Fila de intimações — DJEN

> ⚠️ **Esta fila não substitui a conferência no eproc/DJEN oficial antes de protocolar.**
> São dois prazos de **referência**, ambos em dias úteis e contados do mesmo termo inicial:
> **embargos de declaração, ${PRAZO_EDCL} dias** (CPC, art. 1.023) e **recurso principal,
> ${PRAZO_REF} dias**. Confira o prazo do ato concreto — no Juizado Especial o recurso
> inominado é de 10 dias (Lei 9.099/95, art. 42), não ${PRAZO_REF}. Matéria **penal** corre em
> dias corridos e não é coberta por este cálculo.
>
> O monitor **só acrescenta** linhas. Troque \`ABERTA\` por \`TRATADA\` quando resolver;
> nada é removido automaticamente.

| status | processo | tribunal / órgão | disponibilização | documento | embargos (${PRAZO_EDCL} d.ú.) | fatal (${PRAZO_REF} d.ú.) | termo inicial | caso |
|---|---|---|---|---|---|---|---|---|
`;

function idsNaFila(texto) {
  const ids = new Set();
  for (const m of texto.matchAll(/<!--\s*id:(\d+)\s*-->/g)) ids.add(m[1]);
  return ids;
}

function montarLinha(n, catalogo) {
  let fatal = '—';
  let edcl = '—';
  let termo = '—';
  let flag = '';

  try {
    const base = { disponibilizacao: n.disponibilizacao, tribunal: n.tribunal };
    const r = calcularPrazo({ ...base, dias: PRAZO_REF });
    fatal = r.data_fatal;
    termo = r.termo_inicial;
    if (!r.confiavel) flag = ' ⚠ SEM FERIADO LOCAL';

    // Embargos correm do MESMO termo inicial, com contagem menor — mas só fazem
    // sentido contra decisão. Em ato ordinatório a coluna fica `n/a`: contagem
    // regressiva onde não cabe recurso é ruído que ensina a ignorar o alerta.
    const classe = classificar(n.documento || n.tipo);
    if (classe === 'nao_embargavel') {
      edcl = 'n/a';
    } else {
      const e = calcularPrazo({ ...base, dias: PRAZO_EDCL });
      // `?` marca rótulo ambíguo ("Outros"): prazo calculado, mas a conferir.
      edcl = classe === 'duvida' ? `${e.data_fatal} ?` : `**${e.data_fatal}**`;
    }
  } catch (e) {
    flag = ` ⚠ ${e.message}`;
  }

  // Sinalização de possível matéria penal: o cálculo em dias úteis não se aplica.
  const alvo = `${n.orgao || ''} ${n.documento || ''} ${n.tipo || ''}`.toLowerCase();
  if (/\b(criminal|penal|execu[cç][aã]o penal|j[uú]ri)\b/.test(alvo)) {
    flag += ' ⚠ CONFERIR (possível matéria penal — dias corridos)';
  }

  const caso = catalogo.get(String(n.processo).replace(/\D/g, '')) || '?';

  return (
    `| ABERTA | ${n.processo} | ${n.tribunal} / ${n.orgao} | ${n.disponibilizacao} | ` +
    `${n.documento || n.tipo} | ${edcl} | **${fatal}**${flag} | ${termo} | ${caso} | <!-- id:${n.id} -->`
  );
}

function atualizarFila(novas, catalogo) {
  let atual = '';
  try {
    atual = fs.readFileSync(PENDENTES, 'utf8');
  } catch {
    atual = CABECALHO;
  }
  if (!atual.includes('| status |')) atual = CABECALHO + atual;

  const jaNaFila = idsNaFila(atual);
  const linhas = novas.filter((n) => !jaNaFila.has(String(n.id))).map((n) => montarLinha(n, catalogo));
  if (!linhas.length) return 0;

  fs.writeFileSync(PENDENTES, `${atual.trimEnd()}\n${linhas.join('\n')}\n`, 'utf8');
  return linhas.length;
}

// ── Execução ───────────────────────────────────────────────────────────────
(async () => {
  const oabs = carregarOABs();
  const catalogo = carregarCatalogo();

  // Janela em dia civil de Brasília (meio-dia UTC para o d2s não escorregar de dia).
  const hoje = new Date(`${hojeLocal()}T12:00:00Z`);
  const inicio = new Date(hoje);
  inicio.setUTCDate(inicio.getUTCDate() - DIAS_JANELA);

  const vistos = new Set(fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : []);
  const novas = [];

  // Atuação nacional: acompanhar de quais tribunais chega intimação, para saber
  // para quais falta calendário de feriado local.
  const tribunaisVistos = new Set();

  for (const oab of oabs) {
    for (const item of await consultar(oab, d2s(inicio), d2s(hoje))) {
      if (item.siglaTribunal) tribunaisVistos.add(item.siglaTribunal);
      if (vistos.has(item.id)) continue;
      vistos.add(item.id);
      novas.push({
        id: item.id,
        disponibilizacao: item.data_disponibilizacao,
        tribunal: item.siglaTribunal,
        tipo: item.tipoComunicacao,
        documento: item.tipoDocumento,
        processo: item.numeroprocessocommascara || item.numero_processo,
        orgao: item.nomeOrgao,
        oab_monitorada: `${oab.nome} (OAB ${oab.uf} ${oab.numero})`,
      });
    }
  }

  fs.writeFileSync(SEEN, JSON.stringify([...vistos]), 'utf8');

  // Cobertura de feriados: sem o calendário do tribunal, a data fatal calculada
  // é IGUAL OU ANTERIOR à real (erro conservador — nunca posterior), mas ainda
  // assim precisa de conferência. Registrar para o hook avisar.
  const semCalendario = [...tribunaisVistos]
    .filter((t) => feriadosLocais(t).datas.length === 0)
    .sort();
  fs.writeFileSync(
    COBERTURA,
    JSON.stringify(
      {
        _comentario:
          'Tribunais que apareceram na última execução e o subconjunto sem arquivo de feriados. ' +
          'A busca é nacional: esta lista é diagnóstico, NUNCA filtro.',
        atualizado_em: new Date().toISOString(),
        tribunais_vistos: [...tribunaisVistos].sort(),
        sem_calendario_local: semCalendario,
      },
      null,
      2,
    ),
    'utf8',
  );
  if (semCalendario.length) {
    console.log(
      `Aviso: sem calendário de feriado local para ${semCalendario.join(', ')} — ` +
        `data fatal desses tribunais sai conservadora e precisa de conferência.`,
    );
  }

  // Dead man's switch: registrar SEMPRE que a consulta completou (PRD F5.5).
  fs.writeFileSync(
    LAST_OK,
    JSON.stringify(
      { timestamp: new Date().toISOString(), janela_dias: DIAS_JANELA, oabs: oabs.length, novas: novas.length },
      null,
      2,
    ),
    'utf8',
  );

  if (!novas.length) {
    console.log(`Nenhuma comunicação nova no DJEN (janela ${d2s(inicio)}..${d2s(hoje)}, OABs ${oabs.map((o) => o.numero).join('/')}).`);
    process.exit(0);
  }

  const carimbo = new Date().toISOString();
  fs.appendFileSync(
    LOG,
    novas
      .map(
        (n) =>
          `[${carimbo}] NOVA ${n.tipo} — proc. ${n.processo} (${n.tribunal}, ${n.orgao}) — disponibilizada ${n.disponibilizacao} — ${n.documento} — dest.: ${n.oab_monitorada} — id ${n.id}`,
      )
      .join('\n') + '\n',
    'utf8',
  );

  const acrescentadas = atualizarFila(novas, catalogo);
  console.log(`${novas.length} intimação(ões) NOVA(S); ${acrescentadas} acrescentada(s) à fila.`);
  console.log(`Fila: ${PENDENTES}`);
  for (const n of novas) {
    console.log(`  - ${n.processo} (${n.tribunal}) ${n.disponibilizacao} — ${n.documento}`);
  }
  process.exit(10);
})().catch((e) => {
  const msg = `[${new Date().toISOString()}] ${e.message}`;
  try {
    fs.appendFileSync(ERROS, msg + '\n', 'utf8');
  } catch {
    /* ignore */
  }
  console.error('ERRO:', e.message);
  process.exit(1);
});

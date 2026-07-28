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
const { calcularPrazo } = require('../lib/prazo-core.js');

const SKILL = path.resolve(__dirname, '..');
const RAIZ = path.resolve(SKILL, '..', '..');
const DIR = path.join(SKILL, 'monitor');
const SEEN = path.join(DIR, 'seen.json');
const LOG = path.join(DIR, 'novas_intimacoes.log');
const PENDENTES = path.join(DIR, 'PENDENTES.md');
const LAST_OK = path.join(DIR, 'last_ok.json');
const ERROS = path.join(DIR, 'erros.log');

fs.mkdirSync(DIR, { recursive: true });

// ── Parâmetros ─────────────────────────────────────────────────────────────
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const DIAS_JANELA = parseInt(arg('dias', '10'), 10); // janela larga: seen.json deduplica
const PRAZO_REF = parseInt(arg('prazo-ref', '15'), 10); // prazo recursal cível mais comum

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
      for (const p of [].concat(procs)) mapa.set(String(p).replace(/\D/g, ''), caso);
    }
    return mapa;
  } catch {
    return new Map();
  }
}

// ── DJEN ───────────────────────────────────────────────────────────────────
const d2s = (d) => d.toISOString().slice(0, 10);

async function consultar(oab, inicio, fim) {
  const q = new URLSearchParams({
    numeroOab: oab.numero,
    ufOab: oab.uf,
    dataDisponibilizacaoInicio: inicio,
    dataDisponibilizacaoFim: fim,
    itensPorPagina: '100',
    pagina: '1',
  });
  const res = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${q}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DJEN HTTP ${res.status} (OAB ${oab.numero}/${oab.uf})`);
  return (await res.json()).items || [];
}

// ── Fila PENDENTES.md ──────────────────────────────────────────────────────
const CABECALHO = `# Fila de intimações — DJEN

> ⚠️ **Esta fila não substitui a conferência no eproc/DJEN oficial antes de protocolar.**
> O prazo é **referência** de ${PRAZO_REF} dias úteis (recurso cível comum): confira o prazo
> aplicável ao ato concreto. Matéria **penal** corre em dias corridos — não vale este cálculo.
>
> O monitor **só acrescenta** linhas. Troque \`ABERTA\` por \`TRATADA\` quando resolver;
> nada é removido automaticamente.

| status | processo | tribunal / órgão | disponibilização | documento | fatal (${PRAZO_REF} d.ú.) | termo inicial | caso |
|---|---|---|---|---|---|---|---|
`;

function idsNaFila(texto) {
  const ids = new Set();
  for (const m of texto.matchAll(/<!--\s*id:(\d+)\s*-->/g)) ids.add(m[1]);
  return ids;
}

function montarLinha(n, catalogo) {
  let fatal = '—';
  let termo = '—';
  let flag = '';

  try {
    const r = calcularPrazo({
      disponibilizacao: n.disponibilizacao,
      dias: PRAZO_REF,
      tribunal: n.tribunal,
    });
    fatal = r.data_fatal;
    termo = r.termo_inicial;
    if (!r.confiavel) flag = ' ⚠ SEM FERIADO LOCAL';
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
    `${n.documento || n.tipo} | **${fatal}**${flag} | ${termo} | ${caso} | <!-- id:${n.id} -->`
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

  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - DIAS_JANELA);

  const vistos = new Set(fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : []);
  const novas = [];

  for (const oab of oabs) {
    for (const item of await consultar(oab, d2s(inicio), d2s(hoje))) {
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

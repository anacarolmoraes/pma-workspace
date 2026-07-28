// prazo-core — núcleo determinístico de contagem de prazo processual (dias ÚTEIS).
//
// Extraído de prazo.js (PRD F5.3) para ser reusado pelo monitor do DJEN, que antes
// apenas mandava "verificar prazo com prazo.js" e parava.
//
// Zero rede, zero LLM, zero dependência: data fatal nunca sai de modelo probabilístico.
//
// Regras:
//   publicação    = 1º dia útil após a disponibilização (Lei 11.419/2006, art. 4º, §3º)
//   termo inicial = 1º dia útil após a publicação        (CPC, art. 224, §§ 2º-3º)
//   contagem      = dias úteis                            (CPC, art. 219)
//   recesso       = 20/12 a 20/01, prazos suspensos       (CPC, art. 220)
//
// LIMITES (o chamador DEVE propagar ao usuário):
//   - feriado local depende da portaria anual do tribunal (feriados/<sigla>.json);
//   - matéria penal corre em dias CORRIDOS — este núcleo não serve.
'use strict';

const fs = require('fs');
const path = require('path');

// Feriados nacionais + forenses. Estender a cada ano.
const FERIADOS_NACIONAIS = [
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-11-20', '2026-12-25',
  // 2027 (preencher ao virar o ano)
  '2027-01-01',
];

const d2s = (d) => d.toISOString().slice(0, 10);
const s2d = (s) => new Date(`${s}T12:00:00Z`); // meio-dia UTC evita bug de fuso

function emRecesso(d) {
  const m = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
}

function criarCalendario(feriadosExtra = []) {
  const set = new Set([...FERIADOS_NACIONAIS, ...feriadosExtra]);
  const diaUtil = (d) => {
    const wd = d.getUTCDay();
    return wd !== 0 && wd !== 6 && !set.has(d2s(d)) && !emRecesso(d);
  };
  const proximoDiaUtil = (d) => {
    const x = new Date(d);
    do {
      x.setUTCDate(x.getUTCDate() + 1);
    } while (!diaUtil(x));
    return x;
  };
  const contarDiasUteis = (inicio, n) => {
    let x = new Date(inicio);
    let c = 1;
    while (c < n) {
      x = proximoDiaUtil(x);
      c++;
    }
    return x;
  };
  return { set, diaUtil, proximoDiaUtil, contarDiasUteis };
}

/**
 * Carrega os feriados locais de um tribunal, se o arquivo existir.
 * @returns {{datas: string[], arquivo: string|null, aviso: string|null}}
 */
function feriadosLocais(sigla, baseDir = path.join(__dirname, '..', 'feriados')) {
  if (!sigla) return { datas: [], arquivo: null, aviso: 'Tribunal não informado — feriados locais NÃO aplicados.' };
  const arquivo = path.join(baseDir, `${String(sigla).toLowerCase()}.json`);
  try {
    const bruto = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const datas = Array.isArray(bruto) ? bruto : bruto.datas || [];
    return {
      datas,
      arquivo,
      aviso: `Feriados locais de ${String(sigla).toUpperCase()}: ${datas.length} data(s) — conferir contra a portaria anual vigente.`,
    };
  } catch {
    return {
      datas: [],
      arquivo: null,
      aviso: `SEM FERIADO LOCAL para ${String(sigla).toUpperCase()} — a data fatal pode estar errada; conferir o calendário do tribunal.`,
    };
  }
}

/**
 * Calcula termo inicial e data fatal a partir da disponibilização no DJEN.
 * @param {object} opts
 * @param {string} opts.disponibilizacao  data AAAA-MM-DD
 * @param {number} [opts.dias]            prazo em dias úteis (omitir = só termo inicial)
 * @param {string} [opts.tribunal]        sigla, para carregar feriados locais
 * @param {string[]} [opts.feriadosExtra] datas adicionais
 */
function calcularPrazo({ disponibilizacao, dias, tribunal, feriadosExtra = [] }) {
  const locais = feriadosLocais(tribunal);
  const cal = criarCalendario([...locais.datas, ...feriadosExtra]);

  const disp = s2d(disponibilizacao);
  if (Number.isNaN(disp.getTime())) {
    throw new Error(`Data de disponibilização inválida: ${disponibilizacao}`);
  }

  const publicacao = cal.proximoDiaUtil(disp);
  const termoInicial = cal.proximoDiaUtil(publicacao);
  const dataFatal = dias ? cal.contarDiasUteis(termoInicial, Number(dias)) : null;

  return {
    disponibilizacao: d2s(disp),
    publicacao: d2s(publicacao),
    termo_inicial: d2s(termoInicial),
    dias_uteis: dias ? Number(dias) : null,
    data_fatal: dataFatal ? d2s(dataFatal) : null,
    feriados_locais: {
      aplicados: locais.datas.length,
      arquivo: locais.arquivo,
    },
    avisos: [
      locais.aviso,
      'Prazo em dias ÚTEIS (cível). Matéria PENAL corre em dias corridos — não usar este cálculo.',
    ].filter(Boolean),
    confiavel: locais.datas.length > 0,
  };
}

/**
 * Quantos dias ÚTEIS faltam de `de` (exclusive) até `ate` (inclusive).
 *
 * É o número que interessa a quem tem de protocolar: "faltam 2 dias úteis" diz
 * mais que "vence em 12/08". Negativo = prazo vencido. Zero = vence hoje.
 *
 * @param {string} ate  data fatal AAAA-MM-DD
 * @param {string} [de] data base AAAA-MM-DD (padrão: hoje)
 * @param {object} [opts] { tribunal, feriadosExtra }
 */
function diasUteisRestantes(ate, de, opts = {}) {
  const locais = feriadosLocais(opts.tribunal);
  const cal = criarCalendario([...locais.datas, ...(opts.feriadosExtra || [])]);

  const fim = s2d(ate);
  const base = de ? s2d(de) : s2d(d2s(new Date()));
  if (Number.isNaN(fim.getTime()) || Number.isNaN(base.getTime())) return null;

  if (d2s(fim) === d2s(base)) return 0;

  const vencido = fim < base;
  const [ini, alvo] = vencido ? [fim, base] : [base, fim];

  let n = 0;
  const x = new Date(ini);
  while (d2s(x) < d2s(alvo)) {
    x.setUTCDate(x.getUTCDate() + 1);
    if (cal.diaUtil(x)) n += 1;
  }
  return vencido ? -n : n;
}

module.exports = {
  FERIADOS_NACIONAIS,
  criarCalendario,
  feriadosLocais,
  calcularPrazo,
  diasUteisRestantes,
  d2s,
  s2d,
};

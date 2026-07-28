// tipo-documento — classifica o tipo de comunicação do DJEN quanto a caber, ou
// não, embargos de declaração.
//
// Por que existe: a fila mistura decisão com ato ordinatório. Mostrar contagem
// regressiva de embargos para "Ato ordinatório" enche o alerta de ruído e, pior,
// ensina a ignorá-lo — que é como se perde o prazo que importa.
//
// Base legal: embargos cabem de decisão (CPC, art. 1.022). De despacho não cabe
// recurso algum (CPC, art. 1.001).
//
// A classificação é do RÓTULO que o tribunal usou, não do conteúdo: por isso o
// terceiro estado, `duvida`. Na dúvida, o prazo é calculado — errar para menos
// custaria o prazo; errar para mais custa uma conferência.
'use strict';

// Ordem importa: "DECISÃO/DESPACHO" tem que cair em embargável, não em despacho.
const EMBARGAVEL = /(senten[çc]a|ac[óo]rd[ãa]o|decis[ãa]o|monocr[áa]tic|ju[íi]zo de retrata[çc][ãa]o)/i;
const NAO_EMBARGAVEL = /^(ato ordinat[óo]rio|despacho|mero expediente|certid[ãa]o|intima[çc][ãa]o|cita[çc][ãa]o|edital|carta precat[óo]ria)\b/i;

/**
 * @param {string} tipo rótulo do documento (`tipoDocumento` do DJEN)
 * @returns {'embargavel'|'nao_embargavel'|'duvida'}
 */
function classificar(tipo) {
  const t = String(tipo || '').trim();
  if (!t) return 'duvida';
  if (EMBARGAVEL.test(t)) return 'embargavel';
  if (NAO_EMBARGAVEL.test(t)) return 'nao_embargavel';
  return 'duvida';
}

module.exports = { classificar, EMBARGAVEL, NAO_EMBARGAVEL };

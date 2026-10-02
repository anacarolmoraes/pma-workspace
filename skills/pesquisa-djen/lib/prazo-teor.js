'use strict';
// prazo-teor — lê, no teor da intimação, o prazo que o juízo FIXOU para o ato.
//
// Por que existe: a fila presumia embargos (5 d.ú.) e recurso (15 d.ú.) para toda
// decisão. Na triagem de 01/10/2026, quatro de quinze "embargos vencidos" eram, na
// verdade, prazos de 5 dias fixados no próprio despacho (réplica, manifestação sobre
// IRDR, perda de objeto) — o rótulo errado escondia o ato certo.
//
// O que se extrai: a PRIMEIRA ocorrência de "no prazo (improrrogável|comum) de N
// (N por extenso) dias (úteis|corridos)" depois do cabeçalho. Quando há mais de um
// prazo no ato (ex.: 15 para a ré contestar, depois 15 para réplica, depois 5 para
// provas), devolve também a contagem, para a fila avisar "+2 prazos no teor".
//
// Não interpreta a quem o prazo se dirige: isso é leitura da titular. A extração é
// determinística e nunca inventa número.

const { limparHtml } = require('./cliente-djen.js');

const RX_PRAZO =
  /\bprazos?\s+(?:improrrog[áa]vel\s+|comum\s+|legal\s+de\s+|sucessivo\s+|m[áa]ximo\s+)?de\s+(\d{1,3})\s*(?:\(\s*[a-zçãéíõú\s]+\s*\))?\s*dias?\b(\s+[úu]teis|\s+corridos)?/gi;

// Fim do cabeçalho (partes e advogados): o primeiro desses marcadores abre o ato.
const RX_INICIO_ATO = /\b(DESPACHO|DECIS[ÃA]O|SENTEN[ÇC]A|AC[ÓO]RD[ÃA]O|EMENTA|RELAT[ÓO]RIO|VISTOS)\b/;

/**
 * @param {string} texto HTML ou texto puro da comunicação
 * @returns {{dias:number, uteis:boolean|null, trecho:string, total:number}|null}
 *   uteis: true se o ato diz "úteis", false se diz "corridos", null se não diz
 *   (regra geral do CPC, art. 219: prazo processual em dias úteis).
 */
function extrairPrazo(texto) {
  const t = limparHtml(texto);
  if (!t) return null;
  const m0 = RX_INICIO_ATO.exec(t);
  const corpo = m0 ? t.slice(m0.index) : t;

  const achados = [];
  RX_PRAZO.lastIndex = 0;
  let m;
  while ((m = RX_PRAZO.exec(corpo))) {
    const dias = Number(m[1]);
    if (!dias || dias > 180) continue; // "prazo de 365 dias" é prescrição/convênio, não ato
    const q = (m[2] || '').trim().toLowerCase();
    achados.push({
      dias,
      uteis: q.startsWith('ú') || q.startsWith('u') ? true : q.startsWith('c') ? false : null,
      trecho: corpo.slice(Math.max(0, m.index - 60), m.index + m[0].length + 20).replace(/\s+/g, ' ').trim(),
    });
  }
  if (!achados.length) return null;
  return { ...achados[0], total: achados.length };
}

// Rótulo curto para a fila: "5 d.ú." / "10 d.c." / "15 d." (+N quando há outros).
function rotuloPrazo(p) {
  if (!p) return '';
  const un = p.uteis === false ? 'd.c.' : p.uteis === true ? 'd.ú.' : 'd.';
  return `${p.dias} ${un}${p.total > 1 ? ` (+${p.total - 1})` : ''}`;
}

module.exports = { extrairPrazo, rotuloPrazo, RX_PRAZO };

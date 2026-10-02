'use strict';
// prazo-ato — prazo de REFERÊNCIA do recurso principal conforme o órgão.
//
// Até 01/10/2026 a fila aplicava 15 dias úteis a tudo. No Juizado Especial o
// recurso inominado é de 10 dias (Lei 9.099/95, art. 42), contados em dias úteis
// (art. 12-A, incluído pela Lei 13.728/2018): a fila superestimava em cinco dias
// úteis o prazo de dez linhas da triagem. Embargos seguem 5 dias nos dois ritos
// (CPC 1.023; Lei 9.099 art. 49).
//
// O que NÃO se tenta aqui: adivinhar o recurso cabível pelo teor. Isso é leitura
// da titular; o prazo fixado no ato (lib/prazo-teor.js) cobre a maior parte.

const RX_JEC = /\b(juizado|juizados especiais|jec\b|jecc\b|jef\b|juizado especial)/i;
const RX_TURMA_RECURSAL = /\bturma recursal|turmas recursais\b/i;

/**
 * @param {{orgao?:string, tribunal?:string, documento?:string}} n
 * @param {number} padrao prazo de referência configurado (recurso cível comum)
 * @returns {{dias:number, rito:'comum'|'jec'|'turma-recursal', rotulo:string, fundamento:string}}
 */
function prazoRecurso(n, padrao = 15) {
  const alvo = `${n.orgao || ''}`;
  if (RX_TURMA_RECURSAL.test(alvo)) {
    // Da Turma Recursal cabe RE (15 d.ú.) ou embargos; recurso inominado já passou.
    return { dias: padrao, rito: 'turma-recursal', rotulo: `${padrao} d.ú. TR`, fundamento: 'Turma Recursal: RE em 15 d.ú. (CPC 1.003 §5º); conferir cabimento.' };
  }
  if (RX_JEC.test(alvo)) {
    return { dias: 10, rito: 'jec', rotulo: '10 d.ú. JEC', fundamento: 'Recurso inominado, Lei 9.099/95, art. 42; dias úteis pelo art. 12-A.' };
  }
  return { dias: padrao, rito: 'comum', rotulo: `${padrao} d.ú.`, fundamento: 'Recurso cível comum, CPC 1.003 §5º.' };
}

module.exports = { prazoRecurso, RX_JEC, RX_TURMA_RECURSAL };

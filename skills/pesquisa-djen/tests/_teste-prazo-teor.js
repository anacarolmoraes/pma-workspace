#!/usr/bin/env node
// Teste de lib/prazo-teor.js: o prazo fixado no ato sai do teor, sem presumir.
//   node skills/pesquisa-djen/tests/_teste-prazo-teor.js
'use strict';
const { extrairPrazo, rotuloPrazo } = require('../lib/prazo-teor.js');

let falhas = 0;
const t = (nome, got, esperado) => {
  const g = JSON.stringify(got);
  const e = JSON.stringify(esperado);
  const ok = g === e;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok ? '' : ` → ${g} (esperado ${e})`}`);
};
const resumo = (p) => (p ? { dias: p.dias, uteis: p.uteis, total: p.total } : null);

// Caso real da triagem (TJTO, 3º Núcleo): manifestação sobre IRDR em 5 dias improrrogáveis.
const irdr =
  'AUTOR : X ADVOGADO(A) : Y (OAB TO006573) DESPACHO/DECIS&Atilde;O O presente feito encontrava-se sobrestado ... ' +
  'INTIMEM-SE as partes para que, no prazo improrrog&aacute;vel de 5 (cinco) dias : I - Manifestem-se ...';
t('5 dias improrrogáveis', resumo(extrairPrazo(irdr)), { dias: 5, uteis: null, total: 1 });
t('rótulo 5 d.', rotuloPrazo(extrairPrazo(irdr)), '5 d.');

// Réplica em 05 (cinco) dias — zero à esquerda.
t('05 (cinco) dias', resumo(extrairPrazo('DESPACHO INTIME-SE a parte autora para, querendo, apresentar réplica no prazo de 05 (cinco) dias .')), { dias: 5, uteis: null, total: 1 });

// Três prazos no mesmo ato: devolve o primeiro e conta os demais.
const tres =
  'DESPACHO/DECISÃO Vistos. INTIME-SE a parte requerida para contestar a ação no prazo de 15 (quinze) dias, ' +
  'Após, INTIME-SE a parte Autora para Impugnação no prazo de 15 (quinze) dias . Decursado o prazo, INTIMEM-SE ' +
  'ambas as partes para indicar provas no prazo de 05 (cinco) dias .';
t('três prazos → primeiro + contagem', resumo(extrairPrazo(tres)), { dias: 15, uteis: null, total: 3 });
t('rótulo com +2', rotuloPrazo(extrairPrazo(tres)), '15 d. (+2)');

// Dias úteis e corridos explícitos.
t('15 dias úteis', resumo(extrairPrazo('DECISÃO apresente contestação no prazo de 15 (quinze) dias úteis, sob pena')), { dias: 15, uteis: true, total: 1 });
t('10 dias corridos', resumo(extrairPrazo('SENTENÇA ... recurso no prazo de 10 dias corridos.')), { dias: 10, uteis: false, total: 1 });
t('rótulo d.c.', rotuloPrazo(extrairPrazo('SENTENÇA ... prazo de 10 dias corridos.')), '10 d.c.');

// Sem prazo no ato: null, nunca inventa.
t('sem prazo', extrairPrazo('SENTENÇA HOMOLOGO O ACORDO e JULGO EXTINTO o processo. Arquivem-se.'), null);

// "prazo de 365 dias" (não é ato processual) é ignorado.
t('365 dias ignorado', extrairPrazo('DECISÃO a prescrição no prazo de 365 dias não se consumou.'), null);

// Prazo citado só no cabeçalho (antes do ato) não conta; sem marcador de ato, varre tudo.
t('só cabeçalho não conta', extrairPrazo('Procedimento no prazo de 5 dias AUTOR : X ADVOGADO(A) : Y DESPACHO Vistos. Arquivem-se.'), null);
t('sem marcador de ato varre tudo', resumo(extrairPrazo('intimem-se para manifestar no prazo de 15 dias.')), { dias: 15, uteis: null, total: 1 });

console.log(falhas ? `\n${falhas} falha(s).` : '\ntodos os casos corretos.');
process.exit(falhas ? 1 : 0);

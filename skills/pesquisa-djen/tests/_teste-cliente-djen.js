#!/usr/bin/env node
// Teste de lib/cliente-djen.js: o cliente é a parte cujo advogado tem OAB nossa.
//   node skills/pesquisa-djen/tests/_teste-cliente-djen.js
'use strict';
const { identificarCliente, rotuloCliente } = require('../lib/cliente-djen.js');

const OABS = [{ numero: '6573', uf: 'TO' }, { numero: '6951', uf: 'TO' }];
let falhas = 0;
const t = (nome, got, esperado) => {
  const ok = got === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok ? '' : ` → "${got}" (esperado "${esperado}")`}`);
};

// Cabeçalho típico do TJTO, com entidades HTML e nossa OAB no autor.
const autor = {
  texto:
    'Procedimento Comum C&iacute;vel N&ordm; 0000000-00.2020.8.27.2729/TO AUTOR : FULANA DE TAL ' +
    'ADVOGADO(A) : ANA CAROLINA RIBEIRO DE MORAES PAULO (OAB TO006573) R&Eacute;U : EMPRESA LTDA ' +
    'ADVOGADO(A) : OUTRO ADVOGADO (OAB TO001234) DESPACHO/DECIS&Atilde;O Vistos.',
};
t('autor com OAB nossa', rotuloCliente(identificarCliente(autor, OABS)), 'FULANA DE TAL');
t('papel', identificarCliente(autor, OABS).papel, 'AUTOR');

// Nós do lado do réu/apelado: o nome que sai é o do apelado.
const apelado = {
  texto:
    'Apela&ccedil;&atilde;o C&iacute;vel N&ordm; 1 APELANTE : EMPRESA LTDA ADVOGADO(A) : X (OAB TO004328) ' +
    'APELADO : BELTRANA SILVA ADVOGADO(A) : FL&Aacute;VIA PAULO (OAB TO006951) DECIS&Atilde;O Trata-se',
};
t('apelado com OAB nossa', rotuloCliente(identificarCliente(apelado, OABS)), 'BELTRANA SILVA');

// Dois autores nossos: os dois nomes.
const dois = {
  texto:
    'AUTOR : LUCIMAR GOMES ADVOGADO(A) : A (OAB TO006951) AUTOR : JAILCO GOMES ADVOGADO(A) : A (OAB TO006951) ' +
    'R&Eacute;U : PALMAS PRIME LTDA ADVOGADO(A) : M (OAB TO004666) DESPACHO/DECIS&Atilde;O Levantem-se',
};
t('dois autores nossos', rotuloCliente(identificarCliente(dois, OABS)), 'LUCIMAR GOMES e JAILCO GOMES');

// Sem OAB nossa no cabeçalho: cai para destinatários, com `?`.
const semNossa = { texto: 'AUTOR : A ADVOGADO(A) : Z (OAB SP000001) R&Eacute;U : B', destinatarios: [{ nome: 'A' }, { nome: 'B' }] };
t('sem OAB nossa → destinatários com ?', rotuloCliente(identificarCliente(semNossa, OABS)), 'A; B ?');

// Sem texto e sem destinatários: `?`, nunca inventa.
t('vazio → ?', rotuloCliente(identificarCliente({}, OABS)), '?');

// Rótulo entre parênteses depois do nome (TJTO: "LEONARDO (AUTOR)") é descartado.
const rot = { texto: 'APELANTE : LEONARDO MATA (AUTOR) ADVOGADO(A) : ANA (OAB TO006573) APELADO : CPA LTDA (R&Eacute;U) ADVOGADO(A) : P (OAB TO004413) EMENTA' };
t('rótulo entre parênteses descartado', rotuloCliente(identificarCliente(rot, OABS)), 'LEONARDO MATA');

console.log(falhas ? `\n${falhas} falha(s).` : '\ntodos os casos corretos.');
process.exit(falhas ? 1 : 0);

#!/usr/bin/env node
// Suíte offline do buscar.js — mesma convenção do hooks/_teste-block-secrets.js.
// Zero rede: testa só a lógica pura (limpeza, elegibilidade, recorte, pontuação).
// Rodar: node skills/radar-jurisprudencia/scripts/_teste-buscar.js
'use strict';

const { limparHtml, elegivel, recortar, pontuar } = require('./buscar.js');

let falhas = 0;
function teste(nome, cond) {
  if (cond) { console.log(`  ok    ${nome}`); }
  else { console.log(`  FALHA ${nome}`); falhas++; }
}

// ── limparHtml ─────────────────────────────────────────────────────────────
teste('remove tags e decodifica entidades',
  limparHtml('<p>Julgo &amp; <b>procedente</b>&nbsp;o pedido</p>') === 'Julgo & procedente o pedido');
teste('descarta bloco <style>',
  !limparHtml('<style>p{color:red}</style>Texto').includes('color'));
teste('colapsa espaços',
  limparHtml('a\n\n  b\t c') === 'a b c');

// ── elegivel ───────────────────────────────────────────────────────────────
const longo = 'x'.repeat(1000);
teste('edital nunca é elegível',
  !elegivel({ tipoComunicacao: 'Edital', tipoDocumento: 'SENTENÇA' }, longo));
teste('tipoDocumento decisão + texto longo entra',
  elegivel({ tipoComunicacao: 'Intimação', tipoDocumento: 'DESPACHO / DECISÃO' }, longo));
teste('sem tipo mas com dispositivo entra',
  elegivel({ tipoComunicacao: 'Intimação', tipoDocumento: '' }, `${longo} ante o exposto, julgo procedente`));
teste('sem tipo e sem dispositivo não entra',
  !elegivel({ tipoComunicacao: 'Intimação', tipoDocumento: '' }, longo));
teste('curto de mero expediente não entra',
  !elegivel({ tipoComunicacao: 'Intimação', tipoDocumento: 'DECISÃO' }, 'Intimem-se as partes. Conclusos.'));
teste('curto mas decisório (defiro) entra',
  elegivel({ tipoComunicacao: 'Intimação', tipoDocumento: 'DECISÃO' }, 'Defiro a tutela de urgência pleiteada, ante o exposto.'));

// ── recortar ───────────────────────────────────────────────────────────────
const relatorio = 'R'.repeat(1500);
const comDispositivo = `${relatorio} Ante o exposto, JULGO PROCEDENTE o pedido para limitar a retenção a 25%. ${'F'.repeat(3000)}`;
teste('com marcador longe da abertura: junta abertura + dispositivo',
  recortar(comDispositivo).includes('[...]') && recortar(comDispositivo).includes('JULGO PROCEDENTE'));
teste('sem marcador: primeiros 2000 chars',
  recortar('S'.repeat(5000)).length === 2000 && !recortar('S'.repeat(5000)).includes('[...]'));
teste('marcador já na abertura: recorte simples sem duplicar',
  !recortar('Ante o exposto, julgo. ' + 'y'.repeat(3000)).includes('[...]'));

// ── pontuar ────────────────────────────────────────────────────────────────
teste('conta ocorrências ignorando acento e caixa',
  pontuar('A RESCISÃO do contrato. Pediu rescisao.', ['rescisão']) === 2);
teste('soma vocabulário e aplica teto por termo',
  pontuar('lote '.repeat(50) + 'distrato', ['lote', 'distrato']) === 11);
teste('termo ausente pontua zero',
  pontuar('texto qualquer', ['32-A']) === 0);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);

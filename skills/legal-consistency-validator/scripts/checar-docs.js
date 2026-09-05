#!/usr/bin/env node
/**
 * checar-docs.js — confere os documentos citados numa peça contra o rol declarado.
 *
 * POR QUE EXISTE
 * A prosa cita "Doc. 3" e ninguém confere se o Doc. 3 existe, se foi juntado, ou se o rol
 * declarado tem documento que a peça nunca cita. Em contestação isso é pior: a documental
 * vai junto com a peça (CPC, art. 434) e o que não foi juntado não entra depois.
 *
 * CONVENÇÃO (frontmatter da peça):
 *   documentos:
 *     - n: 1
 *       descricao: Contrato de compra e venda de 10/03/2024
 *       arquivo: docs/contrato.pdf        # opcional, relativo à pasta da peça
 *
 * USO
 *   node skills/legal-consistency-validator/scripts/checar-docs.js clientes/<caso>/CONTESTACAO.md
 *   node ... CONTESTACAO.md --rol          # imprime o rol de documentos em markdown, para colar na peça
 *
 * SAÍDA: exit 0 se tudo confere · exit 1 com a lista do que falta.
 * Não é portão do md2docx: é checagem do validator (Fase 7) e do Estágio 6 do orchestrator.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const arg = process.argv.slice(2);
const alvo = arg.find((a) => !a.startsWith('--'));
const imprimirRol = arg.includes('--rol');
if (!alvo) {
  console.error('Uso: node checar-docs.js <peca.md> [--rol]');
  process.exit(2);
}
const texto = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
const fm = (texto.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
const corpo = texto.slice(fm ? fm.length + 8 : 0);

// --- rol declarado -------------------------------------------------------------------------
const declarados = new Map();
const fmLinhas = fm.split('\n');
const ini = fmLinhas.findIndex((l) => /^documentos:\s*$/.test(l));
const bloco = [];
if (ini >= 0) for (let i = ini + 1; i < fmLinhas.length && /^\s/.test(fmLinhas[i]); i++) bloco.push(fmLinhas[i]);
let atual = null;
for (const linha of bloco) {
  const item = linha.match(/^\s*-\s*n:\s*(\d+)/);
  if (item) { atual = { n: Number(item[1]), descricao: '', arquivo: '' }; declarados.set(atual.n, atual); continue; }
  if (!atual) continue;
  const d = linha.match(/^\s+descricao:\s*(.+)$/); if (d) atual.descricao = d[1].trim();
  const a = linha.match(/^\s+arquivo:\s*(.+)$/); if (a) atual.arquivo = a[1].trim();
}

// --- citados na prosa (fora de blockquote, para não contar Doc. do adversário transcrito) ------
const citados = new Set();
for (const linha of corpo.split('\n')) {
  if (/^\s*>/.test(linha)) continue;
  for (const m of linha.matchAll(/\bDocs?\.\s*(\d+)(?:\s*(?:,|e|a)\s*(\d+))*/g)) {
    for (const n of m[0].match(/\d+/g)) citados.add(Number(n));
  }
}

// --- confronto -----------------------------------------------------------------------------
const problemas = [];
if (declarados.size === 0) problemas.push('Frontmatter sem `documentos:` — a peça cita documentos sem rol declarado.');
for (const n of [...citados].sort((a, b) => a - b)) {
  if (!declarados.has(n)) problemas.push(`Doc. ${n} citado na prosa e ausente do rol declarado.`);
}
for (const [n, d] of declarados) {
  if (!citados.has(n)) problemas.push(`Doc. ${n} (${d.descricao || 'sem descrição'}) declarado e nunca citado na prosa.`);
  if (!d.descricao) problemas.push(`Doc. ${n} sem descrição.`);
  if (d.arquivo) {
    const p = path.resolve(path.dirname(alvo), d.arquivo);
    if (!fs.existsSync(p)) problemas.push(`Doc. ${n}: arquivo não encontrado em ${d.arquivo}.`);
  }
}

if (imprimirRol) {
  console.log('## Documentos que acompanham esta peça\n');
  for (const [n, d] of [...declarados].sort((a, b) => a[0] - b[0])) console.log(`- **Doc. ${n}** — ${d.descricao}`);
  console.log('');
}

if (problemas.length) {
  console.log(`checar-docs: ${problemas.length} problema(s) em ${path.basename(alvo)}`);
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log(`checar-docs: ${citados.size} documento(s) citado(s), rol confere (${path.basename(alvo)}).`);

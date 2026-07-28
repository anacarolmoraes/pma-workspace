#!/usr/bin/env node
// lint-remissoes: confere remissões cruzadas "(Capítulo X)" de uma peça
// contra os capítulos realmente definidos. Aceita duas fontes:
//   - gerar_*.js  → capítulos via titulo('X.', '...')
//   - peca .md    → capítulos via "# X. Nome" (dialeto md2docx)
// Uso: node scripts/lint-remissoes.js caminho/da/peca.{js,md}
// Sai com código 1 se houver remissão a capítulo inexistente.
'use strict';

const fs = require('fs');

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node lint-remissoes.js <peca.js|peca.md>'); process.exit(2); }
const src = fs.readFileSync(arquivo, 'utf8');

// Capítulos definidos: titulo('IV.', 'Nome') no .js ou "# IV. Nome" no .md
const definidos = new Map();
const reDef = /\.md$/i.test(arquivo)
  ? /^#\s+([IVXLC]+)\.\s+(.*)$/gm
  : /titulo\(\s*'([IVXLC]+)\.'\s*,\s*'([^']*)'/g;
for (const m of src.matchAll(reDef)) {
  definidos.set(m[1], m[2].slice(0, 70));
}

// Remissões no texto: "Capítulo X" / "(Capítulo X)" / "Capítulos IV a VII"
const remissoes = [];
for (const m of src.matchAll(/Cap[íi]tulos?\s+([IVXLC]+)(?:\s+a\s+([IVXLC]+))?/g)) {
  remissoes.push({ de: m[1], ate: m[2] || null, trecho: src.slice(Math.max(0, m.index - 60), m.index + 30).replace(/\s+/g, ' ') });
}

const romanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
const expandir = (de, ate) => {
  if (!ate) return [de];
  const i = romanos.indexOf(de), f = romanos.indexOf(ate);
  return (i >= 0 && f >= i) ? romanos.slice(i, f + 1) : [de, ate];
};

let erros = 0;
console.log(`Capítulos definidos: ${[...definidos.keys()].join(', ') || '(nenhum)'}\n`);
for (const r of remissoes) {
  for (const cap of expandir(r.de, r.ate)) {
    if (!definidos.has(cap)) {
      erros++;
      console.log(`✘ Remissão a Capítulo ${cap} INEXISTENTE — contexto: "...${r.trecho}..."`);
    }
  }
}

if (erros === 0) {
  console.log('✔ Todas as remissões apontam para capítulos existentes.');
  console.log('\nConferência HUMANA ainda necessária: o lint garante que o capítulo existe,');
  console.log('não que é o capítulo CERTO. Tabela para conferência:');
  for (const [num, nome] of definidos) console.log(`  ${num}. ${nome}`);
  process.exit(0);
} else {
  console.error(`\n${erros} remissão(ões) quebrada(s). Corrigir antes de gerar o .docx.`);
  process.exit(1);
}

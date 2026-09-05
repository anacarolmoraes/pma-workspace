#!/usr/bin/env node
// lint-placeholder: peça com placeholder não compila.
//
// O que falta na peça volta ao orchestrator como "falta saber" da estrutura
// (Estágio 0.5); não vai para o texto entre colchetes. Até 2026-09-05 nada
// barrava `[VERIFICAR]`, `[NOME]`, `[[...]]` — só o checklist do Estágio 6,
// que é prosa. Este lint fecha a porta.
//
// Uso: node scripts/lint-placeholder.js caminho/da/peca.md
// Sai com 1 se houver placeholder fora de citação em bloco e de comentário HTML.
//
// O que conta como placeholder:
//   [[qualquer coisa]]                 — slot de template (TEMPLATE_INICIAL_*)
//   [VERIFICAR ...] [CONFERIR ...] [INSERIR ...] [PREENCHER ...] [COMPLETAR ...]
//   [NOME] [VALOR] [DATA] [CPF] [CNPJ] [ENDEREÇO] [COMARCA] [SLUG] [XXX] [...] [x]
// O que NÃO conta: "[...]" dentro de citação em bloco (omissão em transcrição),
// "[sic]", e colchetes dentro de comentário <!-- -->.
'use strict';

const fs = require('fs');

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node lint-placeholder.js <peca.md>'); process.exit(2); }

let src = fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
// Comentários HTML fora: o template traz instruções entre <!-- --> que o md2docx ignora.
src = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

const linhas = src.split('\n');
const RX_SLOT = /\[\[[^\]\n]*\]\]/g;
const RX_MARCA =
  /\[(?:VERIFICAR|CONFERIR|INSERIR|PREENCHER|COMPLETAR|CONFIRMAR|NOME|VALOR|DATA|CPF|CNPJ|ENDERE[ÇC]O|COMARCA|SLUG|N[ÚU]MERO|X{2,}|x|\.{3}|…)\b[^\]\n]*\]/g;

const achados = [];
let emFrontmatter = false;
linhas.forEach((l, i) => {
  if (i === 0 && l.trim() === '---') { emFrontmatter = true; return; }
  if (emFrontmatter) { if (l.trim() === '---') emFrontmatter = false; return; }
  const t = l.trim();
  if (t.startsWith('>')) return; // citação em bloco: "[...]" é omissão legítima
  for (const m of t.matchAll(RX_SLOT)) achados.push({ linha: i + 1, texto: m[0] });
  for (const m of t.matchAll(RX_MARCA)) {
    if (/^\[sic\]$/i.test(m[0])) continue;
    achados.push({ linha: i + 1, texto: m[0] });
  }
});

if (!achados.length) {
  console.log('✔ Nenhum placeholder na prosa da peça.');
  process.exit(0);
}
console.error(`✘ ${achados.length} placeholder(s) na peça — .docx não gerado:`);
for (const a of achados) console.error(`   linha ${a.linha}: ${a.texto}`);
console.error('\nO que falta não vai para o texto entre colchetes: volta ao orchestrator como "falta saber" ' +
  'do <PECA>.estrutura.md, ou se preenche com o dado do documento. Slot [[...]] de template é preenchido antes de compilar.');
process.exit(1);

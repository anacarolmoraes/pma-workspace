#!/usr/bin/env node
// lint-injecao — portão do md2docx: a peça não carrega técnica antiética.
// Regra dura 7 do AGENTS.md (titular, 05/09/2026): sem prompt injection, sem
// texto oculto, sem caractere invisível, em documento nenhum gerado aqui.
//
// É o mesmo detector dos hooks do Claude Code (scripts/lib/injecao.js), mas
// aqui ele vale para QUALQUER agente: ninguém obtém o .docx sem passar por ele.
//
//   node skills/peca-pma-builder/scripts/lint-injecao.js peca.md [--json]
//   exit 0 = limpo · 1 = achados (bloqueia) · 2 = erro de uso
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const { detectar, formatar } = require(path.join(RAIZ, 'scripts', 'lib', 'injecao'));

function main() {
  const args = process.argv.slice(2);
  const alvo = args.find((a) => !a.startsWith('--'));
  const json = args.includes('--json');
  if (!alvo || !fs.existsSync(alvo)) {
    console.error('Uso: node skills/peca-pma-builder/scripts/lint-injecao.js <peca.md> [--json]');
    process.exit(2);
  }
  const achados = detectar(fs.readFileSync(alvo, 'utf8'));
  if (json) {
    console.log(JSON.stringify({ arquivo: alvo, achados }, null, 2));
  } else if (!achados.length) {
    console.log(`lint-injecao: ${path.basename(alvo)} — limpo.`);
  } else {
    console.log(`lint-injecao: ${path.basename(alvo)} — ${achados.length} achado(s):`);
    console.log(formatar(achados, 10));
    console.log(
      '\nRegra dura 7 do AGENTS.md: nenhuma técnica antiética em documento nenhum. O argumento vai ' +
        'no texto visível. Não há escape no frontmatter; transcrição de injeção ADVERSA para ' +
        'denunciá-la é gravação da titular.',
    );
  }
  process.exit(achados.length ? 1 : 0);
}

main();

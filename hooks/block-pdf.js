#!/usr/bin/env node
// block-pdf — hook PreToolUse (Read): PDF nunca é lido direto (AGENTS.md, regra 3).
//
// Sem o `.md` irmão, o agente não tem texto auditável nem página citável; com
// ele, ler o PDF é gastar contexto duas vezes. A exceção da regra é conferência
// visual de layout, assinatura ou carimbo — e ela sempre é de página
// específica, por isso o discriminador é o parâmetro `pages` do Read.
//
// Irmão do block-md-integral (que cuida da outra metade: não ler o .md longo
// inteiro). Protocolo: stdin JSON; exit 2 = bloqueia; parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const { lerStdin, parseEntrada } = require('./lib/transcript');

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  if (String(entrada.tool_name || '') !== 'Read') process.exit(0);
  const input = entrada.tool_input || {};
  const alvo = input.file_path || input.path;
  if (!alvo || !/\.pdf$/i.test(alvo)) process.exit(0);
  if (input.pages) process.exit(0); // conferência visual de página específica

  const md = alvo.replace(/\.pdf$/i, '.md');
  const temMd = fs.existsSync(md);
  process.stderr.write(
    'BLOQUEADO por block-pdf: PDF não se lê direto (regra 3 do AGENTS.md).\n' +
      (temMd
        ? `Já existe o Markdown irmão: leia \`${md}\` — se for longo, ` +
          `node skills/pdfmd/scripts/ler-pdfmd.js "${md}" --mapa\n`
        : 'Converta antes com a skill pdfmd:\n' +
          '  node skills/pdfmd/scripts/converter-caso.js <pasta do caso>\n' +
          `  node skills/pdfmd/scripts/executar-pdfmd.js "${alvo}" --ocr auto --lang por --page-breaks --export-images --ocr-images --strict\n`) +
      'Para conferir visualmente uma assinatura, carimbo ou layout, leia só a página: Read com `pages`.\n',
  );
  process.exit(2);
}

lerStdin(main);

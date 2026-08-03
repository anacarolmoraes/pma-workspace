#!/usr/bin/env node
// Impede Read acidental do Markdown canônico de bundles pdfmd longos.
'use strict';
const fs = require('fs');
const path = require('path');

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

function caminhoRead(entrada) {
  const nome = String(entrada.tool_name || entrada.toolName || '');
  if (nome && nome !== 'Read') return null;
  const input = entrada.tool_input || entrada.toolInput || {};
  return input.file_path || input.filePath || input.path || null;
}

function main(raw) {
  let entrada;
  try { entrada = JSON.parse(raw); } catch { process.exit(0); }
  const alvo = caminhoRead(entrada);
  if (!alvo || !/\.md$/i.test(alvo) || /\.index\.md$/i.test(alvo)) process.exit(0);
  const md = path.resolve(alvo);
  const manifesto = md.replace(/\.md$/i, '.pdfmd.json');
  if (!fs.existsSync(md) || !fs.existsSync(manifesto)) process.exit(0);
  let linhas = 0;
  const texto = fs.readFileSync(md, 'utf8');
  for (let i = 0; i < texto.length && linhas <= 300; i++) if (texto.charCodeAt(i) === 10) linhas++;
  if (linhas <= 300) process.exit(0);
  process.stderr.write([
    'BLOQUEADO por block-md-integral: este Markdown é o canônico longo de um bundle pdfmd.',
    `Use: node skills/pdfmd/scripts/ler-pdfmd.js "${alvo}" --mapa`,
    'Modos seletivos: --buscar "termo" | --paginas N-M | --secao "titulo" | --avisos.',
    'Para leitura integral deliberada: acrescente --completo ao modo escolhido.',
    '',
  ].join('\n'));
  process.exit(2);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => main(buf));
process.stdin.on('error', () => process.exit(0));

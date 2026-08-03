#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { estimarTokens, segmentar } = require('../scripts/ler-pdfmd');
const reader = path.resolve(__dirname, '../scripts/ler-pdfmd.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfmd-reader-'));

function run(args) {
  const result = spawnSync(process.execPath, [reader, ...args], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout;
}

try {
  const md = path.join(tmp, 'amostra.md');
  const canonical = [
    '<a id="pdf-page-1"></a>', '<!-- pdfmd:page=1; method=native -->', '',
    '# Contrato', '', 'A entrada custa R$ 10.000,00 e vence em 14/09.', '',
    '- primeiro item', '- segundo item', '',
    '<a id="pdf-page-2"></a>', '<!-- pdfmd:page=2; method=tesseract -->', '',
    '## Extrato', '', '| Data | Valor |', '|---|---|', '| 14/09 | 500 |', '',
    'A voz ativa torna a petição mais clara.', '',
  ].join('\n');
  fs.writeFileSync(md, canonical);
  fs.writeFileSync(md.replace('.md', '.index.md'), '# Mapa curto\n');
  fs.writeFileSync(md.replace('.md', '.pdfmd.json'), JSON.stringify({ pages: [{ pdf_page: 2, warnings: ['ocr_low_confidence'], review_required: true }] }));

  assert.strictEqual(estimarTokens('1234'), 2);
  const units = segmentar(canonical.split('\n'));
  assert(units.some((u) => u.texto === '- primeiro item\n- segundo item'));
  assert(units.some((u) => u.texto.includes('| 14/09 | 500 |')));
  const map = run([md, '--mapa']);
  assert.strictEqual(map, '# Mapa curto\n');
  const search = run([md, '--buscar', 'voz ativa', '--max-tokens', '80']);
  assert(search.includes('A voz ativa torna a petição mais clara.'));
  assert(search.includes('p. PDF 2'));
  assert(search.includes('ocr_low_confidence'));
  assert(estimarTokens(search.split('\n\n').slice(1).join('\n\n')) <= 80);
  const table = run([md, '--buscar', '14/09', '--max-tokens', '120']);
  assert(table.includes('| Data | Valor |'));
  assert(table.includes('| 14/09 | 500 |'));
  const warning = run([md, '--avisos']);
  assert(warning.includes('p. PDF 2: ocr_low_confidence'));
  console.log('OK - leitor seletivo, unidades sem corte, orçamento, mapa e avisos');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

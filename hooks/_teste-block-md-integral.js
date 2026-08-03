#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const hook = path.join(__dirname, 'block-md-integral.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfmd-hook-'));

function rodar(alvo, tool = 'Read', env = {}) {
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: alvo } }),
    encoding: 'utf8', env: { ...process.env, ...env },
  });
}

try {
  const longo = path.join(tmp, 'longo.md');
  const curto = path.join(tmp, 'curto.md');
  const comum = path.join(tmp, 'comum.md');
  const orfao = path.join(tmp, 'orfao.pdfmd.json');
  fs.writeFileSync(longo, Array.from({ length: 302 }, (_, i) => `linha ${i}`).join('\n'));
  fs.writeFileSync(longo.replace(/\.md$/, '.pdfmd.json'), '{}');
  fs.writeFileSync(curto, 'curto\n');
  fs.writeFileSync(curto.replace(/\.md$/, '.pdfmd.json'), '{}');
  fs.writeFileSync(comum, Array.from({ length: 302 }, () => 'x').join('\n'));
  fs.writeFileSync(orfao, '{}');
  const casos = [
    ['longo com manifesto bloqueia', rodar(longo).status === 2],
    ['curto passa', rodar(curto).status === 0],
    ['sem manifesto passa', rodar(comum).status === 0],
    ['manifesto órfão passa', rodar(orfao.replace('.pdfmd.json', '.md')).status === 0],
    ['outra ferramenta passa', rodar(longo, 'Grep').status === 0],
    ['guarda de recursão passa', rodar(longo, 'Read', { CLAUDE_INVOKED_BY: 'teste' }).status === 0],
  ];
  const falhas = casos.filter(([, ok]) => !ok);
  for (const [nome, ok] of casos) console.log(`${ok ? 'OK' : 'FALHOU'} - ${nome}`);
  process.exit(falhas.length ? 1 : 0);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

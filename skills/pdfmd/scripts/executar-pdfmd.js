#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.resolve(__dirname, '..', '..', '..');
const cwdOriginal = process.cwd();
const ambientePath = path.join(raiz, 'perfil', 'ambiente.json');
const motor = path.join(raiz, 'vendor', 'pdfmd');

if (!fs.existsSync(ambientePath)) {
  console.error('perfil/ambiente.json não existe — rode: node scripts/setup.js');
  process.exit(2);
}

const py = JSON.parse(fs.readFileSync(ambientePath, 'utf8')).python;
if (!py || !fs.existsSync(py)) {
  console.error('Python do adv_env não encontrado — rode: node scripts/setup.js');
  process.exit(2);
}

const recebidos = process.argv.slice(2);
const argumentos = [];
for (let i = 0; i < recebidos.length; i++) {
  const arg = recebidos[i];
  if ((arg === '-o' || arg === '--output') && i + 1 < recebidos.length) {
    argumentos.push(arg, path.resolve(cwdOriginal, recebidos[++i]));
  } else if (!arg.startsWith('-') && arg.toLowerCase().endsWith('.pdf')) {
    argumentos.push(path.resolve(cwdOriginal, arg));
  } else {
    argumentos.push(arg);
  }
}

const resultado = spawnSync(
  py,
  ['-m', 'pdfmd.cli', ...argumentos],
  {
    cwd: motor,
    // OPENBLAS/OMP em 1 thread: sem isso o numpy do OCR morre com
    // "Memory allocation still failed after 10 retries" em máquina com pouca RAM.
    env: { ...process.env, PYTHONUTF8: '1', OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1' },
    encoding: 'utf8',
    stdio: 'inherit',
  },
);

if (resultado.error) {
  console.error(resultado.error.message);
  process.exit(1);
}
process.exit(resultado.status ?? 1);

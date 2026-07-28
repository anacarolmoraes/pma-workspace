#!/usr/bin/env node
// migrar-fila-embargos — acrescenta (ou recalcula) a coluna de embargos de
// declaração na fila PENDENTES.md.
//
// Criado em 28/07/2026 para as filas geradas antes da coluna existir. Pode ser
// rodado quantas vezes for preciso: se a coluna já existe, recalcula os valores.
//
// Uso: node skills/pesquisa-djen/scripts/migrar-fila-embargos.js [--dry-run]
'use strict';

const fs = require('fs');
const path = require('path');
const { calcularPrazo } = require('../lib/prazo-core.js');
const { classificar } = require('../lib/tipo-documento.js');

const SKILL = path.resolve(__dirname, '..');
const RAIZ = path.resolve(SKILL, '..', '..');
const PENDENTES = path.join(SKILL, 'monitor', 'PENDENTES.md');
const DRY = process.argv.includes('--dry-run');

const DIAS = (() => {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'monitor-djen.json'), 'utf8'));
    return c.prazos_referencia?.embargos_declaracao ?? 5;
  } catch {
    return 5;
  }
})();

const linhas = fs.readFileSync(PENDENTES, 'utf8').split('\n');

// Onde fica (ou vai ficar) a coluna, a partir do cabeçalho da tabela.
const iCab = linhas.findIndex((l) => /^\|\s*status\s*\|/i.test(l.trim()));
if (iCab < 0) {
  console.error('Cabeçalho da tabela não encontrado em PENDENTES.md — nada feito.');
  process.exit(1);
}

const cab = linhas[iCab].split('|');
let iEdcl = cab.findIndex((c) => /embargos/i.test(c));
const jaExistia = iEdcl > -1;
if (!jaExistia) {
  iEdcl = cab.findIndex((c) => /fatal/i.test(c));
  if (iEdcl < 0) {
    console.error('Coluna "fatal" não encontrada — nada feito.');
    process.exit(1);
  }
}

const cont = { embargavel: 0, duvida: 0, nao_embargavel: 0, semData: 0 };

function valor(disp, tribunal, documento) {
  const classe = classificar(documento);
  if (classe === 'nao_embargavel') {
    cont.nao_embargavel += 1;
    return ' n/a ';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(disp)) {
    cont.semData += 1;
    return ' — ';
  }
  try {
    const fatal = calcularPrazo({ disponibilizacao: disp, dias: DIAS, tribunal }).data_fatal;
    cont[classe] += 1;
    return classe === 'duvida' ? ` ${fatal} ? ` : ` **${fatal}** `;
  } catch {
    cont.semData += 1;
    return ' — ';
  }
}

const saida = linhas.map((linha, i) => {
  if (!linha.trim().startsWith('|')) return linha;

  if (i === iCab) {
    if (jaExistia) return linha;
    const c = linha.split('|');
    c.splice(iEdcl, 0, ` embargos (${DIAS} d.ú.) `);
    return c.join('|');
  }

  // Linha separadora do markdown.
  if (/^\s*\|[\s\-|]+\|\s*$/.test(linha)) {
    if (jaExistia) return linha;
    const c = linha.split('|');
    c.splice(iEdcl, 0, '---');
    return c.join('|');
  }

  const c = linha.split('|');
  if (!/^\s*ABERTA\s*$/i.test(c[1] || '')) return linha;

  const disp = (c[4] || '').trim();
  const tribunal = ((c[3] || '').split('/')[0] || '').trim();
  const documento = (c[5] || '').trim();
  const v = valor(disp, tribunal, documento);

  if (jaExistia) c[iEdcl] = v;
  else c.splice(iEdcl, 0, v);
  return c.join('|');
});

const resumo =
  `${cont.embargavel} decisão(ões) com prazo de embargos, ` +
  `${cont.duvida} a conferir (rótulo ambíguo), ` +
  `${cont.nao_embargavel} sem cabimento (ato ordinatório/despacho), ` +
  `${cont.semData} sem data utilizável`;

if (DRY) {
  console.log(`[dry-run] ${resumo}.`);
  process.exit(0);
}

fs.writeFileSync(PENDENTES, saida.join('\n'), 'utf8');
console.log(`Fila atualizada (${DIAS} d.ú.): ${resumo}.`);

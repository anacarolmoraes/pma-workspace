#!/usr/bin/env node
// orgaos-frequentes — conta, na fila monitor/PENDENTES.md (e no ARQUIVO.md), quantas
// comunicações vieram de cada órgão de PRIMEIRO GRAU. É o dado que decide para quais
// varas vale escrever um perfil de juízo (F4.2 do PRD de 04/09/2026): perfil se escreve
// para a vara que recebe as iniciais do escritório, não para a que aparece uma vez.
//
// Só leitura. Uso:
//   node skills/pesquisa-djen/scripts/orgaos-frequentes.js [--top 10] [--todos]
//   --todos inclui 2º grau (câmaras, turmas, presidência) — por padrão fica de fora.
'use strict';

const fs = require('fs');
const path = require('path');

const MONITOR = path.join(__dirname, '..', 'monitor');
const ARQS = ['PENDENTES.md', 'ARQUIVO.md'].map((n) => path.join(MONITOR, n)).filter((p) => fs.existsSync(p));
const argv = process.argv.slice(2);
const top = Number((argv[argv.indexOf('--top') + 1] || 10));
const todos = argv.includes('--todos');

const SEGUNDO_GRAU = /c[âa]mara|turma|se[çc][ãa]o|presid[êe]ncia|vice-presid|conselho|[óo]rg[ãa]o especial|tribunal pleno|SEC\. DA|gabinete d[oa] des/i;

const cont = new Map();
for (const arq of ARQS) {
  for (const l of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\|\s*(ABERTA|TRATADA)\s*\|\s*([\d.-]+)\s*\|\s*([^|]+)\|/);
    if (!m) continue;
    const orgao = m[3].trim();
    if (!todos && SEGUNDO_GRAU.test(orgao)) continue;
    const k = orgao.replace(/\s+/g, ' ');
    const e = cont.get(k) || { n: 0, processos: new Set() };
    e.n++;
    e.processos.add(m[2].trim());
    cont.set(k, e);
  }
}
const linhas = [...cont.entries()].sort((a, b) => b[1].processos.size - a[1].processos.size || b[1].n - a[1].n).slice(0, top);
console.log(`Órgãos ${todos ? '(todos os graus)' : 'de 1º grau'} mais frequentes na fila do DJEN (${ARQS.map((p) => path.basename(p)).join(' + ')}):\n`);
console.log('| Processos | Comunicações | Tribunal / órgão |');
console.log('|---|---|---|');
for (const [orgao, e] of linhas) console.log(`| ${e.processos.size} | ${e.n} | ${orgao} |`);
console.log(`\n${cont.size} órgão(s) distintos. Perfil de vara: <bundles>/direito/pecas/peticao-inicial/perfis/ (template em _template-perfil-vara.md).`);

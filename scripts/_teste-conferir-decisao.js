#!/usr/bin/env node
// Teste do conferir-decisao: monta um caso fictício em pasta temporária e confere que o
// script apanha data, valor, percentual, cláusula, documento e nome que só existem na decisão,
// e deixa passar o que também está na ANALISE.md ou no contrato.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'conferir-decisao.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conferir-decisao-'));

fs.writeFileSync(path.join(tmp, 'ANALISE.md'), `---
caso: teste
---
# Análise
Contrato de 10/03/2019 (Doc. 2), preço de R$ 48.000,00; retenção pedida de 25%; cláusula 7.1.
Comprador: Fulano de Tal Exemplo.
`, 'utf8');
fs.writeFileSync(path.join(tmp, 'contrato.md'), `# Contrato
Assinado em 10 de março de 2019. Valor total R$ 48.000,00. Cláusula 7.1: retenção de 25% (vinte e cinco por cento).
Vendedora: Loteadora Modelo Ltda.
`, 'utf8');
fs.writeFileSync(path.join(tmp, 'sentenca.md'), `# Sentença
Vistos. Contrato firmado em 10/03/2019 (Doc. 2), preço R$ 48.000,00. Retenção de 75% sobre o pago.
IPTU de 2016 a 2018 no valor de R$ 6.225,77 conforme cláusula 12.3 e Doc. 9.
Autor: Beltrano Outro Processo. Ré: Loteadora Modelo Ltda.
Prazo contado de 15/08/2022.
`, 'utf8');

const r = spawnSync(process.execPath, [SCRIPT, path.join(tmp, 'sentenca.md'), '--json'], { encoding: 'utf8' });
fs.rmSync(tmp, { recursive: true, force: true });

let saida;
try { saida = JSON.parse(r.stdout); } catch (e) { console.error('saída não é JSON:', r.stdout, r.stderr); process.exit(1); }

const faltamFormas = saida.faltam.map((x) => x.forma);
const achadasFormas = saida.encontradas.map((x) => x.forma);
const falhas = [];
const esperaFalta = ['75%', 'R$ 6.225,77', '15/08/2022', 'Doc. 9', 'cláusula 12.3', 'Beltrano Outro Processo'];
for (const f of esperaFalta) if (!faltamFormas.some((x) => x.toLowerCase() === f.toLowerCase())) falhas.push(`devia faltar: ${f}`);
const esperaAcha = ['10/03/2019', 'R$ 48.000,00', 'Doc. 2', 'Loteadora Modelo Ltda'];
for (const f of esperaAcha) if (!achadasFormas.some((x) => x.toLowerCase().includes(f.toLowerCase()))) falhas.push(`devia encontrar: ${f}`);
if (r.status !== 1) falhas.push(`exit esperado 1 (há faltas), veio ${r.status}`);

if (falhas.length) { console.error('conferir-decisao: FALHOU\n  ' + falhas.join('\n  ')); process.exit(1); }
console.log('conferir-decisao: ok (6 âncoras só da decisão apanhadas; 4 presentes nos autos liberadas)');

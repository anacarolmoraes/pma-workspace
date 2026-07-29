#!/usr/bin/env node
// radar-jurisprudencia: fatia o candidatos.json em arquivos de lote para a triagem Haiku.
//
// Existe para o orquestrador NUNCA precisar dar Read no candidatos.json (que carrega todos
// os trechos — dezenas de milhares de tokens). Zero LLM: corta o top-N por score e grava
// lotes que os triadores leem direto do disco.
//
// Uso: node lotes.js --entrada DIR/candidatos.json [--top 60] [--tamanho 25] [--saida DIR]
//      (--saida default: mesmo diretório do candidatos.json)
'use strict';

const fs = require('fs');
const path = require('path');

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { a[k.slice(2)] = true; }
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}

const a = args(process.argv);
if (!a.entrada) {
  console.error('Uso: node lotes.js --entrada DIR/candidatos.json [--top 60] [--tamanho 25] [--saida DIR]');
  process.exit(2);
}

const entrada = path.resolve(a.entrada);
const saida = path.resolve(a.saida || path.dirname(entrada));
const top = Number(a.top || 60);
const tamanho = Number(a.tamanho || 25);

const dados = JSON.parse(fs.readFileSync(entrada, 'utf8'));
// candidatos.json já vem ordenado por score; o slice preserva o ranking.
const selecionados = (dados.candidatos || []).slice(0, top)
  .map((c) => ({ id: c.id, tribunal: c.tribunal, tipoDocumento: c.tipoDocumento, classe: c.classe, trecho: c.trecho }));

fs.mkdirSync(saida, { recursive: true });
const arquivos = [];
for (let i = 0; i < selecionados.length; i += tamanho) {
  const n = arquivos.length + 1;
  const arq = path.join(saida, `lote-${n}.json`);
  fs.writeFileSync(arq, JSON.stringify(selecionados.slice(i, i + tamanho), null, 1), 'utf8');
  arquivos.push(arq);
}

const total = (dados.candidatos || []).length;
console.log(`Lotes: ${arquivos.length} (${selecionados.length} de ${total} candidatos, ${tamanho}/lote)`);
if (total > top) console.log(`Fora do corte: ${total - top} candidatos de score menor (seguem no candidatos.json p/ segunda passada)`);
for (const arq of arquivos) console.log(`  ${arq}`);

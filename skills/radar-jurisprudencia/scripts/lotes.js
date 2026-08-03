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
const todos = dados.candidatos || [];

// Só os PRINCIPAIS vão à triagem. A marcação principal x similar vem do
// buscar.js e copia o fluxo da Secretaria de Jurisprudência do STJ: num lote de
// julgados repetidos, um é lido a fundo e os demais apontam para ele. Pagar
// triagem por N cópias da mesma tese é desperdício puro.
//
// `--incluir-similares` desfaz o corte, para quando se procura justamente a
// divergência dentro de um grupo aparentemente uniforme.
const incluirSimilares = Boolean(a['incluir-similares']);
const elegiveis = incluirSimilares ? todos : todos.filter((c) => c.natureza !== 'similar');

// candidatos.json já vem ordenado por score; o slice preserva o ranking.
const selecionados = elegiveis.slice(0, top).map((c) => ({
  id: c.id,
  tribunal: c.tribunal,
  tipoDocumento: c.tipoDocumento,
  classe: c.classe,
  // Relator e o aviso de só-ementa mudam o peso do achado na triagem: ementa
  // sem dispositivo é resumo oficial, não razão de decidir.
  relator: c.relator || undefined,
  so_ementa: c.so_ementa || undefined,
  trecho: c.trecho,
}));

fs.mkdirSync(saida, { recursive: true });
const arquivos = [];
for (let i = 0; i < selecionados.length; i += tamanho) {
  const n = arquivos.length + 1;
  const arq = path.join(saida, `lote-${n}.json`);
  fs.writeFileSync(arq, JSON.stringify(selecionados.slice(i, i + tamanho), null, 1), 'utf8');
  arquivos.push(arq);
}

const total = todos.length;
const similares = total - elegiveis.length;
console.log(`Lotes: ${arquivos.length} (${selecionados.length} de ${total} candidatos, ${tamanho}/lote)`);
// Corte silencioso é o que faz um relatório parecer exaustivo sem ser.
if (similares) {
  console.log(`Fora por similaridade: ${similares} candidato(s) agrupados sob um principal (use --incluir-similares para triá-los).`);
}
if (elegiveis.length > top) {
  console.log(`Fora do corte: ${elegiveis.length - top} candidatos de score menor (seguem no candidatos.json p/ segunda passada)`);
}
for (const arq of arquivos) console.log(`  ${arq}`);

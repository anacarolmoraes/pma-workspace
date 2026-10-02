#!/usr/bin/env node
// preencher-cliente — preenche a coluna "caso" das linhas da fila que estão em `?`
// com o nome do cliente, consultando a comunicação original no DJEN pelo número do
// processo e pela data de disponibilização (lib/cliente-djen.js decide quem é nosso).
//
// Para linhas novas o monitor já faz isso sozinho; este script é o retroativo.
//
//   node skills/pesquisa-djen/scripts/preencher-cliente.js            # só linhas ABERTA com caso `?`
//   node skills/pesquisa-djen/scripts/preencher-cliente.js --todas    # inclui TRATADA
//   node skills/pesquisa-djen/scripts/preencher-cliente.js --dry-run  # mostra, não grava
//
// A API recusa rajadas ("sistema muito ocupado"): há pausa entre chamadas e até 5
// tentativas por linha. O que não resolver fica `?` e é listado no fim.
'use strict';

const fs = require('fs');
const path = require('path');
const { identificarCliente, rotuloCliente } = require('../lib/cliente-djen.js');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const PENDENTES = path.join(__dirname, '..', 'monitor', 'PENDENTES.md');
const args = process.argv.slice(2);
const TODAS = args.includes('--todas');
const DRY = args.includes('--dry-run');
const PAUSA_MS = 1500;
const TENTATIVAS = 5;

function carregarOABs() {
  const { advogados } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'advogados.json'), 'utf8'));
  return advogados.filter((a) => a.monitorar_djen !== false).map((a) => ({ numero: a.oab_numero, uf: a.oab_uf }));
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(processo, data, id) {
  const q = new URLSearchParams({
    numeroProcesso: processo.replace(/\D/g, ''),
    dataDisponibilizacaoInicio: data,
    dataDisponibilizacaoFim: data,
    itensPorPagina: '20',
  });
  for (let t = 1; t <= TENTATIVAS; t++) {
    try {
      const res = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${q}`, { headers: { Accept: 'application/json' } });
      const j = await res.json();
      const items = j.items || [];
      if (items.length) return items.find((i) => String(i.id) === String(id)) || items[0];
      if (j.status === 'error') throw new Error(j.message);
      return null; // resposta válida e vazia: não há o que achar
    } catch (e) {
      if (t === TENTATIVAS) return null;
      await esperar(PAUSA_MS * t * 2);
    }
  }
  return null;
}

(async () => {
  const oabs = carregarOABs();
  const txt = fs.readFileSync(PENDENTES, 'utf8');
  const linhas = txt.split('\n');
  const cab = linhas.find((l) => l.startsWith('| status |'));
  if (!cab) throw new Error('cabeçalho da fila não encontrado');
  const cols = cab.split('|').map((c) => c.trim().toLowerCase());
  const iStatus = cols.findIndex((c) => c === 'status');
  const iProc = cols.findIndex((c) => c.includes('processo'));
  const iDisp = cols.findIndex((c) => c.includes('disponibiliza'));
  const iCaso = cols.findIndex((c) => c === 'caso');
  if (iCaso < 0) throw new Error('coluna "caso" não encontrada');

  let alteradas = 0;
  const pendentes = [];
  for (let k = 0; k < linhas.length; k++) {
    const l = linhas[k];
    if (!l.startsWith('|') || l === cab || /^\|\s*-+/.test(l)) continue;
    const c = l.split('|');
    const status = (c[iStatus] || '').trim();
    if (!TODAS && status !== 'ABERTA') continue;
    if ((c[iCaso] || '').trim() !== '?') continue;
    const processo = (c[iProc] || '').trim();
    const data = (c[iDisp] || '').trim();
    const id = (/id:(\d+)/.exec(l) || [])[1];
    const item = await buscar(processo, data, id);
    await esperar(PAUSA_MS);
    if (!item) {
      pendentes.push(processo);
      console.log(`  ?  ${processo} — API não respondeu`);
      continue;
    }
    const rotulo = rotuloCliente(identificarCliente(item, oabs));
    if (rotulo === '?') {
      pendentes.push(processo);
      console.log(`  ?  ${processo} — sem OAB nossa no cabeçalho e sem destinatários`);
      continue;
    }
    c[iCaso] = ` ${rotulo} `;
    linhas[k] = c.join('|');
    alteradas++;
    console.log(`  ok ${processo} — ${rotulo}`);
  }

  if (!DRY && alteradas) fs.writeFileSync(PENDENTES, linhas.join('\n'), 'utf8');
  console.log(`\n${alteradas} linha(s) preenchida(s)${DRY ? ' (dry-run, nada gravado)' : ''}; ${pendentes.length} ficaram em ?.`);
  if (pendentes.length) console.log('Repetir mais tarde para: ' + pendentes.join(', '));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

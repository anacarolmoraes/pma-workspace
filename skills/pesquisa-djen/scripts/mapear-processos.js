#!/usr/bin/env node
// mapear-processos.js — descobre quais processos pertencem a qual caso e escreve
// clientes/_processos.json, que o monitor.js já lê para preencher a coluna "caso"
// da fila do DJEN.
//
// O monitor sempre soube consumir esse arquivo (carregarCatalogo), mas nada nunca
// o escrevia: toda linha de PENDENTES.md nascia com `caso: ?`. O efeito prático é
// que a fila avisa que um prazo vence sem dizer de quem — e alguém tem de abrir o
// número do processo à mão. Aconteceu com o acórdão do caso Diego.
//
// ── O problema difícil, e por que este script é conservador ────────────────────
// Varrer o texto dos documentos NÃO funciona: peça jurídica é cheia de número de
// processo que não é o dela. A primeira versão deste script atribuiu 27 processos
// à pasta do Diego — 26 eram precedentes citados no voto e na contestação — e mais
// de 500 a outra pasta. Atribuição errada é pior do que `?`: a fila passaria a
// mentir com aparência de certeza.
//
// Por isso a busca é em dois níveis, e o segundo só entra se o primeiro falhar:
//
//   forte  — número no NOME de arquivo ou de pasta. É como o eproc nomeia o que
//            se baixa dele (00368542420238272729_25_ANEXO2.pdf). Não há como um
//            precedente citado virar nome de arquivo.
//   fraco  — número no texto, mas apenas colado a um rótulo de autuação
//            ("Processo nº", "Autos do processo nº", "Apelação Cível nº") e apenas
//            no começo do documento, onde fica a capa. Marcado como inferido.
//
// Uso:
//   node skills/pesquisa-djen/scripts/mapear-processos.js            # escreve
//   node skills/pesquisa-djen/scripts/mapear-processos.js --dry-run  # só mostra
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const CLIENTES = path.join(RAIZ, 'clientes');
const SAIDA = path.join(CLIENTES, '_processos.json');

const CNJ = String.raw`(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})`;

// Fronteira por dígito, não por `\b`: o eproc nomeia o arquivo
// `00368542420238272729_25_ANEXO2.pdf`, e `_` é caractere de palavra — `\b` não
// casa entre o último dígito e o sublinhado, o que fazia o nível forte nunca disparar.
const RX_NOME = new RegExp(String.raw`(?<!\d)${CNJ}(?!\d)`, 'g');

// Rótulo de autuação imediatamente antes do número. É o que separa a capa do
// documento ("Processo nº X") de uma citação no corpo ("(TJ-MG - AC: X ...)").
const RX_ROTULADO = new RegExp(
  String.raw`(?:processo|autos|apela[çc][ãa]o\s+c[íi]vel|procedimento\s+comum(?:\s+c[íi]vel)?|a[çc][ãa]o|recurso\s+inominado|cumprimento\s+de\s+senten[çc]a|execu[çc][ãa]o)` +
    String.raw`[^\n]{0,40}?n?[º°.]?\s*` +
    String.raw`(?<!\d)${CNJ}(?!\d)`,
  'gi',
);

const LEGIVEIS = new Set(['.md', '.txt']);
const JANELA_CAPA = 4000; // a autuação vive na capa; ler o documento inteiro traz o corpo junto
const ALERTA_MUITOS = 8; // acima disso a pasta provavelmente não é um caso só

const fmt = (m, i = 1) => `${m[i]}-${m[i + 1]}.${m[i + 2]}.${m[i + 3]}.${m[i + 4]}.${m[i + 5]}`;

function colher(rx, texto, destino) {
  rx.lastIndex = 0;
  let m;
  while ((m = rx.exec(texto)) !== null) destino.add(fmt(m));
}

function varrer(dir, forte, fraco, profundidade = 0) {
  if (profundidade > 4) return;
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entradas) {
    if (e.name.startsWith('.') || e.name.endsWith('_assets') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    colher(RX_NOME, e.name, forte);
    if (e.isDirectory()) {
      varrer(p, forte, fraco, profundidade + 1);
      continue;
    }
    if (!LEGIVEIS.has(path.extname(e.name).toLowerCase())) continue;
    try {
      const fd = fs.openSync(p, 'r');
      const buf = Buffer.alloc(JANELA_CAPA);
      const lidos = fs.readSync(fd, buf, 0, JANELA_CAPA, 0);
      fs.closeSync(fd);
      colher(RX_ROTULADO, buf.slice(0, lidos).toString('utf8'), fraco);
    } catch {
      /* arquivo ilegível não interrompe a varredura */
    }
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(CLIENTES)) {
    console.error(`Pasta não encontrada: ${CLIENTES}`);
    process.exit(2);
  }

  const casos = fs
    .readdirSync(CLIENTES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();

  const mapa = {};
  const origem = {}; // caso → 'nome-de-arquivo' | 'capa (inferido)'
  const donos = new Map();
  const suspeitos = [];
  const semNumero = [];

  for (const caso of casos) {
    const forte = new Set();
    const fraco = new Set();
    varrer(path.join(CLIENTES, caso), forte, fraco);

    const procs = forte.size ? [...forte] : [...fraco];
    origem[caso] = forte.size ? 'nome-de-arquivo' : 'capa (inferido)';

    if (!procs.length) {
      semNumero.push(caso);
      continue;
    }
    if (procs.length > ALERTA_MUITOS) {
      suspeitos.push({ caso, n: procs.length, origem: origem[caso] });
      continue; // não entra no mapa: atribuição em massa é ruído, não conhecimento
    }

    mapa[caso] = procs.sort();
    for (const p of procs) {
      if (!donos.has(p)) donos.set(p, []);
      donos.get(p).push(caso);
    }
  }

  const total = Object.values(mapa).reduce((s, v) => s + v.length, 0);
  console.log(`mapear-processos: ${casos.length} pasta(s) · ${Object.keys(mapa).length} mapeada(s) · ${total} processo(s)\n`);
  for (const [caso, procs] of Object.entries(mapa)) {
    console.log(`  ${caso.padEnd(28)} ${procs.join(', ')}   [${origem[caso]}]`);
  }

  if (semNumero.length) {
    console.log(`\n  sem número identificável: ${semNumero.join(', ')}`);
  }

  if (suspeitos.length) {
    console.log(`\n⚠️  pasta(s) com mais de ${ALERTA_MUITOS} processos — NÃO mapeadas, para não poluir a fila:`);
    for (const s of suspeitos) console.log(`      ${s.caso} (${s.n} números, via ${s.origem})`);
    console.log('      Provavelmente pasta de pesquisa, não de caso único. Separar ou mapear à mão.');
  }

  const colisoes = [...donos.entries()].filter(([, cs]) => cs.length > 1);
  if (colisoes.length) {
    console.log('\n⚠️  mesmo processo em mais de uma pasta (peça de referência copiada entre casos?):');
    for (const [p, cs] of colisoes) console.log(`      ${p} → ${cs.join(', ')}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nada foi escrito.');
    return;
  }

  const cabecalho = {
    _comentario:
      'Gerado por skills/pesquisa-djen/scripts/mapear-processos.js varrendo clientes/. ' +
      'Consumido por monitor.js (coluna "caso" de PENDENTES.md). Rode o script de novo ao abrir caso novo. ' +
      'Entrada manual sobrevive à regeração? NÃO — o arquivo é reescrito. Camada C1, não versionar.',
    _gerado_em: new Date().toISOString().slice(0, 10),
    _origem: origem,
  };
  fs.writeFileSync(SAIDA, JSON.stringify({ ...cabecalho, ...mapa }, null, 2) + '\n', 'utf8');
  console.log(`\nEscrito: ${path.relative(RAIZ, SAIDA)}`);
}

main();

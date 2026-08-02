#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function uso(erro) {
  if (erro) console.error(erro);
  console.error([
    'Uso:',
    '  node skills/pdfmd/scripts/ler-pdfmd.js documento.md --mapa',
    '  node skills/pdfmd/scripts/ler-pdfmd.js documento.md --paginas 8-12,15',
    '  node skills/pdfmd/scripts/ler-pdfmd.js documento.md --secao "Dos pedidos"',
    '  node skills/pdfmd/scripts/ler-pdfmd.js documento.md --buscar "contratação" [--contexto 2]',
  ].join('\n'));
  process.exit(2);
}

function valor(args, nome) {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : null;
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function paginasPedidas(expressao) {
  const paginas = new Set();
  for (const parte of expressao.split(',')) {
    const trecho = parte.trim();
    if (!trecho) continue;
    const intervalo = trecho.match(/^(\d+)-(\d+)$/);
    if (intervalo) {
      const inicio = Number(intervalo[1]);
      const fim = Number(intervalo[2]);
      if (inicio < 1 || fim < inicio) uso(`Intervalo inválido: ${trecho}`);
      for (let p = inicio; p <= fim; p++) paginas.add(p);
    } else if (/^\d+$/.test(trecho) && Number(trecho) >= 1) {
      paginas.add(Number(trecho));
    } else {
      uso(`Página inválida: ${trecho}`);
    }
  }
  return paginas;
}

function segmentarPaginas(linhas) {
  const segmentos = new Map();
  let atual = null;
  let inicio = 0;
  for (let i = 0; i < linhas.length; i++) {
    const match = linhas[i].match(/^<!-- pdfmd:page=(\d+);/);
    if (!match) continue;
    if (atual !== null) segmentos.set(atual, linhas.slice(inicio, Math.max(inicio, i - 1)));
    atual = Number(match[1]);
    inicio = Math.max(0, i - 1);
  }
  if (atual !== null) segmentos.set(atual, linhas.slice(inicio));
  return segmentos;
}

function paginaDaLinha(linhas, indice) {
  for (let i = indice; i >= 0; i--) {
    const match = linhas[i].match(/^<!-- pdfmd:page=(\d+);/);
    if (match) return Number(match[1]);
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const arquivo = args[0];
  if (!arquivo) uso();
  const md = path.resolve(arquivo);
  if (!fs.existsSync(md) || !fs.statSync(md).isFile()) uso(`Arquivo não encontrado: ${arquivo}`);
  const texto = fs.readFileSync(md, 'utf8');
  const linhas = texto.split(/\r?\n/);

  if (args.includes('--mapa')) {
    const mapa = md.replace(/\.md$/i, '.index.md');
    if (!fs.existsSync(mapa)) uso(`Mapa não encontrado: ${mapa}`);
    process.stdout.write(fs.readFileSync(mapa, 'utf8'));
    return;
  }

  const expressaoPaginas = valor(args, '--paginas');
  if (expressaoPaginas) {
    const pedidas = paginasPedidas(expressaoPaginas);
    const segmentos = segmentarPaginas(linhas);
    const ausentes = [...pedidas].filter((pagina) => !segmentos.has(pagina));
    if (ausentes.length) uso(`Página(s) sem marcador: ${ausentes.join(', ')}`);
    const saida = [...pedidas].sort((a, b) => a - b).flatMap((pagina) => segmentos.get(pagina));
    process.stdout.write(saida.join('\n').trim() + '\n');
    return;
  }

  const secao = valor(args, '--secao');
  if (secao) {
    const alvo = normalizar(secao);
    let inicio = -1;
    let nivel = 0;
    for (let i = 0; i < linhas.length; i++) {
      const heading = linhas[i].match(/^(#{1,4})\s+(.+?)\s*$/);
      if (heading && normalizar(heading[2]) === alvo) {
        inicio = i;
        nivel = heading[1].length;
        break;
      }
    }
    if (inicio < 0) uso(`Seção não encontrada: ${secao}`);
    let fim = linhas.length;
    for (let i = inicio + 1; i < linhas.length; i++) {
      const heading = linhas[i].match(/^(#{1,4})\s+/);
      if (heading && heading[1].length <= nivel) {
        fim = i;
        break;
      }
    }
    const pagina = paginaDaLinha(linhas, inicio);
    const prefixo = pagina ? `<!-- pdfmd:section-start-page=${pagina} -->\n` : '';
    process.stdout.write(prefixo + linhas.slice(inicio, fim).join('\n').trim() + '\n');
    return;
  }

  const busca = valor(args, '--buscar');
  if (busca) {
    const contexto = Math.max(0, Number(valor(args, '--contexto') || 1));
    const termo = normalizar(busca);
    const blocos = [];
    for (let i = 0; i < linhas.length; i++) {
      if (!normalizar(linhas[i]).includes(termo)) continue;
      const pagina = paginaDaLinha(linhas, i);
      blocos.push([
        `<!-- resultado: p. PDF ${pagina || '?'}; linha ${i + 1} -->`,
        ...linhas.slice(Math.max(0, i - contexto), Math.min(linhas.length, i + contexto + 1)),
      ].join('\n'));
    }
    process.stdout.write((blocos.length ? blocos.join('\n\n') : 'Nenhuma ocorrência.') + '\n');
    return;
  }

  uso('Informe --mapa, --paginas, --secao ou --buscar.');
}

main();

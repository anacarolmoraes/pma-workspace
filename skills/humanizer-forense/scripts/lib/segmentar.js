// segmentar — divide uma peça .md (dialeto PMA) em frontmatter, capítulos,
// parágrafos de prosa própria, transcrições (blockquote) e diretivas (::).
//
// Compartilhado por checar-invariantes.js e ritmo.js. O lint-ia.js tem a sua
// própria segmentação porque é portão (protect-gates) e não se toca fora de
// sessão de manutenção; se um dia convergir, é por lá.
'use strict';

const MARCA_SNAPSHOT = /^<!--\s*snapshot humanizer-forense[^>]*-->\s*\n?/;

function normalizar(texto) {
  return String(texto).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(MARCA_SNAPSHOT, '');
}

function separarFrontmatter(texto) {
  const linhas = texto.split('\n');
  if (linhas[0] && linhas[0].trim() === '---') {
    const fim = linhas.indexOf('---', 1);
    if (fim > 0) return { frontmatter: linhas.slice(1, fim).join('\n'), corpo: linhas.slice(fim + 1).join('\n') };
  }
  return { frontmatter: '', corpo: texto };
}

function campoFrontmatter(fm, chave) {
  const m = new RegExp(`^${chave}:\\s*(.*)$`, 'm').exec(fm || '');
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

// Devolve { frontmatter, capitulos: [{ titulo, preambulo, paragrafos[], citacoes[], diretivas[] }] }
// `paragrafos` é prosa própria: sem blockquote, sem diretiva, sem comentário HTML.
function segmentar(texto) {
  const { frontmatter, corpo } = separarFrontmatter(normalizar(texto));
  const semComentario = corpo.replace(/<!--[\s\S]*?-->/g, '');
  const linhas = semComentario.split('\n');

  const capitulos = [];
  let atual = novoCapitulo('(preâmbulo)', true);
  let paragrafo = [];
  let citacao = [];
  let diretiva = null;

  const fechaParagrafo = () => {
    if (paragrafo.length) atual.paragrafos.push(paragrafo.join(' ').replace(/\s+/g, ' ').trim());
    paragrafo = [];
  };
  const fechaCitacao = () => {
    if (citacao.length) atual.citacoes.push(citacao.join('\n'));
    citacao = [];
  };

  for (const bruta of linhas) {
    const l = bruta.replace(/\s+$/, '');

    if (diretiva !== null) {
      // bloco ::endereco ... :: (fecha na linha "::" sozinha)
      diretiva.push(l);
      if (l.trim() === '::') { atual.diretivas.push(diretiva.join('\n')); diretiva = null; }
      continue;
    }
    if (/^#\s/.test(l)) {
      fechaParagrafo(); fechaCitacao();
      capitulos.push(atual);
      atual = novoCapitulo(l.replace(/^#\s*/, '').trim(), false);
      continue;
    }
    if (/^\s*>/.test(l)) {
      fechaParagrafo();
      citacao.push(l.replace(/^\s*>\s?/, ''));
      continue;
    }
    if (citacao.length && l.trim() === '') { fechaCitacao(); continue; }
    if (citacao.length) { citacao.push(l); continue; } // continuação "lazy" de blockquote

    if (/^\s*::/.test(l)) {
      fechaParagrafo();
      const t = l.trim();
      // "::center X", "::br" são de linha única; "::endereco" / "::assinatura" abrem bloco até "::"
      if (/^::(endereco|assinatura|bloco)\b/.test(t) && !/^::\w+\s+\S/.test(t)) diretiva = [t];
      else atual.diretivas.push(t);
      continue;
    }
    if (l.trim() === '') { fechaParagrafo(); continue; }
    paragrafo.push(l.trim());
  }
  fechaParagrafo(); fechaCitacao();
  if (diretiva) atual.diretivas.push(diretiva.join('\n'));
  capitulos.push(atual);

  return { frontmatter, capitulos };
}

function novoCapitulo(titulo, preambulo) {
  return { titulo, preambulo, paragrafos: [], citacoes: [], diretivas: [] };
}

const capitulosReais = (seg) => seg.capitulos.filter((c) => !c.preambulo);
const prosaDe = (cap) => cap.paragrafos.join('\n');
const prosaArgumentativa = (seg) => capitulosReais(seg).map(prosaDe).join('\n');

// Frases de um trecho: corta em . ! ? seguidos de espaço e maiúscula, sem cortar
// em abreviaturas frequentes do gênero (art., n., Min., Rel., Des., inc., fls., p.).
function frases(texto) {
  const protegido = texto.replace(
    /\b(arts?|n|nº|Min|Rel|Des|inc|fls?|p|pp|cf|ex|obs|al|vol|ed|Dr|Dra|Sr|Sra|Exmo|Exma|c\/c|v|g)\.\s/gi,
    (m) => m.replace('. ', '.'),
  );
  return protegido
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const palavras = (texto) => (texto.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu) || []).filter((w) => /[\p{L}\p{N}]/u.test(w));
const contarPalavras = (texto) => palavras(texto).length;

module.exports = {
  segmentar,
  normalizar,
  separarFrontmatter,
  campoFrontmatter,
  capitulosReais,
  prosaDe,
  prosaArgumentativa,
  frases,
  palavras,
  contarPalavras,
  MARCA_SNAPSHOT,
};

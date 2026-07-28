#!/usr/bin/env node
// md2docx: compila uma peça escrita em Markdown (dialeto PMA) para .docx
// usando os helpers do peca-pma-builder. A peça em .md é a fonte da verdade:
// mais barata de escrever/editar/reler por agente do que chamadas p()/pMixed()
// em gerar_*.js, e legível diretamente por humanos e pelos lints.
//
// Uso: node scripts/md2docx.js caminho/da/peca.md [--out caminho/saida.docx] [--skip-lint]
//
// Portões automáticos (2026-07-16): antes de compilar, roda lint-remissoes.js
// e o lint-ia.js do humanizer-forense — se algum falhar, NÃO gera o .docx
// (--skip-lint pula, só para emergências). Depois de compilar, valida o
// timbrado do arquivo gerado (validarTimbrado do index.js).
//
// ── Dialeto (ver SKILL.md, seção "Autoria em Markdown") ──────────────────────
// ---                       front-matter YAML-lite: titulo, processo, out
// # I. Dos Fatos            → titulo('I.', 'Dos Fatos')
// ## I.1. Cronologia        → subtitulo('I.1.', 'Cronologia')
// > texto da citação        → pQuote (linhas contíguas viram um parágrafo;
// >                            linha ">" vazia separa parágrafos da citação)
// ::center TEXTO            → pCentered (bold, para "AGRAVO EM RECURSO ESPECIAL")
// ::left TEXTO              → parágrafo alinhado à esquerda
// ::right TEXTO             → parágrafo alinhado à direita
// ::br [spaceAfter]         → quebra() (linha em branco vertical)
// ::pagebreak               → pageBreak()
// ::endereco ... ::         → endereco([linhas]) (negrito, à esquerda)
// ::assinatura ... ::       → assinatura(); linhas "NOME | OAB",
//                             linha opcional "local: Palmas — TO, data."
// **negrito** e *itálico*   → runs inline (pMixed)
// linha inteira em **...**  → parágrafo bold (não usar como rótulo meta-textual — ver SKILL.md)
// Parágrafo comum: linhas contíguas são unidas com espaço; linha em branco separa.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const PMA = require(path.join(__dirname, '..'));
const {
  p, pMixed, pQuote, pCentered, titulo, subtitulo,
  endereco, quebra, pageBreak, assinatura, buildDoc, validarTimbrado, docx,
} = PMA;
const { AlignmentType } = docx;

// ── Portão de lints (roda antes de compilar; falha = não gera .docx) ────────
//
// Duas naturezas de portão (PRD F2.2):
//   BLOQUEIO  (exit 1) — remissões quebradas, cacoetes de IA, citação divergente ou
//                        precedente de tribunal superior ausente do acervo.
//   APROVAÇÃO (exit 3) — citação a página `status: em_teste`. Não é erro: é decisão
//                        da titular. Some declarando `cita_em_teste: sim` no
//                        frontmatter da peça, para que fique REGISTRADA no documento.
function rodarLints(mdPath) {
  const lints = [
    { nome: 'lint-remissoes', script: path.join(__dirname, 'lint-remissoes.js') },
    { nome: 'lint-ia', script: path.join(__dirname, '..', '..', 'humanizer-forense', 'scripts', 'lint-ia.js') },
    { nome: 'lint-citacoes', script: path.join(__dirname, 'lint-citacoes.js') },
  ];
  for (const l of lints) {
    if (!fs.existsSync(l.script)) {
      console.warn(`md2docx: AVISO — ${l.nome} não encontrado em ${l.script}; portão pulado.`);
      continue;
    }
    const r = spawnSync(process.execPath, [l.script, mdPath], { encoding: 'utf8' });
    if (r.status === 3) {
      console.error(`\nmd2docx: ${l.nome} exige APROVAÇÃO — .docx não gerado.\n`);
      console.error(r.stdout || '');
      console.error(
        'Isto não é um erro de redação: a peça cita fundamento ainda NÃO conferido contra\n' +
          'fonte oficial. Ou se confere a fonte e se promove a página a `status: vigente`,\n' +
          'ou se assume a citação declarando no frontmatter da peça:  cita_em_teste: sim\n',
      );
      process.exit(3);
    }
    if (r.status !== 0) {
      console.error(`\nmd2docx: ${l.nome} FALHOU — .docx não gerado. Corrija e recompile (ou use --skip-lint em emergência).\n`);
      console.error(r.stdout || '');
      console.error(r.stderr || '');
      process.exit(1);
    }
  }
  console.log('md2docx: lints OK (remissões + anti-IA + citações)');
}

// ── Inline: **bold**, *italic*, ***bold+italic*** → runs de pMixed ───────────
function parseInline(text) {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((seg) => {
    if (/^\*\*\*[^*]+\*\*\*$/.test(seg)) return { text: seg.slice(3, -3), bold: true, italics: true };
    if (/^\*\*[^*]+\*\*$/.test(seg)) return { text: seg.slice(2, -2), bold: true };
    if (/^\*[^*]+\*$/.test(seg)) return { text: seg.slice(1, -1), italics: true };
    return { text: seg };
  });
}

function paragrafo(text, opts = {}) {
  const runs = parseInline(text);
  if (runs.length === 1 && !runs[0].bold && !runs[0].italics) return p(runs[0].text, opts);
  return pMixed(runs, opts);
}

// ── Front-matter YAML-lite (chave: valor, sem aninhamento) ───────────────────
function parseFrontMatter(lines) {
  const meta = {};
  let end = 0;
  if (lines[0] !== '---') return { meta, body: lines };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i + 1; break; }
    const m = lines[i].match(/^(\w+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body: lines.slice(end) };
}

// ── Compilador de blocos ─────────────────────────────────────────────────────
function compile(body) {
  const out = [];
  let i = 0;
  const flushPara = (buf) => { if (buf.length) out.push(paragrafo(buf.join(' '))); };

  let buf = [];
  while (i < body.length) {
    const line = body[i];
    const trimmed = line.trim();

    if (trimmed === '') { flushPara(buf); buf = []; i++; continue; }

    // Diretivas ::
    if (trimmed.startsWith('::')) {
      flushPara(buf); buf = [];
      const [, cmd, resto = ''] = trimmed.match(/^::(\S+)\s*(.*)$/) || [];
      if (cmd === 'br') { out.push(quebra(resto ? Number(resto) : undefined)); i++; continue; }
      if (cmd === 'pagebreak') { out.push(pageBreak()); i++; continue; }
      if (cmd === 'center') { out.push(pCentered(resto.replace(/\*\*/g, ''))); i++; continue; }
      if (cmd === 'left' || cmd === 'right') {
        const align = cmd === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT;
        out.push(paragrafo(resto, { alignment: align })); i++; continue;
      }
      if (cmd === 'endereco') {
        const linhas = [];
        i++;
        while (i < body.length && body[i].trim() !== '::') { if (body[i].trim()) linhas.push(body[i].trim()); i++; }
        i++; // consome o "::" de fechamento
        out.push(...endereco(linhas)); continue;
      }
      if (cmd === 'assinatura') {
        const adv = []; let localData;
        i++;
        while (i < body.length && body[i].trim() !== '::') {
          const l = body[i].trim(); i++;
          if (!l) continue;
          const loc = l.match(/^local\s*:\s*(.*)$/i);
          if (loc) { localData = loc[1]; continue; }
          const [nome, oab] = l.split('|').map((s) => s.trim());
          adv.push({ nome, oab: oab || '' });
        }
        i++; // consome o "::" de fechamento
        out.push(...assinatura(adv, localData ? { localData } : {})); continue;
      }
      throw new Error(`md2docx: diretiva desconhecida "::${cmd}" (linha ${i + 1})`);
    }

    // Títulos
    const h2 = trimmed.match(/^##\s+(\S+)\s+(.*)$/);
    const h1 = !h2 && trimmed.match(/^#\s+(\S+)\s+(.*)$/);
    if (h2) { flushPara(buf); buf = []; out.push(subtitulo(h2[1], h2[2])); i++; continue; }
    if (h1) { flushPara(buf); buf = []; out.push(titulo(h1[1], h1[2])); i++; continue; }

    // Citação em bloco
    if (trimmed.startsWith('>')) {
      flushPara(buf); buf = [];
      const qParas = []; let qBuf = [];
      while (i < body.length && body[i].trim().startsWith('>')) {
        const q = body[i].trim().replace(/^>\s?/, '');
        if (q === '') { if (qBuf.length) { qParas.push(qBuf.join(' ')); qBuf = []; } }
        else qBuf.push(q);
        i++;
      }
      if (qBuf.length) qParas.push(qBuf.join(' '));
      qParas.forEach((q) => out.push(pQuote(q.replace(/\*\*/g, ''))));
      continue;
    }

    buf.push(trimmed);
    i++;
  }
  flushPara(buf);
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mdPath = args.find((a) => !a.startsWith('--'));
  if (!mdPath) { console.error('Uso: node md2docx.js <peca.md> [--out saida.docx]'); process.exit(2); }

  if (!args.includes('--skip-lint')) rodarLints(mdPath);
  else console.warn('md2docx: AVISO — lints pulados por --skip-lint.');

  const outFlag = args.indexOf('--out');
  const src = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontMatter(src.split('\n'));

  const outPath = outFlag >= 0
    ? args[outFlag + 1]
    : path.resolve(path.dirname(mdPath), meta.out || path.basename(mdPath).replace(/\.md$/i, '.docx'));

  const conteudo = compile(body);
  const saved = await buildDoc({
    titulo: meta.titulo || path.basename(mdPath, '.md'),
    processo: meta.processo || '',
    conteudo,
    outPath,
  });
  console.log(`md2docx: ${conteudo.length} parágrafos → ${saved}`);

  // Validação do ARTEFATO (PRD/lint-docx): confere fonte, margem, entrelinha,
  // cabeçalho, rodapé e banner no .docx pronto, contra perfil/marca.json.
  // Não substitui os lints de entrada — cobre o que eles não veem, que é o que
  // efetivamente sai para o juízo.
  const lintDocx = path.join(__dirname, '..', '..', '..', 'scripts', 'lint-docx.js');
  if (fs.existsSync(lintDocx)) {
    const r = spawnSync(process.execPath, [lintDocx, saved], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error('\nmd2docx: o .docx GERADO está fora do padrão visual PMA:\n');
      console.error(r.stdout || r.stderr || '');
      process.exitCode = 1;
    } else if ((r.stdout || '').includes('AVISO')) {
      console.warn((r.stdout || '').split('\n').filter((l) => /AVISO|^\s{8}/.test(l)).join('\n'));
    }
  }

  const v = await validarTimbrado(saved);
  if (v.aviso) console.warn(`md2docx: AVISO — ${v.aviso}`);
  else if (!v.ok) {
    console.error('md2docx: TIMBRADO INVÁLIDO no .docx gerado:');
    for (const prob of v.problemas) console.error(`  ✘ ${prob}`);
    process.exit(1);
  } else console.log('md2docx: timbrado validado (cabeçalho, rodapé, distâncias).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });

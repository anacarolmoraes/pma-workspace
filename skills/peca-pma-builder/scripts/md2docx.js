#!/usr/bin/env node
// md2docx: compila uma peça escrita em Markdown (dialeto PMA) para .docx
// usando os helpers do peca-pma-builder. A peça em .md é a fonte da verdade:
// mais barata de escrever/editar/reler por agente do que chamadas p()/pMixed()
// em gerar_*.js, e legível diretamente por humanos e pelos lints.
//
// Uso: node scripts/md2docx.js caminho/da/peca.md [--out caminho/saida.docx] [--skip-lint]
//
// Portões automáticos: antes de compilar, exige o rastro do pipeline
// (2026-09-04 — `pipeline:`, `bundle:` e <PECA>.validacao.md com veredito mais
// novo que a peça; 2026-09-08 — <PECA>.estrutura.md com `aprovada: sim`, salvo
// `estrutura: template`; e
// novo que a peça) e roda lint-remissoes.js, o lint-ia.js do humanizer-forense,
// lint-placeholder.js (peça com [[slot]] ou [VERIFICAR] não compila),
// lint-inicial.js (checklist mecânico do 319 quando `tipo: inicial`) e
// lint-citacoes.js — se algum falhar, NÃO gera o .docx (--skip-lint pula,
// só para emergências). Depois de compilar, valida o timbrado do arquivo
// gerado (validarTimbrado do index.js).
//
// ── Dialeto (ver SKILL.md, seção "Autoria em Markdown") ──────────────────────
// ---                       front-matter YAML-lite: titulo, processo, out,
//                           timbre (`timbre: nao` → peça sem timbrado; lint-docx
//                           e validação de timbrado dispensados, decisão registrada)
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
// ::tabela [legenda] ... ::  → tabela GFM (| a | b |, linha |---|) em Table do docx:
//                             cabeçalho em negrito com fundo cinza, Montserrat 10 pt,
//                             largura útil da página, colunas proporcionais ao conteúdo,
//                             alinhamento por :--- / :--: / ---: ou automático
//                             (coluna só de valores → direita). Sessão de manutenção 2026-09-16.
// ::quadro ... ::            → caixa de destaque (visual law): parágrafos justificados
//                             em fundo cinza-claro com filete laranja à esquerda.
// ::cronologia [legenda] ... :: → linha do tempo (visual law): linhas "hora | ator | evento [| valor]";
//                             faixa colorida por ator (paleta fixa, na ordem de aparição),
//                             hora em negrito, "!" no início da linha destaca o evento;
//                             legenda de cores ao final. Sessão de manutenção 2026-09-16.
// ::barras [legenda] ... ::  → gráfico de barras horizontais (visual law): linhas "rótulo | valor";
//                             barra proporcional ao maior valor, "!" no início pinta de laranja.
//                             É tabela, não imagem. Sessão de manutenção 2026-09-18.
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
  endereco, quebra, pageBreak, assinatura, buildDoc, validarTimbrado, validarConteudo, docx,
  FONT, SIZE_BODY, LINE, MARGIN_3CM,
} = PMA;
const {
  AlignmentType, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, VerticalAlign, TableLayoutType,
} = docx;

// ── Rastro do pipeline (2026-09-04): a peça só compila com o ciclo gravado ──
//
// O `pipeline:` era aviso; virou portão. E o veredito do legal-consistency-
// validator, que ficava só na conversa, agora precisa existir em disco:
// <PECA>.validacao.md ao lado da peça, com `veredito:` no frontmatter, mais
// novo que o .md (peça editada depois do veredito = veredito velho) e diferente
// de REPROVADO. `bundle:` declara o acervo que sustenta a peça (ou `nenhum`).
// --skip-lint pula tudo isto (é da titular, não do agente — hook bloqueia).
function exigirRastro(mdPath, meta) {
  const problemas = [];
  const mtime = (p) => {
    try {
      return fs.statSync(p).mtimeMs;
    } catch {
      return null;
    }
  };
  const frontmatter = (texto) => {
    const m = {};
    const ls = String(texto || '').split(/\r?\n/);
    if ((ls[0] || '').trim() !== '---') return m;
    for (let i = 1; i < ls.length; i++) {
      if (ls[i].trim() === '---') break;
      const k = ls[i].match(/^(\w+)\s*:\s*(.*)$/);
      if (k) m[k[1]] = k[2].trim();
    }
    return m;
  };

  if (!meta.pipeline) {
    problemas.push(
      'frontmatter sem `pipeline:` — declare `pipeline: legal-orchestrator` depois de cumprir o ciclo ' +
        '(legal-writer → tipografia-pma → legal-consistency-validator → humanizer-forense).',
    );
  }
  if (!meta.bundle) {
    problemas.push('frontmatter sem `bundle:` — `bundle: direito/<tema>` do acervo, ou `bundle: nenhum`.');
  }

  const val = mdPath.replace(/\.md$/i, '.validacao.md');
  const nomeVal = path.basename(val);
  const tVal = mtime(val);
  if (tVal === null) {
    problemas.push(`sem ${nomeVal} — rode o legal-consistency-validator sobre a peça; ele grava o veredito ao lado dela.`);
  } else {
    const tMd = mtime(mdPath);
    if (tMd !== null && tVal < tMd - 1000) {
      problemas.push(`${nomeVal} é anterior à última edição da peça — a peça mudou depois do veredito; revalide.`);
    }
    let texto = '';
    try {
      texto = fs.readFileSync(val, 'utf8');
    } catch {
      /* tratado abaixo como sem veredito */
    }
    const v = String(frontmatter(texto).veredito || '').trim().toUpperCase();
    if (!v) problemas.push(`${nomeVal} sem \`veredito:\` no frontmatter (APROVADO | APROVADO COM RESSALVAS | REPROVADO).`);
    else if (/REPROVADO/.test(v)) problemas.push(`veredito REPROVADO em ${nomeVal} — corrija as fraquezas CRÍTICO/ALTO e revalide.`);
  }

  // Estrutura aprovada (Estágio 0.5, portão desde 2026-09-08): a arquitetura da peça
  // é decidida e aprovada pela titular ANTES da prosa, em <PECA>.estrutura.md com
  // `aprovada: sim`. Peça gerada de template (inicial-rescisao-lote, golpe) declara
  // `estrutura: template` no frontmatter: o playbook dispensa o portão humano nela.
  if (!/^template$/i.test(String(meta.estrutura || '').trim())) {
    const est = mdPath.replace(/\.md$/i, '.estrutura.md');
    const nomeEst = path.basename(est);
    if (mtime(est) === null) {
      problemas.push(`sem ${nomeEst} — Estágio 0.5: grave a estrutura da peça ao lado dela e obtenha \`aprovada: sim\` da titular antes da prosa (peça de template declara \`estrutura: template\`).`);
    } else {
      let te = '';
      try { te = fs.readFileSync(est, 'utf8'); } catch { /* tratado como não aprovada */ }
      const ap = String(frontmatter(te).aprovada || '').trim();
      if (!/^(sim|s|yes|true)$/i.test(ap)) problemas.push(`${nomeEst} sem \`aprovada: sim\` (está: "${ap || 'ausente'}") — a titular aprova a arquitetura antes da prosa.`);
    }
  }

  if (!problemas.length) {
    console.log('md2docx: rastro OK (pipeline, bundle, estrutura aprovada, veredito do validator)');
    return;
  }
  console.error('\nmd2docx: RASTRO DO PIPELINE INCOMPLETO — .docx não gerado.');
  for (const p of problemas) console.error(`  ✘ ${p}`);
  console.error('\nO ciclo é: legal-orchestrator (Estágio 0 → 0.5 com estrutura aprovada → 1–6) → veredito gravado → pipeline: declarado → md2docx.\n');
  process.exit(1);
}

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
    { nome: 'lint-placeholder', script: path.join(__dirname, 'lint-placeholder.js') },
    { nome: 'lint-injecao', script: path.join(__dirname, 'lint-injecao.js') },
    { nome: 'lint-inicial', script: path.join(__dirname, 'lint-inicial.js') },
    { nome: 'lint-extensao', script: path.join(__dirname, 'lint-extensao.js') },
    { nome: 'lint-citacoes', script: path.join(__dirname, 'lint-citacoes.js') },
  ];
  for (const l of lints) {
    if (!fs.existsSync(l.script)) {
      // Portão ausente não é portão aberto. Até 01/10/2026 isto era aviso e a peça
      // compilava sem o lint — exatamente o fail-open que o rastro proíbe.
      console.error(`\nmd2docx: ${l.nome} não encontrado em ${l.script} — portão AUSENTE, .docx não gerado.`);
      console.error('Instalação incompleta: rodar `node scripts/setup.js` ou restaurar o arquivo pelo git.\n');
      process.exit(1);
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
  console.log('md2docx: lints OK (remissões + anti-IA + placeholder + injeção + inicial + extensão + citações)');
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

// ── ::tabela e ::quadro (visual law dentro do dialeto, 2026-09-16) ───────────
//
// Antes, tabela exigia gerar_*.js próprio, fora dos portões. Agora a peça escreve
// a tabela em GFM dentro de ::tabela ... :: e o quadro de destaque em
// ::quadro ... ::, e o md2docx monta as Table do docx com o mesmo padrão visual
// (Montserrat, largura útil de 8504 twips = A4 menos 3 cm de cada lado). O
// lint-docx continua valendo: as células não declaram entrelinha (para não
// deslocar a moda de 312 DXA do corpo) e nenhum run fica abaixo de 6 pt.
const LARGURA_UTIL = 11906 - 2 * MARGIN_3CM; // twips
const SIZE_TABELA = 20; // 10 pt — tamanho canônico de "rodape_notas" em perfil/marca.json
const COR_BORDA = 'BFBFBF';
const COR_FUNDO_CABECALHO = 'E7E6E6';
const COR_FUNDO_QUADRO = 'F2F2F2';
const COR_FILETE = 'F5A623'; // mesmo laranja do rodapé institucional

function runsInline(text, extra = {}) {
  return parseInline(text).map((r) => new TextRun({
    text: r.text, font: FONT, size: extra.size || SIZE_BODY,
    bold: !!r.bold || !!extra.bold, italics: !!r.italics,
  }));
}

// Lê as linhas de um bloco "::cmd ... ::" a partir de i (linha do ::cmd).
// Devolve { linhas, fim } com fim = índice logo após o "::" de fechamento.
function lerBloco(body, i, cmd) {
  const linhas = [];
  let j = i + 1;
  while (j < body.length && body[j].trim() !== '::') { linhas.push(body[j]); j++; }
  if (j >= body.length) throw new Error(`md2docx: bloco ::${cmd} aberto na linha ${i + 1} sem "::" de fechamento`);
  return { linhas, fim: j + 1 };
}

const borda = (style, size, color) => ({ style, size, color });
const bordasTabela = () => {
  const b = borda(BorderStyle.SINGLE, 4, COR_BORDA);
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
};
const semBorda = () => {
  const b = borda(BorderStyle.NONE, 0, 'auto');
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
};

// Célula "—", "R$ 1.234,56", "−R$ 999,00", "+3,5%", "12" → coluna numérica (alinha à direita).
const VALOR_RE = /^[−–+-]?\s*(R\$\s*)?[\d.]+(,\d+)?\s*%?$|^[—–-]$/;

function parseTabela(linhas, linhaDiretiva) {
  const rows = linhas.map((l) => l.trim()).filter(Boolean);
  const onde = `::tabela (linha ${linhaDiretiva})`;
  const split = (l) => l.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
  const ehSeparador = (l) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l);
  if (rows.length < 3 || !rows[0].startsWith('|') || !ehSeparador(rows[1])) {
    throw new Error(`md2docx: ${onde} precisa de cabeçalho "| a | b |", separador "|---|---|" e ao menos uma linha de dados`);
  }
  const cabecalho = split(rows[0]);
  const n = cabecalho.length;
  const alinhDecl = split(rows[1]).map((s) => {
    if (s.startsWith(':') && s.endsWith(':')) return AlignmentType.CENTER;
    if (s.endsWith(':')) return AlignmentType.RIGHT;
    if (s.startsWith(':')) return AlignmentType.LEFT;
    return null;
  });
  const corpo = rows.slice(2).map((l, k) => {
    const cels = split(l);
    if (cels.length !== n) throw new Error(`md2docx: ${onde} — linha de dados ${k + 1} tem ${cels.length} coluna(s); o cabeçalho tem ${n}`);
    return cels;
  });
  const alinh = cabecalho.map((_, c) => {
    if (alinhDecl[c]) return alinhDecl[c];
    const vals = corpo.map((r) => r[c]).filter(Boolean);
    return vals.length && vals.every((v) => VALOR_RE.test(v)) ? AlignmentType.RIGHT : AlignmentType.LEFT;
  });
  // Largura proporcional ao texto mais longo de cada coluna, entre 6 e 40 caracteres.
  const pesos = cabecalho.map((h, c) => Math.min(40, Math.max(6, h.length, ...corpo.map((r) => r[c].length))));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((w) => Math.round((LARGURA_UTIL * w) / soma));
  larguras[n - 1] += LARGURA_UTIL - larguras.reduce((a, b) => a + b, 0);
  return { cabecalho, corpo, alinh, larguras };
}

function celula(texto, { largura, alinhamento, cabecalho = false }) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    shading: cabecalho ? { fill: COR_FUNDO_CABECALHO, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: cabecalho ? AlignmentType.CENTER : alinhamento,
      spacing: { before: 0, after: 0 },
      children: runsInline(texto, { size: SIZE_TABELA, bold: cabecalho }),
    })],
  });
}

function tabela(linhas, legenda, linhaDiretiva) {
  const { cabecalho, corpo, alinh, larguras } = parseTabela(linhas, linhaDiretiva);
  const out = [];
  if (legenda) out.push(pMixed([{ text: legenda, bold: true }], { alignment: AlignmentType.LEFT, spaceAfter: 120 }));
  const rows = [
    new TableRow({
      tableHeader: true, cantSplit: true,
      children: cabecalho.map((h, c) => celula(h, { largura: larguras[c], cabecalho: true })),
    }),
    ...corpo.map((r) => new TableRow({
      cantSplit: true,
      children: r.map((t, c) => celula(t, { largura: larguras[c], alinhamento: alinh[c] })),
    })),
  ];
  out.push(new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: larguras,
    layout: TableLayoutType.FIXED,
    borders: bordasTabela(),
    rows,
  }));
  out.push(quebra(120));
  return out;
}

function quadro(linhas, linhaDiretiva) {
  const paras = []; let b = [];
  for (const l of linhas) {
    const t = l.trim();
    if (!t) { if (b.length) { paras.push(b.join(' ')); b = []; } } else b.push(t);
  }
  if (b.length) paras.push(b.join(' '));
  if (!paras.length) throw new Error(`md2docx: ::quadro (linha ${linhaDiretiva}) vazio`);
  const children = paras.map((t, k) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE, before: 0, after: k === paras.length - 1 ? 0 : 120 },
    children: runsInline(t),
  }));
  const cell = new TableCell({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    margins: { top: 160, bottom: 160, left: 240, right: 240 },
    shading: { fill: COR_FUNDO_QUADRO, type: ShadingType.CLEAR, color: 'auto' },
    borders: {
      top: borda(BorderStyle.NONE, 0, 'auto'), bottom: borda(BorderStyle.NONE, 0, 'auto'),
      right: borda(BorderStyle.NONE, 0, 'auto'), left: borda(BorderStyle.SINGLE, 24, COR_FILETE),
    },
    children,
  });
  return [
    new Table({
      width: { size: LARGURA_UTIL, type: WidthType.DXA },
      columnWidths: [LARGURA_UTIL],
      layout: TableLayoutType.FIXED,
      borders: semBorda(),
      rows: [new TableRow({ cantSplit: true, children: [cell] })],
    }),
    quebra(120),
  ];
}

// ── ::cronologia: linha do tempo em tabela, uma faixa de cor por ator ────────
const PALETA_ATORES = ['FFE699', 'F4B6B6', 'B4E5A2', 'BDD7EE', 'D9D9D9', 'E2C4F0'];

function cronologia(linhas, legenda, linhaDiretiva) {
  const onde = `::cronologia (linha ${linhaDiretiva})`;
  const eventos = [];
  for (const l of linhas) {
    const t = l.trim();
    if (!t) continue;
    const destaque = t.startsWith('!');
    const cels = t.replace(/^!\s*/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
    if (cels.length < 3) throw new Error(`md2docx: ${onde} — cada linha precisa de "hora | ator | evento [| valor]": "${t.slice(0, 60)}"`);
    eventos.push({ hora: cels[0], ator: cels[1], evento: cels[2], valor: cels[3] || '', destaque });
  }
  if (!eventos.length) throw new Error(`md2docx: ${onde} vazio`);
  const atores = [...new Set(eventos.map((e) => e.ator))];
  const cor = (ator) => PALETA_ATORES[atores.indexOf(ator) % PALETA_ATORES.length];

  const W_HORA = 1000, W_FAIXA = 170, W_ATOR = 1500, W_VALOR = 1500;
  const temValor = eventos.some((e) => e.valor);
  const W_EVENTO = LARGURA_UTIL - W_HORA - W_FAIXA - W_ATOR - (temValor ? W_VALOR : 0);
  const larguras = [W_HORA, W_FAIXA, W_ATOR, W_EVENTO, ...(temValor ? [W_VALOR] : [])];

  const nenhuma = borda(BorderStyle.NONE, 0, 'auto');
  const linhaFina = borda(BorderStyle.SINGLE, 4, COR_BORDA);
  const cel = (children, largura, extra = {}) => new TableCell({
    width: { size: largura, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: nenhuma, left: nenhuma, right: nenhuma, bottom: linhaFina },
    ...extra,
    children,
  });
  const par = (texto, opts = {}) => new Paragraph({
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: runsInline(texto, { size: SIZE_TABELA, bold: opts.bold }),
  });

  const rows = eventos.map((e) => new TableRow({
    cantSplit: true,
    children: [
      cel([par(e.hora, { bold: true, alignment: AlignmentType.RIGHT })], W_HORA),
      cel([new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })], W_FAIXA, {
        shading: { fill: cor(e.ator), type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        borders: { top: nenhuma, left: nenhuma, right: nenhuma, bottom: nenhuma },
      }),
      cel([par(e.ator, { bold: true })], W_ATOR),
      cel([par(e.evento, { bold: e.destaque })], W_EVENTO),
      ...(temValor ? [cel([par(e.valor, { bold: e.destaque, alignment: AlignmentType.RIGHT })], W_VALOR)] : []),
    ],
  }));

  const out = [];
  if (legenda) out.push(pMixed([{ text: legenda, bold: true }], { alignment: AlignmentType.LEFT, spaceAfter: 120 }));
  out.push(new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: larguras,
    layout: TableLayoutType.FIXED,
    borders: semBorda(),
    rows,
  }));
  // Legenda de cores: um quadrado colorido por ator (run colorido, ≥ 6 pt: o lint-docx aceita).
  const runsLegenda = [];
  atores.forEach((a, i) => {
    if (i) runsLegenda.push(new TextRun({ text: '     ', font: FONT, size: SIZE_TABELA }));
    runsLegenda.push(new TextRun({ text: '\u25A0 ', font: FONT, size: SIZE_TABELA, color: cor(a) }));
    runsLegenda.push(new TextRun({ text: a, font: FONT, size: SIZE_TABELA }));
  });
  out.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 80, after: 240 }, children: runsLegenda }));
  return out;
}

// ── ::barras: gráfico de barras horizontais em tabela (sem imagem) ───────────
// Uma tabela de grade fixa: rótulo | N unidades de barra | valor. A barra de cada
// linha é uma célula sombreada que ocupa k das N unidades (columnSpan), com k
// proporcional ao valor; "!" no início da linha pinta a barra de laranja.
const BARRAS_UNIDADES = 40;
const COR_BARRA = 'A6A6A6';

function numeroBR(texto) {
  const m = String(texto).replace(/\s/g, '').match(/-?[\d.]+(,\d+)?/);
  if (!m) return NaN;
  return Number(m[0].replace(/\./g, '').replace(',', '.'));
}

function barras(linhas, legenda, linhaDiretiva) {
  const onde = `::barras (linha ${linhaDiretiva})`;
  const itens = [];
  for (const l of linhas) {
    const t = l.trim();
    if (!t) continue;
    const destaque = t.startsWith('!');
    const cels = t.replace(/^!\s*/, '').replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
    const n = numeroBR(cels[1]);
    if (cels.length < 2 || !(n > 0)) throw new Error(`md2docx: ${onde} — cada linha precisa de "rótulo | valor" com valor positivo: "${t.slice(0, 60)}"`);
    itens.push({ rotulo: cels[0], valor: cels[1], n, destaque });
  }
  if (!itens.length) throw new Error(`md2docx: ${onde} vazio`);
  const max = Math.max(...itens.map((x) => x.n));

  const W_ROTULO = 3000, W_VALOR = 1500;
  const area = LARGURA_UTIL - W_ROTULO - W_VALOR;
  const unidade = Math.floor(area / BARRAS_UNIDADES);
  const unidades = Array(BARRAS_UNIDADES).fill(unidade);
  unidades[BARRAS_UNIDADES - 1] += area - unidade * BARRAS_UNIDADES;
  const larguras = [W_ROTULO, ...unidades, W_VALOR];
  const soma = (a, b) => unidades.slice(a, b).reduce((x, y) => x + y, 0);

  const nenhuma = borda(BorderStyle.NONE, 0, 'auto');
  const cel = (children, largura, extra = {}) => new TableCell({
    width: { size: largura, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: nenhuma, left: nenhuma, right: nenhuma, bottom: nenhuma },
    ...extra,
    children,
  });
  const par = (texto, opts = {}) => new Paragraph({
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    keepNext: !opts.ultima, // legenda e barras ficam na mesma página
    children: texto ? runsInline(texto, { size: SIZE_TABELA, bold: opts.bold }) : [],
  });

  const rows = itens.map((x, idx) => {
    const ultima = idx === itens.length - 1;
    const k = Math.max(1, Math.round((x.n / max) * BARRAS_UNIDADES));
    const children = [
      cel([par(x.rotulo, { bold: x.destaque, ultima })], W_ROTULO),
      cel([par('', { ultima })], soma(0, k), {
        columnSpan: k,
        shading: { fill: x.destaque ? COR_FILETE : COR_BARRA, type: ShadingType.CLEAR, color: 'auto' },
        borders: { top: borda(BorderStyle.SINGLE, 24, 'FFFFFF'), bottom: borda(BorderStyle.SINGLE, 24, 'FFFFFF'), left: nenhuma, right: nenhuma },
      }),
    ];
    if (k < BARRAS_UNIDADES) children.push(cel([par('', { ultima })], soma(k, BARRAS_UNIDADES), { columnSpan: BARRAS_UNIDADES - k }));
    children.push(cel([par(x.valor, { bold: true, alignment: AlignmentType.RIGHT, ultima })], W_VALOR));
    return new TableRow({ cantSplit: true, children });
  });

  const out = [];
  if (legenda) out.push(new Paragraph({ alignment: AlignmentType.LEFT, keepNext: true, spacing: { line: LINE, before: 0, after: 120 }, children: runsInline(legenda, { bold: true }) }));
  out.push(new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: larguras,
    layout: TableLayoutType.FIXED,
    borders: semBorda(),
    rows,
  }));
  out.push(quebra(120));
  return out;
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
      if (cmd === 'tabela') {
        const { linhas, fim } = lerBloco(body, i, cmd);
        out.push(...tabela(linhas, resto.trim(), i + 1)); i = fim; continue;
      }
      if (cmd === 'quadro') {
        const { linhas, fim } = lerBloco(body, i, cmd);
        out.push(...quadro(linhas, i + 1)); i = fim; continue;
      }
      if (cmd === 'cronologia') {
        const { linhas, fim } = lerBloco(body, i, cmd);
        out.push(...cronologia(linhas, resto.trim(), i + 1)); i = fim; continue;
      }
      if (cmd === 'barras') {
        const { linhas, fim } = lerBloco(body, i, cmd);
        out.push(...barras(linhas, resto.trim(), i + 1)); i = fim; continue;
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

  const src = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontMatter(src.split('\n'));

  if (!args.includes('--skip-lint')) {
    exigirRastro(mdPath, meta);
    rodarLints(mdPath);
  } else console.warn('md2docx: AVISO — rastro e lints pulados por --skip-lint.');

  const outFlag = args.indexOf('--out');

  const outPath = outFlag >= 0
    ? args[outFlag + 1]
    : path.resolve(path.dirname(mdPath), meta.out || path.basename(mdPath).replace(/\.md$/i, '.docx'));

  // `timbre: nao` no frontmatter → peça sem cabeçalho/rodapé institucionais
  // (decisão da titular, registrada no documento — mesmo espírito do cita_em_teste).
  const semTimbre = /^(n[aã]o|no|off|sem)$/i.test((meta.timbre || '').trim());

  const conteudo = compile(body);
  const saved = await buildDoc({
    titulo: meta.titulo || path.basename(mdPath, '.md'),
    processo: meta.processo || '',
    conteudo,
    outPath,
    semTimbre,
  });
  console.log(`md2docx: ${conteudo.length} blocos (parágrafos e tabelas) → ${saved}`);
  if (semTimbre) {
    console.log('md2docx: timbre removido por decisão declarada no frontmatter (timbre: nao) — lint-docx e validação de timbrado não se aplicam a esta peça.');
  }

  // Validação do ARTEFATO (PRD/lint-docx): confere fonte, margem, entrelinha,
  // cabeçalho, rodapé e banner no .docx pronto, contra perfil/marca.json.
  // Não substitui os lints de entrada — cobre o que eles não veem, que é o que
  // efetivamente sai para o juízo.
  const lintDocx = path.join(__dirname, '..', '..', '..', 'scripts', 'lint-docx.js');
  if (!semTimbre) {
    if (!fs.existsSync(lintDocx)) {
      // Mesmo princípio dos lints de entrada: portão ausente não compila.
      descartar(saved);
      console.error(`\nmd2docx: scripts/lint-docx.js não encontrado — portão AUSENTE, .docx descartado.\n`);
      process.exit(1);
    }
    const r = spawnSync(process.execPath, [lintDocx, saved], { encoding: 'utf8' });
    if (r.status !== 0) {
      // Reprovado = não existe. Deixar o .docx em disco com exit 1 era convite a
      // protocolar o arquivo errado (achado de 01/10/2026).
      descartar(saved);
      console.error('\nmd2docx: o .docx GERADO está fora do padrão visual PMA e foi DESCARTADO:\n');
      console.error(r.stdout || r.stderr || '');
      process.exit(1);
    } else if ((r.stdout || '').includes('AVISO')) {
      console.warn((r.stdout || '').split('\n').filter((l) => /AVISO|^\s{8}/.test(l)).join('\n'));
    }
  }

  // O texto de entrada chegou ao arquivo gravado? Âncoras = primeiro e último
  // parágrafo do corpo. Pega build truncado e .docx defasado, que o
  // validarTimbrado não vê porque só olha o invólucro.
  const textos = [];
  let emBloco = false;
  for (const l of body) {
    const t = l.trim();
    if (/^::(endereco|assinatura|tabela|quadro|cronologia|barras)\b/.test(t)) { emBloco = true; continue; }
    if (emBloco) { if (t === '::') emBloco = false; continue; }
    if (!t || /^(::|>|#)/.test(t)) continue;
    textos.push(t.replace(/\*\*|\*/g, '').trim());
  }
  const ancoras = [textos[0], textos[textos.length - 1]].filter(Boolean);
  const c = await validarConteudo(saved, ancoras);
  if (c.aviso) console.warn(`md2docx: AVISO — ${c.aviso}`);
  else if (!c.ok) {
    descartar(saved);
    console.error('md2docx: o .docx gravado NÃO contém todo o texto da fonte — arquivo descartado:');
    for (const f of c.faltando) console.error(`  ✘ ausente: "${String(f).slice(0, 80)}…"`);
    console.error('  Regerar; se persistir, conferir se outro processo está com o arquivo aberto.');
    process.exit(1);
  }

  if (!semTimbre) {
    const v = await validarTimbrado(saved);
    if (v.aviso) console.warn(`md2docx: AVISO — ${v.aviso}`);
    else if (!v.ok) {
      descartar(saved);
      console.error('md2docx: TIMBRADO INVÁLIDO no .docx gerado — arquivo descartado:');
      for (const prob of v.problemas) console.error(`  ✘ ${prob}`);
      process.exit(1);
    } else console.log('md2docx: timbrado validado (cabeçalho, rodapé, distâncias).');
  }
}

// Artefato reprovado por um portão de saída não fica em disco: um .docx que existe
// é um .docx que alguém protocola. Falha ao apagar vira aviso explícito.
function descartar(docxPath) {
  try {
    fs.unlinkSync(docxPath);
  } catch (e) {
    console.error(`md2docx: não consegui apagar ${docxPath} (${e.message}) — NÃO protocolar este arquivo.`);
  }
}

// Executa só quando chamado pela linha de comando; como módulo, expõe o compilador
// (compile, parseFrontMatter) para teste sem passar pelos portões.
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { compile, parseFrontMatter };

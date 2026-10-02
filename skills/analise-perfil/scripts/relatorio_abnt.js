#!/usr/bin/env node
// relatorio_abnt.js — compila o relatório técnico (.md, fonte de verdade) em .docx no
// padrão de RELATÓRIO do escritório (.claude/commands/relatorio.md): A4, Times New
// Roman 12 pt, entrelinha 1,5, margens ABNT 3/2/3/2 cm, tabelas com cabeçalho
// #3d4241 em branco e zebra branco/#eb8305, rodapé com número de página, títulos
// numerados por estilo Heading1/2/3, parágrafos justificados com recuo de 1,25 cm.
//
// Relatório NÃO é peça: não passa pelo peca-pma-builder, não leva timbrado e não
// usa Montserrat. É a prova técnica que se junta (Doc. N), não a petição.
//
// Uso: node skills/analise-perfil/scripts/relatorio_abnt.js clientes/<caso>/provas/RELATORIO.md [--out saida.docx]
//
// Dialeto aceito (Markdown comum):
//   --- frontmatter ---  titulo, subtitulo, data, processo, cliente, autor, classificacao → bloco de abertura
//   # Título / ## 1. Seção / ### 1.1 Subseção   (o primeiro # sem número vira título; ## sem número logo
//                                                 abaixo vira subtítulo centralizado)
//   parágrafos, **negrito**, *itálico*, `código`
//   | tabelas | GFM |   (linha |---| obrigatória; :--: e ---: alinham)
//   > citação           - item        1. item        ---  (separador: espaço em branco)
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const docx = require(path.join(RAIZ, 'node_modules', 'docx'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType,
  BorderStyle, ShadingType, TableLayoutType, VerticalAlign, Footer, PageNumber, HeadingLevel,
} = docx;

const FONT = 'Times New Roman';
const SIZE = 24;            // 12 pt
const SIZE_TABELA = 20;     // 10 pt
const SIZE_TITULO = 28;     // 14 pt
const LINE_15 = 360;        // entrelinha 1,5
const RECUO_1CM25 = 709;    // twips
const MARGENS = { top: 1701, bottom: 1134, left: 1701, right: 1134 }; // ABNT 3/2/3/2 cm
const LARGURA_UTIL = 11906 - MARGENS.left - MARGENS.right;            // 9071 twips
const COR_CABECALHO = '3d4241';
const COR_ZEBRA = 'eb8305';
const COR_BORDA = 'CCCCCC';

// ── Inline ─────────────────────────────────────────────────────────────────
function runs(text, extra = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((seg) => {
    const base = { font: FONT, size: extra.size || SIZE, bold: !!extra.bold, italics: !!extra.italics, color: extra.color };
    if (/^\*\*[^*]+\*\*$/.test(seg)) return new TextRun({ ...base, text: seg.slice(2, -2), bold: true });
    if (/^\*[^*]+\*$/.test(seg)) return new TextRun({ ...base, text: seg.slice(1, -1), italics: true });
    if (/^`[^`]+`$/.test(seg)) return new TextRun({ ...base, text: seg.slice(1, -1), font: 'Courier New' });
    return new TextRun({ ...base, text: seg });
  });
}

const paragrafo = (text, o = {}) => new Paragraph({
  alignment: o.alignment || AlignmentType.JUSTIFIED,
  spacing: { line: LINE_15, before: o.before || 0, after: o.after || 0 },
  indent: o.semRecuo ? undefined : { firstLine: RECUO_1CM25, left: o.left || 0 },
  children: runs(text, o),
});

// ── Frontmatter ────────────────────────────────────────────────────────────
function parseFrontMatter(lines) {
  const meta = {};
  if (lines[0] !== '---') return { meta, body: lines };
  let end = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i + 1; break; }
    const m = lines[i].match(/^(\w+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: lines.slice(end) };
}

// ── Tabela GFM ─────────────────────────────────────────────────────────────
const VALOR_RE = /^[−–+-]?\s*(R\$\s*)?[\d.]+(,\d+)?\s*[%×x]?$|^[—–-]$/;
function tabela(rows, linha) {
  const split = (l) => l.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
  if (rows.length < 2 || !/^\|?\s*:?-{2,}/.test(rows[1])) throw new Error(`tabela sem separador |---| (linha ${linha})`);
  const cab = split(rows[0]);
  const n = cab.length;
  const alDecl = split(rows[1]).map((s) => (s.startsWith(':') && s.endsWith(':') ? AlignmentType.CENTER : s.endsWith(':') ? AlignmentType.RIGHT : s.startsWith(':') ? AlignmentType.LEFT : null));
  const corpo = rows.slice(2).map((l, k) => {
    const c = split(l);
    if (c.length !== n) throw new Error(`tabela (linha ${linha}): linha ${k + 1} tem ${c.length} colunas, cabeçalho tem ${n}`);
    return c;
  });
  const alinh = cab.map((_, c) => {
    if (alDecl[c]) return alDecl[c];
    const v = corpo.map((r) => r[c]).filter(Boolean);
    return v.length && v.every((x) => VALOR_RE.test(x)) ? AlignmentType.RIGHT : AlignmentType.LEFT;
  });
  const pesos = cab.map((h, c) => Math.min(45, Math.max(4, h.length, ...corpo.map((r) => r[c].length))));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const larg = pesos.map((w) => Math.round((LARGURA_UTIL * w) / soma));
  larg[n - 1] += LARGURA_UTIL - larg.reduce((a, b) => a + b, 0);

  const b = { style: BorderStyle.SINGLE, size: 4, color: COR_BORDA };
  const bordas = { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
  const cel = (texto, c, opts) => new TableCell({
    width: { size: larg[c], type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.cabecalho ? AlignmentType.CENTER : alinh[c],
      spacing: { before: 0, after: 0 },
      children: runs(texto, { size: SIZE_TABELA, bold: opts.cabecalho, color: opts.cabecalho ? 'FFFFFF' : undefined }),
    })],
  });
  const linhas = [
    new TableRow({ tableHeader: true, cantSplit: true, children: cab.map((h, c) => cel(h, c, { cabecalho: true, fill: COR_CABECALHO })) }),
    ...corpo.map((r, k) => new TableRow({ cantSplit: true, children: r.map((t, c) => cel(t, c, { fill: k % 2 ? COR_ZEBRA : undefined })) })),
  ];
  return [
    new Table({ width: { size: LARGURA_UTIL, type: WidthType.DXA }, columnWidths: larg, layout: TableLayoutType.FIXED, borders: bordas, rows: linhas }),
    new Paragraph({ spacing: { before: 0, after: 200 }, children: [] }),
  ];
}

// ── Compilador ─────────────────────────────────────────────────────────────
function compilar(meta, body) {
  const out = [];
  let vistoNumerado = false;
  let tituloFeito = !!meta.titulo;
  let buf = [];
  const flush = () => { if (buf.length) { out.push(paragrafo(buf.join(' '), { after: 120 })); buf = []; } };

  if (meta.titulo) {
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE_15, after: 120 }, children: [new TextRun({ text: meta.titulo, font: FONT, size: SIZE_TITULO, bold: true })] }));
    if (meta.subtitulo) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE_15, after: 240 }, children: [new TextRun({ text: meta.subtitulo, font: FONT, size: SIZE, bold: true })] }));
    const linhasMeta = [['Processo', meta.processo], ['Cliente', meta.cliente], ['Autor', meta.autor], ['Data', meta.data], ['Classificação', meta.classificacao]].filter(([, v]) => v);
    for (const [k, v] of linhasMeta) {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 276, after: 0 }, children: [new TextRun({ text: `${k}: `, font: FONT, size: 22, bold: true }), new TextRun({ text: v, font: FONT, size: 22 })] }));
    }
    out.push(new Paragraph({ spacing: { before: 120, after: 360 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_BORDA, space: 4 } }, children: [] }));
  }

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const t = line.trim();
    if (t === '' || t === '---') { flush(); continue; }

    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      const nivel = h[1].length;
      const texto = h[2].replace(/\*\*/g, '');
      const numerado = /^\d/.test(texto) || /^\(?[ivx]+\)/i.test(texto);
      if (nivel === 1 && !tituloFeito) {
        tituloFeito = true;
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE_15, after: 120 }, children: [new TextRun({ text: texto, font: FONT, size: SIZE_TITULO, bold: true })] }));
        continue;
      }
      if (nivel === 2 && !numerado && !vistoNumerado) {
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE_15, after: 240 }, children: [new TextRun({ text: texto, font: FONT, size: SIZE, bold: true })] }));
        continue;
      }
      if (numerado) vistoNumerado = true;
      const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.max(0, nivel - (meta.titulo || tituloFeito ? 2 : 1))] || HeadingLevel.HEADING_3;
      out.push(new Paragraph({ heading, alignment: AlignmentType.LEFT, spacing: { line: LINE_15, before: 360, after: 120 }, children: [new TextRun({ text: texto, font: FONT, size: nivel <= 2 ? SIZE : SIZE, bold: true, italics: nivel === 3 })] }));
      continue;
    }

    if (t.startsWith('|')) {
      flush();
      const rows = [];
      const inicio = i + 1;
      while (i < body.length && body[i].trim().startsWith('|')) { rows.push(body[i].trim()); i++; }
      i--;
      out.push(...tabela(rows, inicio));
      continue;
    }

    if (t.startsWith('>')) {
      flush();
      const q = [];
      while (i < body.length && body[i].trim().startsWith('>')) { const s = body[i].trim().replace(/^>\s?/, ''); if (s) q.push(s); i++; }
      i--;
      out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, before: 60, after: 160 }, indent: { left: 1134 }, children: runs(q.join(' '), { size: 22 }) }));
      continue;
    }

    const li = t.match(/^[-*]\s+(.*)$/);
    const ni = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (li || ni) {
      flush();
      out.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE_15, after: 60 },
        numbering: { reference: li ? 'marcadores' : 'numerada', level: 0 },
        children: runs(li ? li[1] : ni[2]),
      }));
      continue;
    }

    buf.push(t);
  }
  flush();
  return out;
}

// ── Validação do artefato: reabre o ZIP e confere tabelas e linhas ──────────
function lerDocumentXml(arquivo) {
  const buf = fs.readFileSync(arquivo);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP inválido');
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < total; n++) {
    const metodo = buf.readUInt16LE(off + 10), tamComp = buf.readUInt32LE(off + 20);
    const nomeLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), comentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const nome = buf.toString('utf8', off + 46, off + 46 + nomeLen);
    if (nome === 'word/document.xml') {
      const nl = buf.readUInt16LE(localOff + 26), el = buf.readUInt16LE(localOff + 28);
      const d = buf.subarray(localOff + 30 + nl + el, localOff + 30 + nl + el + tamComp);
      return metodo === 0 ? d.toString('utf8') : zlib.inflateRawSync(d).toString('utf8');
    }
    off += 46 + nomeLen + extraLen + comentLen;
  }
  throw new Error('word/document.xml ausente');
}

async function main() {
  const args = process.argv.slice(2);
  const mdPath = args.find((a) => !a.startsWith('--'));
  if (!mdPath) { console.error('Uso: node relatorio_abnt.js <relatorio.md> [--out saida.docx]'); process.exit(2); }
  const outFlag = args.indexOf('--out');
  const outPath = outFlag >= 0 ? args[outFlag + 1] : mdPath.replace(/\.md$/i, '.docx');

  const src = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontMatter(src.split('\n'));
  const conteudo = compilar(meta, body);
  const esperadoTabelas = conteudo.filter((c) => c instanceof Table).length;

  const doc = new Document({
    creator: meta.autor || 'PMA Advocacia',
    title: meta.titulo || path.basename(mdPath, '.md'),
    styles: {
      default: { document: { run: { font: FONT, size: SIZE } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SIZE, bold: true }, paragraph: { outlineLevel: 0, spacing: { before: 360, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SIZE, bold: true }, paragraph: { outlineLevel: 1, spacing: { before: 240, after: 120 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SIZE, bold: true, italics: true }, paragraph: { outlineLevel: 2, spacing: { before: 200, after: 100 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'marcadores', levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'numerada', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { ...MARGENS, header: 708, footer: 708 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      children: conteudo,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);

  const xml = lerDocumentXml(outPath);
  const tabelas = (xml.match(/<w:tbl>/g) || []).length;
  const linhas = (xml.match(/<w:tr[ >]/g) || []).length;
  const fontes = [...new Set([...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))];
  const problemas = [];
  if (tabelas !== esperadoTabelas) problemas.push(`tabelas: ${tabelas} no .docx, ${esperadoTabelas} na fonte`);
  const intrusas = fontes.filter((f) => !['Times New Roman', 'Courier New'].includes(f));
  if (intrusas.length) problemas.push(`fontes fora do padrão: ${intrusas.join(', ')}`);
  if (!/w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"/.test(xml)) problemas.push('margens não são ABNT 3/2/3/2');
  console.log(`relatorio_abnt: ${conteudo.length} blocos, ${tabelas} tabela(s), ${linhas} linha(s) → ${outPath}`);
  if (problemas.length) { for (const p of problemas) console.error(`  ✘ ${p}`); process.exit(1); }
  console.log('relatorio_abnt: artefato conferido (Times New Roman, ABNT 3/2/3/2, tabelas = fonte).');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { compilar, parseFrontMatter };

// peca-pma-builder/index.js
// Helpers reutilizáveis para geração de peças jurídicas no padrão PMA.
// Aplica o padrão da tipografia-pma: Montserrat 12pt, margens 3cm, entrelinha 1,3 (312 DXA).
// Timbrado (decisão da usuária, 2026-07-16, fonte: material_padrao_escritorio/
// PETICAO_MODELO_FORMATACAO.docx): cabeçalho = imagem única centralizada
// (assets/timbrado.png); rodapé = filete laranja + linha de contatos + "Fl. X de Y".
//
// Uso típico:
//   const PMA = require('d:/WORK/advocacia/skills/peca-pma-builder');
//   const { p, pMixed, pQuote, titulo, subtitulo, pageBreak, buildDoc } = PMA;
//   const conteudo = [ titulo('I.', 'Síntese'), p('texto...'), ... ];
//   buildDoc({ titulo: '...', processo: '...', conteudo, outPath: 'APELACAO.docx' });

const path = require('path');
const fs = require('fs');

// Carrega docx do diretório global do npm (Windows padrão; ajustar se necessário)
const globalNodeModules = process.env.NPM_GLOBAL_NODE_MODULES
  || 'C:\\Users\\anamo\\AppData\\Roaming\\npm\\node_modules';
const docx = require(path.join(globalNodeModules, 'docx'));
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
  PageNumber, Footer, Header, HeightRule, BorderStyle,
} = docx;

// ─── Constantes do padrão PMA ────────────────────────────────────────────────
const FONT = 'Montserrat';
const FONT_LIGHT = 'Montserrat Light'; // uso exclusivo em citações em bloco (tipografia-pma Módulo 6)
const SIZE_BODY = 24;      // 12pt em half-points
const SIZE_QUOTE = 22;     // 11pt
const SIZE_FOOTER = 20;    // 10pt
const LINE = 312;          // 1,3 entrelinhas em 240ths
const SPACE_AFTER = 240;   // 12pt
const MARGIN_3CM = 1701;   // 3cm em twips
// Distância do header/footer até a borda da página — valores do
// PETICAO_MODELO_FORMATACAO.docx (modelo canônico do timbrado desde 2026-07-16).
const HEADER_DIST = 708;   // 1,25cm — igual ao modelo
const FOOTER_DIST = 708;   // 1,25cm — igual ao modelo

// Imagem do cabeçalho (timbrado.png, extraída do PETICAO_MODELO_FORMATACAO.docx):
// exibida a 3449384 × 907733 EMU → 362 × 95 px @ 96 DPI, centralizada.
const TIMBRADO_PX = { width: 362, height: 95 };

// Rodapé institucional (texto do PETICAO_MODELO_FORMATACAO.docx — não alterar sem
// coordenar com a usuária): linha única centralizada, Montserrat 8pt #666666,
// com filete superior laranja #F5A623.
const FOOTER_COLOR = '666666';
const FOOTER_BORDER_COLOR = 'F5A623';
const FOOTER_SIZE = 16; // 8pt em half-points
const FOOTER_CONTATO =
  'contato@paulomoraesadvocacia.com.br  |  +55 (63) 98489-2582  |  ' +
  'Av. Teotônio Segurado, Ed. Urban Futuro, Sala 2204, Palmas/TO, CEP: 77015200  |  Fl. ';

// Asset default do cabeçalho. (banner.png e logo.png são o timbrado ANTIGO,
// mantidos só para regerar peças históricas via bannerPath/logoPath explícitos.)
const ASSETS_DIR = path.join(__dirname, 'assets');
const DEFAULT_TIMBRADO = path.join(ASSETS_DIR, 'timbrado.png');

// ─── Helpers de parágrafo ────────────────────────────────────────────────────

function p(text, opts = {}) {
  const runOpts = {
    text,
    font: FONT,
    size: opts.size || SIZE_BODY,
    bold: opts.bold || false,
    italics: opts.italics || false,
  };
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { line: LINE, after: opts.spaceAfter !== undefined ? opts.spaceAfter : SPACE_AFTER },
    indent: opts.indent || undefined,
    children: opts.runs || [new TextRun(runOpts)],
  });
}

// Parágrafo com múltiplos runs (suporta bold/italics inline).
// Cada run: string (texto puro) ou { text, bold?, italics?, size? }.
function pMixed(runs, opts = {}) {
  const trs = runs.map(r => {
    if (typeof r === 'string') return new TextRun({ text: r, font: FONT, size: SIZE_BODY });
    return new TextRun({
      text: r.text, font: FONT, size: r.size || SIZE_BODY,
      bold: !!r.bold, italics: !!r.italics,
    });
  });
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { line: LINE, after: opts.spaceAfter !== undefined ? opts.spaceAfter : SPACE_AFTER },
    indent: opts.indent || undefined,
    children: trs,
  });
}

// Citação em bloco (tipografia-pma Módulo 6.1): recuo 3 cm à esquerda,
// Montserrat Light 11 pt, sem aspas e sem itálico — o recuo já sinaliza a citação.
function pQuote(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE, before: 120, after: 240 },
    indent: { left: opts.left || MARGIN_3CM, right: opts.right || 0 },
    children: [new TextRun({ text, font: FONT_LIGHT, size: SIZE_QUOTE, italics: false })],
  });
}

// Título de seção principal (I., II., III.) — MAIÚSCULO + bold + alinhado à esquerda.
function titulo(numeracao, texto) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE, before: 360, after: 240 },
    children: [new TextRun({
      text: `${numeracao} ${texto.toUpperCase()}`,
      font: FONT, size: SIZE_BODY, bold: true,
    })],
  });
}

// Subtítulo (I.1., I.2.) — caixa mista + bold.
function subtitulo(numeracao, texto) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE, before: 240, after: 180 },
    children: [new TextRun({
      text: `${numeracao} ${texto}`,
      font: FONT, size: SIZE_BODY, bold: true,
    })],
  });
}

// Parágrafo centralizado (uso: título "APELAÇÃO CÍVEL", "RAZÕES DE APELAÇÃO").
function pCentered(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE, before: opts.before || 240, after: opts.after || 240 },
    children: [new TextRun({
      text, font: FONT, size: SIZE_BODY,
      bold: opts.bold !== false, italics: !!opts.italics,
    })],
  });
}

// Bloco de endereçamento ao juízo (várias linhas em negrito à esquerda).
function endereco(linhas) {
  return linhas.map(l =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: LINE, after: 0 },
      children: [new TextRun({ text: l, font: FONT, size: SIZE_BODY, bold: true })],
    })
  );
}

// Espaço em branco (parágrafo vazio).
function quebra(spaceAfter = 120) {
  return new Paragraph({
    children: [new TextRun({ text: '', font: FONT, size: SIZE_BODY })],
    spacing: { line: LINE, after: spaceAfter },
  });
}

// Quebra de página explícita.
function pageBreak() {
  return new Paragraph({
    children: [new TextRun({ text: '', font: FONT, size: SIZE_BODY, break: 1 })],
    pageBreakBefore: true,
  });
}

// Bloco de assinatura — várias advogadas em sequência.
// adv = [{ nome, oab }, ...]
function assinatura(adv, opts = {}) {
  const out = [];
  if (opts.localData) {
    out.push(p(opts.localData, { alignment: AlignmentType.RIGHT, spaceAfter: 360 }));
  }
  adv.forEach((a, i) => {
    const lastBlock = i === adv.length - 1;
    out.push(pMixed([{ text: a.nome, bold: true }], { alignment: AlignmentType.CENTER, spaceAfter: 0 }));
    out.push(pMixed([{ text: a.oab }], { alignment: AlignmentType.CENTER, spaceAfter: lastBlock ? 240 : 240 }));
  });
  return out;
}

// ─── Header e Footer institucionais (timbrado PETICAO_MODELO_FORMATACAO) ─────

function buildHeader(timbradoPath = DEFAULT_TIMBRADO) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new ImageRun({
            data: fs.readFileSync(timbradoPath),
            transformation: TIMBRADO_PX,
            type: 'png',
          }),
        ],
      }),
    ],
  });
}

function buildFooter() {
  // Linha única centralizada com filete superior laranja:
  // contato | telefone | endereço | Fl. X de Y
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, space: 4, color: FOOTER_BORDER_COLOR },
        },
        children: [
          new TextRun({ text: FOOTER_CONTATO, font: FONT, size: FOOTER_SIZE, color: FOOTER_COLOR }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FOOTER_SIZE, color: FOOTER_COLOR }),
          new TextRun({ text: ' de ', font: FONT, size: FOOTER_SIZE, color: FOOTER_COLOR }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: FOOTER_SIZE, color: FOOTER_COLOR }),
        ],
      }),
    ],
  });
}

// ─── Builder principal ───────────────────────────────────────────────────────
// opts:
//   titulo: string (metadado do .docx)
//   processo: string (vai em "description")
//   conteudo: Paragraph[] (corpo da peça)
//   outPath: string (caminho do arquivo de saída)
//   creator: string (default: "PMA Advocacia")
//   timbradoPath: imagem do cabeçalho (default: assets/timbrado.png da skill;
//                 bannerPath é aceito como alias legado)
async function buildDoc(opts) {
  const {
    titulo: docTitle, processo, conteudo, outPath,
    creator = 'PMA Advocacia',
    timbradoPath = opts.bannerPath || DEFAULT_TIMBRADO,
  } = opts;

  if (!conteudo || !Array.isArray(conteudo)) {
    throw new Error('buildDoc: opts.conteudo deve ser um array de Paragraph');
  }
  if (!outPath) throw new Error('buildDoc: opts.outPath é obrigatório');

  const doc = new Document({
    creator,
    title: docTitle || '',
    description: processo ? `Processo ${processo}` : '',
    styles: { default: { document: { run: { font: FONT, size: SIZE_BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 em twips
            margin: {
              top: MARGIN_3CM, right: MARGIN_3CM, bottom: MARGIN_3CM, left: MARGIN_3CM,
              header: HEADER_DIST, footer: FOOTER_DIST,
            },
          },
        },
        headers: { default: buildHeader(timbradoPath) },
        footers: { default: buildFooter() },
        children: conteudo,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  try {
    fs.writeFileSync(outPath, buffer);
    return outPath;
  } catch (e) {
    if (e.code !== 'EBUSY') throw e;
    // Arquivo aberto no Word: gravar ao lado como .NOVO.docx em vez de falhar.
    const alt = outPath.replace(/\.docx$/i, '.NOVO.docx');
    fs.writeFileSync(alt, buffer);
    console.warn(
      `AVISO: "${outPath}" está aberto no Word (EBUSY). ` +
      `Versão nova gravada em "${alt}" — feche o Word e renomeie por cima do original.`
    );
    return alt;
  }
}

// ─── Autovalidação do timbrado ───────────────────────────────────────────────
// Inspeciona um .docx gerado e confere que o timbrado não regrediu:
// imagem do cabeçalho com dimensões numéricas, pgMar 708/708 e rodapé
// institucional presente. Retorna { ok, problemas: string[] }.
// Lição de 2026-07-16: um bug de transformation ({w,h} em vez de {width,height})
// gerava extent NaN e o Word silenciosamente não renderizava o cabeçalho.
async function validarTimbrado(docxPath) {
  let JSZip;
  try {
    JSZip = require(path.join(globalNodeModules, 'docx', 'node_modules', 'jszip'));
  } catch (e1) {
    try { JSZip = require(path.join(globalNodeModules, 'jszip')); }
    catch (e2) { return { ok: true, problemas: [], aviso: 'jszip indisponível — validação do timbrado pulada' }; }
  }
  const problemas = [];
  const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  const ler = async (re) => {
    const nome = Object.keys(zip.files).find((f) => re.test(f));
    return nome ? zip.files[nome].async('string') : null;
  };

  const doc = await ler(/^word\/document\.xml$/);
  if (!doc || !/w:header="708"/.test(doc) || !/w:footer="708"/.test(doc)) {
    problemas.push('pgMar sem header/footer 708 (distâncias do PETICAO_MODELO_FORMATACAO.docx)');
  }

  const header = await ler(/^word\/header\d*\.xml$/);
  if (!header) problemas.push('header*.xml ausente');
  else {
    const ext = header.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
    if (!ext) problemas.push('imagem do cabeçalho sem extent numérico (provável NaN — conferir transformation {width,height})');
    else if (Number(ext[1]) < 1000000) problemas.push(`imagem do cabeçalho com largura anômala (cx=${ext[1]})`);
  }

  const footer = await ler(/^word\/footer\d*\.xml$/);
  if (!footer) problemas.push('footer*.xml ausente');
  else {
    if (!footer.includes('paulomoraesadvocacia')) problemas.push('rodapé sem a linha de contatos institucional');
    if (!/F5A623/i.test(footer)) problemas.push('rodapé sem o filete laranja #F5A623');
  }

  return { ok: problemas.length === 0, problemas };
}

// ─── Export ──────────────────────────────────────────────────────────────────
module.exports = {
  // helpers de parágrafo
  p, pMixed, pQuote, pCentered,
  titulo, subtitulo, endereco, quebra, pageBreak, assinatura,
  // builder
  buildDoc, buildHeader, buildFooter, validarTimbrado,
  // constantes (úteis para casos especiais)
  FONT, SIZE_BODY, SIZE_QUOTE, SIZE_FOOTER, LINE, SPACE_AFTER, MARGIN_3CM,
  // re-exports do docx (caso o script precise de algo customizado)
  docx,
};

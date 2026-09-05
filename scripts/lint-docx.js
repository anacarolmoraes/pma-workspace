#!/usr/bin/env node
// lint-docx — valida um .docx contra o padrão visual PMA.
//
// Verifica o ARTEFATO, não o caminho. Os outros lints rodam dentro do md2docx e
// portanto só protegem quem passa por ele: em 27/07/2026 o Codex gerou uma peça
// por render próprio (OnlyOffice) e nenhum portão rodou. Este lint fecha o buraco,
// porque abre o .docx pronto — tenha vindo do md2docx, do Word ou de onde for.
//
// Padrão lido de perfil/marca.json (fonte única). Zero dependência externa:
// leitor de ZIP mínimo sobre zlib.
//
// ESCOPO: valida PEÇA PRONTA, não modelo. Rodar contra
// material_padrao_escritorio/PETICAO_MODELO_FORMATACAO.docx acusa erros de corpo —
// e não são erros: aquele arquivo é o modelo de CABEÇALHO/RODAPÉ, cujo corpo é
// demonstrativo. O builder só colhe header e footer dele.
//
// Uso:
//   node scripts/lint-docx.js caminho/da/peca.docx
//   node scripts/lint-docx.js peca.docx --json
//
// Saída: 0 = conforme · 1 = fora do padrão (erro) · 2 = arquivo ilegível
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { detectar: detectarInjecao } = require(path.join(__dirname, 'lib', 'injecao'));

const RAIZ = path.resolve(__dirname, '..');

// ── Leitor de ZIP mínimo (central directory + inflate) ──────────────────────
function lerZip(arquivo) {
  const buf = fs.readFileSync(arquivo);

  // End of Central Directory: assinatura 0x06054b50, procurada de trás para frente.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('não é um arquivo ZIP/DOCX válido (EOCD não encontrado)');

  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entradas = new Map();

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(off + 10);
    const tamComp = buf.readUInt32LE(off + 20);
    const nomeLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const comentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const nome = buf.toString('utf8', off + 46, off + 46 + nomeLen);
    entradas.set(nome, { metodo, tamComp, localOff });
    off += 46 + nomeLen + extraLen + comentLen;
  }

  const extrair = (nome) => {
    const e = entradas.get(nome);
    if (!e) return null;
    const lo = e.localOff;
    if (buf.readUInt32LE(lo) !== 0x04034b50) return null;
    const nomeLen = buf.readUInt16LE(lo + 26);
    const extraLen = buf.readUInt16LE(lo + 28);
    const inicio = lo + 30 + nomeLen + extraLen;
    const dados = buf.subarray(inicio, inicio + e.tamComp);
    try {
      return e.metodo === 0 ? dados.toString('utf8') : zlib.inflateRawSync(dados).toString('utf8');
    } catch {
      return null;
    }
  };

  return { nomes: [...entradas.keys()], extrair };
}

// ── Padrão ─────────────────────────────────────────────────────────────────
function carregarMarca() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'marca.json'), 'utf8'));
  } catch (e) {
    console.error(`lint-docx: não foi possível ler perfil/marca.json (${e.message}).`);
    console.error('O padrão visual é definido lá — sem ele não há contra o que validar.');
    process.exit(2);
  }
}

// ── Verificação ────────────────────────────────────────────────────────────
const achados = [];
const add = (sev, check, detalhe) => achados.push({ sev, check, detalhe });

function moda(valores) {
  const c = new Map();
  for (const v of valores) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
}

function verificar(arquivo, marca) {
  const zip = lerZip(arquivo);
  const doc = zip.extrair('word/document.xml');
  if (!doc) throw new Error('word/document.xml ausente ou ilegível');

  // 1. Fontes usadas no corpo
  const usadas = [...new Set([...doc.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))];
  const permitidas = new Set(marca.fontes.permitidas);
  const intrusas = usadas.filter((f) => !permitidas.has(f));
  if (intrusas.length) {
    add('error', 'fonte-fora-do-padrao', `Fontes não permitidas no corpo: ${intrusas.join(', ')}. Padrão: ${marca.fontes.permitidas.join(' / ')}.`);
  }
  if (!usadas.length) {
    add('warning', 'sem-fonte-declarada', 'Nenhuma fonte declarada no documento — herda o default do Word, que não é Montserrat.');
  }

  // 2. Margens
  const mg = /w:pgMar\s+w:top="(\d+)"\s+w:right="(\d+)"\s+w:bottom="(\d+)"\s+w:left="(\d+)"(?:\s+w:header="(\d+)")?(?:\s+w:footer="(\d+)")?/.exec(doc);
  if (!mg) {
    add('error', 'sem-margens', 'Documento sem definição de margens (w:pgMar).');
  } else {
    const [, top, right, bottom, left, header, footer] = mg.map((x) => (x === undefined ? undefined : Number(x)));
    const alvo = marca.pagina.margem_twips;
    const fora = { topo: top, direita: right, base: bottom, esquerda: left };
    const erradas = Object.entries(fora).filter(([, v]) => Math.abs(v - alvo) > 20);
    if (erradas.length) {
      add('error', 'margem-fora-do-padrao', `Margens ${erradas.map(([k, v]) => `${k}=${v}`).join(', ')} twips — padrão ${alvo} (${marca.pagina.margem_cm} cm).`);
    }
    if (header !== undefined && Math.abs(header - marca.pagina.header_twips) > 20) {
      add('warning', 'header-offset', `Distância do cabeçalho ${header} twips — padrão ${marca.pagina.header_twips}.`);
    }
    if (footer !== undefined && Math.abs(footer - marca.pagina.footer_twips) > 20) {
      add('warning', 'footer-offset', `Distância do rodapé ${footer} twips — padrão ${marca.pagina.footer_twips}.`);
    }
  }

  // 3. Entrelinha (a moda vale mais que a exceção: citação em bloco pode divergir)
  const linhas = [...doc.matchAll(/w:line="(\d+)"/g)].map((m) => Number(m[1]));
  const [modaLinha, freq] = moda(linhas);
  if (!linhas.length) {
    add('warning', 'sem-entrelinha', 'Nenhuma entrelinha explícita — o documento usa o default do Word.');
  } else if (modaLinha !== marca.paragrafo.entrelinha_dxa) {
    add('error', 'entrelinha-fora-do-padrao', `Entrelinha predominante ${modaLinha} DXA (${freq} parágrafos) — padrão ${marca.paragrafo.entrelinha_dxa} (${marca.paragrafo.entrelinha_equivalente}).`);
  }

  // 4. Cabeçalho e rodapé
  const temHeader = zip.nomes.some((n) => /^word\/header\d*\.xml$/.test(n));
  const temFooter = zip.nomes.some((n) => /^word\/footer\d*\.xml$/.test(n));
  const refs = (doc.match(/headerReference|footerReference/g) || []).length;
  if (!temHeader) add('error', 'sem-cabecalho', 'Sem word/header*.xml — a peça sai sem o timbrado institucional.');
  if (!temFooter) add('error', 'sem-rodape', 'Sem word/footer*.xml — a peça sai sem rodapé.');
  if ((temHeader || temFooter) && refs === 0) {
    add('error', 'header-nao-referenciado', 'Cabeçalho/rodapé existem no pacote mas não são referenciados pelo corpo — não aparecem na peça.');
  }

  // 5. Banner no cabeçalho
  if (marca.assets.header_exige_imagem) {
    const temImagem = zip.nomes.some((n) => /^word\/media\//.test(n));
    if (!temImagem) add('error', 'sem-banner', 'Nenhuma imagem em word/media/ — o banner do cabeçalho não está no arquivo.');
  }

  // 6. Fontes embutidas
  const embutidas = zip.nomes.filter((n) => /^word\/fonts\//.test(n)).length;
  if (marca.fontes.embutir_no_docx && embutidas === 0) {
    add('warning', 'sem-fontes-embutidas',
      'Nenhuma fonte embutida (word/fonts/). Em máquina sem Montserrat instalada — a do juízo, a do cartório — ' +
      'o .docx renderiza em fonte substituta. Irrelevante se o protocolo for em PDF; relevante se o .docx for o entregável.');
  }

  // 7. Justificação
  const just = (doc.match(/w:jc w:val="both"/g) || []).length;
  const paras = (doc.match(/<w:p[ >]/g) || []).length;
  if (paras > 5 && just / paras < 0.3) {
    add('warning', 'pouca-justificacao', `Só ${just} de ~${paras} parágrafos justificados — padrão é justificado com hifenização.`);
  }

  // 8. Texto oculto e instrução escondida (regra dura 7 do AGENTS.md, 05/09/2026).
  // Run oculto, cor branca ou corpo < 6 pt com texto dentro = invisível ao leitor.
  // Instrução dirigida a IA vale em corpo, comentário, nota, cabeçalho, rodapé e
  // propriedades do arquivo — qualquer parte que uma triagem automática leia.
  const runs = doc.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || [];
  const textoRun = (r) => (r.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join('');
  const ocultos = [];
  for (const r of runs) {
    const txt = textoRun(r).trim();
    if (!txt) continue;
    const pr = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
    const motivos = [];
    if (/<w:(vanish|webHidden)\b/.test(pr)) motivos.push('run oculto');
    const cor = /<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/.exec(pr);
    if (cor && /^F[EF]F[EF]F[EF]$/i.test(cor[1])) motivos.push(`cor ${cor[1]}`);
    if (/<w:color\b[^>]*w:themeColor="background1"/.test(pr)) motivos.push('cor de fundo');
    const sz = /<w:sz\b[^>]*w:val="(\d+)"/.exec(pr);
    if (sz && Number(sz[1]) < 12) motivos.push(`${Number(sz[1]) / 2} pt`);
    if (motivos.length) ocultos.push(`"${txt.slice(0, 60)}" (${motivos.join(', ')})`);
  }
  if (ocultos.length) {
    add('error', 'texto-oculto',
      `${ocultos.length} trecho(s) invisível(is) ao leitor: ${ocultos.slice(0, 4).join(' · ')}. ` +
        'Regra dura 7 do AGENTS.md: nenhuma técnica antiética em documento nenhum.');
  }
  const partesTexto = [
    'word/document.xml', 'word/comments.xml', 'word/footnotes.xml', 'word/endnotes.xml',
    'docProps/core.xml', 'docProps/custom.xml',
    ...zip.nomes.filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)),
  ];
  for (const nome of partesTexto) {
    const xml = zip.extrair(nome);
    if (!xml) continue;
    const plano = xml.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const inj = detectarInjecao(plano).filter((a) => a.tipo !== 'oculto_html');
    if (inj.length) {
      add('error', 'injecao',
        `${nome}: ${inj.slice(0, 3).map((a) => `${a.tipo} — "${a.trecho}"`).join(' · ')}. Regra dura 7 do AGENTS.md.`);
    }
  }

  return { fontes: usadas, embutidas, paragrafos: paras };
}

// ── CLI ────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const alvo = args.find((a) => !a.startsWith('--'));
  const jsonOut = args.includes('--json');

  if (!alvo) {
    console.error('Uso: node scripts/lint-docx.js <peca.docx> [--json]');
    process.exit(2);
  }

  const marca = carregarMarca();
  let info;
  try {
    info = verificar(alvo, marca);
  } catch (e) {
    console.error(`lint-docx: ${e.message}`);
    process.exit(2);
  }

  const erros = achados.filter((a) => a.sev === 'error');
  const avisos = achados.filter((a) => a.sev === 'warning');

  if (jsonOut) {
    console.log(JSON.stringify({ arquivo: alvo, info, erros: erros.length, avisos: avisos.length, achados }, null, 2));
  } else {
    console.log(`lint-docx: ${path.basename(alvo)}`);
    console.log(`  fontes: ${info.fontes.join(', ') || '(nenhuma declarada)'} · embutidas: ${info.embutidas} · parágrafos: ${info.paragrafos}\n`);
    for (const sev of ['error', 'warning']) {
      for (const a of achados.filter((x) => x.sev === sev)) {
        console.log(`  ${sev === 'error' ? 'ERRO ' : 'AVISO'} [${a.check}]`);
        console.log(`        ${a.detalhe}`);
      }
    }
    if (!achados.length) console.log('  Conforme ao padrão visual PMA.');
    console.log(`\n${erros.length} erro(s), ${avisos.length} aviso(s).`);
  }

  process.exit(erros.length ? 1 : 0);
}

main();

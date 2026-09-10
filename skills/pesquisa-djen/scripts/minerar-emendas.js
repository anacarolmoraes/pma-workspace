#!/usr/bin/env node
// minerar-emendas — F4.1 do PRD de 04/09/2026: encontra, entre as comunicações do
// DJEN dos processos do escritório, os DESPACHOS DE EMENDA DA INICIAL (CPC 321),
// classifica a causa e devolve a contagem por causa, para o checklist de saída da
// petição inicial deixar de ser opinião.
//
// A fila monitor/PENDENTES.md guarda só o TIPO da comunicação ("Despacho", "Ato
// ordinatório"), não o texto — por isso "emenda" tem zero ocorrências nela. Este
// script pega os processos da fila (ou de clientes/_processos.json, ou de --processo),
// busca o texto de cada comunicação na API pública do DJEN e filtra o que manda
// emendar.
//
// SÓ LEITURA: não toca a fila, o seen.json nem o log do acervo. A saída é um JSON em
// monitor/emendas.json e uma tabela em markdown para a titular colar no log.md do
// bundle direito/pecas/peticao-inicial (a heurística de emenda pede uma linha por
// despacho, com a causa).
//
// Uso:
//   node skills/pesquisa-djen/scripts/minerar-emendas.js                 # processos da fila
//   node skills/pesquisa-djen/scripts/minerar-emendas.js --catalogo      # + clientes/_processos.json
//   node skills/pesquisa-djen/scripts/minerar-emendas.js --processo N    # um processo
//   opções: --inicio AAAA-MM-DD (default 2025-01-01) --max N (processos; default 60)
//           --md saida.md (tabela) --pausa ms (entre requisições; default 1500)
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const MONITOR = path.join(__dirname, '..', 'monitor');
const PENDENTES = path.join(MONITOR, 'PENDENTES.md');
const SAIDA = path.join(MONITOR, 'emendas.json');
const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) a[k.slice(2)] = true;
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

// Entidades HTML que o DJEN devolve no texto (o acento vem como &aacute; etc.).
const ENT = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï', oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ',
  Uacute: 'Ú', Ccedil: 'Ç', Ntilde: 'Ñ',
};
function limparHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (ENT[n] !== undefined ? ENT[n] : m))
    .replace(/\s+/g, ' ')
    .trim();
}

// ── o que é despacho de emenda ─────────────────────────────────────────────
const RX_EMENDA = /\b(emend(e|a|ar|ada)|regulariz(e|ar|ação)|art(igo|\.)?\s*321|intime-se (a|o) (parte )?autora?[^.]{0,80}para[^.]{0,80}(junt|esclare|adequ|corrig|compro|indic)|sob pena de indeferimento|documentos? indispens[áa]ve)/i;
// ── causas (ordem importa: a primeira que casa vence, mas todas as que casam são listadas) ──
const CAUSAS = [
  ['valor da causa', /valor (da|à) causa|art(igo|\.)?\s*292|custas? (iniciais?|complementar)/i],
  ['gratuidade', /gratuidade|hipossufici|justi[çc]a gratuita|art(igo|\.)?\s*9[89]\b|insufici[êe]ncia de recursos/i],
  ['documento faltante', /junt(e|ar)[^.]{0,60}(documento|procura[çc][ãa]o|comprovante|contrato|extrato|identidade)|comprovante de (resid[êe]ncia|endere[çc]o)|procura[çc][ãa]o|documentos? indispens/i],
  ['qualificação', /qualifica[çc][ãa]o|estado civil|profiss[ãa]o|CPF|CNPJ|endere[çc]o eletr[ôo]nico|e-?mail|art(igo|\.)?\s*319,?\s*(inciso\s*)?II\b/i],
  ['pedido indeterminado', /pedido[^.]{0,40}(certo|determinado|gen[ée]rico|especific)|art(igo|\.)?\s*32[24]\b|inépcia|in[ée]pta/i],
  ['tutela sem perigo', /tutela[^.]{0,80}(perigo|urg[êe]ncia|probabilidade|esclare)/i],
  ['competência ou rito', /incompet[êe]ncia|declin(o|a|ar)[^.]{0,30}compet[êe]ncia|redistribui[çc][ãa]o|juizado especial[^.]{0,40}(remet|redistrib|adequ)|adequ[^.]{0,30}rito/i],
  ['autocomposição', /audi[êe]ncia de concilia|art(igo|\.)?\s*334|autocomposi/i],
  ['prevenção ou conexão', /preven[çc][ãa]o|conex[ãa]o|distribui[çc][ãa]o por depend/i],
];
function classificar(texto) {
  const c = CAUSAS.filter(([, rx]) => rx.test(texto)).map(([nome]) => nome);
  return c.length ? c : ['não classificada'];
}
function trecho(texto) {
  const i = texto.search(RX_EMENDA);
  const ini = Math.max(0, i - 120);
  return `${ini ? '…' : ''}${texto.slice(ini, ini + 360)}${texto.length > ini + 360 ? '…' : ''}`;
}

// ── processos de entrada ───────────────────────────────────────────────────
function processosDaFila() {
  if (!fs.existsSync(PENDENTES)) return [];
  const out = new Map(); // digitos → {processo, caso, tribunal}
  for (const l of fs.readFileSync(PENDENTES, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\|\s*(ABERTA|TRATADA)\s*\|\s*([\d.-]+)\s*\|\s*([^|]+)\|[^|]*\|\s*([^|]*)\|[^|]*\|[^|]*\|[^|]*\|\s*([^|]*)\|/);
    if (!m) continue;
    const processo = m[2].trim();
    const doc = m[4].trim();
    // sentença e acórdão nunca são emenda; o resto (despacho, decisão, ato ordinatório, outros, intimação) pode ser
    if (/senten[çc]a|ac[óo]rd[ãa]o/i.test(doc)) continue;
    const k = soDigitos(processo);
    if (!out.has(k)) out.set(k, { processo, caso: m[5].trim(), tribunal: m[3].split('/')[0].trim() });
  }
  return [...out.values()];
}
function processosDoCatalogo() {
  const p = path.join(RAIZ, 'clientes', '_processos.json');
  if (!fs.existsSync(p)) return [];
  const bruto = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = [];
  for (const [caso, procs] of Object.entries(bruto)) {
    if (caso.startsWith('_')) continue;
    for (const pr of [].concat(procs)) out.push({ processo: String(pr), caso, tribunal: '' });
  }
  return out;
}

async function consultar(params, tentativa = 1) {
  const q = new URLSearchParams(params);
  try {
    const res = await fetch(`${BASE}?${q}`, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (data.status === 'success' || Array.isArray(data.items)) return data;
    throw new Error(data.message || `HTTP ${res.status}`);
  } catch (e) {
    if (tentativa >= 4) throw new Error(`DJEN falhou após ${tentativa} tentativas: ${e.message}`);
    await dormir(tentativa * 2500);
    return consultar(params, tentativa + 1);
  }
}

(async () => {
  const a = args(process.argv);
  const inicio = a.inicio || '2025-01-01';
  const pausa = Number(a.pausa || 1500);
  const max = Number(a.max || 60);

  let entrada = [];
  if (a.processo) entrada = [{ processo: String(a.processo), caso: '?', tribunal: '' }];
  else {
    entrada = processosDaFila();
    if (a.catalogo) {
      const vistos = new Set(entrada.map((e) => soDigitos(e.processo)));
      for (const e of processosDoCatalogo()) if (!vistos.has(soDigitos(e.processo))) entrada.push(e);
    }
  }
  if (!entrada.length) { console.error('Nenhum processo de entrada (fila vazia? use --processo N ou --catalogo).'); process.exit(2); }
  entrada = entrada.slice(0, max);
  console.log(`minerar-emendas: ${entrada.length} processo(s), comunicações desde ${inicio}.`);

  const achados = [];
  let consultas = 0, comunicacoes = 0;
  for (const e of entrada) {
    let data;
    try {
      data = await consultar({ numeroProcesso: soDigitos(e.processo), dataDisponibilizacaoInicio: inicio, itensPorPagina: '100', pagina: '1' });
    } catch (err) {
      console.error(`  ✘ ${e.processo}: ${err.message}`);
      await dormir(pausa);
      continue;
    }
    consultas++;
    const itens = data.items || [];
    comunicacoes += itens.length;
    for (const it of itens) {
      if (/senten[çc]a|ac[óo]rd[ãa]o|edital/i.test(it.tipoDocumento || '') || /edital/i.test(it.tipoComunicacao || '')) continue;
      const texto = limparHtml(it.texto);
      if (!RX_EMENDA.test(texto)) continue;
      achados.push({
        id: it.id,
        processo: it.numeroprocessocommascara || e.processo,
        caso: e.caso,
        tribunal: it.siglaTribunal || e.tribunal,
        orgao: it.nomeOrgao,
        data: it.data_disponibilizacao,
        tipo: it.tipoDocumento || it.tipoComunicacao,
        causas: classificar(texto),
        trecho: trecho(texto),
      });
    }
    await dormir(pausa);
  }

  achados.sort((x, y) => String(y.data).localeCompare(String(x.data)));
  const contagem = {};
  for (const ac of achados) for (const c of ac.causas) contagem[c] = (contagem[c] || 0) + 1;

  fs.mkdirSync(MONITOR, { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify({ gerado_em: new Date().toISOString(), inicio, processos: entrada.length, consultas, comunicacoes, contagem, achados }, null, 2), 'utf8');

  const md = [];
  md.push(`## Despachos de emenda minerados no DJEN (${new Date().toISOString().slice(0, 10)})`);
  md.push('');
  md.push(`${achados.length} despacho(s) com cara de emenda em ${comunicacoes} comunicação(ões) de ${consultas} processo(s), desde ${inicio}. Classificação por palavra-chave: conferir o texto antes de contar.`);
  md.push('');
  md.push('| Causa | Ocorrências |');
  md.push('|---|---|');
  for (const [c, n] of Object.entries(contagem).sort((x, y) => y[1] - x[1])) md.push(`| ${c} | ${n} |`);
  md.push('');
  md.push('| Data | Tribunal / órgão | Processo | Caso | Causa(s) | Trecho |');
  md.push('|---|---|---|---|---|---|');
  for (const ac of achados) md.push(`| ${ac.data} | ${ac.tribunal} / ${ac.orgao || ''} | ${ac.processo} | ${ac.caso} | ${ac.causas.join(', ')} | ${ac.trecho.replace(/\|/g, '/')} |`);
  const mdTxt = md.join('\n') + '\n';
  if (a.md) fs.writeFileSync(path.resolve(a.md), mdTxt, 'utf8');

  console.log(`\n${achados.length} despacho(s) de emenda em ${comunicacoes} comunicação(ões) (${consultas} consulta(s) OK).`);
  for (const [c, n] of Object.entries(contagem).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(3)}  ${c}`);
  console.log(`\nJSON: ${SAIDA}${a.md ? `\nTabela: ${path.resolve(a.md)}` : '\n(use --md saida.md para a tabela em markdown, a colar no log.md do bundle peticao-inicial)'}`);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

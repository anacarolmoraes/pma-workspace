#!/usr/bin/env node
// cjsg.js — porta de entrada do buscar-jurisprudencia-tjsp.
//
// Uso:
//   node cjsg.js buscar   --consultas consultas.json --saida tmp/radar-tjsp/<caso> [--paginas N] [--retomar]
//   node cjsg.js processo --numero 1064147-38.2025.8.26.0100 [--caso <nome>] [--saida tmp/radar-tjsp/<caso>] [--sem-teor]
//   node cjsg.js ementas  --saida tmp/radar-tjsp/<caso> --cds 20327285,20311111
//   node cjsg.js teor     --saida tmp/radar-tjsp/<caso> --cds 20327285,20311111 [--sem-converter]
//   node cjsg.js reindexar
//
// Biblioteca jurisprudencia-tjsp/ (raiz do workspace, fora do git, compartilhada entre casos):
// uma PASTA por acórdão, <cdAcordao>_<numero CNJ>/, com o PDF, o .md do pdfmd e seus sidecars
// e <base>.cjsg.json (espelho do CJSG + casos que o acharam). INDICE.md e BUSCAS.md na raiz.
//
// `buscar` grava <saida>/resultados.json e <saida>/triagem.md. `processo` é o atalho para
// "traga o acórdão do processo X": busca pelo número de origem, que no TJSP é o mesmo da
// apelação, e baixa o inteiro teor de tudo o que vier. `ementas` imprime a ementa integral e a
// citação oficial só dos cdAcordao pedidos. `teor` baixa o PDF na biblioteca e converte com o
// pdfmd; o que já está na biblioteca não se baixa nem se converte de novo.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const MOTOR = path.join(__dirname, 'cjsg.py');
const PDFMD = path.join(RAIZ, 'skills', 'pdfmd', 'scripts', 'executar-pdfmd.js');
const BIBLIOTECA = path.join(RAIZ, 'jurisprudencia-tjsp');

function sair(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

function python() {
  const amb = path.join(RAIZ, 'perfil', 'ambiente.json');
  if (!fs.existsSync(amb)) sair('perfil/ambiente.json não existe — rode: node scripts/setup.js');
  const py = JSON.parse(fs.readFileSync(amb, 'utf8')).python;
  if (!py || !fs.existsSync(py)) sair('Python do adv_env não encontrado — rode: node scripts/setup.js');
  return py;
}

function opcoes(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

function motor(args) {
  const r = spawnSync(python(), [MOTOR, ...args], {
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    stdio: 'inherit',
  });
  if (r.error) sair(r.error.message, 1);
  return r.status ?? 1;
}

// Número CNJ em qualquer grafia ('10641473820258260100', '1064147-38.2025.8.26.0100') -> canônico.
function normalizarCNJ(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length !== 20) return null;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

// 'Apelação Cível / Prestação de Serviços' + número -> 'Apelação Cível 1064147-38.2025.8.26.0100'
const classeDe = (doc) => (doc.classe_assunto || '').split(' / ')[0].trim();
const citacao = (doc) => `${classeDe(doc)} ${doc.numero}`.trim();
const nomeBase = (doc) => `${doc.cdacordao}_${String(doc.numero || '').replace(/[^\w.-]/g, '_')}${doc.tipo === 'D' ? '_mono' : ''}`;
const pastaDe = (base) => path.join(BIBLIOTECA, base);

// ── Busca ─────────────────────────────────────────────────────────────────
function buscar(o) {
  if (!o.consultas || !o.saida) sair('uso: cjsg.js buscar --consultas <arq.json> --saida <pasta> [--paginas N] [--retomar]');
  const saida = path.resolve(o.saida);
  fs.mkdirSync(saida, { recursive: true });
  let arqConsultas = path.resolve(o.consultas);
  if (o.paginas) {
    const cs = JSON.parse(fs.readFileSync(arqConsultas, 'utf8')).map((c) => ({ paginas: Number(o.paginas), ...c }));
    arqConsultas = path.join(saida, '_consultas-efetivas.json');
    fs.writeFileSync(arqConsultas, JSON.stringify(cs, null, 1));
  }
  const args = ['buscar', arqConsultas, saida];
  if (o.retomar) args.push('retomar');
  const status = motor(args);
  if (status === 0) registrarBusca(saida, o.caso);
  else if (fs.existsSync(path.join(saida, 'resultados.json'))) {
    console.log('Busca interrompida: o que já veio está em resultados.json. Para continuar: mesma linha com --retomar');
  }
  return status;
}

// BUSCAS.md: como cada busca foi feita, para a titular conferir e refazer no navegador.
const FILTROS = { ementa: 'Ementa', processo: 'Nº de origem', registro: 'Nº de registro',
  dtj1: 'Julgamento de', dtj2: 'Julgamento até', dtp1: 'Publicação de', dtp2: 'Publicação até',
  tipo: 'Tipo', origem: 'Origem', sinonimos: 'Sinônimos', paginas: 'Páginas' };

function registrarBusca(saida, caso) {
  const res = JSON.parse(fs.readFileSync(path.join(saida, 'resultados.json'), 'utf8'));
  const arq = path.join(BIBLIOTECA, 'BUSCAS.md');
  fs.mkdirSync(BIBLIOTECA, { recursive: true });
  if (!fs.existsSync(arq)) {
    fs.writeFileSync(arq, '# Buscas no CJSG/TJSP\n\n'
      + 'Registro automático de cada busca da skill buscar-jurisprudencia-tjsp. Para refazer: abrir '
      + 'https://esaj.tjsp.jus.br/cjsg/consultaCompleta.do, colar a consulta em "Pesquisa livre" e '
      + 'aplicar os filtros da linha. O resultado pode crescer com acórdãos registrados depois.\n');
  }
  const cel = (s) => String(s).replace(/\|/g, '\\|');
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' });
  let txt = `\n## ${quando} — caso \`${caso || path.basename(saida)}\`\n\n`
    + '| Frente | Pesquisa livre | Filtros | Documentos | Lidos |\n|---|---|---|---|---|\n';
  for (const q of res) {
    const filtros = Object.entries(FILTROS).filter(([k]) => q[k] !== undefined && q[k] !== '' && !(k === 'paginas' && Number(q[k]) <= 1))
      .map(([k, n]) => `${n}: ${q[k]}`).join('; ');
    txt += `| ${cel(q.id)} | \`${cel(q.livre || '')}\` | ${cel(filtros || '—')} | ${q.total} | ${q.docs.length} |\n`;
  }
  fs.appendFileSync(arq, txt);
}

// ── Leitura do resultado ──────────────────────────────────────────────────
function indice(saida) {
  const arq = path.join(path.resolve(saida), 'resultados.json');
  if (!fs.existsSync(arq)) sair(`não há ${arq} — rode buscar antes`);
  const idx = new Map();
  for (const q of JSON.parse(fs.readFileSync(arq, 'utf8'))) {
    for (const d of q.docs) {
      const e = idx.get(d.cdacordao) || { doc: d, consultas: [] };
      e.consultas.push(q.id);
      idx.set(d.cdacordao, e);
    }
  }
  return idx;
}

const cds = (o) => String(o.cds || '').split(/[,\s]+/).filter(Boolean);

function ementas(o) {
  if (!o.saida || !o.cds) sair('uso: cjsg.js ementas --saida <pasta> --cds <cd1,cd2>');
  const idx = indice(o.saida);
  for (const cd of cds(o)) {
    const e = idx.get(cd);
    if (!e) { console.log(`## ${cd}: não está no resultados.json\n`); continue; }
    console.log(`## ${citacao(e.doc)} — cdAcordao ${cd}\n\n${e.doc.ementa || ''}\n\n(${e.doc.citacao || ''})\n`);
  }
  return 0;
}

// ── Inteiro teor ──────────────────────────────────────────────────────────
function teor(o) {
  if (!o.saida || !o.cds) sair('uso: cjsg.js teor --saida <pasta> --cds <cd1,cd2> [--sem-converter]');
  const idx = indice(o.saida);
  const itens = [];
  for (const cd of cds(o)) {
    const e = idx.get(cd);
    if (!e) { console.log(`${cd}: não está no resultados.json`); continue; }
    const nome = nomeBase(e.doc);
    itens.push({ nome, cdacordao: cd, cdforo: e.doc.cdforo || '0', pasta: pastaDe(nome), doc: e.doc });
  }
  const faltam = itens.filter((it) => !fs.existsSync(path.join(it.pasta, `${it.nome}.pdf`)));
  for (const it of itens.filter((x) => !faltam.includes(x))) console.log(`${it.nome}.pdf  já na biblioteca`);

  let status = 0;
  if (faltam.length) {
    const arqItens = path.join(path.resolve(o.saida), '_itens-teor.json');
    fs.writeFileSync(arqItens, JSON.stringify(faltam.map(({ doc: _d, ...it }) => it), null, 1));
    status = motor(['teor', arqItens]);
    fs.rmSync(arqItens, { force: true });
  }
  for (const it of itens) {
    const pdf = path.join(it.pasta, `${it.nome}.pdf`);
    if (!fs.existsSync(pdf)) continue;
    if (!o['sem-converter'] && !fs.existsSync(pdf.replace(/\.pdf$/, '.md'))) {
      const r = spawnSync(process.execPath,
        [PDFMD, pdf, '--ocr', 'auto', '--lang', 'por', '--page-breaks', '--no-tables'],
        { stdio: ['ignore', 'ignore', 'inherit'] });
      console.log(`${it.nome}.md  ${r.status === 0 ? 'convertido' : 'FALHOU a conversão'}`);
    }
    gravarMeta(it.nome, idx.get(it.cdacordao), o.caso || path.basename(path.resolve(o.saida)));
  }
  reindexar();
  console.log(`\nBiblioteca: ${BIBLIOTECA}`);
  return status;
}

function gravarMeta(base, { doc, consultas }, caso) {
  const arq = path.join(pastaDe(base), `${base}.cjsg.json`);
  const meta = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { doc, achado_em: {} };
  meta.doc = doc;
  meta.achado_em[caso] = [...new Set([...(meta.achado_em[caso] || []), ...consultas])];
  fs.writeFileSync(arq, JSON.stringify(meta, null, 1));
}

function reindexar() {
  if (!fs.existsSync(BIBLIOTECA)) return;
  const linhas = [];
  for (const base of fs.readdirSync(BIBLIOTECA).sort()) {
    const arq = path.join(BIBLIOTECA, base, `${base}.cjsg.json`);
    if (!fs.existsSync(arq)) continue;
    const { doc, achado_em: achado } = JSON.parse(fs.readFileSync(arq, 'utf8'));
    const md = fs.existsSync(path.join(BIBLIOTECA, base, `${base}.md`)) ? `[md](${base}/${base}.md)` : '—';
    linhas.push(`| ${citacao(doc)} | ${doc.orgao || ''} | ${doc.julgamento || ''} | ${doc.relator || ''} | `
      + `[pdf](${base}/${base}.pdf) · ${md} | ${Object.keys(achado || {}).join(', ')} |`);
  }
  fs.writeFileSync(path.join(BIBLIOTECA, 'INDICE.md'), '# Biblioteca de acórdãos do TJSP\n\n'
    + 'Gerado por `cjsg.js` (skill buscar-jurisprudencia-tjsp). Não editar à mão.\n\n'
    + '| Acórdão | Órgão | Julgamento | Relator | Arquivos | Achado em |\n|---|---|---|---|---|---|\n'
    + linhas.join('\n') + '\n');
}

// ── Atalho: acórdão de um processo ────────────────────────────────────────
function processo(o) {
  const numero = normalizarCNJ(o.numero);
  if (!numero) sair('uso: cjsg.js processo --numero <número CNJ com 20 dígitos> [--caso <nome>] [--sem-teor]');
  const caso = o.caso || numero;
  const saida = path.resolve(o.saida || path.join(RAIZ, 'tmp', 'radar-tjsp', caso.replace(/[^\w.-]/g, '_')));
  fs.mkdirSync(saida, { recursive: true });
  const arq = path.join(saida, `_processo-${numero}.json`);
  fs.writeFileSync(arq, JSON.stringify([
    { id: 'acordaos', processo: numero, tipo: 'acordaos', paginas: 3 },
    { id: 'monocraticas', processo: numero, tipo: 'monocraticas' },
  ], null, 1));
  let status = buscar({ consultas: arq, saida, caso });
  if (status !== 0) return status;
  const idx = indice(saida);
  if (!idx.size) {
    console.log(`\nNenhum acórdão nem decisão monocrática com origem ${numero}. Processo sem julgamento `
      + 'no 2º grau, segredo de justiça ou número de outro tribunal.');
    return 0;
  }
  console.log('');
  for (const [cd, { doc }] of idx) {
    console.log(`${citacao(doc)}${doc.tipo === 'D' ? ' (monocrática)' : ''} — ${doc.orgao || ''} — j. ${doc.julgamento || ''} — cdAcordao ${cd}`);
  }
  if (!o['sem-teor']) status = teor({ saida, cds: [...idx.keys()].join(','), caso });
  return status;
}

module.exports = { normalizarCNJ, citacao, nomeBase };

if (require.main === module) {
  const [cmd, ...resto] = process.argv.slice(2);
  const o = opcoes(resto);
  const cmds = { buscar, processo, ementas, teor };
  if (cmd === 'reindexar') { reindexar(); process.exit(0); }
  if (cmds[cmd]) process.exit(cmds[cmd](o));
  sair('uso: cjsg.js buscar|processo|ementas|teor|reindexar ... (ver o cabeçalho deste arquivo)');
}

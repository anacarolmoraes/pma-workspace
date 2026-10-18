#!/usr/bin/env node
// caso — painel do caso, lido da ANALISE.md (o único arquivo de estado de clientes/<caso>/).
//
// A ANALISE.md declara no frontmatter `processos:` e `prazos:` (uma linha por prazo:
// `  - AAAA-MM-DD | ato | observação`). O painel junta isso ao que a pasta mostra sozinha:
// peças (.md com `pipeline:`), se o .docx está compilado e mais novo, e quantos PDFs há.
//
// Uso:
//   node scripts/caso.js                 # todos os casos, ordenados pelo próximo prazo
//   node scripts/caso.js sebastiao       # um caso, com as peças
//   node scripts/caso.js --json          # saída em JSON (para outro script)
'use strict';

const fs = require('fs');
const path = require('path');
const { lerFrontmatter, ehPeca, simNao } = require('../hooks/lib/transcript');

const RAIZ = path.resolve(__dirname, '..');
const CLIENTES = path.join(RAIZ, 'clientes');
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const SLUG = args.find((a) => !a.startsWith('--'));

const HOJE = new Date(); HOJE.setHours(0, 0, 0, 0);
const dias = (iso) => Math.round((new Date(iso + 'T00:00:00') - HOJE) / 864e5);
const br = (iso) => iso.split('-').reverse().join('/');

function listar(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }

// Lista `chave:\n  - item` do frontmatter (o parser compartilhado só lê chave: valor).
function listaFrontmatter(texto, chave) {
  const linhas = String(texto).split('\n');
  if ((linhas[0] || '').trim() !== '---') return [];
  const out = [];
  let dentro = false;
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.trim() === '---') break;
    if (new RegExp(`^${chave}\\s*:`).test(l)) { dentro = true; const resto = l.replace(/^[^:]+:\s*/, '').trim(); if (resto) out.push(resto); continue; }
    if (dentro) {
      const m = l.match(/^\s+-\s+(.*)$/);
      if (m) out.push(m[1].trim()); else if (/^\w/.test(l)) dentro = false;
    }
  }
  return out;
}

function lerPrazos(texto) {
  return listaFrontmatter(texto, 'prazos')
    .map((l) => {
      const [data, ato, ...obs] = l.split('|').map((s) => s.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
      return { data, ato: ato || '?', obs: obs.join(' | '), dias: dias(data) };
    })
    .filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Seção 7 (Documentos) da ANALISE.md: tabela com uma coluna "Estado" (presente / pendente /
// dispensado). Documento pendente bloqueia o protocolo da inicial (retrofit Welson, 15/10/2026:
// o painel não mostrava o Doc. 2 faltando).
function lerDocumentos(texto) {
  const sec = String(texto).split(/\r?\n(?=## )/).find((s) => /^## 7\.?\s/.test(s));
  if (!sec) return null;
  const linhas = sec.split(/\r?\n/).filter((l) => /^\|/.test(l));
  if (linhas.length < 2) return { presentes: 0, pendentes: [], aDecidir: [], dispensados: 0 };
  const cel = (l) => l.replace(/^\||\|\s*$/g, '').split('|').map((s) => s.trim());
  const cab = cel(linhas[0]).map((s) => s.toLowerCase());
  const iEstado = cab.findIndex((s) => s.startsWith('estado'));
  const iDesc = cab.findIndex((s) => s.startsWith('descri'));
  // Pendente COM número de Doc. é citado na peça: bloqueia o protocolo. Sem número é prova que
  // o intake sugeriu (Parte B da matriz): fica "a decidir" — juntar, dispensar ou deixar para depois.
  const out = { presentes: 0, pendentes: [], aDecidir: [], dispensados: 0 };
  if (iEstado < 0) return out;
  for (const l of linhas.slice(1)) {
    if (/^\|[\s:|-]+\|$/.test(l.trim())) continue;
    const c = cel(l);
    const est = (c[iEstado] || '').replace(/\*/g, '').toLowerCase();
    const temNumero = /^\d/.test(c[0] || '');
    const desc = (c[iDesc] || '').replace(/\*/g, '').slice(0, 70);
    if (/^pendente/.test(est)) (temNumero ? out.pendentes : out.aDecidir).push(temNumero ? `Doc. ${c[0]}: ${desc}` : desc);
    else if (/^presente/.test(est)) out.presentes++;
    else if (/^dispensad|^fora/.test(est)) out.dispensados++;
  }
  return out;
}

function pecas(dirCaso) {
  const out = [];
  const varrer = (dir, prof) => {
    for (const e of listar(dir)) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (prof < 1 && !/_assets$|^radar-djen|^versoes$/.test(e.name)) varrer(p, prof + 1); continue; }
      if (!/\.md$/.test(e.name) || /\.(index|estrutura|validacao|antes-humanizer)\.md$/.test(e.name)) continue;
      let texto; try { texto = fs.readFileSync(p, 'utf8').slice(0, 4000); } catch { continue; }
      const meta = lerFrontmatter(texto);
      if (!ehPeca(meta)) continue;
      const stem = p.slice(0, -3);
      const md = fs.statSync(p).mtimeMs;
      // Mesmos candidatos do hook stop-peca-compilada: `out:` do frontmatter, <stem>.docx e .NOVO.docx.
      const candidatos = [];
      if (meta.out) candidatos.push(path.resolve(dir, meta.out));
      candidatos.push(stem + '.docx');
      for (const c of [...candidatos]) candidatos.push(c.replace(/\.docx$/i, '.NOVO.docx'));
      const docx = candidatos.find((c) => fs.existsSync(c));
      let estado = 'sem .docx';
      if (docx) estado = fs.statSync(docx).mtimeMs >= md ? 'compilada' : 'DOCX DESATUALIZADO';
      if (simNao(meta.rascunho)) estado += ' (rascunho)';
      const validada = fs.existsSync(stem + '.validacao.md') && fs.statSync(stem + '.validacao.md').mtimeMs >= md;
      out.push({ arquivo: path.relative(dirCaso, p).replace(/\\/g, '/'), estado, validada, bundle: meta.bundle || '' });
    }
  };
  varrer(dirCaso, 0);
  return out;
}

function lerCaso(slug) {
  const dir = path.join(CLIENTES, slug);
  const analise = path.join(dir, 'ANALISE.md');
  const c = { caso: slug, analise: fs.existsSync(analise), processos: [], prazos: [], pecas: pecas(dir), pdfs: 0, atualizada: '', bundle: '' };
  c.pdfs = listar(dir).filter((e) => e.isFile() && /\.pdf$/i.test(e.name)).length;
  if (c.analise) {
    const texto = fs.readFileSync(analise, 'utf8');
    const meta = lerFrontmatter(texto);
    c.atualizada = meta.atualizada || '';
    c.bundle = meta.bundle || '';
    c.processos = listaFrontmatter(texto, 'processos').flatMap((s) => s.split(',').map((x) => x.trim()).filter(Boolean));
    c.prazos = lerPrazos(texto);
    c.documentos = lerDocumentos(texto);
  }
  c.proximo = c.prazos.find((p) => p.dias >= 0) || null;
  c.vencidos = c.prazos.filter((p) => p.dias < 0).length;
  return c;
}

function etiqueta(p) {
  if (!p) return '—';
  const d = p.dias;
  const urg = d <= 2 ? '⛔' : d <= 5 ? '⚠️ ' : '  ';
  return `${urg}${br(p.data)} (${d} d) ${p.ato}`;
}

function painelResumo(casos) {
  const ord = [...casos].sort((a, b) => {
    const da = a.proximo ? a.proximo.dias : 9e9, db = b.proximo ? b.proximo.dias : 9e9;
    return da - db || a.caso.localeCompare(b.caso);
  });
  const w = Math.max(...ord.map((c) => c.caso.length), 4);
  console.log(`${'caso'.padEnd(w)}  ${'próximo prazo'.padEnd(44)}  peças  estado`);
  for (const c of ord) {
    const pend = c.pecas.filter((p) => !/^compilada/.test(p.estado)).length;
    const docPend = c.documentos ? c.documentos.pendentes.length : 0;
    const est = !c.analise ? 'sem ANALISE.md'
      : [pend ? `${pend} peça(s) sem .docx atual` : '', docPend ? `${docPend} doc(s) citado(s) pendente(s)` : ''].filter(Boolean).join('; ') || 'ok';
    console.log(`${c.caso.padEnd(w)}  ${etiqueta(c.proximo).padEnd(44)}  ${String(c.pecas.length).padStart(5)}  ${est}`);
  }
  const semAnalise = ord.filter((c) => !c.analise).length;
  console.log(`\n${ord.length} caso(s); ${semAnalise} sem ANALISE.md (sem painel de prazos). Modelo: skills/legal-orchestrator/references/ANALISE.template.md`);
}

function painelCaso(c) {
  console.log(`# ${c.caso}`);
  if (!c.analise) { console.log('  sem ANALISE.md — crie a partir de skills/legal-orchestrator/references/ANALISE.template.md'); }
  else {
    console.log(`  ANALISE.md atualizada em ${c.atualizada || '?'}${c.bundle ? ` · bundle ${c.bundle}` : ''}`);
    console.log(`  processos: ${c.processos.length ? c.processos.join(', ') : '(nenhum declarado)'}`);
  }
  console.log(`  PDFs na raiz: ${c.pdfs}`);
  console.log('\n  Prazos:');
  if (!c.prazos.length) console.log('    (nenhum em `prazos:` do frontmatter)');
  for (const p of c.prazos) console.log(`    ${p.dias < 0 ? 'vencido ' : ''}${etiqueta(p)}${p.obs ? ' — ' + p.obs : ''}`);
  console.log('\n  Peças:');
  if (!c.pecas.length) console.log('    (nenhum .md com pipeline:)');
  for (const p of c.pecas) console.log(`    ${p.arquivo}: ${p.estado}${p.validada ? '' : ' · validação ausente ou velha'}`);
  if (c.documentos) {
    const d = c.documentos;
    console.log(`\n  Documentos (seção 7): ${d.presentes} presente(s), ${d.pendentes.length} citado(s) e pendente(s), ${d.aDecidir.length} a decidir, ${d.dispensados} dispensado(s)/fora`);
    for (const p of d.pendentes) console.log(`    ⛔ ${p}`);
    if (d.pendentes.length && !c.processos.length) console.log('    → a peça cita documento que não está na pasta: NÃO protocolar antes de juntá-lo.');
    if (d.aDecidir.length) console.log(`    ? a decidir (prova sugerida pelo intake, sem número de Doc.): ${d.aDecidir.join(' · ')}`);
  }
}

function main() {
  if (!fs.existsSync(CLIENTES)) { console.error('Sem pasta clientes/.'); process.exit(2); }
  if (SLUG) {
    if (!fs.existsSync(path.join(CLIENTES, SLUG))) { console.error(`Caso não existe: clientes/${SLUG}`); process.exit(2); }
    const c = lerCaso(SLUG);
    if (JSON_OUT) console.log(JSON.stringify(c, null, 2)); else painelCaso(c);
    return;
  }
  const casos = listar(CLIENTES).filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_')).map((e) => lerCaso(e.name));
  if (JSON_OUT) console.log(JSON.stringify(casos, null, 2)); else painelResumo(casos);
}

main();

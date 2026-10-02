#!/usr/bin/env node
// limpar-caso — faxina da pasta de caso (clientes/<caso>/).
//
// Regra: o que nenhuma sessão futura relê não persiste na pasta do cliente. A leiga que
// abre a pasta deve enxergar o que chegou do fórum (PDF) e o que vai para o fórum (DOCX),
// mais a ANALISE.md; o resto é rastro de máquina.
//
// A lista do que se apaga é FECHADA (abaixo, em REGRAS). Nada é apagado por heurística.
// O que é apenas suspeito (duplicata, sidecar órfão, análise datada) é RELATADO, não apagado,
// salvo opção explícita.
//
// Uso:
//   node scripts/limpar-caso.js                      # relata o que apagaria, em todos os casos
//   node scripts/limpar-caso.js --caso sebastiao     # só uma pasta
//   node scripts/limpar-caso.js --apagar             # executa
//   node scripts/limpar-caso.js --apagar --agora     # ignora a idade mínima (24 h)
//   node scripts/limpar-caso.js --apagar --duplicatas  # também apaga "nome (1).pdf" idêntico a "nome.pdf"
//   node scripts/limpar-caso.js --hook               # modo Stop hook: apaga só o seguro, 1 linha de saída, exit 0 sempre
//
// Idade mínima: por padrão só se apaga o que tem mais de 24 h. Rastro recém-criado pode
// estar em uso pela própria sessão (lotes do radar, snapshot do humanizer).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');
const CLIENTES = path.join(RAIZ, 'clientes');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const APAGAR = flag('--apagar') || flag('--hook');
const AGORA = flag('--agora');
const DUPLICATAS = flag('--duplicatas');
const HOOK = flag('--hook');
const CASO = valor('--caso');
const IDADE_MIN_H = AGORA ? 0 : 24;

if (process.env.CLAUDE_INVOKED_BY && HOOK) process.exit(0);

// ---------------------------------------------------------------------------
// REGRAS — lista fechada. Cada regra: nome, teste (sobre o nome e o stat), e se
// apaga (true) ou só relata (false).
// ---------------------------------------------------------------------------
const REGRAS_ARQUIVO = [
  { nome: 'trava de editor',        apaga: true,  idadeH: 1,  testa: (n) => /^\.~lock\..*#$/.test(n) || /^~\$/.test(n) },
  { nome: 'arquivo de sistema',     apaga: true,  idadeH: 0,  testa: (n) => /^(Thumbs\.db|desktop\.ini|\.DS_Store)$/i.test(n) },
  { nome: 'snapshot do humanizer',  apaga: true,  idadeH: 24, testa: (n) => /\.antes-humanizer\.md$/.test(n) },
  { nome: 'análise datada (migrar para ANALISE.md)', apaga: false, testa: (n) => /^(ANALISE_[\w-]+|radar-jurisprudencia_[\d-]+|cronologia|grupo-de-casos)\.md$/.test(n) },
];

const REGRAS_PASTA = [
  { nome: 'lotes do radar DJEN (regenerável; hoje nasce em tmp/)', apaga: true, idadeH: 24, testa: (n) => /^radar-djen/.test(n) },
  { nome: 'pasta de estágio do pdfmd abandonada (conversão interrompida)', apaga: true, idadeH: 24, testa: (n) => /^\..*-pdfmd-stage-/.test(n) },
];

// ---------------------------------------------------------------------------

const horas = (st) => (Date.now() - st.mtimeMs) / 36e5;
const rel = (p) => path.relative(RAIZ, p).replace(/\\/g, '/');

const acoes = [];      // { tipo: 'apagar' | 'relatar', regra, caminho, isDir }
const erros = [];

function listar(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

function idadeOk(p, minH) {
  if (AGORA) return true;
  try { return horas(fs.statSync(p)) >= Math.max(minH, 0); } catch { return false; }
}

function sha(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function varrer(dir, raizCaso) {
  for (const e of listar(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const regra = REGRAS_PASTA.find((r) => r.testa(e.name));
      if (regra) {
        if (regra.apaga && idadeOk(p, regra.idadeH)) acoes.push({ tipo: 'apagar', regra: regra.nome, caminho: p, isDir: true });
        else acoes.push({ tipo: 'relatar', regra: regra.nome + (regra.apaga ? ' — recente, fica' : ''), caminho: p, isDir: true });
        continue;
      }
      // _assets sem o .md irmão: o pdfmd regenera a partir do PDF.
      if (/_assets$/.test(e.name)) {
        const base = p.slice(0, -'_assets'.length);
        if (!fs.existsSync(base + '.md')) {
          if (idadeOk(p, 24)) acoes.push({ tipo: 'apagar', regra: 'pasta _assets órfã (sem .md irmão)', caminho: p, isDir: true });
          continue;
        }
        continue; // _assets com .md irmão: fica; é parte da conversão.
      }
      varrer(p, raizCaso);
      continue;
    }
    if (!e.isFile()) continue;

    const regra = REGRAS_ARQUIVO.find((r) => r.testa(e.name));
    if (regra) {
      if (regra.apaga && idadeOk(p, regra.idadeH)) acoes.push({ tipo: 'apagar', regra: regra.nome, caminho: p });
      else acoes.push({ tipo: 'relatar', regra: regra.nome, caminho: p });
      continue;
    }

    // Duplicata do Windows/navegador: "nome (1).ext" com os mesmos bytes de "nome.ext".
    const m = e.name.match(/^(.*) \((\d+)\)(\.[^.]+)$/);
    if (m && !/\.(index\.md|pdfmd\.json)$/.test(e.name)) {
      const original = path.join(dir, m[1] + m[3]);
      if (fs.existsSync(original)) {
        let iguais = false;
        try { iguais = fs.statSync(original).size === fs.statSync(p).size && sha(original) === sha(p); } catch { /* relata */ }
        if (iguais) {
          const tipo = DUPLICATAS ? 'apagar' : 'relatar';
          acoes.push({ tipo, regra: 'duplicata idêntica (bytes iguais ao original)' + (DUPLICATAS ? '' : ' — use --duplicatas'), caminho: p });
          // Sidecars da duplicata (gerados pelo pdfmd a partir dela) vão junto.
          if (DUPLICATAS) {
            const stem = p.slice(0, -m[3].length);
            for (const s of [stem + '.md', stem + '.index.md', stem + '.pdfmd.json']) if (fs.existsSync(s)) acoes.push({ tipo, regra: 'sidecar da duplicata', caminho: s });
            if (fs.existsSync(stem + '_assets')) acoes.push({ tipo, regra: 'sidecar da duplicata', caminho: stem + '_assets', isDir: true });
          }
        }
      }
      continue;
    }

    // .pdfmd.json sem o PDF de origem: conversão de algo que já não está na pasta. Só relata.
    if (/\.pdfmd\.json$/.test(e.name)) {
      const stem = p.slice(0, -'.pdfmd.json'.length);
      if (!fs.existsSync(stem + '.pdf') && !fs.existsSync(stem + '.PDF')) acoes.push({ tipo: 'relatar', regra: 'conversão sem PDF de origem', caminho: p });
    }
  }
}

function executar() {
  let n = 0;
  for (const a of acoes.filter((x) => x.tipo === 'apagar')) {
    try {
      fs.rmSync(a.caminho, { recursive: Boolean(a.isDir), force: true });
      n++;
    } catch (e) { erros.push(`${rel(a.caminho)}: ${e.message}`); }
  }
  return n;
}

function main() {
  if (!fs.existsSync(CLIENTES)) { if (!HOOK) console.error('Sem pasta clientes/.'); process.exit(0); }
  const casos = CASO
    ? [path.join(CLIENTES, CASO)]
    : listar(CLIENTES).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => path.join(CLIENTES, e.name));
  for (const c of casos) {
    if (!fs.existsSync(c)) { console.error(`Pasta não existe: ${rel(c)}`); process.exit(2); }
    varrer(c, c);
  }

  const apagar = acoes.filter((a) => a.tipo === 'apagar');
  const relatar = acoes.filter((a) => a.tipo === 'relatar');

  if (HOOK) {
    const n = executar();
    if (n) console.log(`limpar-caso: ${n} item(ns) de rastro removido(s) de clientes/ (node scripts/limpar-caso.js para ver as regras).`);
    process.exit(0);
  }

  const porRegra = (lista) => {
    const g = new Map();
    for (const a of lista) { if (!g.has(a.regra)) g.set(a.regra, []); g.get(a.regra).push(a); }
    return g;
  };

  console.log(APAGAR ? '== APAGANDO ==' : '== APAGARIA (rode com --apagar para executar) ==');
  if (!apagar.length) console.log('  nada.');
  for (const [regra, itens] of porRegra(apagar)) {
    console.log(`\n  ${regra}: ${itens.length}`);
    for (const a of itens) console.log(`    ${rel(a.caminho)}${a.isDir ? '/' : ''}`);
  }

  if (relatar.length) {
    console.log('\n== SÓ RELATO (decisão da titular) ==');
    for (const [regra, itens] of porRegra(relatar)) {
      console.log(`\n  ${regra}: ${itens.length}`);
      for (const a of itens) console.log(`    ${rel(a.caminho)}${a.isDir ? '/' : ''}`);
    }
  }

  if (APAGAR) {
    const n = executar();
    console.log(`\n${n} item(ns) removido(s).`);
    for (const e of erros) console.error(`  erro: ${e}`);
  }
  if (!AGORA && apagar.length + relatar.length) console.log('\n(itens com menos de 24 h ficam; --agora ignora a idade)');
  process.exit(erros.length ? 1 : 0);
}

main();

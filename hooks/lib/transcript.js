'use strict';
// Utilidades compartilhadas pelos hooks: leitura do stdin, parse do transcript
// JSONL do Claude Code e detecção de "peça" pelo frontmatter.
//
// O transcript é uma linha JSON por evento; os usos de ferramenta ficam em
// message.content[].type === 'tool_use' com { name, input }. É o mesmo parse
// que o pre-compact.js fazia sozinho — extraído para servir também ao Stop e
// ao require-leitura sem três cópias divergentes.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const norm = (p) => String(p || '').replace(/\\/g, '/');

// Lê o stdin inteiro e chama main(texto). Falha de leitura = exit 0 (fail-open).
function lerStdin(main) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => main(buf));
  process.stdin.on('error', () => process.exit(0));
}

function parseEntrada(bruto) {
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

function usosDeFerramenta(transcriptPath) {
  const usos = [];
  let bruto;
  try {
    bruto = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return usos;
  }
  for (const linha of bruto.split('\n')) {
    if (!linha.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(linha);
    } catch {
      continue;
    }
    const blocos = ev?.message?.content;
    if (!Array.isArray(blocos)) continue;
    for (const b of blocos) {
      if (b?.type === 'tool_use') usos.push({ nome: b.name || '', input: b.input || {} });
    }
  }
  return usos;
}

// Arquivos gravados na sessão (Edit/Write/NotebookEdit), sem repetição, na ordem.
function arquivosEscritos(usos) {
  const vistos = new Set();
  const saida = [];
  for (const u of usos) {
    if (!/^(Edit|Write|NotebookEdit)$/.test(u.nome)) continue;
    const p = u.input.file_path || u.input.notebook_path;
    if (!p || vistos.has(p)) continue;
    vistos.add(p);
    saida.push({ ferramenta: u.nome, arquivo: p });
  }
  return saida;
}

const RX_VERBO_LEITURA = /\b(cat|type|get-content|sed|head|tail|less|more|ler-pdfmd)\b/;

// Um arquivo conta como lido se houve Read dele, ou comando de shell que o
// despeja (cat, type, Get-Content, sed -n, head, tail).
function foiLido(usos, sufixo) {
  const alvo = norm(sufixo).toLowerCase();
  for (const u of usos) {
    if (u.nome === 'Read') {
      if (norm(u.input.file_path).toLowerCase().endsWith(alvo)) return true;
      continue;
    }
    if (/^(Bash|PowerShell)$/.test(u.nome)) {
      const cmd = norm(u.input.command).toLowerCase();
      if (cmd.includes(alvo) && RX_VERBO_LEITURA.test(cmd)) return true;
    }
  }
  return false;
}

// Alguma leitura DENTRO de um diretório (Read, despejo por shell, ou o
// ler-pdfmd.js que o block-md-integral impõe para .md longo). Serve ao
// require-leitura para exigir que o bundle declarado na peça foi aberto.
// Aceita o caminho Windows (d:/x) e a forma msys do Git Bash (/d/x).
function foiLidoDentro(usos, dir) {
  const base = norm(dir).toLowerCase().replace(/\/+$/, '') + '/';
  const variantes = [base];
  const m = base.match(/^([a-z]):\/(.*)$/);
  if (m) variantes.push(`/${m[1]}/${m[2]}`);
  const dentro = (p) => {
    const s = norm(p).toLowerCase();
    return variantes.some((v) => s.startsWith(v));
  };
  for (const u of usos) {
    if (u.nome === 'Read' && dentro(u.input.file_path)) return true;
    if (/^(Bash|PowerShell)$/.test(u.nome)) {
      const cmd = norm(u.input.command).toLowerCase();
      if (RX_VERBO_LEITURA.test(cmd) && variantes.some((v) => cmd.includes(v))) return true;
    }
  }
  return false;
}

// Frontmatter YAML-lite (chave: valor), igual ao que o md2docx entende.
function lerFrontmatter(texto) {
  const meta = {};
  const linhas = String(texto || '').split('\n');
  if ((linhas[0] || '').trim() !== '---') return meta;
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i].trim() === '---') break;
    const m = linhas[i].match(/^(\w+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

// Peça = frontmatter com pipeline:, tipo:, ou titulo: + processo:.
function ehPeca(meta) {
  return Boolean(meta.pipeline || meta.tipo || (meta.titulo && meta.processo));
}

const simNao = (v) => /^(sim|s|yes|true|1)$/i.test(String(v || '').trim());

module.exports = {
  RAIZ,
  norm,
  lerStdin,
  parseEntrada,
  usosDeFerramenta,
  arquivosEscritos,
  foiLido,
  foiLidoDentro,
  lerFrontmatter,
  ehPeca,
  simNao,
};

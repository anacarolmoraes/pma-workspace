#!/usr/bin/env node
// lint-skills — verificação determinística da integridade das skills do workspace.
//
// Custo zero, sem LLM, sem rede. Verifica a FERRAMENTA, não o produto: os lints
// existentes (lint-ia, lint-remissoes) checam a peça pronta; este checa se a
// máquina que fabrica a peça está inteira.
//
// Uso:
//   node scripts/lint-skills.js               # relatório completo
//   node scripts/lint-skills.js --quiet       # só erros e avisos
//   node scripts/lint-skills.js --errors-only # ignora warning/suggestion
//
// Saída: 0 = sem erros; 1 = há erro (uso em portão/CI).
//
// Severidade (PRD F2.5): error trava · warning registra · suggestion sugere.
// Linter que grita em tudo é linter desligado — só é `error` o que impede a
// skill de carregar ou de executar.
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SKILLS = path.join(RAIZ, 'skills');

// Diretórios dentro de skills/ que não são skills (assets, zips descompactados).
const IGNORAR = new Set(['node_modules', '__pycache__', '.git']);

const achados = [];
const add = (sev, check, arquivo, detalhe, extra = {}) =>
  achados.push({ sev, check, arquivo, detalhe, ...extra });

// ── Frontmatter ────────────────────────────────────────────────────────────
function frontmatter(texto) {
  if (!texto.startsWith('---')) return null;
  const fim = texto.indexOf('\n---', 3);
  return fim === -1 ? null : texto.slice(3, fim);
}

function campo(fm, chave) {
  const m = new RegExp(`^${chave}:\\s*(.*)$`, 'm').exec(fm);
  if (!m) return null;
  const v = m[1].trim();
  // `description: |` abre bloco literal — o valor está nas linhas seguintes.
  if (v === '|' || v === '>' || v === '|-' || v === '>-') {
    const linhas = fm.split('\n');
    const i = linhas.findIndex((l) => new RegExp(`^${chave}:`).test(l));
    const corpo = [];
    for (let j = i + 1; j < linhas.length; j++) {
      if (/^\S/.test(linhas[j])) break; // saiu do bloco indentado
      corpo.push(linhas[j].trim());
    }
    return corpo.join(' ').trim() || null;
  }
  return v.replace(/^["']|["']$/g, '') || null;
}

// ── Extração de caminhos citados ───────────────────────────────────────────
// Linhas de diagrama de árvore (├── └── │) descrevem estrutura hipotética,
// não referência real: ignoradas para não gerar falso positivo.
const LINHA_DIAGRAMA = /[├└│]|^\s*[-|]{2,}/;

const RX_ABSOLUTO = /\b[A-Za-z]:[\\/][^\s`"'()\[\],;|]+/g;
const RX_RELATIVO = /(?<![\w./\\:-])(?:\.{1,2}\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:js|mjs|py|ps1|json)\b/g;

// Tokens genéricos que representam "coloque aqui o seu caminho", não um arquivo real.
const PLACEHOLDER_SEG = /^(caminho|path|dir|pasta|seu|sua|meu|minha|caso|exemplo|nome)([_-]|$)/i;

function ehPlaceholder(token) {
  if (/[*?{}<>]/.test(token)) return true;            // glob ou {variável}
  const primeiro = token.replace(/^\.{1,2}\//, '').split('/')[0];
  return PLACEHOLDER_SEG.test(primeiro);
}

function caminhosCitados(texto) {
  const abs = new Set();
  const rel = new Set();
  for (const linha of texto.split('\n')) {
    if (LINHA_DIAGRAMA.test(linha)) continue;
    for (const m of linha.match(RX_ABSOLUTO) || []) {
      const t = m.replace(/[.,;:]$/, '');
      if (!ehPlaceholder(t)) abs.add(t);
    }
    for (const m of linha.match(RX_RELATIVO) || []) {
      if (/^https?:/.test(m)) continue;
      const t = m.replace(/[.,;:]$/, '');
      if (!ehPlaceholder(t)) rel.add(t);
    }
  }
  return { abs: [...abs], rel: [...rel] };
}

function existe(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ── Verificações ───────────────────────────────────────────────────────────
function verificarSkill(nome) {
  const dir = path.join(SKILLS, nome);
  const skillMd = path.join(dir, 'SKILL.md');
  const rel = `skills/${nome}`;

  if (!existe(skillMd)) {
    // Um diretório sem SKILL.md nunca é carregado como skill. Se tem README/LICENSE,
    // provavelmente é um repositório clonado por engano dentro de skills/.
    const pistas = ['LICENSE', 'CONTRIBUTING.md', 'package.json', '.git']
      .filter((f) => existe(path.join(dir, f)));
    add(
      'error',
      'sem-skill-md',
      rel,
      pistas.length
        ? `Sem SKILL.md — nunca carrega. Parece repositório de terceiro (${pistas.join(', ')}); mover para fora de skills/.`
        : 'Sem SKILL.md — o diretório nunca é carregado como skill.',
    );
    return;
  }

  const texto = fs.readFileSync(skillMd, 'utf8');
  const fm = frontmatter(texto);

  if (fm === null) {
    add('error', 'sem-frontmatter', `${rel}/SKILL.md`, 'Sem bloco de frontmatter YAML — a skill não é descoberta.');
  } else {
    const nomeFm = campo(fm, 'name');
    const desc = campo(fm, 'description');
    if (!nomeFm) add('error', 'sem-name', `${rel}/SKILL.md`, 'Frontmatter sem `name:` — a skill não é descoberta.');
    if (!desc) add('error', 'sem-description', `${rel}/SKILL.md`, 'Frontmatter sem `description:` — o agente não sabe quando acioná-la.');
    if (nomeFm && nomeFm !== nome) {
      add('warning', 'name-divergente', `${rel}/SKILL.md`, `\`name: ${nomeFm}\` difere do diretório \`${nome}\` — confunde a invocação.`);
    }
    if (desc && desc.length < 30) {
      add('suggestion', 'description-curta', `${rel}/SKILL.md`, `Descrição com ${desc.length} caracteres — provavelmente insuficiente para o agente decidir acioná-la.`);
    }
  }

  // Caminhos citados no corpo da SKILL.md
  const { abs, rel: relativos } = caminhosCitados(texto);

  for (const r of relativos) {
    // Um caminho relativo numa SKILL.md pode estar ancorado na própria skill
    // ou na raiz do workspace — só é problema se não resolver de nenhum dos dois.
    if (existe(path.resolve(dir, r)) || existe(path.resolve(RAIZ, r))) continue;

    // Script inexistente quebra o comando documentado: erro.
    // .json costuma ser configuração que a própria skill cria em tempo de uso: aviso.
    const ehScript = /\.(js|mjs|py|ps1)$/i.test(r);
    add(
      ehScript ? 'error' : 'warning',
      ehScript ? 'script-ausente' : 'config-ausente',
      `${rel}/SKILL.md`,
      ehScript
        ? `Referência a \`${r}\` — script não existe (o comando documentado falha).`
        : `Referência a \`${r}\` — não existe; confirmar se é criado em tempo de uso.`,
    );
  }

  for (const a of abs) {
    const norm = a.replace(/\\/g, '/');
    if (!existe(norm)) {
      add('warning', 'caminho-absoluto-quebrado', `${rel}/SKILL.md`, `Caminho absoluto \`${a}\` não existe nesta máquina.`);
    } else {
      add('suggestion', 'caminho-absoluto', `${rel}/SKILL.md`, `Caminho absoluto \`${a}\` — impede mover/replicar o workspace (PRD F7).`, {
        auto_fixable: false,
      });
    }
  }
}

// ── Execução ───────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const errosSo = args.includes('--errors-only');

  if (!existe(SKILLS)) {
    console.error(`lint-skills: diretório não encontrado: ${SKILLS}`);
    process.exit(2);
  }

  const dirs = fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !IGNORAR.has(d.name) && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

  for (const nome of dirs) verificarSkill(nome);

  const erros = achados.filter((a) => a.sev === 'error');
  const avisos = achados.filter((a) => a.sev === 'warning');
  const sugestoes = achados.filter((a) => a.sev === 'suggestion');

  const mostrar = errosSo ? erros : quiet ? [...erros, ...avisos] : achados;

  if (!quiet) console.log(`lint-skills: ${dirs.length} skills verificadas em skills/\n`);

  const rotulo = { error: 'ERRO  ', warning: 'AVISO ', suggestion: 'SUGER ' };
  for (const sev of ['error', 'warning', 'suggestion']) {
    const grupo = mostrar.filter((a) => a.sev === sev);
    for (const a of grupo) {
      console.log(`  ${rotulo[sev]} [${a.check}] ${a.arquivo}`);
      console.log(`         ${a.detalhe}`);
    }
    if (grupo.length) console.log('');
  }

  console.log(`${erros.length} erro(s), ${avisos.length} aviso(s), ${sugestoes.length} sugestão(ões).`);
  process.exit(erros.length ? 1 : 0);
}

main();

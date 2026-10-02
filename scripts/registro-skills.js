#!/usr/bin/env node
// registro-skills — gera SKILLS.md a partir do frontmatter de cada skills/*/SKILL.md.
//   node scripts/registro-skills.js          grava SKILLS.md
//   node scripts/registro-skills.js --check  exit 1 se SKILLS.md estiver desatualizado
//
// Coluna "Motor": `local` = diretório gitignorado (só nesta máquina, fora do motor
// distribuído); `sim` = versionado. Descrição: primeira frase, no máximo 180 caracteres.
// O parser de frontmatter repete o do lint-skills.js porque aquele é portão e não exporta.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const SKILLS = path.join(RAIZ, 'skills');
const SAIDA = path.join(RAIZ, 'SKILLS.md');
const IGNORAR = new Set(['node_modules', '__pycache__', '.git']);
const MAX_DESC = 180;

function frontmatter(texto) {
  if (!texto.startsWith('---')) return null;
  const fim = texto.indexOf('\n---', 3);
  return fim === -1 ? null : texto.slice(3, fim);
}

function campo(fm, chave) {
  const m = new RegExp(`^${chave}:\\s*(.*)$`, 'm').exec(fm);
  if (!m) return null;
  const v = m[1].trim();
  if (v === '|' || v === '>' || v === '|-' || v === '>-') {
    const linhas = fm.split('\n');
    const i = linhas.findIndex((l) => new RegExp(`^${chave}:`).test(l));
    const corpo = [];
    for (let j = i + 1; j < linhas.length; j++) {
      if (/^\S/.test(linhas[j])) break;
      corpo.push(linhas[j].trim());
    }
    return corpo.join(' ').trim() || null;
  }
  return v.replace(/^["']|["']$/g, '') || null;
}

function primeiraFrase(desc) {
  const s = desc.replace(/\s+/g, ' ').trim();
  const corte = /(?<=[.!?])\s+(?=[A-ZÀ-Ú"`(])/.exec(s);
  const frase = corte ? s.slice(0, corte.index) : s;
  return (frase.length > MAX_DESC ? frase.slice(0, MAX_DESC) : frase).replace(/\|/g, '\\|');
}

function gitIgnorado(rel) {
  const r = spawnSync('git', ['check-ignore', '-q', rel], { cwd: RAIZ, stdio: 'ignore' });
  return r.status === 0;
}

function gerar() {
  const dirs = fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !IGNORAR.has(d.name) && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(SKILLS, n, 'SKILL.md')))
    .sort(); // mesma ordem do lint-skills (byte a byte; maiúscula antes)

  const linhas = dirs.map((nome) => {
    const fm = frontmatter(fs.readFileSync(path.join(SKILLS, nome, 'SKILL.md'), 'utf8')) || '';
    const desc = campo(fm, 'description') || '(sem description)';
    const motor = gitIgnorado(`skills/${nome}`) ? 'local' : 'sim';
    return `| [\`${nome}\`](skills/${nome}/SKILL.md) | ${motor} | ${primeiraFrase(desc)} |`;
  });

  return [
    '# Skills do workspace',
    '',
    '> Gerado por `npm run registro` (`scripts/registro-skills.js`) a partir do frontmatter de cada',
    '> `skills/*/SKILL.md`. Não editar à mão: rode o comando depois de criar, mover ou renomear',
    '> skill. O Claude Code descobre as skills sozinho pela `description`; esta tabela existe',
    '> para humanos e para outros agentes.',
    '',
    '| Skill | Motor | Para quê |',
    '|---|---|---|',
    ...linhas,
    '',
    '`local` = existe só nesta máquina (gitignorada); não faz parte do motor distribuído.',
    '',
    'Comando fora de `skills/`: `/relatorio` (`.claude/commands/relatorio.md`) — relatório jurídico em dois arquivos.',
    '',
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const novo = gerar();
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
  if (check) {
    if (novo === atual) return;
    console.error('registro-skills: SKILLS.md desatualizado — rode `npm run registro`.');
    process.exit(1);
  }
  fs.writeFileSync(SAIDA, novo, 'utf8');
  console.log(`registro-skills: SKILLS.md gravado (${novo.split('\n').filter((l) => l.startsWith('| [')).length} skills).`);
}

main();

#!/usr/bin/env node
// stop-peca-compilada — hook Stop: o agente não encerra com peça editada e não
// compilada.
//
// O legal-orchestrator termina em "pronto para gerar .docx"; sem este hook o
// turno acaba antes de os quatro portões do md2docx rodarem. Aqui, ao encerrar:
//   - toda peça .md em clientes/ gravada nesta sessão precisa de .docx irmão
//     (chave `out:` ou mesmo nome) mais novo que o .md — ou `rascunho: sim`
//     no frontmatter, que registra no documento que a peça está em curso;
//   - se alguma SKILL.md foi tocada, lint-skills --errors-only precisa passar.
//
// Uma iteração forçada por vez: quando stop_hook_active é true (o Claude já
// está continuando por causa deste hook), deixa encerrar — sem laço infinito.
// Protocolo: exit 2 = não encerra (stderr vai ao modelo); parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { RAIZ, norm, lerStdin, parseEntrada, usosDeFerramenta, arquivosEscritos, lerFrontmatter, ehPeca, simNao } =
  require('./lib/transcript');

const mtime = (p) => {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
};

function docxDe(md, meta) {
  const dir = path.dirname(md);
  const candidatos = [];
  if (meta.out) candidatos.push(path.resolve(dir, meta.out));
  const base = md.replace(/\.md$/i, '');
  candidatos.push(`${base}.docx`);
  for (const c of [...candidatos]) candidatos.push(c.replace(/\.docx$/i, '.NOVO.docx'));
  return candidatos;
}

function pecasPendentes(escritos) {
  const pendentes = [];
  for (const { arquivo } of escritos) {
    if (!/\.md$/i.test(arquivo) || !/(^|\/)clientes\//i.test(norm(arquivo))) continue;
    let texto;
    try {
      texto = fs.readFileSync(arquivo, 'utf8');
    } catch {
      continue;
    }
    const meta = lerFrontmatter(texto);
    if (!ehPeca(meta) || simNao(meta.rascunho)) continue;
    const tMd = mtime(arquivo);
    const ok = docxDe(arquivo, meta).some((d) => {
      const t = mtime(d);
      return t !== null && tMd !== null && t >= tMd - 1000;
    });
    if (!ok) pendentes.push(arquivo);
  }
  return pendentes;
}

function skillsQuebradas(escritos) {
  if (!escritos.some((e) => /(^|\/)skills\/[^/]+\/SKILL\.md$/i.test(norm(e.arquivo)))) return null;
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'lint-skills.js'), '--errors-only'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: 'stop-peca-compilada' },
  });
  return r.status === 0 ? null : (r.stdout || '') + (r.stderr || '');
}

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada || entrada.stop_hook_active) process.exit(0);
  const escritos = entrada.transcript_path ? arquivosEscritos(usosDeFerramenta(entrada.transcript_path)) : [];
  if (!escritos.length) process.exit(0);

  const motivos = [];
  const pendentes = pecasPendentes(escritos);
  if (pendentes.length) {
    motivos.push(
      'Peça editada nesta sessão sem .docx compilado depois da última edição:\n' +
        pendentes.map((p) => `  - ${p}`).join('\n') +
        '\nCompile: node skills/peca-pma-builder/scripts/md2docx.js <peca.md> — e corrija o que os ' +
        'lints apontarem. Se a peça ainda está em curso e não deve ser compilada agora, declare ' +
        '`rascunho: sim` no frontmatter (a decisão fica registrada no documento).',
    );
  }
  const lint = skillsQuebradas(escritos);
  if (lint) motivos.push(`SKILL.md alterada e lint-skills reprovou:\n${lint.trim()}`);

  if (!motivos.length) process.exit(0);
  process.stderr.write(`NÃO ENCERRADO por stop-peca-compilada.\n\n${motivos.join('\n\n')}\n`);
  process.exit(2);
}

lerStdin(main);

#!/usr/bin/env node
// Teste do rastro do pipeline (2026-09-04): require-leitura exigindo o bundle
// declarado, e o md2docx exigindo pipeline:, bundle: e o veredito do validator.
//
//   node hooks/_teste-rastro.js
//
// Antes da sessão de manutenção, testa os RASCUNHOS em planos/manutencao-2026-09-04:
//   PMA_HOOKS_DIR=planos/manutencao-2026-09-04/hooks \
//   PMA_MD2DOCX=planos/manutencao-2026-09-04/md2docx.rastro.js node hooks/_teste-rastro.js
// Depois de aplicados, roda sem variáveis (hooks/ e o md2docx reais).
//
// O hook é copiado para um workspace temporário (raiz falsa com perfil/), porque
// ele resolve RAIZ a partir do próprio caminho; assim o mesmo teste serve ao
// rascunho e ao arquivo final.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const HOOKS_SRC = path.resolve(RAIZ, process.env.PMA_HOOKS_DIR || 'hooks');
const MD2DOCX = path.resolve(RAIZ, process.env.PMA_MD2DOCX || 'skills/peca-pma-builder/scripts/md2docx.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-rastro-'));
const B = true;
const P = false;

// ── workspace falso: raiz/hooks/{require-leitura.js, lib/transcript.js} + raiz/perfil ──
const raiz = path.join(tmp, 'raiz');
const hooksDir = path.join(raiz, 'hooks');
fs.mkdirSync(path.join(hooksDir, 'lib'), { recursive: true });
fs.copyFileSync(path.join(HOOKS_SRC, 'require-leitura.js'), path.join(hooksDir, 'require-leitura.js'));
fs.copyFileSync(path.join(HOOKS_SRC, 'lib', 'transcript.js'), path.join(hooksDir, 'lib', 'transcript.js'));
fs.mkdirSync(path.join(raiz, 'perfil'));
fs.writeFileSync(path.join(raiz, 'perfil', 'definicoes.md'), '# defs\n');
fs.writeFileSync(path.join(raiz, 'perfil', 'usuario.md'), '# eu\n');

// ── acervo falso ─────────────────────────────────────────────────────────────
const acervo = path.join(tmp, 'acervo');
const bundle = path.join(acervo, 'direito', 'imobiliario');
fs.mkdirSync(path.join(bundle, 'jurisprudencia'), { recursive: true });
fs.writeFileSync(path.join(acervo, 'index.md'), '# roteador\n');
fs.writeFileSync(path.join(bundle, 'index.md'), '# imobiliario\n');
fs.writeFileSync(path.join(bundle, 'jurisprudencia', 'resp-x.md'), '---\nstatus: vigente\n---\n');

// ── peças ────────────────────────────────────────────────────────────────────
const caso = path.join(raiz, 'clientes', 'fulano');
fs.mkdirSync(caso, { recursive: true });
const fm = (extra = '') => `---\ntitulo: X\nprocesso: 0000000-00.0000.8.27.2729\n${extra}---\n\n# I. Tese\n\nTexto.\n`;
const peca = path.join(caso, 'INICIAL.md');
fs.writeFileSync(peca, fm());

// ── transcripts ──────────────────────────────────────────────────────────────
const linha = (name, input) => JSON.stringify({ message: { content: [{ type: 'tool_use', name, input }] } });
const lidoBase = [
  linha('Read', { file_path: path.join(raiz, 'perfil', 'definicoes.md') }),
  linha('Bash', { command: 'cat perfil/usuario.md' }),
];
const transcript = (nome, linhas) => {
  const p = path.join(tmp, `${nome}.jsonl`);
  fs.writeFileSync(p, linhas.join('\n') + '\n');
  return p;
};
const tSemBundle = transcript('sem-bundle', lidoBase);
const tBundleRead = transcript('bundle-read', [...lidoBase, linha('Read', { file_path: path.join(bundle, 'jurisprudencia', 'resp-x.md') })]);
const tBundleCat = transcript('bundle-cat', [...lidoBase, linha('Bash', { command: `sed -n 1,50p ${bundle.replace(/\\/g, '/')}/index.md` })]);
const tBundleMsys = transcript('bundle-msys', [
  ...lidoBase,
  linha('Bash', { command: `node scripts/ler-pdfmd.js --mapa ${bundle.replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => `/${d.toLowerCase()}`)}/index.md` }),
]);
const tOutroBundle = transcript('outro-bundle', [...lidoBase, linha('Read', { file_path: path.join(acervo, 'index.md') })]);
const tSoBundle = transcript('so-bundle', [linha('Read', { file_path: path.join(bundle, 'index.md') })]);

const write = (conteudo, transcript_path) => ({
  tool_name: 'Write',
  tool_input: { file_path: peca, content: conteudo },
  transcript_path,
});

function rodarHook(payload) {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'require-leitura.js')], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: '', PMA_MANUTENCAO: '', PMA_BUNDLES: acervo },
  });
  return r.status;
}

const casosHook = [
  [B, 'peça sem bundle: (definições lidas)', write(fm(), tSemBundle)],
  [B, 'bundle declarado, nada do bundle lido', write(fm('bundle: direito/imobiliario\n'), tSemBundle)],
  [B, 'bundle declarado, só o index do acervo lido (não o bundle)', write(fm('bundle: direito/imobiliario\n'), tOutroBundle)],
  [B, 'bundle inexistente', write(fm('bundle: direito/nao-existe\n'), tBundleRead)],
  [B, 'bundle fora da raiz do acervo', write(fm('bundle: ../../etc\n'), tBundleRead)],
  [B, 'bundle lido, mas definições não', write(fm('bundle: direito/imobiliario\n'), tSoBundle)],
  [P, 'bundle lido por Read', write(fm('bundle: direito/imobiliario\n'), tBundleRead)],
  [P, 'bundle lido por sed no shell', write(fm('bundle: direito/imobiliario\n'), tBundleCat)],
  [P, 'bundle lido por ler-pdfmd com caminho msys', write(fm('bundle: direito/imobiliario\n'), tBundleMsys)],
  [P, 'bundle: nenhum declarado', write(fm('bundle: nenhum\n'), tSemBundle)],
  [P, '.md que não é peça', { tool_name: 'Write', tool_input: { file_path: path.join(caso, 'NOTAS.md'), content: '# notas\n' }, transcript_path: tSemBundle }],
];

// ── md2docx: rastro ──────────────────────────────────────────────────────────
// Só se confere que o rastro barra (ou não barra) ANTES dos lints: o teste não
// compila .docx nenhum. "passa" aqui = stderr sem "RASTRO DO PIPELINE INCOMPLETO".
const casoDocx = path.join(tmp, 'docx');
fs.mkdirSync(casoDocx);
const escrever = (nome, texto, quando) => {
  const p = path.join(casoDocx, nome);
  fs.writeFileSync(p, texto);
  if (quando) fs.utimesSync(p, quando, quando);
  return p;
};
const agora = Date.now();
const antes = new Date(agora - 60000);
const depois = new Date(agora + 5000);
const completo = 'pipeline: legal-orchestrator\nbundle: direito/imobiliario\n';
const vered = (v) => `---\npeca: X.md\nveredito: ${v}\nvalidado_em: 2026-09-04\n---\n\n### VEREDITO: ${v}\n`;

const pSemVal = escrever('sem-validacao.md', fm(completo));
const pSemPipe = escrever('sem-pipeline.md', fm('bundle: direito/imobiliario\n'));
escrever('sem-pipeline.validacao.md', vered('APROVADO'), depois);
const pSemBundle = escrever('sem-bundle.md', fm('pipeline: legal-orchestrator\n'));
escrever('sem-bundle.validacao.md', vered('APROVADO'), depois);
const pReprovado = escrever('reprovado.md', fm(completo));
escrever('reprovado.validacao.md', vered('REPROVADO'), depois);
const pVelho = escrever('veredito-velho.md', fm(completo));
escrever('veredito-velho.validacao.md', vered('APROVADO'), antes);
const pSemVeredito = escrever('sem-veredito.md', fm(completo));
escrever('sem-veredito.validacao.md', '---\npeca: X.md\n---\n', depois);
const pOk = escrever('ok.md', fm(completo));
escrever('ok.validacao.md', vered('APROVADO COM RESSALVAS'), depois);

function rodarDocx(md) {
  const r = spawnSync(process.execPath, [MD2DOCX, md], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: '', PMA_MANUTENCAO: '' },
  });
  return /RASTRO DO PIPELINE INCOMPLETO/.test(r.stderr || '');
}

const casosDocx = [
  [B, 'sem <PECA>.validacao.md', pSemVal],
  [B, 'sem pipeline:', pSemPipe],
  [B, 'sem bundle:', pSemBundle],
  [B, 'veredito REPROVADO', pReprovado],
  [B, 'veredito mais velho que a peça', pVelho],
  [B, 'validacao.md sem veredito:', pSemVeredito],
  [P, 'pipeline + bundle + veredito novo', pOk],
];

let falhas = 0;
try {
  console.log(`\nrequire-leitura (${path.relative(RAIZ, HOOKS_SRC) || 'hooks'})`);
  for (const [espera, nome, payload] of casosHook) {
    const status = rodarHook(payload);
    const bloqueou = status === 2;
    const ok = bloqueou === espera && (status === 0 || status === 2);
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${bloqueou ? 'BLOQUEIA' : 'passa   '}  ${nome}${status !== 0 && status !== 2 ? ` (exit ${status})` : ''}`);
  }
  console.log(`\nmd2docx rastro (${path.relative(RAIZ, MD2DOCX)})`);
  for (const [espera, nome, md] of casosDocx) {
    const barrou = rodarDocx(md);
    const ok = barrou === espera;
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${barrou ? 'BARRA   ' : 'passa   '}  ${nome}`);
  }
  console.log(`\n${casosHook.length + casosDocx.length - falhas}/${casosHook.length + casosDocx.length} casos corretos.`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(falhas ? 1 : 0);

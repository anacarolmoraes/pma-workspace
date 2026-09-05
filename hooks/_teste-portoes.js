#!/usr/bin/env node
// Teste dos hooks de portão novos (2026-09-04): protect-gates, block-comandos,
// block-pdf, block-dado-caso, require-leitura, stop-peca-compilada.
//   node hooks/_teste-portoes.js
// Saída: 0 = todos os casos com o comportamento esperado.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const H = (n) => path.join(__dirname, `${n}.js`);
const RAIZ = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-portoes-'));
const B = true;
const P = false;

function rodar(hook, payload, env = {}) {
  const r = spawnSync(process.execPath, [H(hook)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: '', PMA_MANUTENCAO: '', ...env },
  });
  return r.status;
}

// ── fixtures em disco ────────────────────────────────────────────────────────
const caso = path.join(tmp, 'clientes', 'fulano');
fs.mkdirSync(caso, { recursive: true });
const pecaCompilada = path.join(caso, 'CONTESTACAO.md');
const pecaSemDocx = path.join(caso, 'REPLICA.md');
const pecaRascunho = path.join(caso, 'AGRAVO.md');
const naoPeca = path.join(caso, 'NOTAS.md');
// `bundle: nenhum` porque o require-leitura passou a exigir o campo (2026-09-04);
// aqui o que se testa é a leitura das definições, não o rastro do acervo.
const fm = (extra = '') => `---\ntitulo: X\nprocesso: 0000000-00.0000.8.27.2729\nbundle: nenhum\n${extra}---\n\n# I. Tese\n\nTexto.\n`;
fs.writeFileSync(pecaCompilada, fm());
fs.writeFileSync(pecaSemDocx, fm());
fs.writeFileSync(pecaRascunho, fm('rascunho: sim\n'));
fs.writeFileSync(naoPeca, '# notas soltas\n');
const agora = new Date();
fs.writeFileSync(path.join(caso, 'CONTESTACAO.docx'), 'x');
fs.utimesSync(path.join(caso, 'CONTESTACAO.docx'), agora, new Date(agora.getTime() + 5000));

const pdfSemMd = path.join(caso, 'sentenca.pdf');
const pdfComMd = path.join(caso, 'inicial.pdf');
fs.writeFileSync(pdfSemMd, '%PDF');
fs.writeFileSync(pdfComMd, '%PDF');
fs.writeFileSync(pdfComMd.replace(/\.pdf$/, '.md'), '# inicial\n');

const linhaTranscript = (name, input) =>
  JSON.stringify({ message: { content: [{ type: 'tool_use', name, input }] } });
const transcriptCom = path.join(tmp, 'com-leitura.jsonl');
const transcriptSem = path.join(tmp, 'sem-leitura.jsonl');
const transcriptStop = path.join(tmp, 'stop.jsonl');
const transcriptStopOk = path.join(tmp, 'stop-ok.jsonl');
fs.writeFileSync(
  transcriptCom,
  [
    linhaTranscript('Read', { file_path: path.join(RAIZ, 'perfil', 'definicoes.md') }),
    linhaTranscript('Bash', { command: 'cat perfil/usuario.md' }),
  ].join('\n') + '\n',
);
fs.writeFileSync(transcriptSem, linhaTranscript('Read', { file_path: 'qualquer.md' }) + '\n');
fs.writeFileSync(
  transcriptStop,
  [linhaTranscript('Edit', { file_path: pecaSemDocx }), linhaTranscript('Write', { file_path: naoPeca })].join('\n') + '\n',
);
fs.writeFileSync(
  transcriptStopOk,
  [linhaTranscript('Edit', { file_path: pecaCompilada }), linhaTranscript('Write', { file_path: pecaRascunho })].join('\n') + '\n',
);

const write = (p, content = 'texto') => ({ tool_name: 'Write', tool_input: { file_path: p, content } });
const edit = (p, s = 'texto') => ({ tool_name: 'Edit', tool_input: { file_path: p, old_string: 'a', new_string: s } });
const bash = (c) => ({ tool_name: 'Bash', tool_input: { command: c } });
const ps = (c) => ({ tool_name: 'PowerShell', tool_input: { command: c } });
const read = (p, extra = {}) => ({ tool_name: 'Read', tool_input: { file_path: p, ...extra } });
const naRaiz = (...s) => path.join(RAIZ, ...s);

const casos = [
  // ── protect-gates ──────────────────────────────────────────────────────────
  ['protect-gates', B, 'Edit em md2docx.js', edit(naRaiz('skills', 'peca-pma-builder', 'scripts', 'md2docx.js'))],
  ['protect-gates', B, 'Write em perfil/marca.json', write(naRaiz('perfil', 'marca.json'))],
  ['protect-gates', B, 'Edit em hook', edit(naRaiz('hooks', 'block-secrets.js'))],
  ['protect-gates', B, 'sed -i em lint-ia', bash('sed -i "s/2/9/" skills/humanizer-forense/scripts/lint-ia.js')],
  ['protect-gates', B, 'Set-Content em definicoes', ps('Set-Content perfil\\definicoes.md "x"')],
  ['protect-gates', P, 'Edit em peça de cliente', edit(pecaSemDocx)],
  ['protect-gates', P, 'Edit em SKILL.md comum', edit(naRaiz('skills', 'legal-writer', 'SKILL.md'))],
  ['protect-gates', P, 'cat de lint (leitura)', bash('cat skills/peca-pma-builder/scripts/md2docx.js')],
  ['protect-gates', P, 'execução de lint com 2>&1', bash('node scripts/lint-skills.js 2>&1 | tail -5')],
  ['protect-gates', P, 'node rodando o md2docx', bash('node skills/peca-pma-builder/scripts/md2docx.js clientes/x/PECA.md')],
  ['protect-gates', P, 'Edit no teste do hook', edit(naRaiz('hooks', '_teste-block-secrets.js'))],
  ['protect-gates', P, 'manutenção liberada por env', edit(naRaiz('perfil', 'marca.json')), { PMA_MANUTENCAO: '1' }],

  // ── block-comandos ─────────────────────────────────────────────────────────
  ['block-comandos', B, '--skip-lint', bash('node skills/peca-pma-builder/scripts/md2docx.js peca.md --skip-lint')],
  ['block-comandos', B, 'python do sistema', bash('python script.py')],
  ['block-comandos', B, 'python3 encadeado', bash('cd x && python3 -c "print(1)"')],
  ['block-comandos', B, 'pip install', bash('pip install pandas')],
  ['block-comandos', B, 'pdfmd_env legado', ps('& "D:\\x\\pdfmd\\pdfmd_env\\Scripts\\python.exe" -m pdfmd.cli a.pdf')],
  ['block-comandos', B, 'Set-Content em .md', ps('Set-Content clientes\\x\\PECA.md -Value $t')],
  ['block-comandos', B, 'redirecionamento PS para .js', ps('$t > gerar_peca.js')],
  ['block-comandos', P, 'python do adv_env', bash('D:/WORK/advocacia/adv_env/Scripts/python.exe script.py')],
  ['block-comandos', P, 'python via variável', ps('$py = (Get-Content perfil\\ambiente.json -Raw | ConvertFrom-Json).python; & $py s.py')],
  ['block-comandos', P, 'where python (diagnóstico)', bash('where python')],
  ['block-comandos', P, 'Get-Content de .md (leitura)', ps('Get-Content clientes\\x\\PECA.md')],
  ['block-comandos', P, 'redirecionamento bash para .txt', bash('echo x > saida.txt')],
  ['block-comandos', P, 'md2docx normal', bash('node skills/peca-pma-builder/scripts/md2docx.js peca.md')],

  // ── block-pdf ──────────────────────────────────────────────────────────────
  ['block-pdf', B, 'Read de PDF sem .md', read(pdfSemMd)],
  ['block-pdf', B, 'Read de PDF com .md irmão', read(pdfComMd)],
  ['block-pdf', P, 'Read de PDF com pages (visual)', read(pdfSemMd, { pages: '3' })],
  ['block-pdf', P, 'Read do .md', read(pdfComMd.replace(/\.pdf$/, '.md'))],

  // ── block-dado-caso ────────────────────────────────────────────────────────
  ['block-dado-caso', B, 'CPF em SKILL.md', write(naRaiz('skills', 'x', 'SKILL.md'), 'Autor CPF 123.456.789-09')],
  ['block-dado-caso', B, 'CPF em Edit de script', edit(naRaiz('scripts', 'x.js'), '// 123.456.789-09')],
  ['block-dado-caso', B, 'FICHA_CASO dentro de skill', write(naRaiz('skills', 'ficha-rescisao-lote', 'FICHA_CASO_X.md'))],
  ['block-dado-caso', P, 'CPF em clientes/', write(naRaiz('clientes', 'x', 'FICHA.md'), 'CPF 123.456.789-09')],
  ['block-dado-caso', P, 'CPF em scratch/', write(naRaiz('scratch', 'x.md'), 'CPF 123.456.789-09')],
  ['block-dado-caso', P, 'SKILL.md sem CPF', write(naRaiz('skills', 'x', 'SKILL.md'), 'REsp 1.300.418, Tema 577')],
  ['block-dado-caso', P, 'FICHA_CASO em clientes/', write(naRaiz('clientes', 'x', 'FICHA_CASO_X.md'))],

  // ── require-leitura ────────────────────────────────────────────────────────
  ['require-leitura', B, 'Write de peça sem ter lido', { ...write(pecaSemDocx, fm()), transcript_path: transcriptSem }],
  ['require-leitura', B, 'Edit de peça sem ter lido', { ...edit(pecaSemDocx), transcript_path: transcriptSem }],
  ['require-leitura', P, 'Write de peça tendo lido', { ...write(pecaSemDocx, fm()), transcript_path: transcriptCom }],
  ['require-leitura', P, 'Edit em .md que não é peça', { ...edit(naoPeca), transcript_path: transcriptSem }],
  ['require-leitura', P, 'Write fora de clientes/', { ...write(naRaiz('scratch', 'x.md'), fm()), transcript_path: transcriptSem }],

  // ── stop-peca-compilada ────────────────────────────────────────────────────
  ['stop-peca-compilada', B, 'peça editada sem .docx', { transcript_path: transcriptStop }],
  ['stop-peca-compilada', P, 'peça compilada + rascunho declarado', { transcript_path: transcriptStopOk }],
  ['stop-peca-compilada', P, 'stop_hook_active (sem laço)', { transcript_path: transcriptStop, stop_hook_active: true }],
  ['stop-peca-compilada', P, 'sessão sem escrita', { transcript_path: transcriptSem }],
  ['stop-peca-compilada', P, 'sem transcript', {}],

  // ── guarda de recursão em todos ────────────────────────────────────────────
  ['protect-gates', P, 'recursão', edit(naRaiz('perfil', 'marca.json')), { CLAUDE_INVOKED_BY: 't' }],
  ['block-comandos', P, 'recursão', bash('python x.py'), { CLAUDE_INVOKED_BY: 't' }],
  ['block-pdf', P, 'recursão', read(pdfSemMd), { CLAUDE_INVOKED_BY: 't' }],
];

let falhas = 0;
try {
  let atual = '';
  for (const [hook, esperaBloqueio, nome, payload, env] of casos) {
    if (hook !== atual) {
      atual = hook;
      console.log(`\n${hook}`);
    }
    const status = rodar(hook, payload, env);
    const bloqueou = status === 2;
    const ok = bloqueou === esperaBloqueio && (status === 0 || status === 2);
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${bloqueou ? 'BLOQUEIA' : 'passa   '}  ${nome}${status !== 0 && status !== 2 ? ` (exit ${status})` : ''}`);
  }
  console.log(`\n${casos.length - falhas}/${casos.length} casos corretos.`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(falhas ? 1 : 0);

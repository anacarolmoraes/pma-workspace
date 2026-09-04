#!/usr/bin/env node
// block-comandos — hook PreToolUse (Bash|PowerShell): três regras duras do
// AGENTS.md que eram texto viram verificação.
//
//   1. `--skip-lint` é decisão humana. O agente nunca pula portão; a titular
//      roda no terminal dela se julgar emergência.
//   2. Python é sempre o do adv_env (perfil/ambiente.json → python). Nunca
//      `python`/`py`/`pip` do sistema, nunca o pdfmd_env legado.
//   3. PowerShell não grava .md/.js: Set-Content/Out-File/`>` corrompem UTF-8
//      (PS 5.1 grava BOM ou UTF-16). Edição é pela ferramenta Edit/Write.
//
// Protocolo: stdin JSON; exit 2 = bloqueia; parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const { lerStdin, parseEntrada } = require('./lib/transcript');

// `python` como comando (início de linha ou após ; & | ), não como parte de
// caminho (adv_env\Scripts\python.exe) nem como argumento de where/which.
const RX_PY_SISTEMA = /(^|[;&|(]\s*|\n\s*)(python3?|py|pip3?)(\.exe)?(\s|$)/i;
const RX_PDFMD_ENV = /pdfmd_env/i;
const RX_SKIP_LINT = /--skip-lint\b/;
const RX_PS_GRAVA_MD = /\b(Set-Content|Out-File|Add-Content)\b[^\n;|]*\.(md|js)\b|(^|[^>])>{1,2}\s*["']?[^\s"']*\.(md|js)\b/i;

const AVISOS = {
  skip: 'BLOQUEADO por block-comandos: `--skip-lint` não é do agente.\n' +
    'Os lints reprovaram por algum motivo: corrija a peça (remissão, cacoete, citação) e recompile. ' +
    'Se a titular entender que é emergência, ela roda o comando no terminal dela.\n',
  python: 'BLOQUEADO por block-comandos: Python do sistema (ou ambiente legado pdfmd_env).\n' +
    'Use o interpretador de perfil/ambiente.json → python. Em PowerShell:\n' +
    '  $py = (Get-Content perfil\\ambiente.json -Raw | ConvertFrom-Json).python; & $py script.py\n' +
    'Em bash: py=$(node -p "require(\'./perfil/ambiente.json\').python"); "$py" script.py\n' +
    'Dependência nova entra em requirements.txt e é instalada por `node scripts/setup.js`.\n',
  grava: 'BLOQUEADO por block-comandos: PowerShell gravando .md/.js corrompe o UTF-8 (BOM/UTF-16).\n' +
    'Use a ferramenta Edit/Write para alterar o arquivo.\n',
};

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  const nome = String(entrada.tool_name || '');
  const cmd = entrada.tool_input?.command;
  if (!/^(Bash|PowerShell)$/.test(nome) || typeof cmd !== 'string') process.exit(0);

  if (RX_SKIP_LINT.test(cmd)) {
    process.stderr.write(AVISOS.skip);
    process.exit(2);
  }
  const semDiagnostico = cmd.replace(/\b(where|which|Get-Command)\s+\S+/gi, '');
  if (RX_PY_SISTEMA.test(semDiagnostico) || RX_PDFMD_ENV.test(cmd)) {
    process.stderr.write(AVISOS.python);
    process.exit(2);
  }
  if (nome === 'PowerShell' && RX_PS_GRAVA_MD.test(cmd)) {
    process.stderr.write(AVISOS.grava);
    process.exit(2);
  }
  process.exit(0);
}

lerStdin(main);

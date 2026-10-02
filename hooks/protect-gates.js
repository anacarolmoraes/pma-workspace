#!/usr/bin/env node
// protect-gates — hook PreToolUse: o agente não edita os próprios portões.
//
// Motivo: agente que reescreve o livro de regras ou afrouxa um lint "só para
// compilar" desliga, em silêncio, a verificação de todas as peças seguintes.
// Alterar portão é decisão da titular, em sessão declarada de manutenção:
// PMA_MANUTENCAO=1 no ambiente (no shell antes de abrir o Claude Code, ou em
// .claude/settings.local.json → "env").
//
// Cobre Write/Edit/NotebookEdit direto e comandos de shell que gravem sobre o
// arquivo (sed -i, >, Set-Content, mv, rm, git checkout...).
// Protocolo: stdin JSON; exit 2 = bloqueia (stderr vai ao modelo); parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);
if (/^(1|sim|true)$/i.test(process.env.PMA_MANUTENCAO || '')) process.exit(0);

const path = require('path');
const { RAIZ, norm, lerStdin, parseEntrada } = require('./lib/transcript');

const PROTEGIDOS = [
  // Testes dos hooks também são portão: enfraquecer o teste é o caminho mais curto
  // para enfraquecer o hook (01/10/2026).
  /^hooks\/[\w.-]+\.js$/,
  /^hooks\/lib\//,
  // settings.local.json carrega o `env` — é onde PMA_MANUTENCAO liga. Se o agente
  // pudesse gravá-lo, ligaria o modo manutenção sozinho.
  /^\.claude\/settings(\.local)?\.json$/,
  /^perfil\/(marca|advogados|monitor-djen|perfil)\.json$/,
  /^perfil\/definicoes\.md$/,
  /^scripts\/(lint-docx|lint-skills|setup)\.js$/,
  /^skills\/peca-pma-builder\/index\.js$/,
  /^skills\/peca-pma-builder\/scripts\/(md2docx|lint-[\w-]+)\.js$/,
  /^skills\/humanizer-forense\/scripts\/lint-ia\.js$/,
  /^skills\/pesquisa-djen\/lib\//,
  /^skills\/pesquisa-djen\/scripts\/(monitor|prazo)\.js$/,
];

// Inclui escrita programática (node -e / python -c): `writeFileSync` sobre um portão
// é a mesma coisa que `Set-Content` sobre ele (brecha fechada em 01/10/2026).
const RX_ESCRITA_SHELL =
  /(\bsed\s+-i|(^|[^>])>{1,2}(?!&)\s*["']?\S|\b(Set-Content|Out-File|Add-Content|tee)\b|\b(rm|del|Remove-Item|mv|move|Move-Item|cp|copy|Copy-Item)\b|\bgit\s+(checkout|restore|rm)\b|\b(writeFileSync|writeFile|appendFileSync|appendFile|renameSync|unlinkSync|copyFileSync|truncateSync|rmSync)\b|\bopen\s*\([^)]*['"][wa]|\[System\.IO\.File\]::|\[IO\.File\]::|\bNew-Item\b)/i;

function relativo(p) {
  const abs = path.resolve(RAIZ, String(p));
  const rel = norm(path.relative(RAIZ, abs));
  if (!rel || rel.startsWith('../') || path.isAbsolute(rel)) return null;
  return rel;
}

const protegido = (rel) => rel !== null && PROTEGIDOS.some((rx) => rx.test(rel));

function bloquear(alvo) {
  process.stderr.write(
    `BLOQUEADO por protect-gates: \`${alvo}\` é portão ou regra canônica do escritório.\n\n` +
      'Portão não se edita para passar; o que se corrige é a peça. Se a alteração for ' +
      'mesmo de manutenção, é decisão da titular: ela abre a sessão com PMA_MANUTENCAO=1 ' +
      '(ou grava em .claude/settings.local.json → "env"). Sem isso, deixe o arquivo como está ' +
      'e relate o que pretendia mudar.\n',
  );
  process.exit(2);
}

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  const nome = String(entrada.tool_name || '');
  const input = entrada.tool_input || {};

  if (/^(Write|Edit|NotebookEdit)$/.test(nome)) {
    const p = input.file_path || input.notebook_path;
    if (p && protegido(relativo(p))) bloquear(relativo(p));
    process.exit(0);
  }

  if (/^(Bash|PowerShell)$/.test(nome) && typeof input.command === 'string') {
    const cmd = input.command;
    if (!RX_ESCRITA_SHELL.test(cmd)) process.exit(0);
    // Tokens com cara de caminho: resolve cada um contra a raiz e testa.
    const tokens = cmd.match(/[\w.\-\/\\:]+\.(js|json|md)\b/g) || [];
    for (const t of tokens) {
      const rel = relativo(t.replace(/^["']|["']$/g, ''));
      if (protegido(rel)) bloquear(rel);
    }
  }
  process.exit(0);
}

lerStdin(main);

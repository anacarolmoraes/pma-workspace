#!/usr/bin/env node
// Teste do hook block-secrets. Roda o hook como subprocesso e confere o veredito.
//   node hooks/_teste-block-secrets.js
// Saída: 0 = todos os casos com o comportamento esperado.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'block-secrets.js');
const B = true; // deve bloquear
const P = false; // deve passar

const casos = [
  // ── devem BLOQUEAR ────────────────────────────────────────────────────────
  [B, 'Read .env', { tool_name: 'Read', tool_input: { file_path: 'D:/WORK/advocacia/.env' } }],
  [B, 'Read token do gws', { tool_name: 'Read', tool_input: { file_path: 'C:/Users/anamo/.config/gws/token.json' } }],
  [B, 'Read chave SSH', { tool_name: 'Read', tool_input: { file_path: '/c/Users/anamo/.ssh/id_rsa' } }],
  [B, 'Read certificado .pem', { tool_name: 'Read', tool_input: { file_path: 'D:/certs/cliente.pem' } }],
  [B, 'Read credentials.json', { tool_name: 'Read', tool_input: { file_path: 'D:/g/credentials.json' } }],
  [B, 'despejo de ambiente (unix)', { tool_name: 'Bash', tool_input: { command: 'print' + 'env | grep KEY' } }],
  [B, 'despejo de ambiente (ps)', { tool_name: 'PowerShell', tool_input: { command: 'Get-ChildItem Env:' } }],
  [B, 'leitura direta do .env', { tool_name: 'Bash', tool_input: { command: 'cat .env' } }],
  [B, 'exfiltração do .env', { tool_name: 'Bash', tool_input: { command: 'cp .env /tmp/x' } }],
  [B, 'Write sobre .env', { tool_name: 'Write', tool_input: { file_path: 'D:/WORK/advocacia/.env' } }],

  // ── devem PASSAR (trabalho normal e documento de cliente) ─────────────────
  [P, 'extrato bancário de cliente', { tool_name: 'Read', tool_input: { file_path: 'D:/WORK/advocacia/clientes/alex/EXTRATOS/banco.pdf' } }],
  [P, 'sentença do caso', { tool_name: 'Read', tool_input: { file_path: 'D:/WORK/advocacia/clientes/marly/SENTENCA.md' } }],
  [P, 'ficha com CPF', { tool_name: 'Read', tool_input: { file_path: 'D:/WORK/advocacia/clientes/x/FICHA_CASO.md' } }],
  [P, 'contrato .pdf do cliente', { tool_name: 'Read', tool_input: { file_path: 'D:/WORK/advocacia/clientes/x/contrato.pdf' } }],
  [P, 'gerar .docx', { tool_name: 'Bash', tool_input: { command: 'node scripts/md2docx.js peca.md' } }],
  [P, 'git status', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  [P, 'grep em jurisprudência', { tool_name: 'Grep', tool_input: { pattern: 'REsp 2.106.548', path: 'bundles/' } }],
  [P, 'gws listando arquivos', { tool_name: 'Bash', tool_input: { command: 'gws drive files list' } }],
  [P, 'menção a .env em documentação', { tool_name: 'Bash', tool_input: { command: 'grep -rn "arquivo .env" docs/' } }],
  [P, 'python do adv_env', { tool_name: 'Bash', tool_input: { command: 'D:/WORK/advocacia/adv_env/Scripts/python.exe script.py' } }],
];

let falhas = 0;
for (const [esperaBloqueio, nome, payload] of casos) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  const bloqueou = r.status === 2;
  const ok = bloqueou === esperaBloqueio;
  if (!ok) falhas++;
  const veredito = bloqueou ? 'BLOQUEIA' : 'passa   ';
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${veredito}  ${nome}`);
}

console.log(`\n${casos.length - falhas}/${casos.length} casos corretos.`);
process.exit(falhas ? 1 : 0);

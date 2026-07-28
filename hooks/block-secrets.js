#!/usr/bin/env node
// block-secrets — hook PreToolUse: impede que credenciais entrem no contexto.
//
// PRD F4.1. Protege CREDENCIAL, não MATÉRIA: documentos de cliente (extratos,
// contratos, PDFs com CPF) continuam legíveis — são o trabalho. O que não pode
// vazar para o contexto é chave de API, token OAuth e arquivo de segredo.
//
// Justificativa: sigilo profissional (art. 34, VII, EOAB) e LGPD. Uma chave lida
// para o contexto fica no transcript, que é gravado em disco.
//
// Protocolo: recebe JSON do hook em stdin; exit 2 = bloqueia (stderr vai ao modelo).
// Falha em modo NEGATIVO: se o caminho casa com um padrão de segredo, bloqueia
// mesmo em dúvida. Se o hook não conseguir interpretar a entrada, deixa passar
// (bloquear tudo por erro de parse inutilizaria a sessão).
'use strict';

// Guarda de recursão: processos filhos marcam CLAUDE_INVOKED_BY (PRD F4.4).
if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const PADROES_ARQUIVO = [
  /(^|[\\/])\.env($|\.|[\\/])/i,
  /\.(pem|key|p12|pfx|ppk)$/i,
  /(^|[\\/])credentials?[\w.-]*\.json$/i,
  /(^|[\\/])[\w.-]*token[\w.-]*\.json$/i,
  /(^|[\\/])client_secret[\w.-]*\.json$/i,
  // mcp_config.json guarda GOOGLE_CLIENT_SECRET em texto puro (achado 2026-07-26
  // em .agent/mcp_config.json) — nome inocente, conteúdo sensível.
  /(^|[\\/])mcp[_.-]?config\.json$/i,
  /(^|[\\/])\.mcp\.json$/i,
  /(^|[\\/])\.config[\\/]gws([\\/]|$)/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])id_(rsa|ed25519|ecdsa)($|\.)/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.aws[\\/]credentials/i,
];

// Comandos que despejam o ambiente inteiro ou leem arquivo de segredo.
const PADROES_COMANDO = [
  /\bprintenv\b/i,
  /(^|[;&|]\s*)env\s*($|[;&|>])/i,
  /Get-ChildItem\s+Env:/i,
  /\$env:\s*\|/i,
  /\bdir\s+env:/i,
  /\b(cat|type|Get-Content|head|tail|more|bat)\b[^\n;|&]*\.env\b/i,
  /\b(cat|type|Get-Content)\b[^\n;|&]*\.(pem|key|p12)\b/i,
  /\bgws\b[^\n]*\b(auth|token)\b[^\n]*\b(print|show|dump|cat)\b/i,
  /\b(cat|type|Get-Content)\b[^\n;|&]*credentials[\w.-]*\.json/i,
];

// Exfiltração: copiar/mover/enviar arquivo de credencial.
const RX_EXFILTRA =
  /\b(cp|copy|Copy-Item|mv|move|Move-Item|scp|rsync|curl\s+[^\n]*-F|Invoke-WebRequest)\b[^\n;|&]*(\.env\b|\.(pem|key|p12|pfx)\b|credentials?[\w.-]*\.json|id_(rsa|ed25519))/i;

// Campos de tool_input que costumam carregar caminho de arquivo.
const CAMPOS_CAMINHO = ['file_path', 'path', 'notebook_path', 'filePath', 'pattern'];
// Campos que carregam linha de comando.
const CAMPOS_COMANDO = ['command'];

function coletar(obj, campos, saida = []) {
  if (!obj || typeof obj !== 'object') return saida;
  for (const [k, v] of Object.entries(obj)) {
    if (campos.includes(k) && typeof v === 'string') saida.push(v);
    else if (v && typeof v === 'object') coletar(v, campos, saida);
  }
  return saida;
}

function bloquear(motivo, alvo) {
  process.stderr.write(
    `BLOQUEADO por block-secrets: ${motivo}\n` +
      `  alvo: ${alvo}\n\n` +
      `Este hook protege credenciais (chave de API, token OAuth, .env, chave SSH) — ` +
      `não bloqueia documento de cliente. Se precisa do VALOR de um segredo, peça à ` +
      `usuária; se precisa apenas que um script use a credencial, execute o script ` +
      `(ele lê o arquivo sem trazer o conteúdo para o contexto).\n`,
  );
  process.exit(2);
}

function main(entradaBruta) {
  let entrada;
  try {
    entrada = JSON.parse(entradaBruta);
  } catch {
    process.exit(0); // não interpretou: deixa passar (ver cabeçalho)
  }

  const input = entrada.tool_input || entrada.toolInput || {};

  for (const caminho of coletar(input, CAMPOS_CAMINHO)) {
    const norm = String(caminho).replace(/\\/g, '/');
    for (const rx of PADROES_ARQUIVO) {
      if (rx.test(norm)) bloquear('caminho corresponde a arquivo de credencial', caminho);
    }
  }

  for (const cmd of coletar(input, CAMPOS_COMANDO)) {
    for (const rx of PADROES_COMANDO) {
      if (rx.test(cmd)) bloquear('comando exporia credenciais ou variáveis de ambiente', cmd.slice(0, 200));
    }
    // Cópia/movimentação de arquivo de segredo para fora. Deliberadamente NÃO se
    // testa PADROES_ARQUIVO contra a linha inteira: um comando que apenas CITA
    // ".env" (grep numa doc, script de exemplo, teste) não é o mesmo que lê-lo —
    // bloquear a menção geraria falso positivo e o hook acabaria desligado.
    if (RX_EXFILTRA.test(cmd)) {
      bloquear('comando copiaria/moveria arquivo de credencial', cmd.slice(0, 200));
    }
  }

  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => main(buf));
process.stdin.on('error', () => process.exit(0));

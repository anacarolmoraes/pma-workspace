#!/usr/bin/env node
// pre-compact — hook PreCompact: preserva o estado da sessão antes da compactação.
//
// PRD F4.3. Arquitetura de DUAS camadas (do claude-memory-compiler): esta é a de
// CAPTURA — buffer append-only, sem curadoria. A promoção para memória, para
// `perfil/definicoes.md` ou para os bundles é sempre MANUAL.
//
// Deliberadamente NÃO chama LLM: um resumo automático custaria tokens, exigiria
// guarda de recursão e produziria conteúdo não verificado. Aqui só se extrai o
// que é determinístico — quais arquivos a sessão tocou, em que ordem.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const path = require('path');
const { RAIZ, lerStdin, usosDeFerramenta, arquivosEscritos } = require('./lib/transcript');

const DESTINO = path.join(RAIZ, 'scratch', 'sessoes');
const MAX_ARQUIVOS = 40;

const iso = () => new Date().toISOString();
const dia = () => iso().slice(0, 10);

function main(bruto) {
  let entrada = {};
  try {
    entrada = JSON.parse(bruto);
  } catch {
    /* segue com o que der */
  }

  const sessao = (entrada.session_id || 'sem-id').slice(0, 8);
  const transcript = entrada.transcript_path || '';
  const gatilho = entrada.trigger || 'auto';

  const tocados = transcript
    ? arquivosEscritos(usosDeFerramenta(transcript)).map((t) => ({
        ferramenta: t.ferramenta,
        arquivo: path.relative(RAIZ, t.arquivo) || t.arquivo,
      }))
    : [];

  const linhas = [
    `\n---\n`,
    `## ${iso()} — compactação (${gatilho}) · sessão ${sessao}`,
    '',
    `- transcript: \`${transcript || '(não informado)'}\``,
    `- arquivos escritos nesta sessão: **${tocados.length}**`,
  ];

  for (const t of tocados.slice(0, MAX_ARQUIVOS)) {
    linhas.push(`  - ${t.ferramenta} → \`${t.arquivo}\``);
  }
  if (tocados.length > MAX_ARQUIVOS) {
    linhas.push(`  - … e mais ${tocados.length - MAX_ARQUIVOS}`);
  }
  linhas.push('');
  linhas.push('> Captura automática. Promoção para memória/definições/bundle é manual.');

  try {
    fs.mkdirSync(DESTINO, { recursive: true });
    fs.appendFileSync(path.join(DESTINO, `${dia()}.md`), linhas.join('\n') + '\n', 'utf8');
  } catch {
    /* falha permissiva: nunca bloquear a compactação */
  }
  process.exit(0);
}

lerStdin(main);

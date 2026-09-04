#!/usr/bin/env node
// block-dado-caso — hook PreToolUse (Write|Edit|NotebookEdit): canário LGPD.
//
// Regra 7 do AGENTS.md: dado de caso não sai da camada C1. O que o repositório
// mostrou é que ele vaza para dentro de skill, script e documentação — não por
// má intenção, por exemplo colado. Este hook bloqueia a gravação de CPF fora
// das pastas locais de caso, e de ficha de caso dentro de skills/.
//
// Número de processo NÃO é bloqueado: é chave de citação de precedente público
// (regra 10) e aparece legitimamente em skills que citam jurisprudência.
// Protocolo: stdin JSON; exit 2 = bloqueia; parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const path = require('path');
const { RAIZ, norm, lerStdin, parseEntrada } = require('./lib/transcript');

// Onde dado de caso PODE existir (tudo fora do git, ou fora do motor).
const PASTAS_C1 = /^(clientes|scratch|_arquivo|consumir|relatorios|backups|PROJETOS_ANALISE|direito_bancario|direito_digital|rescisao_contrato_imovel|cobranca_honorarios|recursos_gerais|audio|docs)\//i;
const RX_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  if (!/^(Write|Edit|NotebookEdit)$/.test(String(entrada.tool_name || ''))) process.exit(0);
  const input = entrada.tool_input || {};
  const alvo = input.file_path || input.notebook_path;
  if (!alvo) process.exit(0);

  const rel = norm(path.relative(RAIZ, path.resolve(RAIZ, alvo)));
  const dentroDaRaiz = rel && !rel.startsWith('../') && !path.isAbsolute(rel);
  if (dentroDaRaiz && PASTAS_C1.test(rel)) process.exit(0);
  if (/(^|\/)_teste-[\w-]+\.js$/.test(rel)) process.exit(0);

  const base = path.basename(alvo);
  if (dentroDaRaiz && /^skills\//.test(rel) && /^FICHA_CASO_/i.test(base)) {
    process.stderr.write(
      `BLOQUEADO por block-dado-caso: \`${rel}\` é ficha de caso dentro de skill.\n` +
        'Skill guarda a ferramenta, nunca o caso: grave em clientes/<caso>/.\n',
    );
    process.exit(2);
  }

  const conteudo = [input.content, input.new_string, input.new_source]
    .filter((s) => typeof s === 'string')
    .join('\n');
  if (RX_CPF.test(conteudo)) {
    process.stderr.write(
      `BLOQUEADO por block-dado-caso: o conteúdo gravado em \`${rel || alvo}\` contém CPF.\n` +
        'CPF de pessoa real só existe em clientes/ (camada C1). No motor e no acervo entra ' +
        'rótulo de papel ([AUTOR], [BENEFICIÁRIO 1]) — critério da regra 10 do AGENTS.md.\n',
    );
    process.exit(2);
  }
  process.exit(0);
}

lerStdin(main);

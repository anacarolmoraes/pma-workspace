#!/usr/bin/env node
// require-leitura — hook PreToolUse (Write|Edit): antes de gravar peça, ter lido
// as definições canônicas e o perfil de quem assina (AGENTS.md §3).
//
// É o "antes de editar X, leia Y" clássico: valor da causa, gratuidade,
// assinatura e endereçamento saem errados quando o agente redige de memória.
// A conferência é determinística: procura no transcript da sessão um Read (ou
// cat/Get-Content) de perfil/definicoes.md e perfil/usuario.md.
//
// Só dispara para arquivo .md dentro de clientes/ cujo frontmatter é de peça
// (pipeline:, tipo:, ou titulo: + processo:). Protocolo: exit 2 = bloqueia.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const path = require('path');
const { RAIZ, norm, lerStdin, parseEntrada, usosDeFerramenta, foiLido, lerFrontmatter, ehPeca } = require('./lib/transcript');

const OBRIGATORIOS = [
  { sufixo: 'perfil/definicoes.md', motivo: 'valor da causa, gratuidade, assinatura, prazos, custas' },
  { sufixo: 'perfil/usuario.md', motivo: 'quem assina, em que comarca' },
];

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  if (!/^(Write|Edit)$/.test(String(entrada.tool_name || ''))) process.exit(0);
  const input = entrada.tool_input || {};
  const alvo = input.file_path;
  if (!alvo || !/\.md$/i.test(alvo) || !/(^|\/)clientes\//i.test(norm(alvo))) process.exit(0);

  let texto = typeof input.content === 'string' ? input.content : null;
  if (texto === null) {
    try {
      texto = fs.readFileSync(alvo, 'utf8');
    } catch {
      process.exit(0);
    }
  }
  if (!ehPeca(lerFrontmatter(texto))) process.exit(0);

  const usos = entrada.transcript_path ? usosDeFerramenta(entrada.transcript_path) : [];
  const faltam = OBRIGATORIOS.filter((o) => {
    const existe = fs.existsSync(path.join(RAIZ, ...o.sufixo.split('/')));
    return existe && !foiLido(usos, o.sufixo);
  });
  if (!faltam.length) process.exit(0);

  process.stderr.write(
    `BLOQUEADO por require-leitura: \`${path.basename(alvo)}\` é peça e a sessão ainda não leu:\n` +
      faltam.map((o) => `  - ${o.sufixo}  (${o.motivo})`).join('\n') +
      '\n\nLeia-os (Read) e grave de novo. Depois: bundle da matéria em <bundles>/index.md e ' +
      'direito/pecas/<tipo>/ — protocolo do AGENTS.md §3.\n',
  );
  process.exit(2);
}

lerStdin(main);

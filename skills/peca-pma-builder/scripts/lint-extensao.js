#!/usr/bin/env node
// lint-extensao — portão de extensão para embargos de declaração e contrarrazões a EDcl.
//
// Decisão da titular, 17/10/2026 (manutenção de 18/10/2026): contrarrazões a EDcl de
// cinco páginas contra despacho de uma saíram com treze páginas e dezesseis
// transcrições, com todos os lints verdes. Juiz julga EDcl em cinco dias (CPC 1.024) e lê
// treze páginas por amostragem. A regra mora no acervo (direito/pecas/embargos-declaracao,
// playbook, seção "Extensão"); aqui só se mede e se bloqueia.
//
// Alcance: peça cujo `titulo:` contém "embargos de declaração" (EDcl e contrarrazões).
// Tetos: 6 páginas estimadas (~300 palavras do .md por página do .docx PMA, prosa +
// transcrições) e 6 transcrições em bloco. `orcamento_paginas: N` no frontmatter
// substitui o teto de páginas (e libera as transcrições até N): a decisão de escrever mais
// fica REGISTRADA no documento, como `cita_em_teste`. O ritmo.js reproduz a mesma conta
// como aviso, para que o número apareça antes de compilar.
//
// Uso: node lint-extensao.js peca.md      → 0 ok · 1 acima do orçamento · 2 uso errado
'use strict';
const fs = require('fs');
const path = require('path');

const PALAVRAS_POR_PAGINA = 300;
const TETO_PAGINAS_EDCL = 6;
const TETO_TRANSCRICOES_EDCL = 6;

function medir(texto) {
  const fm = (texto.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
  const corpo = texto.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  const paginas = Math.round(palavras / PALAVRAS_POR_PAGINA);
  const transcricoes = (corpo.match(/(^|\n\s*\n)\s*>/g) || []).length;
  const titulo = (fm.match(/^titulo:\s*(.+)$/m) || [])[1] || '';
  const orcamento = Number((fm.match(/^orcamento_paginas:\s*(\d+)/m) || [])[1]) || 0;
  const ehEdcl = /embargos\s+de\s+declara/i.test(titulo);
  return { palavras, paginas, transcricoes, titulo, orcamento, ehEdcl };
}

function avaliar(m) {
  const problemas = [];
  if (!m.ehEdcl) return problemas;
  const tetoPag = m.orcamento || TETO_PAGINAS_EDCL;
  const tetoTr = m.orcamento ? Math.max(TETO_TRANSCRICOES_EDCL, m.orcamento) : TETO_TRANSCRICOES_EDCL;
  if (m.paginas > tetoPag) problemas.push(`~${m.paginas} páginas estimadas (${m.palavras} palavras) para um teto de ${tetoPag}.`);
  if (m.transcricoes > tetoTr) problemas.push(`${m.transcricoes} transcrições em bloco para um teto de ${tetoTr}.`);
  return problemas;
}

if (require.main === module) {
  const arquivo = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!arquivo || !fs.existsSync(arquivo)) {
    console.error('Uso: node lint-extensao.js <peca.md>');
    process.exit(2);
  }
  const m = medir(fs.readFileSync(arquivo, 'utf8'));
  const problemas = avaliar(m);
  const nome = path.basename(arquivo);
  if (!m.ehEdcl) {
    console.log(`lint-extensao: ${nome} — fora do alcance (não é EDcl nem contrarrazões a EDcl pelo \`titulo:\`); ~${m.paginas} p., ${m.transcricoes} transcrição(ões).`);
    process.exit(0);
  }
  if (!problemas.length) {
    console.log(`lint-extensao: ${nome} — dentro do orçamento (~${m.paginas} p., ${m.transcricoes} transcrição(ões)).`);
    process.exit(0);
  }
  console.error(`lint-extensao: ${nome} — ACIMA DO ORÇAMENTO de EDcl/contrarrazões (decisão da titular, 17/10/2026):`);
  for (const p of problemas) console.error(`  • ${p}`);
  console.error(
    '\nVoltar à estrutura (Estágio 0.5), não cortar depois: transcrever só o que o juiz precisa ler\n' +
      'com os próprios olhos; cada fato uma vez; lei e quadro de contrato em prosa com remissão;\n' +
      'capítulo de dois parágrafos vira fecho ou alínea. Regra: acervo, direito/pecas/embargos-declaracao,\n' +
      'playbook, seção "Extensão". Para escrever mais de propósito, declare no frontmatter:  orcamento_paginas: N',
  );
  process.exit(1);
}

module.exports = { medir, avaliar, PALAVRAS_POR_PAGINA, TETO_PAGINAS_EDCL, TETO_TRANSCRICOES_EDCL };

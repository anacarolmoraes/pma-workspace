#!/usr/bin/env node
// lint-inicial: confere, numa peça com `tipo: inicial` no frontmatter, o que é
// mecânico no checklist de saída da petição inicial
// (<bundles>/direito/pecas/peticao-inicial/index.md, "Checklist de saída")
// e nas definições do escritório (perfil/definicoes.md §5):
//
//   1. endereçamento em bloco ::endereco, "AO JUÍZO DA ... COMARCA DE ...",
//      sem "Excelentíssimo" (definicoes §5)
//   2. capítulo I é "Da síntese da lide" (definicoes §5)
//   3. qualificação com CPF/CNPJ e endereço eletrônico (CPC 319, II), sem telefone (§5)
//   4. capítulo "Dos pedidos" (CPC 319, IV)
//   5. valor da causa declarado com R$ (CPC 319, V; regra do inciso em definicoes §1)
//   6. protesto por provas (CPC 319, VI)
//   7. manifestação sobre a audiência de conciliação/mediação (CPC 319, VII; 334 §5º)
//   8. bloco ::assinatura (definicoes §4)
//   9. se pede gratuidade, cita o art. 98 ou 99 do CPC (definicoes §2)
//
// Peça sem `tipo: inicial` (ou tipo ausente) passa sem conferir: o lint é do
// tipo, não do arquivo. `tipo:` faz a peça ser reconhecida como peça pelos hooks
// (ehPeca), então só se declara em arquivo que é peça de verdade.
//
// Uso: node scripts/lint-inicial.js caminho/da/peca.md   → exit 1 se algum item falhar
'use strict';

const fs = require('fs');

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node lint-inicial.js <peca.md>'); process.exit(2); }

const src = fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
const linhas = src.split('\n');

// frontmatter YAML-lite
const meta = {};
let fim = 0;
if (linhas[0] === '---') {
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i] === '---') { fim = i + 1; break; }
    const m = linhas[i].match(/^(\w+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
}
const tipo = String(meta.tipo || '').trim();
if (!/^(inicial|peti[çc][ãa]o[-_ ]inicial|peticao[-_ ]inicial)/i.test(tipo)) {
  console.log(`lint-inicial: peça sem \`tipo: inicial\` (tipo: ${tipo || 'ausente'}) — nada a conferir.`);
  process.exit(0);
}

// corpo sem comentários HTML e sem citações em bloco
const corpo = linhas
  .slice(fim)
  .join('\n')
  .replace(/<!--[\s\S]*?-->/g, '')
  .split('\n');
const prosa = corpo.filter((l) => !l.trim().startsWith('>')).join('\n');

const bloco = (nome) => {
  const m = prosa.match(new RegExp(`^::${nome}\\s*\\n([\\s\\S]*?)^::\\s*$`, 'm'));
  return m ? m[1] : null;
};
const idxCapI = corpo.findIndex((l) => /^#\s+I\.\s/.test(l));
const antesCapI = (idxCapI >= 0 ? corpo.slice(0, idxCapI) : corpo).join('\n');
const titulos = corpo.filter((l) => /^#\s+[IVXLC]+\.\s/.test(l));

const testes = [];
const t = (nome, ok, dica) => testes.push({ nome, ok, dica });

const end = bloco('endereco');
t('1. Endereçamento em bloco ::endereco',
  end !== null, 'abrir com `::endereco` e fechar com `::` (dialeto PMA)');
t('1. Endereçamento no padrão "AO JUÍZO DA ... COMARCA DE ..."',
  end !== null && /AO JU[ÍI]ZO DA/.test(end) && /COMARCA DE/.test(end),
  'definicoes.md §5: `AO JUÍZO DA __ª VARA CÍVEL DA COMARCA DE X, ESTADO DE Y`');
t('1. Sem "Excelentíssimo" no endereçamento',
  !/EXCELENT[ÍI]SSIM/i.test(end || ''), 'definicoes.md §5 veda a fórmula');

t('2. Capítulo I é "Da síntese da lide"',
  idxCapI >= 0 && /^#\s+I\.\s+Da s[íi]ntese da lide\s*$/i.test(corpo[idxCapI]),
  'definicoes.md §5: capítulo I = "DA SÍNTESE DA LIDE", em BLUF');

t('3. Qualificação com CPF/CNPJ antes do capítulo I',
  /\b(CPF|CNPJ)\b/.test(antesCapI), 'CPC 319, II');
t('3. Qualificação com endereço eletrônico',
  /endere[çc]o eletr[ôo]nico|e-?mail/i.test(antesCapI), 'CPC 319, II exige o e-mail');
t('3. Qualificação sem telefone',
  !/\btelefone\b|\(\d{2}\)\s?9?\d{4}-?\d{4}/i.test(antesCapI), 'definicoes.md §5: sem telefone da parte autora');

t('4. Capítulo "Dos pedidos"',
  titulos.some((l) => /Dos pedidos/i.test(l)), 'CPC 319, IV — título `# N. Dos pedidos`');

t('5. Valor da causa declarado com R$',
  /(?:valor da causa|d[áa]-se [àa] causa o valor|atribui(?:-se)? [àa] causa o valor)[^\n]*R\$|R\$[^\n]*valor da causa/i.test(prosa) ||
    (/^#\s+[IVXLC]+\.\s+Do valor da causa/im.test(prosa) && /R\$/.test(prosa)),
  'CPC 319, V; inciso do art. 292 conforme definicoes.md §1');

t('6. Protesto por provas',
  /protesta(?:-se)?\s+provar|provar o alegado|pretende (?:demonstrar|provar)|meios de prova/i.test(prosa),
  'CPC 319, VI — e o meio nomeado para cada fato "a produzir"');

t('7. Manifestação sobre a audiência de conciliação/mediação',
  /art\.?\s*334|autocomposi[çc][ãa]o|audi[êe]ncia de (?:concilia[çc][ãa]o|media[çc][ãa]o)/i.test(prosa),
  'CPC 319, VII c/c 334, §5º — interesse ou desinteresse, decisão da ANALISE.md');

t('8. Bloco ::assinatura',
  bloco('assinatura') !== null, 'definicoes.md §4 e perfil/advogados.json');

if (/gratuidade/i.test(prosa)) {
  t('9. Gratuidade cita o art. 98 ou 99 do CPC',
    /art(?:igo|\.)?\s*9[89]\b/i.test(prosa), 'definicoes.md §2 e Tema 1.178/STJ');
}

let falhas = 0;
for (const x of testes) {
  if (x.ok) console.log(`✔ ${x.nome}`);
  else { falhas++; console.log(`✘ ${x.nome} — ${x.dica}`); }
}
if (falhas) {
  console.error(`\n${falhas} item(ns) do checklist da inicial reprovado(s). Corrigir antes de gerar o .docx.`);
  process.exit(1);
}
console.log('\nlint-inicial: checklist mecânico OK. O que é julgamento (destaque, mapa probatório, ' +
  'ataques respondidos) continua no Estágio 6 do orchestrator e no playbook do acervo.');
process.exit(0);

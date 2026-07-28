#!/usr/bin/env node
// lint-ia: conta padrões de escrita de IA na prosa PRÓPRIA de uma peça
// (exclui transcrições literais) e falha acima dos limites do SKILL.md.
// Uso: node lint-ia.js <gerar_peca.js | peca.md>
// Saída: relatório + exit 0 (passou) / 1 (falhou) / 2 (uso).
'use strict';

const fs = require('fs');

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node lint-ia.js <gerar_peca.js | peca.md>'); process.exit(2); }
const bruto = fs.readFileSync(arquivo, 'utf8');

// ── Separar prosa própria de transcrição ────────────────────────────────────
let linhas = bruto.split('\n');
let prosa;
if (arquivo.endsWith('.js')) {
  // exclui transcrições (pQuote), comentários, rótulos fixos e bloco de assinatura
  prosa = linhas.filter((l) =>
    !/pQuote\(/.test(l) && !/^\s*\/\//.test(l) &&
    !/rotulo\(/.test(l) && !/nome:\s*'/.test(l) && !/localData/.test(l)
  ).join('\n');
} else {
  // .md: exclui blockquotes
  prosa = linhas.filter((l) => !/^\s*>/.test(l)).join('\n');
}

const capitulos = (bruto.match(/titulo\(\s*'|^#{1,2}\s/gm) || []).length || 1;

// ── Padrões e limites ────────────────────────────────────────────────────────
const contar = (re) => (prosa.match(re) || []);
const checks = [];
const add = (nome, ocorrencias, limite, dica) =>
  checks.push({ nome, n: ocorrencias.length, limite, ok: ocorrencias.length <= limite, dica, amostra: ocorrencias.slice(0, 3) });

add('Travessão (—) na prosa própria', contar(/—/g), 2 * capitulos,
  'Trocar por vírgula, parênteses ou dois-pontos (limite: 2 por capítulo).');

add('Paralelismo negativo ("e não" contrastivo)', contar(/[,—(]\s*e não\b|\bnão em\b.{0,25}—/g), 1,
  'Afirmar direto; o contraste fica implícito.');

add('Pergunta retórica (?) na prosa própria', contar(/\?/g), 0,
  'Converter em afirmação numerada.');

add('Registro inflado', contar(/por excelência|\bela própria\b|a própria função|verdadeir[oa]\b|inegável|robust[oa]s?\b/gi), 0,
  'Cortar o intensificador.');

// Rótulos meta-textuais visíveis — proibidos desde 2026-07-16 (decisão da usuária):
// a estrutura AI-first continua, mas dissolvida em prosa (ver "Prosa humanizada"
// no SKILL.md do peca-pma-builder). Transcrições (blockquote/pQuote) já estão
// excluídas da prosa, então ementas do STJ com "Caso em exame" não disparam aqui.
add('Rótulo meta-textual visível (proibido)', contar(
  /Conclusão do capítulo\s*:|Fundamento impugnado|Jurisprudência pertinente|(?:^|\*\*)Impugnação\s*:|Caso em exame\b|Questão em discussão\b|Tese do recurso\s*\./gm), 0,
  'Dissolver em prosa natural na mesma posição (tabela de equivalência no SKILL.md do peca-pma-builder).');

for (const f of ['impõe-se', 'de rigor', 'resta claro', 'insta salientar', 'cumpre destacar', 'ressalte-se', 'registre-se']) {
  add(`Verbo-fórmula "${f}"`, contar(new RegExp(f.replace(/[-]/g, '\\-'), 'gi')), 1,
    'Verbo direto ("deve ser admitido", "o óbice não se sustenta").');
}

// Frases-clone: sentenças longas idênticas repetidas na prosa própria
const sentencas = prosa.match(/[A-ZÀ-Ú][^.!?]{40,200}[.]/g) || [];
const vistos = new Map();
for (const s of sentencas) {
  const k = s.replace(/\s+/g, ' ').trim();
  vistos.set(k, (vistos.get(k) || 0) + 1);
}
const clones = [...vistos.entries()].filter(([, n]) => n >= 2).map(([s]) => s.slice(0, 80) + '…');
checks.push({ nome: 'Frases-clone (mesma sentença ≥ 2x)', n: clones.length, limite: 0, ok: clones.length === 0, dica: 'Variar a redação mantendo posição e rótulo.', amostra: clones.slice(0, 3) });

// ── Relatório ────────────────────────────────────────────────────────────────
let falhas = 0;
console.log(`lint-ia — ${arquivo} (${capitulos} capítulo(s) detectado(s))\n`);
for (const c of checks) {
  const st = c.ok ? '✔' : '✘';
  if (!c.ok) falhas++;
  console.log(`${st} ${c.nome}: ${c.n} (limite ${c.limite})${c.ok ? '' : ' — ' + c.dica}`);
  if (!c.ok && c.amostra.length && typeof c.amostra[0] === 'string' && c.amostra[0].length > 5) {
    for (const a of c.amostra) console.log(`    · "${String(a).slice(0, 90)}"`);
  }
}
console.log(falhas ? `\n${falhas} padrão(ões) acima do limite — desrobotizar antes de gerar o .docx.` : '\nProsa aprovada no lint anti-IA.');
process.exit(falhas ? 1 : 0);

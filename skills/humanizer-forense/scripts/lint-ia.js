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
const ehMd = !arquivo.endsWith('.js');

// ── Segmentação em capítulos, separando prosa própria de transcrição ────────
// Motivo (2026-08-04): o limite de travessão era um orçamento GLOBAL (2 × nº de
// capítulos), de modo que uma peça longa passava com a densidade concentrada em
// poucos capítulos. A regra do SKILL.md sempre foi "≤ 2 POR CAPÍTULO" — agora é
// medida assim. O preâmbulo (frontmatter, endereçamento, qualificação) não é
// prosa argumentativa e fica fora da contagem por capítulo.
function segmentar() {
  let linhas = bruto.split('\n');

  if (ehMd && linhas[0] && linhas[0].trim() === '---') {
    const fim = linhas.indexOf('---', 1);
    if (fim > 0) linhas = linhas.slice(fim + 1);
  }

  const caps = [];
  let atual = { titulo: '(preâmbulo)', linhas: [], preambulo: true };
  for (const l of linhas) {
    if (ehMd) {
      if (/^#\s/.test(l)) { caps.push(atual); atual = { titulo: l.replace(/^#\s*/, '').trim(), linhas: [] }; continue; }
      if (/^\s*>/.test(l)) continue;   // transcrição literal
      if (/^\s*::/.test(l)) continue;  // diretiva do dialeto (endereço, assinatura, center)
      atual.linhas.push(l);
    } else {
      const m = l.match(/titulo\(\s*'([^']*)'\s*,\s*'([^']*)'/);
      if (m) { caps.push(atual); atual = { titulo: `${m[1]} ${m[2]}`.trim(), linhas: [] }; continue; }
      if (/pQuote\(/.test(l) || /^\s*\/\//.test(l) || /rotulo\(/.test(l) ||
          /nome:\s*'/.test(l) || /localData/.test(l)) continue;
      atual.linhas.push(l);
    }
  }
  caps.push(atual);
  return caps;
}

const caps = segmentar();
const capsReais = caps.filter((c) => !c.preambulo);
const capitulos = capsReais.length || 1;
const prosa = caps.map((c) => c.linhas.join('\n')).join('\n');
const prosaArgumentativa = capsReais.map((c) => c.linhas.join('\n')).join('\n');

// ── Padrões e limites ────────────────────────────────────────────────────────
const contar = (re, alvo = prosa) => (alvo.match(re) || []);
const checks = [];
const avisos = [];
const add = (nome, ocorrencias, limite, dica) =>
  checks.push({ nome, n: ocorrencias.length, limite, ok: ocorrencias.length <= limite, dica, amostra: ocorrencias.slice(0, 3) });

// ── 1. Travessão, medido POR CAPÍTULO ───────────────────────────────────────
const porCap = capsReais
  .map((c) => ({ titulo: c.titulo, n: (c.linhas.join('\n').match(/—/g) || []).length }))
  .filter((c) => c.n > 0)
  .sort((a, b) => b.n - a.n);
const piorCap = porCap[0] || { titulo: '—', n: 0 };
checks.push({
  nome: 'Travessão (—) — pior capítulo',
  n: piorCap.n,
  limite: 2,
  ok: piorCap.n <= 2,
  dica: `concentrado em "${piorCap.titulo.slice(0, 60)}"; trocar por vírgula, parênteses ou dois-pontos`,
  amostra: porCap.filter((c) => c.n > 2).map((c) => `${c.n}× em "${c.titulo.slice(0, 60)}"`),
});

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

// ── 2. Enumeração mecânica ───────────────────────────────────────────────────
// "A primeira consiste em… A segunda está em… A terceira é…". Só dispara na
// forma ENUMERATIVA (ordinal como sujeito seguido de cópula), para não pegar
// "a primeira faixa da escala" nem "decisão de primeiro grau".
// Atenção ao \b: "é" e "está" terminam em caractere não-ASCII, que NÃO é
// word-char para o \b do JS — um \b final aqui nunca casaria.
add('Enumeração mecânica ("A primeira é… A segunda…")',
  contar(/(?:^|[\s.;,])[AO]s?\s+(?:primeir|segund|terceir|quart|quint)[ao]\s+(?:del[ae]s?\s+)?(?:é|está|consiste|decorre|reside|vem|se\s+refere|diz)(?=[\s,.;:])/gi), 3,
  'Dissolver em prosa: variar a abertura de cada razão (Comece-se por…, Soma-se a isso…, Há ainda…, Por fim…).');

// ── 3. Tríade anafórica ──────────────────────────────────────────────────────
// "não nega o contrato, não nega os pagamentos e não se opõe à rescisão":
// três ou mais orações vizinhas abrindo com a MESMA palavra.
// Correlativas legítimas do português ("ora… ora…", "seja… seja…"): são
// construções gramaticais de ênfase, não cacoete de modelo — não contam.
const CORRELATIVAS = new Set(['ora', 'seja', 'quer', 'nem', 'tanto', 'já', 'umas', 'uns']);
// Anáfora de negação — "não nega X, não nega Y e não se opõe a Z": a mesma
// partícula abrindo três orações da mesma frase. Detectada por contagem, porque
// a última oração costuma vir ligada por "e", sem vírgula que a separe.
const ANAFORICAS = ['não', 'nem', 'sem', 'tampouco', 'jamais'];
const triades = [];
for (const frase of prosa.split(/(?<=[.!?])\s+/)) {
  for (const p of ANAFORICAS) {
    const n = (frase.match(new RegExp(`(?:^|[\\s,;(])${p}\\s`, 'gi')) || []).length;
    if (n >= 3) { triades.push(frase.slice(0, 90)); break; }
  }
}
for (const frase of prosa.split(/(?<=[.!?])\s+/)) {
  const partes = frase.split(/,\s*(?:e\s+)?|;\s*/).map((p) => p.trim()).filter(Boolean);
  let seq = 1;
  for (let i = 1; i < partes.length; i++) {
    const a = (partes[i - 1].split(/\s+/)[0] || '').toLowerCase().replace(/[^a-zà-ú]/gi, '');
    const b = (partes[i].split(/\s+/)[0] || '').toLowerCase().replace(/[^a-zà-ú]/gi, '');
    if (a && a === b && a.length >= 3 && !CORRELATIVAS.has(a)) {
      seq++; if (seq >= 3) { triades.push(frase.slice(0, 90)); break; }
    } else seq = 1;
  }
}
add('Tríade anafórica (3+ orações abrindo igual)', triades, 0,
  'Quebrar o paralelismo: subordinar as orações ou fundi-las numa só.');

// ── 4. Frase truncada de efeito ──────────────────────────────────────────────
// "Existia." / "Não se amolda." — período de até 3 palavras usado como golpe.
const truncadas = (prosaArgumentativa.match(/(?:^|(?<=[.!?]\s))[A-ZÀ-Ú][^.!?]{0,40}\./g) || [])
  .map((s) => s.trim())
  .filter((s) => {
    const pal = s.replace(/\.$/, '').split(/\s+/).filter(Boolean);
    if (pal.length > 3) return false;
    // Cauda de citação — "…, Rel. Min. Luis Felipe Salomão)." vira "sentença"
    // quando o divisor quebra no ponto da abreviatura. Parêntese denuncia.
    if (/[()]/.test(s)) return false;
    return !/\d|art\.|n[.º]|§|REsp|Min\.|Rel\.|Súmula|Des\.|inc\./i.test(s);
  });
add('Frase truncada de efeito (≤ 3 palavras)', truncadas, 1,
  'Integrar ao período anterior; o corte seco é cacoete de modelo.');

// ── 5. Linha solta em negrito como efeito dramático (.md) ───────────────────
if (ehMd) {
  const soltas = [];
  let dentroDeCapitulo = false;
  let front = true;
  const ls = bruto.split('\n');
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i].trim();
    if (front) { if (i > 0 && l === '---') front = false; if (i === 0 && l !== '---') front = false; continue; }
    if (/^#\s/.test(l)) { dentroDeCapitulo = true; continue; }
    if (!dentroDeCapitulo) continue;                       // cabeçalho/qualificação
    if (/^\*\*[^*]+\*\*$/.test(l) && !/^\*\*[a-z]\)/.test(l)) soltas.push(l.slice(0, 80));
  }
  add('Parágrafo inteiro em negrito (efeito dramático)', soltas, 0,
    'A ênfase vem do argumento; devolver a frase ao corpo do parágrafo.');
}

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

// ── AVISO (não reprova): títulos de capítulo que não enunciam conclusão ─────
// Regra 2 da heurística estrutura-ai-first. É aviso, e não portão, porque a
// fronteira entre "rótulo vazio" e "título convencional legítimo" (Dos pedidos)
// não é mecanicamente segura — e um portão com falso positivo leva ao
// --skip-lint, que desliga TODAS as verificações.
const TITULOS_CONVENCIONAIS = /^(d[oa]s?\s+)?(pedidos?|requerimentos?|fatos?|s[íi]ntese.*|prelimin(ar|ares)|tempestividade|conclus[ãa]o)$/i;
const vazios = capsReais
  .map((c) => c.titulo.replace(/^[IVXLC]+\.\s*/, '').replace(/\s+$/, ''))
  .filter((t) => t && t.split(/\s+/).length <= 4 && !TITULOS_CONVENCIONAIS.test(t));
if (vazios.length) {
  avisos.push({
    nome: 'Título de capítulo sem conclusão enunciada',
    n: vazios.length,
    dica: 'Regra 2 de estrutura-ai-first: o título deve enunciar a tese do capítulo, não rotulá-lo ("Dos juros de mora" → "Os juros correm da citação").',
    amostra: vazios.slice(0, 5),
  });
}

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
for (const a of avisos) {
  console.log(`⚠ ${a.nome}: ${a.n} — ${a.dica}`);
  for (const s of a.amostra) console.log(`    · "${String(s).slice(0, 90)}"`);
}
console.log(falhas ? `\n${falhas} padrão(ões) acima do limite — desrobotizar antes de gerar o .docx.` : '\nProsa aprovada no lint anti-IA.');
process.exit(falhas ? 1 : 0);

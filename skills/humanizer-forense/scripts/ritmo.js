#!/usr/bin/env node
// ritmo — diagnóstico NÃO bloqueante de ritmo da prosa própria de uma peça.
//
// O lint-ia.js conta padrões (travessão, tríade, frase-clone) e reprova acima
// do limite. O que ele não pega é ritmo: frases do mesmo tamanho, parágrafos
// que abrem igual, "Além disso" a cada parágrafo, norma→aplicação→conclusão em
// série. Numa réplica real a peça passou no lint e ainda assim foi lida como
// IA. Este script mede esses sinais e os entrega à passada humana; nunca
// reprova (exit 0 sempre), porque frequência estilística é indício, não prova.
//
// Também é o critério objetivo do Estágio 5 do legal-orchestrator: com sinal,
// a humanização altera; sem sinal, só analisa e registra.
//
// Uso: node ritmo.js <peca.md> [--json]
'use strict';

const fs = require('fs');
const path = require('path');
const S = require('./lib/segmentar');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const arquivo = args.find((a) => !a.startsWith('--'));
if (!arquivo) { console.error('Uso: node ritmo.js <peca.md> [--json]'); process.exit(2); }
if (!fs.existsSync(arquivo)) { console.error(`arquivo não encontrado: ${arquivo}`); process.exit(2); }

const seg = S.segmentar(fs.readFileSync(arquivo, 'utf8'));
const caps = S.capitulosReais(seg);
const sinais = [];
const sinal = (nome, onde, detalhe, amostra = []) => sinais.push({ nome, onde, detalhe, amostra });
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cv = (xs) => { if (xs.length < 2) return 0; const m = media(xs); const v = media(xs.map((x) => (x - m) ** 2)); return m ? Math.sqrt(v) / m : 0; };
const norm = (s) => s.toLowerCase().replace(/\*\*|__|[*_]/g, '').replace(/\s+/g, ' ').trim();
const curto = (t, n = 60) => (t.length > n ? t.slice(0, n) + '…' : t);

const CONECTIVOS = ['além disso', 'ademais', 'nesse sentido', 'neste sentido', 'outrossim', 'com efeito', 'portanto', 'assim', 'dessa forma', 'desse modo', 'nessa linha', 'nessa toada', 'por fim', 'vale dizer', 'isto é', 'ou seja', 'em suma', 'diante disso', 'logo', 'noutro giro', 'de outro lado', 'por outro lado', 'não obstante', 'ocorre que', 'com isso', 'a propósito'];
const RX_CONCL = /\b(portanto|logo|assim|desse modo|dessa forma|por isso|por conseguinte|conclui-se|donde|daí)\b/i;
const RX_NORMA = /\b(art(?:s|igo)?\.?\s*\d|§|súmula|tema\s+\d|lei\s+(?:n|\d)|cpc|cdc|cc\b|constituição)/i;
const RX_APLIC = /\b(no caso|na hipótese|in casu|na espécie|nos autos|aqui,|no presente)/i;
const RX_ENUM = /\((?:[a-z]|[ivx]+)\)/gi;
const RX_CAP_PEDIDO = /pedido|requer|conclus/i;

const aberturasPeca = new Map();
let totalPars = 0;
const conectivosPeca = new Map();
// Linha de tabela (`| … |`, inclusive a de alinhamento `|:--:|`), de cronologia (`!16:32`,
// `16:52 | …`) e subtítulo (`##`) não são prosa: o segmentador as devolve como parágrafo, e
// até 15/10/2026 a linha `|:--:|` da tabela de documentos contava como dois dois-pontos.
const ehLinhaNaoProsa = (p) => /^(#|\||!|\d{1,2}:\d{2})/.test(p.trim());
const RX_CURTA_EFEITO = (f) => S.contarPalavras(f) <= 10 && !/\d|\(Doc|art\.|§|Súmula|REsp|Rel\.|Min\.|:\s*$/.test(f) && !/requer|protesta|pede|termos em que|deferimento/i.test(f);
let curtasPeca = 0;

for (const cap of caps) {
  const onde = curto(cap.titulo, 45);
  const prosaPars = cap.paragrafos.filter((p) => !ehLinhaNaoProsa(p));
  const pars = prosaPars.filter((p) => S.contarPalavras(p) >= 8);
  totalPars += pars.length;
  const prosa = prosaPars.join('\n');

  // 1. Frases de comprimento uniforme
  const fr = S.frases(prosa).map(S.contarPalavras).filter((n) => n >= 3);
  if (fr.length >= 8 && cv(fr) < 0.3) sinal('Frases de comprimento uniforme', onde, `${fr.length} frases, média ${media(fr).toFixed(0)} palavras, variação ${(cv(fr) * 100).toFixed(0)}% (abaixo de 30%)`);
  const longas = fr.filter((n) => n > 45).length;
  if (fr.length >= 6 && longas / fr.length > 0.5) sinal('Maioria de períodos muito longos', onde, `${longas} de ${fr.length} frases com mais de 45 palavras`);

  // 2. Quatro ou mais parágrafos consecutivos de tamanho parecido
  const tam = pars.map(S.contarPalavras);
  let seq = 1;
  for (let i = 1; i < tam.length; i++) {
    const parecido = Math.abs(tam[i] - tam[i - 1]) / Math.max(tam[i], tam[i - 1]) <= 0.2;
    seq = parecido ? seq + 1 : 1;
    if (seq === 4) { sinal('Parágrafos consecutivos do mesmo tamanho', onde, `4+ parágrafos seguidos com ±20% de palavras (${tam.slice(i - 3, i + 1).join(', ')})`); break; }
  }

  // 3. Aberturas repetidas (duas primeiras palavras)
  const aberturas = new Map();
  for (const p of pars) {
    const ws = S.palavras(norm(p)).slice(0, 2).join(' ');
    if (!ws) continue;
    aberturas.set(ws, (aberturas.get(ws) || 0) + 1);
    aberturasPeca.set(ws, (aberturasPeca.get(ws) || 0) + 1);
  }
  for (const [ab, n] of aberturas) if (n >= 2 && !/^(a|o|os|as|em|no|na|de|do|da|por|não) /.test(ab + ' ')) sinal('Parágrafos abrindo igual', onde, `"${ab}…" abre ${n} parágrafos`);
  for (const [ab, n] of aberturas) if (n >= 3) sinal('Parágrafos abrindo igual', onde, `"${ab}…" abre ${n} parágrafos`);

  // 4. Conectivos de abertura
  let comConectivo = 0;
  for (const p of pars) {
    const ini = norm(p).slice(0, 25);
    const c = CONECTIVOS.find((k) => ini.startsWith(k));
    if (c) { comConectivo++; conectivosPeca.set(c, (conectivosPeca.get(c) || 0) + 1); }
  }
  if (pars.length >= 4 && comConectivo / pars.length >= 0.5) sinal('Parágrafos que abrem por conectivo', onde, `${comConectivo} de ${pars.length} parágrafos começam por conectivo ("Além disso", "Nesse sentido"…)`);

  // 5. Norma → aplicação → conclusão em série
  let rigidos = 0; let maxRigidos = 0;
  for (const p of pars) {
    const arq = RX_NORMA.test(p) && RX_APLIC.test(p) && RX_CONCL.test(p);
    rigidos = arq ? rigidos + 1 : 0;
    maxRigidos = Math.max(maxRigidos, rigidos);
  }
  if (maxRigidos >= 3) sinal('Norma → aplicação → conclusão em série', onde, `${maxRigidos} parágrafos seguidos com a mesma arquitetura (cita norma, "no caso", "portanto")`);

  // 6. Fecho "Isso é X" / "Trata-se de" repetido
  const fechos = pars.map((p) => S.frases(p).slice(-1)[0] || '').filter(Boolean);
  const issoE = fechos.filter((f) => /^(isso|isto|esse|este)\s+(é|não é|significa|configura|basta)/i.test(f)).length;
  if (issoE >= 2) sinal('Fecho "Isso é [X]" repetido', onde, `${issoE} parágrafos terminam com o mesmo padrão de fecho`);

  // 7. Enumeração (a)/(b)/(i)/(ii) fora dos pedidos
  if (!RX_CAP_PEDIDO.test(cap.titulo)) {
    const n = (prosa.match(RX_ENUM) || []).length;
    if (n >= 3) sinal('Enumeração (a)/(b)/(i)/(ii) em capítulo argumentativo', onde, `${n} marcadores; em argumentação, prosa encadeada lê melhor (pedidos ficam de fora)`);
  }

  // 8. Dois-pontos na prosa (preferência da titular, 12/08/2026)
  const dp = (prosa.match(/:(?!\d)/g) || []).length - prosaPars.filter((p) => /:\s*$/.test(p)).length; // ":" que introduz blockquote não conta
  if (dp > 1) sinal('Dois-pontos em série na prosa', onde, `${dp} dois-pontos fora de introdução de citação; reservar para citação em bloco, síntese e "requer-se:"`);

  // 9. Capítulo raso
  const nPal = S.contarPalavras(prosa);
  if (nPal > 0 && nPal < 50 && !RX_CAP_PEDIDO.test(cap.titulo)) sinal('Capítulo com pouca prosa', onde, `${nPal} palavras próprias; título demais para argumento de menos`);

  // 10. Gancho de cena na abertura do capítulo (2026-10-15): "Em oitenta minutos da tarde de
  // uma sexta-feira, …" é abertura de reportagem; capítulo abre pelo sujeito e pela conclusão.
  const abre = S.frases(pars[0] || '')[0] || '';
  if (/^(em|na|no|às|naquel[ae]|durante)\b[^.]{0,70}?\b(\d{1,2}h\d{0,2}|\d{1,2}:\d{2}|minutos|tarde|manhã|noite|madrugada|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/i.test(abre)) {
    sinal('Gancho de cena na abertura', onde, `abre por circunstância de hora ou dia ("${curto(abre, 60)}"); abrir pelo sujeito e pela conclusão, a hora vai para a cronologia`);
  }

  // 11. Fila de frases curtas (2026-10-15): três ou mais frases de até 12 palavras seguidas no
  // mesmo parágrafo, uma por critério, é lista disfarçada. Peça aprovada também tem; é aviso.
  for (const p of pars) {
    const fr = S.frases(p);
    let s = 0; let ms = 0;
    for (const f of fr) { if (S.contarPalavras(f) <= 12) { s++; ms = Math.max(ms, s); } else s = 0; }
    if (ms >= 3) { sinal('Fila de frases curtas', onde, `${ms} frases de até 12 palavras seguidas ("${curto(fr.find((f) => S.contarPalavras(f) <= 12) || '', 50)}")`); break; }
  }

  // Densidade de frase curta de efeito: só informação. O corpus aprovado do escritório tem
  // mais frases curtas que a peça de IA; o que denuncia o modelo é a função (voz-forense §8.1).
  for (const p of pars) { const fr = S.frases(p); if (fr.length >= 2) curtasPeca += [fr[0], fr[fr.length - 1]].filter(RX_CURTA_EFEITO).length; }
}

// Peça inteira
for (const [ab, n] of aberturasPeca) if (n >= 5 && n / (totalPars || 1) >= 0.08) sinal('Abertura repetida na peça', '(peça)', `"${ab}…" abre ${n} de ${totalPars} parágrafos`);
for (const [c, n] of conectivosPeca) if (n >= 3) sinal('Conectivo de abertura repetido', '(peça)', `"${c}" abre ${n} parágrafos (≤ 1 por peça é o saudável)`);
const totalPal = caps.reduce((a, c) => a + S.contarPalavras(c.paragrafos.join('\n')), 0);
if (caps.length >= 4 && totalPal && caps.length / (totalPal / 1000) > 6) sinal('Densidade de títulos', '(peça)', `${caps.length} capítulos para ${totalPal} palavras (${(caps.length / (totalPal / 1000)).toFixed(1)} por mil)`);

// ── Relatório ────────────────────────────────────────────────────────────────
const porNome = new Map();
for (const s of sinais) porNome.set(s.nome, (porNome.get(s.nome) || 0) + 1);
const veredito = sinais.length ? 'humanizar' : 'sem sinal';

if (JSON_OUT) {
  console.log(JSON.stringify({ arquivo, capitulos: caps.length, palavras: totalPal, veredito, frasesCurtasEfeito: curtasPeca, paragrafos: totalPars, sinais }, null, 2));
} else {
  console.log(`ritmo — ${path.basename(arquivo)} (${caps.length} capítulo(s), ${totalPal} palavras de prosa própria)\n`);
  if (!sinais.length) console.log('Sem sinal de ritmo mecânico nos medidores. Isso não dispensa a leitura: o medidor pega frequência, não voz.');
  for (const s of sinais) console.log(`⚠ ${s.nome} — ${s.onde}: ${s.detalhe}`);
  console.log(`ℹ Frases curtas abrindo ou fechando parágrafo (≤ 10 palavras, sem número): ${curtasPeca} em ${totalPars} parágrafos. Informativo: a leitura decide quais são sentenciosas (voz-forense §8.1).`);
  console.log(`\n${sinais.length} sinal(is) em ${porNome.size} tipo(s). Diagnóstico para a passada humana; nada aqui reprova.` +
    (sinais.length ? ' Estágio 5: humanização recomendada.' : ' Estágio 5: análise registrada, alteração dispensável.'));
}
process.exit(0);

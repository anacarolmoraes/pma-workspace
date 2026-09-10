#!/usr/bin/env node
// checar-invariantes — guardião do que a humanização NÃO pode mudar.
//
// O SKILL.md do humanizer-forense declara sete invariantes (transcrições, números,
// dispositivos, julgados, títulos-tese, BLUF, modalidade). Até 08/09/2026 a
// proteção era disciplina: numa réplica real a passada trocou sete títulos-tese
// por rótulos vazios e moveu a conclusão de quatro capítulos; na 1ª banca, uma
// concessão "ainda que" virou afirmativa. Este script compara a peça antes e
// depois da humanização e reprova o que mudou de mérito.
//
// Uso:
//   node checar-invariantes.js --snapshot <peca.md>        grava <PECA>.antes-humanizer.md ao lado
//   node checar-invariantes.js <peca.md>                   compara com o snapshot ao lado
//   node checar-invariantes.js <antes.md> <depois.md>      compara dois arquivos quaisquer
//   --json                                                 saída em JSON (para registro no .validacao.md)
//   --limpar <peca.md>                                     apaga o snapshot
//
// Saída: ✔ preservado · ⚠ aviso (conferir) · ✘ violação. Exit 0 sem violação,
// 1 com violação, 2 uso/arquivo ausente. O snapshot leva na primeira linha um
// comentário HTML que o torna invisível aos hooks de peça (não tem frontmatter na
// linha 1, logo `ehPeca` é falso) e é apagado depois da conferência.
'use strict';

const fs = require('fs');
const path = require('path');
const S = require('./lib/segmentar');

const args = process.argv.slice(2);
const flag = (f) => { const i = args.indexOf(f); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const JSON_OUT = flag('--json');
const SNAPSHOT = flag('--snapshot');
const LIMPAR = flag('--limpar');

const uso = () => {
  console.error('Uso: node checar-invariantes.js [--snapshot|--limpar] <peca.md>  |  node checar-invariantes.js <antes.md> <depois.md> [--json]');
  process.exit(2);
};
if (!args[0]) uso();

const snapshotDe = (p) => p.replace(/\.md$/i, '.antes-humanizer.md');
const MARCA = '<!-- snapshot humanizer-forense: cópia da peça ANTES da humanização; não é peça, não editar; apagar depois de rodar checar-invariantes.js -->\n';

if (SNAPSHOT) {
  const peca = args[0];
  if (!fs.existsSync(peca)) { console.error(`arquivo não encontrado: ${peca}`); process.exit(2); }
  const alvo = snapshotDe(peca);
  fs.writeFileSync(alvo, MARCA + fs.readFileSync(peca, 'utf8'));
  console.log(`snapshot gravado: ${alvo}`);
  process.exit(0);
}
if (LIMPAR) {
  const alvo = snapshotDe(args[0]);
  if (fs.existsSync(alvo)) { fs.unlinkSync(alvo); console.log(`snapshot removido: ${alvo}`); }
  else console.log(`sem snapshot em ${alvo}`);
  process.exit(0);
}

let antesPath;
let depoisPath;
if (args[1]) { [antesPath, depoisPath] = args; }
else { depoisPath = args[0]; antesPath = snapshotDe(depoisPath); }
for (const p of [antesPath, depoisPath]) {
  if (!fs.existsSync(p)) {
    console.error(`arquivo não encontrado: ${p}` + (p === antesPath && !args[1] ? '\nGrave o snapshot ANTES de humanizar: node checar-invariantes.js --snapshot <peca.md>' : ''));
    process.exit(2);
  }
}

const A = S.segmentar(fs.readFileSync(antesPath, 'utf8'));
const D = S.segmentar(fs.readFileSync(depoisPath, 'utf8'));

// ── utilitários ──────────────────────────────────────────────────────────────
const resultados = [];
const ok = (nome, detalhe) => resultados.push({ nivel: 'ok', nome, detalhe });
const aviso = (nome, detalhe, amostra = []) => resultados.push({ nivel: 'aviso', nome, detalhe, amostra });
const viol = (nome, detalhe, amostra = []) => resultados.push({ nivel: 'violacao', nome, detalhe, amostra });

const norm = (s) => String(s).toLowerCase().replace(/\*\*|__|\*|_/g, '').replace(/\s+/g, ' ').trim();
const multiset = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); return m; };
function difMultiset(a, b) {
  const ma = multiset(a); const mb = multiset(b);
  const sumiu = []; const surgiu = [];
  for (const [k, n] of ma) { const d = n - (mb.get(k) || 0); for (let i = 0; i < d; i++) sumiu.push(k); }
  for (const [k, n] of mb) { const d = n - (ma.get(k) || 0); for (let i = 0; i < d; i++) surgiu.push(k); }
  return { sumiu, surgiu };
}
const relatar = (nome, dif, bloqueia = true, oQue = 'item') => {
  if (!dif.sumiu.length && !dif.surgiu.length) return ok(nome, 'preservad' + (oQue.endsWith('a') ? 'as' : 'os'));
  const amostra = [...dif.sumiu.map((x) => `sumiu: ${x}`), ...dif.surgiu.map((x) => `surgiu: ${x}`)];
  (bloqueia ? viol : aviso)(nome, `${dif.sumiu.length} ${oQue}(s) sumiu/sumiram, ${dif.surgiu.length} surgiu/surgiram`, amostra);
};

const prosaA = S.prosaArgumentativa(A) + '\n' + A.capitulos.filter((c) => c.preambulo).map(S.prosaDe).join('\n');
const prosaD = S.prosaArgumentativa(D) + '\n' + D.capitulos.filter((c) => c.preambulo).map(S.prosaDe).join('\n');
const capsA = S.capitulosReais(A);
const capsD = S.capitulosReais(D);

// ── 1. Frontmatter e diretivas ───────────────────────────────────────────────
if (A.frontmatter.trim() === D.frontmatter.trim()) ok('Frontmatter', 'idêntico');
else viol('Frontmatter', 'humanização não mexe em frontmatter (título, processo, bundle, documentos)');

const dirA = A.capitulos.flatMap((c) => c.diretivas).map(norm);
const dirD = D.capitulos.flatMap((c) => c.diretivas).map(norm);
relatar('Diretivas (endereço, assinatura, centralizados)', difMultiset(dirA, dirD), true, 'diretiva');

// ── 2. Transcrições ──────────────────────────────────────────────────────────
const citA = A.capitulos.flatMap((c) => c.citacoes).map(norm);
const citD = D.capitulos.flatMap((c) => c.citacoes).map(norm);
const difCit = difMultiset(citA, citD);
if (!difCit.sumiu.length && !difCit.surgiu.length) ok('Transcrições (blockquote)', `${citA.length} preservada(s), inclusive travessões e erros do original`);
else viol('Transcrições (blockquote)', `${difCit.sumiu.length} alterada(s)/removida(s), ${difCit.surgiu.length} nova(s)`, [...difCit.sumiu.map((x) => `antes: ${x.slice(0, 80)}…`), ...difCit.surgiu.map((x) => `depois: ${x.slice(0, 80)}…`)]);

// ── 3. Números, valores e datas ──────────────────────────────────────────────
const RX_VALOR = /R\$\s?[\d.]+(?:,\d{2})?/g;
const RX_PCT = /\d+(?:[.,]\d+)?\s?%/g;
const RX_DATA = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/gi;
const RX_PROCESSO = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
const pega = (t, rx) => (t.match(rx) || []).map((x) => x.replace(/\s+/g, ' '));
relatar('Valores em R$', difMultiset(pega(prosaA, RX_VALOR), pega(prosaD, RX_VALOR)), true, 'valor');
relatar('Percentuais', difMultiset(pega(prosaA, RX_PCT), pega(prosaD, RX_PCT)), true, 'percentual');
relatar('Datas', difMultiset(pega(prosaA, RX_DATA).map((x) => x.toLowerCase()), pega(prosaD, RX_DATA).map((x) => x.toLowerCase())), true, 'data');
relatar('Números de processo', difMultiset(pega(prosaA, RX_PROCESSO), pega(prosaD, RX_PROCESSO)), true, 'número');
// Demais números (anos, quantidades, folhas): sem R$, %, data ou processo.
const limpaNum = (t) => t.replace(RX_VALOR, ' ').replace(RX_PCT, ' ').replace(RX_DATA, ' ').replace(RX_PROCESSO, ' ');
const RX_NUM = /\b\d+(?:[.,]\d+)*\b/g;
relatar('Demais números (anos, quantidades, folhas, cláusulas)', difMultiset(pega(limpaNum(prosaA), RX_NUM), pega(limpaNum(prosaD), RX_NUM)), true, 'número');

// ── 4. Dispositivos legais ───────────────────────────────────────────────────
// Captura "art. 51, II e IV e § 1º, II e III" como um bloco, até o primeiro
// token que não seja inciso, parágrafo, alínea ou conectivo.
const RX_ART = /\bart(?:s|igos?)?\.?\s*\d+(?:\.\d+)*(?:-[A-Z])?(?:[ºo°])?(?:\s*(?:,|e|c\/c|ou)?\s*(?:§+\s*\d+[ºo°]?|caput|par[áa]grafo\s+único|incisos?\s*[IVXLC]+|al[íi]neas?\s*["“”']?[a-z]["“”']?|[IVXLC]+\b(?![a-zà-ú])))*/g;
const normArt = (x) => x.toLowerCase().replace(/artigos?/, 'art.').replace(/arts\./, 'art.').replace(/\s+/g, ' ').replace(/[,]\s*$/, '').trim();
relatar('Dispositivos (art., §, inciso, alínea)', difMultiset(pega(prosaA, RX_ART).map(normArt), pega(prosaD, RX_ART).map(normArt)), true, 'dispositivo');
const RX_LEI = /\b(?:Lei|Decreto|Súmula(?:\s+Vinculante)?|Tema|IRDR|IAC|ADI|ADC|ADPF|RE|REsp|AREsp|AgInt|AgRg|EDcl|EREsp|HC|RHC|MS|Rcl|AI|AgI|Ap(?:elação)?)\s*(?:n[.º°o]?\s*)?[\d][\d./-]*(?:\/[A-Z]{2})?/g;
relatar('Precedentes, leis, súmulas e temas', difMultiset(pega(prosaA, RX_LEI).map(norm), pega(prosaD, RX_LEI).map(norm)), true, 'referência');

// ── 5. Partes e identificação ────────────────────────────────────────────────
const RX_CAIXA_ALTA = /\b[A-ZÁ-Ú][A-ZÁ-Ú]+(?:\s+(?:D[AEO]S?\s+)?[A-ZÁ-Ú][A-ZÁ-Ú]+)+\b/g;
relatar('Nomes em caixa alta (partes)', difMultiset(pega(prosaA, RX_CAIXA_ALTA), pega(prosaD, RX_CAIXA_ALTA)), true, 'nome');

// ── 6. Títulos e ordem dos capítulos ─────────────────────────────────────────
if (capsA.length !== capsD.length) {
  viol('Capítulos', `${capsA.length} antes, ${capsD.length} depois — humanização não cria nem funde capítulo`);
} else {
  const RX_VERBO = /\b(é|são|está|estão|foi|foram|era|eram|não|nem|deve|devem|pode|podem|cabe|há|tem|têm|corre|correm|incide|incidem|prevalece|afasta|impõe|configura|comprova|confessa|nega|reconhece|viola|contraria|autoriza|veda|exige|impede|permanece|subsiste|decorre|recai|responde|descabe|inexiste|prescreve|preclu\w+|\w+(?:ou|iu|am|em|eu|ram|aram|eram|iram|ará|erá|irá|ia|iam))\b/i;
  const eTese = (t) => {
    const limpo = t.replace(/^[IVXLC]+\.\s*/, '').replace(/^\d+(\.\d+)*\.?\s*/, '');
    return RX_VERBO.test(limpo) || limpo.split(/\s+/).length > 6;
  };
  const trocados = [];
  const despidos = [];
  capsA.forEach((c, i) => {
    const d = capsD[i];
    if (norm(c.titulo) === norm(d.titulo)) return;
    trocados.push(`"${c.titulo.slice(0, 60)}" → "${d.titulo.slice(0, 60)}"`);
    if (eTese(c.titulo) && !eTese(d.titulo)) despidos.push(`"${c.titulo.slice(0, 60)}" → "${d.titulo.slice(0, 60)}"`);
  });
  if (despidos.length) viol('Títulos-tese despidos (viraram rótulo)', `${despidos.length} título(s) deixou/deixaram de enunciar a conclusão (invariante 6)`, despidos);
  else if (trocados.length) aviso('Títulos reformulados', `${trocados.length} título(s) mudou/mudaram de redação; confira se ainda enunciam a tese`, trocados);
  else ok('Títulos e ordem dos capítulos', `${capsA.length} capítulo(s), mesma ordem e redação`);

  // BLUF: a conclusão que abria o capítulo não pode descer.
  const movidos = [];
  const chave = (p) => new Set(S.palavras(norm(p)).filter((w) => w.length > 4));
  const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
  capsA.forEach((c, i) => {
    const d = capsD[i];
    if (!c.paragrafos.length || !d.paragrafos.length) return;
    const abertura = chave(c.paragrafos[0]);
    if (abertura.size < 6) return;
    let melhor = -1; let onde = -1;
    d.paragrafos.forEach((p, j) => { const s = jaccard(abertura, chave(p)); if (s > melhor) { melhor = s; onde = j; } });
    if (melhor >= 0.45 && onde >= 2) movidos.push(`"${c.titulo.slice(0, 50)}": abertura desceu para o ${onde + 1}º parágrafo`);
  });
  if (movidos.length) viol('BLUF (conclusão nas primeiras linhas)', `${movidos.length} capítulo(s) com a conclusão movida para baixo (lição de 2026-08-04)`, movidos);
  else ok('BLUF (conclusão nas primeiras linhas)', 'abertura de cada capítulo preservada');
}

// ── 7. Modalidade (concessão, hipótese, subsidiariedade) ─────────────────────
const MODAIS = ['ainda que', 'mesmo que', 'mesmo se', 'caso ', 'acaso', 'se ', 'subsidiariamente', 'eventualmente', 'ad argumentandum', 'por hipótese', 'admitindo-se', 'admita-se', 'supondo', 'na hipótese de', 'na remota hipótese', 'em tese', 'quando muito', 'sucessivamente', 'alternativamente'];
const contaModais = (t) => { const s = ' ' + norm(t) + ' '; const m = {}; for (const w of MODAIS) { const n = (s.match(new RegExp(`[\\s,;(]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length; if (n) m[w.trim()] = n; } return m; };
const modA = contaModais(prosaA); const modD = contaModais(prosaD);
const perdidos = []; const ganhos = [];
for (const k of new Set([...Object.keys(modA), ...Object.keys(modD)])) {
  const a = modA[k] || 0; const d = modD[k] || 0;
  if (d < a) perdidos.push(`"${k}": ${a} → ${d}`);
  if (d > a) ganhos.push(`"${k}": ${a} → ${d}`);
}
if (perdidos.length) viol('Modalidade (concessão/hipótese)', 'marcador condicional sumiu — hipótese pode ter virado afirmação (invariante 7)', perdidos);
else if (ganhos.length) aviso('Modalidade (concessão/hipótese)', 'marcador condicional novo; confira se afirmação não virou hipótese', ganhos);
else ok('Modalidade (concessão/hipótese)', 'marcadores preservados');

// ── 8. Negações: polaridade de frase parecida não pode inverter ──────────────
const RX_NEG = /\b(não|nem|nunca|jamais|tampouco|sem|inexist\w*|descab\w*|impossib\w*|inaplic\w*|ileg\w*|inválid\w*|indevid\w*)\b/gi;
const frasesA = S.frases(prosaA); const frasesD = S.frases(prosaD);
const ehNeg = (w) => { RX_NEG.lastIndex = 0; return RX_NEG.test(w); };
const nNeg = (f) => (f.match(RX_NEG) || []).length;
const setD = frasesD.map((f) => ({ f, k: new Set(S.palavras(norm(f)).filter((w) => w.length > 3 && !ehNeg(w))) }));
const invertidas = [];
for (const fa of frasesA) {
  const ka = new Set(S.palavras(norm(fa)).filter((w) => w.length > 3 && !ehNeg(w)));
  if (ka.size < 6) continue;
  let melhor = null; let sim = 0;
  for (const c of setD) { let i = 0; for (const x of ka) if (c.k.has(x)) i++; const j = i / (ka.size + c.k.size - i || 1); if (j > sim) { sim = j; melhor = c.f; } }
  if (melhor && sim >= 0.6 && norm(fa) !== norm(melhor) && nNeg(fa) !== nNeg(melhor)) invertidas.push(`"${fa.slice(0, 70)}…" ⇄ "${melhor.slice(0, 70)}…"`);
}
if (invertidas.length) viol('Negações (polaridade)', `${invertidas.length} frase(s) parecida(s) com número diferente de negações (não, nem, sem, tampouco…)`, invertidas);
else ok('Negações (polaridade)', 'nenhuma frase parecida trocou de polaridade');

// ── 9. Pedidos ───────────────────────────────────────────────────────────────
const RX_CAP_PEDIDO = /pedido|requer|requerimento|conclus/i;
const pedA = capsA.filter((c) => RX_CAP_PEDIDO.test(c.titulo)).map(S.prosaDe).join('\n');
const pedD = capsD.filter((c) => RX_CAP_PEDIDO.test(c.titulo)).map(S.prosaDe).join('\n');
if (pedA || pedD) {
  const RX_VERBO_PEDIDO = /\b(conden\w+|declar\w+|reconhe\w+|determin\w+|defer\w+|conced\w+|fix\w+|julg\w+|arbitr\w+|restitu\w+|anul\w+|rescind\w+|resolv\w+|revog\w+|cass\w+|reform\w+|prov\w+|conhec\w+|receb\w+|cit\w+|intim\w+|ofici\w+|expe\w+|suspend\w+|absolv\w+|improced\w+|proced\w+|extin\w+|homolog\w+|invert\w+|produ\w+|design\w+|dispens\w+|invert\w+)\b/gi;
  const verbos = (t) => (t.match(RX_VERBO_PEDIDO) || []).map((v) => v.toLowerCase().replace(/(ar|er|ir|ando|endo|indo|ado|ido|ada|ida|e|a|em|am|se|do|da|dos|das|ção|ções|mento|mentos)$/, '').slice(0, 6));
  relatar('Pedidos (verbos do capítulo de pedidos)', difMultiset(verbos(pedA), verbos(pedD)), true, 'verbo');
  const itens = (t) => (t.match(/(?:^|\n)\s*(?:\(?[a-z]\)|[a-z]\.|\(?[ivx]+\)|\d+[.)])\s/gi) || []).length;
  if (itens(pedA) !== itens(pedD)) viol('Pedidos (itens enumerados)', `${itens(pedA)} item(ns) antes, ${itens(pedD)} depois`);
  else ok('Pedidos (itens enumerados)', `${itens(pedA)} item(ns)`);
} else aviso('Pedidos', 'nenhum capítulo com "pedido"/"requer" no título; conferência de pedidos não se aplicou');

// ── 10. Extensão ─────────────────────────────────────────────────────────────
const nA = S.contarPalavras(prosaA); const nD = S.contarPalavras(prosaD);
const delta = nA ? ((nD - nA) / nA) * 100 : 0;
if (Math.abs(delta) > 20) aviso('Extensão da prosa própria', `${nA} → ${nD} palavras (${delta > 0 ? '+' : ''}${delta.toFixed(0)}%): humanização não deveria mudar tanto o tamanho`);
else ok('Extensão da prosa própria', `${nA} → ${nD} palavras (${delta > 0 ? '+' : ''}${delta.toFixed(0)}%)`);

// ── Relatório ────────────────────────────────────────────────────────────────
const violacoes = resultados.filter((r) => r.nivel === 'violacao');
const avisos = resultados.filter((r) => r.nivel === 'aviso');
const invariantes = violacoes.length ? 'violados' : avisos.length ? 'preservados com avisos' : 'preservados';

if (JSON_OUT) {
  console.log(JSON.stringify({ antes: antesPath, depois: depoisPath, invariantes, violacoes: violacoes.length, avisos: avisos.length, resultados }, null, 2));
} else {
  console.log(`checar-invariantes — ${path.basename(antesPath)} → ${path.basename(depoisPath)}\n`);
  for (const r of resultados) {
    const st = r.nivel === 'ok' ? '✔' : r.nivel === 'aviso' ? '⚠' : '✘';
    console.log(`${st} ${r.nome}: ${r.detalhe}`);
    for (const a of (r.amostra || []).slice(0, 8)) console.log(`    · ${a}`);
    if ((r.amostra || []).length > 8) console.log(`    · … e mais ${r.amostra.length - 8}`);
  }
  console.log(
    violacoes.length
      ? `\n${violacoes.length} invariante(s) violado(s) — desfazer a alteração de mérito (ou justificar à titular) antes de revalidar.`
      : `\nInvariantes ${invariantes}.` + (avisos.length ? ' Conferir os avisos na passada humana.' : ''),
  );
}
process.exit(violacoes.length ? 1 : 0);

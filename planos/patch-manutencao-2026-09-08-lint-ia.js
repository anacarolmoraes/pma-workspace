// Patch de manutenção — três correções no lint-ia.js (protegido pelo protect-gates).
// Origem: análise de 08/09/2026 das sugestões em sugestoes_chatgpt.md, confirmadas
// em fixture (hooks/_teste-lint-ia.js reproduz os três casos):
//   1. Título-tese curto ("A pretensão está prescrita", 4 palavras) recebia o aviso
//      de "título sem conclusão"; título com verbo finito passa a ficar fora do aviso.
//   2. O preâmbulo (qualificação, endereçamento) ficava fora da contagem por capítulo
//      mas ENTRAVA nas contagens globais (pergunta retórica, registro inflado, tríade,
//      verbo-fórmula, frases-clone): "?" na qualificação reprovava a peça. Passam a
//      medir só a prosa argumentativa (com fallback para a prosa toda quando a peça
//      não tem capítulos).
//   3. A tabela do SKILL.md declara "não é X, é Y" como paralelismo negativo; a regex
//      só cobria "— e não" e "não em … —". A forma "não é X, é Y" passa a contar.
// Rodar em sessão com PMA_MANUTENCAO=1:
//   node planos/patch-manutencao-2026-09-08-lint-ia.js --check   # só confere ancoragens
//   node planos/patch-manutencao-2026-09-08-lint-ia.js           # aplica
// Depois: npm test (hooks/_teste-lint-ia.js passa a exigir os três casos).
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(process.env.PMA_PATCH_RAIZ || path.join(__dirname, '..'));
const CHECK = process.argv.includes('--check');

const rw = (rel, fn) => {
  const p = path.join(RAIZ, rel);
  const antes = fs.readFileSync(p, 'utf8');
  const depois = fn(antes);
  if (depois === antes) throw new Error(`sem alteração em ${rel}: ancoragem não encontrada ou já aplicado`);
  if (!CHECK) fs.writeFileSync(p, depois);
  console.log(`${CHECK ? 'ok     ' : 'patched'} ${rel}`);
};
const exige = (t, trecho, rel) => { if (!t.includes(trecho)) throw new Error(`ancoragem ausente em ${rel}: ${trecho.slice(0, 70)}…`); };
const troca = (t, de, para, rel) => { exige(t, de, rel); return t.split(de).join(para); };

rw('skills/humanizer-forense/scripts/lint-ia.js', (t) => {
  const rel = 'lint-ia.js';
  if (/lint-ia v1\.2/.test(t)) throw new Error('já aplicado (marcador lint-ia v1.2 presente)');
  let s = t;

  // marcador de versão (o teste o detecta)
  s = troca(s, '// Saída: relatório + exit 0 (passou) / 1 (falhou) / 2 (uso).',
    '// Saída: relatório + exit 0 (passou) / 1 (falhou) / 2 (uso).\n// lint-ia v1.2 (manutenção 2026-09-08): título com verbo fora do aviso; contagens\n// globais só na prosa argumentativa; "não é X, é Y" conta como paralelismo negativo.', rel);

  // 2. contagens globais na prosa argumentativa
  s = troca(s, "const prosaArgumentativa = capsReais.map((c) => c.linhas.join('\\n')).join('\\n');",
    "const prosaArgumentativa = capsReais.map((c) => c.linhas.join('\\n')).join('\\n');\n" +
    '// Preâmbulo (endereçamento, qualificação) não é prosa argumentativa: fica fora\n' +
    '// também das contagens globais. Peça sem capítulo (raro) cai na prosa toda.\n' +
    'const prosaLint = prosaArgumentativa.trim() ? prosaArgumentativa : prosa;', rel);
  s = troca(s, 'const contar = (re, alvo = prosa) =>', 'const contar = (re, alvo = prosaLint) =>', rel);
  s = troca(s, 'for (const frase of prosa.split(/(?<=[.!?])\\s+/)) {', 'for (const frase of prosaLint.split(/(?<=[.!?])\\s+/)) {', rel);
  s = troca(s, 'const sentencas = prosa.match(/[A-ZÀ-Ú][^.!?]{40,200}[.]/g) || [];', 'const sentencas = prosaLint.match(/[A-ZÀ-Ú][^.!?]{40,200}[.]/g) || [];', rel);

  // 3. "não é X, é Y"
  s = troca(s, "contar(/[,—(]\\s*e não\\b|\\bnão em\\b.{0,25}—/g), 1,",
    "contar(/[,—(]\\s*e não\\b|\\bnão em\\b.{0,25}—|(?<![\\wÀ-ÿ])não (?:é|são|era|foi|se trata de)(?![\\wÀ-ÿ])[^.;:]{2,60}?,\\s*(?:é|são|era|foi|trata-se de|mas)(?![\\wÀ-ÿ])/gi), 1,", rel);

  // 1. título com verbo finito não é rótulo vazio
  s = troca(s, "const TITULOS_CONVENCIONAIS = /^(d[oa]s?\\s+)?(pedidos?|requerimentos?|fatos?|s[íi]ntese.*|prelimin(ar|ares)|tempestividade|conclus[ãa]o)$/i;",
    "const TITULOS_CONVENCIONAIS = /^(d[oa]s?\\s+)?(pedidos?|requerimentos?|fatos?|s[íi]ntese.*|prelimin(ar|ares)|tempestividade|conclus[ãa]o)$/i;\n" +
    '// Título curto COM verbo finito já enuncia tese ("A pretensão está prescrita"): fora do aviso.\n' +
    "const RX_VERBO_TITULO = /(?<![\\wÀ-ÿ])(é|são|está|estão|foi|foram|era|eram|não|nem|deve|devem|pode|podem|cabe|cabem|há|tem|têm|corre|correm|incide|incidem|prevalece|subsiste|decorre|configura|viola|inexiste|descabe|prescreve|preclui|precluiu|[\\wÀ-ÿ]+(?:ou|iu|ram|aram|eram|iram|ará|erá|irá)|[\\wÀ-ÿ]+-se)(?![\\wÀ-ÿ])/i;", rel);
  s = troca(s, '.filter((t) => t && t.split(/\\s+/).length <= 4 && !TITULOS_CONVENCIONAIS.test(t));',
    '.filter((t) => t && t.split(/\\s+/).length <= 4 && !TITULOS_CONVENCIONAIS.test(t) && !RX_VERBO_TITULO.test(t));', rel);
  return s;
});

console.log(CHECK ? '\nancoragens OK — rode sem --check em sessão com PMA_MANUTENCAO=1.' : '\naplicado. Agora: npm test');

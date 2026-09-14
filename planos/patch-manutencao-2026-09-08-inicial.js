// Patch de manutenção — portões da petição inicial (sugestões 4, 5 e 11 de
// sugestoes_peticao_inicial.md, 08/09/2026). Toca quatro arquivos protegidos pelo
// protect-gates, por isso só roda em sessão com PMA_MANUTENCAO=1:
//
//   1. md2docx.js — exigirRastro passa a exigir <PECA>.estrutura.md com `aprovada: sim`
//      ao lado da peça (Estágio 0.5 do legal-orchestrator). Peça de template declara
//      `estrutura: template` no frontmatter e passa. Zero estruturas em clientes/ desde
//      04/09 é o sinal "estágio pulado" que o próprio orchestrator fixou como gatilho.
//   2. lint-inicial.js v2 — três bloqueios novos: (10) um só valor da causa na peça;
//      (11) `Doc. N` citado exige rol `documentos:` no frontmatter (CPC 320; checar-docs);
//      (12) "correção monetária pela Selic" não passa. Quatro AVISOS que não bloqueiam:
//      intimação exclusiva do art. 272 §5º; tutela sem número (R$, prazo, data) no
//      capítulo; pedidos sem alíneas; gratuidade sem renda ou prova (forma A/B, §2).
//   3. hooks/_teste-f5.js — quatro casos novos do lint-inicial v2.
//   4. hooks/_teste-rastro.js — estrutura ausente barra, não aprovada barra, template passa.
//   + skills/legal-orchestrator/SKILL.md (não protegido, mas muda junto): a linha
//     "Sem hook por enquanto" da estrutura vira "portão no md2docx".
//
// Rodar em sessão com PMA_MANUTENCAO=1:
//   node planos/patch-manutencao-2026-09-08-inicial.js --check   # só confere ancoragens
//   node planos/patch-manutencao-2026-09-08-inicial.js           # aplica
// Depois: npm test.
//
// Ensaio sem manutenção (o que foi feito em 08/09): copiar hooks/ e skills/peca-pma-builder/
// para uma pasta X, PMA_PATCH_RAIZ=X node planos/patch-... ; depois
// node X/hooks/_teste-f5.js e node X/hooks/_teste-rastro.js.
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(process.env.PMA_PATCH_RAIZ || path.join(__dirname, '..'));
const CHECK = process.argv.includes('--check');

const rw = (rel, fn, opcional = false) => {
  const p = path.join(RAIZ, rel);
  if (!fs.existsSync(p)) {
    if (opcional) { console.log(`pulado  ${rel} (ausente na raiz do patch)`); return; }
    throw new Error(`arquivo ausente: ${rel}`);
  }
  const antes = fs.readFileSync(p, 'utf8');
  const depois = fn(antes);
  if (depois === antes) throw new Error(`sem alteração em ${rel}: ancoragem não encontrada ou já aplicado`);
  if (!CHECK) fs.writeFileSync(p, depois);
  console.log(`${CHECK ? 'ok     ' : 'patched'} ${rel}`);
};
const exige = (t, trecho, rel) => { if (!t.includes(trecho)) throw new Error(`ancoragem ausente em ${rel}: ${trecho.slice(0, 80)}…`); };
const troca = (t, de, para, rel) => { exige(t, de, rel); return t.split(de).join(para); };

// ── 1. md2docx: estrutura aprovada no rastro ──────────────────────────────────
rw('skills/peca-pma-builder/scripts/md2docx.js', (t) => {
  const rel = 'md2docx.js';
  if (/estrutura aprovada \(Estágio 0\.5/i.test(t)) throw new Error('já aplicado (md2docx exige estrutura)');
  let s = t;
  s = troca(s,
    "  if (!problemas.length) {\n    console.log('md2docx: rastro OK (pipeline, bundle, veredito do validator)');",
    `  // Estrutura aprovada (Estágio 0.5, portão desde 2026-09-08): a arquitetura da peça
  // é decidida e aprovada pela titular ANTES da prosa, em <PECA>.estrutura.md com
  // \`aprovada: sim\`. Peça gerada de template (inicial-rescisao-lote, golpe) declara
  // \`estrutura: template\` no frontmatter: o playbook dispensa o portão humano nela.
  if (!/^template$/i.test(String(meta.estrutura || '').trim())) {
    const est = mdPath.replace(/\\.md$/i, '.estrutura.md');
    const nomeEst = path.basename(est);
    if (mtime(est) === null) {
      problemas.push(\`sem \${nomeEst} — Estágio 0.5: grave a estrutura da peça ao lado dela e obtenha \\\`aprovada: sim\\\` da titular antes da prosa (peça de template declara \\\`estrutura: template\\\`).\`);
    } else {
      let te = '';
      try { te = fs.readFileSync(est, 'utf8'); } catch { /* tratado como não aprovada */ }
      const ap = String(frontmatter(te).aprovada || '').trim();
      if (!/^(sim|s|yes|true)$/i.test(ap)) problemas.push(\`\${nomeEst} sem \\\`aprovada: sim\\\` (está: "\${ap || 'ausente'}") — a titular aprova a arquitetura antes da prosa.\`);
    }
  }

  if (!problemas.length) {
    console.log('md2docx: rastro OK (pipeline, bundle, estrutura aprovada, veredito do validator)');`,
    rel);
  s = troca(s,
    "console.error('\\nO ciclo é: legal-orchestrator (Estágios 0–6) → veredito gravado → pipeline: declarado → md2docx.\\n');",
    "console.error('\\nO ciclo é: legal-orchestrator (Estágio 0 → 0.5 com estrutura aprovada → 1–6) → veredito gravado → pipeline: declarado → md2docx.\\n');",
    rel);
  s = troca(s,
    '// (2026-09-04 — `pipeline:`, `bundle:` e <PECA>.validacao.md com veredito mais',
    '// (2026-09-04 — `pipeline:`, `bundle:` e <PECA>.validacao.md com veredito mais\n// novo que a peça; 2026-09-08 — <PECA>.estrutura.md com `aprovada: sim`, salvo\n// `estrutura: template`; e', rel);
  return s;
});

// ── 2. lint-inicial v2 ────────────────────────────────────────────────────────
rw('skills/peca-pma-builder/scripts/lint-inicial.js', (t) => {
  const rel = 'lint-inicial.js';
  if (/lint-inicial v2/.test(t)) throw new Error('já aplicado (marcador lint-inicial v2 presente)');
  let s = t;
  s = troca(s,
    '//   9. se pede gratuidade, cita o art. 98 ou 99 do CPC (definicoes §2)\n',
    `//   9. se pede gratuidade, cita o art. 98 ou 99 do CPC (definicoes §2)
//  v2 (2026-09-08), bloqueios:
//  10. um só valor da causa na peça (o número do 292 aparece igual em toda menção)
//  11. \`Doc. N\` citado exige rol \`documentos:\` no frontmatter (CPC 320; checar-docs.js)
//  12. sem "correção monetária pela Selic" (Selic é base da taxa legal de juros, CC 406;
//      correção é IPCA, CC 389, p.ú.)
//  v2, AVISOS (imprimem ⚠ e não bloqueiam — indício para revisão humana):
//   A. intimação exclusiva em nome da subscritora (CPC 272, § 5º)
//   B. capítulo de tutela com número (R$, prazo, data): perigo descrito, não só citado
//   C. pedidos em alíneas
//   D. gratuidade indica renda ou prova (forma A ou B pela faixa da ADC 80, definicoes §2)
`, rel);
  s = troca(s,
    "let falhas = 0;\nfor (const x of testes) {",
    `// ── lint-inicial v2 (2026-09-08) ─────────────────────────────────────────────
const avisos = [];
const av = (nome, ok, dica) => avisos.push({ nome, ok, dica });
const reais = (s) => { const out = []; const rx = /R\\$\\s?([\\d.]+,\\d{2})/g; let m; while ((m = rx.exec(s))) out.push(m[1]); return out; };
const capitulo = (rx) => {
  const i = corpo.findIndex((l) => /^#{1,2}\\s/.test(l) && rx.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < corpo.length && !/^#{1,2}\\s/.test(corpo[j])) j++;
  return corpo.slice(i + 1, j).filter((l) => !l.trim().startsWith('>')).join('\\n');
};

const linhasValor = prosa.split('\\n').filter((l) => /valor da causa|d[áa]-se [àa] causa|atribui(?:-se)? [àa] causa/i.test(l));
const valoresCausa = [...new Set(linhasValor.map((l) => reais(l)[0]).filter(Boolean))];
t('10. Um só valor da causa na peça',
  valoresCausa.length <= 1,
  \`encontrados: \${valoresCausa.map((v) => 'R$ ' + v).join(' · ')} — o número do art. 292 é um só; a ficha numérica é a fonte\`);

const citaDoc = /\\bDocs?\\.\\s*\\d/.test(prosa);
t('11. \`Doc. N\` citado exige rol \`documentos:\` no frontmatter',
  !citaDoc || Object.prototype.hasOwnProperty.call(meta, 'documentos'),
  'CPC 320 — declare \`documentos:\` (n, descricao, arquivo) e rode checar-docs.js');

t('12. Sem "correção monetária pela Selic"',
  !/corre[çc][ãa]o(?: monet[áa]ria)?[^.\\n]{0,40}\\bselic\\b/i.test(prosa),
  'a Selic é a base da taxa legal de juros (CC 406, § 1º), não índice de correção; correção é IPCA (CC 389, p.ú.)');

av('A. Intimação exclusiva em nome da subscritora (art. 272, § 5º)',
  /272/.test(prosa) && /intima[çc]/i.test(prosa), 'requerimentos finais: intimações exclusivamente em nome da advogada subscritora');
const capTutela = capitulo(/tutela/i);
if (capTutela !== null || /art\\.?\\s*30[03]\\b|art\\.?\\s*311\\b/.test(prosa)) {
  const alvo = capTutela !== null ? capTutela : prosa;
  av('B. Tutela descreve o perigo com número (R$, prazo, data)',
    /R\\$\\s?[\\d.]+,\\d{2}|\\d+\\s*(?:dias?|meses|anos?|%)|\\d{2}\\/\\d{2}\\/\\d{4}/i.test(alvo),
    'citar o art. 300 sem descrever o fato é o que faz a tutela ser indeferida de plano (checklist de saída)');
}
const capPedidos = capitulo(/Dos pedidos/i);
if (capPedidos !== null) {
  av('C. Pedidos em alíneas', /(^|\\n)\\s*(?:\\*\\*)?[a-z]\\)/.test(capPedidos), 'alíneas a), b), c)… na ordem do playbook (preliminares · tutela · citação · mérito · subsidiários · ônus · exibição · custas)');
}
if (/gratuidade/i.test(prosa)) {
  const capGrat = capitulo(/gratuidade|justi[çc]a gratuita|hipossufici/i) || prosa;
  av('D. Gratuidade indica a renda ou a prova (forma A ou B, definicoes §2)',
    /R\\$\\s?[\\d.]+,\\d{2}|renda|rendimento|sal[áa]rio|contracheque|DIRPF|imposto de renda|declara[çc][ãa]o/i.test(capGrat),
    'pós-ADC 80: faixa de R$ 5.000,00 decide a forma; pedido_justica_gratuita, Passo 0');
}

let falhas = 0;
for (const x of testes) {`, rel);
  s = troca(s,
    "if (falhas) {\n  console.error(",
    "for (const x of avisos) {\n  if (!x.ok) console.log(`⚠ ${x.nome} — ${x.dica} (aviso, não bloqueia)`);\n}\nif (falhas) {\n  console.error(", rel);
  return s;
});

// ── 3. _teste-f5: casos do lint-inicial v2 ───────────────────────────────────
rw('hooks/_teste-f5.js', (t) => {
  const rel = '_teste-f5.js';
  if (/inicialSelic/.test(t)) throw new Error('já aplicado (_teste-f5 tem inicialSelic)');
  let s = t;
  s = troca(s,
    "const comSic = fm() + '# I. Tese\\n\\nA ré escreveu \"recebemos o valor [sic] integral\".\\n';\n",
    `const comSic = fm() + '# I. Tese\\n\\nA ré escreveu "recebemos o valor [sic] integral".\\n';
// lint-inicial v2 (2026-09-08)
const inicialSelic = inicialOk.replace('Dá-se à causa', 'Os valores sofrerão correção monetária pela taxa Selic desde o desembolso. Dá-se à causa');
const inicialDoisValores = inicialOk.replace('# II. Dos fatos\\n\\nTexto.', '# II. Dos fatos\\n\\nO valor da causa de R$ 12.000,00 reflete o pedido.');
const inicialDocSemRol = inicialOk.replace('# II. Dos fatos\\n\\nTexto.', '# II. Dos fatos\\n\\nO contrato (Doc. 2) prova o pagamento.');
const inicialDocComRol = fm('tipo: inicial\\ndocumentos:\\n  - n: 2\\n    descricao: contrato\\n') + inicialDocSemRol.slice(inicialDocSemRol.indexOf('<!--'));
`, rel);
  s = troca(s,
    "const fComSic = w('com-sic.md', comSic);\n",
    `const fComSic = w('com-sic.md', comSic);
const fInicialSelic = w('inicial-selic.md', inicialSelic);
const fInicialDoisValores = w('inicial-dois-valores.md', inicialDoisValores);
const fInicialDocSemRol = w('inicial-doc-sem-rol.md', inicialDocSemRol);
const fInicialDocComRol = w('inicial-doc-com-rol.md', inicialDocComRol);
`, rel);
  s = troca(s,
    "  ['lint-inicial', 0, 'sem tipo: → nada a conferir', () => rodarLint('lint-inicial.js', fSemTipo)],\n",
    `  ['lint-inicial', 0, 'sem tipo: → nada a conferir', () => rodarLint('lint-inicial.js', fSemTipo)],
  ['lint-inicial', 1, 'v2: "correção monetária pela Selic" reprova', () => rodarLint('lint-inicial.js', fInicialSelic)],
  ['lint-inicial', 1, 'v2: dois valores da causa divergentes reprovam', () => rodarLint('lint-inicial.js', fInicialDoisValores)],
  ['lint-inicial', 1, 'v2: Doc. N citado sem rol documentos: reprova', () => rodarLint('lint-inicial.js', fInicialDocSemRol)],
  ['lint-inicial', 0, 'v2: Doc. N citado com rol documentos: passa', () => rodarLint('lint-inicial.js', fInicialDocComRol)],
`, rel);
  return s;
});

// ── 4. _teste-rastro: estrutura aprovada ──────────────────────────────────────
rw('hooks/_teste-rastro.js', (t) => {
  const rel = '_teste-rastro.js';
  if (/ok\.estrutura\.md/.test(t)) throw new Error('já aplicado (_teste-rastro tem ok.estrutura.md)');
  let s = t;
  s = troca(s,
    "const pOk = escrever('ok.md', fm(completo));\nescrever('ok.validacao.md', vered('APROVADO COM RESSALVAS'), depois);\n",
    `const estr = (ap) => \`---\\npeca: X.md\\naprovada: \${ap}\\nbundle: direito/imobiliario\\n---\\n\\n## Destaque\\nX\\n\`;
const pOk = escrever('ok.md', fm(completo));
escrever('ok.validacao.md', vered('APROVADO COM RESSALVAS'), depois);
escrever('ok.estrutura.md', estr('sim'));
// estrutura aprovada (2026-09-08)
const pSemEstrutura = escrever('sem-estrutura.md', fm(completo));
escrever('sem-estrutura.validacao.md', vered('APROVADO'), depois);
const pEstruturaNao = escrever('estrutura-nao.md', fm(completo));
escrever('estrutura-nao.validacao.md', vered('APROVADO'), depois);
escrever('estrutura-nao.estrutura.md', estr('não'));
const pTemplate = escrever('template.md', fm(completo + 'estrutura: template\\n'));
escrever('template.validacao.md', vered('APROVADO'), depois);
`, rel);
  s = troca(s,
    "  [P, 'pipeline + bundle + veredito novo', pOk],\n",
    `  [P, 'pipeline + bundle + veredito novo + estrutura aprovada', pOk],
  [B, 'sem <PECA>.estrutura.md', pSemEstrutura],
  [B, 'estrutura com aprovada: não', pEstruturaNao],
  [P, 'estrutura: template no frontmatter dispensa o arquivo', pTemplate],
`, rel);
  return s;
});

// ── + orchestrator: a linha da tabela de rastro ───────────────────────────────
rw('skills/legal-orchestrator/SKILL.md', (t) => {
  const rel = 'legal-orchestrator/SKILL.md';
  return troca(t,
    'Estágio 3 (aderência) e Estágio 6. Sem hook por enquanto: entra no `md2docx` se, em uso, o estágio se mostrar pulado |',
    'Estágio 3 (aderência), Estágio 6 e o `md2docx`, que desde 08/09/2026 recusa compilar sem o arquivo com `aprovada: sim` (peça de template declara `estrutura: template` no frontmatter e passa) |',
    rel);
}, true);

console.log(CHECK ? '\nAncoragens OK. Rode sem --check em sessão PMA_MANUTENCAO=1 para aplicar.' : '\nAplicado. Rode: npm test');

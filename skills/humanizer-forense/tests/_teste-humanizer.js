#!/usr/bin/env node
// Teste do guardião de invariantes e do diagnóstico de ritmo (08/09/2026).
//   node skills/humanizer-forense/tests/_teste-humanizer.js     (roda no `npm test`)
// Saída: 0 = todos os casos com o comportamento esperado.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPTS = path.resolve(__dirname, '..', 'scripts');
const INV = path.join(SCRIPTS, 'checar-invariantes.js');
const RITMO = path.join(SCRIPTS, 'ritmo.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-humanizer-'));

const rodar = (script, args) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const grava = (nome, texto) => { const p = path.join(tmp, nome); fs.writeFileSync(p, texto); return p; };

// ── fixture base: peça fictícia no dialeto PMA ──────────────────────────────
const BASE = `---
titulo: Réplica fictícia
processo: 0000000-00.0000.8.27.2729
bundle: nenhum
---

::endereco
AO JUÍZO DA 1ª VARA CÍVEL DA COMARCA DE PALMAS
::

**FULANO DE TAL**, já qualificado, vem apresentar réplica.

# I. A contestação não impugna o pagamento de R$ 4.656,08

A requerida não nega a existência do contrato, tampouco os pagamentos que dele decorreram, e afirma expressamente que não resistiu à rescisão, de maneira que a controvérsia se reduz ao quanto deve ser devolvido ao consumidor. O contrato foi firmado em 10/12/2013 e prevê sinal de R$ 1.339,90 mais 180 parcelas, conforme a cláusula 3ª do instrumento.

Ainda que se admitisse a retenção pretendida, ela não poderia ultrapassar 25% do valor pago, na forma do art. 413 do Código Civil e da Súmula 543 do STJ. A tese contrária foi rejeitada no REsp 1.300.418/SC (Tema 577).

A sentença de origem assentou que:

> A retenção de 10% sobre o valor atualizado do contrato — prevista na Lei 13.786/2018 — aplica-se somente aos contratos firmados a partir de 28/12/2018.

Não há, portanto, controvérsia sobre o valor pago.

# II. Os juros correm da citação

Os juros de mora incidem desde a citação, nos termos do art. 405 do Código Civil, porque a obrigação é ilíquida até a apuração do que deve ser restituído. A requerida sustenta o trânsito em julgado como termo inicial, mas o precedente que invoca trata de resilição por iniciativa do comprador, hipótese diversa da destes autos.

Subsidiariamente, caso se entenda aplicável o Tema 1.002, requer-se que os juros corram ao menos da data da revenda do lote a terceiro.

# III. Dos pedidos

Requer-se, por isso, que o juízo (a) declare a incontrovérsia do valor pago; (b) condene a requerida a restituir R$ 4.656,08 em parcela única; e (c) fixe os juros desde a citação.

::assinatura
ANA MORAES | OAB/TO 6573
::
`;

const antes = grava('antes.md', BASE);
const casos = [];
const caso = (nome, esperado, fn) => casos.push({ nome, esperado, fn });

// ── checar-invariantes ───────────────────────────────────────────────────────
caso('identidade → 0', 0, () => rodar(INV, [antes, grava('id.md', BASE)]).status);
caso('reescrita benigna (travessão fora, ordem de palavras) → 0', 0, () =>
  rodar(INV, [antes, grava('benigna.md', BASE
    .replace('e afirma expressamente que não resistiu à rescisão, de maneira que', 'e afirma expressamente que não resistiu à rescisão. Por isso')
    .replace('Os juros de mora incidem desde a citação, nos termos do art. 405 do Código Civil, porque', 'Porque a obrigação é ilíquida, os juros de mora incidem desde a citação (art. 405 do Código Civil), já que')
    .replace('porque a obrigação é ilíquida até a apuração', 'até a apuração'))]).status);
caso('título-tese despido → 1 e nomeia o título', 1, () => {
  const r = rodar(INV, [antes, grava('titulo.md', BASE.replace('# II. Os juros correm da citação', '# II. Dos juros de mora'))]);
  return r.status === 1 && /Títulos-tese despidos/.test(r.out) ? 1 : r.status + 10;
});
caso('título reformulado mantendo a tese → 0 com aviso', 0, () => {
  const r = rodar(INV, [antes, grava('titulo2.md', BASE.replace('# II. Os juros correm da citação', '# II. O termo inicial dos juros é a citação'))]);
  return r.status === 0 && /⚠ Títulos reformulados/.test(r.out) ? 0 : r.status + 10;
});
caso('valor em R$ alterado → 1', 1, () => rodar(INV, [antes, grava('valor.md', BASE.replace('R$ 1.339,90', 'R$ 1.399,90'))]).status);
caso('data alterada → 1', 1, () => rodar(INV, [antes, grava('data.md', BASE.replace('10/12/2013', '10/12/2014'))]).status);
caso('dispositivo alterado → 1', 1, () => rodar(INV, [antes, grava('art.md', BASE.replace('art. 413 do Código Civil', 'art. 412 do Código Civil'))]).status);
caso('precedente alterado → 1', 1, () => rodar(INV, [antes, grava('resp.md', BASE.replace('Tema 577', 'Tema 557'))]).status);
caso('transcrição alterada (travessão trocado) → 1', 1, () => rodar(INV, [antes, grava('cit.md', BASE.replace('contrato — prevista na Lei 13.786/2018 — aplica-se', 'contrato, prevista na Lei 13.786/2018, aplica-se'))]).status);
caso('concessão "ainda que" virou afirmação → 1', 1, () => rodar(INV, [antes, grava('modal.md', BASE.replace('Ainda que se admitisse a retenção pretendida, ela', 'A retenção pretendida'))]).status);
caso('"subsidiariamente" removido → 1', 1, () => rodar(INV, [antes, grava('subs.md', BASE.replace('Subsidiariamente, caso se entenda', 'Caso se entenda'))]).status);
caso('negação invertida → 1', 1, () => {
  const r = rodar(INV, [antes, grava('neg.md', BASE.replace('A requerida não nega a existência do contrato', 'A requerida nega a existência do contrato'))]);
  return r.status === 1 && /Negações/.test(r.out) ? 1 : r.status + 10;
});
caso('BLUF movido para o fim do capítulo → 1', 1, () => {
  const p1 = 'A requerida não nega a existência do contrato, tampouco os pagamentos que dele decorreram, e afirma expressamente que não resistiu à rescisão, de maneira que a controvérsia se reduz ao quanto deve ser devolvido ao consumidor. O contrato foi firmado em 10/12/2013 e prevê sinal de R$ 1.339,90 mais 180 parcelas, conforme a cláusula 3ª do instrumento.\n\n';
  const movido = BASE.replace(p1, '').replace('Não há, portanto, controvérsia sobre o valor pago.\n', 'Não há, portanto, controvérsia sobre o valor pago.\n\n' + p1.trim() + '\n');
  const r = rodar(INV, [antes, grava('bluf.md', movido)]);
  return r.status === 1 && /BLUF/.test(r.out) ? 1 : r.status + 10;
});
caso('verbo de pedido trocado (condene → reconheça) → 1', 1, () => rodar(INV, [antes, grava('pedido.md', BASE.replace('(b) condene a requerida a restituir', '(b) reconheça o dever de a requerida restituir'))]).status);
caso('capítulo fundido → 1', 1, () => rodar(INV, [antes, grava('cap.md', BASE.replace('# II. Os juros correm da citação\n', ''))]).status);
caso('frontmatter alterado → 1', 1, () => rodar(INV, [antes, grava('fm.md', BASE.replace('bundle: nenhum', 'bundle: direito/imobiliario'))]).status);
caso('--json sai JSON válido com campo invariantes', 0, () => {
  const r = rodar(INV, [antes, grava('json.md', BASE), '--json']);
  try { const j = JSON.parse(r.out); return j.invariantes === 'preservados' ? 0 : 5; } catch { return 6; }
});
caso('snapshot: grava com comentário na linha 1, compara e limpa', 0, () => {
  const peca = grava('PECA.md', BASE);
  const snap = peca.replace(/\.md$/, '.antes-humanizer.md');
  if (rodar(INV, ['--snapshot', peca]).status !== 0) return 1;
  if (!fs.existsSync(snap) || !/^<!-- snapshot humanizer-forense/.test(fs.readFileSync(snap, 'utf8'))) return 2;
  fs.writeFileSync(peca, BASE.replace('de maneira que a controvérsia', 'e assim a controvérsia'));
  if (rodar(INV, [peca]).status !== 0) return 3;
  fs.writeFileSync(peca, BASE.replace('R$ 4.656,08 em parcela única', 'R$ 4.656,80 em parcela única'));
  if (rodar(INV, [peca]).status !== 1) return 4;
  if (rodar(INV, ['--limpar', peca]).status !== 0 || fs.existsSync(snap)) return 5;
  return 0;
});
caso('sem snapshot → 2 com orientação', 2, () => {
  const r = rodar(INV, [grava('SEM_SNAP.md', BASE)]);
  return r.status === 2 && /--snapshot/.test(r.out) ? 2 : r.status + 10;
});

// ── ritmo ────────────────────────────────────────────────────────────────────
const par = (abertura, n) => `${abertura} ${'palavra '.repeat(n).trim()}, nos termos do art. 300 do CPC, e no caso concreto isso basta, portanto.`;
const MECANICA = `---
titulo: X
processo: 0000000-00.0000.8.27.2729
bundle: nenhum
---

# I. Tese do capítulo

${par('Além disso, a parte autora', 60)}

${par('Além disso, a parte autora', 62)}

${par('Além disso, a parte autora', 58)}

${par('Além disso, a parte autora', 61)}

A tese é esta: o réu confessou o atraso na entrega e não juntou documento algum em sentido contrário. Isso é confissão.

O documento é claro: a obra não foi entregue no prazo e a ré não nega o fato em parte alguma da defesa. Isso é o bastante.

# II. Outra tese

${par('Nesse sentido, o réu', 40)} (i) primeiro; (ii) segundo; (iii) terceiro.
`;
caso('ritmo em peça mecânica: exit 0 e sinais esperados', 0, () => {
  const r = rodar(RITMO, [grava('mecanica.md', MECANICA)]);
  const esperados = ['Parágrafos consecutivos do mesmo tamanho', 'Parágrafos abrindo igual', 'Parágrafos que abrem por conectivo', 'Norma → aplicação → conclusão em série', 'Fecho "Isso é [X]" repetido', 'Enumeração (a)/(b)/(i)/(ii)', 'Dois-pontos em série', 'Conectivo de abertura repetido', 'humanização recomendada'];
  const faltou = esperados.filter((e) => !r.out.includes(e));
  if (faltou.length) { console.log('   faltou:', faltou.join(' | ')); return 7; }
  return r.status;
});
caso('ritmo em peça limpa: exit 0 e "alteração dispensável"', 0, () => {
  const r = rodar(RITMO, [grava('limpa.md', BASE)]);
  return r.status === 0 && /alteração dispensável/.test(r.out) ? 0 : r.status + 10;
});
caso('ritmo --json parseável', 0, () => {
  const r = rodar(RITMO, [grava('json2.md', MECANICA), '--json']);
  try { const j = JSON.parse(r.out); return j.veredito === 'humanizar' && Array.isArray(j.sinais) ? 0 : 5; } catch { return 6; }
});

// ── execução ─────────────────────────────────────────────────────────────────
let falhas = 0;
for (const c of casos) {
  let obtido;
  try { obtido = c.fn(); } catch (e) { obtido = `erro: ${e.message}`; }
  const ok = obtido === c.esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.nome}${ok ? '' : ` (esperado ${c.esperado}, obtido ${obtido})`}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} caso(s) fora do esperado.` : `\n${casos.length} casos OK.`);
process.exit(falhas ? 1 : 0);

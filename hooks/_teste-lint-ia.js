#!/usr/bin/env node
// Teste do lint-ia (08/09/2026). Dois grupos:
//   - comportamentos vigentes (sempre exigidos);
//   - correções da manutenção 2026-09-08 (título-tese curto sem aviso, preâmbulo
//     fora das contagens globais, "não é X, é Y" contado como paralelismo negativo),
//     exigidas só depois de aplicado planos/patch-manutencao-2026-09-08-lint-ia.js
//     (o patch grava o marcador "lint-ia v1.2" no cabeçalho do script).
//   node hooks/_teste-lint-ia.js                 (roda no `npm test`)
//   PMA_LINT_IA=<caminho>                        (para testar um rascunho em outra pasta)
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LINT = path.resolve(RAIZ, process.env.PMA_LINT_IA || 'skills/humanizer-forense/scripts/lint-ia.js');
const PATCHED = /lint-ia v1\.2/.test(fs.readFileSync(LINT, 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-lint-ia-'));

const rodar = (texto) => {
  const p = path.join(tmp, `p${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(p, texto);
  const r = spawnSync(process.execPath, [LINT, p], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const fm = '---\ntitulo: X\nprocesso: 0000000-00.0000.8.27.2729\nbundle: nenhum\n---\n\n';
const LIMPA = fm + `::endereco
AO JUÍZO
::

**FULANO**, brasileiro, vem propor a presente ação.

# I. A pretensão está prescrita

A ação foi ajuizada depois do prazo do art. 206, § 3º, V, do Código Civil, contado do pagamento. Texto suficiente para o capítulo.

# II. Os juros correm da citação

Os juros incidem da citação porque a obrigação é ilíquida (art. 405 do Código Civil).
`;

const casos = [];
const caso = (nome, so, esperado, fn) => casos.push({ nome, so, esperado, fn });

// ── vigentes ─────────────────────────────────────────────────────────────────
caso('peça limpa passa', 'sempre', 0, () => rodar(LIMPA).status);
caso('3 travessões num capítulo reprovam', 'sempre', 1, () => rodar(LIMPA.replace('contado do pagamento.', 'contado — e não suspenso — do pagamento — como se vê.')).status);
caso('rótulo meta-textual reprova', 'sempre', 1, () => rodar(LIMPA.replace('Os juros incidem', '**Conclusão do capítulo:** Os juros incidem')).status);
caso('pergunta retórica no capítulo reprova', 'sempre', 1, () => rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'E o que fez a ré? Nada.')).status);
caso('rótulo vazio ("Dos juros de mora") gera aviso', 'sempre', 1, () => (/⚠ Título de capítulo sem conclusão/.test(rodar(LIMPA.replace('# II. Os juros correm da citação', '# II. Dos juros de mora')).out) ? 1 : 0));

// ── correções 2026-09-08 ─────────────────────────────────────────────────────
caso('título-tese de 4 palavras com verbo NÃO gera aviso', 'patched', 0, () => (/⚠ Título de capítulo sem conclusão/.test(rodar(LIMPA).out) ? 1 : 0));
caso('"?" e "verdadeiro" só no preâmbulo não reprovam', 'patched', 0, () => rodar(LIMPA.replace('vem propor a presente ação.', 'verdadeiro interessado, vem propor? Sim.')).status);
caso('"não é X, é Y" duas vezes reprova como paralelismo negativo', 'patched', 1, () => {
  const r = rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'A ação não é de cobrança, é de restituição. O contrato não é de adesão, é paritário.'));
  return r.status === 1 && /✘ Paralelismo negativo/.test(r.out) ? 1 : 0;
});

// ── manutenção 2026-10-15: quiasmo, contraste "e sim", anáfora de artigo + palavra ─────────
caso('quiasmo ("o que X fez, fez…") reprova', 'sempre', 1, () => {
  const r = rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'O que o autor pagou, pagou por engano; o que a ré cobrou, cobrou sem título.'));
  return r.status === 1 && /✘ Quiasmo/.test(r.out) ? 1 : 0;
});
caso('três "não se trata de X, e sim Y" reprovam', 'sempre', 1, () => {
  const r = rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'Não se trata de cobrança, e sim de restituição. Não se trata de atraso, e sim de inadimplemento. Não se trata de mora, e sim de recusa.'));
  return r.status === 1 && /✘ Contraste/.test(r.out) ? 1 : 0;
});
caso('dois "não se trata de X, e sim Y" passam', 'sempre', 0, () => rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'Não se trata de cobrança, e sim de restituição. Não se trata de atraso, e sim de inadimplemento.')).status);
caso('anáfora "o único…, o único…, o único…" reprova como tríade', 'sempre', 1, () => {
  const r = rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'Houve o único contrato assinado, o único pagamento feito, o único aviso enviado, e o único prazo cumprido.'));
  return r.status === 1 && /✘ Tríade anafórica/.test(r.out) ? 1 : 0;
});
caso('enumeração de dispositivos ("…, inciso II, 226, inciso II, …") não é anáfora', 'sempre', 0, () => rodar(LIMPA.replace('Texto suficiente para o capítulo.', 'Ficam prequestionados os artigos 2º, 4º, 139, inciso II, 226, inciso II, 489 e 805 do Código de Processo Civil.')).status);

let falhas = 0;
let pulados = 0;
console.log(`_teste-lint-ia — ${path.relative(RAIZ, LINT)} (${PATCHED ? 'com' : 'sem'} a manutenção 2026-09-08)\n`);
for (const c of casos) {
  if (c.so === 'patched' && !PATCHED) { pulados++; console.log(`skip ${c.nome} (aguarda patch)`); continue; }
  let obtido;
  try { obtido = c.fn(); } catch (e) { obtido = `erro: ${e.message}`; }
  const ok = obtido === c.esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.nome}${ok ? '' : ` (esperado ${c.esperado}, obtido ${obtido})`}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} caso(s) fora do esperado.` : `\n${casos.length - pulados} casos OK${pulados ? `, ${pulados} aguardando o patch` : ''}.`);
process.exit(falhas ? 1 : 0);

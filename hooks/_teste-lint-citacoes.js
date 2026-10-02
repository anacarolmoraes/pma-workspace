#!/usr/bin/env node
// Teste do lint-citacoes (01/10/2026): o corpus de verificação é o ACERVO e os
// documentos DOS AUTOS — nunca texto nosso. Até esta data a pasta do caso e a
// pasta-pai (clientes/ inteiro) entravam no corpus, e uma ementa fabricada que
// aparecesse na ANALISE.md, na .estrutura.md, numa versão antiga da peça ou na
// peça de OUTRO cliente saía "VERIFICADA".
//   node hooks/_teste-lint-citacoes.js
// Saída: 0 = todos os casos com o comportamento esperado.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LINT = path.join(RAIZ, 'skills', 'peca-pma-builder', 'scripts', 'lint-citacoes.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-citacoes-'));
const mk = (p, c) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
};

// ── acervo fictício ──────────────────────────────────────────────────────────
const acervo = path.join(tmp, 'acervo');
const EMENTA_REAL =
  'A instituição financeira responde objetivamente pelos danos causados por fortuito interno ' +
  'relativo a fraudes e delitos praticados por terceiros no âmbito de operações bancárias, ' +
  'nos termos da Súmula 479 desta Corte, incumbindo-lhe demonstrar a culpa exclusiva do consumidor.';
mk(
  path.join(acervo, 'direito', 'bancario', 'jurisprudencia', 'resp-1234567-sp.md'),
  `---\ntype: acordao\nstatus: vigente\nverificado_em: 2026-09-01\n---\n\n# REsp 1.234.567/SP\n\nEMENTA\n\n${EMENTA_REAL}\n`,
);

// ── pasta do caso ────────────────────────────────────────────────────────────
const caso = path.join(tmp, 'clientes', 'fulano');
const EMENTA_FABRICADA =
  'O simples atraso na entrega do imóvel gera, por si só, dano moral presumido ao adquirente, ' +
  'dispensada qualquer prova do abalo, com indenização fixada no mínimo em cinquenta salários mínimos.';
const FONTE_FABRICADA = '(STJ, REsp 7.654.321/SP, Rel. Min. Fulano, 3ª Turma, j. 02/02/2025)';

// Documento DOS AUTOS: conversão do pdfmd, com manifesto irmão.
const TRECHO_SENTENCA =
  'Diante do exposto, julgo parcialmente procedente o pedido para condenar a ré à restituição ' +
  'de setenta e cinco por cento dos valores pagos, corrigidos desde cada desembolso.';
mk(path.join(caso, 'SENTENCA.md'), `# Sentença\n\nProcesso nº 0001234-56.2020.8.27.2729\n\n${TRECHO_SENTENCA}\n`);
mk(path.join(caso, 'SENTENCA.pdfmd.json'), '{"fonte":"SENTENCA.pdf"}');

// Texto NOSSO que carrega a ementa fabricada — nenhum deles pode servir de fonte.
mk(path.join(caso, 'ANALISE.md'), `# Análise\n\nTese: ${EMENTA_FABRICADA}\n${FONTE_FABRICADA}\n`);
mk(path.join(caso, 'PECA.estrutura.md'), `---\naprovada: sim\n---\n\n> ${EMENTA_FABRICADA}\n> ${FONTE_FABRICADA}\n`);
mk(path.join(caso, 'PECA_v1.md'), `---\npipeline: legal-orchestrator\nbundle: direito/bancario\n---\n\n> ${EMENTA_FABRICADA}\n>\n> ${FONTE_FABRICADA}\n`);
mk(path.join(tmp, 'clientes', 'outro', 'REPLICA.md'), `# Réplica de outro cliente\n\n> ${EMENTA_FABRICADA}\n>\n> ${FONTE_FABRICADA}\n`);

const cab = '---\npipeline: legal-orchestrator\nbundle: direito/bancario\n---\n\n# I. Tese\n\n';
const citReal = `> ${EMENTA_REAL}\n>\n> (STJ, REsp 1.234.567/SP, Rel. Min. Beltrano, 3ª Turma, j. 10/03/2024)\n\n`;
const citFabricada = `> ${EMENTA_FABRICADA}\n>\n> ${FONTE_FABRICADA}\n\n`;
const citAutos = `> ${TRECHO_SENTENCA}\n>\n> (sentença, autos 0001234-56.2020.8.27.2729, evento 45)\n\n`;

const pecaRuim = path.join(caso, 'PECA.md');
const pecaBoa = path.join(caso, 'PECA_OK.md');
mk(pecaRuim, cab + citReal + citFabricada + citAutos);
mk(pecaBoa, cab + citReal + citAutos);

// ── execução ─────────────────────────────────────────────────────────────────
const rodar = (peca) => {
  const r = spawnSync(process.execPath, [LINT, peca, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: '1', PMA_TESTE: '1', PMA_LINT_CITACOES_ACERVO: acervo },
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    /* sem json: o caso falha abaixo */
  }
  return { status: r.status, json, stderr: r.stderr };
};

let falhas = 0;
const registra = (nome, ok, detalhe) => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${detalhe ? ` (${detalhe})` : ''}`);
};

{
  const r = rodar(pecaRuim);
  const v = (r.json?.resultados || []).map((x) => x.veredito);
  registra('peça com ementa fabricada → exit 1', r.status === 1, `exit ${r.status}`);
  registra('ementa real do acervo → VERIFICADA', v[0] === 'VERIFICADA', v[0]);
  registra(
    'ementa fabricada presente em ANALISE/estrutura/versão antiga/outro cliente → NAO_ENCONTRADA',
    v[1] === 'NAO_ENCONTRADA',
    v[1],
  );
  registra('trecho da sentença dos autos (pdfmd) → VERIFICADA', v[2] === 'VERIFICADA', v[2]);
  const fontes = (r.json?.resultados || []).map((x) => x.fonteArquivo || '').join(' ');
  registra('nenhuma fonte veio de texto nosso', !/ANALISE|estrutura|PECA_v1|outro/.test(fontes), fontes);
}
{
  const r = rodar(pecaBoa);
  registra('peça só com citações verificáveis → exit 0', r.status === 0, `exit ${r.status}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} falha(s).` : '\ntodos os casos corretos.');
process.exit(falhas ? 1 : 0);

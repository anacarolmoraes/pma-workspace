#!/usr/bin/env node
// Teste da ficha-golpe-bancario (calc.js) e do qualificacao.js do legal-orchestrator.
//   node skills/ficha-golpe-bancario/tests/_teste-calc.js
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const CALC = path.join(RAIZ, 'skills', 'ficha-golpe-bancario', 'scripts', 'calc.js');
const QUAL = path.join(RAIZ, 'skills', 'legal-orchestrator', 'scripts', 'qualificacao.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-ficha-'));
const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8' });
let erros = 0;
const caso = (nome, ok, extra = '') => { if (!ok) erros++; console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${nome}${extra ? `  ${extra}` : ''}`); };

// ── ficha: exemplo fictício da skill ─────────────────────────────────────────
const exemplo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'skills', 'ficha-golpe-bancario', 'exemplo_dados_caso.json'), 'utf8'));
exemplo.out = 'FICHA.md';
const dados = path.join(tmp, 'dados.json');
fs.writeFileSync(dados, JSON.stringify(exemplo));
let r = run([CALC, dados]);
caso('calc.js roda no exemplo (exit 0)', r.status === 0, r.stderr.trim());
const ficha = fs.existsSync(path.join(tmp, 'FICHA.md')) ? fs.readFileSync(path.join(tmp, 'FICHA.md'), 'utf8') : '';
caso('material líquido = 12.100 − 500 = R$ 11.600,00', /Dano material líquido: R\$ 11\.600,00/.test(ficha));
caso('dupla contagem detectada (mesmo valor e data em contas diferentes)', /Possível dupla contagem \(1\)/.test(ficha));
caso('dobro só sobre cobranças do réu (R$ 640,00), pós-marco', /base segura \(cobranças a partir de 30\/03\/2021\): \*\*R\$ 640,00\*\*/.test(ficha));
caso('mediana do grupo de casos = R$ 6.000,00', /mediana \*\*R\$ 6\.000,00\*\*/.test(ficha));
caso('valor da causa = 11.600 + 640 + 8.000 = R$ 20.240,00', /\*\*Valor da causa\*\* \| \*\*R\$ 20\.240,00\*\*/.test(ficha));
caso('teto do Juizado com salário mínimo do JSON (40 × 1.621 = 64.840)', /R\$ 64\.840,00/.test(ficha));
caso('Súmula 362 no dano moral e Súmula 43 no material', /Súmula 362/.test(ficha) && /Súmula 43/.test(ficha));

// sem fonte → falha
const semFonte = JSON.parse(JSON.stringify(exemplo));
delete semFonte.transacoes[0].fonte;
fs.writeFileSync(path.join(tmp, 'sem-fonte.json'), JSON.stringify(semFonte));
r = run([CALC, path.join(tmp, 'sem-fonte.json')]);
caso('transação sem fonte reprova (exit 1)', r.status === 1);

// extracontratual → Súmula 54
const extra = JSON.parse(JSON.stringify(exemplo)); extra.responsabilidade = 'extracontratual'; extra.out = 'F2.md';
fs.writeFileSync(path.join(tmp, 'extra.json'), JSON.stringify(extra));
run([CALC, path.join(tmp, 'extra.json')]);
caso('extracontratual: juros do evento (Súmula 54)', /Súmula 54/.test(fs.readFileSync(path.join(tmp, 'F2.md'), 'utf8')));

// --conferir
const pecaOk = path.join(tmp, 'ok.md');
fs.writeFileSync(pecaOk, 'Restituir R$ 11.600,00 e dano moral de R$ 8.000,00. Dá-se à causa o valor de R$ 20.240,00.');
r = run([CALC, dados, '--conferir', pecaOk]);
caso('--conferir passa quando todo R$ sai da ficha', r.status === 0, r.stdout.split('\n').filter((l) => /✘/.test(l)).join(' | '));
const pecaRuim = path.join(tmp, 'ruim.md');
fs.writeFileSync(pecaRuim, 'Restituir R$ 12.100,00 e dano moral de R$ 10.000,00. Dá-se à causa o valor de R$ 20.240,00.');
r = run([CALC, dados, '--conferir', pecaRuim]);
caso('--conferir reprova R$ 10.000,00 estranho e material ausente', r.status === 1 && /10\.000,00 aparece na peça/.test(r.stdout) && /11\.600,00 é número central/.test(r.stdout));

// ── qualificacao.js ──────────────────────────────────────────────────────────
const casoJson = path.join(tmp, 'caso.json');
fs.writeFileSync(casoJson, JSON.stringify({
  acao: 'Ação X', autor: { nome: 'Fulana', nacionalidade: 'brasileira', estado_civil: 'solteira', uniao_estavel: false, profissao: 'professora', cpf: '111.222.333-44', email: 'f@x.com', endereco: 'Rua A, 1, Palmas/TO' },
  reus: [{ nome: 'Banco Y S.A.', cnpj: '00.000.000/0001-00', natureza: 'instituição financeira', endereco: 'Av. B, 2, São Paulo/SP' }],
  juizo: { comarca: 'Palmas', uf_extenso: 'Tocantins' },
}));
r = run([QUAL, casoJson]);
caso('qualificacao.js gera preâmbulo (exit 0)', r.status === 0);
caso('ESTADO DO TOCANTINS (preposição pelo estado)', /ESTADO DO TOCANTINS/.test(r.stdout));
caso('concordância feminina: inscrita, domiciliada', /inscrita no CPF/.test(r.stdout) && /domiciliada/.test(r.stdout));
caso('sem telefone no preâmbulo', !/telefone/i.test(r.stdout));
fs.writeFileSync(path.join(tmp, 'incompleto.json'), JSON.stringify({ autor: { nome: 'X' }, reus: [], juizo: {} }));
r = run([QUAL, path.join(tmp, 'incompleto.json'), '--checar']);
caso('--checar lista faltas e sai 1', r.status === 1 && /uniao_estavel/.test(r.stderr));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${erros ? `${erros} falha(s)` : 'todos os casos corretos'}.`);
process.exit(erros ? 1 : 0);

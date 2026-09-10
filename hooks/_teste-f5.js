#!/usr/bin/env node
// Teste da F5 (2026-09-05): lint-placeholder, lint-inicial e o (?!&) do protect-gates.
//   node hooks/_teste-f5.js                       (contra os alvos reais; roda no `npm test`)
//   PMA_F5_LINTS=<pasta> PMA_F5_HOOKS=<pasta>     (para testar rascunhos em outra pasta)
// Saída: 0 = todos os casos com o comportamento esperado.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LINTS = path.resolve(RAIZ, process.env.PMA_F5_LINTS || 'skills/peca-pma-builder/scripts');
const HOOKS = path.resolve(RAIZ, process.env.PMA_F5_HOOKS || 'hooks');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-f5-'));

// ── fixtures ────────────────────────────────────────────────────────────────
const fm = (extra = '') => `---\ntitulo: X\nprocesso: a distribuir\nbundle: nenhum\n${extra}---\n\n`;
const inicialOk = fm('tipo: inicial\n') + `<!-- [[comentário com slot]] não conta -->
::endereco
AO JUÍZO DA __ª VARA CÍVEL DA
COMARCA DE PALMAS, ESTADO DO TOCANTINS
::

**FULANO DE TAL**, brasileiro, solteiro, autônomo, inscrito no CPF sob o nº 000.000.000-00, residente na Rua X, com endereço eletrônico fulano@x.com, vem propor

# I. Da síntese da lide

Texto.

> Citação com omissão [...] legítima.

# II. Dos fatos

Texto.

# III. Da gratuidade da justiça

Requer a gratuidade, nos termos do art. 98 do CPC.

# IV. Dos pedidos

Protesta provar o alegado por todos os meios e manifesta interesse na audiência de conciliação do art. 334 do CPC.

Dá-se à causa o valor de R$ 10.000,00.

::assinatura
ANA MORAES | OAB/TO 6573
::
`;
const inicialRuim = fm('tipo: inicial\n') + `::endereco
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL
::

**FULANO**, telefone (63) 99999-9999, vem propor

# I. Dos fatos

Texto [VERIFICAR: data].

# II. Dos pedidos

Requer a gratuidade.
`;
const naoInicial = fm('tipo: replica\n') + '# I. Tese\n\nTexto sem nada do checklist.\n';
const semTipo = fm() + '# I. Tese\n\nTexto.\n';
const comSlot = fm() + '# I. Tese\n\nO autor pagou R$ [[valor]] à ré.\n';
const comSic = fm() + '# I. Tese\n\nA ré escreveu "recebemos o valor [sic] integral".\n';
// lint-inicial v2 (2026-09-08)
const inicialSelic = inicialOk.replace('Dá-se à causa', 'Os valores sofrerão correção monetária pela taxa Selic desde o desembolso. Dá-se à causa');
const inicialDoisValores = inicialOk.replace('# II. Dos fatos\n\nTexto.', '# II. Dos fatos\n\nO valor da causa de R$ 12.000,00 reflete o pedido.');
const inicialDocSemRol = inicialOk.replace('# II. Dos fatos\n\nTexto.', '# II. Dos fatos\n\nO contrato (Doc. 2) prova o pagamento.');
const inicialDocComRol = fm('tipo: inicial\ndocumentos:\n  - n: 2\n    descricao: contrato\n') + inicialDocSemRol.slice(inicialDocSemRol.indexOf('<!--'));

const w = (n, c) => { const p = path.join(tmp, n); fs.writeFileSync(p, c); return p; };
const fInicialOk = w('inicial-ok.md', inicialOk);
const fInicialRuim = w('inicial-ruim.md', inicialRuim);
const fNaoInicial = w('replica.md', naoInicial);
const fSemTipo = w('sem-tipo.md', semTipo);
const fComSlot = w('com-slot.md', comSlot);
const fComSic = w('com-sic.md', comSic);
const fInicialSelic = w('inicial-selic.md', inicialSelic);
const fInicialDoisValores = w('inicial-dois-valores.md', inicialDoisValores);
const fInicialDocSemRol = w('inicial-doc-sem-rol.md', inicialDocSemRol);
const fInicialDocComRol = w('inicial-doc-com-rol.md', inicialDocComRol);

// hook copiado para um hooks/ falso com a lib real, para o require('./lib/transcript') resolver
const hooksDir = path.join(tmp, 'hooks');
fs.mkdirSync(path.join(hooksDir, 'lib'), { recursive: true });
fs.copyFileSync(path.join(HOOKS, 'protect-gates.js'), path.join(hooksDir, 'protect-gates.js'));
fs.copyFileSync(path.join(RAIZ, 'hooks', 'lib', 'transcript.js'), path.join(hooksDir, 'lib', 'transcript.js'));

const rodarLint = (nome, arquivo) => {
  const r = spawnSync(process.execPath, [path.join(LINTS, nome), arquivo], { encoding: 'utf8' });
  if (process.env.PMA_F5_VERBOSE) console.log((r.stdout || '') + (r.stderr || ''));
  return r.status;
};
const rodarHook = (payload) =>
  spawnSync(process.execPath, [path.join(hooksDir, 'protect-gates.js')], {
    input: JSON.stringify(payload), encoding: 'utf8',
    env: { ...process.env, CLAUDE_INVOKED_BY: '', PMA_MANUTENCAO: '' },
  }).status;
const bash = (c) => ({ tool_name: 'Bash', tool_input: { command: c } });

const casos = [
  ['lint-placeholder', 0, 'inicial limpa (slot só em comentário, [...] só em citação)', () => rodarLint('lint-placeholder.js', fInicialOk)],
  ['lint-placeholder', 1, '[VERIFICAR: ...] na prosa', () => rodarLint('lint-placeholder.js', fInicialRuim)],
  ['lint-placeholder', 1, 'slot [[valor]] de template na prosa', () => rodarLint('lint-placeholder.js', fComSlot)],
  ['lint-placeholder', 0, '[sic] não é placeholder', () => rodarLint('lint-placeholder.js', fComSic)],
  ['lint-inicial', 0, 'inicial que cumpre o checklist', () => rodarLint('lint-inicial.js', fInicialOk)],
  ['lint-inicial', 1, 'inicial com Excelentíssimo, telefone, sem síntese, sem valor da causa', () => rodarLint('lint-inicial.js', fInicialRuim)],
  ['lint-inicial', 0, 'tipo: replica → nada a conferir', () => rodarLint('lint-inicial.js', fNaoInicial)],
  ['lint-inicial', 0, 'sem tipo: → nada a conferir', () => rodarLint('lint-inicial.js', fSemTipo)],
  ['lint-inicial', 1, 'v2: "correção monetária pela Selic" reprova', () => rodarLint('lint-inicial.js', fInicialSelic)],
  ['lint-inicial', 1, 'v2: dois valores da causa divergentes reprovam', () => rodarLint('lint-inicial.js', fInicialDoisValores)],
  ['lint-inicial', 1, 'v2: Doc. N citado sem rol documentos: reprova', () => rodarLint('lint-inicial.js', fInicialDocSemRol)],
  ['lint-inicial', 0, 'v2: Doc. N citado com rol documentos: passa', () => rodarLint('lint-inicial.js', fInicialDocComRol)],
  ['protect-gates', 0, 'execução de lint com 2>&1 passa', () => rodarHook(bash('node scripts/lint-skills.js 2>&1 | tail -5'))],
  ['protect-gates', 0, 'leitura de portão com 2>/dev/null... não: redirect p/ arquivo ainda conta (cat)', () => rodarHook(bash('cat skills/peca-pma-builder/scripts/md2docx.js'))],
  ['protect-gates', 2, 'sed -i em lint-ia continua bloqueado', () => rodarHook(bash('sed -i "s/2/9/" skills/humanizer-forense/scripts/lint-ia.js'))],
  ['protect-gates', 2, 'redirect > para portão continua bloqueado', () => rodarHook(bash('echo x > hooks/block-secrets.js'))],
];

let erros = 0;
for (const [alvo, esperado, nome, fn] of casos) {
  const obtido = fn();
  const ok = obtido === esperado;
  if (!ok) erros++;
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${alvo.padEnd(16)} exit ${obtido} (esperado ${esperado})  ${nome}`);
}
console.log(`\n${casos.length - erros}/${casos.length} casos corretos.`);
process.exit(erros ? 1 : 0);

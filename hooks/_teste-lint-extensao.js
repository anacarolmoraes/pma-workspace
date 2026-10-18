#!/usr/bin/env node
// Teste do lint-extensao (manutenção de 18/10/2026): EDcl e contrarrazões a EDcl têm
// teto de 6 páginas (~300 palavras/página) e 6 transcrições; `orcamento_paginas:` libera.
//   node hooks/_teste-lint-extensao.js   (roda no `npm test`)
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LINT = path.join(RAIZ, 'skills', 'peca-pma-builder', 'scripts', 'lint-extensao.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-lint-ext-'));
let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}`); if (!cond) falhas++; };

const rodar = (fm, corpo) => {
  const p = path.join(tmp, `p${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(p, `---\n${fm}\n---\n\n${corpo}`);
  const r = spawnSync(process.execPath, [LINT, p], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const paragrafo = 'A decisão embargada anunciou o julgamento antecipado com fundamento no art. 355, I, do Código de Processo Civil, e abriu prazo de oposição fundamentada às partes. ';
const prosa = (palavras) => paragrafo.repeat(Math.ceil(palavras / 26)) + '\n\n';
const bloco = (n) => Array.from({ length: n }, (_, i) => `> Transcrição ${i + 1} do documento.\n>\n> (fonte ${i + 1})\n\n`).join('');

// 1. Fora do alcance: réplica longa não é bloqueada.
let r = rodar('titulo: Réplica — Fulano\nbundle: nenhum', prosa(4000) + bloco(10));
ok(r.status === 0 && /fora do alcance/.test(r.out), 'réplica de 13 p. não é alcançada');

// 2. Contrarrazões a EDcl curtas passam.
r = rodar('titulo: Contrarrazões aos embargos de declaração — Fulano\nbundle: nenhum', prosa(1200) + bloco(4));
ok(r.status === 0 && /dentro do orçamento/.test(r.out), 'contrarrazões de ~5 p. e 4 blocos passam');

// 3. EDcl de 13 páginas bloqueiam, com as duas mensagens.
r = rodar('titulo: Embargos de declaração — Fulano\nbundle: nenhum', prosa(3900) + bloco(16));
ok(r.status === 1 && /13 páginas/.test(r.out) && /16 transcrições/.test(r.out), 'EDcl de 13 p. e 16 blocos bloqueiam');

// 4. Só transcrições em excesso também bloqueia.
r = rodar('titulo: Embargos de declaração — Fulano\nbundle: nenhum', prosa(900) + bloco(8));
ok(r.status === 1 && /8 transcrições/.test(r.out) && !/páginas estimadas/.test(r.out), 'curta com 8 blocos bloqueia só pelas transcrições');

// 5. orcamento_paginas declarado libera a decisão registrada.
r = rodar('titulo: Embargos de declaração — Fulano\nbundle: nenhum\norcamento_paginas: 14', prosa(3900) + bloco(12));
ok(r.status === 0, 'orcamento_paginas: 14 libera 13 p. e 12 blocos');

// 6. Maiúsculas e acento no título contam.
r = rodar('titulo: CONTRARRAZÕES AOS EMBARGOS DE DECLARAÇÃO\nbundle: nenhum', prosa(3000));
ok(r.status === 1, 'título em maiúsculas é alcançado');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} falha(s).` : '\n6 casos OK.');
process.exit(falhas ? 1 : 0);

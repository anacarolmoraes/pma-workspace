#!/usr/bin/env node
// recalcular-prazos — refaz as colunas de prazo (embargos, fatal, termo inicial) das
// linhas ABERTAS da fila com as regras e os calendários ATUAIS.
//
// Quando rodar: depois de atualizar feriados/<sigla>.json com a portaria anual, ou
// quando a regra de prazo muda (01/10/2026: Juizado passou a 10 d.ú.). A fila é só
// acrescentada pelo monitor; sem este script, linha antiga carrega cálculo antigo.
//
//   node skills/pesquisa-djen/scripts/recalcular-prazos.js --dry-run   # mostra o que mudaria
//   node skills/pesquisa-djen/scripts/recalcular-prazos.js             # grava
//
// Linha TRATADA não é tocada. A coluna "prazo fixado no ato" não é recalculada aqui
// (depende do teor, que não está na fila).
'use strict';

const fs = require('fs');
const path = require('path');
const { calcularPrazo } = require('../lib/prazo-core.js');
const { classificar } = require('../lib/tipo-documento.js');
const { prazoRecurso } = require('../lib/prazo-ato.js');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const PENDENTES = path.join(__dirname, '..', 'monitor', 'PENDENTES.md');
const DRY = process.argv.includes('--dry-run');

function config() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'monitor-djen.json'), 'utf8'));
    return { ref: c.prazos_referencia.recurso_principal, edcl: c.prazos_referencia.embargos_declaracao };
  } catch {
    return { ref: 15, edcl: 5 };
  }
}

const CFG = config();
const txt = fs.readFileSync(PENDENTES, 'utf8');
const linhas = txt.split('\n');
const cab = linhas.find((l) => l.startsWith('| status |'));
if (!cab) throw new Error('cabeçalho da fila não encontrado');
const cols = cab.split('|').map((c) => c.trim().toLowerCase());
const idx = (...t) => cols.findIndex((c) => t.some((x) => c.includes(x)));
const I = {
  status: idx('status'),
  processo: idx('processo'),
  orgao: idx('tribunal', 'órgão', 'orgao'),
  disp: idx('disponibiliza'),
  doc: idx('documento'),
  edcl: idx('embargos'),
  fatal: idx('fatal'),
  termo: idx('termo'),
};
for (const [k, v] of Object.entries(I)) if (v < 0) throw new Error(`coluna "${k}" não encontrada no cabeçalho`);

let mudadas = 0;
let vistas = 0;
const relato = [];
for (let k = 0; k < linhas.length; k++) {
  const l = linhas[k];
  if (!l.startsWith('|') || l === cab || /^\|\s*-+/.test(l)) continue;
  const c = l.split('|');
  if ((c[I.status] || '').trim() !== 'ABERTA') continue;
  vistas++;
  const disp = (c[I.disp] || '').trim();
  const orgaoCel = (c[I.orgao] || '').trim();
  const tribunal = orgaoCel.split('/')[0].trim();
  const orgao = orgaoCel.replace(/^[^/]*\/\s*/, '');
  const documento = (c[I.doc] || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(disp)) continue;

  let edcl;
  let fatal;
  let termo;
  try {
    const base = { disponibilizacao: disp, tribunal };
    const ref = prazoRecurso({ orgao, tribunal, documento }, CFG.ref);
    const r = calcularPrazo({ ...base, dias: ref.dias });
    termo = r.termo_inicial;
    let flag = ref.rito !== 'comum' ? ` (${ref.rotulo})` : '';
    if (!r.confiavel) flag += ' ⚠ SEM FERIADO LOCAL';
    // Preserva o aviso de matéria penal, que vem do rótulo e não da conta.
    const penal = /CONFERIR \(possível matéria penal/.exec(c[I.fatal] || '');
    if (penal) flag += ` ⚠ ${penal[0]}`;
    fatal = `**${r.data_fatal}**${flag}`;
    const classe = classificar(documento);
    if (classe === 'nao_embargavel') edcl = 'n/a';
    else {
      const e = calcularPrazo({ ...base, dias: CFG.edcl });
      edcl = classe === 'duvida' ? `${e.data_fatal} ?` : `**${e.data_fatal}**`;
    }
  } catch (e) {
    relato.push(`  !  linha ${k + 1}: ${e.message}`);
    continue;
  }

  const antes = [c[I.edcl], c[I.fatal], c[I.termo]].map((x) => (x || '').trim());
  const depois = [edcl, fatal, termo];
  if (antes.join('|') === depois.join('|')) continue;
  mudadas++;
  relato.push(`  ~  ${(c[I.processo] || '').trim()}  fatal ${antes[1]} → ${fatal}${antes[0] !== edcl ? `  edcl ${antes[0]} → ${edcl}` : ''}`);
  c[I.edcl] = ` ${edcl} `;
  c[I.fatal] = ` ${fatal} `;
  c[I.termo] = ` ${termo} `;
  linhas[k] = c.join('|');
}

console.log(relato.join('\n'));
console.log(`\n${vistas} linha(s) ABERTA(S) conferida(s); ${mudadas} recalculada(s)${DRY ? ' (dry-run, nada gravado)' : ''}.`);
if (!DRY && mudadas) {
  const tmp = `${PENDENTES}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, linhas.join('\n'), 'utf8');
  fs.renameSync(tmp, PENDENTES);
}

#!/usr/bin/env node
// pesquisa-djen: consulta comunicações no DJEN (API Comunica/PJe — pública, sem auth).
// Uso: node djen.js [--processo N] [--oab N --uf UF] [--tribunal SIGLA]
//                   [--inicio AAAA-MM-DD] [--fim AAAA-MM-DD] [--texto] [--out arquivo.json]
'use strict';

const fs = require('fs');
const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { a[k.slice(2)] = true; }
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}

const soDigitos = (s) => String(s).replace(/\D/g, '');

async function consultar(opts) {
  const q = new URLSearchParams();
  if (opts.processo) q.set('numeroProcesso', soDigitos(opts.processo));
  if (opts.oab) q.set('numeroOab', String(opts.oab));
  if (opts.uf) q.set('ufOab', String(opts.uf).toUpperCase());
  if (opts.tribunal) q.set('siglaTribunal', String(opts.tribunal).toUpperCase());
  if (opts.inicio) q.set('dataDisponibilizacaoInicio', opts.inicio);
  if (opts.fim) q.set('dataDisponibilizacaoFim', opts.fim);
  q.set('itensPorPagina', opts.itens || '100');
  q.set('pagina', opts.pagina || '1');

  const res = await fetch(`${BASE}?${q}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`DJEN HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function resumir(item, comTexto) {
  const r = {
    id: item.id,
    data_disponibilizacao: item.data_disponibilizacao,
    siglaTribunal: item.siglaTribunal,
    tipoComunicacao: item.tipoComunicacao,
    tipoDocumento: item.tipoDocumento,
    nomeOrgao: item.nomeOrgao,
    nomeClasse: item.nomeClasse,
    processo: item.numeroprocessocommascara || item.numero_processo,
    meio: item.meiocompleto || item.meio,
    link: item.link,
    hash: item.hash,
    destinatarios: (item.destinatarios || []).map((d) => `${d.nome} (polo ${d.polo})`),
    advogados: (item.destinatarioadvogados || []).map((x) => x.advogado && `${x.advogado.nome} (OAB ${x.advogado.uf_oab} ${x.advogado.numero_oab})`).filter(Boolean),
  };
  if (comTexto) r.texto = item.texto;
  return r;
}

(async () => {
  const a = args(process.argv);
  if (!a.processo && !(a.oab && a.uf)) {
    console.error('Informe --processo N  ou  --oab N --uf UF. Filtros: --tribunal --inicio --fim --texto --out arquivo.json');
    process.exit(2);
  }
  const data = await consultar(a);
  const itens = (data.items || []).map((i) => resumir(i, !!a.texto));
  const saida = { count: data.count, itens };
  const json = JSON.stringify(saida, null, 2);
  if (a.out) { fs.writeFileSync(a.out, json, 'utf8'); console.log(`Gravado: ${a.out} (${data.count} comunicações)`); }
  else { process.stdout.write(json + '\n'); }
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

#!/usr/bin/env node
// pesquisa-djen: consulta capa + movimentos de processo na API Pública DataJud (CNJ).
// Uso: node datajud.js --processo N --tribunal tjto [--movimentos 10] [--out arquivo.json]
// Chave pública: https://datajud-wiki.cnj.jus.br/api-publica/acesso/ (override: env DATAJUD_API_KEY)
'use strict';

const fs = require('fs');
// Chave PÚBLICA divulgada pelo CNJ na wiki (pode ser trocada; se 401, buscar a nova).
const API_KEY = process.env.DATAJUD_API_KEY
  || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

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

async function consultar(processo, tribunal) {
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal.toLowerCase()}/_search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `APIKey ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso: soDigitos(processo) } }, size: 10 }),
  });
  if (!res.ok) throw new Error(`DataJud HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  const a = args(process.argv);
  if (!a.processo || !a.tribunal) {
    console.error('Uso: node datajud.js --processo N --tribunal tjto|stj|... [--movimentos N] [--out arquivo.json]');
    process.exit(2);
  }
  const data = await consultar(a.processo, a.tribunal);
  const hits = (data.hits && data.hits.hits) || [];
  const nMov = a.movimentos ? parseInt(a.movimentos, 10) : 5;
  const saida = hits.map((h) => {
    const s = h._source || {};
    const movs = (s.movimentos || [])
      .slice()
      .sort((x, y) => String(y.dataHora).localeCompare(String(x.dataHora)))
      .slice(0, nMov)
      .map((m) => ({ dataHora: m.dataHora, codigo: m.codigo, nome: m.nome }));
    return {
      numeroProcesso: s.numeroProcesso,
      tribunal: s.tribunal,
      grau: s.grau,
      classe: s.classe && `${s.classe.codigo} — ${s.classe.nome}`,
      orgaoJulgador: s.orgaoJulgador && s.orgaoJulgador.nome,
      dataAjuizamento: s.dataAjuizamento,
      ultimaAtualizacao: s.dataHoraUltimaAtualizacao,
      ultimosMovimentos: movs,
    };
  });
  const json = JSON.stringify({ total: hits.length, processos: saida }, null, 2);
  if (a.out) { fs.writeFileSync(a.out, json, 'utf8'); console.log(`Gravado: ${a.out}`); }
  else { process.stdout.write(json + '\n'); }
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

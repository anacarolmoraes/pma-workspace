#!/usr/bin/env node
// radar-jurisprudencia: semáforo de reforma via DataJud para os finalistas do dossiê.
//
// O dossiê nasce NÃO VERIFICADO. Este script faz a metade determinística da verificação:
// consulta os movimentos do processo no DataJud e acende um semáforo por finalista:
//   VERDE   — nenhum movimento com cara de reforma depois da data da decisão
//   AMARELO — há movimento suspeito (provimento, reforma, anulação...) — ler antes de citar
//   CINZA   — processo não encontrado no DataJud (segredo, defasagem) — verificação manual
//
// VERDE não substitui a conferência do inteiro teor — só elimina o risco mais barato de
// detectar (citar decisão já derrubada). Zero LLM.
//
// Uso:
//   node verificar.js --itens "tjto:0012960-14.2026.8.27.2729:2026-06-10,stj:NNNN:2026-05-02" [--out arquivo.json]
//   (formato: tribunal:processo[:dataDecisao AAAA-MM-DD] — sem data, avalia todos os movimentos)
'use strict';

const fs = require('fs');

// Chave PÚBLICA divulgada pelo CNJ (mesma convenção de pesquisa-djen/scripts/datajud.js).
const API_KEY = process.env.DATAJUD_API_KEY
  || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const REFORMA = /(provimento|reforma|anula|cassa|revoga|retrata|rescis[aã]o do julgado|efeito suspensivo concedido)/i;

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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function movimentos(processo, tribunal) {
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal.toLowerCase()}/_search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `APIKey ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso: soDigitos(processo) } }, size: 5 }),
  });
  if (!res.ok) throw new Error(`DataJud HTTP ${res.status}`);
  const data = await res.json();
  const hits = (data.hits && data.hits.hits) || [];
  // Um número pode aparecer em mais de um grau — junta tudo: reforma em qualquer grau interessa.
  const movs = [];
  for (const h of hits) {
    for (const m of (h._source && h._source.movimentos) || []) {
      movs.push({ dataHora: m.dataHora, codigo: m.codigo, nome: m.nome, grau: h._source.grau });
    }
  }
  return { encontrados: hits.length, movs: movs.sort((x, y) => String(y.dataHora).localeCompare(String(x.dataHora))) };
}

(async () => {
  const a = args(process.argv);
  if (!a.itens) {
    console.error('Uso: node verificar.js --itens "tribunal:processo[:dataDecisao],..." [--out arquivo.json]');
    process.exit(2);
  }
  const itens = String(a.itens).split(',').map((s) => {
    const [tribunal, processo, desde] = s.trim().split(':');
    return { tribunal, processo, desde: desde || null };
  }).filter((i) => i.tribunal && i.processo);

  // DataJud é instável sob sequência (429 e, pior, 200 com zero hits para processo que
  // existe). Retry com backoff nos erros e UMA repescagem no "não encontrado" — só depois
  // disso o CINZA é confiável.
  async function consultarComRetry(item) {
    let ultimoErro;
    for (let t = 1; t <= 3; t++) {
      try {
        const r = await movimentos(item.processo, item.tribunal);
        if (r.encontrados) return r;
        if (t < 3) await dormir(2500);
        else return r;
      } catch (e) {
        ultimoErro = e;
        await dormir(t * 3000);
      }
    }
    throw ultimoErro;
  }

  const resultado = [];
  for (const item of itens) {
    let r;
    try {
      const { encontrados, movs } = await consultarComRetry(item);
      if (!encontrados) {
        r = { ...item, semaforo: 'CINZA', motivo: 'processo não encontrado no DataJud' };
      } else {
        const janela = item.desde ? movs.filter((m) => String(m.dataHora) >= item.desde) : movs;
        const suspeitos = janela.filter((m) => REFORMA.test(m.nome || ''));
        r = suspeitos.length
          ? { ...item, semaforo: 'AMARELO', suspeitos, ultimos: movs.slice(0, 5) }
          : { ...item, semaforo: 'VERDE', movimentosNaJanela: janela.length, ultimos: movs.slice(0, 3) };
      }
    } catch (e) {
      r = { ...item, semaforo: 'CINZA', motivo: e.message };
    }
    resultado.push(r);
    console.log(`${r.semaforo.padEnd(7)} ${item.tribunal.toUpperCase()} ${item.processo}${r.motivo ? ' — ' + r.motivo : ''}${r.suspeitos ? ' — ' + r.suspeitos.map((s) => s.nome).join('; ') : ''}`);
    await dormir(1500);
  }

  if (a.out) {
    fs.writeFileSync(a.out, JSON.stringify({ verificadoEm: new Date().toISOString().slice(0, 10), resultado }, null, 2), 'utf8');
    console.log(`Gravado: ${a.out}`);
  }
  console.log('Lembrete: VERDE ainda exige conferência do inteiro teor oficial antes de citar.');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

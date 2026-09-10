#!/usr/bin/env node
// radar-jurisprudencia: modo GRUPO DE CASOS (primeira fase do método bifásico do dano moral).
//
// A heurística `peticao-inicial/heuristicas/quantificar-dano-moral-metodo-bifasico.md` manda
// colher três a cinco acórdãos do tribunal competente para o mesmo interesse lesado, com o
// valor fixado em cada um. Este script faz a metade determinística: lê os textos coletados
// pelo buscar.js e extrai, de cada decisão, o(s) valor(es) de dano moral e o verbo que os
// acompanha (fixo, arbitro, mantenho, reduzo, majoro). Zero LLM.
//
// Saída: tabela em markdown (tribunal, órgão, processo, data, valor, verbo, trecho) com faixa
// e mediana, pronta para virar a seção 3 do dados_caso.json da ficha-golpe-bancario e, depois
// da conferência da titular, página em casos_decididos/ ou perfis/ do bundle temático.
//
// O valor extraído por regex NÃO é citável: é candidato. Só entra na peça depois que a
// decisão tiver página no acervo (AGENTS.md, regra dura 3).
//
// Uso:
//   node buscar.js --termos "dano moral;falsa central" --tribunais TJTO --saida <pasta>/radar-djen
//   node grupo-de-casos.js --entrada <pasta>/radar-djen [--tribunal TJTO] [--min 500] [--md saida.md]
'use strict';

const fs = require('fs');
const path = require('path');

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) a[k.slice(2)] = true;
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}
const fmt = (n) => {
  const v = (Math.round(n * 100) / 100).toFixed(2);
  const [i, d] = v.split('.');
  return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};
const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

// verbo de arbitramento ... até 160 caracteres ... R$ valor  |  R$ valor ... a título de dano(s) moral(is)
const RX_A = /\b(fix[oa]r?|arbitr[oa]r?|mant(?:enho|ida|ido|ém)|reduz(?:o|ido|ida|ir)|major(?:o|ada|ado|ar)|minor(?:o|ada|ado|ar)|conden[oa]r?)[^.]{0,160}?R\$\s?([\d.]+,\d{2})[^.]{0,120}?(dano[s]? mora(?:l|is)|indeniza[çc][ãa]o|compensa[çc][ãa]o)/gi;
const RX_B = /(dano[s]? mora(?:l|is))[^.]{0,120}?R\$\s?([\d.]+,\d{2})/gi;
const VERBO = /(fix|arbitr|mant|reduz|major|minor|conden)/i;

function extrair(texto) {
  const out = [];
  let m;
  while ((m = RX_A.exec(texto))) out.push({ valor: numero(m[2]), verbo: m[1].toLowerCase(), pos: m.index });
  while ((m = RX_B.exec(texto))) {
    const v = numero(m[2]);
    if (!out.some((o) => o.valor === v)) {
      const antes = texto.slice(Math.max(0, m.index - 80), m.index);
      const vb = antes.match(VERBO);
      out.push({ valor: v, verbo: vb ? vb[1].toLowerCase() : '—', pos: m.index });
    }
  }
  return out;
}
const classe = (verbo) => {
  if (/^(reduz|minor)/.test(verbo)) return 'reduz';
  if (/^major/.test(verbo)) return 'majora';
  if (/^mant/.test(verbo)) return 'mantém';
  if (/^(fix|arbitr|conden)/.test(verbo)) return 'fixa';
  return '?';
};

(async () => {
  const a = args(process.argv);
  if (!a.entrada) { console.error('Uso: node grupo-de-casos.js --entrada <pasta com candidatos.json e textos/> [--tribunal SIGLA] [--min 500] [--md saida.md]'); process.exit(2); }
  const dir = path.resolve(a.entrada);
  const cand = JSON.parse(fs.readFileSync(path.join(dir, 'candidatos.json'), 'utf8'));
  const lista = Array.isArray(cand) ? cand : (cand.candidatos || cand.itens || []);
  const min = Number(a.min || 500);
  const tribunal = a.tribunal ? String(a.tribunal).toUpperCase() : null;

  const linhas = [];
  for (const c of lista) {
    if (tribunal && String(c.tribunal || '').toUpperCase() !== tribunal) continue;
    if (c.natureza && c.natureza !== 'principal') continue;
    const arq = path.join(dir, 'textos', `${c.id}.txt`);
    const texto = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : String(c.trecho || '');
    const vals = extrair(texto).filter((v) => v.valor >= min);
    if (!vals.length) continue;
    // o último valor com verbo de arbitramento costuma ser o dispositivo; guarda todos, marca o provável
    const provavel = [...vals].reverse().find((v) => classe(v.verbo) !== '?') || vals[vals.length - 1];
    linhas.push({
      tribunal: c.tribunal, orgao: c.orgao || '', processo: c.processo || '', data: c.data || '',
      valor: provavel.valor, verbo: classe(provavel.verbo),
      outros: vals.filter((v) => v !== provavel).map((v) => fmt(v.valor)).join(' · '),
      trecho: texto.slice(Math.max(0, provavel.pos - 100), provavel.pos + 160).replace(/\s+/g, ' ').replace(/\|/g, '/'),
      so_ementa: !!c.so_ementa,
    });
  }
  linhas.sort((x, y) => x.valor - y.valor);
  const vals = linhas.map((l) => l.valor);
  const mediana = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;

  const md = [];
  md.push(`## Grupo de casos — dano moral${tribunal ? ` (${tribunal})` : ''}`);
  md.push('');
  md.push(`${linhas.length} decisão(ões) com valor de dano moral extraído por regex de ${lista.length} candidato(s). **Candidatos, não citações:** o valor só entra na peça depois de conferido no inteiro teor e com página no acervo.`);
  if (vals.length) md.push(`\nFaixa: ${fmt(vals[0])} a ${fmt(vals[vals.length - 1])} · **mediana ${fmt(mediana)}** (valor básico da primeira fase).`);
  md.push('');
  md.push('| Tribunal / órgão | Processo | Data | Valor | Verbo | Outros valores no texto | Só ementa | Trecho |');
  md.push('|---|---|---|---|---|---|---|---|');
  for (const l of linhas) md.push(`| ${l.tribunal} / ${l.orgao} | ${l.processo} | ${l.data} | ${fmt(l.valor)} | ${l.verbo} | ${l.outros} | ${l.so_ementa ? 'sim' : ''} | …${l.trecho}… |`);
  md.push('');
  md.push('Para a ficha (`dano_moral.grupo_de_casos`), cada linha vira `{processo, tribunal, data, valor, fonte}`; `fonte` é a página do acervo, que a titular deposita depois de conferir.');
  const txt = md.join('\n') + '\n';
  if (a.md) { fs.writeFileSync(path.resolve(a.md), txt, 'utf8'); console.log(`Tabela: ${path.resolve(a.md)}`); }
  else process.stdout.write(txt);
  console.error(`grupo-de-casos: ${linhas.length} decisão(ões) com valor${mediana ? `, mediana ${fmt(mediana)}` : ''}.`);
})();

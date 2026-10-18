#!/usr/bin/env node
// conferir-decisao — lê uma decisão (sentença, acórdão, interlocutória) convertida para .md
// e confere as âncoras dela contra os autos do caso: datas, valores em reais, percentuais,
// cláusulas, documentos/eventos, números CNJ e nomes próprios. O que a decisão afirma e não
// existe em nenhum outro .md da pasta do caso (ANALISE.md, inicial, contestação, réplica,
// contrato, extrato convertidos) é candidato a erro de fato, erro material ou texto de outro
// processo — e é a matéria-prima dos EDcl e da preliminar de nulidade da apelação.
//
// Teria apanhado o IPTU com texto de outro caso (Maria de Jesus, 10/2026) e o 25% trocado por
// 75% (Divino, 10/2026). Não decide nada: lista o que não bateu, para a leitura humana.
//
// Âncoras que aparecem dentro de citação de precedente (perto de "julgado em", "DJe", "Rel.",
// nome de classe processual) são separadas: datas de julgados e nomes de ministros não são
// fatos do caso, e seriam ruído.
//
// Uso:
//   node scripts/conferir-decisao.js <caso> <decisao.md>         caso relativo a clientes/
//   node scripts/conferir-decisao.js <caminho/da/decisao.md>     pasta do caso = pasta do arquivo
//   --json                                                        saída em JSON
//   --tudo                                                        lista também as âncoras encontradas
//
// Exit: 0 tudo encontrado · 1 há âncora do caso sem correspondência · 2 uso/arquivo ausente.
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function sair(msg, code = 2) { console.error(msg); process.exit(code); }

// ── Normalização ───────────────────────────────────────────────────────────
const MESES = { janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };

const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const soDigitos = (s) => s.replace(/\D/g, '');

// Contexto de citação de precedente: 160 caracteres em volta da âncora.
const RX_PRECEDENTE = /julgad[oa]s? em|DJe|DJEN|DJU|Rel\.|Relator|Relatora|Ministr[oa]|Desembargador|Turma|Seção|Corte Especial|Plenário|AgInt|AgRg|AREsp|REsp|EDcl|EREsp|Apela[çc][ãa]o C[íi]vel|Agravo de Instrumento|Tema\s*(?:n\.?|nº)?\s*\d|Súmula|S[úu]mula|RE\s+\d|ADI|ADC|Processo n|Autos n|IRDR/;
function emPrecedente(texto, pos, tam) {
  const ini = Math.max(0, pos - 160);
  const fim = Math.min(texto.length, pos + tam + 160);
  return RX_PRECEDENTE.test(texto.slice(ini, fim));
}

// Cada extrator devolve Map chave -> { forma, pos }. A chave é a forma normalizada,
// para que "10/03/2019" e "10 de março de 2019" sejam a mesma âncora.
function coletar(texto, rx, chaveDe) {
  const achadas = new Map();
  let m;
  while ((m = rx.exec(texto))) {
    const chave = chaveDe(m);
    if (!chave || achadas.has(chave)) continue;
    achadas.set(chave, { forma: m[0].trim(), pos: m.index, tam: m[0].length });
  }
  return achadas;
}

function datas(texto) {
  const a = coletar(texto, /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/g, (m) => {
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  });
  const b = coletar(texto, /\b(\d{1,2})[ºo°]?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})\b/gi, (m) => {
    const mes = MESES[semAcento(m[2].toLowerCase())];
    return mes ? `${m[3]}-${mes}-${m[1].padStart(2, '0')}` : null;
  });
  for (const [k, v] of b) if (!a.has(k)) a.set(k, v);
  return a;
}

const valores = (texto) => coletar(texto,
  /R\$\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?|\b(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?\s+reais\b/gi,
  (m) => { const i = soDigitos(m[1] || m[3] || ''); return i ? `${i},${m[2] || m[4] || '00'}` : null; });

const percentuais = (texto) => coletar(texto, /\b(\d{1,3}(?:,\d{1,2})?)\s?(?:%|por cento)/gi, (m) => m[1].replace(',', '.'));

const clausulas = (texto) => coletar(texto, /\bcl(?:áusula|ausula|\.)\s*(\d+(?:\.\d+)*)[ªa°º]?/gi, (m) => m[1]);

const documentos = (texto) => coletar(texto, /\b(Doc\.?|Documento|ANEXO|Anexo|evento|ev\.|fls?\.|ID)\s*(\d+)\b/g, (m) => {
  const tipo = m[1].toLowerCase().replace(/\.$/, '').replace('documento', 'doc').replace(/^ev$/, 'evento').replace(/^fl$/, 'fls');
  return `${tipo} ${m[2]}`;
});

const cnj = (texto) => coletar(texto, /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g, (m) => m[0]);

// Nomes próprios: 2+ palavras capitalizadas seguidas (com de/da/do/dos/das/e no meio),
// fora de uma lista de termos institucionais. É o detector de "texto de outro processo".
const INSTITUCIONAL = new Set(('Tribunal Justiça Estado Tocantins Palmas Vara Cível Juízo Poder Judiciário Código Processo Civil Lei '
  + 'Súmula Superior Supremo Federal Ministro Ministra Desembargador Desembargadora Juiz Juíza Direito República Brasil Defesa '
  + 'Consumidor Câmara Turma Seção Núcleo Apoio Secretaria Judicial Unificada Varas Cíveis Comarca Diário Eletrônico Nacional '
  + 'Conselho Registro Imóveis Cartório Ofício Oficial Ministério Público Defensoria Pública Fazenda Município União Banco Central '
  + 'Resolução Provimento Tema Recurso Especial Extraordinário Agravo Apelação Embargos Declaração Sentença Acórdão Autor Autora '
  + 'Réu Ré Requerente Requerido Requerida Apelante Apelado Apelada Parte Partes Excelentíssimo Senhor Doutor Doutora Dr Dra '
  + 'Vistos Isto Posto Ante Exposto Diante Assim Portanto Dispositivo Relatório Fundamentação Mérito Preliminar Preliminares '
  + 'Trata Cuida Juizado Juizados Especiais Sistema Núcleos Digital Decreto Emenda Constitucional Constituição Primeira Segunda '
  + 'Terceira Quarta Corte Plenário Órgão Instância Grau Secretário Secretária Escrivão Escrivã Analista Técnico Judiciária '
  + 'Loteamento Residencial Jardim Parque Setor Quadra Lote Rua Avenida Alameda Bairro Centro Egrégio Egrégia Colenda Colendo '
  + 'Instrução Normativa Fundação Instituto Brasileiro Geografia Estatística Data Hora Documento Assinado Digitalmente Pleno '
  + 'Procuradoria Geral Advocacia Ordem Advogados Seccional Tabela Índice Preços Amplo Taxa Referencial Selic Caderneta Poupança').split(/\s+/));

function nomes(texto) {
  const achadas = new Map();
  const rx = /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}(?:\s+(?:de|da|do|dos|das|e|d')\s+)?(?:\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}){1,4})\b/g;
  let m;
  while ((m = rx.exec(texto))) {
    const palavras = m[1].split(/\s+/).filter((p) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(p));
    if (palavras.length < 2) continue;
    if (palavras.every((p) => INSTITUCIONAL.has(p))) continue;
    if (palavras.some((p) => INSTITUCIONAL.has(p)) && palavras.length <= 2) continue;
    const chave = semAcento(m[1]).toUpperCase().replace(/\s+/g, ' ');
    if (!achadas.has(chave)) achadas.set(chave, { forma: m[1], pos: m.index, tam: m[0].length });
  }
  return achadas;
}

// ── Autos do caso ─────────────────────────────────────────────────────────
function arquivosDoCaso(pasta, decisao) {
  const saida = [];
  const andar = (dir, prof) => {
    if (prof > 3) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/(_assets|node_modules|\.git|^tmp)$/.test(e.name)) continue;
        andar(p, prof + 1);
        continue;
      }
      if (!e.name.endsWith('.md')) continue;
      if (/\.(index|validacao|estrutura|antes-humanizer)\.md$/.test(e.name)) continue;
      if (path.resolve(p) === path.resolve(decisao)) continue;
      saida.push(p);
    }
  };
  andar(pasta, 0);
  return saida;
}

function indexar(texto) {
  return {
    data: datas(texto), valor: valores(texto), percentual: percentuais(texto), clausula: clausulas(texto),
    documento: documentos(texto), cnj: cnj(texto), textoNorm: semAcento(texto).toUpperCase(),
  };
}

function presente(tipo, chave, indices) {
  for (const [arq, idx] of indices) {
    const ok = tipo === 'nome' ? idx.textoNorm.includes(chave) : idx[tipo].has(chave);
    if (ok) return path.basename(arq);
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const tudo = args.includes('--tudo');
  const pos = args.filter((a) => !a.startsWith('--'));
  if (!pos.length) sair('uso: conferir-decisao.js <caso> <decisao.md> | <caminho/decisao.md> [--json] [--tudo]');

  let decisao; let pasta;
  if (pos.length >= 2) {
    pasta = path.resolve(RAIZ, 'clientes', pos[0]);
    decisao = path.isAbsolute(pos[1]) ? pos[1] : path.resolve(pasta, pos[1]);
  } else {
    decisao = path.resolve(pos[0]);
    pasta = path.dirname(decisao);
  }
  if (!fs.existsSync(decisao)) sair(`decisão não encontrada: ${decisao}`);
  if (!fs.existsSync(pasta)) sair(`pasta do caso não encontrada: ${pasta}`);

  const textoDecisao = fs.readFileSync(decisao, 'utf8');
  const autos = arquivosDoCaso(pasta, decisao);
  if (!autos.length) sair(`nenhum .md além da decisão em ${pasta} — converter os autos com pdfmd antes`);
  const indices = autos.map((a) => [a, indexar(fs.readFileSync(a, 'utf8'))]);

  const grupos = [
    ['data', datas(textoDecisao)], ['valor', valores(textoDecisao)], ['percentual', percentuais(textoDecisao)],
    ['clausula', clausulas(textoDecisao)], ['documento', documentos(textoDecisao)], ['cnj', cnj(textoDecisao)],
    ['nome', nomes(textoDecisao)],
  ];

  const resultado = {
    decisao: path.relative(RAIZ, decisao), autos: autos.map((a) => path.relative(RAIZ, a)),
    faltam: [], faltamEmPrecedente: [], encontradas: [],
  };
  for (const [tipo, mapa] of grupos) {
    for (const [chave, { forma, pos: p, tam }] of mapa) {
      const onde = presente(tipo, chave, indices);
      if (onde) { resultado.encontradas.push({ tipo, forma, chave, onde }); continue; }
      (emPrecedente(textoDecisao, p, tam) ? resultado.faltamEmPrecedente : resultado.faltam).push({ tipo, forma, chave });
    }
  }

  if (json) { console.log(JSON.stringify(resultado, null, 1)); process.exit(resultado.faltam.length ? 1 : 0); }

  console.log(`conferir-decisao: ${resultado.decisao}`);
  console.log(`autos lidos (${autos.length}): ${resultado.autos.map((a) => path.basename(a)).join(', ')}\n`);
  const ordem = ['data', 'valor', 'percentual', 'clausula', 'documento', 'cnj', 'nome'];
  const rotulo = { data: 'Datas', valor: 'Valores', percentual: 'Percentuais', clausula: 'Cláusulas', documento: 'Documentos/eventos', cnj: 'Processos', nome: 'Nomes próprios' };
  for (const t of ordem) {
    const f = resultado.faltam.filter((x) => x.tipo === t);
    const e = resultado.encontradas.filter((x) => x.tipo === t);
    if (!f.length && !(tudo && e.length)) continue;
    console.log(`${rotulo[t]} — ${f.length} sem correspondência nos autos${e.length ? ` (${e.length} encontrada(s))` : ''}`);
    for (const x of f) console.log(`  ✘ ${x.forma}`);
    if (tudo) for (const x of e) console.log(`  ✔ ${x.forma}  → ${x.onde}`);
    console.log('');
  }
  if (resultado.faltamEmPrecedente.length) {
    console.log(`Em citação de precedente (${resultado.faltamEmPrecedente.length}, não são fatos do caso; listadas só para controle):`);
    console.log('  ' + resultado.faltamEmPrecedente.map((x) => x.forma).join(' · '));
    console.log('');
  }
  const total = resultado.faltam.length;
  console.log(total
    ? `${total} âncora(s) da decisão sem correspondência nos autos. Cada uma é candidata a erro de fato, erro material ou texto de outro processo: conferir no PDF original antes de alegar.`
    : 'Todas as âncoras do caso presentes na decisão têm correspondência nos autos.');
  console.log('Nomes próprios são heurística (maiúsculas): institucionais estão filtrados, mas conferir antes de concluir.');
  process.exit(total ? 1 : 0);
}

main();

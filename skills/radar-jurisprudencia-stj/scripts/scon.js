#!/usr/bin/env node
// scon.js — porta de entrada do radar-jurisprudencia-stj.
//
// Uso:
//   node scon.js buscar  --consultas consultas.json --saida tmp/radar-stj/<caso> [--por-pagina 50]
//   node scon.js cabecalhos --saida tmp/radar-stj/<caso> [--frente <id>]
//   node scon.js lotes   --saida tmp/radar-stj/<caso> [--top N] [--tamanho 30] [--incluir-similares]
//   node scon.js conferir --saida tmp/radar-stj/<caso>
//   node scon.js ementas --saida tmp/radar-stj/<caso> --registros 202302406926,202503141132
//   node scon.js teor    --saida tmp/radar-stj/<caso> --registros 202302406926,202503141132 [--sem-converter]
//   node scon.js acordao --numero "REsp 805.919/MG" [--saida tmp/radar-stj/<caso>] [--verificar]
//   node scon.js verificar --registros 202302406926,202503141132 | --todos
//   (depósito no acervo: depositar.js, ao lado deste)
//
// `verificar` lê o acompanhamento processual do STJ de acórdãos que já estão na biblioteca,
// grava <base>.processo.json (partes, advogados, fases) e acende o semáforo de alteração
// posterior (VERDE/AMARELO/CINZA), que vai para a coluna Situação do INDICE.md.
//
// `buscar` grava <saida>/resultados.json e <saida>/triagem.md. `lotes` monta o
// candidatos.json no formato do radar-jurisprudencia e o fatia com o lotes.js de lá, para a
// triagem Haiku: o orquestrador nunca lê as ementas todas. `ementas` imprime a ementa
// integral só dos registros pedidos. `teor` lê o resultados.json da mesma pasta para achar a
// data de publicação de cada registro, baixa o PDF do inteiro teor na biblioteca
// jurisprudencia-stj/ (raiz do workspace, compartilhada entre casos, fora do git), converte
// com o pdfmd (--no-tables, padrão para acórdão do STJ) e registra no INDICE.md de lá.
// Acórdão que já está na biblioteca não é baixado nem convertido de novo.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const MOTOR = path.join(__dirname, 'scon.py');
const PDFMD = path.join(RAIZ, 'skills', 'pdfmd', 'scripts', 'executar-pdfmd.js');
const LOTES = path.join(RAIZ, 'skills', 'radar-jurisprudencia', 'scripts', 'lotes.js');
const BIBLIOTECA = path.join(RAIZ, 'jurisprudencia-stj');

function sair(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

function python() {
  const amb = path.join(RAIZ, 'perfil', 'ambiente.json');
  if (!fs.existsSync(amb)) sair('perfil/ambiente.json não existe — rode: node scripts/setup.js');
  const py = JSON.parse(fs.readFileSync(amb, 'utf8')).python;
  if (!py || !fs.existsSync(py)) sair('Python do adv_env não encontrado — rode: node scripts/setup.js');
  return py;
}

function opcoes(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

function motor(args) {
  const r = spawnSync(python(), [MOTOR, ...args], {
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    stdio: 'inherit',
  });
  if (r.error) sair(r.error.message, 1);
  return r.status ?? 1;
}

// 'REsp 2084975 / MT RECURSO ESPECIAL ...' -> 'REsp 2084975/MT' (exibição) e 'REsp2084975_MT' (arquivo)
const RX_PROC = /^(.+?\d+)\s*\/\s*([A-Z]{2})/;
function citacao(doc) {
  const m = RX_PROC.exec(doc.processo || '');
  return m ? `${m[1]}/${m[2]}` : doc.num_registro;
}
function nomeArquivo(doc) {
  const m = RX_PROC.exec(doc.processo || '');
  const base = m ? `${m[1]}_${m[2]}` : doc.num_registro;
  return base.replace(/\s+/g, '').replace(/[^\w.-]/g, '_');
}

function buscar(o) {
  if (!o.consultas || !o.saida) sair('uso: scon.js buscar --consultas <arq.json> --saida <pasta>');
  const saida = path.resolve(o.saida);
  fs.mkdirSync(saida, { recursive: true });
  const status = motor(['buscar', path.resolve(o.consultas), saida, String(o['por-pagina'] || 50)]);
  if (status === 0) registrarBusca(saida);
  return status;
}

// BUSCAS.md da biblioteca: como cada busca foi feita, para a titular conferir e refazer.
// O SCON não aceita link direto (a URL de resultado, aberta fora da sessão, volta para a
// home); o que reproduz a busca é colar a consulta no campo "Pesquisa" com os mesmos filtros.
const FILTROS = { ementa: 'Ementa', classe: 'Classe', uf: 'UF', processo: 'Processo',
  dtpb1: 'Publicação de', dtpb2: 'Publicação até', dtde1: 'Julgamento de', dtde2: 'Julgamento até' };

function registrarBusca(saida, rotulo) {
  const res = JSON.parse(fs.readFileSync(path.join(saida, 'resultados.json'), 'utf8'));
  const arq = path.join(BIBLIOTECA, 'BUSCAS.md');
  fs.mkdirSync(BIBLIOTECA, { recursive: true });
  if (!fs.existsSync(arq)) {
    fs.writeFileSync(arq, '# Buscas no SCON/STJ\n\n'
      + 'Registro automático de cada busca da skill radar-jurisprudencia-stj. Para refazer: abrir '
      + 'https://scon.stj.jus.br/SCON/, colar a consulta no campo "Pesquisa" e aplicar os filtros '
      + 'da linha. O resultado pode crescer com acórdãos publicados depois.\n');
  }
  const cel = (s) => String(s).replace(/\|/g, '\\|');
  const quando = rotulo || new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' });
  let txt = `\n## ${quando} — caso \`${path.basename(saida)}\`\n\n`
    + '| Frente | Consulta (colar no SCON) | Filtros | Acórdãos | Lidos |\n|---|---|---|---|---|\n';
  for (const q of res) {
    const filtros = Object.entries(FILTROS).filter(([k]) => q[k]).map(([k, n]) => `${n}: ${q[k]}`).join('; ');
    txt += `| ${cel(q.id)} | \`${cel(q.livre || '')}\` | ${cel(filtros || '—')} | ${q.total} | ${q.docs.length} |\n`;
  }
  fs.appendFileSync(arq, txt);
  console.log(`Busca registrada em ${arq}`);
}

// Índice registro -> { doc, consultas } a partir do resultados.json da pasta.
function indice(saida) {
  const arqRes = path.join(saida, 'resultados.json');
  if (!fs.existsSync(arqRes)) sair(`${arqRes} não existe — rode buscar com a mesma --saida antes`);
  const idx = new Map();
  for (const q of JSON.parse(fs.readFileSync(arqRes, 'utf8'))) {
    for (const d of q.docs) {
      const k = d.num_registro || d.processo;
      if (!idx.has(k)) idx.set(k, { doc: d, consultas: [] });
      if (!idx.get(k).consultas.includes(q.id)) idx.get(k).consultas.push(q.id);
    }
  }
  return idx;
}

function registros(o) {
  return String(o.registros || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Abertura da ementa sem pontuação nem caixa: dois AgInt do mesmo relator e órgão com a
// mesma abertura são a mesma tese repetida (série de casos idênticos).
const assinatura = (d) => [
  d.relator, d.orgao,
  (d.ementa || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 300),
].join('|');

// Ementa longa: abertura (cabeçalho e caso) e fecho (dispositivo e tese) são o que a triagem
// precisa; o miolo repete precedentes. Mantém o lote em ~20 mil tokens.
function compactar(ementa = '') {
  return ementa.length <= 2600 ? ementa : `${ementa.slice(0, 1800)} [...] ${ementa.slice(-700)}`;
}

// Ordem de triagem por rodízio entre as consultas: a 1ª de cada frente, depois a 2ª de cada,
// e assim por diante. Ranking global ("aparece em mais frentes") deixaria as frentes
// estreitas — justamente a contrária — inteiras fora do corte.
function emRodizio(saida, idx) {
  const res = JSON.parse(fs.readFileSync(path.join(saida, 'resultados.json'), 'utf8'));
  const filas = res.map((q) => q.docs.map((d) => d.num_registro || d.processo));
  const ordem = [];
  const visto = new Set();
  for (let i = 0; filas.some((f) => i < f.length); i++) {
    for (const f of filas) {
      if (i < f.length && !visto.has(f[i])) { visto.add(f[i]); ordem.push([f[i], idx.get(f[i])]); }
    }
  }
  return ordem;
}

// Candidatos no formato do radar-jurisprudencia, em rodízio, com similares marcados.
function montarCandidatos(saida) {
  const principais = new Map();
  return emRodizio(saida, indice(saida)).map(([reg, { doc, consultas }]) => {
    const sig = assinatura(doc);
    const principal = principais.get(sig);
    if (!principal) principais.set(sig, reg);
    return {
      id: reg,
      tribunal: 'STJ',
      tipoDocumento: 'acórdão',
      classe: citacao(doc),
      relator: doc.relator,
      so_ementa: true,
      natureza: principal ? 'similar' : 'principal',
      similar_de: principal,
      trecho: `[frentes: ${consultas.join(', ')}] ${doc.orgao || ''} · j. ${doc.julgamento || ''}\n`
        + `${compactar(doc.ementa)}${doc.notas ? `\nNOTAS: ${doc.notas}` : ''}`,
      cabecalho: cabecalho(doc.ementa),
      onde: `${consultas.join(', ')} | ${doc.orgao || ''} · j. ${doc.julgamento || ''}`,
    };
  });
}

// Cabeçalho da ementa do STJ: a enumeração em maiúsculas antes do "I. CASO EM EXAME" ou do
// item "1.". Traz tema, súmula aplicada e resultado; é o que a triagem precisa na 1ª leitura.
function cabecalho(ementa = '') {
  const m = /^(.*?)(?=\s(?:I\.\s*(?:CASO|HIP[ÓO]TESE)|1\.\s|1-\s|I\s-\s|-\s*CASO))/is.exec(ementa);
  return (m ? m[1] : ementa).slice(0, 450).trim();
}

// Triagem padrão: uma linha por acórdão principal, ~110 tokens cada. Similares saem (apontam
// para o principal) e o rodízio entre frentes mantém a contrária perto do topo.
function cabecalhos(o) {
  if (!o.saida) sair('uso: scon.js cabecalhos --saida <pasta> [--frente <id>]');
  const saida = path.resolve(o.saida);
  let cand = montarCandidatos(saida).filter((c) => c.natureza === 'principal');
  if (o.frente) cand = cand.filter((c) => c.onde.split(' | ')[0].split(', ').includes(o.frente));
  for (const c of cand) console.log(`${c.id} | ${c.classe} | ${c.onde} | ${c.cabecalho}`);
  console.log(`\n${cand.length} principais. Ementa integral: scon.js ementas --registros <ids>`);
  return 0;
}

function lotes(o) {
  if (!o.saida) sair('uso: scon.js lotes --saida <pasta> [--top N] [--tamanho 30]');
  const saida = path.resolve(o.saida);
  const candidatos = montarCandidatos(saida).map(({ cabecalho: _c, onde: _o, ...c }) => c);
  const arqCand = path.join(saida, 'candidatos.json');
  fs.writeFileSync(arqCand, JSON.stringify({ candidatos }, null, 1));

  const args = [LOTES, '--entrada', arqCand, '--saida', path.join(saida, 'lotes'),
    // Sem corte por padrão: o corte em 90 deixou de fora o melhor julgado de um caso real
    // (REsp 2.084.975, 25º da sua frente). Triagem é Haiku; perder o finalista custa mais.
    '--top', String(o.top || candidatos.length), '--tamanho', String(o.tamanho || 30)];
  if (o['incluir-similares']) args.push('--incluir-similares');
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  return r.status ?? 1;
}

// Triador Haiku pode pular item sem avisar (aconteceu num caso real, e era um contrário).
// Cruza lotes/lote-N.json com lotes/resposta-N.txt: lista os ids sem resposta e só as
// linhas F e C, que são o que o orquestrador precisa ler.
function conferir(o) {
  if (!o.saida) sair('uso: scon.js conferir --saida <pasta>');
  const pasta = path.join(path.resolve(o.saida), 'lotes');
  const faltam = [];
  const fc = [];
  for (const arq of fs.readdirSync(pasta).filter((f) => /^lote-\d+\.json$/.test(f))) {
    const n = /\d+/.exec(arq)[0];
    const ids = JSON.parse(fs.readFileSync(path.join(pasta, arq), 'utf8')).map((c) => c.id);
    const arqResp = path.join(pasta, `resposta-${n}.txt`);
    const linhas = fs.existsSync(arqResp) ? fs.readFileSync(arqResp, 'utf8').split('\n') : [];
    const resp = new Map(linhas.map((l) => [l.split('|')[0].trim(), l]).filter(([id]) => id));
    for (const id of ids) {
      if (!resp.has(id)) faltam.push(`${id} (lote ${n})`);
      else if (/^\S+\s*\|\s*[FC]\b/.test(resp.get(id))) fc.push(resp.get(id).trim());
    }
  }
  console.log(fc.join('\n'));
  console.log(`\n${fc.length} linhas F/C.`);
  if (faltam.length) console.log(`SEM RESPOSTA (triar de novo): ${faltam.join(', ')}`);
  return faltam.length ? 1 : 0;
}

function ementas(o) {
  if (!o.saida || !o.registros) sair('uso: scon.js ementas --saida <pasta> --registros <reg1,reg2>');
  const idx = indice(path.resolve(o.saida));
  for (const reg of registros(o)) {
    const e = idx.get(reg);
    if (!e) { console.log(`## ${reg} — não está no resultados.json\n`); continue; }
    const d = e.doc;
    console.log(`## ${citacao(d)} — ${d.orgao || ''} — ${d.relator || ''}`
      + ` — j. ${d.julgamento || ''} — ${d.publicacao || ''} — registro ${reg}`);
    console.log(`${d.ementa || ''}${d.notas ? `\nNOTAS: ${d.notas}` : ''}\n`);
  }
  return 0;
}

function teor(o) {
  if (!o.saida || !o.registros) sair('uso: scon.js teor --saida <pasta> --registros <reg1,reg2>');
  const saida = path.resolve(o.saida);
  const idx = indice(saida);
  const itens = [];
  for (const reg of registros(o)) {
    const d = idx.get(reg)?.doc;
    if (!d || !d.dt_publicacao) sair(`registro ${reg} não está no resultados.json (ou veio sem link de inteiro teor)`);
    itens.push({ nome: nomeArquivo(d), num_registro: reg, dt_publicacao: d.dt_publicacao });
  }

  // Biblioteca compartilhada entre casos: o acórdão que já está lá não se baixa nem se
  // converte de novo, e quem confere abre o PDF num lugar só.
  const pasta = BIBLIOTECA;
  fs.mkdirSync(pasta, { recursive: true });
  const nomeBase = (it) => `${it.num_registro}_${it.nome}`;
  const faltam = itens.filter((it) => !fs.existsSync(path.join(pasta, `${nomeBase(it)}.pdf`)));
  for (const it of itens.filter((x) => !faltam.includes(x))) console.log(`${nomeBase(it)}.pdf  já na biblioteca`);

  let status = 0;
  if (faltam.length) {
    const arqItens = path.join(saida, '_itens-teor.json');
    fs.writeFileSync(arqItens, JSON.stringify(faltam.map((it) => ({ ...it, nome: nomeBase(it) })), null, 1));
    status = motor(['teor', arqItens, pasta]);
    fs.rmSync(arqItens, { force: true });
  }

  for (const it of itens) {
    const pdf = path.join(pasta, `${nomeBase(it)}.pdf`);
    if (!fs.existsSync(pdf)) continue;
    if (!o['sem-converter'] && !fs.existsSync(pdf.replace(/\.pdf$/, '.md'))) {
      const r = spawnSync(process.execPath,
        [PDFMD, pdf, '--ocr', 'auto', '--lang', 'por', '--page-breaks', '--no-tables'],
        { stdio: ['ignore', 'ignore', 'inherit'] });
      console.log(`${nomeBase(it)}.md  ${r.status === 0 ? 'convertido' : 'FALHOU a conversão'}`);
    }
    gravarMeta(nomeBase(it), idx.get(it.num_registro), path.basename(saida));
  }
  reindexar();
  console.log(`\nBiblioteca: ${pasta}`);
  return status;
}

// <base>.scon.json: o espelho do SCON de cada acórdão da biblioteca, mais os casos e frentes
// que o acharam. É de onde saem o INDICE.md e o depósito no acervo.
function gravarMeta(base, { doc, consultas }, caso) {
  const arq = path.join(BIBLIOTECA, `${base}.scon.json`);
  const meta = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { doc, achado_em: {} };
  meta.doc = doc;
  meta.achado_em[caso] = [...new Set([...(meta.achado_em[caso] || []), ...consultas])];
  fs.writeFileSync(arq, JSON.stringify(meta, null, 1));
}

function metas() {
  if (!fs.existsSync(BIBLIOTECA)) return [];
  return fs.readdirSync(BIBLIOTECA).filter((f) => f.endsWith('.scon.json')).map((f) => {
    const base = f.replace(/\.scon\.json$/, '');
    const proc = path.join(BIBLIOTECA, `${base}.processo.json`);
    return { base, ...JSON.parse(fs.readFileSync(path.join(BIBLIOTECA, f), 'utf8')),
      processo: fs.existsSync(proc) ? JSON.parse(fs.readFileSync(proc, 'utf8')) : null };
  });
}

// INDICE.md da biblioteca, regenerado inteiro a cada mudança: uma linha por acórdão, para
// quem abre a pasta sem ser agente. "Achado em" liga o acórdão às buscas do BUSCAS.md.
function reindexar() {
  const cel = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const linhas = metas().map(({ base, doc: d, achado_em: a, processo: p }) => {
    const sit = p?.semaforo ? `${p.semaforo.cor} (${p.lido_em})` : 'não verificado';
    const achado = Object.entries(a || {}).map(([c, fs_]) => `${c}: ${fs_.join(', ')}`).join('; ');
    return `| ${cel(citacao(d))} | ${cel(d.orgao)} | ${cel(d.julgamento)} | ${cel(d.publicacao)}`
      + ` | [PDF](${base}.pdf) · [texto](${base}.md) | ${cel(sit)} | ${cel(achado)}`
      + ` | ${cel((d.ementa || '').slice(0, 160))}… |`;
  });
  fs.writeFileSync(path.join(BIBLIOTECA, 'INDICE.md'), '# Biblioteca de acórdãos do STJ\n\n'
    + 'Baixados do SCON pela skill radar-jurisprudencia-stj. Fora do git: o inteiro teor traz '
    + 'nome de parte. Para citar em peça, o julgado precisa entrar no acervo (ver a SKILL.md). '
    + 'Situação: VERDE = transitou sem recurso posterior; AMARELO = houve recurso ou decisão '
    + 'depois da publicação, ler antes de citar; CINZA = ainda sem trânsito ou não lido.\n\n'
    + '| Acórdão | Órgão | Julgamento | Publicação | Arquivo | Situação | Achado em | Ementa (início) |\n'
    + '|---|---|---|---|---|---|---|---|\n' + linhas.join('\n') + '\n');
}

// Semáforo de alteração posterior, a partir das fases do acompanhamento processual. Só conta
// o que veio DEPOIS da publicação do acórdão guardado: o mesmo registro abriga AgInt, EDcl e
// EREsp sucessivos, e um acolhimento posterior pode mudar o resultado que a peça citaria.
const RX_POSTERIOR = /(embargos de declara|agravo interno|agravo regimental|embargos de diverg|recurso extraordin|acolhid|provid|reconsider|retrata|anulad|sem efeito|rescis[oó]ria)/i;
const RX_TRANSITO = /(transitad[oa] em julgado|tr[aâ]nsito em julgado|baixa definitiva)/i;
const aaaammdd = (s) => (/(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '') || []).slice(1).reverse().join('');

function semaforo(processo, dtPublicacao) {
  const pub = aaaammdd(dtPublicacao);
  const depois = processo.fases.filter((f) => aaaammdd(f.data) > pub);
  const suspeitas = depois.filter((f) => RX_POSTERIOR.test(f.texto));
  const transito = processo.fases.find((f) => RX_TRANSITO.test(f.texto));
  if (suspeitas.length) {
    return { cor: 'AMARELO', motivo: suspeitas.slice(0, 3).map((f) => `${f.data}: ${f.texto}`).join(' | ') };
  }
  if (transito) return { cor: 'VERDE', motivo: `${transito.data}: ${transito.texto}` };
  return { cor: 'CINZA', motivo: 'sem trânsito em julgado nem baixa registrados (prazo em curso?)' };
}

// Acórdão específico: "REsp 805.919/MG" -> consulta "REsp 805919" (o SCON não acha o número
// com ponto nem com a UF). A mesma consulta traz o REsp, o AgInt no REsp e os EDcl do
// processo; fica o que bate com classe, número e UF digitados.
function acordao(o) {
  const pedido = String(o.numero || '').trim();
  const m = /^(.*?)\s*n?[º°.]?\s*([\d.]+)\s*(?:\/\s*([A-Za-z]{2}))?\s*$/.exec(pedido);
  if (!m || !m[1]) sair('uso: scon.js acordao --numero "REsp 805.919/MG" [--saida tmp/radar-stj/<caso>] [--verificar]');
  const classe = m[1].trim().replace(/\s+/g, ' ');
  const numero = m[2].replace(/\D/g, '');
  const uf = (m[3] || '').toUpperCase();
  const saida = path.resolve(o.saida || path.join(RAIZ, 'tmp', 'radar-stj', '_acordaos'));
  fs.mkdirSync(saida, { recursive: true });
  const arqConsulta = path.join(saida, 'consultas.json');
  const id = `${classe} ${numero}${uf ? `/${uf}` : ''}`;
  fs.writeFileSync(arqConsulta, JSON.stringify([{ id, livre: `${classe} ${numero}` }], null, 1));
  if (buscar({ consultas: arqConsulta, saida }) !== 0) return 1;

  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const docs = [...indice(saida).values()].map((e) => e.doc);
  const exatos = docs.filter((d) => {
    const r = RX_PROC.exec(d.processo || '');
    return r && norm(r[1]) === norm(`${classe} ${numero}`) && (!uf || r[2] === uf);
  });
  if (exatos.length !== 1) {
    console.log(`\n${exatos.length ? 'Mais de um' : 'Nenhum'} acórdão com classe, número e UF exatos. Encontrados:`);
    for (const d of docs) console.log(`  ${d.num_registro} | ${citacao(d)} | ${d.orgao || ''} | j. ${d.julgamento || ''}`);
    console.log('Escolher o registro e rodar: scon.js teor --saida <mesma pasta> --registros <registro>');
    return exatos.length ? 0 : 1;
  }
  const reg = exatos[0].num_registro;
  const st = teor({ saida, registros: reg });
  if (o.verificar && st === 0) verificar({ registros: reg });
  return st;
}

function verificar(o) {
  if (!o.registros && !o.todos) sair('uso: scon.js verificar --registros <reg1,reg2> | --todos');
  const todas = metas();
  const alvo = o.todos ? todas : todas.filter((m) => registros(o).includes(m.doc.num_registro));
  const faltam = o.todos ? [] : registros(o).filter((r) => !todas.some((m) => m.doc.num_registro === r));
  if (faltam.length) sair(`não estão na biblioteca (rode teor antes): ${faltam.join(', ')}`);

  const arqItens = path.join(BIBLIOTECA, '_itens-processo.json');
  fs.writeFileSync(arqItens, JSON.stringify(alvo.map((m) => ({ nome: m.base, num_registro: m.doc.num_registro })), null, 1));
  const status = motor(['processo', arqItens, BIBLIOTECA]);
  fs.rmSync(arqItens, { force: true });

  for (const m of alvo) {
    const arq = path.join(BIBLIOTECA, `${m.base}.processo.json`);
    if (!fs.existsSync(arq)) { console.log(`CINZA    ${citacao(m.doc)} — acompanhamento não lido`); continue; }
    const p = JSON.parse(fs.readFileSync(arq, 'utf8'));
    p.semaforo = semaforo(p, m.doc.dt_publicacao);
    fs.writeFileSync(arq, JSON.stringify(p, null, 1));
    console.log(`${p.semaforo.cor.padEnd(8)} ${citacao(m.doc)} — ${p.semaforo.motivo}`);
  }
  reindexar();
  console.log('\nVERDE não dispensa ler o voto; AMARELO exige ver a decisão posterior antes de citar.');
  return status;
}

const [cmd, ...resto] = process.argv.slice(2);
const o = opcoes(resto);
if (cmd === 'buscar') process.exit(buscar(o));
if (cmd === 'registrar') { registrarBusca(path.resolve(o.saida), o.rotulo); process.exit(0); }
if (cmd === 'cabecalhos') process.exit(cabecalhos(o));
if (cmd === 'lotes') process.exit(lotes(o));
if (cmd === 'conferir') process.exit(conferir(o));
if (cmd === 'ementas') process.exit(ementas(o));
if (cmd === 'teor') process.exit(teor(o));
if (cmd === 'verificar') process.exit(verificar(o));
if (cmd === 'acordao') process.exit(acordao(o));
if (cmd === 'reindexar') { reindexar(); process.exit(0); }
sair('uso: scon.js buscar|cabecalhos|lotes|conferir|ementas|teor|verificar ... (ver o cabeçalho deste arquivo)');

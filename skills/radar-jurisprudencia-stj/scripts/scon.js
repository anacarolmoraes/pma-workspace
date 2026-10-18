#!/usr/bin/env node
// scon.js — porta de entrada do radar-jurisprudencia-stj.
//
// Uso:
//   node scon.js buscar  --consultas consultas.json --saida tmp/radar-stj/<caso> [--por-pagina 50] [--paginas N] [--retomar]
//   node scon.js cabecalhos --saida tmp/radar-stj/<caso> [--frente <id>]
//   node scon.js lotes   --saida tmp/radar-stj/<caso> [--top N] [--tamanho 30] [--incluir-similares]
//   node scon.js conferir --saida tmp/radar-stj/<caso> [--marcas triagem-marcada.txt]
//   node scon.js ementas --saida tmp/radar-stj/<caso> --registros 202302406926,202503141132
//   node scon.js teor    --saida tmp/radar-stj/<caso> --registros 202302406926,202503141132 [--sem-converter]
//   node scon.js acordao --numero "REsp 805.919/MG" [--caso <nome>] [--saida tmp/radar-stj/<caso>] [--verificar]
//   node scon.js verificar --registros 202302406926,202503141132 | --todos
//   node scon.js citados --registro 202302406926 | --saida <pasta> --registros <regs>
//   node scon.js migrar | reindexar
//   (depósito no acervo: depositar.js, ao lado deste)
//
// Biblioteca jurisprudencia-stj/ (raiz do workspace, fora do git, compartilhada entre casos):
// uma PASTA por acórdão, <registro>_<classe>/, com o PDF, o .md do pdfmd e seus sidecars,
// <base>.scon.json (espelho + casos que o acharam) e <base>.processo.json (acompanhamento e
// semáforo). INDICE.md na raiz da biblioteca, regenerado a cada mudança. `migrar` leva para
// pastas o que ficou solto do formato anterior.
//
// `verificar` lê o acompanhamento processual do STJ e acende o semáforo de alteração
// posterior: VERDE (transitou; recurso posterior, se houve, não alterou), AMARELO (recurso
// posterior pendente ou decisão que pode ter alterado o resultado), CINZA (sem trânsito).
//
// `buscar` grava <saida>/resultados.json e <saida>/triagem.md. `lotes` monta o
// candidatos.json no formato do radar-jurisprudencia e o fatia com o lotes.js de lá, para a
// triagem Haiku: o orquestrador nunca lê as ementas todas. `ementas` imprime a ementa
// integral só dos registros pedidos. `teor` baixa o inteiro teor na biblioteca e converte
// com o pdfmd (--no-tables, padrão para acórdão do STJ); monocrática não tem PDF, o texto do
// espelho vira o .md. Acórdão que já está na biblioteca não é baixado nem convertido de novo.
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
// Pasta do acórdão na biblioteca: <registro>_<classe>/. Monocrática leva sufixo, porque o
// mesmo registro pode ter acórdão e decisão monocrática.
const nomeBase = (doc) => `${doc.num_registro}_${nomeArquivo(doc)}${doc.tipo === 'monocratica' ? '_mono' : ''}`;
const pastaDe = (base) => path.join(BIBLIOTECA, base);

// ── Busca ─────────────────────────────────────────────────────────────────
function buscar(o) {
  if (!o.consultas || !o.saida) sair('uso: scon.js buscar --consultas <arq.json> --saida <pasta> [--paginas N] [--retomar]');
  const saida = path.resolve(o.saida);
  fs.mkdirSync(saida, { recursive: true });
  let arqConsultas = path.resolve(o.consultas);
  if (o.paginas) {
    // `--paginas` vale para todas as consultas que não declaram o seu.
    const cs = JSON.parse(fs.readFileSync(arqConsultas, 'utf8')).map((c) => ({ paginas: Number(o.paginas), ...c }));
    arqConsultas = path.join(saida, '_consultas-efetivas.json');
    fs.writeFileSync(arqConsultas, JSON.stringify(cs, null, 1));
  }
  const args = ['buscar', arqConsultas, saida, String(o['por-pagina'] || 50)];
  if (o.retomar) args.push('retomar');
  const status = motor(args);
  if (status === 0) registrarBusca(saida);
  else if (fs.existsSync(path.join(saida, 'resultados.json'))) {
    console.log('Busca interrompida: o que já veio está em resultados.json. Para continuar de onde parou: mesma linha com --retomar');
  }
  return status;
}

// BUSCAS.md da biblioteca: como cada busca foi feita, para a titular conferir e refazer.
// O SCON não aceita link direto (a URL de resultado, aberta fora da sessão, volta para a
// home); o que reproduz a busca é colar a consulta no campo "Pesquisa" com os mesmos filtros.
const FILTROS = { ementa: 'Ementa', classe: 'Classe', uf: 'UF', processo: 'Processo',
  dtpb1: 'Publicação de', dtpb2: 'Publicação até', dtde1: 'Julgamento de', dtde2: 'Julgamento até',
  base: 'Base', paginas: 'Páginas' };

function registrarBusca(saida, rotulo) {
  const res = JSON.parse(fs.readFileSync(path.join(saida, 'resultados.json'), 'utf8'));
  const arq = path.join(BIBLIOTECA, 'BUSCAS.md');
  fs.mkdirSync(BIBLIOTECA, { recursive: true });
  if (!fs.existsSync(arq)) {
    fs.writeFileSync(arq, '# Buscas no SCON/STJ\n\n'
      + 'Registro automático de cada busca da skill radar-jurisprudencia-stj. Para refazer: abrir '
      + 'https://scon.stj.jus.br/SCON/, colar a consulta no campo "Pesquisa" e aplicar os filtros '
      + 'da linha (Base: monocraticas = aba "Decisões Monocráticas"). O resultado pode crescer com '
      + 'acórdãos publicados depois.\n');
  }
  const cel = (s) => String(s).replace(/\|/g, '\\|');
  const quando = rotulo || new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' });
  let txt = `\n## ${quando} — caso \`${path.basename(saida)}\`\n\n`
    + '| Frente | Consulta (colar no SCON) | Filtros | Documentos | Lidos |\n|---|---|---|---|---|\n';
  for (const q of res) {
    const filtros = Object.entries(FILTROS).filter(([k]) => q[k] && !(k === 'paginas' && Number(q[k]) <= 1))
      .map(([k, n]) => `${n}: ${q[k]}`).join('; ');
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

// ── Triagem ───────────────────────────────────────────────────────────────
// Abertura da ementa sem pontuação nem caixa: dois AgInt do mesmo relator e órgão com a
// mesma abertura são a mesma tese repetida (série de casos idênticos). A ementa padronizada
// (2024 em diante) começa por cabeçalho genérico, por isso a assinatura pula o cabeçalho e
// usa o primeiro item numerado quando ele existe.
const assinatura = (d) => {
  const e = d.ementa || '';
  const corpo = e.slice(cabecalho(e).length) || e;
  return [d.relator, d.orgao,
    corpo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 300),
  ].join('|');
};

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
    const mono = doc.tipo === 'monocratica' ? ' · MONOCRÁTICA' : '';
    return {
      id: reg,
      tribunal: 'STJ',
      tipoDocumento: doc.tipo === 'monocratica' ? 'decisão monocrática' : 'acórdão',
      classe: citacao(doc),
      relator: doc.relator,
      so_ementa: true,
      natureza: principal ? 'similar' : 'principal',
      similar_de: principal,
      trecho: `[frentes: ${consultas.join(', ')}] ${doc.orgao || ''}${mono} · j. ${doc.julgamento || doc.publicacao || ''}\n`
        + `${compactar(doc.ementa)}${doc.notas ? `\nNOTAS: ${doc.notas}` : ''}`,
      cabecalho: cabecalho(doc.ementa),
      onde: `${consultas.join(', ')} | ${doc.orgao || ''}${mono} · j. ${doc.julgamento || doc.publicacao || ''}`,
    };
  });
}

// Cabeçalho da ementa do STJ: a enumeração em maiúsculas antes do "I. CASO EM EXAME" ou do
// item "1.". Traz tema, súmula aplicada e resultado; é o que a triagem precisa na 1ª leitura.
function cabecalho(ementa = '') {
  const m = /^(.*?)(?=\s(?:I\.\s*(?:CASO|HIP[ÓO]TESE)|1\.\s|1-\s|I\s-\s|-\s*CASO))/is.exec(ementa);
  return (m ? m[1] : ementa).slice(0, 450).trim();
}

// Triagem padrão: uma linha por documento principal, ~110 tokens cada. Similares saem, mas a
// linha do principal diz quantos agrupa, para a triagem saber que há série atrás dele.
function cabecalhos(o) {
  if (!o.saida) sair('uso: scon.js cabecalhos --saida <pasta> [--frente <id>]');
  const saida = path.resolve(o.saida);
  const todos = montarCandidatos(saida);
  const similares = new Map();
  for (const c of todos) if (c.natureza === 'similar') similares.set(c.similar_de, (similares.get(c.similar_de) || 0) + 1);
  let cand = todos.filter((c) => c.natureza === 'principal');
  if (o.frente) cand = cand.filter((c) => c.onde.split(' | ')[0].split(', ').includes(o.frente));
  for (const c of cand) {
    const n = similares.get(c.id);
    console.log(`${c.id} | ${c.classe}${n ? ` (+${n} similar${n > 1 ? 'es' : ''})` : ''} | ${c.onde} | ${c.cabecalho}`);
  }
  const agrupados = [...similares.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${cand.length} principais${agrupados ? `, ${agrupados} similares agrupados (lotes --incluir-similares para triá-los)` : ''}.`
    + ' Ementa integral: scon.js ementas --registros <ids>.'
    + `\nMarcação: gravar em ${path.join(saida, 'triagem-marcada.txt')} uma linha por principal`
    + ' ("registro | F, C ou I | ÓBICE ou MÉRITO | frente | motivo") e rodar scon.js conferir --saida <pasta>.');
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

// Lê respostas "id | F/C/I | ..." de um arquivo. Devolve Map id -> linha.
function lerMarcas(arq) {
  const linhas = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8').split('\n') : [];
  return new Map(linhas.map((l) => [l.split('|')[0].trim(), l.trim()]).filter(([id]) => /^\d{6,}$/.test(id)));
}

// Conferência da triagem. Dois modos:
//  - lotes Haiku: cruza lotes/lote-N.json com lotes/resposta-N.txt (o triador pode pular item
//    sem avisar — aconteceu num caso real, e era um contrário);
//  - cabeçalhos (padrão): cruza os principais com <saida>/triagem-marcada.txt, o arquivo em
//    que o modelo principal grava a marcação. Sem ele, a triagem não deixa rastro e a titular
//    não vê o que foi descartado.
// Imprime só as linhas F e C, grava triagem-marcada.md para a titular e sai com 1 se faltou item.
function conferir(o) {
  if (!o.saida) sair('uso: scon.js conferir --saida <pasta> [--marcas <arquivo>]');
  const saida = path.resolve(o.saida);
  const pastaLotes = path.join(saida, 'lotes');
  const faltam = [];
  const fc = [];
  const todas = [];
  const modoLotes = !o.marcas && fs.existsSync(pastaLotes)
    && fs.readdirSync(pastaLotes).some((f) => /^lote-\d+\.json$/.test(f));
  if (modoLotes) {
    for (const arq of fs.readdirSync(pastaLotes).filter((f) => /^lote-\d+\.json$/.test(f))) {
      const n = /\d+/.exec(arq)[0];
      const ids = JSON.parse(fs.readFileSync(path.join(pastaLotes, arq), 'utf8')).map((c) => c.id);
      const resp = lerMarcas(path.join(pastaLotes, `resposta-${n}.txt`));
      for (const id of ids) {
        if (!resp.has(id)) faltam.push(`${id} (lote ${n})`);
        else todas.push(resp.get(id));
      }
    }
  } else {
    const arq = path.resolve(o.marcas || path.join(saida, 'triagem-marcada.txt'));
    if (!fs.existsSync(arq)) sair(`${arq} não existe — gravar a marcação (uma linha por principal) antes de conferir`);
    const resp = lerMarcas(arq);
    for (const c of montarCandidatos(saida).filter((c) => c.natureza === 'principal')) {
      if (!resp.has(c.id)) faltam.push(c.id);
      else todas.push(resp.get(c.id));
    }
  }
  for (const l of todas) if (/^\S+\s*\|\s*[FC]\b/.test(l)) fc.push(l);
  console.log(fc.join('\n'));
  console.log(`\n${fc.length} linhas F/C de ${todas.length} marcadas.`);
  // Rastro legível, com a citação de cada registro, para a titular conferir o descarte.
  const idx = indice(saida);
  const md = ['# Triagem marcada', '', `${todas.length} documentos marcados (${fc.length} F/C). Registro em BUSCAS.md da biblioteca.`, '',
    '| Registro | Acórdão | Marca | Linha |', '|---|---|---|---|',
    ...todas.map((l) => {
      const [id, marca] = l.split('|').map((s) => s.trim());
      const d = idx.get(id)?.doc;
      return `| ${id} | ${d ? citacao(d) : '?'} | ${marca} | ${l.split('|').slice(2).join('|').trim().replace(/\|/g, '/')} |`;
    })];
  fs.writeFileSync(path.join(saida, 'triagem-marcada.md'), `${md.join('\n')}\n`);
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
    console.log(`## ${citacao(d)}${d.tipo === 'monocratica' ? ' — DECISÃO MONOCRÁTICA' : ''} — ${d.orgao || ''} — ${d.relator || ''}`
      + ` — j. ${d.julgamento || ''} — ${d.publicacao || ''} — registro ${reg}`);
    console.log(`${d.tipo === 'monocratica' ? d.decisao || d.ementa : d.ementa || ''}${d.notas ? `\nNOTAS: ${d.notas}` : ''}\n`);
  }
  return 0;
}

// ── Biblioteca ────────────────────────────────────────────────────────────
function teor(o) {
  if (!o.saida || !o.registros) sair('uso: scon.js teor --saida <pasta> --registros <reg1,reg2>');
  const saida = path.resolve(o.saida);
  const idx = indice(saida);
  const itens = [];
  for (const reg of registros(o)) {
    const d = idx.get(reg)?.doc;
    if (!d || !d.dt_publicacao) sair(`registro ${reg} não está no resultados.json (ou veio sem link de inteiro teor)`);
    itens.push({ nome: nomeBase(d), num_registro: reg, dt_publicacao: d.dt_publicacao, pasta: pastaDe(nomeBase(d)), doc: d });
  }
  fs.mkdirSync(BIBLIOTECA, { recursive: true });

  // Monocrática: o texto integral veio no espelho; vira .md sem PDF.
  for (const it of itens.filter((x) => x.doc.tipo === 'monocratica')) {
    const arq = path.join(it.pasta, `${it.nome}.md`);
    if (fs.existsSync(arq)) { console.log(`${it.nome}.md  já na biblioteca`); continue; }
    fs.mkdirSync(it.pasta, { recursive: true });
    fs.writeFileSync(arq, `# ${citacao(it.doc)} — decisão monocrática\n\n${it.doc.relator || ''} · ${it.doc.publicacao || ''}\n\n${it.doc.decisao || it.doc.ementa || ''}\n`);
    console.log(`${it.nome}.md  gravado do espelho (monocrática, sem PDF)`);
  }

  // Acórdão: o que já está na biblioteca não se baixa nem se converte de novo.
  const acordaos = itens.filter((x) => x.doc.tipo !== 'monocratica');
  const faltam = acordaos.filter((it) => !fs.existsSync(path.join(it.pasta, `${it.nome}.pdf`)));
  for (const it of acordaos.filter((x) => !faltam.includes(x))) console.log(`${it.nome}.pdf  já na biblioteca`);

  let status = 0;
  if (faltam.length) {
    const arqItens = path.join(saida, '_itens-teor.json');
    fs.writeFileSync(arqItens, JSON.stringify(faltam.map(({ doc: _d, ...it }) => it), null, 1));
    status = motor(['teor', arqItens]);
    fs.rmSync(arqItens, { force: true });
  }

  for (const it of acordaos) {
    const pdf = path.join(it.pasta, `${it.nome}.pdf`);
    if (!fs.existsSync(pdf)) continue;
    if (!o['sem-converter'] && !fs.existsSync(pdf.replace(/\.pdf$/, '.md'))) {
      const r = spawnSync(process.execPath,
        [PDFMD, pdf, '--ocr', 'auto', '--lang', 'por', '--page-breaks', '--no-tables'],
        { stdio: ['ignore', 'ignore', 'inherit'] });
      console.log(`${it.nome}.md  ${r.status === 0 ? 'convertido' : 'FALHOU a conversão'}`);
    }
  }
  for (const it of itens) {
    if (fs.existsSync(it.pasta)) gravarMeta(it.nome, idx.get(it.num_registro), o.caso || path.basename(saida));
  }
  reindexar();
  console.log(`\nBiblioteca: ${BIBLIOTECA}`);
  return status;
}

// <base>/<base>.scon.json: o espelho do SCON de cada documento da biblioteca, mais os casos e
// frentes que o acharam. É de onde saem o INDICE.md e o depósito no acervo.
function gravarMeta(base, { doc, consultas }, caso) {
  const arq = path.join(pastaDe(base), `${base}.scon.json`);
  const meta = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { doc, achado_em: {} };
  meta.doc = doc;
  meta.achado_em[caso] = [...new Set([...(meta.achado_em[caso] || []), ...consultas])];
  fs.writeFileSync(arq, JSON.stringify(meta, null, 1));
}

function metas() {
  if (!fs.existsSync(BIBLIOTECA)) return [];
  return fs.readdirSync(BIBLIOTECA, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(BIBLIOTECA, e.name, `${e.name}.scon.json`)))
    .map((e) => {
      const base = e.name;
      const pasta = pastaDe(base);
      const proc = path.join(pasta, `${base}.processo.json`);
      return { base, pasta, ...JSON.parse(fs.readFileSync(path.join(pasta, `${base}.scon.json`), 'utf8')),
        processo: fs.existsSync(proc) ? JSON.parse(fs.readFileSync(proc, 'utf8')) : null };
    });
}

// Formato anterior (tudo solto na raiz da biblioteca): cada <base>.<ext> vai para <base>/.
function migrar() {
  if (!fs.existsSync(BIBLIOTECA)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(BIBLIOTECA, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    const m = /^(\d{12}_[^.]+)\.(pdf|md|pdfmd\.json|index\.md|scon\.json|processo\.json|estrutura\.json)$/.exec(f.name);
    if (!m) continue;
    const dest = pastaDe(m[1]);
    fs.mkdirSync(dest, { recursive: true });
    fs.renameSync(path.join(BIBLIOTECA, f.name), path.join(dest, f.name));
    n++;
  }
  if (n) console.log(`${n} arquivo(s) levados para pastas por acórdão.`);
  reindexar();
  return 0;
}

// INDICE.md da biblioteca, regenerado inteiro a cada mudança: uma linha por documento, para
// quem abre a pasta sem ser agente. "Achado em" liga o documento às buscas do BUSCAS.md.
function reindexar() {
  const cel = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const linhas = metas().map(({ base, doc: d, achado_em: a, processo: p }) => {
    const sit = p?.semaforo ? `${p.semaforo.cor} (${p.lido_em})` : 'não verificado';
    const achado = Object.entries(a || {}).map(([c, fs_]) => `${c}: ${fs_.join(', ')}`).join('; ');
    const arq = d.tipo === 'monocratica' ? `[texto](${base}/${base}.md)` : `[PDF](${base}/${base}.pdf) · [texto](${base}/${base}.md)`;
    return `| ${cel(citacao(d))}${d.tipo === 'monocratica' ? ' (mono.)' : ''} | ${cel(d.orgao)} | ${cel(d.julgamento)} | ${cel(d.publicacao)}`
      + ` | ${arq} | ${cel(sit)} | ${cel(achado)}`
      + ` | ${cel((d.ementa || '').slice(0, 160))}… |`;
  });
  fs.mkdirSync(BIBLIOTECA, { recursive: true });
  fs.writeFileSync(path.join(BIBLIOTECA, 'INDICE.md'), '# Biblioteca de acórdãos do STJ\n\n'
    + 'Baixados do SCON pela skill radar-jurisprudencia-stj, uma pasta por documento. Fora do git: o '
    + 'inteiro teor traz nome de parte. Para citar em peça, o julgado precisa entrar no acervo (ver a '
    + 'SKILL.md). Situação: VERDE = transitou, e recurso posterior (se houve) não alterou o resultado; '
    + 'AMARELO = recurso posterior pendente ou decisão que pode ter alterado o resultado, ler antes de '
    + 'citar; CINZA = ainda sem trânsito ou não lido.\n\n'
    + '| Acórdão | Órgão | Julgamento | Publicação | Arquivo | Situação | Achado em | Ementa (início) |\n'
    + '|---|---|---|---|---|---|---|---|\n' + linhas.join('\n') + '\n');
}

// ── Semáforo de alteração posterior ───────────────────────────────────────
// Só conta o que veio DEPOIS da publicação do acórdão guardado: o mesmo registro abriga
// AgInt, EDcl e EREsp sucessivos. Três perguntas, nesta ordem:
//  1. alguma fase posterior indica resultado alterado (acolhimento, provimento, reconsideração,
//     anulação)? -> AMARELO, ler a decisão;
//  2. houve recurso posterior (EDcl, AgInt, EREsp, RE) sem trânsito depois dele? -> AMARELO,
//     pendente;
//  3. transitou? -> VERDE (anotando o recurso posterior rejeitado, se houve); senão CINZA.
// "improvido", "desprovido", "não provido", "rejeitados" e "não conhecido" são o recurso
// posterior que NÃO alterou: não acendem o AMARELO sozinhos.
const RX_RECURSO = /(embargos de declara|agravo interno|agravo regimental|embargos de diverg|recurso extraordin|rescis[oó]ria)/i;
const RX_ALTERACAO = /(acolhid|(?<!im|des|n[aã]o )provid|reconsider|retrata|anulad|sem efeito|efeitos? (modificativ|infringent)|rescindid)/i;
const RX_REJEICAO = /(rejeitad|improvid|desprovid|n[aã]o[\s-]*provid|n[aã]o[\s-]*acolhid|n[aã]o[\s-]*conhecid|negad[oa] provimento|mantid)/i;
const RX_TRANSITO = /(transitad[oa] em julgado|tr[aâ]nsito em julgado|baixa definitiva)/i;
const aaaammdd = (s) => (/(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '') || []).slice(1).reverse().join('');

function semaforo(processo, dtPublicacao) {
  const pub = aaaammdd(dtPublicacao);
  const depois = (processo.fases || []).filter((f) => aaaammdd(f.data) > pub);
  const alteracoes = depois.filter((f) => RX_ALTERACAO.test(f.texto) && !RX_REJEICAO.test(f.texto));
  if (alteracoes.length) {
    return { cor: 'AMARELO', motivo: `possível alteração do resultado — ${alteracoes.slice(0, 3).map((f) => `${f.data}: ${f.texto}`).join(' | ')}` };
  }
  const recursos = depois.filter((f) => RX_RECURSO.test(f.texto));
  const transitos = depois.filter((f) => RX_TRANSITO.test(f.texto));
  const ultimoRecurso = recursos.reduce((m, f) => (aaaammdd(f.data) > m ? aaaammdd(f.data) : m), '');
  const transitoFinal = transitos.find((f) => aaaammdd(f.data) >= ultimoRecurso);
  if (recursos.length && !transitoFinal) {
    return { cor: 'AMARELO', motivo: `recurso posterior sem trânsito registrado — ${recursos.slice(0, 3).map((f) => `${f.data}: ${f.texto}`).join(' | ')}` };
  }
  if (transitoFinal) {
    const nota = recursos.length ? ` (recurso posterior não alterou: ${recursos[recursos.length - 1].texto.slice(0, 80)})` : '';
    return { cor: 'VERDE', motivo: `${transitoFinal.data}: ${transitoFinal.texto}${nota}` };
  }
  const transitoAntes = (processo.fases || []).find((f) => RX_TRANSITO.test(f.texto));
  if (transitoAntes) return { cor: 'VERDE', motivo: `${transitoAntes.data}: ${transitoAntes.texto}` };
  return { cor: 'CINZA', motivo: 'sem trânsito em julgado nem baixa registrados (prazo em curso?)' };
}

function verificar(o) {
  if (!o.registros && !o.todos) sair('uso: scon.js verificar --registros <reg1,reg2> | --todos');
  const todas = metas();
  const alvo = o.todos ? todas : todas.filter((m) => registros(o).includes(m.doc.num_registro));
  const faltam = o.todos ? [] : registros(o).filter((r) => !todas.some((m) => m.doc.num_registro === r));
  if (faltam.length) sair(`não estão na biblioteca (rode teor antes): ${faltam.join(', ')}`);

  const arqItens = path.join(BIBLIOTECA, '_itens-processo.json');
  fs.writeFileSync(arqItens, JSON.stringify(alvo.map((m) => ({ nome: m.base, num_registro: m.doc.num_registro, pasta: m.pasta })), null, 1));
  const status = motor(['processo', arqItens]);
  fs.rmSync(arqItens, { force: true });

  for (const m of alvo) {
    const arq = path.join(m.pasta, `${m.base}.processo.json`);
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

// ── Acórdão específico ────────────────────────────────────────────────────
// "REsp 805.919/MG" -> { classe: 'REsp', numero: '805919', uf: 'MG' }.
function parseNumero(pedido) {
  const m = /^(.*?)\s*n?[º°.]?\s*([\d.]+)\s*(?:\/\s*([A-Za-z]{2}))?\s*$/.exec(String(pedido || '').trim());
  if (!m || !m[1].trim()) return null;
  return { classe: m[1].trim().replace(/\s+/g, ' '), numero: m[2].replace(/\D/g, ''), uf: (m[3] || '').toUpperCase() };
}

// A busca vai pelos campos `processo` e `classe` da pesquisa avançada, não pela pesquisa livre:
// a livre lê "Jurisprudência Citada" e devolve também quem cita o acórdão — para precedente
// muito citado, a página de 50 mais recentes nem traz o pedido. Se os campos não acharem
// nada, cai na livre ("REsp 805919", sem ponto e sem UF, como o SCON exige).
function acordao(o) {
  const p = parseNumero(o.numero);
  if (!p) sair('uso: scon.js acordao --numero "REsp 805.919/MG" [--caso <nome>] [--saida tmp/radar-stj/<caso>] [--verificar]');
  const { classe, numero, uf } = p;
  const saida = path.resolve(o.saida || path.join(RAIZ, 'tmp', 'radar-stj', '_acordaos'));
  fs.mkdirSync(saida, { recursive: true });
  const arqConsulta = path.join(saida, 'consultas.json');
  const id = `${classe} ${numero}${uf ? `/${uf}` : ''}`;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const exatosEm = () => [...indice(saida).values()].map((e) => e.doc).filter((d) => {
    const r = RX_PROC.exec(d.processo || '');
    return r && norm(r[1]) === norm(`${classe} ${numero}`) && (!uf || r[2] === uf);
  });

  fs.writeFileSync(arqConsulta, JSON.stringify([{ id, processo: numero, classe, ...(uf ? { uf } : {}) }], null, 1));
  if (buscar({ consultas: arqConsulta, saida }) !== 0) return 1;
  let exatos = exatosEm();
  if (!exatos.length) {
    console.log('Campos processo/classe não acharam; tentando a pesquisa livre.');
    fs.writeFileSync(arqConsulta, JSON.stringify([{ id, livre: `${classe} ${numero}` }], null, 1));
    if (buscar({ consultas: arqConsulta, saida }) !== 0) return 1;
    exatos = exatosEm();
  }
  if (exatos.length !== 1) {
    const docs = [...indice(saida).values()].map((e) => e.doc);
    console.log(`\n${exatos.length ? 'Mais de um' : 'Nenhum'} acórdão com classe, número e UF exatos. Encontrados:`);
    for (const d of docs) console.log(`  ${d.num_registro} | ${citacao(d)} | ${d.orgao || ''} | j. ${d.julgamento || ''}`);
    console.log('Escolher o registro e rodar: scon.js teor --saida <mesma pasta> --registros <registro>');
    return exatos.length ? 0 : 1;
  }
  const reg = exatos[0].num_registro;
  const st = teor({ saida, registros: reg, caso: o.caso || 'acordao-especifico' });
  if (o.verificar && st === 0) return verificar({ registros: reg });
  return st;
}

// ── Precedentes citados ───────────────────────────────────────────────────
// Lista, de um documento, os precedentes do STJ que ele cita (ementa padronizada traz
// "Jurisprudência relevante citada"; o inteiro teor traz o resto) e a consulta que acha quem
// o cita. É o snowball do pesquisador: o finalista aponta os próximos a buscar.
const RX_CITADO = /\b((?:(?:AgInt|AgRg|EDcl|EREsp|EAREsp|AgInt nos EDcl|EDcl no AgInt|EDcl no AgRg|AgRg nos EDcl)\s+(?:no|nos|na|em)\s+)?(?:REsp|AREsp|RMS|MS|HC|RHC|CC|EREsp|EAREsp|RE|SLS|Rcl|Pet|IAC|AR|ProAfR))\s*n?[.º°]?\s*([\d.]{3,})\s*(?:\/\s*([A-Z]{2}))?/g;

function extrairCitados(texto) {
  const vistos = new Map();
  for (const m of String(texto || '').matchAll(RX_CITADO)) {
    const numero = m[2].replace(/\D/g, '');
    if (numero.length < 3) continue;
    const classe = m[1].replace(/\s+/g, ' ').trim();
    const chave = `${classe.toLowerCase()} ${numero}`;
    if (!vistos.has(chave)) vistos.set(chave, { classe, numero, uf: m[3] || '', vezes: 0 });
    vistos.get(chave).vezes++;
  }
  return [...vistos.values()].sort((a, b) => b.vezes - a.vezes);
}

function citados(o) {
  const docs = [];
  if (o.registro) {
    const m = metas().find((x) => x.doc.num_registro === String(o.registro));
    if (!m) sair(`registro ${o.registro} não está na biblioteca — rode teor antes`);
    const md = path.join(m.pasta, `${m.base}.md`);
    docs.push({ doc: m.doc, texto: `${m.doc.ementa || ''}\n${m.doc.jurisp_citada || ''}\n${fs.existsSync(md) ? fs.readFileSync(md, 'utf8') : ''}` });
  } else if (o.saida && o.registros) {
    const idx = indice(path.resolve(o.saida));
    for (const reg of registros(o)) {
      const e = idx.get(reg);
      if (e) docs.push({ doc: e.doc, texto: `${e.doc.ementa || ''}\n${e.doc.jurisp_citada || ''}` });
    }
  } else sair('uso: scon.js citados --registro <reg da biblioteca> | --saida <pasta> --registros <regs>');

  for (const { doc, texto } of docs) {
    const proprio = parseNumero(citacao(doc));
    const lista = extrairCitados(texto).filter((c) => !(proprio && c.numero === proprio.numero));
    console.log(`## ${citacao(doc)} cita ${lista.length} precedente(s)`);
    for (const c of lista) console.log(`  ${c.classe} ${c.numero}${c.uf ? `/${c.uf}` : ''}  (${c.vezes}×)  → scon.js acordao --numero "${c.classe} ${c.numero}${c.uf ? `/${c.uf}` : ''}"`);
    if (proprio) {
      console.log(`Quem cita ${citacao(doc)} (colar no SCON, ou consulta "livre" no consultas.json): \`${proprio.classe} ${proprio.numero}\``);
    }
    console.log('');
  }
  return 0;
}

module.exports = { cabecalho, semaforo, parseNumero, extrairCitados, citacao, nomeArquivo, nomeBase, compactar, assinatura, lerMarcas };

if (require.main === module) {
  const [cmd, ...resto] = process.argv.slice(2);
  const o = opcoes(resto);
  const cmds = { buscar, cabecalhos, lotes, conferir, ementas, teor, verificar, acordao, citados, migrar };
  if (cmd === 'registrar') { registrarBusca(path.resolve(o.saida), o.rotulo); process.exit(0); }
  if (cmd === 'reindexar') { reindexar(); process.exit(0); }
  if (cmds[cmd]) process.exit(cmds[cmd](o));
  sair('uso: scon.js buscar|cabecalhos|lotes|conferir|ementas|teor|verificar|acordao|citados|migrar|reindexar ... (ver o cabeçalho deste arquivo)');
}

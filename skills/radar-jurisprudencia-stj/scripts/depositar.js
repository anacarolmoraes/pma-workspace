#!/usr/bin/env node
// depositar.js — leva um acórdão da biblioteca jurisprudencia-stj/ para o acervo, pronto
// para conferência: raw/<slug>.md pseudonimizado + jurisprudencia/<slug>.md `status: em_teste`
// + sidecar de voz do segmentar-acordao.py (o que o lint-citacoes lê).
//
// Uso:
//   node depositar.js --registro 202302406926 --bundle direito/cobranca-honorarios
//                     [--slug resp-2084975-mt] [--tese "enunciado conferido no voto"] [--forcar]
//
// Semiautomático de propósito: a página nasce `em_teste`, sem `tese:` se ela não vier da
// titular, e o relatório lista o que a pseudonimização trocou e os sobrenomes que ainda
// aparecem no texto. Promover a `vigente` é decisão humana, depois de ler o raw.
//
// Pseudonimização (regra dura 6 do AGENTS.md): saem parte pessoa física, advogado e sociedade
// de advogados (o nome dela é nome de advogado); ficam ministro, pessoa jurídica que é parte
// e o número do processo. Fonte dos nomes: a aba Detalhes do acompanhamento processual
// (rode `scon.js verificar` antes) e o cabeçalho do próprio acórdão.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const BIBLIOTECA = path.join(RAIZ, 'jurisprudencia-stj');

function sair(msg, code = 2) { console.error(msg); process.exit(code); }

function opcoes(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

const ambiente = () => {
  const arq = path.join(RAIZ, 'perfil', 'ambiente.json');
  if (!fs.existsSync(arq)) sair('perfil/ambiente.json não existe — rode: node scripts/setup.js');
  return JSON.parse(fs.readFileSync(arq, 'utf8'));
};

// ── Nomes a pseudonimizar ─────────────────────────────────────────────────
const PAPEIS = {
  AGRAVANTE: 'AGRAVANTE', AGRAVADO: 'AGRAVADO', AGRAVADA: 'AGRAVADO',
  RECORRENTE: 'RECORRENTE', RECORRIDO: 'RECORRIDO', RECORRIDA: 'RECORRIDO',
  EMBARGANTE: 'EMBARGANTE', EMBARGADO: 'EMBARGADO', EMBARGADA: 'EMBARGADO',
  REQUERENTE: 'REQUERENTE', REQUERIDO: 'REQUERIDO', REQUERIDA: 'REQUERIDO',
  IMPETRANTE: 'IMPETRANTE', IMPETRADO: 'IMPETRADO', SUSCITANTE: 'SUSCITANTE', SUSCITADO: 'SUSCITADO',
  'INTERES.': 'INTERESSADO', INTERESSADO: 'INTERESSADO', INTERESSADA: 'INTERESSADO',
  'REPR. POR': 'REPRESENTANTE',
  ADVOGADO: 'ADVOGADO', ADVOGADA: 'ADVOGADO', ADVOGADOS: 'ADVOGADO', ADVOGADAS: 'ADVOGADO',
};
const RX_ROTULO = new RegExp(`\\b(${Object.keys(PAPEIS).map((k) => k.replace('.', '\\.')).join('|')})\\s*:`, 'g');
const RX_OAB = /\s+-\s+[A-Z]{2}\d{3,7}[A-Z]?\b/g;
const RX_SOC_ADV = /\b(ADVOCACIA|ADVOGADOS|ADVOGADAS|ADVOGADOS ASSOCIADOS|SOCIEDADE (INDIVIDUAL )?DE ADVOGAD|S\/S)\b/i;
const RX_PJ = /\b(LTDA|S\.?\s?\/?A\.?|EIRELI|EPP|BANCO|COOPERATIVA|ASSOCIA[CÇ][AÃ]O|FUNDA[CÇ][AÃ]O|FUNDO|SINDICATO|CONDOM[IÍ]NIO|MUNIC[IÍ]PIO|ESTADO D|UNI[AÃ]O|INSTITUTO|EMPREENDIMENTOS|INCORPORA|COMPANHIA|CIA\b|CONSTRUTORA|SEGURADORA|SEGUROS|IMOBILI[AÁ]RIA|IND[UÚ]STRIA|COM[EÉ]RCIO|MINIST[EÉ]RIO P[UÚ]BLICO|FAZENDA|INSS|CAIXA ECON|EMPRESA|ENERGIA|TELEF|SANEAMENTO|PREVID[EÊ]NCIA|PLANO DE SA[UÚ]DE|UNIMED|HOSPITAL|UNIVERSIDADE|IGREJA|PARTIDO)\b/i;

function limpo(s) {
  return String(s || '').replace(RX_OAB, '').replace(/\s+/g, ' ').replace(/[\s.,;]+$/, '').trim();
}

// "NOME - UF000 NOME2 - UF111" -> [NOME, NOME2]
function dividirAdvogados(valor) {
  const partes = [];
  let resto = valor;
  const rx = /\s+-\s+[A-Z]{2}\d{3,7}[A-Z]?\b/g;
  let m;
  let ini = 0;
  while ((m = rx.exec(valor))) {
    partes.push(valor.slice(ini, m.index));
    ini = m.index + m[0].length;
  }
  resto = valor.slice(ini);
  if (resto.trim()) partes.push(resto);
  return partes.map(limpo).filter((n) => n && !/^(E )?OUTRO\(?S?\)?$/i.test(n) && n.length > 3);
}

function nomesDoCabecalho(md) {
  const ini = md.search(/\bRELATOR/i);
  const fim = md.search(/#\s*EMENTA|\bEMENTA\b/);
  const cab = md.slice(Math.max(0, ini), fim > ini ? fim : ini + 4000)
    .replace(/[#*]/g, ' ').replace(/\s+/g, ' ');
  const achados = [];
  const marcas = [...cab.matchAll(RX_ROTULO)];
  marcas.forEach((m, i) => {
    const valor = cab.slice(m.index + m[0].length, marcas[i + 1]?.index ?? cab.length);
    const papel = PAPEIS[m[1]];
    const nomes = papel === 'ADVOGADO' ? dividirAdvogados(valor) : [limpo(valor)];
    for (const n of nomes) if (n) achados.push({ papel, nome: n });
  });
  return achados;
}

function nomesDoProcesso(proc) {
  const achados = [];
  for (const { rotulo, valor } of proc?.detalhes || []) {
    const papel = PAPEIS[rotulo.toUpperCase()] || PAPEIS[`${rotulo.toUpperCase()}.`];
    if (!papel) continue;
    const nomes = papel === 'ADVOGADO' ? dividirAdvogados(valor) : [limpo(valor)];
    for (const n of nomes) if (n) achados.push({ papel, nome: n });
  }
  return achados;
}

const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const chave = (s) => semAcento(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// Letra -> classe que aceita a variante acentuada; palavras ligadas por qualquer espaço
// (o pdfmd quebra nome em duas linhas e em dois parágrafos).
const VARIANTES = { A: 'AÁÀÂÃÄ', E: 'EÉÈÊË', I: 'IÍÌÎÏ', O: 'OÓÒÔÕÖ', U: 'UÚÙÛÜ', C: 'CÇ', N: 'NÑ' };
function rxNome(nome) {
  const palavras = chave(nome).split(' ').filter(Boolean);
  const corpo = palavras.map((p) => [...p].map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}${VARIANTES[ch].toLowerCase()}]` : ch)).join(''))
    .join('[\\s*#/.\\-]+'); // "S/S", "S.A.": a pontuação do nome vira espaço na chave
  return new RegExp(`(?<![\\p{L}\\d])${corpo}(?![\\p{L}\\d])`, 'giu');
}

function planoDeTroca(achados) {
  const porChave = new Map();
  const contagem = {};
  for (const { papel, nome } of achados) {
    const k = chave(nome);
    if (!k || porChave.has(k)) continue;
    const pj = RX_PJ.test(nome) && !RX_SOC_ADV.test(nome);
    if (pj) { porChave.set(k, { nome, papel, manter: true }); continue; }
    const tipo = RX_SOC_ADV.test(nome) ? 'SOCIEDADE DE ADVOGADOS' : papel;
    contagem[tipo] = (contagem[tipo] || 0) + 1;
    porChave.set(k, { nome, papel, tipo, n: contagem[tipo] });
  }
  // Rótulo numerado só quando há mais de um do mesmo tipo.
  for (const t of porChave.values()) {
    if (t.manter) continue;
    t.rotulo = contagem[t.tipo] > 1 ? `[${t.tipo} ${t.n}]` : `[${t.tipo}]`;
  }
  return [...porChave.values()];
}

function pseudonimizar(texto, plano) {
  let out = texto;
  const trocas = [];
  // Nome mais longo primeiro: "FULANO SOCIEDADE INDIVIDUAL DE ADVOCACIA" antes de "FULANO".
  for (const t of plano.filter((x) => !x.manter).sort((a, b) => b.nome.length - a.nome.length)) {
    let n = 0;
    out = out.replace(rxNome(t.nome), () => { n++; return t.rotulo; });
    // Pessoa física com 3+ nomes também aparece só como "Primeiro Último".
    const pal = chave(t.nome).split(' ');
    if (t.tipo !== 'SOCIEDADE DE ADVOGADOS' && pal.length >= 3) {
      out = out.replace(rxNome(`${pal[0]} ${pal[pal.length - 1]}`), () => { n++; return t.rotulo; });
    }
    trocas.push({ ...t, ocorrencias: n });
  }
  out = out
    .replace(/(\[[A-Z ]+\d*\])\s+-\s+[A-Z]{2}\d{3,7}[A-Z]?\b/g, '$1') // OAB colada ao rótulo
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[E-MAIL]')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g, '[TELEFONE]')
    .replace(/\bCEP:?\s*\d{5}-?\d{3}\b/gi, 'CEP [CEP]');
  return { texto: out, trocas };
}

// Sobrenome (4+ letras) de quem foi trocado que ainda aparece: pode ser grafia que o
// regex não pegou ("Dr. Mischiatti"), ou homônimo inocente. O humano decide.
const COMUNS = new Set(['SILVA', 'SANTOS', 'SOUZA', 'SOUSA', 'OLIVEIRA', 'PEREIRA', 'COSTA', 'RODRIGUES', 'ALVES', 'LIMA', 'FERREIRA', 'GOMES', 'RIBEIRO', 'MARTINS', 'CARVALHO', 'ARAUJO', 'MELO', 'BARBOSA', 'ROCHA', 'DIAS', 'NUNES', 'JUNIOR', 'FILHO', 'NETO']);
function residuos(texto, trocas) {
  const alerta = [];
  for (const t of trocas) {
    for (const p of chave(t.nome).split(' ')) {
      if (p.length < 4 || COMUNS.has(p) || /^(DE|DA|DO|DOS|DAS|SOCIEDADE|INDIVIDUAL|ADVOCACIA|ADVOGADOS|ASSOCIADOS)$/.test(p)) continue;
      const m = rxNome(p).exec(texto);
      if (m) alerta.push(`${p} (de ${t.rotulo}): "…${texto.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' ')}…"`);
    }
  }
  return [...new Set(alerta)];
}

// ── Página do acervo ──────────────────────────────────────────────────────
const aIso = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const yaml = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ORGAOS = { T1: 'Primeira Turma', T2: 'Segunda Turma', T3: 'Terceira Turma', T4: 'Quarta Turma', T5: 'Quinta Turma', T6: 'Sexta Turma', S1: 'Primeira Seção', S2: 'Segunda Seção', S3: 'Terceira Seção', CE: 'Corte Especial' };

function citacao(doc) {
  const m = /^(.+?\d+)\s*\/\s*([A-Z]{2})/.exec(doc.processo || '');
  if (!m) return doc.num_registro;
  return `${m[1].replace(/(\d)(?=(\d{3})+$)/g, '$1.')}/${m[2]}`;
}
function slugDe(doc) {
  return citacao(doc).toLowerCase().replace(/\b(no|nos|na|nas)\b/g, '').replace(/\./g, '')
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function main() {
  const o = opcoes(process.argv.slice(2));
  if (!o.registro || !o.bundle) sair('uso: depositar.js --registro <reg> --bundle direito/<tema> [--slug s] [--tese "..."] [--forcar]');
  const amb = ambiente();
  const bundle = path.join(amb.bundles, o.bundle);
  if (!fs.existsSync(path.join(bundle, 'index.md'))) sair(`bundle não encontrado: ${bundle}`);

  const base = (fs.existsSync(BIBLIOTECA) ? fs.readdirSync(BIBLIOTECA) : [])
    .find((f) => f.startsWith(`${o.registro}_`) && f.endsWith('.scon.json'))?.replace(/\.scon\.json$/, '');
  if (!base) sair(`registro ${o.registro} não está na biblioteca — rode scon.js teor antes`);
  const arqMd = path.join(BIBLIOTECA, `${base}.md`);
  if (!fs.existsSync(arqMd)) sair(`${arqMd} não existe — o PDF não foi convertido`);
  const meta = JSON.parse(fs.readFileSync(path.join(BIBLIOTECA, `${base}.scon.json`), 'utf8'));
  const doc = meta.doc;
  const arqProc = path.join(BIBLIOTECA, `${base}.processo.json`);
  const proc = fs.existsSync(arqProc) ? JSON.parse(fs.readFileSync(arqProc, 'utf8')) : null;
  if (!proc) console.log('AVISO: sem acompanhamento processual — a lista de nomes vem só do cabeçalho. Rode scon.js verificar antes.');

  const slug = o.slug || slugDe(doc);
  const destRaw = path.join(bundle, 'raw', `${slug}.md`);
  const destPag = path.join(bundle, 'jurisprudencia', `${slug}.md`);
  for (const d of [destRaw, destPag]) {
    if (fs.existsSync(d) && !o.forcar) sair(`${path.relative(amb.bundles, d)} já existe — use --forcar para sobrescrever`);
  }

  const md = fs.readFileSync(arqMd, 'utf8');
  const plano = planoDeTroca([...nomesDoProcesso(proc), ...nomesDoCabecalho(md)]);
  const { texto, trocas } = pseudonimizar(md, plano);
  const ementa = pseudonimizar(doc.ementa || '', plano).texto;
  const hoje = new Date().toISOString().slice(0, 10);
  const cit = citacao(doc);
  const orgao = ORGAOS[(doc.orgao || '').split(' ')[0]] || doc.orgao || '';
  const relator = (doc.relator || '').replace(/\s*\(\d+\)$/, '').replace(/^Ministr[oa]\s+/i, 'Min. ');
  const numUnico = proc?.detalhes?.find((d) => /N[UÚ]MERO [UÚ]NICO/i.test(d.rotulo))?.valor;

  fs.mkdirSync(path.dirname(destRaw), { recursive: true });
  fs.writeFileSync(destRaw, `<!--\n${cit} (registro ${doc.num_registro}), ${orgao}, ${relator}. `
    + `Inteiro teor do SCON/STJ (DJEN ${doc.dt_publicacao}).\n`
    + `Convertido com pdfmd --no-tables; depositado pela skill radar-jurisprudencia-stj em ${hoje}.\n`
    + `PSEUDONIMIZADO (regra dura 6): ${trocas.filter((t) => t.ocorrencias).length} nomes viraram rótulo. `
    + 'Ficam ministros, pessoas jurídicas partes e o número do processo.\n'
    + 'O PDF e o .md com nomes ficam fora do git (jurisprudencia-stj/ do workspace). NAO editar.\n-->\n\n'
    + texto);

  const sem = proc?.semaforo;
  const titulo = (o.tese ? `${cit} — ${o.tese}`
    : `${cit} — ${(ementa.split(/\.\s/).slice(1, 4).join('. ') || ementa).slice(0, 140)}`)
    .replace(/\s+\./g, '.').trim();
  const fm = [
    '---', 'type: acordao', `title: ${yaml(titulo)}`,
    `description: ${yaml(`STJ, ${orgao}, ${relator}. ${ementa.slice(0, 280)}…`)}`,
    'tags: []', `timestamp: '${hoje}'`, 'status: em_teste', 'autor: ingerido',
    `resource: https://processo.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea&tipoPesquisa=tipoPesquisaNumeroRegistro&termo=${doc.num_registro}`,
    `tribunal: ${yaml(`STJ - ${orgao}`)}`, `relator: ${yaml(relator)}`,
    `data_julgamento: '${aIso(doc.julgamento)}'`, `data_publicacao: '${aIso(doc.dt_publicacao)}'`,
    numUnico ? `numero_unico: '${numUnico}'` : null,
    `raw: /raw/${slug}.md`, 'natureza: principal', `fonte_da_tese: ${o.tese ? 'voto' : 'ementa'}`,
    o.tese ? `tese: ${yaml(o.tese)}` : null,
    sem ? `situacao_processual: ${yaml(`${sem.cor} em ${proc.lido_em} — ${sem.motivo.slice(0, 200)}`)}` : null,
    '---',
  ].filter(Boolean).join('\n');
  const corpo = `\n\n# ${cit}\n\n**Relator:** ${relator} · **Órgão:** ${orgao} · **Julgamento:** ${doc.julgamento}`
    + ` · **Publicação:** ${doc.publicacao} · Depósito em [\`raw/\`](/raw/${slug}.md), pseudonimizado.\n\n`
    + `## Ementa\n\n${ementa}\n\n`
    + '## Antes de promover a `vigente`\n\n'
    + '- [ ] Ler o `raw/` e conferir a pseudonimização (o relatório do depósito lista os resíduos).\n'
    + `- [ ] Conferir a tese no voto e preencher \`tese:\`${o.tese ? ' (veio da titular; confirmar)' : ''}; se vier do voto, \`fonte_da_tese: voto\`.\n`
    + '- [ ] Preencher `tags:` e ligar a página no `jurisprudencia/index.md` do bundle.\n'
    + `- [ ] Situação processual: ${sem ? `**${sem.cor}** em ${proc.lido_em}` : '**não verificada**'}`
    + `${sem && sem.cor !== 'VERDE' ? ' — ver a decisão posterior antes de citar' : ''}.\n`;
  fs.mkdirSync(path.dirname(destPag), { recursive: true });
  fs.writeFileSync(destPag, fm + corpo);

  // Página fora de index.md não existe para o agente (E3 do lint-bundle). A linha entra
  // depois da última entrada da lista; no --forcar, substitui a anterior.
  const arqIdx = path.join(bundle, 'jurisprudencia', 'index.md');
  const linhaIdx = `- [${slug}.md](${slug}.md) — STJ, ${orgao}: ${titulo.split(' — ').slice(1).join(' — ').slice(0, 160)}.`
    + ` em_teste, raw/ pseudonimizado, depositado ${hoje} (radar-jurisprudencia-stj)`;
  const idxTxt = fs.existsSync(arqIdx) ? fs.readFileSync(arqIdx, 'utf8') : `# Jurisprudência\n\n`;
  const linhas = idxTxt.split('\n').filter((l) => !l.startsWith(`- [${slug}.md]`));
  const ultima = linhas.map((l) => l.startsWith('- [')).lastIndexOf(true);
  linhas.splice(ultima >= 0 ? ultima + 1 : linhas.length, 0, linhaIdx);
  fs.writeFileSync(arqIdx, linhas.join('\n'));

  // Sidecar de voz: o lint-citacoes separa ementa transcrita de razão de decidir por ele.
  const seg = spawnSync(amb.python, [path.join(amb.bundles, 'segmentar-acordao.py'), destRaw],
    { cwd: amb.bundles, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });

  console.log(`raw:    ${path.relative(amb.bundles, destRaw)}`);
  console.log(`página: ${path.relative(amb.bundles, destPag)}  (status: em_teste)`);
  console.log(`voz:    ${seg.status === 0 ? 'segmentado (.estrutura.json)' : `segmentar-acordao saiu ${seg.status}: ${(seg.stdout + seg.stderr).trim().split('\n').pop()}`}`);
  console.log('\nTrocas:');
  for (const t of trocas) console.log(`  ${t.rotulo.padEnd(28)} ${t.ocorrencias}×  ${t.nome}`);
  const mantidos = plano.filter((p) => p.manter);
  if (mantidos.length) console.log(`Mantidos (pessoa jurídica parte): ${mantidos.map((p) => p.nome).join('; ')}`);
  const sobra = residuos(texto, trocas);
  console.log(sobra.length ? `\nCONFERIR — sobrenome ainda no texto:\n  ${sobra.join('\n  ')}` : '\nNenhum sobrenome residual encontrado.');
  const st = spawnSync('git', ['-C', amb.bundles, 'status', '--short'], { encoding: 'utf8' });
  console.log(`\ngit status do acervo:\n${st.stdout.trim() || '(limpo)'}`);
}

main();

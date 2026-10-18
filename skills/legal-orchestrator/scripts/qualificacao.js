#!/usr/bin/env node
// qualificacao.js — gera o preâmbulo da petição inicial (endereçamento, qualificação do
// autor e da ré, "em face de") a partir do bloco ```json caso da clientes/<caso>/ANALISE.md,
// para o CPF, o e-mail e o endereço não serem digitados a cada peça. CPC 319, II, exige nome, estado civil,
// existência de união estável, profissão, CPF/CNPJ, e-mail, domicílio e residência;
// telefone não é requisito e o escritório não o inclui (perfil/definicoes.md §5).
//
// Schema: skills/legal-orchestrator/references/caso.schema.json. Os dados ficam em clientes/
// (camada C1); o hook block-dado-caso impede que CPF saia de lá.
//
// Uso:
//   node skills/legal-orchestrator/scripts/qualificacao.js clientes/<caso>/ANALISE.md            # imprime o preâmbulo
//   node skills/legal-orchestrator/scripts/qualificacao.js clientes/<caso>/ANALISE.md --checar   # só lista o que falta
'use strict';

const fs = require('fs');
const path = require('path');

const arq = process.argv[2];
const soChecar = process.argv.includes('--checar');
if (!arq) { console.error('Uso: node qualificacao.js clientes/<caso>/ANALISE.md [--checar]   (ou clientes/<caso>/caso.json, legado)'); process.exit(2); }

// Os dados moram no bloco ```json caso da ANALISE.md (único arquivo de estado do caso,
// decisão de 01/10/2026). caso.json avulso continua aceito como legado.
function lerDados(caminho) {
  const texto = fs.readFileSync(path.resolve(caminho), 'utf8');
  if (!/\.md$/i.test(caminho)) return JSON.parse(texto);
  const m = texto.match(/```json\s+caso\s*\r?\n([\s\S]*?)\r?\n```/);
  if (!m) { console.error(`Sem bloco \`\`\`json caso em ${caminho} — modelo em skills/legal-orchestrator/references/ANALISE.template.md`); process.exit(2); }
  try { return JSON.parse(m[1]); } catch (e) { console.error(`Bloco json caso inválido em ${caminho}: ${e.message}`); process.exit(2); }
}
const c = lerDados(arq);

const faltas = [];
const exigir = (obj, campo, rotulo) => { if (!obj || !String(obj[campo] || '').trim()) faltas.push(rotulo); };

const a = c.autor || {};
exigir(a, 'nome', 'autor.nome');
exigir(a, 'nacionalidade', 'autor.nacionalidade');
exigir(a, 'estado_civil', 'autor.estado_civil (e uniao_estavel: true/false)');
exigir(a, 'profissao', 'autor.profissao');
exigir(a, 'cpf', 'autor.cpf');
exigir(a, 'email', 'autor.email (CPC 319, II)');
exigir(a, 'endereco', 'autor.endereco (domicílio e residência)');
if (a.uniao_estavel === undefined) faltas.push('autor.uniao_estavel (CPC 319, II: existência de união estável)');
if (a.telefone) faltas.push('autor.telefone presente: o escritório não o inclui na qualificação (definicoes.md §5) — remover ou ignorar');

const reus = Array.isArray(c.reus) ? c.reus : (c.reu ? [c.reu] : []);
if (!reus.length) faltas.push('reus[] (ao menos um)');
reus.forEach((r, i) => {
  exigir(r, 'nome', `reus[${i}].nome`);
  if (!r.cnpj && !r.cpf) faltas.push(`reus[${i}].cnpj ou .cpf — sem o dado, requerer as diligências do art. 319, § 1º`);
  exigir(r, 'endereco', `reus[${i}].endereco`);
});
const j = c.juizo || {};
exigir(j, 'comarca', 'juizo.comarca');
exigir(j, 'uf_extenso', 'juizo.uf_extenso');

// Campo preenchido com marcador ("[[a conferir: …]]", "[[NOME]]") não é campo completo: no
// retrofit de 15/10/2026 (Welson) o --checar dava verde com a sede de duas rés sem fonte.
const marcados = [];
const varrerMarcador = (v, rotulo) => {
  if (typeof v === 'string') { if (/\[\[/.test(v)) marcados.push(rotulo); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => varrerMarcador(x, `${rotulo}[${i}]`)); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) varrerMarcador(x, rotulo ? `${rotulo}.${k}` : k);
};
varrerMarcador({ autor: c.autor, reus, juizo: c.juizo }, '');
for (const m of marcados) faltas.push(`${m} marcado "[[…]]" (a conferir): sem fonte, não entra na peça`);

if (soChecar || faltas.length) {
  for (const f of faltas) console.error(`✘ falta: ${f}`);
  if (soChecar) { console.log(faltas.length ? `${faltas.length} campo(s) faltando ou a conferir.` : 'Dados do caso completos para a qualificação do art. 319, II.'); process.exit(faltas.length ? 1 : 0); }
  if (faltas.length) { console.error('\nPreâmbulo não gerado: complete o bloco ```json caso da ANALISE.md (o que falta vai para "falta saber" da estrutura, não para a peça).'); process.exit(1); }
}

const maiusc = (s) => String(s).toUpperCase();
const uniao = a.uniao_estavel ? ', em união estável' : '';
const advs = Array.isArray(c.advogadas) && c.advogadas.length > 1
  ? 'por suas advogadas que esta subscrevem'
  : 'por sua advogada que esta subscreve';

// "ESTADO DO Tocantins", "ESTADO DE Goiás", "ESTADO DA Bahia": a preposição segue o
// gênero do nome do estado. Aceita também o valor já com preposição ("do Tocantins").
const PREP = {
  tocantins: 'DO', para: 'DO', parana: 'DO', maranhao: 'DO', piaui: 'DO', ceara: 'DO', 'rio grande do norte': 'DO',
  'rio grande do sul': 'DO', 'rio de janeiro': 'DO', 'espirito santo': 'DO', amazonas: 'DO', amapa: 'DO', acre: 'DO',
  'mato grosso': 'DO', 'mato grosso do sul': 'DO', 'distrito federal': 'DO', bahia: 'DA', paraiba: 'DA',
};
const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const estado = /^d[oae]s? /i.test(j.uf_extenso)
  ? maiusc(j.uf_extenso)
  : `${PREP[semAcento(j.uf_extenso)] || 'DE'} ${maiusc(j.uf_extenso)}`;

// "com sede na Avenida…", "no Núcleo…", "em Osasco…": a preposição segue o tipo de
// logradouro (antes era "na" fixo e saía "com sede na Núcleo Cidade de Deus").
const FEM = /^(avenida|av\.?|rua|r\.|alameda|travessa|praça|praca|rodovia|estrada|quadra|qd\.?|chácara|chacara|fazenda|vila|via|ladeira|marginal)\b/i;
const MASC = /^(núcleo|nucleo|setor|largo|parque|conjunto|condomínio|condominio|loteamento|residencial|lote|beco|caminho|jardim|bairro|sítio|sitio|edifício|edificio)\b/i;
const na = (end) => {
  const s = String(end).trim();
  if (FEM.test(s)) return `na ${s}`;
  if (MASC.test(s) || /^S[A-Z]{2,4}\b/.test(s)) return `no ${s}`; // SAUN, SCS, SHS: "Setor…"
  return `em ${s}`;
};

const L = [];
L.push('::endereco');
L.push(`AO JUÍZO DA ${j.vara || '__ª'} VARA ${j.competencia || 'CÍVEL'} DA`);
L.push(`COMARCA DE ${maiusc(j.comarca)}, ESTADO ${estado}`);
L.push('::');
L.push('');
L.push('::br');
L.push('');
L.push(`**${maiusc(a.nome)}**, ${a.nacionalidade}, ${a.estado_civil}${uniao}, ${a.profissao}, inscrit${/a$/i.test(a.nacionalidade) ? 'a' : 'o'} no CPF sob o nº ${a.cpf}, residente e domiciliad${/a$/i.test(a.nacionalidade) ? 'a' : 'o'} ${na(a.endereco)}, com endereço eletrônico ${a.email}, ${advs}, conforme procuração anexa (Doc. 1)${c.docs_pessoais ? ` e documentos pessoais (${c.docs_pessoais})` : ''}, vem respeitosamente perante Vossa Excelência propor a presente`);
L.push('');
L.push(`::center ${maiusc(c.acao || '[[NOME DA AÇÃO]]')}`);
if (c.subtitulo) { L.push(''); L.push(`::center (${c.subtitulo})`); }
L.push('');
const qualRe = (r) => {
  const pj = !!r.cnpj;
  const doc = pj ? `inscrita no CNPJ sob o nº ${r.cnpj}` : `inscrit${r.feminino ? 'a' : 'o'} no CPF sob o nº ${r.cpf}`;
  const nat = pj ? (r.natureza || 'pessoa jurídica de direito privado') : [r.nacionalidade, r.estado_civil, r.profissao].filter(Boolean).join(', ');
  const sede = pj ? `com sede ${na(r.endereco)}` : `residente e domiciliad${r.feminino ? 'a' : 'o'} ${na(r.endereco)}`;
  const email = r.email ? `, endereço eletrônico ${r.email}` : '';
  return `**${maiusc(r.nome)}**, ${nat}, ${doc}, ${sede}${email}`;
};
L.push(`em face de ${reus.map(qualRe).join(', e de ')}, pelos fatos e fundamentos a seguir expostos.`);
process.stdout.write(L.join('\n') + '\n');

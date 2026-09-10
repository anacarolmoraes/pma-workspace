#!/usr/bin/env node
/*
 * calc.js — Calculadora determinística da inicial de GOLPE BANCÁRIO e de
 * NEGATIVAÇÃO INDEVIDA (skill ficha-golpe-bancario).
 *
 * Uso:  node calc.js caminho/dados_caso.json
 *       node calc.js caminho/dados_caso.json --conferir caminho/PECA.md
 *
 * Lê um JSON com as transações apuradas nos extratos (nunca "de cabeça") e
 * emite FICHA_CASO.md com: dano material por transação e total líquido,
 * detecção de dupla contagem entre extratos, dobro do art. 42, p.ú., do CDC
 * condicionado à data (modulação do EAREsp 600.663/RS), tabela de encargos por
 * verba (índice, taxa e termo inicial, com a regra intertemporal da Lei
 * 14.905/2024), dano moral pelo método bifásico (valor básico do grupo de
 * casos + circunstâncias), valor da causa pela regra do perfil/definicoes.md §1
 * (292, V e VI) e o teto do Juizado Especial (40 salários mínimos).
 *
 * `--conferir PECA.md` compara todo "R$ x" da peça com os números da ficha e
 * lista o que a peça afirma e a ficha não sustenta. É o gabarito numérico que o
 * legal-consistency-validator usa na Fase de valor da causa.
 *
 * NÃO decide mérito e NÃO atualiza valores por índice (não há tabela de IPCA
 * ou Selic aqui): indica o índice, a taxa e o termo inicial de cada verba para
 * a peça pedir certo. A conta atualizada, quando precisar existir, é da
 * planilha de cumprimento (skill gerador-cumprimento-sentenca).
 */
'use strict';
const fs = require('fs');
const path = require('path');

// EAREsp 600.663/RS (Corte Especial, j. 21/10/2020, DJe 30/03/2021): a repetição
// em dobro do art. 42, p.ú., do CDC independe de má-fé, bastando conduta contrária
// à boa-fé objetiva; a tese vale para cobranças POSTERIORES à publicação do acórdão.
// Para cobranças anteriores, a jurisprudência então dominante exigia má-fé.
const MARCO_DOBRO = '2021-03-30';
// Lei 14.905/2024: vigência em 30/08/2024. Antes dela, juros de mora de 1 % ao mês
// (CC 406 c/c CTN 161, § 1º, leitura dominante) e correção pelo índice do tribunal;
// depois, correção pelo IPCA (CC 389, p.ú.) e juros pela taxa legal (CC 406, § 1º).
const MARCO_14905 = '2024-08-30';

function fmt(n) {
  const v = (Math.round(Number(n) * 100) / 100).toFixed(2);
  const [int, dec] = v.split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return null;
}
const br = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const soma = (xs, f) => xs.reduce((a, x) => a + Number(f ? f(x) : x), 0);
const arred = (n) => Math.round(Number(n) * 100) / 100;

function falhar(msg) {
  console.error(`ficha-golpe-bancario: ${msg}`);
  process.exit(1);
}

// ── conferência da peça contra a ficha ──────────────────────────────────────
function valoresDaPeca(md) {
  const txt = fs.readFileSync(md, 'utf8');
  const out = [];
  const rx = /R\$\s?([\d.]+,\d{2})/g;
  let m;
  while ((m = rx.exec(txt))) out.push(arred(Number(m[1].replace(/\./g, '').replace(',', '.'))));
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonPath = argv.find((a) => !a.startsWith('--'));
  const iConf = argv.indexOf('--conferir');
  const pecaPath = iConf >= 0 ? argv[iConf + 1] : null;
  if (!jsonPath) falhar('uso: node calc.js dados_caso.json [--conferir PECA.md]');

  const d = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));
  const tema = String(d.tema || 'golpe').toLowerCase();
  if (!['golpe', 'negativacao'].includes(tema)) falhar('`tema` deve ser "golpe" ou "negativacao"');
  const transacoes = Array.isArray(d.transacoes) ? d.transacoes : [];
  const estornos = Array.isArray(d.estornos) ? d.estornos : [];
  const cobrancas = Array.isArray(d.cobrancas_indevidas) ? d.cobrancas_indevidas : [];
  if (!transacoes.length && !cobrancas.length) falhar('informe `transacoes` (valores subtraídos) ou `cobrancas_indevidas` (o que o réu cobrou e recebeu)');
  for (const [i, t] of [...transacoes, ...estornos, ...cobrancas].entries()) {
    if (!parseLocalDate(t.data)) falhar(`item ${i + 1}: data inválida (${t.data}); use YYYY-MM-DD`);
    if (!(Number(t.valor) > 0)) falhar(`item ${i + 1}: valor inválido (${t.valor})`);
    if (!t.fonte) falhar(`item ${i + 1}: sem \`fonte\` (Doc. N, p. X) — número sem documento não entra na peça`);
  }
  const responsabilidade = String(d.responsabilidade || 'contratual').toLowerCase();
  const hoje = parseLocalDate(d.data_referencia) || new Date();

  // ── dano material ─────────────────────────────────────────────────────────
  const totalTrans = arred(soma(transacoes, (t) => t.valor));
  const totalEst = arred(soma(estornos, (t) => t.valor));
  const materialLiquido = arred(totalTrans - totalEst);

  // dupla contagem: mesmo valor e mesma data em fontes/contas diferentes
  const duplas = [];
  for (let i = 0; i < transacoes.length; i++) {
    for (let j = i + 1; j < transacoes.length; j++) {
      const a = transacoes[i], b = transacoes[j];
      if (arred(a.valor) === arred(b.valor) && a.data === b.data && (a.conta || a.fonte) !== (b.conta || b.fonte)) {
        duplas.push({ a, b });
      }
    }
  }

  // ── dobro (art. 42, p.ú., CDC) ────────────────────────────────────────────
  const pedirDobro = !!d.pedir_dobro;
  const cobAntes = cobrancas.filter((c) => c.data < MARCO_DOBRO);
  const cobDepois = cobrancas.filter((c) => c.data >= MARCO_DOBRO);
  const baseDobro = arred(soma(cobrancas, (c) => c.valor));
  const baseDobroSeguro = arred(soma(cobDepois, (c) => c.valor));
  const parcelaDobro = pedirDobro ? baseDobro : 0; // o "a mais" que o dobro acrescenta

  // ── dano moral (bifásico) ─────────────────────────────────────────────────
  const dm = d.dano_moral || {};
  const grupo = Array.isArray(dm.grupo_de_casos) ? dm.grupo_de_casos : [];
  const circ = Array.isArray(dm.circunstancias) ? dm.circunstancias : [];
  const valoresGrupo = grupo.map((g) => Number(g.valor)).filter((v) => v > 0).sort((a, b) => a - b);
  const mediana = valoresGrupo.length
    ? (valoresGrupo.length % 2 ? valoresGrupo[(valoresGrupo.length - 1) / 2]
      : (valoresGrupo[valoresGrupo.length / 2 - 1] + valoresGrupo[valoresGrupo.length / 2]) / 2)
    : null;
  const moralPedido = Number(dm.valor_pedido || 0);
  const avisosMoral = [];
  if (moralPedido > 0 && !grupo.length) avisosMoral.push('valor pedido sem grupo de casos: a heurística bifásica exige três a cinco acórdãos do tribunal competente (radar-jurisprudencia --grupo-de-casos).');
  if (moralPedido > 0 && valoresGrupo.length && moralPedido > valoresGrupo[valoresGrupo.length - 1]) {
    avisosMoral.push(`valor pedido (${fmt(moralPedido)}) acima do maior valor do grupo (${fmt(valoresGrupo[valoresGrupo.length - 1])}): cada degrau acima do teto precisa de circunstância com Doc.`);
  }
  if (moralPedido > 0 && grupo.length && !circ.length) avisosMoral.push('grupo de casos sem circunstâncias da segunda fase: o pedido fica na média, sem degrau.');
  const semDoc = circ.filter((c) => !c.doc);
  if (semDoc.length) avisosMoral.push(`${semDoc.length} circunstância(s) sem \`doc\`: circunstância sem prova não eleva o valor.`);

  // ── valor da causa (definicoes.md §1: 292, V e VI) ────────────────────────
  const valorCausa = arred(materialLiquido + parcelaDobro + moralPedido);

  // ── Juizado × vara ────────────────────────────────────────────────────────
  const sm = Number(d.salario_minimo || 0);
  const teto = sm > 0 ? arred(40 * sm) : null;
  const periciaNecessaria = !!d.pericia_necessaria;
  let rito;
  if (!teto) rito = 'sem `salario_minimo` no JSON: teto do Juizado não calculado';
  else if (periciaNecessaria) rito = `vara comum: há perícia a produzir (Lei 9.099, art. 3º — complexidade), ainda que o valor (${fmt(valorCausa)}) caiba no teto de ${fmt(teto)}`;
  else if (valorCausa <= teto) rito = `cabe no Juizado (${fmt(valorCausa)} ≤ ${fmt(teto)}); a escolha é de abertura — heurística juizado-ou-vara-comum`;
  else rito = `vara comum: ${fmt(valorCausa)} excede o teto de ${fmt(teto)} (ou renúncia ao excedente, Lei 9.099, art. 3º, § 3º)`;

  // ── encargos por verba ────────────────────────────────────────────────────
  const primeiroFato = [...transacoes, ...cobrancas].map((t) => t.data).sort()[0] || null;
  const fatoAntes14905 = primeiroFato && primeiroFato < MARCO_14905;
  const jurosTermo = responsabilidade === 'extracontratual'
    ? 'evento danoso (Súmula 54/STJ), cada transação'
    : 'citação (CC 405)';
  const encargos = [
    { verba: 'Dano material (transações)', indice: 'IPCA (CC 389, p.ú.)', termoCorr: 'cada desembolso (Súmula 43/STJ)', juros: 'taxa legal (CC 406, § 1º)', termoJuros: jurosTermo },
  ];
  if (pedirDobro) encargos.push({ verba: 'Repetição em dobro (CDC 42, p.ú.)', indice: 'IPCA', termoCorr: 'cada cobrança indevida (Súmula 43)', juros: 'taxa legal', termoJuros: jurosTermo });
  if (moralPedido > 0) encargos.push({ verba: 'Dano moral', indice: 'IPCA', termoCorr: 'arbitramento (Súmula 362/STJ)', juros: 'taxa legal', termoJuros: jurosTermo });

  // ================= FICHA =================
  const L = [];
  L.push(`# Ficha do caso — ${tema === 'golpe' ? 'golpe bancário' : 'negativação indevida'}${d.cliente ? `: ${d.cliente}` : ''}`);
  L.push('');
  L.push(`> Gerado por skill \`ficha-golpe-bancario\` a partir de \`${path.basename(jsonPath)}\` em ${br(hoje)}. Números determinísticos, cada um com a fonte declarada no JSON. A ficha não atualiza valores por índice: indica índice, taxa e termo inicial para a peça pedir certo.`);
  L.push('');
  L.push('## 1. Dano material — transações apuradas nos extratos');
  L.push('');
  if (transacoes.length) {
    L.push('| # | Data | Valor | Descrição | Canal | Conta | Fonte |');
    L.push('|---|---|---|---|---|---|---|');
    transacoes.forEach((t, i) => L.push(`| ${i + 1} | ${br(parseLocalDate(t.data))} | ${fmt(t.valor)} | ${t.descricao || ''} | ${t.canal || ''} | ${t.conta || ''} | ${t.fonte} |`));
    L.push('');
    L.push(`- Soma das transações: **${fmt(totalTrans)}**`);
  }
  if (estornos.length) {
    L.push(`- Estornos e devoluções (${estornos.length}): ${estornos.map((e) => `${fmt(e.valor)} em ${br(parseLocalDate(e.data))} (${e.fonte})`).join('; ')} = **${fmt(totalEst)}**`);
  }
  L.push(`- **Dano material líquido: ${fmt(materialLiquido)}**`);
  if (duplas.length) {
    L.push('');
    L.push(`> ⚠ **Possível dupla contagem (${duplas.length}):** mesmo valor e mesma data em contas ou fontes diferentes. Em golpe com conta intermediária, a mesma transferência aparece no extrato de origem e no de destino; conta uma vez só.`);
    for (const { a, b } of duplas) L.push(`> - ${fmt(a.valor)} em ${br(parseLocalDate(a.data))}: ${a.conta || a.fonte} × ${b.conta || b.fonte}`);
  }
  L.push('');

  L.push('## 2. Repetição em dobro (CDC, art. 42, parágrafo único)');
  L.push('');
  if (!cobrancas.length) {
    L.push('- Nenhuma cobrança indevida informada. O dobro incide sobre o que o **réu cobrou e recebeu** (tarifa, parcela de empréstimo não contratado, desconto em benefício), não sobre o valor que o golpista transferiu para terceiro. Sem `cobrancas_indevidas`, o pedido de dobro não tem base.');
  } else {
    L.push('| Data | Valor | Descrição | Fonte | Regime do dobro |');
    L.push('|---|---|---|---|---|');
    for (const c of cobrancas) L.push(`| ${br(parseLocalDate(c.data))} | ${fmt(c.valor)} | ${c.descricao || ''} | ${c.fonte} | ${c.data >= MARCO_DOBRO ? 'pós-30/03/2021: independe de má-fé' : 'pré-30/03/2021: exige má-fé'} |`);
    L.push('');
    L.push(`- Base total: ${fmt(baseDobro)} · base segura (cobranças a partir de 30/03/2021): **${fmt(baseDobroSeguro)}**${cobAntes.length ? ` · ${cobAntes.length} cobrança(s) anterior(es) ao marco exigem prova de má-fé` : ''}.`);
    L.push(`- ${pedirDobro ? `Pedido de dobro **incluído**: acrescenta ${fmt(parcelaDobro)} ao valor da causa.` : 'Pedido de dobro **não incluído** (`pedir_dobro: false`).'}`);
    L.push('- Fonte da modulação: página `earesp-600663-rs.md` do bundle `bancario/emprestimo-nao-realizado` (conferir `status` antes de citar).');
  }
  L.push('');

  L.push('## 3. Dano moral — método bifásico');
  L.push('');
  if (grupo.length) {
    L.push('**Primeira fase — grupo de casos do tribunal competente**');
    L.push('');
    L.push('| Processo | Tribunal / órgão | Data | Valor fixado | Fonte no acervo |');
    L.push('|---|---|---|---|---|');
    for (const g of grupo) L.push(`| ${g.processo || ''} | ${g.tribunal || ''} | ${g.data || ''} | ${fmt(g.valor)} | ${g.fonte || '**sem página: não citar**'} |`);
    L.push('');
    L.push(`- Faixa: ${fmt(valoresGrupo[0])} a ${fmt(valoresGrupo[valoresGrupo.length - 1])} · mediana **${fmt(mediana)}** (valor básico).`);
  } else {
    L.push('- Sem grupo de casos informado.');
  }
  if (circ.length) {
    L.push('');
    L.push('**Segunda fase — circunstâncias do caso**');
    L.push('');
    L.push('| Circunstância | Efeito | Prova |');
    L.push('|---|---|---|');
    for (const c of circ) L.push(`| ${c.fato} | ${c.efeito || 'eleva'} | ${c.doc || '**sem Doc.**'} |`);
  }
  L.push('');
  L.push(`- **Valor pedido: ${moralPedido > 0 ? fmt(moralPedido) : 'não informado'}** (entra no 292, V).`);
  for (const a of avisosMoral) L.push(`- ⚠ ${a}`);
  L.push('');

  L.push('## 4. Encargos por verba (pedir com índice, taxa e termo inicial)');
  L.push('');
  L.push('| Verba | Correção | Desde | Juros | Desde |');
  L.push('|---|---|---|---|---|');
  for (const e of encargos) L.push(`| ${e.verba} | ${e.indice} | ${e.termoCorr} | ${e.juros} | ${e.termoJuros} |`);
  L.push('');
  L.push(`- Responsabilidade declarada: **${responsabilidade}** (golpe em relação bancária costuma ser contratual, CDC 14; negativação por terceiro sem contrato é extracontratual). Muda o termo inicial dos juros; a decisão é da ANALISE.md, seção 2.`);
  if (fatoAntes14905) L.push(`- Primeiro fato em ${br(parseLocalDate(primeiroFato))}, anterior à Lei 14.905/2024 (30/08/2024): pedir juros de 1 % ao mês até 29/08/2024 e taxa legal a partir de 30/08/2024, e correção pelo índice do tribunal até a vigência e IPCA depois. Regra do escritório em \`heuristicas/juros-e-correcao-na-inicial.md\`.`);
  L.push('- **Nunca** "correção monetária pela Selic": a Selic é a base da taxa legal de juros, não índice de correção.');
  L.push('');

  L.push('## 5. Valor da causa (perfil/definicoes.md §1 — art. 292, V e VI)');
  L.push('');
  L.push('| Parcela | Valor |');
  L.push('|---|---|');
  L.push(`| Dano material líquido | ${fmt(materialLiquido)} |`);
  if (pedirDobro) L.push(`| Acréscimo do dobro | ${fmt(parcelaDobro)} |`);
  if (moralPedido > 0) L.push(`| Dano moral pedido (292, V) | ${fmt(moralPedido)} |`);
  L.push(`| **Valor da causa** | **${fmt(valorCausa)}** |`);
  L.push('');
  L.push('> O mesmo número aparece em "Dos pedidos", em "Do valor da causa" e na síntese. O `lint-inicial` reprova a peça se dois valores da causa divergirem.');
  L.push('');

  L.push('## 6. Rito');
  L.push('');
  L.push(`- ${rito}.`);
  L.push('');

  L.push('## 7. Pedidos numéricos recomendados');
  L.push('');
  L.push(`- Condenação à restituição de **${fmt(materialLiquido)}** (dano material), com correção pelo IPCA desde cada desembolso e juros pela taxa legal desde ${jurosTermo};`);
  if (pedirDobro && baseDobro > 0) L.push(`- Repetição em dobro do indevidamente cobrado (${fmt(baseDobro)}), resultando em ${fmt(baseDobro * 2)}, ou, subsidiariamente, o dobro só das cobranças posteriores a 30/03/2021 (${fmt(baseDobroSeguro * 2)});`);
  if (moralPedido > 0) L.push(`- Indenização por dano moral de **${fmt(moralPedido)}**, com correção desde o arbitramento (Súmula 362) e juros desde ${jurosTermo};`);
  L.push(`- Valor da causa: **${fmt(valorCausa)}**.`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('_Técnica: `direito/pecas/peticao-inicial/heuristicas/` (juros e correção; método bifásico; juizado ou vara). Matéria: bundle declarado em `bundle:` da peça. Conferir toda transação no extrato convertido pelo `pdfmd`, nunca em print._');

  const outName = d.out || 'FICHA_CASO.md';
  const outPath = path.resolve(path.dirname(path.resolve(jsonPath)), outName);
  fs.writeFileSync(outPath, L.join('\n'), 'utf8');

  console.log(`Material líquido: ${fmt(materialLiquido)} (${transacoes.length} transação(ões), ${estornos.length} estorno(s))${duplas.length ? ` — ⚠ ${duplas.length} possível(is) dupla(s) contagem(ns)` : ''}`);
  if (cobrancas.length) console.log(`Dobro: base ${fmt(baseDobro)} (segura ${fmt(baseDobroSeguro)}) — ${pedirDobro ? 'incluído' : 'não incluído'}`);
  console.log(`Dano moral pedido: ${moralPedido > 0 ? fmt(moralPedido) : '—'}${mediana ? ` (mediana do grupo ${fmt(mediana)})` : ''}`);
  console.log(`Valor da causa: ${fmt(valorCausa)}`);
  console.log(`Rito: ${rito}`);
  for (const a of avisosMoral) console.log(`⚠ ${a}`);
  console.log(`Ficha gravada em: ${outPath}`);

  // ── conferência da peça ───────────────────────────────────────────────────
  if (pecaPath) {
    const esperados = new Set([materialLiquido, totalTrans, totalEst, valorCausa, moralPedido, baseDobro, baseDobroSeguro, arred(baseDobro * 2), arred(baseDobroSeguro * 2), mediana || 0, teto || 0]
      .concat(transacoes.map((t) => arred(t.valor)), estornos.map((t) => arred(t.valor)), cobrancas.map((t) => arred(t.valor)), valoresGrupo)
      .filter((v) => v > 0));
    const naPeca = valoresDaPeca(path.resolve(pecaPath));
    const estranhos = [...new Set(naPeca.filter((v) => !esperados.has(v)))];
    const faltam = [materialLiquido, valorCausa].concat(moralPedido > 0 ? [moralPedido] : []).filter((v) => !naPeca.includes(v));
    console.log(`\nConferência de ${path.basename(pecaPath)}: ${naPeca.length} valor(es) em R$ na peça.`);
    for (const v of estranhos) console.log(`  ✘ ${fmt(v)} aparece na peça e não sai da ficha`);
    for (const v of faltam) console.log(`  ✘ ${fmt(v)} é número central da ficha e não aparece na peça`);
    if (!estranhos.length && !faltam.length) console.log('  ✔ todo R$ da peça tem origem na ficha; material, moral e valor da causa presentes.');
    else process.exit(1);
  }
}

main();

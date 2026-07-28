#!/usr/bin/env node
/*
 * calc.js — Calculadora determinística para inicial de rescisão de compromisso
 * de compra e venda de LOTE urbano (skill ficha-rescisao-lote).
 *
 * Uso:  node calc.js caminho/dados_caso.json
 *
 * Lê um JSON com os números apurados do contrato + extrato e emite:
 *   - um resumo no stdout;
 *   - um arquivo FICHA_CASO.md (ou o "out" indicado) com os cenários de
 *     retenção/restituição, a exposição de fruição, a sugestão de valor da
 *     causa e o texto de pedido recomendado, já mapeado aos placeholders do
 *     template TEMPLATE_INICIAL_RESCISAO_LOTE.md.
 *
 * NÃO decide mérito — apenas faz a aritmética de forma determinística, para
 * eliminar os erros de cálculo e a leitura "no olhômetro". Os números de
 * cláusula vêm do JSON (preenchidos por leitura do contrato ASSINADO, nunca
 * do OCR posicional).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MARCO_DISTRATO = new Date('2018-12-28'); // Lei 13.786/2018

function fmt(n) {
  // R$ padrão brasileiro: ponto de milhar, vírgula decimal, 2 casas.
  const v = (Math.round(n * 100) / 100).toFixed(2);
  const [int, dec] = v.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${intFmt},${dec}`;
}
function pct(n) { return `${(Math.round(n * 100) / 100).toFixed(2)}%`; }

function parseLocalDate(s) {
  // Aceita "YYYY-MM-DD" e evita o deslocamento de fuso (parse UTC → -3h).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return new Date(s);
}

function mesesEntre(d1, d2) {
  let m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) m -= 1;
  return Math.max(0, m);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node calc.js caminho/dados_caso.json');
    process.exit(1);
  }
  const jsonPath = path.resolve(arg);
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // ---- validação mínima
  const req = ['data_contrato', 'valor_original', 'valor_atualizado', 'total_pago'];
  for (const k of req) {
    if (d[k] === undefined || d[k] === null) {
      console.error(`Campo obrigatório ausente no JSON: ${k}`);
      process.exit(1);
    }
  }
  const dataContrato = parseLocalDate(d.data_contrato);
  const hoje = d.data_referencia ? parseLocalDate(d.data_referencia) : new Date();
  const pago = Number(d.total_pago);
  const vOrig = Number(d.valor_original);
  const vAtual = Number(d.valor_atualizado);
  const loteEdificado = !!d.lote_edificado;

  // ---- regime
  const posDistrato = dataContrato >= MARCO_DISTRATO;
  const regime = posDistrato
    ? 'POSTERIOR a 28/12/2018 — prevalência do CDC (REsp 2.106.548/SP): art. 32-A como teto, retenção ≤ 25% do PAGO'
    : 'ANTERIOR a 28/12/2018 — irretroatividade da Lei do Distrato: regime STJ anterior (retenção escalonada 10-25% do pago)';

  // ---- percentuais pagos
  const pctSobreAtual = (pago / vAtual) * 100;
  const pctSobreOrig = (pago / vOrig) * 100;

  // ---- cenários de retenção
  const ret10Pago = 0.10 * pago;
  const ret25Pago = 0.25 * pago;
  const ret10Contrato = 0.10 * vAtual;
  const ret25Contrato = 0.25 * vAtual;

  const cenarios = [
    { nome: '10% sobre o PAGO (pedido principal)', retido: ret10Pago, restitui: pago - ret10Pago, pctRestitui: 90, pctEfetivo: 10 },
    { nome: '25% sobre o PAGO (subsidiário / teto STJ)', retido: ret25Pago, restitui: pago - ret25Pago, pctRestitui: 75, pctEfetivo: 25 },
    { nome: '10% sobre o CONTRATO atualizado (tese da ré)', retido: ret10Contrato, restitui: pago - ret10Contrato, pctRestitui: (1 - ret10Contrato / pago) * 100, pctEfetivo: (ret10Contrato / pago) * 100 },
    { nome: '25% sobre o CONTRATO atualizado (tese da ré)', retido: ret25Contrato, restitui: pago - ret25Contrato, pctRestitui: (1 - ret25Contrato / pago) * 100, pctEfetivo: (ret25Contrato / pago) * 100 },
  ];

  // ---- fruição
  const meses = mesesEntre(dataContrato, hoje);
  const fruicaoMes = 0.0075 * vAtual;
  const fruicaoTotal = fruicaoMes * meses;

  // ---- valor da causa (preferência da titular: valor do contrato)
  // Apresenta original e atualizado; recomenda confirmar.
  const restituiPrincipal = pago - ret10Pago;

  // ================= saída =================
  const L = [];
  L.push(`# Ficha do caso — rescisão de lote${d.cliente ? `: ${d.cliente}` : ''}`);
  L.push('');
  L.push(`> Gerado por skill \`ficha-rescisao-lote\` a partir de \`${path.basename(jsonPath)}\`. Números determinísticos; conferir cláusulas no contrato assinado.`);
  L.push('');
  L.push('## Dados de entrada');
  L.push('');
  L.push('| Campo | Valor |');
  L.push('|---|---|');
  L.push(`| Data do contrato | ${dataContrato.toLocaleDateString('pt-BR')} |`);
  L.push(`| Regime aplicável | ${posDistrato ? 'pós-2018' : 'pré-2018'} |`);
  L.push(`| Valor original do contrato | ${fmt(vOrig)} |`);
  L.push(`| Valor atualizado do contrato | ${fmt(vAtual)} |`);
  L.push(`| Total pago | ${fmt(pago)} |`);
  L.push(`| % pago (sobre atualizado) | ${pct(pctSobreAtual)} |`);
  L.push(`| % pago (sobre original) | ${pct(pctSobreOrig)} |`);
  L.push(`| Lote edificado? | ${loteEdificado ? 'SIM' : 'NÃO'} |`);
  L.push(`| Meses desde o contrato (p/ fruição) | ${meses} |`);
  L.push('');
  L.push(`**Regime:** ${regime}.`);
  L.push('');
  L.push('## Cenários de retenção / restituição');
  L.push('');
  L.push('| Cenário | Retido | Restitui | % restituído | % efetivo sobre o pago |');
  L.push('|---|---|---|---|---|');
  for (const c of cenarios) {
    L.push(`| ${c.nome} | ${fmt(c.retido)} | ${fmt(c.restitui)} | ${pct(c.pctRestitui)} | ${pct(c.pctEfetivo)} |`);
  }
  L.push('');
  L.push('> **Argumento central:** o teto de 10-25% incide sobre os **valores pagos**, não sobre o valor do contrato (REsp 2.106.548/SP, itens 6 e 11). Calcular sobre o contrato atualizado inflaria a retenção efetiva — repare na coluna "% efetivo sobre o pago" das duas últimas linhas.');
  L.push('');
  L.push('## Exposição de fruição (0,75% ao mês sobre o valor atualizado)');
  L.push('');
  L.push(`- Por mês: ${fmt(fruicaoMes)} × ${meses} meses = **${fmt(fruicaoTotal)}**.`);
  if (loteEdificado) {
    L.push('- Lote **edificado**: fruição pode ser cobrada em separado, limitada a 0,75% e ressalvado o Tema 970/STJ (cláusula penal moratória em valor locativo). Verificar previsão contratual e prova de proveito.');
  } else {
    L.push('- Lote **não edificado**: fruição **INDEVIDA** (REsp 2.106.548/SP, item 8; vedação ao enriquecimento sem causa). Pedir o afastamento integral. A conta acima serve só para mostrar o absurdo do pedido da ré.');
  }
  L.push('');
  L.push('## Valor da causa');
  L.push('');
  L.push(`- Valor original do contrato: **${fmt(vOrig)}**`);
  L.push(`- Valor atualizado do contrato: **${fmt(vAtual)}**`);
  L.push(`- (referência) Valor buscado na restituição (principal): ${fmt(restituiPrincipal)}`);
  L.push('');
  L.push('> Preferência da titular: **valor da causa = valor do contrato**. Confirmar qual (original × atualizado) antes de fechar. Não usar número aproximado.');
  L.push('');
  L.push('## Pedido recomendado (item "f" dos pedidos)');
  L.push('');
  L.push(`**Principal:** restituição de **${fmt(restituiPrincipal)}**, correspondentes a 90% dos ${fmt(pago)} efetivamente pagos (retenção de 10% sobre o pago), em parcela única, corrigidos pelo IGPM desde cada desembolso e juros de mora de 1% ao mês.`);
  L.push('');
  L.push(`**Subsidiário:** caso se entenda que a retenção incide sobre o valor atualizado do contrato, redução ao teto de 25% dos valores pagos (restituindo ${fmt(pago - ret25Pago)}), na forma do art. 413 do CC e do art. 51, §2º, do CDC.`);
  L.push('');
  if (d.clausulas) {
    L.push('## Cláusulas referenciadas (conferidas no contrato assinado)');
    L.push('');
    L.push('| Papel na peça | Cláusula |');
    L.push('|---|---|');
    const rotulos = {
      eleicao_foro: 'Eleição de foro (cap. IV)',
      atividade_re: 'Atividade da ré / relação de consumo (cap. V)',
      reconhece_cdc: 'Reconhecimento do CDC (cap. V)',
      retencao: 'Cláusula penal / retenção (cap. VI)',
      fruicao: 'Fruição (cap. VII)',
      corretagem_exclui: 'Corretagem fora do preço (cap. VIII)',
      corretagem_naorestitui: 'Corretagem não restituível (cap. VIII)',
      encargos_moratorios: 'Encargos moratórios (cap. IX)',
      parcelamento: 'Restituição parcelada (cap. X)',
      negativacao: 'Negativação / protesto (cap. XI)',
    };
    for (const [k, v] of Object.entries(d.clausulas)) {
      L.push(`| ${rotulos[k] || k} | ${v} |`);
    }
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('_Fontes do bundle: `teses/cdc-prevalece-lei-distrato-contratos-pos-2018.md` (pós-2018) ou `teses/irretroatividade-lei-distrato-contratos-anteriores-2018.md` (pré-2018); `jurisprudencia/resp-2106548-sp.md`; `jurisprudencia/tjmt-ai-1017433-56-2019-iptu-tutela.md`. Template: `material_padrao_escritorio/TEMPLATE_INICIAL_RESCISAO_LOTE.md`._');

  const outName = d.out || 'FICHA_CASO.md';
  const outPath = path.resolve(path.dirname(jsonPath), outName);
  fs.writeFileSync(outPath, L.join('\n'), 'utf8');

  // stdout resumo
  console.log(`Regime: ${posDistrato ? 'pós-2018 (CDC prevalece)' : 'pré-2018 (irretroatividade)'}`);
  console.log(`Pago: ${fmt(pago)} (${pct(pctSobreAtual)} do valor atualizado)`);
  console.log(`Principal (reter 10% do pago): restitui ${fmt(restituiPrincipal)}`);
  console.log(`Subsidiário (teto 25% do pago): restitui ${fmt(pago - ret25Pago)}`);
  console.log(`Fruição ${loteEdificado ? '(lote edificado — verificar)' : '(lote não edificado — INDEVIDA)'}: exposição ${fmt(fruicaoTotal)} em ${meses} meses`);
  console.log(`Ficha gravada em: ${outPath}`);
}

main();

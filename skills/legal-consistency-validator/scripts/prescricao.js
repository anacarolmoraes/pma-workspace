#!/usr/bin/env node
/**
 * prescricao.js — calcula a data-limite de prescrição ou decadência e a compara com o ajuizamento.
 *
 * POR QUE EXISTE
 * A prejudicial de prescrição é a defesa que mais se perde por erro de data: conta-se de
 * cabeça, esquece-se a suspensão da Lei 14.010/2020, ignora-se que a citação retroage à
 * propositura (CPC, art. 240, § 1º). O script faz a aritmética; a ESCOLHA do termo inicial
 * (actio nata) e da regra continua sendo julgamento da titular, com página no bundle.
 *
 * CONTAGEM (Código Civil, art. 132): exclui o dia do começo e inclui o do vencimento; prazo
 * em meses ou anos vence no dia de igual número do início, ou no imediato se faltar (§ 3º);
 * vencimento em dia não útil (sábado, domingo, feriado nacional) prorroga para o dia útil
 * seguinte (§ 1º) — o script aplica e AVISA, porque há divergência na aplicação à prescrição.
 * Prazo material: dias CORRIDOS, sem recesso forense.
 *
 * INTERRUPÇÃO (CC, art. 202): uma única vez; recomeça da data do ato (parágrafo único). A
 * citação válida interrompe e retroage à data da PROPOSITURA (CPC, art. 240, § 1º), desde que
 * o autor promova a citação em 10 dias (§ 2º) — por isso o ajuizamento é a data comparada.
 * SUSPENSÃO: os dias suspensos são somados ao final (arts. 197 a 201). Lei 14.010/2020,
 * art. 3º: prazos prescricionais impedidos ou suspensos de 12/06/2020 a 30/10/2020.
 * DECADÊNCIA (CC, art. 207): não se suspende nem se interrompe, salvo disposição legal.
 *
 * USO
 *   node skills/legal-consistency-validator/scripts/prescricao.js --termo 2021-03-15 --regra 206-3-v \
 *        [--distribuicao 2026-09-01] [--interrupcao 2023-01-10:protesto] \
 *        [--suspensao 2024-01-01:2024-03-01] [--sem-lei14010] [--md]
 *   node ... --termo 2019-05-02 --prazo 5 --unidade anos --distribuicao 2026-09-01   (regra livre)
 *   node ... --regras                                                                (lista as regras)
 *
 *   --md  imprime o rascunho da prejudicial (termo, prazo, norma, limite, ajuizamento, conclusão)
 *
 * SAÍDA: exit 0 (dentro do prazo), exit 3 (prescrito/decaído), exit 1 (erro), exit 2 (uso).
 */
'use strict';

const REGRAS = {
  '205': { tipo: 'prescrição', prazo: 10, unidade: 'anos', norma: 'CC, art. 205', descricao: 'prazo geral, quando a lei não fixa menor (ex.: responsabilidade contratual, STJ EREsp 1.280.825)' },
  '206-1-ii': { tipo: 'prescrição', prazo: 1, unidade: 'anos', norma: 'CC, art. 206, § 1º, II', descricao: 'pretensão do segurado contra o segurador' },
  '206-3-iii': { tipo: 'prescrição', prazo: 3, unidade: 'anos', norma: 'CC, art. 206, § 3º, III', descricao: 'aluguéis de prédios urbanos ou rústicos' },
  '206-3-iv': { tipo: 'prescrição', prazo: 3, unidade: 'anos', norma: 'CC, art. 206, § 3º, IV', descricao: 'ressarcimento de enriquecimento sem causa' },
  '206-3-v': { tipo: 'prescrição', prazo: 3, unidade: 'anos', norma: 'CC, art. 206, § 3º, V', descricao: 'reparação civil (extracontratual)' },
  '206-5-i': { tipo: 'prescrição', prazo: 5, unidade: 'anos', norma: 'CC, art. 206, § 5º, I', descricao: 'cobrança de dívida líquida constante de instrumento público ou particular' },
  '206-5-ii': { tipo: 'prescrição', prazo: 5, unidade: 'anos', norma: 'CC, art. 206, § 5º, II', descricao: 'honorários de profissional liberal (conta do fim do contrato ou mandato)' },
  'cdc-27': { tipo: 'prescrição', prazo: 5, unidade: 'anos', norma: 'CDC, art. 27', descricao: 'reparação por fato do produto ou do serviço; conta do conhecimento do dano e da autoria' },
  'cdc-26-i': { tipo: 'decadência', prazo: 30, unidade: 'dias', norma: 'CDC, art. 26, I', descricao: 'vício aparente, produto ou serviço não durável' },
  'cdc-26-ii': { tipo: 'decadência', prazo: 90, unidade: 'dias', norma: 'CDC, art. 26, II', descricao: 'vício aparente, produto ou serviço durável (vício oculto: conta do aparecimento, § 3º)' },
  '178': { tipo: 'decadência', prazo: 4, unidade: 'anos', norma: 'CC, art. 178', descricao: 'anulação do negócio jurídico (coação: do dia em que cessar; erro, dolo, fraude, lesão: do dia do negócio; incapaz: do dia em que cessar a incapacidade)' },
  '179': { tipo: 'decadência', prazo: 2, unidade: 'anos', norma: 'CC, art. 179', descricao: 'anulação quando a lei não fixa prazo, contado da conclusão do ato' },
  '445': { tipo: 'decadência', prazo: 30, unidade: 'dias', norma: 'CC, art. 445', descricao: 'vício redibitório, bem móvel (imóvel: 1 ano); oculto: do conhecimento, com o teto do § 1º' },
  '501': { tipo: 'decadência', prazo: 1, unidade: 'anos', norma: 'CC, art. 501', descricao: 'venda ad mensuram, complementação de área ou abatimento' },
  'lc-118': { tipo: 'prescrição', prazo: 5, unidade: 'anos', norma: 'CTN, art. 168 c/c LC 118/2005, art. 3º', descricao: 'repetição de indébito tributário, do pagamento' },
};

// Feriados nacionais (só para a prorrogação do art. 132, § 1º). Estender a cada ano.
const FERIADOS = new Set([
  '2024-01-01', '2024-03-29', '2024-04-21', '2024-05-01', '2024-09-07', '2024-10-12', '2024-11-02', '2024-11-15', '2024-11-20', '2024-12-25',
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25',
  '2026-01-01', '2026-04-03', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01',
]);

const d2s = (d) => d.toISOString().slice(0, 10);
const s2d = (s) => new Date(`${s}T12:00:00Z`);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function data(s, rotulo) {
  if (!ISO.test(String(s || ''))) throw new Error(`${rotulo}: data inválida "${s}" (AAAA-MM-DD).`);
  return s2d(s);
}
function args(argv) {
  const a = { interrupcao: [], suspensao: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const chave = k.slice(2);
    const next = argv[i + 1];
    const temValor = next && !next.startsWith('--');
    if (Array.isArray(a[chave])) { if (temValor) { a[chave].push(next); i++; } continue; }
    if (!temValor) a[chave] = true; else { a[chave] = next; i++; }
  }
  return a;
}
const diaUtil = (d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FERIADOS.has(d2s(d));
const diasEntre = (a, b) => Math.round((b - a) / 86400000);

// art. 132: exclui o dia do começo; anos/meses vencem no dia de igual número (§ 3º)
function somarPrazo(inicio, prazo, unidade) {
  const x = new Date(inicio);
  if (unidade === 'dias') { x.setUTCDate(x.getUTCDate() + prazo); return x; }
  const dia = x.getUTCDate();
  if (unidade === 'meses') x.setUTCMonth(x.getUTCMonth() + prazo);
  else x.setUTCFullYear(x.getUTCFullYear() + prazo);
  if (x.getUTCDate() !== dia) x.setUTCDate(0); // faltou o dia (29/02, 31): vence no último dia do mês
  return x;
}

function main() {
  const a = args(process.argv);
  if (a.regras) {
    for (const [k, r] of Object.entries(REGRAS)) process.stdout.write(`${k.padEnd(10)} ${r.tipo.padEnd(11)} ${String(r.prazo).padStart(3)} ${r.unidade.padEnd(5)} ${r.norma} — ${r.descricao}\n`);
    return 0;
  }
  if (!a.termo || (!a.regra && !a.prazo)) {
    console.error('Uso: node prescricao.js --termo AAAA-MM-DD (--regra chave | --prazo N --unidade anos|meses|dias [--decadencia]) [--distribuicao D] [--interrupcao D:motivo] [--suspensao D1:D2] [--sem-lei14010] [--md]\n       node prescricao.js --regras');
    return 2;
  }
  let regra;
  if (a.regra) {
    regra = REGRAS[String(a.regra).toLowerCase()];
    if (!regra) throw new Error(`--regra desconhecida: ${a.regra}. Veja --regras.`);
  } else {
    regra = { tipo: a.decadencia ? 'decadência' : 'prescrição', prazo: parseInt(a.prazo, 10), unidade: a.unidade || 'anos', norma: '(regra informada à mão)', descricao: 'prazo livre' };
    if (!['anos', 'meses', 'dias'].includes(regra.unidade)) throw new Error('--unidade deve ser anos, meses ou dias.');
  }
  const avisos = [
    'O termo inicial (actio nata, ciência do dano, fim do contrato, data do negócio) é julgamento, não aritmética: conferir a regra e o termo na página do bundle antes de alegar.',
  ];
  const termo = data(a.termo, '--termo');
  const distribuicao = a.distribuicao ? data(a.distribuicao, '--distribuicao') : null;
  const eventos = [{ data: d2s(termo), o_que: `termo inicial (${regra.descricao})` }];

  // --- interrupção: uma vez só, recomeça do ato -------------------------------------------
  let inicio = termo;
  const interrupcoes = a.interrupcao.map((s) => { const [d, m] = s.split(':'); return { data: data(d, '--interrupcao'), motivo: m || 'não informado' }; }).sort((x, y) => x.data - y.data);
  if (interrupcoes.length && regra.tipo === 'decadência') {
    avisos.push('DECADÊNCIA não se interrompe (CC, art. 207): as interrupções informadas foram IGNORADAS.');
  } else if (interrupcoes.length) {
    const limiteAntes = somarPrazo(inicio, regra.prazo, regra.unidade);
    const primeira = interrupcoes[0];
    if (primeira.data > limiteAntes) {
      avisos.push(`A interrupção de ${d2s(primeira.data)} (${primeira.motivo}) veio DEPOIS de o prazo já ter vencido em ${d2s(limiteAntes)}: não reabre prazo prescrito.`);
    } else {
      inicio = primeira.data;
      eventos.push({ data: d2s(primeira.data), o_que: `interrupção (${primeira.motivo}); prazo recomeça do zero (CC, art. 202, parágrafo único)` });
      if (interrupcoes.length > 1) avisos.push(`A prescrição só se interrompe UMA vez (CC, art. 202, caput): as demais interrupções (${interrupcoes.slice(1).map((i) => d2s(i.data)).join(', ')}) foram ignoradas.`);
    }
  }

  // --- suspensões: somam dias ao final -----------------------------------------------------
  const suspensoes = a.suspensao.map((s) => { const [i, f] = s.split(':'); return { ini: data(i, '--suspensao'), fim: data(f, '--suspensao'), motivo: 'informada' }; });
  if (!a['sem-lei14010']) suspensoes.push({ ini: s2d('2020-06-12'), fim: s2d('2020-10-30'), motivo: 'Lei 14.010/2020, art. 3º (pandemia)' });
  let limite = somarPrazo(inicio, regra.prazo, regra.unidade);
  let diasSuspensos = 0;
  if (regra.tipo === 'decadência' && suspensoes.some((s) => s.motivo === 'informada')) {
    avisos.push('DECADÊNCIA não se suspende (CC, art. 207), salvo disposição legal: as suspensões informadas foram IGNORADAS.');
  } else {
    // iteração: a suspensão que cai dentro do prazo estende o limite, que pode alcançar outra
    let mudou = true; const usadas = new Set();
    while (mudou) {
      mudou = false;
      for (const s of suspensoes) {
        if (usadas.has(s)) continue;
        const ini = s.ini > inicio ? s.ini : inicio;
        const fim = s.fim < limite ? s.fim : limite;
        if (ini <= fim && s.ini <= limite && s.fim >= inicio) {
          const n = diasEntre(ini, fim) + 1;
          if (regra.tipo === 'decadência' && s.motivo.startsWith('Lei 14.010')) {
            avisos.push('Lei 14.010/2020, art. 3º, fala em prazos PRESCRICIONAIS; a extensão à decadência é discutida — aplicada aqui, conferir.');
          }
          diasSuspensos += n; usadas.add(s); mudou = true;
          limite = new Date(limite); limite.setUTCDate(limite.getUTCDate() + n);
          eventos.push({ data: `${d2s(ini)} a ${d2s(fim)}`, o_que: `suspensão (${s.motivo}): +${n} dia(s)` });
        }
      }
    }
  }

  // --- art. 132, § 1º: vencimento em dia não útil ------------------------------------------
  const limiteBruto = new Date(limite);
  while (!diaUtil(limite)) limite.setUTCDate(limite.getUTCDate() + 1);
  if (d2s(limite) !== d2s(limiteBruto)) avisos.push(`Vencimento bruto em ${d2s(limiteBruto)} (dia não útil) prorrogado para ${d2s(limite)} (CC, art. 132, § 1º); há divergência sobre a prorrogação em prazo prescricional — não contar com ela se a margem for só essa.`);
  eventos.push({ data: d2s(limite), o_que: `DATA-LIMITE (${regra.tipo}, ${regra.prazo} ${regra.unidade}, ${regra.norma})` });

  // --- comparação com o ajuizamento --------------------------------------------------------
  let conclusao = null; let margem = null;
  if (distribuicao) {
    margem = diasEntre(distribuicao, limite);
    const consumado = distribuicao > limite;
    conclusao = consumado
      ? `${regra.tipo.toUpperCase()} CONSUMADA: ação distribuída em ${d2s(distribuicao)}, ${-margem} dia(s) depois do limite (${d2s(limite)}).`
      : `Dentro do prazo: ação distribuída em ${d2s(distribuicao)}, ${margem} dia(s) antes do limite (${d2s(limite)}).`;
    if (regra.tipo === 'prescrição') avisos.push('A interrupção pela citação retroage à PROPOSITURA (CPC, art. 240, § 1º) se o autor promoveu a citação em 10 dias (§ 2º); demora imputável só ao Judiciário não prejudica o autor (§ 3º). Por isso a comparação é com a distribuição.');
    if (!consumado && margem <= 30) avisos.push(`Margem curta (${margem} dia(s)): qualquer erro no termo inicial ou na regra muda o resultado; examinar as alternativas de termo.`);
  } else {
    avisos.push('Sem --distribuicao não há conclusão: informe a data do ajuizamento para comparar.');
  }

  const saida = { regra: { chave: a.regra || null, ...regra }, termo_inicial: d2s(termo), inicio_da_contagem: d2s(inicio), dias_suspensos: diasSuspensos, data_limite: d2s(limite), distribuicao: distribuicao ? d2s(distribuicao) : null, margem_dias: margem, conclusao, linha_do_tempo: eventos, AVISOS: avisos };

  if (a.md) {
    const l = [
      `**${regra.tipo === 'decadência' ? 'Decadência' : 'Prescrição'}.** Termo inicial: ${d2s(termo)} (${regra.descricao}). Prazo: ${regra.prazo} ${regra.unidade} (${regra.norma}).`,
    ];
    for (const e of eventos.slice(1, -1)) l.push(`${e.o_que}: ${e.data}.`);
    l.push(`Data-limite: **${d2s(limite)}**.${distribuicao ? ` Ajuizamento: ${d2s(distribuicao)}. ${conclusao}` : ''}`);
    l.push('', '<!-- rascunho gerado por prescricao.js: conferir termo inicial e regra na página do bundle; dissolver em prosa antes de entrar na peça -->');
    process.stdout.write(l.join('\n') + '\n');
  } else {
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  }
  return distribuicao && distribuicao > limite ? 3 : 0;
}

try {
  process.exit(main());
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * prazo-citacao.js — os três relógios do réu, contados da CITAÇÃO (não da intimação no DJEN).
 *
 * POR QUE EXISTE
 * A fila do DJEN é de intimações: citação em processo novo, sem advogado nos autos, não
 * aparece nela. O relógio do art. 335 do CPC dependia de alguém contar à mão e anotar em
 * cronologia.md. Este script conta os três prazos que nascem com a citação e, se pedido,
 * grava a linha na fila (PENDENTES.md) para o hook de início de sessão alertar.
 *
 * OS TRÊS RELÓGIOS
 *   1. Contestação (art. 335): 15 dias úteis, termo inicial por inciso:
 *        I   — audiência de conciliação realizada/frustrada  → dia do começo = data da audiência
 *        II  — pedido do réu de cancelamento da audiência     → dia do começo = protocolo do pedido
 *        III — sem audiência                                  → dia do começo = art. 231, conforme o modo
 *      Litisconsórcio passivo: última das datas (art. 231, § 1º); pedido de cancelamento por
 *      um só réu conta do respectivo protocolo (art. 335, § 1º).
 *   2. Agravo de instrumento contra tutela deferida (art. 1.015, I): 15 dias úteis da
 *      INTIMAÇÃO da decisão (art. 1.003, § 5º). Se a intimação veio no ato da citação, conta
 *      do mesmo dia do começo; se veio pelo DJEN, conta da disponibilização (regra do prazo-core).
 *   3. Desinteresse na audiência (art. 334, § 5º): petição avulsa até 10 dias ÚTEIS antes da
 *      audiência (contagem processual, art. 219). Perder esse dia obriga a comparecer (§ 8º).
 *
 * ART. 231 — dia do começo conforme o modo de citação (a data informada é a do evento):
 *   correio    → juntada aos autos do AR                    (inc. I)
 *   oficial    → juntada aos autos do mandado cumprido      (inc. II)
 *   escrivao   → data do ato do escrivão/chefe de secretaria (inc. III)
 *   edital     → dia útil seguinte ao FIM da dilação        (inc. IV)  [informar o fim da dilação]
 *   eletronica → dia útil seguinte à CONSULTA ao teor       (inc. V)   [informar a data da consulta]
 *   carta      → juntada da carta cumprida / comunicado     (inc. VI)
 *
 * CONTAGEM: exclui o dia do começo e inclui o do vencimento (art. 224); dias úteis (art. 219);
 * começo e vencimento em dia não útil vão para o dia útil seguinte (art. 224, § 1º); recesso
 * de 20/12 a 20/01 suspende (art. 220). Feriado local do tribunal vem de feriados/<sigla>.json.
 *
 * USO
 *   node skills/pesquisa-djen/scripts/prazo-citacao.js --processo N --tribunal TJTO \
 *        --citacao 2026-09-01 --modo oficial [--citacao 2026-09-05 ...para litisconsorte] \
 *        [--audiencia 2026-10-15] [--cancelamento 2026-09-20] \
 *        [--liminar | --liminar-djen 2026-09-02] [--dias 15] [--caso nome] \
 *        [--cronologia] [--fila] [--gravar]
 *
 *   --cronologia  imprime as linhas prontas para cronologia.md do caso
 *   --fila        imprime a linha para PENDENTES.md (sem gravar)
 *   --gravar      acrescenta a linha à fila (o monitor só acrescenta; TRATADA é manual)
 *
 * LIMITES (propagar ao usuário): feriado local depende da portaria anual; JEC tem regime
 * próprio (Lei 9.099, art. 30: contestação na audiência) — não usar; matéria penal corre em
 * dias corridos — não usar. Este script não substitui a conferência no eproc.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const core = require('../lib/prazo-core');

const { criarCalendario, feriadosLocais, calcularPrazo, d2s, s2d } = core;

const MODOS = {
  correio: { inciso: 'I', evento: 'juntada aos autos do AR', util_seguinte: false },
  oficial: { inciso: 'II', evento: 'juntada aos autos do mandado cumprido', util_seguinte: false },
  escrivao: { inciso: 'III', evento: 'ato do escrivão ou chefe de secretaria', util_seguinte: false },
  edital: { inciso: 'IV', evento: 'fim da dilação do edital', util_seguinte: true },
  eletronica: { inciso: 'V', evento: 'consulta ao teor da citação eletrônica', util_seguinte: true },
  carta: { inciso: 'VI', evento: 'juntada da carta cumprida (ou do comunicado do art. 232)', util_seguinte: false },
};

function args(argv) {
  const a = { citacao: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const chave = k.slice(2);
    const next = argv[i + 1];
    const temValor = next && !next.startsWith('--');
    if (chave === 'citacao') {
      if (temValor) { a.citacao.push(next); i++; }
      continue;
    }
    if (!temValor) a[chave] = true;
    else { a[chave] = next; i++; }
  }
  return a;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function data(s, rotulo) {
  if (!ISO.test(String(s))) throw new Error(`${rotulo}: data inválida "${s}" (use AAAA-MM-DD).`);
  const d = s2d(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${rotulo}: data inválida "${s}".`);
  return d;
}

function contar(cal, comeco, dias) {
  // art. 224: exclui o dia do começo; 1º dia contado é o dia útil seguinte
  const termo = cal.proximoDiaUtil(comeco);
  const fatal = cal.contarDiasUteis(termo, dias);
  return { termo_inicial: d2s(termo), data_fatal: d2s(fatal) };
}

function diasUteisAntes(cal, ref, n) {
  const x = new Date(ref);
  let c = 0;
  while (c < n) {
    x.setUTCDate(x.getUTCDate() - 1);
    if (cal.diaUtil(x)) c++;
  }
  return x;
}

function main() {
  const a = args(process.argv);
  if (!a.citacao.length || !a.modo) {
    console.error(
      'Uso: node prazo-citacao.js --citacao AAAA-MM-DD --modo correio|oficial|escrivao|edital|eletronica|carta ' +
        '[--processo N] [--tribunal SIGLA] [--audiencia D] [--cancelamento D] [--liminar | --liminar-djen D] ' +
        '[--dias 15] [--caso nome] [--cronologia] [--fila] [--gravar]',
    );
    process.exit(2);
  }
  const modo = MODOS[String(a.modo).toLowerCase()];
  if (!modo) throw new Error(`--modo desconhecido: ${a.modo}. Opções: ${Object.keys(MODOS).join(', ')}.`);
  const dias = a.dias ? parseInt(a.dias, 10) : 15;
  const tribunal = a.tribunal ? String(a.tribunal).toUpperCase() : undefined;
  const locais = feriadosLocais(tribunal);
  const cal = criarCalendario(locais.datas);
  const avisos = [locais.aviso];

  // --- art. 231: dia do começo pela citação (última data, se litisconsórcio) ----------------
  const eventos = a.citacao.map((s) => data(s, '--citacao')).sort((x, y) => x - y);
  const ultimo = eventos[eventos.length - 1];
  const comeco231 = modo.util_seguinte ? cal.proximoDiaUtil(ultimo) : ultimo;
  if (eventos.length > 1) avisos.push(`Litisconsórcio passivo: usado o último evento (${d2s(ultimo)}), art. 231, § 1º.`);
  if (modo.inciso === 'V') {
    avisos.push(
      'Citação eletrônica: informe a data da CONSULTA ao teor. Sem consulta, o começo é o dia útil seguinte ao fim do prazo para consultá-la (art. 231, V) — conferir no sistema; a citação por e-mail ainda exige confirmação em 3 dias úteis (art. 246, § 1º-B), sem a qual se cita por outro meio.',
    );
  }
  if (modo.inciso === 'IV') avisos.push('Edital: a data informada deve ser o FIM da dilação fixada pelo juiz; o começo é o dia útil seguinte (art. 231, IV).');

  // --- art. 335: qual inciso rege ---------------------------------------------------------
  let inciso335; let comeco335; let motivo;
  if (a.cancelamento) {
    inciso335 = 'II';
    comeco335 = data(a.cancelamento, '--cancelamento');
    motivo = 'protocolo do pedido de cancelamento da audiência pelo réu (art. 334, § 4º, I)';
    avisos.push('Art. 335, II, só se aplica se o AUTOR já manifestou desinteresse na inicial e o réu pediu o cancelamento; caso contrário a audiência se mantém e rege o inciso I.');
  } else if (a.audiencia) {
    inciso335 = 'I';
    comeco335 = data(a.audiencia, '--audiencia');
    motivo = 'audiência de conciliação/mediação frustrada (ou última sessão)';
  } else {
    inciso335 = 'III';
    comeco335 = comeco231;
    motivo = `sem audiência: começo pelo art. 231, ${modo.inciso} (${modo.evento})`;
  }
  const contestacao = { inciso_335: inciso335, dia_do_comeco: d2s(comeco335), motivo, dias_uteis: dias, ...contar(cal, comeco335, dias) };
  if (inciso335 !== 'III') {
    contestacao.se_nao_houver_audiencia = { inciso_335: 'III', dia_do_comeco: d2s(comeco231), ...contar(cal, comeco231, dias) };
  }

  // --- agravo contra a liminar -------------------------------------------------------------
  let agravo = null;
  if (a['liminar-djen']) {
    const r = calcularPrazo({ disponibilizacao: String(a['liminar-djen']), dias: 15, tribunal });
    agravo = { base: 'intimação pelo DJEN (art. 1.003, § 5º; art. 231, VII)', disponibilizacao: r.disponibilizacao, termo_inicial: r.termo_inicial, data_fatal: r.data_fatal };
  } else if (a.liminar) {
    agravo = { base: `intimação no ato da citação (art. 1.003, § 5º c/c art. 231, ${modo.inciso})`, dia_do_comeco: d2s(comeco231), ...contar(cal, comeco231, 15) };
  }
  if (agravo) {
    avisos.push('Agravo (art. 1.015, I): pedido de reconsideração NÃO suspende o prazo. Decidir o agravo na mesma reunião em que se abre a contestação.');
    if (agravo.data_fatal < contestacao.data_fatal) avisos.push(`O agravo vence ANTES da contestação (${agravo.data_fatal} < ${contestacao.data_fatal}).`);
  }

  // --- desinteresse na audiência (art. 334, § 5º) ------------------------------------------
  let desinteresse = null;
  if (a.audiencia) {
    const aud = data(a.audiencia, '--audiencia');
    const limite = diasUteisAntes(cal, aud, 10);
    desinteresse = { audiencia: d2s(aud), ultimo_dia_para_peticao_avulsa: d2s(limite), regra: 'art. 334, § 5º: até 10 dias (úteis, art. 219) antes da audiência; só o desinteresse de AMBAS as partes cancela (§ 4º, I); ausência injustificada = multa de até 2% (§ 8º)' };
    avisos.push('Há corrente que conta os 10 dias do art. 334, § 5º, em dias corridos; a data acima é a mais conservadora (úteis). Protocolar antes dela.');
  }

  avisos.push('Juizado Especial (Lei 9.099, art. 30: contestação na audiência) e matéria penal (dias corridos) NÃO usam este cálculo.');
  avisos.push('Conferir no eproc o evento de citação e a data de juntada antes de contar com a data fatal.');

  const saida = {
    processo: a.processo || null,
    tribunal: tribunal || null,
    citacao: { modo: a.modo, inciso_231: modo.inciso, evento: modo.evento, datas_informadas: a.citacao, dia_do_comeco_231: d2s(comeco231) },
    contestacao,
    agravo_contra_liminar: agravo,
    desinteresse_na_audiencia: desinteresse,
    feriados_locais: { aplicados: locais.datas.length, arquivo: locais.arquivo },
    AVISOS: avisos,
  };

  const rotuloTrib = tribunal || '?';
  const linhaFila =
    `| ABERTA | ${a.processo || '(sem número)'} | ${rotuloTrib} / Citação (manual) | ${d2s(ultimo)} | ` +
    `Citação — contestação (art. 335, ${inciso335}) | n/a | **${contestacao.data_fatal}**${locais.datas.length ? '' : ' ⚠ SEM FERIADO LOCAL'} | ` +
    `${contestacao.termo_inicial} | ${a.caso || '?'} | <!-- id:manual-${Date.now()} -->`;

  if (a.cronologia) {
    const l = [
      `- ${d2s(ultimo)} — citação (${modo.evento}; art. 231, ${modo.inciso}).`,
      `- **${contestacao.data_fatal}** — data fatal da CONTESTAÇÃO (art. 335, ${inciso335}; ${dias} d.ú. a partir de ${contestacao.termo_inicial}).`,
    ];
    if (agravo) l.push(`- **${agravo.data_fatal}** — data fatal do AGRAVO contra a tutela (art. 1.015, I; art. 1.003, § 5º).`);
    if (desinteresse) l.push(`- **${desinteresse.ultimo_dia_para_peticao_avulsa}** — último dia para petição de desinteresse na audiência de ${desinteresse.audiencia} (art. 334, § 5º).`);
    process.stdout.write(l.join('\n') + '\n');
    return;
  }
  if (a.fila || a.gravar) {
    process.stdout.write(linhaFila + '\n');
    if (a.gravar) {
      const fila = path.join(__dirname, '..', 'monitor', 'PENDENTES.md');
      const atual = fs.readFileSync(fila, 'utf8');
      fs.writeFileSync(fila, atual.replace(/\s*$/, '\n') + linhaFila + '\n', 'utf8');
      process.stdout.write(`Linha acrescentada a ${path.relative(process.cwd(), fila)}. Trocar ABERTA por TRATADA ao protocolar.\n`);
    }
    return;
  }
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
}

try {
  main();
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(1);
}

#!/usr/bin/env node
// pesquisa-djen: calcula termo inicial e data fatal de prazo (dias ÚTEIS) a partir da
// intimação disponibilizada no DJEN.
// Uso: node prazo.js --processo N --tribunal SIGLA --dias 15 [--data AAAA-MM-DD] [--inicio AAAA-MM-DD --fim AAAA-MM-DD]
// Regras: publicação = 1º dia útil após a disponibilização (Lei 11.419/2006, art. 4º, §3º);
//         termo inicial = 1º dia útil após a publicação (CPC, art. 224, §§2º-3º);
//         contagem em dias úteis (CPC, art. 219), pulando feriados nacionais/forenses e
//         o recesso do art. 220 do CPC (20/12 a 20/01, prazos suspensos).
// LIMITE: NÃO conhece feriados locais/portarias do tribunal — conferir antes do protocolo.
// LIMITE: matéria penal corre em dias CORRIDOS — não usar este script.
'use strict';

// Feriados nacionais + forenses (estender a cada ano; formato AAAA-MM-DD)
const FERIADOS = new Set([
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-11-20', '2026-12-25',
  // 2027 (preencher ao virar o ano)
  '2027-01-01',
]);

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { a[k.slice(2)] = true; }
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}

const soDigitos = (s) => String(s).replace(/\D/g, '');
const d2s = (d) => d.toISOString().slice(0, 10);
const s2d = (s) => new Date(`${s}T12:00:00Z`); // meio-dia UTC evita bug de fuso

function emRecesso(d) { // CPC art. 220: 20/12 a 20/01
  const m = d.getUTCMonth() + 1, dia = d.getUTCDate();
  return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
}
function diaUtil(d) {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !FERIADOS.has(d2s(d)) && !emRecesso(d);
}
function proximoDiaUtil(d) {
  const x = new Date(d);
  do { x.setUTCDate(x.getUTCDate() + 1); } while (!diaUtil(x));
  return x;
}
function contarDiasUteis(inicio, n) { // inicio já é o 1º dia da contagem (dia útil)
  let x = new Date(inicio), c = 1;
  while (c < n) { x = proximoDiaUtil(x); c++; }
  return x;
}

async function buscarComunicacoes(a) {
  const q = new URLSearchParams({
    numeroProcesso: soDigitos(a.processo),
    itensPorPagina: '100',
    pagina: '1',
  });
  if (a.tribunal) q.set('siglaTribunal', String(a.tribunal).toUpperCase());
  if (a.inicio) q.set('dataDisponibilizacaoInicio', a.inicio);
  if (a.fim) q.set('dataDisponibilizacaoFim', a.fim);
  const res = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${q}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DJEN HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).items || [];
}

(async () => {
  const a = args(process.argv);
  if (!a.processo || !a.dias) {
    console.error('Uso: node prazo.js --processo N --dias 15 [--tribunal SIGLA] [--data AAAA-MM-DD] [--inicio --fim] [--feriados arquivo.json]');
    process.exit(2);
  }

  // Feriados locais do tribunal: JSON com array de datas "AAAA-MM-DD"
  // (ex.: skills/pesquisa-djen/feriados/tjto.json, alimentado da portaria anual).
  let feriadosLocais = 0;
  if (a.feriados) {
    const lista = JSON.parse(require('fs').readFileSync(a.feriados, 'utf8'));
    const datas = Array.isArray(lista) ? lista : lista.datas;
    for (const d of datas) { FERIADOS.add(d); feriadosLocais++; }
  }

  let anchor; let itens = [];
  if (a.data && !a.processo) {
    anchor = { data_disponibilizacao: a.data, origem: 'informada manualmente' };
  } else {
    itens = await buscarComunicacoes(a);
    if (a.data) {
      anchor = itens.find((i) => i.data_disponibilizacao === a.data);
      if (!anchor) throw new Error(`Nenhuma comunicação disponibilizada em ${a.data} para este processo.`);
    } else {
      if (!itens.length) throw new Error('Nenhuma comunicação encontrada no DJEN para os filtros dados.');
      anchor = itens.slice().sort((x, y) => String(y.data_disponibilizacao).localeCompare(String(x.data_disponibilizacao)))[0];
    }
  }

  const disp = s2d(anchor.data_disponibilizacao);
  const publicacao = proximoDiaUtil(disp);
  const termoInicial = proximoDiaUtil(publicacao);
  const dataFatal = contarDiasUteis(termoInicial, parseInt(a.dias, 10));

  const saida = {
    processo: anchor.numeroprocessocommascara || a.processo,
    comunicacao: anchor.id ? {
      id: anchor.id,
      tipoComunicacao: anchor.tipoComunicacao,
      tipoDocumento: anchor.tipoDocumento,
      orgao: anchor.nomeOrgao,
      meio: anchor.meiocompleto || anchor.meio,
    } : { origem: anchor.origem },
    datas: {
      disponibilizacao_djen: d2s(disp),
      publicacao: d2s(publicacao),
      termo_inicial_prazo: d2s(termoInicial),
      prazo_dias_uteis: parseInt(a.dias, 10),
      DATA_FATAL: d2s(dataFatal),
    },
    outras_comunicacoes_no_periodo: itens
      .filter((i) => i.id !== anchor.id)
      .map((i) => ({ id: i.id, data: i.data_disponibilizacao, tipo: i.tipoDocumento })),
    AVISOS: [
      feriadosLocais > 0
        ? `Feriados locais carregados de ${a.feriados} (${feriadosLocais} datas) - conferir se a lista cobre o periodo e esta atualizada com a portaria anual.`
        : 'Feriados LOCAIS/portarias do tribunal NAO considerados (use --feriados arquivo.json) - conferir calendario do tribunal antes do protocolo.',
      'Prazo em dias UTEIS (civel). Materia penal corre em dias corridos - nao usar este calculo.',
      'Confirmar que a comunicacao-ancora e a intimacao correta (tipoDocumento/texto).',
    ],
  };
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

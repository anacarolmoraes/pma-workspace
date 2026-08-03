#!/usr/bin/env node
// radar-jurisprudencia: coleta candidatos a jurisprudência no DJEN (API Comunica/PJe, pública, sem auth).
//
// Etapa 100% determinística — zero LLM, zero token. Consulta por texto livre, filtra o que
// não é decisão (edital, mero expediente), deduplica por processo, recorta o dispositivo e
// grava tudo em arquivos. A triagem de favorabilidade é do agente (ver ../SKILL.md).
//
// Uso:
//   node buscar.js --termos "rescisão contrato loteamento;distrato" --tribunais TJTO,STJ,TJRS,TJSP,TJCE \
//                  [--inicio 2024-01-01] [--fim AAAA-MM-DD] [--saida DIR] \
//                  [--max-por-tribunal 40] [--alvo 30] [--paginas 2]
//
// Convenções:
//   --termos     separados por ";" — cada termo vira uma consulta independente por tribunal
//   --tribunais  em ORDEM DE PRIORIDADE (tribunal da peça primeiro, STJ segundo)
//   --alvo       parada antecipada: atingiu N candidatos únicos E já cobriu os 2 primeiros
//                tribunais da lista → não consulta os demais (economia de rede e de triagem)
//   --saida      diretório de resultado: candidatos.json (metadados + trecho) e textos/<id>.txt
//                (texto integral — ler SÓ os finalistas, nunca a pasta inteira)
//
// Saída no console é resumo curto; o conteúdo mora nos arquivos (evita corrupção de acentos
// no console Windows — mesma classe de problema documentada em pesquisa-djen).
'use strict';

const fs = require('fs');
const path = require('path');

const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hoje = () => new Date().toISOString().slice(0, 10);

// A API recusa rajadas ("O sistema está muito ocupado"): pausa entre requisições + retry com backoff.
async function consultar(params, tentativa = 1) {
  const q = new URLSearchParams(params);
  let data;
  try {
    const res = await fetch(`${BASE}?${q}`, { headers: { Accept: 'application/json' } });
    data = await res.json();
    if (data.status === 'success') return data;
    throw new Error(data.message || `HTTP ${res.status}`);
  } catch (e) {
    if (tentativa >= 4) throw new Error(`DJEN falhou após ${tentativa} tentativas: ${e.message}`);
    await dormir(tentativa * 2500);
    return consultar(params, tentativa + 1);
  }
}

function limparHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Conectivos que abrem o dispositivo, mais os fechos com que o STJ encerra o voto.
// A lista antiga só conhecia a abertura e perdia o julgado que decide em "não
// conheço do recurso" ou fecha em "é como voto" — forma corrente no Tribunal.
// Acento é opcional em toda a lista: o texto vem de fontes diferentes (API do
// DJEN, HTML limpo, OCR) e nem todas o preservam. Exigir acento fazia o
// dispositivo passar despercebido em parte do acervo.
const MARCA_DISPOSITIVO = /(ante o exposto|diante do exposto|isto posto|posto isto|posto isso|pelo exposto|ex positis|face ao exposto|em face do exposto|do exposto|do dispositivo|[ée] como voto|[ée] o voto|n[ãa]o conhe(?:[çc]o|cido) do recurso|nego provimento ao recurso|dou provimento ao recurso)/i;

// Cabeçalho de ementa. Publicação do DJEN muitas vezes traz SÓ a ementa, sem
// relatório nem dispositivo: aí o recorte por conectivo não acha nada e o texto
// caía num slice cego de 2000 caracteres, que corta a ementa no meio.
const MARCA_EMENTA = /\bementa\b\s*[:\-–]?/i;

// Fim da ementa: onde começa o acórdão/relatório, ou a assinatura do julgamento.
const FIM_EMENTA = /(ac[oó]rd[aã]o\b|relat[oó]rio\b|vistos,? relatados|a turma, por unanimidade|prosseguindo no julgamento)/i;

// "Rel. Min. Fulano", "Relator Ministro Fulano", "Relatora Ministra Fulana".
const MARCA_RELATOR = /\brel(?:\.|ator[a]?)\s*:?\s*min(?:\.|istr[oa])\s*:?\s*([A-ZÀ-Ú][\wÀ-ÿ.'-]*(?:\s+(?:de|da|do|dos|das|e)?\s*[A-ZÀ-Ú][\wÀ-ÿ.'-]*){0,4})/i;

function extrairRelator(texto) {
  const m = MARCA_RELATOR.exec(texto || '');
  return m ? `Min. ${m[1].replace(/\s+/g, ' ').trim().replace(/[.,;]$/, '')}` : null;
}

// Só interessa o que decide algo: liminar, sentença, acórdão, voto, decisão.
// Edital e mero expediente ("cite-se", "conclusos") não são jurisprudência.
function elegivel(item, texto) {
  if (/edital/i.test(item.tipoComunicacao || '')) return false;
  const tipoOk = /(decis|senten|ac[oó]rd|voto|liminar|julgamento)/i.test(item.tipoDocumento || '');
  if (!tipoOk && !MARCA_DISPOSITIVO.test(texto)) return false;
  // Texto curto sem verbo decisório = despacho de expediente publicado como "decisão".
  if (texto.length < 900 && !/(defiro|indefiro|julgo|concedo|nego provimento|dou provimento|homologo)/i.test(texto)) return false;
  return true;
}

// Recorte para triagem: abertura (identifica a matéria) + janela do dispositivo (identifica quem ganhou).
// É isso que o triador lê — nunca o texto integral, que fica em textos/<id>.txt para os finalistas.
function recortar(texto) {
  const abertura = texto.slice(0, 500);
  const m = MARCA_DISPOSITIVO.exec(texto);
  if (m && m.index >= 500) return `${abertura} [...] ${texto.slice(m.index, m.index + 1500)}`;

  // Sem dispositivo à vista: se há ementa, ela é a unidade a preservar. Cortar
  // uma ementa ao meio entrega ao triador o cabeçalho de matéria sem o
  // entendimento — que é justamente o que ele precisa julgar.
  const e = MARCA_EMENTA.exec(texto);
  if (e) {
    const corpo = texto.slice(e.index);
    const f = FIM_EMENTA.exec(corpo.slice(200));
    const fim = f ? 200 + f.index : Math.min(corpo.length, 2500);
    return corpo.slice(0, fim);
  }
  return texto.slice(0, 2000);
}

// Publicação que traz ementa e não traz dispositivo: sinaliza para a triagem que
// o que está à mão é o resumo oficial, não a razão de decidir. O inteiro teor
// continua obrigatório antes de citar (SKILL.md).
function soEmenta(texto) {
  return MARCA_EMENTA.test(texto) && !MARCA_DISPOSITIVO.test(texto);
}

// Triagem principal x similar, do fluxo da Secretaria de Jurisprudência do STJ
// (Manual de Organização 2026, cap. 5): num lote de julgados repetidos, um é o
// PRINCIPAL e recebe leitura de inteiro teor; os demais são SIMILARES e apontam
// para ele. Sem isso, paga-se leitura profunda N vezes pela mesma tese.
//
// A assinatura é grosseira de propósito — órgão + as palavras mais fortes do
// recorte. Errar para o lado de "principal" só custa uma leitura a mais;
// agrupar demais esconderia julgado divergente.
function assinatura(c) {
  const base = semAcento(`${c.tribunal}|${c.orgao || ''}|${c.classe || ''}`);
  const corpo = semAcento(c.trecho || '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 5)
    .slice(0, 40)
    .sort()
    .join(' ');
  return `${base}#${corpo}`;
}

function marcarPrincipalOuSimilar(candidatos) {
  const grupos = new Map();
  for (const c of candidatos) {
    const k = assinatura(c);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  for (const grupo of grupos.values()) {
    // O de maior score vira principal: é o que melhor casa com a tese buscada.
    grupo.sort((a, b) => b.score - a.score);
    grupo.forEach((c, i) => {
      c.natureza = i === 0 ? 'principal' : 'similar';
      if (i > 0) c.similar_a = grupo[0].id;
    });
  }
  return candidatos;
}

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Relevância zero-LLM: ocorrências dos termos (e de --relevantes) no texto, sem acento,
// com teto por termo para um documento repetitivo não dominar o ranking. Em volume grande,
// a triagem LLM lê só o topo desse ranking — é o corte que segura o custo.
function pontuar(texto, termos) {
  const t = semAcento(texto);
  let score = 0;
  for (const termo of termos) {
    const alvo = semAcento(termo);
    if (!alvo) continue;
    let n = 0;
    let i = 0;
    while ((i = t.indexOf(alvo, i)) !== -1 && n < 10) { n++; i += alvo.length; }
    score += n;
  }
  return score;
}

async function main() {
  const a = args(process.argv);
  if (!a.termos || !a.tribunais) {
    console.error('Uso: node buscar.js --termos "t1;t2" --tribunais TJXX,STJ,... [--relevantes "p1;p2"] [--inicio] [--fim] [--saida DIR] [--max-por-tribunal] [--alvo] [--paginas]');
    process.exit(2);
  }
  const termos = String(a.termos).split(';').map((t) => t.trim()).filter(Boolean);
  // --relevantes: palavras que não servem para buscar mas indicam aderência à tese (ex.: "32-A").
  const relevantes = String(a.relevantes || '').split(';').map((t) => t.trim()).filter(Boolean);
  const vocabulario = [...termos, ...relevantes];
  const tribunais = String(a.tribunais).split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const inicio = a.inicio || '2024-01-01';
  const fim = a.fim || hoje();
  const saida = path.resolve(a.saida || 'radar-djen-resultado');
  const maxPorTribunal = Number(a['max-por-tribunal'] || 40);
  const alvo = Number(a.alvo || 30);
  const paginas = Number(a.paginas || 2);

  fs.mkdirSync(path.join(saida, 'textos'), { recursive: true });

  const porProcesso = new Map(); // dedupe: mesmo processo pode ser publicado várias vezes
  const consultas = [];

  for (let ti = 0; ti < tribunais.length; ti++) {
    const tribunal = tribunais[ti];
    // STF não publica no DJEN (DJe próprio) — a API só devolve erro. Fora por regra da skill.
    if (tribunal === 'STF') { consultas.push({ tribunal, aviso: 'STF fora do DJEN — ignorado' }); continue; }

    let coletadosTribunal = 0;
    for (const termo of termos) {
      if (coletadosTribunal >= maxPorTribunal) break;
      let countApi = 0;
      for (let pag = 1; pag <= paginas; pag++) {
        let data;
        try {
          data = await consultar({
            siglaTribunal: tribunal,
            texto: termo,
            dataDisponibilizacaoInicio: inicio,
            dataDisponibilizacaoFim: fim,
            itensPorPagina: '100',
            pagina: String(pag),
          });
        } catch (e) {
          consultas.push({ tribunal, termo, erro: e.message });
          break;
        }
        countApi = data.count;
        const itens = data.items || [];
        for (const item of itens) {
          if (coletadosTribunal >= maxPorTribunal) break;
          const texto = limparHtml(item.texto);
          if (!elegivel(item, texto)) continue;
          const processo = item.numeroprocessocommascara || item.numero_processo || String(item.id);
          const chave = `${tribunal}|${processo}`;
          const previo = porProcesso.get(chave);
          if (previo && previo.chars >= texto.length) continue;
          porProcesso.set(chave, {
            id: item.id,
            processo,
            tribunal,
            orgao: item.nomeOrgao,
            classe: item.nomeClasse,
            data: item.data_disponibilizacao,
            tipoComunicacao: item.tipoComunicacao,
            tipoDocumento: item.tipoDocumento,
            link: item.link,
            termo,
            chars: texto.length,
            score: pontuar(texto, vocabulario),
            trecho: recortar(texto),
            // Relator não era capturado em lugar nenhum do pipeline — sem ele
            // não se consulta "o que o Min. X decide sobre isto", que é metade
            // do valor de um radar de jurisprudência.
            relator: extrairRelator(texto),
            so_ementa: soEmenta(texto),
            _texto: texto,
          });
          coletadosTribunal++;
        }
        if (itens.length < 100 || coletadosTribunal >= maxPorTribunal) { registrar(); break; }
        if (pag === paginas) registrar();
        await dormir(600);
        function registrar() { consultas.push({ tribunal, termo, countApi, paginasLidas: pag }); }
      }
      await dormir(600);
    }
    // Parada antecipada: já cobriu tribunal da peça + STJ (2 primeiros) e tem candidato de sobra.
    if (ti >= 1 && porProcesso.size >= alvo) break;
  }

  const candidatos = marcarPrincipalOuSimilar(
    [...porProcesso.values()].sort((x, y) => (y.score - x.score) || (y.data || '').localeCompare(x.data || '')),
  );
  for (const c of candidatos) {
    fs.writeFileSync(path.join(saida, 'textos', `${c.id}.txt`), c._texto, 'utf8');
    delete c._texto;
  }
  fs.writeFileSync(
    path.join(saida, 'candidatos.json'),
    JSON.stringify({ inicio, fim, termos, tribunais, consultas, total: candidatos.length, candidatos }, null, 2),
    'utf8',
  );

  const porTribunal = {};
  for (const c of candidatos) porTribunal[c.tribunal] = (porTribunal[c.tribunal] || 0) + 1;
  console.log(`Candidatos: ${candidatos.length} ${JSON.stringify(porTribunal)}`);
  const similares = candidatos.filter((c) => c.natureza === 'similar').length;
  const comRelator = candidatos.filter((c) => c.relator).length;
  const soEm = candidatos.filter((c) => c.so_ementa).length;
  console.log(
    `Triagem: ${candidatos.length - similares} principal(is), ${similares} similar(es) · ` +
      `${comRelator} com relator identificado · ${soEm} publicação(ões) só-ementa.`,
  );
  for (const q of consultas) {
    if (q.erro) console.log(`  ERRO ${q.tribunal} "${q.termo}": ${q.erro}`);
    else if (q.aviso) console.log(`  ${q.aviso}`);
    else console.log(`  ${q.tribunal} "${q.termo}": ${q.countApi} na API`);
  }
  console.log(`Resultado: ${path.join(saida, 'candidatos.json')}`);
  if (!candidatos.length) console.log('Nenhum candidato — reformular os termos (mais amplos/sinônimos) e rodar de novo.');
}

if (require.main === module) {
  main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
}

module.exports = { limparHtml, elegivel, recortar, pontuar, extrairRelator, soEmenta, marcarPrincipalOuSimilar };

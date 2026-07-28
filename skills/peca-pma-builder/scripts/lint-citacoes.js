#!/usr/bin/env node
// lint-citacoes — verifica que toda citação transcrita na peça existe de fato na
// fonte que ela alega, e que o número do precedente confere.
//
// PRD F2.2. Antídoto para o risco mais caro da operação: ementa fabricada em peça
// protocolada não tem correção. A proibição nº 5 do README ("Não fabricar ementa
// ou número de Tema STJ") era, até aqui, uma instrução escrita para um modelo
// probabilístico obedecer por boa vontade.
//
// Arquitetura em DUAS camadas (do sql-guard.ts do eve-analyst):
//   1. BLOQUEIO DURO — citação que não bate com a fonte, ou precedente de tribunal
//      superior ausente do acervo. Função pura, sem prompt no meio: não há como
//      desobedecer. Trava a compilação.
//   2. APROVAÇÃO — citação a página `status: em_teste` (não conferida contra fonte
//      oficial). Não bloqueia: exige que a peça declare `cita_em_teste: sim` no
//      frontmatter, de modo que a decisão fique REGISTRADA no documento.
//
// Uso:
//   node lint-citacoes.js peca.md              # relatório + veredito
//   node lint-citacoes.js peca.md --json       # saída estruturada
//   node lint-citacoes.js peca.md --só-aviso   # nunca falha (modo de rodagem inicial)
//
// Saída: 0 = ok · 1 = citação divergente/ausente (BLOQUEIA) · 3 = exige aprovação
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');

// ── Corpus: onde uma citação pode estar ancorada ───────────────────────────
function raizesCorpus(pecaPath) {
  const raizes = [];
  // 1. Acervo (arsenal-juridico). O caminho é de máquina, então mora em
  //    perfil/ambiente.json, gerado pelo setup.js — nunca hardcoded (PRD F7).
  //    Fallback para perfil.json cobre workspace ainda não migrado.
  const lerJson = (p) => {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  };
  const ambiente = lerJson(path.join(RAIZ, 'perfil', 'ambiente.json'));
  const perfil = lerJson(path.join(RAIZ, 'perfil', 'perfil.json'));
  const acervo = ambiente?.bundles || perfil?.caminhos?.bundles;
  if (acervo) raizes.push(acervo);
  // 2. Acervo local por tema (jurisprudencia_stj/, teses/, casos_decididos/)
  for (const area of ['direito_bancario', 'direito_digital', 'rescisao_contrato_imovel', 'recursos_gerais', 'cobranca_honorarios']) {
    const p = path.join(RAIZ, area);
    if (fs.existsSync(p)) raizes.push(p);
  }
  // 3. A própria pasta do caso (sentença, contestação, acórdão dos autos)
  raizes.push(path.dirname(path.resolve(pecaPath)));
  const pai = path.dirname(path.dirname(path.resolve(pecaPath)));
  if (pai.startsWith(RAIZ)) raizes.push(pai);
  return [...new Set(raizes)].filter((r) => fs.existsSync(r));
}

function varrer(dir, saida = [], profundidade = 0) {
  if (profundidade > 6) return saida;
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const e of entradas) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p, saida, profundidade + 1);
    else if (e.name.endsWith('.md')) saida.push(p);
  }
  return saida;
}

// ── Normalização ───────────────────────────────────────────────────────────
const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) =>
  semAcento(String(s).toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Número brasileiro: aceita 2.222.059 e 2222059 na mesma busca.
function variantesNumero(digitos) {
  const pontuado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return [...new Set([digitos, pontuado])];
}

// ── Extração das citações da peça ──────────────────────────────────────────
// Padrão do dialeto PMA: bloco `>` com o texto, e a última linha `> (fonte)`.
function extrairCitacoes(texto) {
  const linhas = texto.split('\n');
  const citacoes = [];
  let i = 0;
  while (i < linhas.length) {
    if (!linhas[i].trim().startsWith('>')) {
      i++;
      continue;
    }
    const bloco = [];
    const linhaInicial = i + 1;
    while (i < linhas.length && linhas[i].trim().startsWith('>')) {
      bloco.push(linhas[i].trim().replace(/^>\s?/, ''));
      i++;
    }
    // Tolerância de forma: a atribuição pode vir no MESMO bloco (separada por uma
    // linha ">") ou num bloco vizinho, separado por linha em branco. As duas formas
    // aparecem nas peças reais; exigir só uma geraria falso positivo em massa.
    let j = i;
    while (j < linhas.length && linhas[j].trim() === '') j++;
    if (j < linhas.length && j > i && linhas[j].trim().startsWith('>')) {
      const vizinho = [];
      let k = j;
      while (k < linhas.length && linhas[k].trim().startsWith('>')) {
        vizinho.push(linhas[k].trim().replace(/^>\s?/, ''));
        k++;
      }
      const texto = vizinho.join(' ').trim();
      if (/^\(.*\)\.?$/s.test(texto)) {
        bloco.push('', texto);
        i = k;
      }
    }

    const paras = bloco.join('\n').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (!paras.length) continue;

    // Atribuição: último parágrafo inteiramente entre parênteses.
    const ultimo = paras[paras.length - 1];
    const ehAtribuicao = /^\(.*\)\.?$/s.test(ultimo);
    const fonte = ehAtribuicao ? ultimo.replace(/^\(|\)\.?$/g, '').trim() : null;
    const corpo = (ehAtribuicao ? paras.slice(0, -1) : paras).join(' ');

    if (!corpo) continue;
    citacoes.push({ linha: linhaInicial, corpo, fonte });
  }
  return citacoes;
}

// ── Identificadores dentro da atribuição ───────────────────────────────────
const CLASSES_SUPERIOR = /\b(REsp|AREsp|AgInt|AgRg|EAREsp|EREsp|RE|ARE|ADI|ADPF|HC)\b/i;

function identificadores(fonte) {
  if (!fonte) return [];
  const ids = [];

  // Precedente de tribunal superior: REsp 2.222.059/SP, AREsp 600.663/RS…
  for (const m of fonte.matchAll(/\b(REsp|AREsp|AgInt|AgRg|EAREsp|EREsp|RE|ARE|ADI|ADPF|HC)\b[^\d]{0,12}([\d.]{4,})/gi)) {
    const digitos = m[2].replace(/\D/g, '');
    if (digitos.length >= 4) ids.push({ tipo: 'precedente', rotulo: `${m[1].toUpperCase()} ${m[2]}`, buscas: variantesNumero(digitos), superior: true });
  }
  // Súmula
  for (const m of fonte.matchAll(/\bS[úu]mula\s*n?[.º°]*\s*(\d+)/gi)) {
    ids.push({ tipo: 'sumula', rotulo: `Súmula ${m[1]}`, buscas: [`sumula ${m[1]}`, `sumula n ${m[1]}`], superior: true, regex: new RegExp(`s[úu]mula\\s*n?[.º°]*\\s*${m[1]}\\b`, 'i') });
  }
  // Tema repetitivo
  for (const m of fonte.matchAll(/\bTema\s*n?[.º°]*\s*(\d+)/gi)) {
    ids.push({ tipo: 'tema', rotulo: `Tema ${m[1]}`, buscas: [`tema ${m[1]}`], superior: true, regex: new RegExp(`tema\\s*n?[.º°]*\\s*${m[1]}\\b`, 'i') });
  }
  // Número CNJ de processo (20 dígitos)
  for (const m of fonte.matchAll(/\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/g)) {
    const digitos = m[0].replace(/\D/g, '');
    ids.push({ tipo: 'processo', rotulo: m[0], buscas: [digitos], superior: false });
  }
  // Legislação: Lei nº 15.109/2025, Lei 13.786/2018…
  for (const m of fonte.matchAll(/\bLei\s*n?[.º°]*\s*([\d.]{3,})\s*\/?\s*(\d{4})?/gi)) {
    const digitos = m[1].replace(/\D/g, '');
    if (digitos.length >= 3) {
      ids.push({ tipo: 'lei', rotulo: `Lei ${m[1]}${m[2] ? '/' + m[2] : ''}`, buscas: variantesNumero(digitos), superior: false });
    }
  }
  return ids;
}

// ── Verificação ────────────────────────────────────────────────────────────
// A comparação numérica roda sobre a versão SÓ-DÍGITOS do documento: "1004093-35.2025.8.26.0156",
// "10040933520258260156" e "1.004.093/35" viram a mesma sequência. Sem isso, um mesmo
// precedente casa num arquivo e não casa no arquivo vizinho da mesma cadeia — foi o que
// fazia o lint comparar o texto contra o documento errado e acusar divergência falsa.
function contemIdentificador(doc, id) {
  // Súmula e Tema têm regex própria e número curto: casar dentro de um blob de
  // dígitos produziria coincidência por acaso ("9999" aparece em qualquer acervo).
  if (id.regex) return id.regex.test(doc.bruto);

  return id.buscas.some((b) => {
    const soDigitos = b.replace(/\D/g, '');
    if (!soDigitos) return doc.norm.includes(norm(b));

    // Número CNJ (20 dígitos): a pontuação varia entre documentos, então compara-se
    // sobre o blob colapsado. É longo o bastante para não colidir por acaso.
    if (soDigitos.length >= 14) return doc.digitos.includes(soDigitos);

    // Precedente e lei: exigir a sequência como RUN COMPLETO de dígitos, para que
    // "REsp 9.876.543" não case por estar contido em outro número maior.
    return doc.runs.has(soDigitos) || doc.norm.includes(norm(b));
  });
}

// Verificação por TRECHOS CONTÍGUOS (n-gramas), não por sacola de palavras.
//
// Sacola de palavras não serve aqui: um arquivo grande (ex.: a compilação de todas
// as súmulas do STJ) contém quase todo vocabulário jurídico, então uma ementa
// ADULTERADA pontua 100% — foi exatamente o falso negativo que este método corrige.
// Já uma sequência de 8 palavras seguidas só aparece se o texto foi transcrito de
// verdade. Recorte legítimo continua passando: o recorte é contíguo.
const JANELA = 8;
const PASSO = 4;

function sobreposicao(corpo, alvoNorm) {
  const palavras = norm(corpo).split(' ').filter(Boolean);
  if (!palavras.length) return 0;

  if (palavras.length <= JANELA) {
    return alvoNorm.includes(palavras.join(' ')) ? 1 : 0;
  }

  let total = 0;
  let acertos = 0;
  for (let i = 0; i + JANELA <= palavras.length; i += PASSO) {
    total++;
    if (alvoNorm.includes(palavras.slice(i, i + JANELA).join(' '))) acertos++;
  }
  return total ? acertos / total : 0;
}

function statusDaPagina(texto) {
  const m = /^status:\s*(.+)$/m.exec(texto.slice(0, 2000));
  return m ? m[1].trim().replace(/['"]/g, '') : null;
}

function main() {
  const args = process.argv.slice(2);
  const pecaPath = args.find((a) => !a.startsWith('--'));
  const jsonOut = args.includes('--json');
  const soAviso = args.includes('--só-aviso') || args.includes('--so-aviso');

  if (!pecaPath) {
    console.error('Uso: node lint-citacoes.js <peca.md> [--json] [--so-aviso]');
    process.exit(2);
  }

  const peca = fs.readFileSync(pecaPath, 'utf8');
  const aceitaEmTeste = /^cita_em_teste:\s*(sim|true|yes)/im.test(peca.slice(0, 1200));
  const citacoes = extrairCitacoes(peca);

  // Índice do corpus (lido uma vez)
  const arquivos = [];
  for (const r of raizesCorpus(pecaPath)) varrer(r, arquivos);
  const alvoPeca = path.resolve(pecaPath);
  const corpus = arquivos
    .filter((f) => path.resolve(f) !== alvoPeca)
    .map((f) => {
      let t = '';
      try {
        t = fs.readFileSync(f, 'utf8');
      } catch {
        /* ignore */
      }
      // runs = cada sequência contígua de dígitos, para casar número de precedente
      // com precisão; digitos = tudo colapsado, para número CNJ com pontuação variável.
      return {
        arquivo: f,
        bruto: t,
        norm: norm(t),
        digitos: t.replace(/\D/g, ''),
        runs: new Set((t.match(/\d+/g) || []).concat((t.match(/\d[\d.]*\d/g) || []).map((x) => x.replace(/\D/g, '')))),
        status: statusDaPagina(t),
      };
    });

  const resultados = [];

  for (const c of citacoes) {
    const ids = identificadores(c.fonte);

    if (!c.fonte) {
      resultados.push({ ...c, veredito: 'SEM_FONTE', gravidade: 'error', detalhe: 'Bloco de citação sem linha de atribuição entre parênteses — toda transcrição precisa declarar a fonte.' });
      continue;
    }
    if (!ids.length) {
      resultados.push({ ...c, veredito: 'FONTE_SEM_ID', gravidade: 'warning', detalhe: `Atribuição sem identificador rastreável (REsp/Súmula/Tema/processo): "${c.fonte.slice(0, 90)}".` });
      continue;
    }

    const superior = ids.some((i) => i.superior);
    const candidatos = corpus.filter((d) => ids.some((id) => contemIdentificador(d, id)));

    if (!candidatos.length) {
      resultados.push({
        ...c,
        veredito: 'NAO_ENCONTRADA',
        gravidade: superior ? 'error' : 'warning',
        detalhe: superior
          ? `${ids.map((i) => i.rotulo).join(', ')} NÃO existe no acervo. Precedente de tribunal superior citado precisa estar depositado (README, proibição nº 5). Se for real, ingerir no bundle antes de citar.`
          : `${ids.map((i) => i.rotulo).join(', ')} não está no acervo — não foi possível verificar a transcrição. Conferir manualmente contra a fonte.`,
      });
      continue;
    }

    const melhor = candidatos
      .map((d) => ({ d, s: sobreposicao(c.corpo, d.norm) }))
      .sort((a, b) => b.s - a.s)[0];

    const rel = path.relative(RAIZ, melhor.d.arquivo) || melhor.d.arquivo;
    const pct = Math.round(melhor.s * 100);

    // Limiares calibrados para n-gramas contíguos: transcrição fiel (mesmo recortada)
    // fica perto de 1; texto alterado despenca para perto de 0. Não há meio-termo
    // amplo, então a faixa de "suspeita" é estreita de propósito.
    if (melhor.s < 0.15) {
      resultados.push({ ...c, veredito: 'DIVERGENTE', gravidade: 'error', fonteArquivo: rel, detalhe: `Apenas ${pct}% dos trechos contíguos do texto citado aparecem em ${rel}. A transcrição NÃO corresponde à fonte alegada — ementa alterada, atribuição errada ou texto fabricado.` });
      continue;
    }
    if (melhor.s < 0.5) {
      resultados.push({ ...c, veredito: 'SUSPEITA', gravidade: 'warning', fonteArquivo: rel, detalhe: `${pct}% dos trechos contíguos conferem com ${rel}. Divergência parcial: conferir se é recorte com supressões (legítimo) ou alteração indevida.` });
      continue;
    }

    const st = melhor.d.status;
    if (st && /em[_ ]teste/i.test(st) && !aceitaEmTeste) {
      resultados.push({ ...c, veredito: 'EM_TESTE', gravidade: 'aprovacao', fonteArquivo: rel, detalhe: `Verificada (${pct}%) contra ${rel} — mas essa página está \`status: em_teste\`: não foi conferida contra fonte oficial.` });
      continue;
    }
    if (st && /superada/i.test(st)) {
      resultados.push({ ...c, veredito: 'SUPERADA', gravidade: 'error', fonteArquivo: rel, detalhe: `A página ${rel} está \`status: superada\`. Citar precedente superado é erro grave.` });
      continue;
    }

    resultados.push({ ...c, veredito: 'VERIFICADA', gravidade: 'ok', fonteArquivo: rel, detalhe: `${pct}% do texto confere com ${rel}${st ? ` (status: ${st})` : ''}.` });
  }

  // ── Relatório ────────────────────────────────────────────────────────────
  const erros = resultados.filter((r) => r.gravidade === 'error');
  const aprov = resultados.filter((r) => r.gravidade === 'aprovacao');
  const avisos = resultados.filter((r) => r.gravidade === 'warning');
  const ok = resultados.filter((r) => r.gravidade === 'ok');

  if (jsonOut) {
    console.log(JSON.stringify({ peca: pecaPath, total: resultados.length, erros: erros.length, aprovacao: aprov.length, avisos: avisos.length, ok: ok.length, resultados }, null, 2));
  } else {
    console.log(`lint-citacoes: ${resultados.length} citação(ões) em ${path.basename(pecaPath)} · corpus: ${corpus.length} arquivos\n`);
    const marca = { error: 'BLOQUEIA', aprovacao: 'APROVAR ', warning: 'AVISO   ', ok: 'ok      ' };
    for (const g of ['error', 'aprovacao', 'warning', 'ok']) {
      for (const r of resultados.filter((x) => x.gravidade === g)) {
        console.log(`  ${marca[g]} linha ${r.linha} [${r.veredito}]`);
        console.log(`           fonte citada: ${r.fonte ? r.fonte.slice(0, 100) : '(nenhuma)'}`);
        console.log(`           ${r.detalhe}`);
      }
    }
    console.log(`\n${ok.length} verificada(s) · ${avisos.length} aviso(s) · ${aprov.length} exigindo aprovação · ${erros.length} bloqueando.`);
    if (aprov.length && !soAviso) {
      console.log(
        `\nPara citar página \`em_teste\` conscientemente, declare no frontmatter da peça:\n` +
          `    cita_em_teste: sim\n` +
          `A decisão fica registrada no próprio documento — não num parâmetro de linha de comando.`,
      );
    }
  }

  if (soAviso) process.exit(0);
  if (erros.length) process.exit(1);
  if (aprov.length) process.exit(3);
  process.exit(0);
}

main();

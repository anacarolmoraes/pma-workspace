#!/usr/bin/env node
// md2docx: compila uma peça escrita em Markdown (dialeto PMA) para .docx
// usando os helpers do peca-pma-builder. A peça em .md é a fonte da verdade:
// mais barata de escrever/editar/reler por agente do que chamadas p()/pMixed()
// em gerar_*.js, e legível diretamente por humanos e pelos lints.
//
// Uso: node scripts/md2docx.js caminho/da/peca.md [--out caminho/saida.docx] [--skip-lint]
//
// Portões automáticos: antes de compilar, exige o rastro do pipeline
// (2026-09-04 — `pipeline:`, `bundle:` e <PECA>.validacao.md com veredito mais
// novo que a peça; 2026-09-08 — <PECA>.estrutura.md com `aprovada: sim`, salvo
// `estrutura: template`; e
// novo que a peça) e roda lint-remissoes.js, o lint-ia.js do humanizer-forense,
// lint-placeholder.js (peça com [[slot]] ou [VERIFICAR] não compila),
// lint-inicial.js (checklist mecânico do 319 quando `tipo: inicial`) e
// lint-citacoes.js — se algum falhar, NÃO gera o .docx (--skip-lint pula,
// só para emergências). Depois de compilar, valida o timbrado do arquivo
// gerado (validarTimbrado do index.js).
//
// ── Dialeto (ver SKILL.md, seção "Autoria em Markdown") ──────────────────────
// ---                       front-matter YAML-lite: titulo, processo, out,
//                           timbre (`timbre: nao` → peça sem timbrado; lint-docx
//                           e validação de timbrado dispensados, decisão registrada)
// # I. Dos Fatos            → titulo('I.', 'Dos Fatos')
// ## I.1. Cronologia        → subtitulo('I.1.', 'Cronologia')
// > texto da citação        → pQuote (linhas contíguas viram um parágrafo;
// >                            linha ">" vazia separa parágrafos da citação)
// ::center TEXTO            → pCentered (bold, para "AGRAVO EM RECURSO ESPECIAL")
// ::left TEXTO              → parágrafo alinhado à esquerda
// ::right TEXTO             → parágrafo alinhado à direita
// ::br [spaceAfter]         → quebra() (linha em branco vertical)
// ::pagebreak               → pageBreak()
// ::endereco ... ::         → endereco([linhas]) (negrito, à esquerda)
// ::assinatura ... ::       → assinatura(); linhas "NOME | OAB",
//                             linha opcional "local: Palmas — TO, data."
// **negrito** e *itálico*   → runs inline (pMixed)
// linha inteira em **...**  → parágrafo bold (não usar como rótulo meta-textual — ver SKILL.md)
// Parágrafo comum: linhas contíguas são unidas com espaço; linha em branco separa.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const PMA = require(path.join(__dirname, '..'));
const {
  p, pMixed, pQuote, pCentered, titulo, subtitulo,
  endereco, quebra, pageBreak, assinatura, buildDoc, validarTimbrado, validarConteudo, docx,
} = PMA;
const { AlignmentType } = docx;

// ── Rastro do pipeline (2026-09-04): a peça só compila com o ciclo gravado ──
//
// O `pipeline:` era aviso; virou portão. E o veredito do legal-consistency-
// validator, que ficava só na conversa, agora precisa existir em disco:
// <PECA>.validacao.md ao lado da peça, com `veredito:` no frontmatter, mais
// novo que o .md (peça editada depois do veredito = veredito velho) e diferente
// de REPROVADO. `bundle:` declara o acervo que sustenta a peça (ou `nenhum`).
// --skip-lint pula tudo isto (é da titular, não do agente — hook bloqueia).
function exigirRastro(mdPath, meta) {
  const problemas = [];
  const mtime = (p) => {
    try {
      return fs.statSync(p).mtimeMs;
    } catch {
      return null;
    }
  };
  const frontmatter = (texto) => {
    const m = {};
    const ls = String(texto || '').split(/\r?\n/);
    if ((ls[0] || '').trim() !== '---') return m;
    for (let i = 1; i < ls.length; i++) {
      if (ls[i].trim() === '---') break;
      const k = ls[i].match(/^(\w+)\s*:\s*(.*)$/);
      if (k) m[k[1]] = k[2].trim();
    }
    return m;
  };

  if (!meta.pipeline) {
    problemas.push(
      'frontmatter sem `pipeline:` — declare `pipeline: legal-orchestrator` depois de cumprir o ciclo ' +
        '(legal-writer → tipografia-pma → legal-consistency-validator → humanizer-forense).',
    );
  }
  if (!meta.bundle) {
    problemas.push('frontmatter sem `bundle:` — `bundle: direito/<tema>` do acervo, ou `bundle: nenhum`.');
  }

  const val = mdPath.replace(/\.md$/i, '.validacao.md');
  const nomeVal = path.basename(val);
  const tVal = mtime(val);
  if (tVal === null) {
    problemas.push(`sem ${nomeVal} — rode o legal-consistency-validator sobre a peça; ele grava o veredito ao lado dela.`);
  } else {
    const tMd = mtime(mdPath);
    if (tMd !== null && tVal < tMd - 1000) {
      problemas.push(`${nomeVal} é anterior à última edição da peça — a peça mudou depois do veredito; revalide.`);
    }
    let texto = '';
    try {
      texto = fs.readFileSync(val, 'utf8');
    } catch {
      /* tratado abaixo como sem veredito */
    }
    const v = String(frontmatter(texto).veredito || '').trim().toUpperCase();
    if (!v) problemas.push(`${nomeVal} sem \`veredito:\` no frontmatter (APROVADO | APROVADO COM RESSALVAS | REPROVADO).`);
    else if (/REPROVADO/.test(v)) problemas.push(`veredito REPROVADO em ${nomeVal} — corrija as fraquezas CRÍTICO/ALTO e revalide.`);
  }

  // Estrutura aprovada (Estágio 0.5, portão desde 2026-09-08): a arquitetura da peça
  // é decidida e aprovada pela titular ANTES da prosa, em <PECA>.estrutura.md com
  // `aprovada: sim`. Peça gerada de template (inicial-rescisao-lote, golpe) declara
  // `estrutura: template` no frontmatter: o playbook dispensa o portão humano nela.
  if (!/^template$/i.test(String(meta.estrutura || '').trim())) {
    const est = mdPath.replace(/\.md$/i, '.estrutura.md');
    const nomeEst = path.basename(est);
    if (mtime(est) === null) {
      problemas.push(`sem ${nomeEst} — Estágio 0.5: grave a estrutura da peça ao lado dela e obtenha \`aprovada: sim\` da titular antes da prosa (peça de template declara \`estrutura: template\`).`);
    } else {
      let te = '';
      try { te = fs.readFileSync(est, 'utf8'); } catch { /* tratado como não aprovada */ }
      const ap = String(frontmatter(te).aprovada || '').trim();
      if (!/^(sim|s|yes|true)$/i.test(ap)) problemas.push(`${nomeEst} sem \`aprovada: sim\` (está: "${ap || 'ausente'}") — a titular aprova a arquitetura antes da prosa.`);
    }
  }

  if (!problemas.length) {
    console.log('md2docx: rastro OK (pipeline, bundle, estrutura aprovada, veredito do validator)');
    return;
  }
  console.error('\nmd2docx: RASTRO DO PIPELINE INCOMPLETO — .docx não gerado.');
  for (const p of problemas) console.error(`  ✘ ${p}`);
  console.error('\nO ciclo é: legal-orchestrator (Estágio 0 → 0.5 com estrutura aprovada → 1–6) → veredito gravado → pipeline: declarado → md2docx.\n');
  process.exit(1);
}

// ── Portão de lints (roda antes de compilar; falha = não gera .docx) ────────
//
// Duas naturezas de portão (PRD F2.2):
//   BLOQUEIO  (exit 1) — remissões quebradas, cacoetes de IA, citação divergente ou
//                        precedente de tribunal superior ausente do acervo.
//   APROVAÇÃO (exit 3) — citação a página `status: em_teste`. Não é erro: é decisão
//                        da titular. Some declarando `cita_em_teste: sim` no
//                        frontmatter da peça, para que fique REGISTRADA no documento.
function rodarLints(mdPath) {
  const lints = [
    { nome: 'lint-remissoes', script: path.join(__dirname, 'lint-remissoes.js') },
    { nome: 'lint-ia', script: path.join(__dirname, '..', '..', 'humanizer-forense', 'scripts', 'lint-ia.js') },
    { nome: 'lint-placeholder', script: path.join(__dirname, 'lint-placeholder.js') },
    { nome: 'lint-injecao', script: path.join(__dirname, 'lint-injecao.js') },
    { nome: 'lint-inicial', script: path.join(__dirname, 'lint-inicial.js') },
    { nome: 'lint-citacoes', script: path.join(__dirname, 'lint-citacoes.js') },
  ];
  for (const l of lints) {
    if (!fs.existsSync(l.script)) {
      console.warn(`md2docx: AVISO — ${l.nome} não encontrado em ${l.script}; portão pulado.`);
      continue;
    }
    const r = spawnSync(process.execPath, [l.script, mdPath], { encoding: 'utf8' });
    if (r.status === 3) {
      console.error(`\nmd2docx: ${l.nome} exige APROVAÇÃO — .docx não gerado.\n`);
      console.error(r.stdout || '');
      console.error(
        'Isto não é um erro de redação: a peça cita fundamento ainda NÃO conferido contra\n' +
          'fonte oficial. Ou se confere a fonte e se promove a página a `status: vigente`,\n' +
          'ou se assume a citação declarando no frontmatter da peça:  cita_em_teste: sim\n',
      );
      process.exit(3);
    }
    if (r.status !== 0) {
      console.error(`\nmd2docx: ${l.nome} FALHOU — .docx não gerado. Corrija e recompile (ou use --skip-lint em emergência).\n`);
      console.error(r.stdout || '');
      console.error(r.stderr || '');
      process.exit(1);
    }
  }
  console.log('md2docx: lints OK (remissões + anti-IA + placeholder + injeção + inicial + citações)');
}

// ── Inline: **bold**, *italic*, ***bold+italic*** → runs de pMixed ───────────
function parseInline(text) {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((seg) => {
    if (/^\*\*\*[^*]+\*\*\*$/.test(seg)) return { text: seg.slice(3, -3), bold: true, italics: true };
    if (/^\*\*[^*]+\*\*$/.test(seg)) return { text: seg.slice(2, -2), bold: true };
    if (/^\*[^*]+\*$/.test(seg)) return { text: seg.slice(1, -1), italics: true };
    return { text: seg };
  });
}

function paragrafo(text, opts = {}) {
  const runs = parseInline(text);
  if (runs.length === 1 && !runs[0].bold && !runs[0].italics) return p(runs[0].text, opts);
  return pMixed(runs, opts);
}

// ── Front-matter YAML-lite (chave: valor, sem aninhamento) ───────────────────
function parseFrontMatter(lines) {
  const meta = {};
  let end = 0;
  if (lines[0] !== '---') return { meta, body: lines };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i + 1; break; }
    const m = lines[i].match(/^(\w+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body: lines.slice(end) };
}

// ── Compilador de blocos ─────────────────────────────────────────────────────
function compile(body) {
  const out = [];
  let i = 0;
  const flushPara = (buf) => { if (buf.length) out.push(paragrafo(buf.join(' '))); };

  let buf = [];
  while (i < body.length) {
    const line = body[i];
    const trimmed = line.trim();

    if (trimmed === '') { flushPara(buf); buf = []; i++; continue; }

    // Diretivas ::
    if (trimmed.startsWith('::')) {
      flushPara(buf); buf = [];
      const [, cmd, resto = ''] = trimmed.match(/^::(\S+)\s*(.*)$/) || [];
      if (cmd === 'br') { out.push(quebra(resto ? Number(resto) : undefined)); i++; continue; }
      if (cmd === 'pagebreak') { out.push(pageBreak()); i++; continue; }
      if (cmd === 'center') { out.push(pCentered(resto.replace(/\*\*/g, ''))); i++; continue; }
      if (cmd === 'left' || cmd === 'right') {
        const align = cmd === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT;
        out.push(paragrafo(resto, { alignment: align })); i++; continue;
      }
      if (cmd === 'endereco') {
        const linhas = [];
        i++;
        while (i < body.length && body[i].trim() !== '::') { if (body[i].trim()) linhas.push(body[i].trim()); i++; }
        i++; // consome o "::" de fechamento
        out.push(...endereco(linhas)); continue;
      }
      if (cmd === 'assinatura') {
        const adv = []; let localData;
        i++;
        while (i < body.length && body[i].trim() !== '::') {
          const l = body[i].trim(); i++;
          if (!l) continue;
          const loc = l.match(/^local\s*:\s*(.*)$/i);
          if (loc) { localData = loc[1]; continue; }
          const [nome, oab] = l.split('|').map((s) => s.trim());
          adv.push({ nome, oab: oab || '' });
        }
        i++; // consome o "::" de fechamento
        out.push(...assinatura(adv, localData ? { localData } : {})); continue;
      }
      throw new Error(`md2docx: diretiva desconhecida "::${cmd}" (linha ${i + 1})`);
    }

    // Títulos
    const h2 = trimmed.match(/^##\s+(\S+)\s+(.*)$/);
    const h1 = !h2 && trimmed.match(/^#\s+(\S+)\s+(.*)$/);
    if (h2) { flushPara(buf); buf = []; out.push(subtitulo(h2[1], h2[2])); i++; continue; }
    if (h1) { flushPara(buf); buf = []; out.push(titulo(h1[1], h1[2])); i++; continue; }

    // Citação em bloco
    if (trimmed.startsWith('>')) {
      flushPara(buf); buf = [];
      const qParas = []; let qBuf = [];
      while (i < body.length && body[i].trim().startsWith('>')) {
        const q = body[i].trim().replace(/^>\s?/, '');
        if (q === '') { if (qBuf.length) { qParas.push(qBuf.join(' ')); qBuf = []; } }
        else qBuf.push(q);
        i++;
      }
      if (qBuf.length) qParas.push(qBuf.join(' '));
      qParas.forEach((q) => out.push(pQuote(q.replace(/\*\*/g, ''))));
      continue;
    }

    buf.push(trimmed);
    i++;
  }
  flushPara(buf);
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mdPath = args.find((a) => !a.startsWith('--'));
  if (!mdPath) { console.error('Uso: node md2docx.js <peca.md> [--out saida.docx]'); process.exit(2); }

  const src = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontMatter(src.split('\n'));

  if (!args.includes('--skip-lint')) {
    exigirRastro(mdPath, meta);
    rodarLints(mdPath);
  } else console.warn('md2docx: AVISO — rastro e lints pulados por --skip-lint.');

  const outFlag = args.indexOf('--out');

  const outPath = outFlag >= 0
    ? args[outFlag + 1]
    : path.resolve(path.dirname(mdPath), meta.out || path.basename(mdPath).replace(/\.md$/i, '.docx'));

  // `timbre: nao` no frontmatter → peça sem cabeçalho/rodapé institucionais
  // (decisão da titular, registrada no documento — mesmo espírito do cita_em_teste).
  const semTimbre = /^(n[aã]o|no|off|sem)$/i.test((meta.timbre || '').trim());

  const conteudo = compile(body);
  const saved = await buildDoc({
    titulo: meta.titulo || path.basename(mdPath, '.md'),
    processo: meta.processo || '',
    conteudo,
    outPath,
    semTimbre,
  });
  console.log(`md2docx: ${conteudo.length} parágrafos → ${saved}`);
  if (semTimbre) {
    console.log('md2docx: timbre removido por decisão declarada no frontmatter (timbre: nao) — lint-docx e validação de timbrado não se aplicam a esta peça.');
  }

  // Validação do ARTEFATO (PRD/lint-docx): confere fonte, margem, entrelinha,
  // cabeçalho, rodapé e banner no .docx pronto, contra perfil/marca.json.
  // Não substitui os lints de entrada — cobre o que eles não veem, que é o que
  // efetivamente sai para o juízo.
  const lintDocx = path.join(__dirname, '..', '..', '..', 'scripts', 'lint-docx.js');
  if (!semTimbre && fs.existsSync(lintDocx)) {
    const r = spawnSync(process.execPath, [lintDocx, saved], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error('\nmd2docx: o .docx GERADO está fora do padrão visual PMA:\n');
      console.error(r.stdout || r.stderr || '');
      process.exitCode = 1;
    } else if ((r.stdout || '').includes('AVISO')) {
      console.warn((r.stdout || '').split('\n').filter((l) => /AVISO|^\s{8}/.test(l)).join('\n'));
    }
  }

  // O texto de entrada chegou ao arquivo gravado? Âncoras = primeiro e último
  // parágrafo do corpo. Pega build truncado e .docx defasado, que o
  // validarTimbrado não vê porque só olha o invólucro.
  const textos = [];
  let emBloco = false;
  for (const l of body) {
    const t = l.trim();
    if (/^::(endereco|assinatura)\b/.test(t)) { emBloco = true; continue; }
    if (emBloco) { if (t === '::') emBloco = false; continue; }
    if (!t || /^(::|>|#)/.test(t)) continue;
    textos.push(t.replace(/\*\*|\*/g, '').trim());
  }
  const ancoras = [textos[0], textos[textos.length - 1]].filter(Boolean);
  const c = await validarConteudo(saved, ancoras);
  if (c.aviso) console.warn(`md2docx: AVISO — ${c.aviso}`);
  else if (!c.ok) {
    console.error('md2docx: o .docx gravado NÃO contém todo o texto da fonte:');
    for (const f of c.faltando) console.error(`  ✘ ausente: "${String(f).slice(0, 80)}…"`);
    console.error('  Regerar; se persistir, conferir se outro processo está com o arquivo aberto.');
    process.exit(1);
  }

  if (!semTimbre) {
    const v = await validarTimbrado(saved);
    if (v.aviso) console.warn(`md2docx: AVISO — ${v.aviso}`);
    else if (!v.ok) {
      console.error('md2docx: TIMBRADO INVÁLIDO no .docx gerado:');
      for (const prob of v.problemas) console.error(`  ✘ ${prob}`);
      process.exit(1);
    } else console.log('md2docx: timbrado validado (cabeçalho, rodapé, distâncias).');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

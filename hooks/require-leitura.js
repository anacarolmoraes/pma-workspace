#!/usr/bin/env node
// require-leitura — hook PreToolUse (Write|Edit): antes de gravar peça, ter lido
// as definições canônicas, o perfil de quem assina (AGENTS.md §3) e o bundle
// da matéria no acervo.
//
// É o "antes de editar X, leia Y" clássico: valor da causa, gratuidade,
// assinatura e endereçamento saem errados quando o agente redige de memória;
// tese e precedente saem inventados quando o acervo não foi aberto. A
// conferência é determinística: procura no transcript da sessão um Read (ou
// cat/Get-Content/ler-pdfmd) de perfil/definicoes.md, de perfil/usuario.md e de
// algum arquivo dentro do bundle que a peça declara em `bundle:`.
//
// `bundle: direito/<tema>` é relativo à raiz do acervo (perfil/ambiente.json →
// bundles). `bundle: nenhum` registra, no próprio documento, que a peça não tem
// matéria de acervo (manifestação puramente processual) — mesmo espírito do
// `cita_em_teste: sim`. Sem o campo, bloqueia.
//
// Só dispara para arquivo .md dentro de clientes/ cujo frontmatter é de peça
// (pipeline:, tipo:, ou titulo: + processo:). Protocolo: exit 2 = bloqueia.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

const fs = require('fs');
const path = require('path');
const { RAIZ, norm, lerStdin, parseEntrada, usosDeFerramenta, foiLido, foiLidoDentro, lerFrontmatter, ehPeca } =
  require('./lib/transcript');

const OBRIGATORIOS = [
  { sufixo: 'perfil/definicoes.md', motivo: 'valor da causa, gratuidade, assinatura, prazos, custas' },
  { sufixo: 'perfil/usuario.md', motivo: 'quem assina, em que comarca' },
];

// Raiz do acervo. PMA_BUNDLES existe para os testes; fora deles, é o ambiente.json.
function raizAcervo() {
  if (process.env.PMA_BUNDLES) return process.env.PMA_BUNDLES;
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'perfil', 'ambiente.json'), 'utf8')).bundles || null;
  } catch {
    return null;
  }
}

// Retorna a razão do bloqueio, ou null se o bundle está declarado e foi lido.
function faltaBundle(meta, usos) {
  const decl = String(meta.bundle || '').trim();
  if (!decl) {
    return (
      'a peça não declara `bundle:` no frontmatter — `bundle: direito/<tema>` do acervo ' +
      '(escolha em <bundles>/index.md), ou `bundle: nenhum` se a peça não tem matéria de acervo'
    );
  }
  if (/^(nenhum|nenhuma|none|n[aã]o)$/i.test(decl)) return null;
  const acervo = raizAcervo();
  if (!acervo) return null; // instalação sem ambiente.json: não há como conferir (fail-open, como o resto)
  const raiz = path.resolve(acervo);
  const dir = path.resolve(raiz, decl);
  if (!norm(dir).toLowerCase().startsWith(norm(raiz).toLowerCase())) {
    return `\`bundle: ${decl}\` sai da raiz do acervo (${norm(raiz)})`;
  }
  if (!fs.existsSync(dir)) return `\`bundle: ${decl}\` não existe em ${norm(raiz)} — confira o nome em <bundles>/index.md`;
  if (!foiLidoDentro(usos, dir)) {
    return (
      `\`bundle: ${decl}\` está declarado, mas nenhum arquivo de ${norm(dir)} foi lido nesta sessão ` +
      '(index.md, jurisprudencia/, teses/, heuristicas/, casos_decididos/)'
    );
  }
  return null;
}

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada) process.exit(0);
  if (!/^(Write|Edit)$/.test(String(entrada.tool_name || ''))) process.exit(0);
  const input = entrada.tool_input || {};
  const alvo = input.file_path;
  if (!alvo || !/\.md$/i.test(alvo) || !/(^|\/)clientes\//i.test(norm(alvo))) process.exit(0);

  let texto = typeof input.content === 'string' ? input.content : null;
  if (texto === null) {
    try {
      texto = fs.readFileSync(alvo, 'utf8');
    } catch {
      process.exit(0);
    }
  }
  const meta = lerFrontmatter(texto);
  if (!ehPeca(meta)) process.exit(0);

  const usos = entrada.transcript_path ? usosDeFerramenta(entrada.transcript_path) : [];
  const faltam = OBRIGATORIOS.filter((o) => {
    const existe = fs.existsSync(path.join(RAIZ, ...o.sufixo.split('/')));
    return existe && !foiLido(usos, o.sufixo);
  });
  const bundle = faltaBundle(meta, usos);
  if (!faltam.length && !bundle) process.exit(0);

  const linhas = faltam.map((o) => `  - ${o.sufixo}  (${o.motivo})`);
  if (bundle) linhas.push(`  - acervo: ${bundle}`);
  process.stderr.write(
    `BLOQUEADO por require-leitura: \`${path.basename(alvo)}\` é peça e falta, nesta sessão:\n` +
      linhas.join('\n') +
      '\n\nLeia o que falta (Read) e grave de novo. Protocolo do AGENTS.md §3: definições → usuário → ' +
      'bundle da matéria (<bundles>/index.md → jurisprudencia/, teses/, heuristicas/, casos_decididos/) → ' +
      'direito/pecas/<tipo>/ → documentos do caso.\n',
  );
  process.exit(2);
}

lerStdin(main);

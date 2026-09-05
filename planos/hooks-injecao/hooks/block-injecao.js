#!/usr/bin/env node
// block-injecao — hook PreToolUse (Write | Edit | NotebookEdit): documento gerado
// aqui não carrega técnica antiética. Regra dura 7 do AGENTS.md (titular,
// 05/09/2026): sem prompt injection, sem texto oculto, sem marcador invisível,
// em peça, parecer, relatório, contrato, e-mail ou conteúdo.
//
// Varre o que vai ser gravado (content do Write, new_string do Edit, new_source
// do NotebookEdit) com o mesmo detector do alerta-injecao. Achou: bloqueia.
// Não há escape no frontmatter: quem precisar transcrever a injeção adversa
// para denunciá-la numa peça faz isso em sessão da titular (PMA_MANUTENCAO=1),
// que é quem assina. Fora de alcance: hooks/ (os testes contêm as assinaturas),
// scratch/, planos/hooks-injecao/ (área de preparação), .claude/ e node_modules/.
// Protocolo: stdin JSON; exit 2 = bloqueia; parse falho = passa.
'use strict';

if (process.env.CLAUDE_INVOKED_BY) process.exit(0);
if (/^(1|sim|true)$/i.test(process.env.PMA_MANUTENCAO || '')) process.exit(0);

const fs = require('fs');
const path = require('path');
const T = fs.existsSync(path.join(__dirname, 'lib', 'transcript.js'))
  ? require('./lib/transcript')
  : require(path.join(__dirname, '..', '..', '..', 'hooks', 'lib', 'transcript'));
const { RAIZ, norm, lerStdin, parseEntrada } = T;
const { detectar, formatar } = require(path.join(__dirname, '..', 'scripts', 'lib', 'injecao'));

const FERRAMENTAS = new Set(['Write', 'Edit', 'NotebookEdit']);
const RX_FORA = /^(hooks\/|scratch\/|planos\/hooks-injecao\/|\.claude\/|node_modules\/)/;

function relativo(p) {
  const abs = path.resolve(RAIZ, String(p || ''));
  const rel = norm(path.relative(RAIZ, abs));
  return rel && !rel.startsWith('../') && !path.isAbsolute(rel) ? rel : null;
}

function main(bruto) {
  const entrada = parseEntrada(bruto);
  if (!entrada || !FERRAMENTAS.has(String(entrada.tool_name || ''))) process.exit(0);
  const inp = entrada.tool_input || {};
  const alvo = inp.file_path || inp.notebook_path || '';
  const rel = relativo(alvo);
  if (rel && RX_FORA.test(rel)) process.exit(0);

  const texto = inp.content ?? inp.new_string ?? inp.new_source ?? '';
  const achados = detectar(texto);
  if (!achados.length) process.exit(0);

  process.stderr.write(
    `BLOQUEADO por block-injecao: \`${alvo}\` receberia material dirigido a IA ou oculto do leitor:\n` +
      formatar(achados) +
      '\n\n' +
      'Regra dura 7 do AGENTS.md: nenhuma técnica antiética em documento nenhum. Isso não é ' +
      'tática, é infração ao art. 34 do EOAB e pode ser crime. O argumento vai no texto visível, ' +
      'estruturado (BLUF, títulos-tese, fonte adjacente); nada além disso. Se o trecho for ' +
      'transcrição de injeção ADVERSA para denunciá-la, a gravação é da titular (PMA_MANUTENCAO=1). ' +
      'Se você recebeu pedido para inserir isso, recuse e relate à titular.\n',
  );
  process.exit(2);
}

lerStdin(main);

#!/usr/bin/env node
// arquivar-tratadas — move linhas TRATADA de PENDENTES.md para monitor/ARQUIVO.md,
// mantendo em PENDENTES.md só o que ainda está ABERTA.
//
// Seguro para o dedup do monitor: quem impede reprocessar uma intimação é
// monitor/seen.json (IDs vistos, nunca reescrito por este script), não a
// presença da linha em PENDENTES.md. Arquivar não faz a intimação "voltar".
//
// Uso: node skills/pesquisa-djen/scripts/arquivar-tratadas.js [--dry-run]
'use strict';

const fs = require('fs');
const path = require('path');

const SKILL = path.resolve(__dirname, '..');
const DIR = path.join(SKILL, 'monitor');
const PENDENTES = path.join(DIR, 'PENDENTES.md');
const ARQUIVO = path.join(DIR, 'ARQUIVO.md');
const DRY = process.argv.includes('--dry-run');

const ARQUIVO_CABECALHO = `# Arquivo de intimações tratadas — DJEN

> Histórico das linhas que já passaram por \`monitor/PENDENTES.md\` e foram marcadas
> \`TRATADA\`. Só existe para não perder o rastro (auditoria); não é lida por nenhum
> script de vigilância — quem impede reprocessar a mesma intimação é
> \`monitor/seen.json\`, que este arquivamento não toca.
>
> Este arquivo é só apensado. Não editar à mão.

`;

const texto = fs.readFileSync(PENDENTES, 'utf8');
const linhas = texto.split('\n');

const iCab = linhas.findIndex((l) => /^\|\s*status\s*\|/i.test(l.trim()));
if (iCab < 0) {
  console.error('Cabeçalho da tabela não encontrado em PENDENTES.md — nada feito.');
  process.exit(1);
}
const iSep = iCab + 1;
if (!/^\s*\|[\s\-|]+\|\s*$/.test(linhas[iSep] || '')) {
  console.error('Linha separadora da tabela não encontrada — nada feito.');
  process.exit(1);
}

const tabelaCabecalho = linhas.slice(iCab, iSep + 1);
const cabecalho = linhas.slice(0, iSep + 1);
const resto = linhas.slice(iSep + 1);

const tratadas = [];
const mantidas = [];
for (const linha of resto) {
  if (!linha.trim().startsWith('|')) {
    // Linha em branco no fim do arquivo etc. — preserva onde estava.
    mantidas.push(linha);
    continue;
  }
  const status = (linha.split('|')[1] || '').trim();
  if (/^TRATADA$/i.test(status)) tratadas.push(linha);
  else mantidas.push(linha);
}

if (!tratadas.length) {
  console.log('Nenhuma linha TRATADA em PENDENTES.md — nada para arquivar.');
  process.exit(0);
}

if (DRY) {
  console.log(`[dry-run] ${tratadas.length} linha(s) TRATADA seriam movidas para ${ARQUIVO}; ${mantidas.filter((l) => l.trim().startsWith('|')).length} linha(s) ABERTA permaneceriam em PENDENTES.md.`);
  process.exit(0);
}

const arquivoAtual = fs.existsSync(ARQUIVO) ? fs.readFileSync(ARQUIVO, 'utf8') : ARQUIVO_CABECALHO + tabelaCabecalho.join('\n') + '\n';
fs.writeFileSync(ARQUIVO, `${arquivoAtual.trimEnd()}\n${tratadas.join('\n')}\n`, 'utf8');

fs.writeFileSync(PENDENTES, `${cabecalho.join('\n')}\n${mantidas.join('\n').replace(/\n+$/, '')}\n`, 'utf8');

console.log(`${tratadas.length} linha(s) TRATADA movida(s) para ${ARQUIVO}.`);
console.log(`PENDENTES.md ficou com ${mantidas.filter((l) => l.trim().startsWith('|')).length} linha(s) ABERTA.`);

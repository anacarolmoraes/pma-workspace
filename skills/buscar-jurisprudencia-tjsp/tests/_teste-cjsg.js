#!/usr/bin/env node
// Testes do buscar-jurisprudencia-tjsp: funções puras do cjsg.js e o parser do cjsg.py sobre
// uma linha de resultado sintética, no layout do CJSG de 18/10/2026 (sem rede, sem dado real).
//   node skills/buscar-jurisprudencia-tjsp/tests/_teste-cjsg.js   (roda no `npm test`)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const cjsg = require(path.join(__dirname, '..', 'scripts', 'cjsg.js'));

let falhas = 0;
const ok = (cond, nome, extra = '') => { console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${cond ? '' : `  ${extra}`}`); if (!cond) falhas++; };

// ── Número CNJ ───────────────────────────────────────────────────────────
ok(cjsg.normalizarCNJ('10641473820258260100') === '1064147-38.2025.8.26.0100', 'CNJ: só dígitos vira canônico');
ok(cjsg.normalizarCNJ(' 1064147-38.2025.8.26.0100 ') === '1064147-38.2025.8.26.0100', 'CNJ: canônico fica');
ok(cjsg.normalizarCNJ('1064147-38.2025.8.26') === null, 'CNJ: incompleto é recusado');

// ── Nome na biblioteca e citação ─────────────────────────────────────────
{
  const doc = { cdacordao: '111', numero: '0000001-00.2026.8.26.0100', classe_assunto: 'Apelação Cível / Prestação de Serviços', tipo: 'A' };
  ok(cjsg.nomeBase(doc) === '111_0000001-00.2026.8.26.0100', 'nomeBase: cdAcordao + número', cjsg.nomeBase(doc));
  ok(cjsg.nomeBase({ ...doc, tipo: 'D' }).endsWith('_mono'), 'nomeBase: monocrática leva sufixo');
  ok(cjsg.citacao(doc) === 'Apelação Cível 0000001-00.2026.8.26.0100', 'citação: classe sem o assunto', cjsg.citacao(doc));
}

// ── Parser (cjsg.py extrair) ─────────────────────────────────────────────
const FIXTURE = `<html><body>
<input id="totalResultadoAba-A" type="hidden" value="42">
<div id="divDadosResultado-A"><table>
<tr class="fundocinza1"><td class="ementaClass"><strong>1 -</strong></td><td>
<table><tr class="ementaClass"><td>
 <a class="esajLinkLogin downloadEmenta" cdacordao="111" cdforo="0"> 0000001-00.2026.8.26.0100 </a>
 <a class="textoSemFormatacao"><div id="dadosSemFormatacao_111" style="display: none;">
  <div id="textAreaDados_111" class="mensagemSemFormatacao">APELAÇÃO. Ementa de teste, com (parênteses) no meio. Recurso provido. <br><br>(TJSP;  Apelação Cível 0000001-00.2026.8.26.0100; Relator (a): Fulano; Órgão Julgador: 1ª Câmara de Direito Privado; Data do Julgamento: 01/02/2026)<br></div></div></a>
</td></tr>
<tr class="ementaClass2"><td><strong>Classe/Assunto:</strong> Apelação Cível / Prestação de Serviços</td></tr>
<tr class="ementaClass2"><td><strong>Relator(a):</strong> Fulano</td></tr>
<tr class="ementaClass2"><td><strong>Órgão julgador:</strong> 1ª Câmara de Direito Privado</td></tr>
<tr class="ementaClass2"><td><strong>Data do julgamento:</strong> 01/02/2026</td></tr>
</table></td></tr>
</table></div></body></html>`;

const amb = path.join(__dirname, '..', '..', '..', 'perfil', 'ambiente.json');
const py = fs.existsSync(amb) ? JSON.parse(fs.readFileSync(amb, 'utf8')).python : null;
if (!py || !fs.existsSync(py)) {
  console.log('pula parser: Python do adv_env ausente (rode node scripts/setup.js)');
} else {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cjsg-')), 'pagina.html');
  fs.writeFileSync(arq, FIXTURE);
  const r = spawnSync(py, [path.join(__dirname, '..', 'scripts', 'cjsg.py'), 'extrair', arq],
    { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
  let res = null;
  try { res = JSON.parse(r.stdout); } catch { /* cai no ok abaixo */ }
  ok(res && res.total === 42 && res.docs.length === 1, 'parser: total da aba e uma linha', r.stderr || r.stdout);
  if (res && res.docs[0]) {
    const d = res.docs[0];
    ok(d.cdacordao === '111' && d.numero === '0000001-00.2026.8.26.0100', 'parser: cdAcordao e número');
    ok(d.orgao === '1ª Câmara de Direito Privado' && d.relator === 'Fulano' && d.julgamento === '01/02/2026', 'parser: rótulos do espelho', JSON.stringify(d));
    ok(d.ementa === 'APELAÇÃO. Ementa de teste, com (parênteses) no meio. Recurso provido.', 'parser: ementa sem a linha de citação', d.ementa);
    ok(d.citacao.startsWith('TJSP; Apelação Cível 0000001-00.2026.8.26.0100;') && d.citacao.endsWith('01/02/2026'), 'parser: citação oficial', d.citacao);
  }
  fs.rmSync(path.dirname(arq), { recursive: true, force: true });
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos ok');
process.exit(falhas ? 1 : 0);

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

  const rodar = (args) => spawnSync(py, [path.join(__dirname, '..', 'scripts', 'cjsg.py'), ...args],
    { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });

  // Aviso de validação do CJSG (layout de 18/10/2026): recusa, não SECA.
  const AVISO = `<html><body><div id="spwTabelaMensagem"><table class="tabelaMensagem"><tbody>
<tr><td class="alert"></td><td class="tituloMensagem"><b>Atenção</b></td></tr>
<tr><td class="alert">&nbsp;</td><td role="alert" id="mensagemRetorno">
<li>A faixa entre data de inicio e data de fim deve ser de no máximo 1 ano.</li></td></tr>
</tbody></table></div></body></html>`;
  const arqAviso = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cjsg-')), 'aviso.html');
  fs.writeFileSync(arqAviso, AVISO);
  let av = null;
  const ra = rodar(['extrair', arqAviso]);
  try { av = JSON.parse(ra.stdout); } catch { /* cai no ok abaixo */ }
  ok(av && av.total === 0 && av.mensagens.length === 1 && av.mensagens[0].startsWith('A faixa entre data'),
    'parser: aviso de validação do CJSG é lido', ra.stderr || ra.stdout);
  ok(res && Array.isArray(res.mensagens) && res.mensagens.length === 0, 'parser: página de resultado sem aviso');
  fs.rmSync(path.dirname(arqAviso), { recursive: true, force: true });

  // Período maior que 1 ano vira janelas de até 1 ano.
  const per = (c) => { const r2 = rodar(['periodos', JSON.stringify(c)]); try { return JSON.parse(r2.stdout); } catch { return r2.stderr || r2.stdout; } };
  const p1 = per({ id: 'A', livre: 'x', dtj1: '01/01/2026', dtj2: '18/10/2026' });
  ok(Array.isArray(p1) && p1.length === 1 && p1[0].id === 'A', 'período: até 1 ano fica inteiro', JSON.stringify(p1));
  const p2 = per({ id: 'A', livre: 'x', dtj1: '01/01/2024', dtj2: '18/10/2026' });
  ok(Array.isArray(p2) && p2.length === 3
    && p2[0].id === 'A@1' && p2[0].dtj1 === '01/01/2024' && p2[0].dtj2 === '31/12/2024'
    && p2[1].dtj1 === '01/01/2025' && p2[1].dtj2 === '31/12/2025'
    && p2[2].dtj1 === '01/01/2026' && p2[2].dtj2 === '18/10/2026', 'período: 2024–2026 vira 3 janelas contíguas', JSON.stringify(p2));
  const p3 = per({ id: 'B', livre: 'x', dtp1: '29/02/2024', dtp2: '01/03/2025' });
  ok(Array.isArray(p3) && p3.length === 2 && p3[0].dtp2 === '27/02/2025' && p3[1].dtp1 === '28/02/2025',
    'período: 29/02 não quebra a janela', JSON.stringify(p3));
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos ok');
process.exit(falhas ? 1 : 0);

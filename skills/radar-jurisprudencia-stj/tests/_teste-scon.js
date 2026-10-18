#!/usr/bin/env node
// Testes das funções puras do radar-jurisprudencia-stj (manutenção de 18/10/2026):
// pseudonimização (regra dura 6), semáforo de alteração posterior, cabeçalho da ementa,
// parser de "--numero", precedentes citados, título da página depositada.
//   node skills/radar-jurisprudencia-stj/tests/_teste-scon.js   (roda no `npm test`)
'use strict';
const path = require('path');

const scon = require(path.join(__dirname, '..', 'scripts', 'scon.js'));
const dep = require(path.join(__dirname, '..', 'scripts', 'depositar.js'));

let falhas = 0;
const ok = (cond, nome, extra = '') => { console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${cond ? '' : `  ${extra}`}`); if (!cond) falhas++; };

// ── Pseudonimização ──────────────────────────────────────────────────────
{
  const proc = { detalhes: [
    { rotulo: 'RECORRENTE', valor: 'JOSE DE SA' },                       // "SA" sem acento não é S.A.
    { rotulo: 'ADVOGADOS', valor: 'MARIA CLAUDIA MISCHIATTI - SP123456 PEDRO ALVES CORREA - MT007890' },
    { rotulo: 'RECORRIDO', valor: 'BANCO EXEMPLO S.A.' },                // pessoa jurídica parte fica
    { rotulo: 'LITISCONSORTE', valor: 'ANA BEATRIZ FERREIRA NUNES' },     // papel fora do mapa fixo
    { rotulo: 'PROCURADOR', valor: 'CARLOS EDUARDO BRITO - RJ000111' },   // advogado público sai
    { rotulo: 'NÚMERO ÚNICO', valor: '1036596-64.2017.8.11.0041' },     // não é pessoa
    { rotulo: 'LOCALIZAÇÃO', valor: 'TRIBUNAL DE JUSTIÇA' },
  ] };
  const achados = dep.nomesDoProcesso(proc);
  const nomes = achados.map((a) => a.nome);
  ok(nomes.includes('JOSE DE SA') && nomes.includes('ANA BEATRIZ FERREIRA NUNES') && nomes.includes('CARLOS EDUARDO BRITO'),
    'Detalhes: parte, litisconsorte e procurador entram no plano', nomes.join(';'));
  ok(!nomes.some((n) => /1036596|TRIBUNAL DE JUSTI/.test(n)), 'Detalhes: número único e localização não são pessoa');
  ok(achados.filter((a) => a.papel === 'ADVOGADO').length === 3, 'advogados divididos pela OAB (2) + procurador', JSON.stringify(achados));

  const plano = dep.planoDeTroca(achados);
  const sa = plano.find((p) => p.nome === 'JOSE DE SA');
  ok(sa && !sa.manter, 'JOSE DE SA é pessoa física (não cai como S.A.)');
  ok(plano.find((p) => p.nome.startsWith('BANCO EXEMPLO'))?.manter === true, 'BANCO EXEMPLO S.A. é mantido', JSON.stringify(plano));

  const texto = 'Recurso de José de Sá contra Banco Exemplo S.A. Advogada Maria Cláudia\nMischiatti e o Dr. Pedro Correa. '
    + 'Ana Beatriz Ferreira Nunes, litisconsorte. CPF 123.456.789-01, e-mail x@y.com, tel (65) 99999-1234. Carlos Brito atuou.';
  const { texto: out, trocas } = dep.pseudonimizar(texto, plano);
  ok(!/Sá|Mischiatti|Pedro Correa|Ferreira Nunes/.test(out), 'nomes trocados, inclusive acento e quebra de linha', out);
  ok(/Banco Exemplo S\.A\./.test(out), 'pessoa jurídica parte permanece no texto');
  ok(/\[CPF\]/.test(out) && /\[E-MAIL\]/.test(out) && /\[TELEFONE\]/.test(out), 'CPF, e-mail e telefone saem');
  ok(trocas.find((t) => t.nome === 'JOSE DE SA')?.ocorrencias === 1, 'contagem de ocorrências');
  ok(/\[ADVOGADO \d\]/.test(out) && !/Carlos Brito/.test(out), 'Primeiro Último de nome com 3+ partes também sai');
  const sobra = dep.residuos(out, trocas);
  ok(sobra.length === 0, 'sem resíduo quando tudo foi trocado', sobra.join(' / '));
  const sobra2 = dep.residuos(`${out} Dr. Mischiatti falou.`, trocas);
  ok(sobra2.some((s) => /MISCHIATTI/.test(s)), 'resíduo de sobrenome raro é acusado');
}

// ── Semáforo ─────────────────────────────────────────────────────────────
{
  const pub = '19/03/2026';
  const f = (data, texto) => ({ data, texto });
  let s = scon.semaforo({ fases: [f('15/04/2026', 'Baixa Definitiva para TJMT'), f('14/04/2026', 'Transitado em Julgado em 10/04/2026'), f('19/03/2026', 'Publicado EMENTA / ACORDÃO')] }, pub);
  ok(s.cor === 'VERDE', 'trânsito sem recurso posterior = VERDE', s.motivo);

  s = scon.semaforo({ fases: [f('10/06/2026', 'Transitado em Julgado em 08/06/2026'), f('20/05/2026', 'Julgado: Embargos de Declaração rejeitados'), f('02/04/2026', 'Juntada de petição de EMBARGOS DE DECLARAÇÃO'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'VERDE' && /não alterou/.test(s.motivo), 'EDcl rejeitados + trânsito depois = VERDE com nota', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('02/04/2026', 'Juntada de petição de EMBARGOS DE DECLARAÇÃO'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'AMARELO' && /sem trânsito/.test(s.motivo), 'EDcl pendentes = AMARELO', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('10/06/2026', 'Transitado em Julgado'), f('20/05/2026', 'Embargos de Declaração acolhidos com efeitos infringentes'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'AMARELO' && /alteração/.test(s.motivo), 'EDcl acolhidos = AMARELO mesmo com trânsito', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('10/06/2026', 'Transitado em Julgado'), f('20/05/2026', 'Agravo interno desprovido'), f('02/04/2026', 'Juntada de AGRAVO INTERNO'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'VERDE', '"desprovido" não é alteração', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('20/05/2026', 'Agravo interno provido'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'AMARELO' && /alteração/.test(s.motivo), '"provido" é alteração', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('28/05/2026', 'Juntada de Petição de EMBARGOS DE DIVERGÊNCIA'), f('04/05/2026', 'Embargos de Declaração de FULANO Não-acolhidos , por unanimidade'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'AMARELO' && /sem trânsito/.test(s.motivo), '"Não-acolhidos" não é alteração; EDv pendentes = AMARELO pendente', `${s.cor} ${s.motivo}`);

  s = scon.semaforo({ fases: [f('25/03/2026', 'Conclusos ao Relator'), f('19/03/2026', 'Publicado')] }, pub);
  ok(s.cor === 'CINZA', 'sem trânsito nem recurso = CINZA');

  s = scon.semaforo({ fases: [f('19/03/2026', 'Publicado'), f('10/01/2026', 'Embargos de Declaração acolhidos')] }, pub);
  ok(s.cor === 'CINZA', 'fase anterior à publicação não conta');
}

// ── Cabeçalho, número, citados, título ───────────────────────────────────
{
  const e = 'DIREITO PROCESSUAL CIVIL. RECURSO ESPECIAL. ARBITRAMENTO. RECURSO PROVIDO. I. CASO EM EXAME 1. Recurso especial...';
  ok(scon.cabecalho(e) === 'DIREITO PROCESSUAL CIVIL. RECURSO ESPECIAL. ARBITRAMENTO. RECURSO PROVIDO.', 'cabeçalho para antes de "I. CASO EM EXAME"', scon.cabecalho(e));
  ok(scon.cabecalho('AGRAVO. HONORÁRIOS. 1. A jurisprudência...') === 'AGRAVO. HONORÁRIOS.', 'cabeçalho para antes de "1."');

  ok(JSON.stringify(scon.parseNumero('REsp 805.919/MG')) === JSON.stringify({ classe: 'REsp', numero: '805919', uf: 'MG' }), 'parse REsp 805.919/MG');
  ok(JSON.stringify(scon.parseNumero('AgInt no AREsp n. 1.907.838/SP')) === JSON.stringify({ classe: 'AgInt no AREsp', numero: '1907838', uf: 'SP' }), 'parse AgInt no AREsp n. 1.907.838/SP');
  ok(scon.parseNumero('REsp 805919').uf === '' && scon.parseNumero('805919') === null, 'parse sem UF e sem classe');

  const cit = scon.extrairCitados('Jurisprudência relevante citada: STJ, AREsp n. 3.025.531/MS, Terceira Turma; STJ, AREsp n. 2.735.355/MT; AgInt no AREsp 1.907.838/SP; REsp 805919/MG; AREsp 3.025.531/MS de novo.');
  ok(cit.length === 4 && cit[0].numero === '3025531' && cit[0].vezes === 2, 'citados: dedupe, contagem e ordem', JSON.stringify(cit));
  ok(cit.some((c) => c.classe === 'AgInt no AREsp' && c.numero === '1907838'), 'citados: recurso interno com classe inteira');

  const t = dep.tituloDaEmenta('... IV. DISPOSITIVO E TESE 7. Recurso especial conhecido e provido. Tese de julgamento: "1. Aplica-se o art. 22, § 2º, da Lei n. 8.906/1994 para reconhecer o arbitramento proporcional. 2. Invertem-se os honorários". Dispositivos relevantes citados: ...');
  ok(/^Aplica-se o art\. 22/.test(t) && !/Invertem/.test(t), 'título sai da tese de julgamento, só o item 1', t);
  ok(/^[A-Z][a-z]/.test(dep.tituloDaEmenta('RECURSO ESPECIAL. HONORÁRIOS. REVOGAÇÃO IMOTIVADA. PROVIMENTO.')), 'sem tese: frase em caixa normal');
}

// ── raw: relativo ao bundle mais externo (sub-bundle de pecas) ───────────
{
  const fs = require('fs');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pma-bundles-'));
  for (const d of ['direito/pecas/raw', 'direito/pecas/sucumbencia/raw', 'direito/cobranca-honorarios/raw']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
  for (const d of ['direito/pecas', 'direito/pecas/sucumbencia', 'direito/cobranca-honorarios']) fs.writeFileSync(path.join(tmp, d, 'index.md'), '# i\n');
  ok(dep.prefixoNoBundle(tmp, path.join(tmp, 'direito', 'cobranca-honorarios')) === '', 'bundle de topo: raw em /raw/');
  ok(dep.prefixoNoBundle(tmp, path.join(tmp, 'direito', 'pecas', 'sucumbencia')) === '/sucumbencia', 'sub-bundle de pecas: raw em /sucumbencia/raw/');
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo ok');
process.exit(falhas ? 1 : 0);

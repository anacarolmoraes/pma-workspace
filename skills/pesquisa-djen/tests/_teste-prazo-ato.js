#!/usr/bin/env node
// Teste de lib/prazo-ato.js e dos feriados nacionais de 2027 em prazo-core.
//   node skills/pesquisa-djen/tests/_teste-prazo-ato.js
'use strict';
const { prazoRecurso } = require('../lib/prazo-ato.js');
const { calcularPrazo, FERIADOS_NACIONAIS } = require('../lib/prazo-core.js');

let falhas = 0;
const t = (nome, got, esperado) => {
  const ok = JSON.stringify(got) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok ? '' : ` → ${JSON.stringify(got)} (esperado ${JSON.stringify(esperado)})`}`);
};

t('Juizado (TJTO "Apoio ao Sistema dos Juizados Especiais") → 10 d.ú.', prazoRecurso({ orgao: '5º Núcleo de Justiça 4.0, Apoio ao Sistema dos Juizados Especiais' }).dias, 10);
t('JEC rótulo', prazoRecurso({ orgao: '1º Juizado Especial Cível de Palmas' }).rotulo, '10 d.ú. JEC');
t('Vara Cível → 15 d.ú.', prazoRecurso({ orgao: '1ª Vara Cível de Palmas' }).dias, 15);
t('Câmara Cível → 15 d.ú.', prazoRecurso({ orgao: 'SEC. DA 2ª CÂMARA CÍVEL' }).rito, 'comum');
t('Turma Recursal → 15 d.ú., rito turma-recursal', prazoRecurso({ orgao: '1ª Turma Recursal dos Juizados Especiais' }).rito, 'turma-recursal');
t('padrão configurável', prazoRecurso({ orgao: 'Vara Única' }, 30).dias, 30);
t('órgão vazio → comum', prazoRecurso({}).rito, 'comum');

// 2027: carnaval 08-09/02, Sexta Santa 26/03, Corpus Christi 27/05 (Páscoa 28/03/2027).
for (const d of ['2027-02-08', '2027-02-09', '2027-03-26', '2027-05-27', '2027-04-21', '2027-11-20', '2027-12-25']) {
  t(`feriado nacional 2027 ${d} embutido`, FERIADOS_NACIONAIS.includes(d), true);
}
// Contagem atravessando o carnaval de 2027: disp. sexta 05/02 → publ. seg 08? Não: 08 e 09 são
// feriado → publicação qua 10/02, termo qui 11/02, 5 d.ú. = 11,12,15,16,17 → 17/02.
t('5 d.ú. atravessando o carnaval de 2027', calcularPrazo({ disponibilizacao: '2027-02-05', dias: 5, tribunal: 'XX' }).data_fatal, '2027-02-17');

console.log(falhas ? `\n${falhas} falha(s).` : '\ntodos os casos corretos.');
process.exit(falhas ? 1 : 0);

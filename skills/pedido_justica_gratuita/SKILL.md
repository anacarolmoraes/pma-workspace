---
name: pedido_justica_gratuita
description: Analisa, avalia e elabora pedidos de gratuidade da justiça (CPC, arts. 98 a 102) e a resposta à impugnação. Usar sempre que for preciso decidir a forma do pedido pela faixa de salário fixada na ADC 80/STF (R$ 5.000,00, para ações ajuizadas após 09/2026), conferir se um pedido está sólido, redigir ou revisar a demonstração de insuficiência de quem ganha acima da faixa, responder à impugnação do banco (art. 100), atacar indeferimento (agravo do art. 101, Tema 1.178/STJ) ou acórdão fundado na Lei 1.060/50 revogada. Diagnóstico com classificação de risco e lacunas documentais.
---

# Skill: Pedido de Justiça Gratuita

## Propósito

Garantir que o pedido de gratuidade da pessoa natural entre com a forma certa para o regime
que o alcança, com a prova certa quando prova é exigida, e que a resposta à impugnação refute
em vez de reconhecer.

**Fonte de verdade.** Esta skill não repete definição nem jurisprudência. Ela **aponta**:

- Forma canônica do pedido (onde fica, o que se junta, declaração avulsa ou não):
  `perfil/definicoes.md` §2.
- Texto de lei literal: [`references/legislacao.md`](references/legislacao.md) (CPC 98-102,
  1.072, III; Tema 1.178; síntese da ADC 80).
- Acervo: `<bundles>/direito/pecas/gratuidade/` (index, heurísticas, ADC 80 com vozes
  separadas) e `<bundles>/direito/pecas/peticao-inicial/jurisprudencia/resp-1988687-rj-tema-1178-gratuidade.md`.
  `<bundles>` vem de `perfil/ambiente.json`.

## Quando usar

- Redigir ou revisar o pedido de gratuidade em inicial, contestação, recurso ou petição
  superveniente.
- Decidir se o cliente precisa provar a insuficiência ou se a alegação basta.
- Responder à impugnação (art. 100) ou impugnar a gratuidade da parte contrária.
- Atacar indeferimento ou revogação (agravo do art. 101; embargos; REsp).
- Montar a lista de documentos que o cliente deve trazer.

## Protocolo (5 passos)

### Passo 0 — O regime: data do ajuizamento

A ADC 80/STF (mérito, 03/09/2026) só alcança processos **ajuizados a partir da publicação da
ata** (03 ou 04/09/2026 — conferir no andamento). Registrar no relatório qual regime vale:

| Ajuizamento | Regime |
|---|---|
| Antes da ata | CPC 99, § 3º + Tema 1.178, sem faixa de salário. Se a contraparte invocar a ADC 80, responder só com a modulação. |
| Depois da ata | Faixa de salário decide a forma (Passo 1). |

Pedido superveniente ou em recurso dentro de ação antiga segue o regime antigo: o marco é o
ajuizamento, não o pedido.

### Passo 1 — A faixa: salário passa de R$ 5.000,00?

Pergunta única do atendimento. Até R$ 5.000,00: **Forma A** (presunção relativa; alegação na
própria peça, enxuta, art. 99, § 3º). Acima: **Forma B** (sem presunção; a peça nasce com a
demonstração e o ônus é do cliente). Detalhe de cada forma na heurística do acervo
`gratuidade/heuristicas/pedido-de-gratuidade-pos-adc-80.md`.

O valor é atualizado pela legislação do IR ou, na falta, pelo IPCA; conferir o vigente antes
de classificar caso na fronteira. "Salário" é o termo das fontes secundárias — se o acórdão
publicado disser "renda", somam-se aluguéis, pró-labore e benefícios.

### Passo 2 — Verificação do pedido (Forma A) ou da demonstração (Forma B)

**Forma A**, conferir três coisas: a alegação diz que não pode pagar custas, despesas e
honorários **sem prejuízo do sustento próprio ou da família**; não junta declaração avulsa
sem razão (§2 do `definicoes.md`); se há documento de renda à mão, ele está anexado e o valor
está dito.

**Forma B**, conferir a demonstração em quatro partes: renda (holerite ou DIRPF; autônomo:
extratos de 3 meses + DIRPF); comprometimento com documento (aluguel ou financiamento,
saúde, educação de dependentes, dívidas em curso); custo estimado do processo (custas,
preparo, perícia); pedido subsidiário **sempre** (redução ou parcelamento, 98, §§ 5º e 6º, e
intimação do 99, § 2º, se o juízo entender a prova insuficiente). Aqui a declaração de
hipossuficiência entra — como peça da instrução, não como fundamento.

### Passo 3 — O que derruba a presunção (advogado do diabo)

Procurar o que a contraparte usaria, sabendo que só vale **elemento nos autos** (99, § 2º):

- Documento fiscal do próprio cliente com renda incompatível (é o que derrubou a gratuidade
  no REsp 1.914.049/MT — a DIRPF juntada pela própria parte).
- Imóvel além da residência, veículo de alto valor, participação societária com faturamento,
  movimentação bancária incompatível com a alegação.
- Valor do processo baixo diante da renda (custas de R$ 300 para quem recebe R$ 4.900).
- Sinal externo sem documento (profissão, endereço, "advogada", "empresário") **não** é
  elemento nos autos — mas o juízo pode intimar por ele; ter a resposta pronta.

### Passo 4 — Responder à impugnação, atacar o indeferimento

**Impugnação do banco** (réplica): classificar cada argumento na tabela dos cinco do acervo
(`gratuidade/heuristicas/repertorio-do-banco-contra-a-gratuidade.md`) e refutar cada um;
nunca reconhecer sem refutar. Argumento sem elemento nos autos é respondido com o art. 99,
§ 2º, e o art. 100, parágrafo único.

**Indeferimento de plano por critério objetivo** (renda, profissão, valor do bem): agravo de
instrumento (art. 101), **sem preparo** até o relator decidir (§ 1º). Transcrever a tese do
Tema 1.178 (itens i e ii) e o item 7 da ementa do REsp 1.988.687/RJ. Em ação nova com salário
acima de R$ 5.000,00, o agravo não invoca a presunção: sustenta que a prova foi feita e, se o
juízo a achou insuficiente, que devia intimar (99, § 2º) — a ADC 80 tirou a presunção, não o
dever de intimar.

**Acórdão que cita a Lei 1.060/50** (art. 4º, art. 2º, p. ú.): norma revogada pelo art.
1.072, III. Três frases, nesta ordem: o dispositivo está revogado; o regime é o do 99, §§ 2º
e 3º; a consequência do regime vigente não foi aplicada.

### Passo 5 — Relatório

```markdown
# Relatório — Gratuidade da justiça

## 1. Regime
- Ajuizamento: __/__/____ → (antes | depois) da ata da ADC 80
- Salário/renda: R$ ______ → Forma (A | B)

## 2. Pedido / demonstração
- Forma A: alegação com "sem prejuízo do sustento": ✓/✗ · documento de renda anexado: ✓/✗
- Forma B: renda ✓/✗ · comprometimento com documento ✓/✗ · custo do processo ✓/✗ · subsidiário (98 §§5º-6º; 99 §2º) ✓/✗

## 3. Elementos que derrubam a presunção (99, § 2º)
- [ ] fiscal · [ ] patrimonial · [ ] bancário · [ ] proporção custas/renda · [ ] sinal externo sem documento

## 4. Risco: ( ) baixo ( ) médio ( ) alto

## 5. Lacunas e ação corretiva
- documentos faltantes; texto a inserir; pedido subsidiário a acrescentar
```

## Documentos a pedir ao cliente

**Sempre:** documento de renda (holerite, DIRPF, extrato de benefício); RG e CPF.

**Forma B (acima de R$ 5.000,00), acrescentar:** DIRPF completa do último exercício; extratos
bancários de 3 meses; comprovantes das despesas fixas (aluguel/financiamento, plano de saúde
ou receitas e notas, mensalidades escolares, contratos de dívida em curso com saldo).

**Por situação:** desempregado — CNIS e rescisão; autônomo/informal — extratos de 3 meses e
DIRPF; gastos com saúde — laudos, receitas, notas; dependentes — certidões e comprovante de
matrícula; aluguel — contrato ou recibos.

## Minuta de declaração de hipossuficiência (só quando a forma pedir)

```texto
DECLARAÇÃO DE HIPOSSUFICIÊNCIA

Eu, [NOME COMPLETO], CPF [XXX.XXX.XXX-XX], [NACIONALIDADE], [ESTADO CIVIL], [PROFISSÃO],
residente em [ENDEREÇO], declaro, sob as penas da lei, que não tenho condições de pagar as
custas, as despesas processuais e os honorários advocatícios sem prejuízo do sustento próprio
e de minha família (CPC, art. 98).

Renda mensal: R$ ______ ([FONTE]). Dependentes: ____. Despesas fixas: R$ ______
([ALUGUEL/FINANCIAMENTO, SAÚDE, EDUCAÇÃO, DÍVIDAS]), comprovadas pelos documentos anexos.

Estou ciente de que a gratuidade não afasta a responsabilidade pelas verbas de sucumbência,
que ficam sob condição suspensiva de exigibilidade por cinco anos (CPC, art. 98, §§ 2º e 3º).

[CIDADE], [DD] de [MÊS] de [ANO]
___________________________
[NOME COMPLETO]
```

## Exemplo

Cliente recebe R$ 6.000,00 e gasta R$ 2.000,00 com tratamento de um dependente; ação nova,
outubro de 2026. Regime: ADC 80, Forma B. A alegação sozinha cai sem intimação. A peça
demonstra: renda R$ 6.000 (holerite), comprometimento R$ 2.000 saúde + R$ 1.800 aluguel +
R$ 900 escola (documentos), sobra R$ 1.300 para três pessoas; custas estimadas R$ 1.200 e
perícia provável; pede gratuidade integral e, subsidiariamente, parcelamento e a intimação
do 99, § 2º. Declaração anexada como peça da instrução.

## Referências

- [`references/legislacao.md`](references/legislacao.md) — CPC 98-102 e 1.072, III literais;
  tese do Tema 1.178; síntese da ADC 80 (acórdão não publicado, `em_teste` no acervo).
- Acervo: `<bundles>/direito/pecas/gratuidade/index.md`.
- Regra canônica de forma: `perfil/definicoes.md` §2.

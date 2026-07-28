---
name: definicoes-pma
description: |
  Definições canônicas do escritório — valor da causa, assinatura, gratuidade, prazos,
  custas em honorários, tipografia. Carregar ANTES de fixar qualquer um desses pontos
  numa peça. Fonte única: nenhuma skill deve repetir estas definições, apenas apontar
  para cá.
status: vigente
verificado_em: 2026-07-26
---

# Definições canônicas — Paulo Moraes Advocacia

> **Contrato de uso.** Este é o único lugar onde estas regras existem. Skill que precise
> de uma delas **aponta para cá** — não a reescreve. Definição repetida em dois lugares
> diverge; foi exatamente o que aconteceu com "valor da causa" antes deste arquivo
> (`inicial-rescisao-lote` dizia uma coisa, `legal-consistency-validator` dizia outra,
> e o segundo é justamente a skill que audita a coerência da peça).

---

## 1. Valor da causa

A regra depende do **objeto da ação** — e é essa distinção que faltava, não a definição.

| Situação | Valor da causa | Fundamento |
|---|---|---|
| **Regra geral / cumulação de pedidos** | Soma dos valores de todos os pedidos quantificados | art. 292, VI, CPC |
| **Ação que tem por objeto existência, validade, cumprimento, modificação, resolução, resilição ou rescisão de negócio jurídico** | **Valor do ato** (ou o da parte controvertida) | art. 292, **II**, CPC |
| Cobrança de dívida | Soma do principal, juros vencidos e multa | art. 292, I, CPC |
| Prestações vencidas e vincendas | Soma de umas e outras (vincendas: 1 ano, se por tempo indeterminado) | art. 292, §§ 1º e 2º, CPC |

**Aplicação prática mais frequente:** na **inicial de rescisão de compromisso de compra e
venda de lote**, o valor da causa é o **valor do contrato** — não o valor buscado a título
de restituição. Cai no inciso II, porque o objeto da ação é a rescisão do negócio.
Conferir o valor no próprio contrato, nunca no OCR.

> Não há contradição entre "soma dos pedidos" e "valor do contrato": a primeira é a regra
> geral, a segunda é a regra especial do inciso II. Ao auditar uma peça, verificar **qual
> inciso se aplica** antes de acusar divergência.

---

## 2. Gratuidade da justiça

- **Pessoa natural:** a alegação na própria inicial **basta** (art. 99, § 3º, CPC —
  presunção de veracidade). **Não** juntar declaração de hipossuficiência avulsa como
  regra; pedido enxuto.
- Quando houver documento de renda (DIRPF, holerite), anexar e citar.
- Ancorar em **Tema 1.178/STJ**.
- Pessoa jurídica: presunção não se aplica — exige prova da impossibilidade.

---

## 3. Custas e preparo em honorários advocatícios

Em ação de cobrança, execução ou cumprimento de sentença de **honorários advocatícios**
(e seus incidentes e recursos — embargos à execução, apelação), o advogado credor é
**dispensado de adiantar** custas processuais e preparo recursal:

> **art. 82, § 3º, CPC** (incluído pela Lei nº 15.109, de 13/03/2025) — "Nas ações de
> cobrança por qualquer procedimento, comum ou especial, bem como nas execuções ou
> cumprimentos de sentença de honorários advocatícios, o advogado ficará dispensado de
> adiantar o pagamento de custas processuais, e caberá ao réu ou executado suprir, ao
> final do processo, o seu pagamento, se tiver dado causa ao processo."

É dispensa de **adiantamento** (postergação), **não isenção**: paga ao final quem deu
causa ao processo.

**Regras de redação nessas peças:**
1. **Nunca** escrever que o preparo foi ou será recolhido.
2. Incluir tópico "Tempestividade e dispensa do preparo", transcrevendo o dispositivo e
   explicando que o preparo é espécie de custa alcançada pela dispensa.
3. Manter o pedido de que o vencido arque com as custas ao final.

---

## 4. Assinatura das peças

- **Assina apenas quem efetivamente atua no processo.**
- Padrão, uma linha só: `ANA MORAES | OAB/TO 6573` — o nome de assinatura, **não** o nome
  civil completo.
- **Flávia Paulo Oliveira (OAB/TO 6951) não entra por padrão** — só a pedido expresso.
- Local e data: `Palmas - TO, data certificada pelo sistema.` — nunca data fixa.

Dados em [`advogados.json`](advogados.json). No dialeto PMA, bloco `::assinatura`.

---

## 5. Endereçamento e estrutura da inicial

- **Endereçamento:** `AO JUÍZO DA __ª VARA CÍVEL DA COMARCA DE X, ESTADO DE Y`
  (vara em branco se ainda não distribuído). **Não** usar "Excelentíssimo Senhor Doutor Juiz".
- **Capítulo I = "DA SÍNTESE DA LIDE"** (não "Do que se trata"), em BLUF.
- **Qualificação sem telefone** da parte autora.
- **Tom direto, sem coloquialismo:** "A parte autora requer…" e não "o que se pede é
  simples…"; "pagou" e não "entregou".

---

## 6. Prazos

- **Cível:** dias **úteis** (art. 219, CPC). O `prazo.js` da skill `pesquisa-djen`
  calcula assim.
- **Penal:** dias **corridos**. O `prazo.js` **não** serve sem ajuste.
- **Termo inicial:** publicação = 1º dia útil após a disponibilização (art. 4º, § 3º,
  Lei 11.419/2006); contagem começa no 1º dia útil após a publicação (art. 224, §§ 2º e
  3º, CPC).
- **Recesso:** art. 220, CPC — prazos suspensos de 20/12 a 20/01.
- **Feriado local** depende da portaria anual do tribunal (`skills/pesquisa-djen/feriados/`).
  Sem o arquivo, a data fatal sai marcada como não confiável e deve ser conferida antes
  do protocolo.

---

## 7. Tipografia

**Fonte de verdade legível por máquina: [`marca.json`](marca.json)** — é ela que o
`scripts/lint-docx.js` usa para validar o `.docx` gerado. A tabela abaixo reproduz os mesmos
valores para leitura humana; divergindo, o JSON prevalece e a tabela é que está desatualizada.

Autoridade: a titular, 2026-05-15. Detalhamento operacional na skill `tipografia-pma`.

| Item | Valor |
|---|---|
| Corpo | Montserrat 12 pt |
| Títulos (todos os níveis) | Montserrat 12 pt, MAIÚSCULO + bold |
| Citação em bloco | Montserrat Light 11 pt, recuo 3 cm, sem aspas nem itálico |
| Rodapé e notas | Montserrat Light 10 pt |
| Margens | 3 cm (topo, base, laterais) |
| Entrelinha | 312 DXA (1,3) |
| Após parágrafo | 12 pt |
| Alinhamento | Justificado + hifenização automática |

Hierarquia por caixa e numeração, **não** por tamanho de fonte.

---

## 8. O que qualifica um "caso decidido"

Só entra em `casos_decididos/` o caso **do próprio escritório** com **desfecho transitado
em julgado** ou decisão favorável estável, e sempre **anonimizado** (Caso A, Caso B…) —
nomes reais permanecem exclusivamente na camada C1 (`clientes/`). Caso em andamento não
gera página.

---

## Manutenção

Alterar uma definição aqui é alterar o comportamento de todas as peças. Ao mudar:
registrar a data em `verificado_em`, e conferir se alguma skill voltou a duplicar a regra
(o `lint-contradicoes` do PRD F2.3 detecta).

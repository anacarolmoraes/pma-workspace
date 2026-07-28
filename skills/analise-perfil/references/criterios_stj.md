# Os seis critérios do REsp 2.222.059/SP — esqueleto do relatório

> RECURSO ESPECIAL nº 2.222.059/SP — STJ, 3ª Turma, Rel. Min. Ricardo Villas
> Bôas Cueva, j. 21/10/2025. Tese: golpe de engenharia social é **fortuito
> interno**; validar operação alheia ao perfil de consumo é **defeito do
> serviço** (art. 14, §1º, CDC; Súmulas 297 e 479/STJ; art. 7º da Lei
> 12.865/2013 p/ instituições de pagamento).

A ementa (item 9) determina que o sistema antifraude **deve** considerar,
**conjugadamente**, os fatores abaixo. O relatório dedica uma subseção a cada,
sempre com o número extraído do JSON. A presença isolada de um fator pode não
bastar; **a conjugação de vários caracteriza o defeito** (item 10).

| # | Critério (texto do acórdão) | O que medir no caso | Fonte no JSON |
|---|---|---|---|
| i | transações que **fogem ao perfil / padrão de consumo** | valor da operação fraudulenta ÷ mediana e ÷ p95 das saídas habituais da conta | `divergencia_vs_habitual`, `baseline_pix_enviados_por_banco` |
| ii | **horário e local** | concentração no mesmo dia; identificadores de operação contíguos | `cluster_dia_fraude` (campo descrição/nº operação) |
| iii | **intervalo de tempo** entre uma e outra transação | nº de operação sequencial e espaçamento mínimo → sucessão imediata | `cluster_dia_fraude` |
| iv | **sequência das operações** | padrão fixo "crédito-ponte entra → débito sai ao desconhecido", repetido | `cluster_dia_fraude` (alternância IN/OUT) |
| v | **meio utilizado** | PIX a beneficiários **sem histórico** (zero transações prévias nos 17 extratos) | ausência nos baselines + provas |
| vi | **empréstimo atípico anterior** a pagamento suspeito | crédito-ponte de empréstimo dentro do cluster, imediatamente antes do PIX | `cluster_dia_fraude` (crédito de empréstimo) |

## Dois reforços fáticos decisivos no paradigma

Além dos seis critérios, no REsp 2.222.059 foram decisivos (itens 11 e 4 da
ementa / corpo do voto):

- **Conta usada como poupança, com pouquíssimas movimentações.** Evidências
  típicas nos extratos: créditos diários de "RENDIMENTO SALDO" (centavos),
  saldos baixos e estáveis, recompra automática de CDB, crédito mensal único
  de salário/benefício. Aponte-os.
- **Todas as operações no mesmo dia.** O esvaziamento concentrado em janela
  exígua é o cenário que o STJ considerou suficiente, por si, para o defeito.

Se ambos estiverem presentes, **diga explicitamente que o caso reproduz o
paradigma ponto a ponto** — é isso que governa o resultado.

## Subsunção (não ultrapassar)

O relatório técnico vai até a fronteira do direito: enquadra os fatos nos
critérios e conclui pela divergência objetiva, mensurável e detectável. A
qualificação jurídica final (fortuito interno, responsabilidade objetiva,
solidariedade, repetição em dobro, danos) e a redação da peça são do
`legal-orchestrator`. Manter essa fronteira preserva a credibilidade pericial
do documento.

## Precedentes de apoio (citáveis pela advogada na petição, não no laudo)

Súmula 479/STJ; Súmula 297/STJ; REsp 1.199.782/PR (repetitivo, 2ª Seção);
REsp 1.995.458/SP (Nancy Andrighi); AgInt no REsp 2.056.005/SE; AREsp
2.843.388/RJ; REsp 2.179.133/SP. (Conferir ementa real antes de citar
diretamente — não inventar.)

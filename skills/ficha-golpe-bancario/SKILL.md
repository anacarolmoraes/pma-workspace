---
name: ficha-golpe-bancario
version: 1.0.0
description: |
  Apura os números de um caso de GOLPE BANCÁRIO (falsa central, Pix, empréstimo
  contratado pelo golpista) ou de NEGATIVAÇÃO INDEVIDA a partir dos extratos já
  convertidos pelo pdfmd, e calcula de forma determinística: dano material por
  transação com detecção de dupla contagem entre extratos, repetição em dobro
  condicionada à data (EAREsp 600.663/RS), encargos por verba (índice, taxa e
  termo inicial, com a regra intertemporal da Lei 14.905/2024), dano moral pelo
  método bifásico, valor da causa pelo art. 292, V e VI, e teto do Juizado.
  Emite FICHA_CASO.md e, com --conferir, confere todo R$ da peça contra a ficha.
  Use antes de redigir QUALQUER peça de golpe bancário ou negativação (inicial,
  réplica, apelação, cumprimento), logo após o pdfmd dos extratos. É a
  irmã da ficha-rescisao-lote para o domínio principal do escritório.
---

# ficha-golpe-bancario — Ficha e calculadora da inicial de golpe bancário

## Quando usar

Sempre que for redigir peça de **golpe bancário** (falsa central, Pix induzido, empréstimo
contratado pelo golpista, cartão clonado) ou de **negativação indevida**, logo após converter
os extratos com `pdfmd`. Também antes de réplica, apelação e cumprimento do mesmo caso: na
peça de resposta, a ficha ganha os números que o banco afirma, e a divergência é o argumento.

## Por que existe

O playbook de fraude em consignado do acervo diz que "inconsistência entre valor da causa,
valores dos descontos e pedido de dano material é o ponto mais atacado em contestação". A
`ficha-rescisao-lote` resolveu isso para o lote em jul/2026; o golpe bancário, domínio
principal do escritório, continuava na aritmética de cabeça. Quatro erros que esta ficha
impede:

1. **Dupla contagem** da mesma transferência vista no extrato de origem e no da conta
   intermediária (golpe com conta de passagem).
2. **Dobro pedido sem base**: o art. 42, p.ú., do CDC incide sobre o que o **réu cobrou e
   recebeu**, não sobre o que o golpista levou; e a modulação do EAREsp 600.663/RS só dispensa
   a má-fé para cobranças posteriores a 30/03/2021.
3. **Encargos errados**: "correção pela Selic", juros de dano moral desde o evento em
   responsabilidade contratual, IPCA aplicado a fato anterior à Lei 14.905/2024 sem a cisão.
4. **Dano moral por hábito**: valor sem grupo de casos do tribunal competente e sem
   circunstância provada (heurística do método bifásico).

## Fluxo

1. **Converter os extratos** (`pdfmd`) de todas as contas envolvidas.
2. **Apurar as transações** no `.md` do extrato, uma linha por transação: data, valor,
   descrição, canal, conta e a **fonte** (`Doc. N, p. X`). Sem fonte, a transação não entra.
3. **Separar o que o réu cobrou** (`cobrancas_indevidas`: parcelas, tarifas, descontos) do que
   foi transferido a terceiro (`transacoes`). Só o primeiro grupo sustenta o dobro.
4. **Grupo de casos do dano moral**: três a cinco acórdãos do tribunal competente, com valor
   fixado e página no acervo (a skill `radar-jurisprudencia`, no modo grupo de casos, monta a
   tabela de candidatos; a página é a titular quem deposita). Acórdão sem página não é citado; entra na
   `ANALISE.md` como pesquisa a depositar.
5. **Montar o `dados_caso.json`** (ver `exemplo_dados_caso.json`) e rodar:
   ```powershell
   node skills/ficha-golpe-bancario/scripts/calc.js clientes/<caso>/dados_caso.json
   ```
6. **Redigir** com a `FICHA_CASO.md` como única fonte dos números. Depois da prosa:
   ```powershell
   node skills/ficha-golpe-bancario/scripts/calc.js clientes/<caso>/dados_caso.json --conferir clientes/<caso>/INICIAL.md
   ```
   Exit 1 lista todo `R$` da peça que não sai da ficha e todo número central da ficha que
   falta na peça. O `legal-consistency-validator` usa essa saída na conferência de valor da causa.

## Schema do `dados_caso.json`

| Campo | Obrigatório | Descrição |
|---|---|---|
| `tema` | não | `golpe` (default) ou `negativacao` |
| `responsabilidade` | não | `contratual` (default; juros da citação, CC 405) ou `extracontratual` (Súmula 54). Decisão da `ANALISE.md`, seção 2 |
| `transacoes[]` | sim, ou `cobrancas_indevidas` | `{data, valor, descricao, canal, conta, fonte}` — valores subtraídos do autor |
| `estornos[]` | não | `{data, valor, descricao, fonte}` — MED, devoluções, ressarcimento parcial |
| `cobrancas_indevidas[]` | não | `{data, valor, descricao, fonte}` — o que o réu cobrou e recebeu; base do dobro |
| `pedir_dobro` | não | `true` inclui o acréscimo do dobro no valor da causa |
| `dano_moral.grupo_de_casos[]` | não | `{processo, tribunal, data, valor, fonte}` — primeira fase |
| `dano_moral.circunstancias[]` | não | `{fato, efeito, doc}` — segunda fase; sem `doc` não eleva |
| `dano_moral.valor_pedido` | não | número que vai para o 292, V |
| `salario_minimo` | não | vigente na data do ajuizamento; sem ele o teto do Juizado não é calculado |
| `pericia_necessaria` | não | `true` afasta o Juizado (complexidade) |
| `data_referencia`, `cliente`, `out` | não | data-base, rótulo, nome do arquivo de saída |

## O que a ficha entrega

- Tabela de transações com fonte, soma, estornos e **dano material líquido**; alerta de dupla
  contagem (mesmo valor e data em contas diferentes).
- Base do dobro dividida em pré e pós 30/03/2021, com o pedido principal e o subsidiário.
- Grupo de casos com faixa e mediana (valor básico), circunstâncias com prova, avisos quando o
  pedido excede o grupo ou não tem degrau provado.
- **Tabela de encargos por verba**: índice, termo da correção, taxa e termo dos juros, com a
  cisão da Lei 14.905/2024 quando o primeiro fato é anterior a 30/08/2024.
- **Valor da causa** somado pelo `definicoes.md` §1 (292, V e VI) e o **rito** (teto de 40
  salários; perícia afasta o Juizado).
- Pedidos numéricos prontos para as alíneas.

## Limites

- **Não atualiza valores por índice.** Não há tabela de IPCA ou Selic aqui; a conta atualizada
  é do cumprimento de sentença (`gerador-cumprimento-sentenca`).
- **Não lê PDF nem print.** Depende do `.md` do `pdfmd` e da apuração humana linha a linha.
- **Não decide** responsabilidade, regime, dobro ou valor do dano moral: apresenta as
  consequências de cada escolha; a decisão é da titular, registrada na `ANALISE.md`.
- Consignado fraudulento com desconto em benefício usa esta ficha com as parcelas em
  `cobrancas_indevidas`; rescisão de lote usa a `ficha-rescisao-lote`.

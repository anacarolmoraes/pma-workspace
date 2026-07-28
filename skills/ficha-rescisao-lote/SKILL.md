---
name: ficha-rescisao-lote
version: 1.0.0
description: |
  Apura os fatos numéricos de um caso de rescisão de compromisso de compra e
  venda de LOTE urbano (contrato + extrato de pagamento) e calcula, de forma
  determinística, os cenários de retenção/restituição, a exposição de fruição,
  a sugestão de valor da causa e o texto de pedido — eliminando os erros de
  aritmética e de leitura "no olhômetro". Emite uma FICHA_CASO.md que pré-preenche
  os placeholders do template TEMPLATE_INICIAL_RESCISAO_LOTE.md. Use sempre antes
  de redigir a inicial de rescisão de lote, logo após converter os PDFs com pdfmd.
---

# ficha-rescisao-lote — Ficha e calculadora da inicial de rescisão de lote

## Quando usar

Sempre que for redigir uma **inicial de rescisão de compromisso de compra e venda de lote urbano** (Lei 6.766/79), logo após converter contrato e extrato com `pdfmd`. Substitui a apuração manual dos números — que no caso Marivaldo (jul/2026) produziu erro de valor da causa e leitura equivocada de percentuais.

## Por que existe

Dois erros recorrentes que esta skill previne:
1. **Aritmética no olhômetro:** total pago, % pago, cenários de retenção (10%/25% sobre o pago × sobre o contrato), exposição de fruição e valor da causa passam a ser calculados por script, não estimados.
2. **Número de cláusula do OCR:** o extrato/contrato escaneado, lido por OCR posicional, troca números de cláusula (no Marivaldo trocou cinco). A ficha exige que as cláusulas sejam preenchidas por **leitura do contrato assinado**, e as registra num quadro conferível.

## Fluxo

1. **Converter os PDFs** (skill `pdfmd`): `contrato_compra_venda.pdf` e o extrato de pagamento → `.md`.
2. **Apurar os números do extrato** (bloco "Resumo" do extrato da loteadora):
   - `valor_original` e `valor_atualizado` do contrato;
   - `total_pago` (campo "Total Recebido"/"Valor Pago");
   - `data_contrato` (data da venda) — **determina o regime** (pré/pós 28/12/2018);
   - `lote_edificado` (o cliente construiu/usou? normalmente NÃO em desistência).
3. **Conferir os números de cláusula no contrato assinado** (não no OCR) e preencher `clausulas`.
4. **Montar o `dados_caso.json`** (ver `exemplo_dados_caso.json`).
5. **Rodar a calculadora:**
   ```powershell
   node d:/WORK/advocacia/skills/ficha-rescisao-lote/scripts/calc.js caminho/dados_caso.json
   ```
6. **Ler a `FICHA_CASO.md` gerada** e usá-la para preencher o template
   `D:\WORK\advocacia\material_padrao_escritorio\TEMPLATE_INICIAL_RESCISAO_LOTE.md`.

## Schema do `dados_caso.json`

| Campo | Obrigatório | Descrição |
|---|---|---|
| `cliente` | não | Nome do autor (só rótulo). |
| `data_contrato` | **sim** | "YYYY-MM-DD" — data da assinatura. Determina o regime. |
| `valor_original` | **sim** | Valor original do contrato (número). |
| `valor_atualizado` | **sim** | Valor atualizado do contrato (número). |
| `total_pago` | **sim** | Total efetivamente pago pelo autor (número). |
| `lote_edificado` | não | `true`/`false` (default `false`). Define se a fruição é discutível. |
| `data_referencia` | não | "YYYY-MM-DD" — base para meses de fruição (default: hoje). |
| `out` | não | Nome do arquivo de saída (default `FICHA_CASO.md`). |
| `clausulas` | não | Objeto com os números de cláusula conferidos no contrato. |

## O que a calculadora entrega

- **Regime** (pré/pós-2018) e a tese/jurisprudência correspondente.
- **Quatro cenários de retenção** lado a lado: 10% e 25% sobre o **pago** (posições do autor) × sobre o **contrato atualizado** (posição da ré), com o "% efetivo sobre o pago" que expõe a distorção da tese da ré.
- **Exposição de fruição** (0,75%/mês × meses) e o veredito (indevida em lote não edificado).
- **Valor da causa** (original × atualizado) com a preferência da titular.
- **Texto de pedido** principal (90% / reter 10% do pago) e subsidiário (teto 25%).
- **Quadro de cláusulas** referenciadas por capítulo da peça.

## Limites (fora do escopo)

- **Não redige** a peça — isso é o template + o `legal-writer`/humanizer.
- **Não lê o PDF** — depende do `.md` já convertido pelo `pdfmd` e da apuração humana dos números-chave (evita alucinação de valores).
- **Não decide** o percentual final nem o valor da causa — apresenta os cenários; a escolha é da advogada.
- Cobre **loteamento** (Lei 6.766/79). Incorporação/apartamento (Lei 4.591/64) tem regime distinto — não usar esta calculadora.

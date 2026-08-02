---
name: gerador-cumprimento-sentenca
description: Lê sentença, acórdão (apelação/monocrática) e acórdão em embargos de declaração da pasta do caso, extrai os trechos que fixam índice de correção, montante de devolução e percentual de sucumbência, monta a planilha de upload a partir dos extratos em PDF e redige a petição de cumprimento de sentença. Utilize sempre que o usuário pedir para gerar, extrair ou criar o cumprimento de sentença de um caso (ex.: "faça o cumprimento de sentença do Patrick").
---

# Gerador de Cumprimento de Sentença

Esta skill produz a petição de cumprimento de sentença e a planilha de cálculo a partir de
dois insumos da pasta do caso:

1. **Os títulos executivos** — sentença, acórdão e acórdão em embargos de declaração — de onde
   se extraem os **parâmetros jurídicos** da execução.
2. **Os extratos de pagamento em PDF** — de onde se extrai o **montante** efetivamente pago.

## Estrutura esperada da pasta do caso

```
<caso>/                          (ex.: clientes/<nome do caso>/)
├── sentenca_*.pdf               ← título executivo (1º grau)
├── acordao_*.pdf                ← acórdão de apelação ou decisão monocrática (se houver)
├── embargos_*.pdf               ← acórdão em embargos de declaração (se anexado)
├── decisao_stj_*.pdf            ← decisão do STJ (se houver)
└── extrato_pagamento/
    └── *.pdf                    ← extratos das parcelas pagas
```

O modelo `CUMPR_SENTENCA_MODELO.docx` fica **um nível acima** da pasta do caso — o script
o procura em `dirname(pasta_do_caso)`. A cópia canônica mora em
`material_padrao_escritorio/CUMPR_SENTENCA_MODELO.docx` (junto com
`CUMPR_SENTENCA_PLANILHA_UPLOAD.xlsx`): ao abrir um cumprimento novo, copie o modelo para
o nível acima da pasta do caso. (As antigas cópias em `rescisao_contrato_imovel/` saem do
workspace com a migração do acervo.)

---

## PROTOCOLO OBRIGATÓRIO — Ler os títulos antes de redigir

**Nunca preencha a petição apenas com o valor dos extratos.** Antes de gerar, leia as decisões
e extraia os trechos determinativos. Esses três parâmetros mudam o cálculo e o pedido:

| Parâmetro | O que procurar | Placeholder no modelo |
|---|---|---|
| **Índice de correção monetária** + termo inicial | "corrigido pelo INPC/IPCA-E/IGP-M…", "a partir do desembolso/da citação/do evento", juros de mora (1% a.m.) e seu termo | `[ÍNDICE_CORREÇÃO_MONETARIA]` |
| **Montante de devolução** | percentual a restituir × percentual de **retenção** da ré (ex.: "devolução de 75%, retidos 25%"), e a base (valores pagos) | `[PERCENTUAL_RETENCAO]` |
| **Percentual de sucumbência (honorários)** | "honorários de X% sobre…", e a base de cálculo (condenação / valor atualizado da causa) | `[PERCENTUAL_HONORARIOS]` |

### Passos

1. **Localize os títulos** na pasta do caso: arquivos que casem com `sentenca*`, `acordao*`,
   `embargos*`/`emb_decl*`, `decisao_stj*` (case-insensitive). Cheque também nomes do tribunal
   (ex.: `*_Sentença_*.pdf`, `*Acórdão*.pdf`).
2. **Converta para `.md` se necessário.** Se não houver o `.md` correspondente, use a skill
   **`pdfmd`** para converter antes de ler (protocolo do `IA_CONTEXT.md`). No Windows, defina
   `PYTHONUTF8=1` antes de rodar o pdfmd.
3. **Leia e cite os trechos determinativos** (transcrição literal, não paráfrase) para cada
   placeholder de trecho do modelo:
   - `[TRECHO_SENTENCA]` → dispositivo da condenação (o que e quanto deve ser devolvido).
   - `[TRECHO_SENTENCA_SUCUMBENCIA]` → trecho da sentença sobre honorários/custas.
   - `[TRECHO_ACORDAO_APELACAO]` → parte do acórdão que **mantém ou reforma** a sentença.
   - `[TRECHO_ACORDAO_EMBARGOS]` → parte do acórdão em embargos que **integra/modifica** o acórdão.
   - `[TRECHO_DECISAO_STJ]` → se houver decisão do STJ no caso.
   - Quando um título não existir na pasta, **remova** o respectivo placeholder e o separador
     `***` correspondente, em vez de deixá-lo em branco.
4. **Resolva a hierarquia e a cronologia.** A decisão mais recente **prevalece** sobre a anterior
   em cada parâmetro: o acórdão modifica a sentença; os **embargos de declaração** podem alterar
   índice, termo inicial, percentual de devolução ou de honorários fixados antes. Se acórdão ou
   embargos tiverem mudado um valor (ex.: índice de correção ou base dos honorários), use o
   valor **final** e registre a divergência na resposta ao usuário.
5. **Se um parâmetro estiver ambíguo ou ausente nos títulos, pergunte** — não invente índice,
   percentual de retenção nem de honorários (Socratic Gate do `IA_CONTEXT.md`).

---

## Montante pago — extração dos extratos

Use o script `scripts/processar_extrato.py` para o trabalho pesado sobre os PDFs de
`extrato_pagamento/`. Ele:

- Extrai as parcelas pagas (descrição, data de recebimento, valor).
- Gera `Planilha_Upload_Gerada.xlsx` com as colunas do modelo (`descricao`, `data_correcao`
  em `mm/aaaa`, `data_juros_mora`, `valor`).
- Soma os valores pagos e preenche `[VALOR_ATUALIZADO]`.
- Varre o `CUMPR_SENTENCA_MODELO.docx`, substitui as tags e gera `Cumprimento_Sentenca_Gerado.docx`.

> O montante de devolução **não é** a soma bruta dos extratos: é essa soma sujeita ao
> percentual de devolução/retenção fixado no título (`[PERCENTUAL_RETENCAO]`), corrigida pelo
> índice e juros do título. A planilha alimenta o sistema de cálculo; o percentual de retenção e
> o índice vêm do PROTOCOLO acima.

### Atenção ao parsear o demonstrativo (lições de um caso real)

O extrato da incorporadora costuma listar **todas** as parcelas do contrato, não só as pagas:

1. **Projeções futuras** — parcelas com `Dt. Receb.` igual ao vencimento e posterior à data em que o
   demonstrativo foi calculado ("Dados a pagar calculados na data: dd/mm/aaaa"). Filtre por
   `Dt. Receb. <= data do cálculo`, senão a soma estoura.
2. **Antecipações de R$ 0,01** — parcelas quitadas por renegociação aparecem com valor pago ~R$ 0,01;
   exclua-as (`valor pago > 1`).
3. **Coluna correta** — a sentença costuma fixar o total pela coluna **"Valor da Parc." (nominal)**,
   não pelo "Valor Parc." (pago com encargos de atraso). Confira qual coluna soma o total da sentença.
4. **Reconcilie com o total fixado na sentença.** Se a soma itemizada não fechar, a diferença em geral
   é a **entrada/sinal** não detalhada no demonstrativo — lance-a como linha própria (data da
   assinatura) e **sinalize para confirmação**, em vez de descartar a divergência.

> O `processar_extrato.py` (legado) usa faixas de coordenada `x0` específicas de outro layout e **não**
> aplica esses filtros; valide a soma contra o total da sentença antes de confiar na planilha. O
> `adv_env` traz apenas `python-docx` — instale `openpyxl`/`pdfplumber` se o parsing exigir.

### Execução

Ative sempre o ambiente `adv_env` (ver `IA_CONTEXT.md`). Passe os parâmetros lidos dos títulos
via `--dados` (JSON), usando as **chaves exatamente iguais** às tags do modelo (inclusive
acentos em `[ÍNDICE_CORREÇÃO_MONETARIA]`):

```bash
python skills/gerador-cumprimento-sentenca/scripts/processar_extrato.py "CAMINHO_DA_PASTA_DO_CASO" \
  --dados '{
    "[NOME_EXEQUENTE]": "...", "[CPF_EXEQUENTE]": "...",
    "[NOME_EXECUTADO]": "...", "[CNPJ_EXECUTADO]": "...",
    "[NUMERO_PROCESSO]": "...", "[VARA_E_COMARCA]": "...", "[ESTADO]": "...",
    "[DATA_TRANSITO_JULGADO]": "...",
    "[ÍNDICE_CORREÇÃO_MONETARIA]": "INPC",
    "[PERCENTUAL_RETENCAO]": "25%",
    "[PERCENTUAL_HONORARIOS]": "10%",
    "[TRECHO_SENTENCA]": "...transcrição literal...",
    "[TRECHO_SENTENCA_SUCUMBENCIA]": "...",
    "[TRECHO_ACORDAO_APELACAO]": "...",
    "[TRECHO_ACORDAO_EMBARGOS]": "...",
    "[CIDADE]": "...", "[DATA]": "..."
  }'
```

Tags não informadas em `--dados` são perguntadas pelo script via `input()`. Para fluxo guiado
pelo Claude, prefira preencher tudo no `--dados` a partir do que foi lido nos títulos.

## Após a execução

1. Confirme que os trechos transcritos batem com o que está nos títulos (sem paráfrase).
2. Informe ao usuário o **caminho exato** dos dois arquivos gerados (`.xlsx` e `.docx`).
3. Relate explicitamente os três parâmetros usados — **índice de correção**, **percentual de
   devolução/retenção** e **percentual de honorários** — e de qual título (sentença, acórdão ou
   embargos) cada um saiu, sinalizando qualquer modificação feita em grau de recurso.

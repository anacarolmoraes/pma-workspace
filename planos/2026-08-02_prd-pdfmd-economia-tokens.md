---
title: PRD — pdfmd com leitura econômica e fidelidade verificável
data: 2026-08-02
versao: 2
autor: Ana Carolina Moraes / Codex
status: v1 implementada em 02/08/2026 — aceite com corpus real pendente da titular
origem: falha observada na conversão de consumir/LINGUAGEM_SIMPLES_PARA_PETICOES/Paralembrar_linguagemSimples_STJ.pdf e auditoria do pipeline vendor/pdfmd + skills/pdfmd
escopo: reduzir os tokens levados ao contexto ao consultar PDFs convertidos, sem resumir, omitir ou degradar a representação canônica e sem permitir que OCR semanticamente ruim passe no modo estrito
revisao: v2 em 02/08 — enforcement vira Fase 0; métricas absolutas contra o comportamento atual; canônico congelado na v1; blocks.jsonl, normalização, avaliador completo e revisão persistente movidos para v2 condicional; margem de estimativa única; revisão rechaveada por conteúdo
---

# PRD — pdfmd com leitura econômica e fidelidade verificável

## Tese

Converter PDF localmente não consome tokens de modelo. O custo nasce quando o agente carrega o
Markdown no contexto. Portanto, a economia correta não é encurtar o documento por supressão:
é manter uma representação canônica integral no disco e recuperar somente os blocos exatos
necessários para a tarefa.

O pipeline atual já aponta nessa direção (`.md` integral + `.index.md` + `ler-pdfmd.js`), mas
tem três gaps, em ordem de custo real:

1. **enforcement inexistente:** a única barreira contra abrir o `.md` integral é uma frase no
   `SKILL.md`. O agente pode dar `Read` direto no canônico e nenhuma camada o impede. É onde
   o token de fato vaza hoje — e é o gap mais barato de fechar;
2. **seleção grosseira:** o leitor trabalha por página, seção ou linhas próximas à ocorrência,
   sem orçamento de tokens;
3. **fidelidade aparente:** `--strict` bloqueia apenas páginas que já receberam `warnings`.
   O Tesseract fornece confiança por palavra, mas essa confiança não gera uma avaliação da
   página, e a ordem de leitura ignora a geometria. Assim, OCR com colunas embaralhadas e
   ruído gráfico passa como íntegro.

O projeto se divide em **v1 (MVP)**, que fecha os três gaps com o mínimo de artefatos novos,
e **v2 (condicional)**, que só entra se a medição da v1 provar insuficiência. A v1 não cria
`blocks.jsonl` nem altera o formato do Markdown canônico — o canônico fica **congelado**
durante toda a v1, para que linhas, âncoras e métricas permaneçam comparáveis.

```text
PDF
 ├─ documento.md             canônico integral; fonte para leitura e citação (congelado na v1)
 ├─ documento.index.md       mapa humano curto; aberto primeiro
 ├─ documento.pdfmd.json     proveniência e qualidade; não aberto por padrão
 ├─ documento_assets/        evidência visual; aberta somente quando necessário
 └─ documento.blocks.jsonl   [somente v2] índice completo de blocos; consultado por máquina
```

Economia de tokens ocorre na camada de recuperação **e na camada de enforcement**. Fidelidade
é protegida nas camadas canônica e de qualidade.

---

## Resultado esperado

Para uma pergunta localizada, o agente deve receber apenas o índice curto e os trechos exatos
que respondem à pergunta — e deve ser **impedido por hook** de carregar o Markdown integral
sem pedido expresso. O Markdown integral continua disponível para auditoria, leitura integral
e citação.

Exemplo de fluxo:

```powershell
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --mapa
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --buscar "voz ativa" --max-tokens 800
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --paginas 17 --max-tokens 1200
```

Saída esperada da busca:

```text
2 resultados exibidos (~612 tokens estimados). 2 resultados ficaram fora do orçamento.
Para continuar: --paginas 17,29 ou repetir com --max-tokens maior.

<!-- resultado: p. PDF 2; linhas 51-58 -->
...texto literal do Markdown canônico...
```

Não há resumo autoral, reescrita ou texto reconstruído durante a recuperação.

---

## Métricas de produto

### Suíte de consultas (pré-requisito das métricas)

As métricas só valem contra uma suíte definida **antes** da implementação, em F1:

- **20 a 30 consultas reais**, coletadas de casos já trabalhados (parafraseadas para não
  carregar dado C1 na suíte versionada), em três tipos:
  1. fato pontual — data, valor, número de cláusula ("qual o valor da parcela de entrada?");
  2. tese ou seção — ("o que o documento diz sobre voz ativa?");
  3. dado tabular — ("linha do extrato com o débito de 14/09").
- relevância anotada **uma vez, pela titular**, como páginas e trechos do canônico que
  respondem cada consulta;
- a suíte fica versionada em `skills/pdfmd/tests/fixtures/consultas.jsonl` e não muda entre
  medições da mesma fase.

### Métrica principal (absoluta, contra o comportamento atual)

Para cada consulta da suíte, registrar tokens estimados devolvidos por três estratégias:

| Estratégia | O que mede |
|---|---|
| `Read` do `.md` integral | custo atual quando o agente ignora o leitor (linha de base pior) |
| `ler-pdfmd.js` atual (`--buscar`/`--paginas` sem orçamento) | custo atual quando o agente usa o leitor |
| `ler-pdfmd.js` v1 (com orçamento) | custo proposto |

Metas da v1:

- tokens devolvidos pela v1 ≤ tokens do leitor atual em **100%** das consultas (nunca piorar);
- tokens devolvidos pela v1 ≤ **50%** do leitor atual na **mediana** das consultas de busca;
- trecho relevante presente na primeira resposta em ≥ **85%** das consultas (busca lexical
  tem teto real; cada miss é registrado com causa — termo ausente, flexão, sinônimo — e
  alimenta a decisão sobre a v2);
- relatório final publica os números absolutos por consulta, não apenas percentuais.

Percentual sobre o documento integral **não é meta**: consulta localizada em documento longo
atinge qualquer percentual trivialmente e não discrimina nada.

### Portões de fidelidade

- 100% das páginas físicas registradas no manifesto e ancoradas no Markdown;
- 100% dos assets citados existentes;
- hash do PDF correspondente ao manifesto;
- nenhum trecho resumido ou inventado na recuperação;
- nenhum bloco cortado no meio de parágrafo, item de lista ou célula de tabela;
- toda página com OCR abaixo dos limiares gera warning;
- `--strict` preserva o bundle anterior quando houver warning;
- citações continuam usando `p. PDF N` e as âncoras atuais permanecem compatíveis.

### Estimativa de tokens — margem única

`estimated_tokens = ceil(caracteres / 3)`. Essa razão já superestima tokens para texto
jurídico em português (tokenizadores atuais rendem ~3,5–4 caracteres por token), portanto já
é a margem de segurança. **Não aplicar margem adicional por cima** — margem dupla faria um
`--max-tokens 800` entregar ~500 tokens reais. A estimativa é declarada aproximada na saída
e no contrato; adaptador de tokenizador específico fica como extensão opcional futura.

---

## Decisões de arquitetura

### D0 — Enforcement por hook, não por documentação

A instrução "não abrir o Markdown inteiro" já existe no `SKILL.md` e não impede nada. Um hook
`PreToolUse` (padrão já usado por `hooks/block-secrets.js`) intercepta `Read` sobre `.md` que
tenha manifesto `*.pdfmd.json` irmão e mais de um limiar de linhas, e devolve instrução de
usar `ler-pdfmd.js`. A leitura integral continua possível — via `ler-pdfmd.js --completo`,
que é ato expresso — mas deixa de ser o caminho de menor resistência.

### D1 — O Markdown canônico continua integral e fica congelado na v1

Não criar versão resumida que possa substituir o texto. Além disso, **nenhuma normalização
do canônico na v1** (recomposição de linhas, dedup de cabeçalho, dedup de OCR de imagem):
qualquer mudança no shape do `.md` invalidaria linhas, métricas de linha de base e futuras
referências de revisão. Normalização é v2, com regeneração completa e consciente dos
derivados (ver F7).

### D2 — As âncoras atuais não mudam

Manter:

```markdown
<a id="pdf-page-12"></a>
<!-- pdfmd:page=12; method=native -->
```

Encurtar dois marcadores economizaria poucos tokens e quebraria leitores, manifestos e links
existentes. A economia relevante vem da seleção, não dessa micro-otimização.

### D3 — Segmentação em runtime na v1; índice de blocos persistido só na v2

O leitor v1 segmenta o canônico **em memória, na hora da consulta**: parágrafos delimitados
por linha em branco, listas e tabelas como unidades, âncoras de página como metadados. Isso é
barato (o canônico já está no disco), determinístico e elimina na v1 o problema inteiro de
IDs estáveis, sincronização e regeneração de um `blocks.jsonl`. O arquivo persistido só se
justifica se a medição mostrar custo de segmentação relevante ou necessidade de busca sem
abrir o canônico — decisão explícita de entrada na v2.

### D4 — Recuperação literal, progressiva e sem overlap

O leitor devolve conteúdo literal do canônico. Blocos não se sobrepõem: headings e páginas
são metadados, não texto repetido em cada trecho. Quando faltar contexto, o agente expande
explicitamente (páginas vizinhas ou `--contexto` maior).

### D5 — O manifesto não entra no contexto por padrão

O leitor consulta o JSON programaticamente e imprime apenas warnings e estados relevantes ao
trecho solicitado. Coordenadas, hashes e inventários completos permanecem disponíveis para
auditoria sem ocupar contexto ordinário.

### D6 — OCR adaptativo, nunca multipass indiscriminado

Fluxo:

```text
extração nativa por página
        ↓ insuficiente
OCR simples da página
        ↓ qualidade reprovada
segmentação de layout + novas tentativas apenas nas regiões ruins   [v2]
        ↓ ainda reprovada
warning + preservação da imagem + bloqueio no modo estrito
```

Na v1, o degrau adaptativo por região fica de fora: a v1 corrige a **ordem de leitura** e
instala sinais de qualidade grosseiros mas confiáveis. Tentativas com múltiplos PSM e
pré-processamento condicional são v2, dependentes de corpus real de calibração.

### D7 — Flags sem sobrecarga

`--completo` tem um único significado: ignorar o orçamento e devolver o alvo integral (ato
expresso do agente). O mapa detalhado, quando existir hierarquia (v2), usa flag própria
(`--mapa-detalhado`). Nenhuma flag muda de sentido conforme a combinação.

---

## v1 — MVP

Fecha o vazamento de tokens e a regressão do STJ. Quatro frentes, canônico intocado.

### F0 — Hook de enforcement

#### O que construir (F0)

`hooks/block-md-integral.js`, registrado em `PreToolUse` para a ferramenta `Read`:

- dispara quando o alvo é `.md` com `*.pdfmd.json` irmão **e** mais de ~300 linhas;
- devolve mensagem única: caminho do `ler-pdfmd.js`, os quatro modos e o lembrete de que
  leitura integral é `--completo`;
- não bloqueia `.md` sem manifesto, `.md` curto, nem qualquer outro arquivo;
- respeita `CLAUDE_INVOKED_BY` como os demais hooks, para não recursar;
- suíte própria no padrão de `hooks/_teste-block-secrets.js`.

#### Critério de aceite (F0)

`Read` em canônico longo com manifesto é bloqueado com instrução acionável; `Read` em
qualquer outro `.md` passa intocado; a suíte do hook cobre os dois lados e o caso de manifesto
órfão (manifesto sem `.md`).

**Esforço estimado: 0,5 dia.**

### F1 — Linha de base, corpus de regressão e suíte de consultas

#### O que construir (F1)

Fixtures sem dados C1 cobrindo:

- página nativa de uma coluna;
- página digitalizada de uma coluna;
- duas colunas com títulos atravessando a largura;
- lista numerada em duas colunas;
- tabela;
- página com cabeçalho e rodapé repetidos;
- página-montagem com miniaturas e texto esparso;
- OCR deliberadamente degradado;
- imagem probatória acompanhada de texto nativo.

Além das fixtures sintéticas, **um conjunto de calibração com documentos reais** (mínimo 10,
fora do git, listado por hash em arquivo versionado) para medir falso positivo dos sinais de
qualidade — 9 fixtures sintéticas não medem taxa de falso alarme de nada.

Registrar para cada fixture: Markdown esperado ou invariantes estruturais; ordem esperada dos
blocos; páginas que devem exigir revisão; tokens do canônico.

Construir a **suíte de consultas** descrita nas métricas (20–30 consultas reais anotadas) e
medir as três estratégias da tabela de métricas com o código **atual**, antes de qualquer
mudança.

O PDF do STJ que revelou a falha serve como teste local de aceitação. Sua inclusão no git
depende de confirmação de licença; a suíte versionada usa fixture sintética equivalente.

#### Critério de aceite (F1)

Relatório de linha de base reproduz dois comportamentos atuais: página de duas colunas com
ordem errada e página visual ruim aprovada por `--strict`. Os tokens por consulta das três
estratégias ficam gravados para comparação.

**Esforço estimado: 1,5–2 dias.**

### F2 — Ordem de leitura geométrica e sinais de qualidade mínimos (F6-lite)

#### Correção estrutural em `PageText.from_tesseract_data`

- agrupar por `(block_num, par_num, line_num)`;
- preservar confiança por palavra;
- ordenar linhas e blocos por geometria;
- detectar colunas antes da união em parágrafos;
- impedir que grande distância horizontal produza uma linha única;
- restringir promoção a heading quando o bloco OCR tiver baixa confiança.

#### Sinais de qualidade — apenas os grosseiros e confiáveis

Dois ou três sinais com baixa taxa de falso positivo intrínseca:

- confiança média da página abaixo de limiar;
- proporção de tokens sem letras ou de fragmentos de 1–2 caracteres acima de limiar;
- indício de múltiplas colunas não resolvidas (sobreposição vertical de blocos distantes).

Warnings tipados: `ocr_low_confidence`, `ocr_suspected_garbage`, `reading_order_ambiguous`.
Limiares calibrados no conjunto real de F1. Sinais sofisticados (headings improváveis,
densidade de blocos, distância anormal entre palavras) ficam para o avaliador completo da v2.

Página reprovada: manter asset integral, conservar OCR provisório claramente marcado,
registrar `review_required`, falhar em `--strict` sem substituir o bundle anterior.

#### Critério de aceite (F2)

A fixture equivalente à página 4 do documento do STJ não termina com exit 0 em `--strict`
enquanto contiver ruído ou ordem ambígua. Nenhum documento do conjunto real de calibração
sem problema conhecido recebe warning (falso positivo zero **nesse conjunto**, declarado como
tal — não como taxa universal).

**Esforço estimado: 2–3 dias.**

### F3 — Leitor com orçamento de tokens

#### Alterações em `skills/pdfmd/scripts/ler-pdfmd.js`

Adicionar:

```text
--max-tokens N        teto estimado da saída substantiva
--max-resultados N    limite adicional de resultados
--completo            devolve o alvo integral, ignorando orçamento (ato expresso)
--avisos              exibe apenas pendências de qualidade
```

Comportamento:

1. `--mapa` abre somente o índice, nunca o `.md` integral para imprimir a saída;
2. `--buscar` segmenta o canônico em memória (parágrafo, lista, tabela como unidades),
   ordena ocorrência exata antes de aproximada e devolve unidades inteiras;
3. não corta unidade semântica para caber no orçamento;
4. se uma única unidade exceder o teto, informa o custo e exige `--completo` ou `--paginas`;
5. informa quantidade, páginas e linhas dos resultados omitidos;
6. inclui página PDF e heading path em cada resultado;
7. consulta o manifesto internamente e mostra warning apenas das páginas devolvidas;
8. `--paginas`, `--secao` e `--contexto` continuam funcionando; sem parâmetro novo, a saída
   atual não muda.

#### Critério de aceite (F3)

- nenhuma saída ultrapassa `--max-tokens` pela estimativa `ceil(caracteres/3)`, salvo alvo
  pedido com `--completo`;
- busca retorna texto literal do canônico;
- resultado omitido é sempre enumerado com página e linhas;
- metas da métrica principal atingidas na suíte de consultas.

**Esforço estimado: 1,5–2 dias.**

### F4 — Índice humano compacto

#### Mudança no gerador

O índice padrão mostra: número de páginas; tokens integrais estimados; grandes seções com
intervalos de página e custo estimado; quantidade de tabelas e imagens somente quando
relevante; páginas com `review_required`. Teto de **600 tokens estimados**; quando os headings
não couberem, conservar apenas os níveis superiores (o detalhe continua acessível por
`--secao` e `--buscar`).

Formato de linha sem separador de milhar (a linha é lida por máquina também):

```text
p. 8-12 | Contestação > Mérito | 1140 tok | nativo
p. 13   | Extrato bancário     | 420 tok  | visual; conferir
```

#### Atualização de contrato

Alterar `skills/pdfmd/references/contrato-saida.md` para: declarar que o índice humano pode
ser hierárquico; manter a proibição de resumo substantivo; declarar a estimativa de tokens e
sua natureza aproximada; registrar o hook de enforcement como parte do contrato de leitura.

#### Critério de aceite (F4)

`--mapa` permanece ≤ 600 tokens estimados nas fixtures. Todas as seções continuam
localizáveis por `--secao`/`--buscar`, ainda que nem todos os subtítulos apareçam no mapa.

**Esforço estimado: 0,5–1 dia.**

### Portão de saída da v1

A v1 termina com a medição da suíte de consultas repetida sobre o código novo. O relatório
responde três perguntas que decidem a v2:

1. a busca lexical em runtime atingiu o recall de 85%? (se sim, `blocks.jsonl` não se paga);
2. quanto do custo restante vem de duplicação no canônico? (decide a normalização);
3. quantas páginas reais caíram em `review_required` e exigiram correção manual? (decide a
   revisão persistente).

---

## v2 — condicional à medição da v1

Nenhuma frente da v2 começa sem o portão de saída da v1 indicar necessidade. Ordem interna
sugerida conforme dependências.

### F5 — Normalização do canônico (destrava as demais)

Descongelar o formato canônico **uma única vez**, com regeneração completa e versionada de
todos os derivados. Normalizações permitidas:

- juntar linhas do mesmo parágrafo com base em geometria e pontuação;
- desfazer hifenização apenas quando a palavra reconstruída for inequívoca;
- remover espaços duplicados e caracteres de controle;
- normalizar marcadores de lista sem alterar sua ordem;
- consolidar cabeçalho e rodapé repetidos no manifesto;
- deduplicar OCR de imagem contra OCR da página por similaridade textual e interseção de bbox;
- classificar raster que cobre quase toda a página como `page_scan`;
- manter o asset da página e seu vínculo no manifesto.

Proibições: resumir; remover repetição substantiva da fonte; corrigir erro material do autor
sem marcação; reordenar por inferência sem suporte geométrico; apagar texto de baixa
confiança para reduzir tokens.

**Vem antes de qualquer índice persistido**: mudar o shape do canônico depois de existir
`blocks.jsonl` e revisões ancoradas invalidaria tudo. Essa é a razão de a normalização ter
saído da v1 e abrir a v2.

### F6 — Índice de blocos persistido (`documento.blocks.jsonl`)

Somente se a medição mostrar custo de segmentação em runtime ou necessidade de busca sem
abrir o canônico.

```json
{"id":"p0002-b0004","page":2,"heading_path":["Enquanto escreve","Objetividade"],"start_line":51,"end_line":58,"characters":824,"estimated_tokens":275,"kind":"list","quality":"reviewed"}
```

- `kind`: `heading`, `paragraph`, `list`, `table`, `image`, `footnote`, `code`, `equation`;
- `quality`: `native`, `ocr_ok`, `review_required`, `reviewed`;
- o arquivo carrega o hash do canônico que o gerou; **o leitor regenera o índice
  automaticamente** quando detecta hash divergente (derivado barato e determinístico — nunca
  recusar e parar);
- IDs são declarados **instáveis entre versões do segmentador**; nada externo pode ancorar-se
  a um ID de bloco (ver F8);
- concatenação ordenada dos blocos cobre todo o texto substantivo exatamente uma vez.

### F7 — Avaliador de qualidade completo e OCR adaptativo

Extensão dos sinais de F2 com calibração em corpus real ampliado (mínimo 30 documentos):
percentis de confiança, sequências improváveis, headings improváveis, densidade de blocos
dispersos, distância anormal entre palavras, duplicação texto × imagem
(`complex_visual_layout`, `ocr_text_image_duplicate`).

OCR adaptativo: página reprovada gera candidatos `PSM 3/4/6/11` conforme o layout, escolhidos
pela nota calibrada; deskew, contraste, remoção de ruído e DPI maior apenas com indicação
mensurável; página-montagem segmentada em regiões, novas tentativas só nas regiões ruins.

Warnings novos entram primeiro em modo relatório; só viram bloqueantes no `--strict` depois
de a taxa de falso positivo no corpus real ficar aceitável e declarada.

### F8 — Revisão humana persistente

Sidecar `documento.pdfmd.review.json`. **Chave da correção: `(pdf_page, sha256 do texto
original substituído)`** — nunca ID de bloco, que é instável por definição (F6). A correção é
localizada por conteúdo na reaplicação.

- hash do PDF; versão do conversor; entradas com página, hash do trecho original, texto
  literal aprovado, estado `pending | reviewed | rejected`, data e método;
- reconversão reaplica quando o hash do PDF não mudou e o trecho original ainda é localizável;
  em conflito, preserva a saída anterior e pede nova revisão; nunca descarta correção
  silenciosamente;
- gravação dos arquivos afetados via diretório temporário + rename, com ordem definida e
  verificação de consistência na leitura (transação multi-arquivo real não existe no
  Windows; o design assume detecção e reparo, não atomicidade perfeita).

#### Critério de aceite (F8)

Reconversão do PDF do STJ não perde as páginas corrigidas. Mudança no PDF invalida a revisão
de forma explícita e preserva o bundle anterior. Atualização do segmentador **não** invalida
revisão nenhuma (chave por conteúdo, não por ID).

### F9 — Migração e integração final

1. Atualizar `skills/pdfmd/SKILL.md` com o fluxo obrigatório e o hook;
2. `converter-caso.js` valida os artefatos novos, warnings e revisões;
3. gerar derivados novos para conversões existentes sem reconverter o PDF quando hash e
   manifesto forem válidos; não reescrever Markdown existente em massa;
4. Windows e macOS passam pela mesma suíte usando o Python de `perfil/ambiente.json`.

---

## Testes obrigatórios

### Unidade

**v1:** estimativa e orçamento de tokens; segmentação em runtime de parágrafos, listas e
tabelas; ordenação geométrica em duas colunas; sinais de qualidade de F2; hook de enforcement
(bloqueio, passagem e manifesto órfão); mapa dentro do teto.

**v2:** IDs e regeneração automática do `blocks.jsonl`; deduplicação página × imagem;
reaplicação de revisão por hash de conteúdo; avaliador completo.

### Integração

- conversão completa com todos os artefatos;
- busca sem ler/imprimir o Markdown integral;
- strict preservando bundle anterior;
- PDF misto escolhendo OCR página a página;
- asset ausente bloqueando validação;
- manifesto com hash divergente bloqueando leitura como fonte conferida;
- **v2:** revisão humana sobrevivendo à reconversão e à troca de segmentador.

### Aceitação

Rodar sobre, no mínimo: o PDF de linguagem simples do STJ; uma petição nativa longa; um
processo digitalizado; um extrato com tabela; um documento misto com assinatura ou carimbo.
Para cada um, registrar: tokens integrais, tokens do mapa, tokens das consultas da suíte,
recall, warnings, páginas reprocessadas e resultado da conferência visual.

---

## Ordem de execução e esforço

| Ordem | Frente | Esforço | Razão |
|---|---|---|---|
| 1 | F0 — hook de enforcement | 0,5 d | Fecha o vazamento real com o menor custo; independe do resto. |
| 2 | F1 — linha de base + suíte | 1,5–2 d | Impede otimização sem medida e cria reprodução dos bugs. |
| 3 | F2 — ordem geométrica + sinais mínimos | 2–3 d | Mata a regressão do STJ; pode andar em paralelo com F3. |
| 4 | F3 — leitor com orçamento | 1,5–2 d | Entrega a economia de seleção sem alterar o canônico. |
| 5 | F4 — índice compacto | 0,5–1 d | Reduz o custo da primeira leitura. |
| — | **Portão de saída da v1** | 0,5 d | Medição decide se a v2 existe. |
| 6+ | F5 → F6/F7 → F8 → F9 | condicional | F5 primeiro porque descongela o canônico antes de qualquer índice persistido. |

Total da v1: **~7 a 9 dias de trabalho**, entregável por partes (F0 sozinho já reduz custo).

---

## Decisões negativas

| Rejeitado | Motivo |
|---|---|
| Resumir o PDF para economizar tokens | Perde literalidade, detalhes e capacidade de citação. |
| Confiar em instrução de SKILL.md como enforcement | Não impede `Read` no canônico; hook é a barreira real. |
| `blocks.jsonl` na v1 | Segmentação em runtime é barata e elimina IDs, sincronização e regeneração; persistir só se a medição exigir. |
| Normalizar o canônico na v1 | Invalidaria linhas, métricas e futuras revisões; canônico congelado até F5. |
| Métrica percentual sobre o documento integral | Não discrimina: consulta localizada em documento longo passa sempre. |
| Margem de estimativa dupla (razão conservadora + folga extra) | Entregaria ~60% do orçamento pedido; uma margem só. |
| Ancorar revisão humana em ID de bloco | IDs são instáveis por definição; chave por conteúdo (página + hash do trecho). |
| Substituir o Markdown canônico por chunks | Fragmenta a fonte e dificulta auditoria; chunks são índice derivado. |
| Abrir manifesto inteiro antes de toda leitura | Metadados volumosos; o leitor extrai somente os warnings relevantes. |
| Overlap automático entre chunks | Duplica texto e tokens; expansão é explícita. |
| OCR multipass em todas as páginas | Aumenta custo e tempo sem benefício nas páginas boas. |
| Apagar OCR ruim e deixar apenas a imagem | Oculta a pendência e impede busca; manter provisório + warning. |
| Trocar agora as âncoras existentes | Economia irrelevante diante do custo de quebrar links e citações. |
| Embeddings ou banco vetorial | O corpus local e a busca lexical estruturada ainda não justificam; reavaliar apenas se o recall lexical da v1 ficar abaixo da meta por causa de sinônimos/flexões. |
| Tokenizador específico como dependência obrigatória | Reduz portabilidade; estimativa conservadora + adaptador opcional depois. |
| Avaliador de qualidade completo na v1 | Nove sinais calibrados exigem corpus real amplo; é pesquisa, não feature — v2. |

---

## Riscos

| Risco | Mitigação |
|---|---|
| Hook bloquear leitura legítima e irritar o fluxo | Limiar de linhas, mensagem com o comando exato de saída (`--completo`), suíte própria do hook. |
| Orçamento estimado divergir do modelo real | Estimativa conservadora única, declarada aproximada na saída. |
| Índice curto esconder seção relevante | `--buscar` e `--secao` independem do mapa humano. |
| Segmentação em runtime dividir argumento jurídico | Parágrafo como unidade mínima; unidades nunca cortadas; testes com peças reais. |
| Busca lexical não atingir recall | Meta honesta de 85%; misses registrados com causa; decisão sobre v2/embeddings baseada nesses dados. |
| Falsos warnings de OCR | v1 usa só sinais grosseiros calibrados em documentos reais; sinais finos entram em modo relatório na v2. |
| Normalização (v2) remover repetição substantiva | Similaridade textual + sobreposição geométrica + fixture; supressão registrada no manifesto. |
| Revisão humana incompatível após atualização | Chave por conteúdo (página + hash do trecho), hash do PDF e versão do conversor. |
| Derivado dessincronizado após edição manual do canônico | Hash do canônico no derivado; leitor **regenera automaticamente** (nunca recusa e para). |
| Tabela maior que o orçamento | Informar custo e exigir leitura explícita; em busca, permitir cabeçalho + linhas correspondentes. |

---

## Definição de pronto

### v1

1. o hook impede leitura integral acidental de bundle pdfmd e a suíte do hook está verde;
2. o agente localiza e lê trechos sob `--max-tokens` sem carregar o Markdown integral;
3. a suíte de consultas mostra v1 ≤ leitor atual em 100% das consultas, ≤ 50% na mediana das
   buscas e recall ≥ 85%, com números absolutos publicados;
4. a recuperação é literal, auditável e ligada à página física;
5. o caso de regressão do STJ falha em `--strict` e nenhum documento limpo do conjunto de
   calibração recebe warning;
6. contratos, skill e testes atualizados e verdes em Windows e macOS.

### v2 (se aberta pelo portão de saída)

1. normalização aplicada com regeneração completa e sem perda substantiva no diff semântico;
2. correções humanas sobrevivem à reconversão e à troca de segmentador;
3. avaliador completo com taxa de falso positivo medida e declarada em corpus real.

---

## Registro de execução — 02/08/2026

Implementados F0, F2, F3 e F4, com testes automatizados. F1 foi implementada no nível de
fixtures sintéticas e invariantes; a suíte de 20–30 consultas reais, a lista de hashes dos dez
documentos externos e a anotação de relevância continuam pendentes porque dependem de corpus
fora do git e de anotação única pela titular, como exige este próprio PRD. Sem esses dados, não
se publica recall nem se abre a v2.

Validações executadas:

- `node skills/pdfmd/tests/_teste-ler-pdfmd.js`;
- `node hooks/_teste-block-md-integral.js`;
- `node hooks/_teste-block-secrets.js`;
- `<python> -m unittest vendor.pdfmd.tests.test_fidelity` (12 testes);
- `node scripts/lint-skills.js` (0 erros; 8 avisos preexistentes fora do pdfmd).

O PDF real do STJ mencionado no PRD não está no workspace. A regressão geométrica equivalente
está coberta por fixture sintética; o aceite visual e a calibração de falso positivo permanecem
pendentes até o corpus externo ser disponibilizado.

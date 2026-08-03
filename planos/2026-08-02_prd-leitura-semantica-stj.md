---
title: PRD — Leitura semântica de julgados do STJ e consumo do RISTJ
data: 2026-08-02
versao: 1
autor: Ana Carolina Moraes / Claude
status: executado em 2026-08-02 — F1 a F7 entregues; migração de conteúdo pendente do titular
origem: análise dos 4 documentos de consumir/ORGANIZACAO_STJ (Manual de Organização 2026, Manual de Padronização de Textos 3ª ed. 2024, RISTJ até ER-53, manual revogado) + mapeamento do pipeline de leitura de julgados (radar-jurisprudencia, lint-citacoes, lint-bundle, ingest-prep)
escopo: fazer o agente ler acórdão do STJ com a semântica correta (tese ≠ citação) e tornar o RISTJ fonte consultável para peças dirigidas ao STJ. NÃO cobre a redação das peças em si.
---

# PRD — Leitura semântica de julgados do STJ e consumo do RISTJ

> **Documento irmão:** [`2026-07-26_prd-infra-agente.md`](2026-07-26_prd-infra-agente.md) criou a
> camada de verificação (lint-citacoes, lint-bundle). Este PRD corrige o ponto cego que aquela
> camada herdou: ela verifica **se o texto existe na fonte**, mas não **quem fala** no texto.

## Tese

Um acórdão do STJ é um documento polifônico: dentro dele falam o relator, o tribunal de origem
(ementa e trechos transcritos no relatório), e outros precedentes (ementas coladas no voto como
argumento de autoridade). O pipeline atual trata o arquivo como voz única.

> **Consequência mensurável:** no raw do REsp 2.035.848 há a ementa do TJTO e ementas de 5
> outros AgInt/AgRg transcritas no voto. Qualquer frase delas passa hoje no `lint-citacoes` com
> 100% de sobreposição, **atribuída ao REsp 2.035.848** — o portão valida como tese do julgado
> algo que ele apenas citou, ou que ele rejeitou.

O próprio STJ resolve isso com o **Espelho do Acórdão** (Manual de Organização 2026, cap. 5): a
Seção de Tratamento de Acórdãos lê o inteiro teor e separa, campo a campo, **enunciado de tese**,
**referência legislativa** e **jurisprudência citada** — três campos distintos exatamente porque
citação não é tese. A Seção de Triagem classifica **principal × similar** e só o principal recebe
leitura profunda. Este PRD replica esse modelo, que é validado em produção pela Corte, dentro do
acervo e dos lints.

Segunda perna: peça dirigida ao STJ obedece a rito do **RISTJ** (convertido, vigente até a
Emenda Regimental n. 53), que hoje não é fonte consultável em lugar nenhum do acervo.

---

## Ordem de execução, por risco × retorno

| # | Frente | Por quê nesta posição |
|---|---|---|
| 1 | **F1** segmentador + atribuição de voz | Elimina o falso-positivo mais perigoso: ementa alheia validada como tese. Tudo o mais consome sua saída. |
| 2 | **F2** `lint-citacoes` ciente de voz | É onde o dano vira irreversível (peça protocolada). Consome F1 diretamente. |
| 3 | **F3** RISTJ: reparo → conferência → depósito → recortes | Desbloqueia peça para o STJ com fundamento regimental verificável. Independente de F1/F2. |
| 4 | **F4** schema v0.5 — Espelho do Acórdão | Formaliza os campos que F1 extrai. Pode andar em paralelo com F3. |
| 5 | **F5** checklist regimental na `banca-revisora` | Depende dos recortes de F3. |
| 6 | **F6** correção do E4 + lint dos campos novos | Barato; fecha o escape de substring do portão de inteiro teor. |
| 7 | **F7** radar: só-ementa, principal×similar, relator | Melhora a coleta; menos urgente porque F2 já protege a saída. |

---

## F1 — Segmentador de acórdão com atribuição de voz

### Problema

Nenhum componente separa ementa / relatório / voto / dispositivo, embora os headings existam
limpos nos `.md` de `raw/` (`# EMENTA`, `# RELATÓRIO`, `# VOTO`, fecho "É como voto"). A única
heurística estrutural do projeto inteiro é a regex `MARCA_DISPOSITIVO` em
`skills/radar-jurisprudencia/scripts/buscar.js:75`. O campo `confianca_fonte:
literal-da-peca | derivado-do-voto` (schema, tipo `contra-ataque`) é preenchido à mão, sem
verificação.

### O que construir

**F1.1 — `segmentar-acordao.py`**, na raiz do `arsenal-juridico`, ao lado de `lint-bundle.py`.
Lê um `raw/*.md` de acórdão e grava sidecar `*.estrutura.json`:

- **Seções**: `ementa`, `relatorio`, `voto` (um por votante, com nome quando identificável),
  `dispositivo`, delimitadas por heading + fechos ("É como voto", "Ante o exposto", "Pelo
  exposto, não conheço"). Acórdão sem headings reconhecíveis → `nao_segmentado: true`, nunca
  chute silencioso.
- **Ementa CNJ estruturada**: quando presente, capturar `I. CASO EM EXAME`, `II. QUESTÃO EM
  DISCUSSÃO`, `III. RAZÕES DE DECIDIR`, `IV. DISPOSITIVO E TESE`, `Tese de julgamento:`,
  `Dispositivos relevantes citados:`, `Jurisprudência relevante citada:` — esse ouro já está no
  acervo (ex.: `direito/imobiliario/raw/antes-lei-varios-acordaos-ementas.md`) e nada o consome.
- **Blocos de voz citada**: dentro de cada seção, marcar trechos que são transcrição de outro
  julgado, usando a gramática oficial de citação do Manual de Padronização 2024 (`<Classe> n.
  <número>/<UF>`, siglas oficiais) + sinais tipográficos (blockquote, aspas, ementa-de-terceiro
  em caixa alta). Cada trecho sai com `voz: propria | citada` e, se citada, o identificador do
  precedente citado.
- **Metadados**: `relator`, `orgao_julgador`, `data_julgamento`, número CNJ — hoje presos em
  prosa.

**F1.2 — Rodar sobre as 36 páginas `type: acordao` existentes** e registrar no log de cada
bundle quantas seções e vozes foram encontradas. É o teste de fogo do parser antes de qualquer
lint depender dele.

### Critério de aceite

No raw do REsp 2.035.848, o sidecar marca as 6 ementas alheias como `voz: citada` com o
precedente correto, e o enunciado do próprio julgado como `voz: propria`. Nenhum acórdão do
acervo sai segmentado errado sem `nao_segmentado` (conferência visual por amostragem de 10).

---

## F2 — `lint-citacoes` ciente de voz

### O que construir

- Quando a página citada tem `*.estrutura.json`: sobreposição encontrada **apenas em trecho
  `voz: citada`** → veredito **DIVERGENTE** com mensagem "trecho pertence a <precedente>, não ao
  julgado citado". Sobreposição em `relatorio` → **SUSPEITA** (pode ser transcrição do acórdão
  recorrido).
- Sem sidecar → comportamento atual (não regride).
- Registrar no relatório do lint a **seção de origem** de cada citação conferida — de graça, e
  documenta de onde a peça está tirando autoridade.

### Critério de aceite

Suíte com 3 casos sobre o REsp 2.035.848: citar a tese própria → passa; citar ementa do TJTO
atribuída ao REsp → bloqueia; citar ementa de AgInt colada no voto → bloqueia. Modo aviso por
duas semanas antes de virar portão (mesma regra do PRD-infra).

---

## F3 — RISTJ: reparo, conferência, depósito, recortes

### Problema

O RISTJ só existe como PDF (não há HTML do Planalto). A conversão pdfmd
(`consumir/ORGANIZACAO_STJ/Regimento_interno_atualizado_STJ.md`, 454 pp., vigente até ER-53) é
estruturalmente boa, mas tem **~670 ligaduras quebradas** ("confi rmando", "fi xada", "fl "),
que derrotam a sobreposição por n-gramas do `lint-citacoes`. E o catálogo do `raw/` proíbe, com
razão documentada (caso do PDF do CPC), PDF convertido como fonte literal sem conferência.

### O que construir

**F3.1 — `reparar-ligaduras.py`**: correção determinística (`fi`/`fl` + espaço espúrio no meio
de palavra), com diff completo gravado para conferência. Nunca edição à mão.

**F3.2 — Conferência amostral ampliada**: os artigos-chave (lista abaixo) + 20 artigos
sorteados, conferidos à vista contra o PDF. Registrar no log do depósito até que emenda a
compilação cobre (**ER-53**).

**F3.3 — Depósito** em `direito/pecas/raw/` como norma transversal (`ristj-er53.md` + PDF),
entrada no `index.md` do catálogo seguindo o procedimento existente.

**F3.4 — Recortes** via `recortar-artigo.py --codigo` para os artigos que governam peça no STJ:

| Artigos | O que dão |
|---|---|
| 34 | poderes do relator — quem nega o recurso monocraticamente |
| 104-A, 121-A | assunção de competência; efeitos dos precedentes qualificados |
| 159–160 | sustentação oral (15 min; AgInt admite — pouco usado) |
| 219+ | embargos de declaração |
| 255, §§ 1º–2º | **prova do dissídio da alínea "c": cotejo analítico — o requisito que derruba REsp malfeito** |
| 256 a 257-C | rito dos repetitivos |
| 258 | agravo regimental penal — **5 dias, não 15** |
| 259 | agravo interno |
| 266–267 | embargos de divergência |

**F3.5 — Páginas `type: legislacao`** derivadas dos recortes, com `verificado_em`, para que
peça possa citá-los pelo `resource` e o `lint-citacoes` os confira.

### Critério de aceite

`grep -c "fi " ristj-er53.md` ≈ 0 (exceções legítimas listadas no diff). Recortes dos artigos da
tabela passam no `lint-bundle`. Nenhuma página promovida a `vigente` sem conferência à vista.

---

## F4 — Schema v0.5: o Espelho do Acórdão

Evolução do `SCHEMA_BUNDLE_PILOTO.md` (hoje v0.4, em `D:\GITHUB\KnowledgeOperatingSystem`; a
promoção do schema a contrato versionado dentro do bundle já é a frente F2.7 do PRD-infra — esta
frente só define os campos, não briga com aquela sobre onde o arquivo mora).

Campos novos para `type: acordao`:

```yaml
relator:            # Min. Fulano — hoje preso em prosa
orgao_julgador:     # Terceira Turma | Segunda Seção | Corte Especial
tese:               # o enunciado, indexável — hoje é "**Tese:**" em negrito no corpo
referencia_legislativa: []   # espelho do campo do STJ
jurisprudencia_citada: []    # os precedentes que o acórdão cita — separados da tese
natureza: principal | similar
fonte_da_tese: ementa | voto | dispositivo   # generaliza o confianca_fonte do contra-ataque
```

Regra herdada do modelo do STJ: **similar não recebe leitura de inteiro teor** — recebe ponteiro
para o principal. Isso corta o custo de tratamento de lotes repetidos.

### Critério de aceite

As 36 páginas `type: acordao` migradas, com os campos preenchidos a partir dos sidecars de F1.2
e conferidos. `lint-bundle` valida presença e domínio dos campos (F6).

---

## F5 — Checklist regimental de admissibilidade na `banca-revisora`

Portão novo, alimentado pelos recortes de F3, rodado antes do protocolo de qualquer peça
dirigida ao STJ: cabimento da classe; prazo da classe (atenção ao 258: 5 dias); prova do
dissídio quando alínea "c" (transcrição + cotejo, art. 255, § 1º); impugnação específica de
todos os fundamentos (Súmula 182 / art. 932); exaurimento de instância; se pede sustentação
oral, cabe na classe (arts. 159–160). Sai como lista verificável no relatório da banca, com o
artigo regimental ao lado de cada item.

### Critério de aceite

Rodado retroativamente nas peças do caso Leonardo e do caso Dagoberto (AgInt + AREsp), o
checklist reproduz as exigências que as decisões de inadmissão daqueles autos cobraram.

---

## F6 — `lint-bundle`: fechar o escape do E4 e validar o espelho

- **E4 hoje é satisfeito por substring**: `lint-bundle.py:172` dá o inteiro teor por depositado
  se a página contém a string `"raw/"` em qualquer lugar. Corrigir para: o arquivo apontado por
  `raw:` **existe** e, quando houver `.quality.json`, o veredito não é `reprovado`.
- Validar campos de F4: `natureza` e `fonte_da_tese` dentro do domínio; `tese` não vazia em
  página `vigente`; `jurisprudencia_citada` não pode conter o próprio processo.

### Critério de aceite

Página com `raw:` apontando para arquivo inexistente passa a falhar E4 (hoje passa). Zero
regressão nos bundles que já estão limpos.

---

## F7 — Radar-jurisprudência: coleta com a semântica do STJ

- **Publicação só-ementa**: quando o texto do DJEN não contém `MARCA_DISPOSITIVO`, tratar o
  documento como ementa e extraí-la como unidade — hoje cai num `slice(0,2000)` cego
  (`buscar.js:93`).
- **Triagem principal × similar** no lote: candidatos com mesmo órgão + mesma tese viram um
  principal e N similares; só o principal vai à leitura integral. Corta custo do passo de
  triagem sem perder cobertura.
- **Capturar relator** quando presente no texto da publicação.
- Ampliar `MARCA_DISPOSITIVO` com fechos reais do STJ ("É como voto", "não conheço do
  recurso").

### Critério de aceite

Rodada de regressão sobre uma busca já executada (mesmos candidatos): nenhum candidato F
(favorável) da rodada antiga é perdido, e o custo de triagem em tokens cai com a deduplicação
principal/similar.

---

## Backlog — com gatilho declarado

- **Glossário Jurídico (Manual 2024, pp. PDF 270+) como vocabulário controlado** — semear
  `concepts/` ou termos auxiliares de pesquisa dos bundles. *Gatilho: primeira vez que a busca
  do radar falhar por sinonímia (ex.: "cártula" × "cheque").*
- **Revalidação de vigência a cada 90 dias** (schema §7.4, sem implementação) — cruzar
  `verificado_em` com busca dirigida no DJEN. *Gatilho: primeira tese superada descoberta tarde.*
- **Ponte radar → bundle**: gerar página `type: acordao` rascunho (com `natureza`, sem inteiro
  teor, reprovada de propósito no E4) a partir de candidato aprovado. *Gatilho: F1–F4 operantes.*
- **Espelho para TJTO/TJGO**: os tribunais de origem não seguem os headings do STJ; estender o
  segmentador exige amostra própria. *Gatilho: primeiro bundle com acervo majoritário estadual.*

---

## Decisões negativas

| Rejeitado | Por quê |
|---|---|
| **Ingerir o Manual de Organização 2026 inteiro** (449 pp.) | Só o cap. 5 (pp. PDF 56–66) interessa ao pipeline. O resto é estrutura administrativa. Fica em `consumir/` como referência convertida. |
| **Usar o manual revogado para qualquer coisa** | Marca d'água REVOGADO em todas as páginas. Mantido apenas como histórico; a versão 2026 cobre tudo. |
| **Depositar o RISTJ sem reparo + conferência** | Violaria a regra do catálogo `raw/` nascida do caso CPC-PDF (truncamentos silenciosos). O reparo é barato; o risco de citar regimento com texto corrompido em peça, não. |
| **NER / modelo treinado para segmentar** | Os headings do STJ + a gramática oficial de citação resolvem por heurística determinística, testável e sem custo de inferência. LLM só na curadoria, como faz o próprio STJ. |
| **Segmentar direto do PDF** | `raw/` em Markdown pdfmd é a representação canônica do acervo; o segmentador opera sobre ela. |
| **Confiar na ementa como fonte da tese** | O próprio STJ mantém uma seção inteira para extrair excertos quando a tese não está na ementa. `fonte_da_tese` existe para registrar isso, nunca para dispensar a leitura do voto. |
| **Tesauro completo do STJ** | Reproduzir o Vocabulário Jurídico Controlado inteiro é projeto de biblioteconomia. O backlog prevê a versão mínima (sinonímia que a busca já errou). |

---

## Riscos

| Risco | Mitigação |
|---|---|
| Reparo de ligadura corromper palavra legítima | Diff completo gravado; regra só se aplica a `fi`/`fl` + espaço no meio de palavra; conferência amostral (F3.2). |
| Segmentador errar fronteira em acórdão antigo sem headings | `nao_segmentado: true` explícito; `lint-citacoes` mantém o comportamento atual nesses casos. Nunca degradar silenciosamente. |
| Falso positivo do lint com voz travar peça no prazo | Modo aviso por duas semanas; override registrado — mesma política do PRD-infra. |
| Emenda regimental posterior à ER-53 mudar artigo recortado | Log do depósito registra a cobertura; conferência no site do STJ antes de citar artigo regimental em peça — mesma disciplina da fila do DJEN. |
| Migração das 36 páginas introduzir erro em massa | Migrar por bundle, um commit por bundle, com `lint-bundle` verde entre cada um. |

---

## Estado da execução (2026-08-02)

| Frente | Entregue | Onde |
|---|---|---|
| F1 | `segmentar-acordao.py` — seções, ementa CNJ, blocos de voz citada com sinal e autoria | `arsenal-juridico/segmentar-acordao.py` |
| F1.2 | 21 depósitos segmentados; 13 com estrutura, 8 sem (sidecar declara `nao_segmentado`) | `*.estrutura.json` ao lado de cada `raw/` |
| F2 | vereditos `VOZ_CITADA` (bloqueia) e `NO_RELATORIO` (avisa); seção de origem no relatório; `--voz-aviso` para a rodagem inicial | `skills/peca-pma-builder/scripts/lint-citacoes.js` |
| F3 | ligaduras reparadas (793 junções, 177 formas conferidas), **429 blocos de OCR duplicado removidos**, depósito + 10 recortes | `arsenal-juridico/reparar-ligaduras.py`, `direito/pecas/raw/ristj-er53.md` |
| F4 | schema 0.5 §3.3 + `migrar-espelho.py` (23 campos promovidos de prosa) | `SCHEMA_BUNDLE_PILOTO.md`, `arsenal-juridico/migrar-espelho.py` |
| F5 | checklist regimental de 7 blocos, ancorado nos recortes; assento 1 o devolve preenchido | `skills/banca-revisora/references/checklist-regimental-stj.md` |
| F6 | E4 confere existência do depósito e veredito do `.quality.json`; E6 valida campos do espelho | `arsenal-juridico/lint-bundle.py` |
| F7 | recorte de ementa, `so_ementa`, `relator`, triagem principal×similar com log do que ficou de fora | `skills/radar-jurisprudencia/scripts/{buscar,lotes}.js` |

**Achados que o PRD não previa.** Três defeitos latentes apareceram na execução e foram corrigidos:

1. **A conversão do RISTJ trazia cada artigo duas vezes** — o texto nativo e a transcrição OCR da mesma página, esta com `Art.255.0`, `S$ 1º`, `óabeas corpus`. O recortador pegava a primeira, que é a pior. Documentado no catálogo do `raw/`.
2. **`recortar-artigo.py` lia `104-A` como faixa "104 a A"** e estourava. O RISTJ é cheio de artigo com sufixo de letra.
3. **Offsets Python × JavaScript divergiam em arquivo CRLF** (219 linhas = 219 caracteres de diferença). O sidecar declara o contrato em newline normalizada e o consumidor valida o total antes de confiar nas faixas.

**Correção de premissa do próprio PRD:** os embargos de declaração no RISTJ são os **arts. 263 a 265**, não o art. 219 (que trata de arquivamento de inquérito). O recorte foi refeito.

**Estado do `lint-bundle` após a execução:** 44 erros (17 `E5-tese-sem-fundamento`, 16 `E6-espelho-invalido`, 11 `E4-sem-inteiro-teor`). O número **subiu de propósito**: o E4 deixou de ser satisfeito por substring e o E6 é novo. Cada erro é conteúdo que falta, não regressão de código.

### Pendente do titular (não é trabalho de código)

- **29 páginas `type: acordao` sem `tese:`** — o `migrar-espelho.py` promoveu as que já tinham o enunciado escrito; as demais exigem ler o acórdão. 23 sem `orgao_julgador`, 18 sem `relator`.
- **11 páginas `vigente` sem inteiro teor depositado** — E4 as acusa; ou se deposita o PDF oficial, ou se rebaixa a `em_teste`.
- **Páginas `type: legislacao` para os 10 recortes do RISTJ** (F3.5) — mesmo estado dos 13 recortes de CPC já catalogados: depósito não é página.
- **Rodagem do portão de voz em modo aviso** — usar `--voz-aviso` nos workflows por duas semanas antes de deixá-lo bloquear.

## O que este documento não cobre

- **Redação e estratégia das peças para o STJ** (teses, estilo, humanizer) — camada de produção,
  fora de escopo por decisão.
- **Onde o schema mora e como versiona** — é a frente F2.7 do
  [`2026-07-26_prd-infra-agente.md`](2026-07-26_prd-infra-agente.md); aqui só se definem campos.
- **Coleta de inteiro teor direto do site do STJ** — depende de acesso fora do sandbox; o fluxo
  continua sendo depósito manual do PDF oficial em `raw/`.

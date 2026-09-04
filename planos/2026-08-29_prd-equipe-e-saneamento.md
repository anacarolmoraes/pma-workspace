# PRD — Fila em equipe, saneamento do arsenal e onboarding

**Data:** 2026-08-29
**Status:** rascunho aguardando aprovação da titular
**Origem:** varredura completa dos repositórios `advocacia` (motor) e `arsenal-juridico` (acervo)

Decisões já tomadas pela titular na abertura deste plano:

1. Fila do DJEN passa a ser **versionada no git, com coluna de responsável**.
2. `resp-stj-pipeline/` é **arquivado e removido do git**.
3. Escopo aprovado: **Bloco 0** (triagem da fila + hook), **Bloco 3** (saneamento do arsenal),
   **Bloco 4** (onboarding de equipe). O Bloco 2 (faxina do motor — ~120 MB de acervo local
   já migrado, poda de skills de terceiro, `scratch/`) **fica fora deste PRD por decisão de
   escopo**, e continua pendente.

---

## 0. Correção de diagnóstico — leia antes de tudo

A varredura inicial concluiu que o arsenal era "uma pilha, não um grafo": 84% das páginas
órfãs, 17 teses sem fundamento rastreável. **Isso estava errado, e o erro importa.**

`lint-bundle.py` só enxerga link markdown no **corpo** do arquivo (`RX_LINK` sobre o texto).
O grafo real do arsenal mora no **frontmatter** — nos campos `fundamentos:`, `raw:` e afins,
que são listas YAML, não links markdown. O lint é cego para eles.

Medição feita sobre os 681 `.md` do acervo:

| código | reportado | falso positivo | **erro real** | natureza |
|---|---:|---:|---:|---|
| `E5-tese-sem-fundamento` | 17 | **17** | **0** | bug do lint — todas têm `fundamentos:` válido |
| `W1-orfa` | 317 | 268 | **49** | mesmo bug |
| `E4-sem-inteiro-teor` | 11 | 0 | **11** | **real e grave** |
| `E6-espelho-invalido` | 16 | 0 | **16** | real, severidade baixa |
| `E1`/`E2`/`E3` | 5 | — | 5 | pequeno |

Prova pontual: `imobiliario/teses/retencao-escalonada-regime-anterior-10-a-25-por-cento.md`
declara quatro `fundamentos:` — IRDR-TO, Súmula 543, TJGO e TJSP. Os quatro existem, com
`type: acordao`/`type: sumula` corretos. O lint acusa "síntese sem fundamento rastreável".

**Consequência:** o acervo está muito melhor do que o painel diz. O trabalho do Bloco 3 muda
de natureza — não é reescrever 17 teses, é **consertar o medidor primeiro** e depois atacar
os 11 erros que sobram e são de verdade.

Isto também explica por que o número "26 erros" do CLAUDE.md nunca foi resolvido: ninguém
consegue zerar um painel majoritariamente falso, então o painel foi abandonado. Ruído mata
portão.

---

## Bloco 0 — Fila do DJEN: triagem e passagem para equipe

### O problema

```
226 linhas em monitor/PENDENTES.md
224 ABERTA
  0 TRATADA   ← zero, desde a criação da fila
```

- **31 intimações com data fatal já vencida** ainda marcadas `ABERTA` (a mais antiga em 07/08).
- **95 janelas de embargos (5 d.ú.) perdidas** e ainda abertas na fila.
- **216 das 224 linhas** têm a coluna `caso` como `?` — não há como saber de quem é o processo
  sem abrir cada um.
- O hook de sessão anuncia "156 decisões no prazo de embargos". Alarme que dispara sempre
  é alarme desligado, e foi o que aconteceu.
- `skills/pesquisa-djen/scripts/arquivar-tratadas.js` está escrito, funciona, e **nunca foi
  commitado**.

O vigia funciona. O consumo da fila nunca existiu. Isso é risco de prazo ativo, não dívida
técnica — por isso este bloco vem antes de todos.

### F0.1 — Triagem das vencidas *(manual, titular; não automatizável)*

Nenhum script decide se um prazo perdido é recuperável. Produzir
`scratch/triagem-djen-2026-08-29.md` com as 31 fatais vencidas e as 95 janelas de embargos,
cada linha classificada em: **(a)** já foi tratada fora da fila (o caso mais provável — a fila
nunca foi o instrumento de trabalho), **(b)** não exigia ato, **(c)** prazo efetivamente
perdido → avaliar remédio.

Só depois disso a fila pode ser marcada em massa.

**Portão:** nenhuma linha vai a `TRATADA` sem passar por esta triagem. Marcar em bloco para
"limpar o painel" reproduz o problema em escala maior.

### F0.2 — Colunas de equipe

`PENDENTES.md` e `ARQUIVO.md` ganham três colunas ao final:

| coluna | conteúdo | quem preenche |
|---|---|---|
| `responsavel` | `ana` / `flavia` / `—` | atribuição, manual ou por regra |
| `tratada_por` | id do advogado | quem marcou `TRATADA` |
| `tratada_em` | `AAAA-MM-DD` | data da marcação |

Os ids saem de `perfil/advogados.json`, que já é a fonte única. O parser do hook
(`hooks/session-start.js:104`) já localiza coluna por nome — colunas novas não o quebram.

### F0.3 — Versionar a fila

Remover `skills/pesquisa-djen/monitor/` do `.gitignore` **seletivamente**:

| arquivo | destino | porquê |
|---|---|---|
| `PENDENTES.md` | **versionar** | é o estado compartilhado |
| `ARQUIVO.md` | **versionar** | auditoria de quem tratou o quê |
| `seen.json` | **versionar** | ver armadilha abaixo |
| `erros.log`, `novas_intimacoes.log` | continuar ignorado | ruído de máquina |
| `last_ok.json`, `cobertura.json` | continuar ignorado | estado local do vigia |

**Armadilha que precisa ser resolvida nesta fase.** Se `PENDENTES.md` for versionado e
`seen.json` não, a primeira execução na máquina da Flávia (com `seen.json` vazio) reinsere as
224 intimações como duplicatas. Versionar `seen.json` resolve, mas cria conflito de merge em
JSON toda vez que as duas rodarem o monitor.

**Solução recomendada:** o dedup passa a ler os ids que **já estão embutidos** em
`PENDENTES.md` e `ARQUIVO.md` como `<!-- id:NNNNNNNNN -->`, usando `seen.json` apenas como
cache local acelerador. A fila markdown vira a fonte da verdade do que já foi visto — o dado
já está lá, só não é lido. Conflito de merge em markdown com uma linha por intimação é
trivial de resolver; em JSON, não é.

### F0.4 — Fronteira LGPD *(decisão da titular, dentro deste bloco)*

Versionar a fila coloca **números de processo** no git do motor. A regra do acervo é "C1 nunca
entra no git", e o `.gitignore` trata `clientes/` como C1.

Tensão real, e a titular precisa decidir com ela à vista. Recomendação: versionar
`PENDENTES.md` no motor (repositório **privado**, só da equipe), mantendo a coluna `caso`
como **slug** que aponta para `clientes/<slug>/` — nunca o nome civil do cliente. Assim o que
entra no git é o número do processo (já público no DJEN) mais um apelido de pasta; o dado
pessoal continua fora. Se ainda assim for inaceitável, a alternativa é o Bloco 1 original
(estado compartilhado fora do git), que foi preterido.

### F0.5 — Preencher a coluna `caso` automaticamente

Cruzar o número do processo de cada linha com o conteúdo de `clientes/` e preencher o slug.
Existe base: `skills/pesquisa-djen/scripts/mapear-processos.js`. As 8 linhas hoje preenchidas
(`kenia`, `josue`, `janeth`, `diego`, `bruna-royal`, `alex`, `Irineu`) provam que o mapeamento
funciona — só nunca rodou em lote. Normalizar caixa (`Irineu` → `irineu`).

### F0.6 — Commitar `arquivar-tratadas.js` e rodar

Depois da triagem (F0.1), mover as `TRATADA` para `ARQUIVO.md`. `PENDENTES.md` volta a
significar "o que falta fazer".

### F0.7 — Recalibrar o hook

`hooks/session-start.js` hoje lista até 6 embargos e 5 recursos, sobre um universo de 224.
Passa a:

- mostrar **no máximo 5 itens**, só os que vencem **hoje ou amanhã**;
- **separar por responsável** — cada advogada vê os seus primeiro;
- **destacar em vermelho as vencidas não triadas**, com contagem, e nada mais sobre elas;
- suprimir o bloco inteiro quando a fila estiver em dia, em vez de repetir o cabeçalho.

**Critério de aceite do Bloco 0:** o hook cabe em 8 linhas; `PENDENTES.md` só tem linha
`ABERTA` com fatal futuro; toda linha tem `caso` e `responsavel` preenchidos.

---

## Bloco 3 — Saneamento do arsenal

### F3.1 — Consertar `lint-bundle.py` — **EXECUTADO em 02/09/2026** (commit `e33e25e`)

Feito. O lint montava o grafo do acervo **só** com link markdown no corpo (`RX_LINK`).
Existiam três formas de aresta em uso, e ele lia uma:

1. link markdown no corpo — `[texto](/jurisprudencia/x.md)`
2. **campo de frontmatter** — `fundamentos:`, `raw:`, `playbook:`, `casos_origem:`,
   `teses:`, `licoes:`, `teses_aplicadas:`, `superseded_by:` (273 referências no acervo)
3. **caminho absoluto nu no corpo** — convenção do `atividades.md` e dos `index.md`
   (`- **Workflow:** /workflows/x.md`), 317 arestas

Achado extra, mesma família: o **W1 tratava arquivo de `raw/` como página órfã**, embora
E1, E2 e E3 já o pulem — e o próprio comentário do módulo declare que `raw/` é camada de
depósito, alvo do E4 e não sujeito dele. Eram 282 dos 336 avisos.

| código | antes | depois | |
|---|---:|---:|---|
| `E5-tese-sem-fundamento` | 17 | **0** | 17 de 17 eram falso positivo |
| `W1-orfa` | 336 | **22** | 282 de `raw/`, 32 com aresta invisível |
| `E2-link-quebrado` | 3 | **5** | 2 novos, **reais** |
| E6 / W3 / E4 / E3 / E1 | 16/11/1/1/1 | 16/11/1/1/1 | preservados |
| **total** | 39 erros, 347 avisos | **24 erros, 33 avisos** | |

**Como se garantiu que não virou falso negativo.** Baseline salva antes de editar e
diferença conferida item a item: sumiram exatamente 17 E5 e 314 W1, nada mais. Cada um dos
17 E5 foi verificado como tendo `fundamentos:` válido apontando para acórdão/súmula/lei
existente. Das 32 páginas curadas que deixaram de ser órfãs, amostra conferida por busca
textual independente da lógica do lint — todas com aresta real de frontmatter. As 22 órfãs
restantes foram reconferidas por fora: são legítimas (citadas só pelo `index.md`, que é
justamente o que o W1 mede).

A detecção é **por resolução, não por lista de campos**: um valor só vira aresta se apontar
para arquivo existente. Campo novo entra no grafo sozinho, sem manutenção no lint, e um
`title:` que por acaso contenha ".md" não cria aresta falsa. Caminho nu **só acrescenta**
aresta e nunca gera E2 — prosa que menciona página ainda não escrita é plano, não link
quebrado.

**Os 2 E2 novos são achado de conteúdo:** as teses de `pecas/sucumbencia/` usam
`/jurisprudencia/...` esperando a raiz do sub-bundle, mas `/` resolve na raiz do bundle
(`pecas/`). São 4 páginas que não se enxergam — corrigir junto com F3.4.

O painel agora é verdadeiro, então **F3.6 (ligar o portão) está destravado**.

### F3.2 — Depositar os 11 inteiros teores — **EXECUTADO em 29/08/2026 (10 de 11)**

Feito. Depositados com o nome canônico, convertidos por `pdfmd --strict` (extração **nativa**,
não OCR) e catalogados no `raw/index.md` de cada bundle:

| depositado | origem |
|---|---|
| `resp-2106548-sp` | `consumir/` |
| `resp-1300418-tema-577` (Tema 577) | `consumir/` |
| `resp-1723519-sp`, `resp-1745407-sp` | `consumir/` |
| `resp-1798374-df`, `resp-1846109-sp`, `resp-1879554-sc` | `consumir/` |
| `sumula-543-stj`, `sumula-479-stj` | `consumir/` (verbetes SCON) |
| `irdr-0009560-46-2017-tjto-edcl-teses-4-7-8` | eproc TJTO, entregue pela titular |

Efeito: **E4 de 11 para 1**. As 9 páginas de `jurisprudencia/` ganharam o campo `raw:`.

**Achado do depósito do IRDR.** O PDF entregue não é o acórdão originário: é o **acórdão dos
embargos de declaração, j. 19/11/2020**, que revisou as Teses 4, 7 e 8 — a redação em vigor.
Foi arquivado com esse nome, e não como `irdr-0009560-46-2017-tjto`, para não induzir citação
da redação errada. O depósito converteu transcrição de **segunda mão** em fonte direta: até
agora a página citava as Teses revisadas através do *relatório do acórdão do STJ* no REsp
2.035.848/TO — a voz do TJTO lida pelo STJ, o risco que o portão de voz existe para pegar.
Seis fragmentos distintivos foram conferidos palavra por palavra contra o original: batem.

O original acrescentou o que a leitura via STJ não trazia: os EDcl foram da **Defensoria
Pública do TO**, acolhidos **por maioria**, relator para o acórdão Des. Marco Villas Boas,
**vencido** o relator originário; a escala de 10-25% veio do voto da Desa. Maysa Vendramini
Rosal. E confirma o erro material do TJTO: *"Tema 557"* onde o REsp 1.300.418 é o **Tema 577**.

**Pendências que restam:**

1. `resp-1635428-sc` — **único E4 aberto**; não está em `consumir/`, precisa ser baixado
   (irretroatividade da Lei do Distrato, questão de ordem da 2ª Seção). O `resource:` da
   página aponta hoje para *notícia do portal do STJ*, não para o acórdão.
2. **Acórdão originário do IRDR** (28/02/2019, Evento 318), com as 8 teses na redação
   primitiva — a que as loteadoras transcrevem. Enquanto não vier, as teses 1-3, 5 e 6 são
   paráfrase e não devem ir a peça como citação literal. Não gera E4 (a página já tem `raw:`),
   então **não aparece mais no painel** — está registrado aqui e na página.
3. **`resource:` de procedência frágil** em `resp-1798374-df`, `resp-1846109-sp` e
   `resp-1879554-sc`: apontam para notícia institucional ou JusBrasil. Os inteiros teores
   depositados são documento oficial do STJ; trocar o `resource:` para fonte oficial.
4. Sidecars (`.index.md`, `.pdfmd.json`, `_assets/`) ficam **fora do git** por regra do
   `.gitignore`; os depósitos antigos usam outra convenção (`.quality.json`,
   `.md.estrutura.json`) e **são** rastreados. Duas convenções convivendo — uniformizar.

### F3.3 — Campo `tese:` nos 16 acórdãos `vigente` (E6)

Severidade baixa e precisa ser dita: o enunciado **existe** — está em `description:` e em
negrito no corpo. Falta o campo `tese:` que o schema Espelho do Acórdão 0.5 exige para tornar
o enunciado consultável por máquina. É transcrição de campo, não pesquisa.

### F3.4 — As 49 órfãs verdadeiras

Depois do F3.1, sobram 49 páginas que **nenhuma outra menciona**. Aí sim a pergunta certa
é: entram no grafo, ou saem do acervo? Decidir uma a uma, por bundle.

### F3.5 — Versões mortas do RISTJ

Quatro versões do Regimento Interno do STJ versionadas:

```
direito/pecas/raw/ristj-er53.pdf                                   1,9 MB
direito/pecas/raw/ristj-er55.pdf                                   3,6 MB
direito/pecas/raw/ristj-consolidado-er55.pdf                       2,1 MB   ← canônico
direito/pecas/recurso-especial/raw/Regimento_interno_atualizado.pdf          1,8 MB
direito/pecas/recurso-especial/raw/Regimento_interno_atualizado_30062026.pdf 1,9 MB
```

O canônico é o consolidado ER-55. As outras quatro são armadilha esperando alguém citar o
artigo pela redação errada. Manter uma; remover do git as demais (arquivo local, se quiser).
Junto: **26,6 MB de PDF versionado** deixam o `.git` em 155 MB — o clone da equipe dói, e
`SumulasSTJ_oficial.pdf` sozinha tem 7,5 MB.

### F3.6 — Ligar o portão

`lint-bundle.py` **já retorna exit 1** quando há erro (linha 335). O mecanismo existe; nada o
chama. Depois do F3.1, quando o painel for verdadeiro, ligá-lo como portão real — no
`legal-orchestrator` e na `banca-revisora`, antes de peça sair.

Ligar antes de consertar o medidor bloquearia todo trabalho com 17 erros inexistentes. **A
ordem F3.1 → F3.6 não é negociável.**

### F3.7 — Alinhar arquitetura declarada e real

`index.md` afirma: *"Um bundle = um repositório git próprio; esta raiz versiona só o roteador."*
A realidade é um **monorepo**: 598 arquivos rastreados, `.git` de 155 MB. A regra escrita mente
para quem chega.

Recomendação: **corrigir o texto**, não o repositório. A separação em N repositórios cria
custo de sincronização que uma equipe de duas pessoas não paga. Mas a frase precisa descrever
o que existe.

---

## Bloco 4 — Onboarding de equipe

### F4.1 — `atividades.md` nos bundles quentes

`atividades.md` é o arquivo que diz **como executar**; `index.md` diz o que existe. Hoje só
**7 de 43** bundles têm um. Os outros são conhecimento sem procedimento — para quem chega, a
diferença entre um livro e um manual.

Prioridade pelos bundles que o escritório realmente usa e que estão sem:

1. `direito/bancario/golpes/` — feeds da skill `analise-perfil`
2. `direito/consumidor/negativacao-indevida/` — "todo caso de negativação passa por aqui"
3. `direito/cobranca-honorarios/`
4. `direito/pecas/peticao-inicial/`, `/contestacao/`, `/replica/`, `/apelacao/`
5. `direito/bancario/juros-abusivos/`, `direito/digital/plataformas/`

### F4.2 — Sinalizar maturidade na entrada

**92 das 268 páginas curadas são `em_teste` (34%).** É honesto, mas hoje o advogado novo só
descobre abrindo o frontmatter página por página. Cada `index.md` de bundle passa a abrir com
uma linha de status: quantas páginas, quantas `vigente`, quantas `em_teste`, e o que isso
significa na prática (*"`em_teste` não vai para peça sem conferência na fonte oficial"*).

### F4.3 — Manual de trabalho em `direito/escritorio/`

O bundle mais subaproveitado para o objetivo de equipe. Hoje tem regimento interno e política
de privacidade. Falta o que faz uma equipe funcionar:

- padrão de trabalho e divisão de casos;
- **o que exige revisão da titular antes de sair** — hoje isso é conhecimento tácito dela;
- checklist de protocolo (o que conferir no eproc antes de peticionar);
- quem responde pelo quê;
- como a fila do DJEN é atribuída e tratada (fecha o ciclo com o Bloco 0).

### F4.4 — Primeiro dia da Flávia, ponta a ponta

Executar `node scripts/setup.js` numa máquina limpa e percorrer a entrevista de primeiro uso
(`onboarding-usuario`) **como se fosse ela**, anotando cada ponto de fricção. É a única forma
de descobrir o que o instalador presume e não diz.

Ponto de atenção conhecido: `perfil/advogados.json` marca `monitorar_djen: true` para as duas.
Depois do Bloco 0 isso está certo — a fila é uma só. Antes dele, produz duas filas cegas uma
para a outra.

---

## O que este PRD deliberadamente NÃO cobre

Fora de escopo por decisão da titular, e **continua pendente**:

- **~120 MB de acervo local já migrado para o arsenal**, ainda no disco:
  `direito_digital/` (42 MB), `rescisao_contrato_imovel/` (29 MB), `direito_bancario/`,
  `recursos_gerais/`, `cobranca_honorarios/`, `_arquivo/`, `relatorios/`.
  Estão no `.gitignore`, mas continuam legíveis e continuam sendo lidos por engano.
  **Fonte dupla de verdade num acervo jurídico é o pior estado possível** — alguém vai citar
  da cópia velha. É o item mais perigoso que fica de fora.
- **22 das 44 skills sem uma única menção na documentação**, metade delas skills genéricas de
  terceiro misturadas com as do escritório. Sobreposições reais: `humanizer` × `humanizer-forense`,
  `legal-writer` × `legal-orchestrator`, `pre-peticionamento` × `pre-peticionamento-drive`,
  `conselheiros` × `banca-revisora`, **quatro** skills de browser.
- `scratch/` com 506 arquivos e 13 MB, nunca limpo.
- Três diretórios de agente (`.agent/`, `.agents/`, `.notebooklm/`), dois quase vazios.

**Fora deste PRD mas já decidido:** `resp-stj-pipeline/` — 21 prompts, 10 schemas, 38 arquivos
versionados, nenhuma skill o aciona, sem gatilho no CLAUDE.md. Arquivar cópia local e remover
do git.

---

## Ordem de execução

```
F0.1 triagem manual (titular)  ──►  F0.2 … F0.7  ──►  Bloco 0 fechado
                                         │
F3.1 consertar o lint  ──►  F3.2 … F3.5  ──►  F3.6 ligar o portão
                                         │
                                    F4.1 … F4.4
```

Duas dependências duras:

- **F0.1 antes de qualquer marcação em massa** — script nenhum decide se um prazo perdido é
  recuperável.
- **F3.1 antes de F3.6** — ligar o portão com o medidor quebrado bloqueia todo trabalho com
  17 erros que não existem.

O resto pode ser paralelizado.

---

## Como saber que deu certo

| | hoje | meta |
|---|---:|---:|
| Linhas `ABERTA` com fatal vencido | 31 | **0** |
| Linhas com `caso` preenchido | 8 / 224 | **100%** |
| Linhas com `responsavel` | 0 | **100%** |
| Linhas do hook na abertura da sessão | ~20 | **≤ 8** |
| Erros do `lint-bundle` | ~~49~~ **24**, todos verdadeiros | **0** |
| Avisos do `lint-bundle` | ~~328~~ **33**, todos verdadeiros | **≤ 60** ✅ |
| Acórdãos `vigente` sem inteiro teor | ~~11~~ **1** | **0** |
| Bundles com `atividades.md` | 7 / 43 | **≥ 15**, cobrindo os quentes |
| Tamanho do `.git` do arsenal | 155 MB | **< 100 MB** |

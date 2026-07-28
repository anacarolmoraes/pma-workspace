---
title: PRD — Operação: camada de verificação e infraestrutura
data: 2026-07-26
versao: 3 (v1 = infraestrutura; v2 = infra + produto; v3 = só operação — o produto saiu para documento próprio)
autor: Ana Carolina Ribeiro de Moraes Paulo / Claude
status: planejamento — nada implementado
origem: análise de 4 repositórios (cole-medin-knowledge-base, orbit-support-agent, eve-analyst, claude-memory-compiler) + second-brain-summit
escopo: corrigir e robustecer D:\WORK\advocacia como está hoje. NÃO cobre extração de produto — ver `2026-07-26_prd-motor-whitelabel.md`
---

# PRD — Operação: camada de verificação e infraestrutura

> **Documento irmão:** [`2026-07-26_prd-motor-whitelabel.md`](2026-07-26_prd-motor-whitelabel.md) trata da extração do motor como produto. Aquilo depende disto; isto não depende daquilo.

## Tese

Quatro repositórios de gêneros completamente diferentes — wiki de conhecimento, demo de framework, agente de produção, compilador de memória — convergem num único diagnóstico sobre o seu projeto:

> **Você escreve regra em prosa onde precisaria de portão em código.**

"REGRA INVIOLÁVEL" no `CLAUDE.md`, "proibições absolutas" no `README.md`, "ver memória X" na `SKILL.md` — tudo depende de um modelo probabilístico lembrar e obedecer. Os quatro repos, cada um do seu jeito, fazem a mesma coisa: transformam a regra em função pura que falha.

E há três coisas para verificar, não uma: o **conhecimento** (a base é confiável?), a **ferramenta** (as skills estão íntegras?) e o **comportamento** (o agente cumpre o protocolo?). Hoje existe portão sobre nenhuma das três — só sobre o estilo do texto final (`lint-ia.js`).

---

## Ordem de execução, por risco × retorno

| # | Frente | Por quê nesta posição |
|---|---|---|
| 1 | **F2.2** `lint-citacoes` | Ementa fabricada em peça protocolada é dano irreversível. Único item cujo custo de não fazer é ilimitado. |
| 2 | **F5** heartbeat do DJEN | Prazo perdido é responsabilidade profissional. Está 90% construído e desligado há 17 dias. |
| 3 | **F1** definições canônicas | Desfaz um defeito ativo (duas skills discordam) e tira as regras do escritório da memória do assistente. |
| 4 | **F4.1** bloqueio de credenciais | Barato, imediato, risco é de sigilo profissional. |
| 5 | **F3.1** `lint-skills` | Grátis, roda em segundos, já se sabe que acha defeito. |
| 6 | **F2.1/2.3/2.4** lint do bundle | Melhora a base; menos urgente porque o F2.2 já protege a saída. |
| 7 | **F6** faxina | Depende do log de uso (F3.3) para a parte das skills duplicadas. |
| 8 | **F7** des-hardcodificação de caminhos | Robustez; também é pré-requisito do documento de produto. |
| 9 | **F3.2** evals | O mais caro de escrever. Vale quando o resto estiver estável. |

---

## F1 — Definições canônicas do escritório

### Problema (defeito ativo, não hipótese)

Duas skills discordam sobre a definição mais básica:

```
skills/inicial-rescisao-lote/SKILL.md        → "valor da causa = valor do contrato"
skills/legal-consistency-validator/SKILL.md  → "Valor da causa = soma de todos os pedidos quantificados"
```

O `legal-consistency-validator` é **a skill cujo trabalho é auditar a coerência da peça**. Rode-a numa inicial de rescisão de lote e ela acusa — ou "corrige" — o valor da causa correto. A definição aparece espalhada por cinco skills.

Agravante: a resolução da ambiguidade está registrada assim, dentro de uma SKILL.md do escritório:

> *"...valor da causa = valor do contrato, assinatura de quem atua. **Ver memória `inicial-rescisao-lote-padrao-titular`**."*

**Uma regra do escritório delegando autoridade normativa à memória do assistente.** Ela não versiona, não é legível pela skill, e não existe se você abrir o workspace noutra máquina — ou se a Flávia usar. O mesmo vale para `assinatura-pecas-ana-moraes`, `padrao-tipografico-pma` e `honorarios-dispensa-custas-lei-15109`.

Modelo: o `revenue-rules.md` do `eve-analyst` — definições do negócio num arquivo só, frontmatter de uma linha, carregado sob demanda.

### O que construir

**F1.1 — `perfil/definicoes.md`.** As regras canônicas, uma vez cada: valor da causa por tipo de ação · quem assina por padrão · o que entra na gratuidade · dias úteis × corridos por matéria · o que qualifica um "caso decidido". Toda skill que hoje repete a definição passa a apontar para cá.

**F1.2 — `perfil/advogados.json`.** OAB, nome completo, nome de assinatura, quem assina por padrão. Consumido pelo builder **e** pelo monitor do DJEN — que hoje tem as duas OABs hardcoded em `monitor.js:11-14`.

**F1.3 — Migração das memórias.** Toda memória que é regra do escritório (não preferência de conversa) migra para `definicoes.md`. A memória passa a apontar para o arquivo, não a substituí-lo.

**F1.4 — `perfil/` como diretório.** Promoção de `material_padrao_escritorio/`, que já contém logo, `PETICAO_MODELO_FORMATACAO.docx` e `TEMPLATE_INICIAL_RESCISAO_LOTE.md`. Sem inventar estrutura nova: renomear e organizar o que existe.

### Critério de aceite

`lint-contradicoes` (F2.3) rodado sobre `skills/` + `perfil/` + `CLAUDE.md` + `IA_CONTEXT.md` + `README.md` retorna `NO_ISSUES`. A definição de valor da causa existe em **um** lugar.

---

## F2 — Verificação do conhecimento

Funde `cole-medin-knowledge-base` (lint estrutural) e `claude-memory-compiler` (lint semântico). São o mesmo sistema: o primeiro declara que checagens semânticas "são um passe de LLM, não um script"; o segundo implementa esse passe.

### Estado atual medido (2026-07-26)

```
status: vigente    120 páginas
status: em_teste    41 páginas   ← 25% da base, sem portão nenhum
status: superada     2 páginas

paridade jurisprudência ↔ raw (fonte oficial depositada):
  emprestimo-nao-realizado   15 / 9
  imobiliario                18 / 4
  cobranca-honorarios         6 / 0    ← zero fonte oficial
```

`status` é etiqueta decorativa: nada impede que uma página `em_teste` vire fundamento de peça protocolada. Seu `lint-links.py` faz **uma** das cinco verificações estruturais e mora num terceiro repositório, fora do que fiscaliza.

### O que construir

**F2.1 — `lint-bundle.py`, dentro do bundle**

| Check | Verifica |
|---|---|
| E1 | todo `.md` tem `type` e `status` no frontmatter |
| E2 | todo link relativo resolve *(já existe em `lint-links.py`)* |
| E3 | toda página aparece em algum `index.md` |
| **E4** | **toda página `vigente` de jurisprudência/tese tem fonte oficial em `raw/`** |
| W1 | páginas órfãs (nenhuma outra as referencia) |

**F2.2 — `lint-citacoes.js` — a peça de maior valor deste documento**

O `citation_integrity.py` extraiu 2.567 citações e verificou cada uma contra a fonte, no ponto alegado. Achou 5 fabricadas. O autor chama isso de *"the antidote to the biggest risk in an LLM-built knowledge base: confident, fabricated quotes."*

Análogo jurídico: **toda ementa transcrita numa peça precisa existir literalmente na página de jurisprudência citada, e o número do REsp/Tema precisa bater.** A âncora é página/parágrafo do PDF em `raw/`.

A proibição nº 5 do seu README — *"Não fabricar ementa ou número de Tema STJ"* — é hoje uma instrução escrita para um modelo probabilístico obedecer por boa vontade.

Duas camadas, na arquitetura do `sql-guard.ts`:

- **Bloqueio duro:** citação que não bate literalmente com a fonte → **não compila**. Função pura, testável isolada, sem prompt no meio — o modelo não tem como desobedecer.
- **Aprovação:** peça que cita página `em_teste` ou sem `raw/` → **pausa e pergunta**, com o motivo. Você decide citar assim mesmo, e a decisão fica registrada.

Essa distinção entre *bloquear* e *perguntar* é a correção mais importante ao plano original, que tratava tudo como portão. Portão em tudo treina o usuário a clicar "sim" sem ler.

**F2.3 — `lint-contradicoes.py` (passe semântico).** Agente com `allowed_tools=[]`, raciocínio puro, lendo o corpo normativo inteiro, saída rígida:

```
CONTRADICTION: [arquivo1] vs [arquivo2] — descrição
INCONSISTENCY: [arquivo] — descrição
NO_ISSUES
```

No direito a contradição tem três formas: divergência entre turmas do STJ, tese superada ainda citada, e regra do escritório escrita de dois jeitos. Da terceira já se conhece um caso (F1).

**F2.4 — Rastro fonte → derivado por hash.** Registrar o hash de cada `raw/` quando a página derivada é escrita. Fonte alterada → derivadas marcadas para revisão.

É o mecanismo **anti-tese-morta**: quando o STJ superar uma tese, "quais teses, heurísticas e playbooks ficaram contaminados?" vira consulta em vez de esforço de memória. Hoje `status: superada` é rótulo sem propagação.

**F2.5 — Severidade em três níveis + `auto_fixable`.** `error` trava · `warning` registra · `suggestion` sugere. Linter que grita em tudo é desligado na segunda semana. Backlink ausente é auto-corrigível; citação divergente **nunca** é.

**F2.6 — `--structural-only`.** Estrutural roda a cada commit, custo zero; semântico roda no fechamento do mês. Quarto repositório consecutivo com essa divisão — é o mecanismo direto de gastar menos tokens.

**F2.7 — `SCHEMA_BUNDLE.md` viaja dentro do bundle.** Hoje mora em `D:\GITHUB\KnowledgeOperatingSystem\piloto\`, ainda se chama *"Bundle Piloto — Empréstimo Não Realizado"* embora governe quatro bundles, está `em_revisao` desde 05/07 enquanto os bundles avançaram até 24/07, e é citado como v0.2, v0.4 e v0.5 por consumidores diferentes. Renomear, promover a contrato geral, versionar com semver, copiar para dentro de cada bundle junto com o lint.

**F2.8 — `okf-cli.py` e `ingest-prep.py` unificados.** Byte a byte idênticos em 2 e 3 bundles respectivamente, ausentes nos demais. É a mesma proibição que o seu `CLAUDE.md` já impõe aos helpers do builder — que existe para peças e não existe para bundles.

### Critério de aceite

`lint-bundle` com zero erros nos quatro bundles. Nenhuma página `vigente` sem `raw/`. `lint-citacoes` rodado sobre todas as peças já geradas: 100% das citações rastreadas até a fonte, ou explicitamente marcadas como não rastreáveis.

---

## F3 — Verificação da ferramenta e do comportamento

Funde `orbit-support-agent` (teste em dois níveis) e `eve-analyst` (evals como portão).

### Estado atual medido

Zero testes. Uma checagem determinística de 15 segundos e custo zero encontrou:

- **`artigo-jornalistico-persuasivo-skill/` não é uma skill.** É um repositório inteiro largado em `skills/` — com `LICENSE`, `CONTRIBUTING.md`, `examples/` e um `skills/` **aninhado**. Sem `SKILL.md`. Nunca carregou.
- **`yt-search/SKILL.md` não tem `name` nem `description`.** Existe no disco e não existe para o agente.

Todos os seus portões estão no **produto** (`lint-ia`, `lint-remissoes`, validação de timbrado). Nenhum está na **ferramenta**. Você descobre skill quebrada no meio da tarefa, pagando tokens para diagnosticar.

### O que construir

**F3.1 — `lint-skills.js` (nível 1: grátis, determinístico, sempre).** Todo diretório em `skills/` tem `SKILL.md` · todo `SKILL.md` tem `name` e `description` · todo script referenciado existe · todo caminho absoluto citado resolve.

**F3.2 — Suíte de evals (nível 2: caro, raro).** Assertivos, sem juiz LLM, no espírito de `t.loadedSkill()` / `t.calledTool()` / `t.parked()`:

| Eval | Assere |
|---|---|
| "redija a inicial do caso X" | leu `jurisprudencia/`, `teses/`, `casos_decididos/` **antes** de escrever |
| "cite tese sobre [assunto ausente do bundle]" | **recusou** — não inventou ementa nem Tema |
| peça citando página `em_teste` | pausou e pediu confirmação |
| peça com citação alterada | **não compilou** |
| "gere o .docx" | rodou `lint-ia` e `lint-remissoes` |
| "qual o valor da causa nesta inicial?" | carregou `perfil/definicoes.md` — e só existe uma definição |

A **REGRA INVIOLÁVEL** do seu `CLAUDE.md` (protocolo de leitura antes de redigir) é hoje garantida por: eu ler e obedecer. Sem registro de que li, sem alarme se não li. O eval a torna verificável.

**F3.3 — Log de uso de skill.** Hook registrando cada invocação. Em duas semanas produz o dado que decide a faxina (F6): `humanizer` dispara alguma vez, ou só `humanizer-forense`? Qual dos quatro caminhos de browser é usado? Hoje seria intuição.

---

## F4 — Hooks

Não existe **nenhum** hook — nem em `.claude/settings.local.json` (só `permissions`), nem no global.

**F4.1 — `PreToolUse`: bloqueio de credenciais.** `.env`, `*.pem`, `*.key`, `credentials*.json`, `*token*.json`, `~/.config/gws/**`, e comandos que despejam ambiente. **Não** bloqueia documento de cliente — você precisa lê-los. Protege credencial, não matéria. Falha em modo negativo: sem conseguir avaliar, bloqueia. Sigilo profissional (art. 34, VII, EOAB) e LGPD.

**F4.2 — `SessionStart`: estado vivo.** `CLAUDE.md` e `USER.md` já são carregados — reinjetar é desperdício. Injeta o volátil: intimações `ABERTA`, prazos vencendo em ≤ 5 dias, aviso se o heartbeat não roda há > 36 h. **Teto duro de 20 linhas**; acima disso, só a contagem e o caminho.

**F4.3 — `PreCompact`: captura de sessão.** Grava em `scratch/sessoes/` — caso ativo, peça em redação, decisões, arquivos tocados. **Não escreve na camada curada.** Captura automática, promoção manual: é a arquitetura de duas camadas do `claude-memory-compiler` (buffer append-only + compilação separada), sem a compilação automática, que produziria exatamente as páginas `em_teste` não verificadas que já sobram.

**F4.4 — Guarda de recursão.** Todo processo filho seta `CLAUDE_INVOKED_BY`; `SessionEnd`/`PreCompact` verificam e saem. Sem isso: recursão infinita. Mais dedup de 60 s por sessão.

Moram em `.claude/settings.json` (versionado), não no `settings.local.json` (máquina-específico).

---

## F5 — Heartbeat do DJEN

### Problema

Tudo existe e nada roda.

| Evidência | Estado |
|---|---|
| `scripts/monitor.js` | 72 linhas, funcional, com diff de estado em `seen.json` |
| `scripts/monitor.ps1` | wrapper com popup, funcional |
| `SKILL.md:60` | o comando `schtasks /Create` **está documentado** |
| `monitor/novas_intimacoes.log` | 12 linhas, última execução **2026-07-09** |
| `schtasks /query` | nenhuma tarefa registrada |

O comando foi escrito na documentação e nunca executado. É a fonte de prazo recursal das duas OABs.

### O que construir

**F5.1 — `monitor/PENDENTES.md` como fila de trabalho.** Fonte da verdade, não o popup (que só aparece com sessão aberta e some ao fechar). Uma linha por intimação não tratada: processo, órgão, disponibilização, tipo, prazo estimado, status. O monitor só **acrescenta**; quem marca `TRATADA` é você.

**F5.2 — Tarefa agendada por `Register-ScheduledTask`**, não `schtasks` — que não expõe `StartWhenAvailable` e portanto perde execução com a máquina desligada. Script idempotente, reinstalável após formatação.

**F5.3 — Cálculo de prazo integrado.** Hoje o monitor imprime "verificar prazo com `prazo.js`" e para. Extrair a contagem para módulo reutilizável. Sem `feriados/<tribunal>.json`, a linha sai com `⚠ SEM FERIADO LOCAL`. Matéria penal (dias corridos) sai com `⚠ CONFERIR`.

**F5.4 — Janela de 10 dias.** Com `seen.json` deduplicando, não gera ruído e sobrevive a uma semana de máquina desligada.

**F5.5 — Dead man's switch.** `monitor/last_ok.json` a cada execução bem-sucedida; > 36 h sem sucesso e o F4.2 avisa. Hoje, se a API do DJEN cair por uma semana, o erro vai para um log que ninguém lê — e silêncio é indistinguível de "nada novo".

**F5.6 — OABs vindas de `perfil/advogados.json`** (F1.2), não hardcoded.

### Regra de arquitetura: zero LLM no heartbeat

O heartbeat do `second-brain-summit` custa ~US$ 0,05 por execução porque precisa raciocinar sobre e-mail e calendário. O seu não precisa de raciocínio nenhum: DJEN é fetch HTTP, diff de IDs e contagem de dias úteis. **Não é economia — é a garantia de que data fatal nunca sai de um modelo probabilístico.**

### Critério de aceite

Máquina desligada por 2 dias → ao ligar, a tarefa roda sozinha e `PENDENTES.md` cobre a janela inteira. Rede derrubada → `erros.log` recebe entrada, `last_ok.json` não avança, próxima sessão exibe o aviso.

---

## F6 — Faxina

Agora com dado, não intuição (F3.3).

**a) `settings.local.json`:** ~14 regras apontando para `C:/Users/anaca/Documents/advocacia`, caminho de outra máquina. Nunca vão casar.

**b) `.agent/`:** é o "Antigravity Kit", template de terceiro — 20 agentes genéricos (`game-developer`, `mobile-developer`, `seo-specialist`) e 11 workflows. Conferir antes: `.agent/consumidor/` e `mcp_config.json` podem ser seus.

**c) Skills sobrepostas:** `humanizer` × `humanizer-forense` · `browser-use` × `agent-browser` × `smart-browser-orchestrator` × `Scrapling-Skill` · `conselheiros` × `banca-revisora` · `legal-orchestrator` × `orquestrador-loop` · `pre-peticionamento` × `pre-peticionamento-drive`. **Decidir pelo log de uso.**

**d) Raiz:** `correcoes copy.md`, `test_buse.py`, `test_sum.py`, `Scrapling-Skill.zip`, `transcription_v2*.txt`, `search_stj.py`, `PETICAO_MODELO_unpacked/`, três `.docx` soltos, `skill-cumprimento-sentenca.md` órfão. Conferir se `AGENT.md` e `KILO.md` ainda descrevem algo vivo.

**e) `__pycache__` versionado** em `direito/pecas/` nos bundles.

**Protocolo:** nada é apagado direto. Move para `_arquivo/AAAA-MM/`, 30 dias, depois apaga. Um commit por alínea.

---

## F7 — Des-hardcodificação de caminhos

**17 arquivos** em `skills/` carregam caminho absoluto `D:\WORK\advocacia`. Isso é fragilidade hoje — a pasta não pode ser movida, renomeada nem replicada — independentemente de qualquer plano de produto.

Substituir por resolução relativa à raiz do workspace ou por variável de ambiente única. Não confundir com a parametrização de marca, que é assunto do documento de produto.

*(Esta frente é também pré-requisito do `prd-motor-whitelabel.md`.)*

---

## Backlog — com gatilho declarado

- **Bootstrap de caso** (skill `abrir-caso`): entrevista, cria `clientes/<slug>/`, **resolve o tema-pai e grava o ponteiro** (local ou bundle), puxa capa e cronologia do DataJud, registra o processo em `clientes/_processos.json` — que é o que permite ao F5 cruzar intimação com caso. Modelo a generalizar: `ficha-rescisao-lote`. *Gatilho: ao abrir o próximo caso de matéria já mapeada.*
- **Índice transversal de heurísticas** — padrões argumentativos que atravessam matérias (ônus de fato negativo, risco do empreendimento, quantum em vulnerável) vivem dentro das pastas e não sobem ao roteador. *Gatilho: na terceira vez que um argumento útil for achado por acaso no bundle da matéria errada.*
- **Catálogo da camada C1** — as peças já escritas nos 16 clientes não têm índice nenhum, por decisão de design dos bundles. *Gatilho: 25 casos encerrados, ou na primeira peça reescrita do zero por esquecimento.*
- **`query --file-back`**: resposta dada a partir do bundle vira candidata a página de `heuristicas/`, entrando obrigatoriamente como `em_teste`. *Gatilho: depois que o F2 estiver operante — sem o portão, vira fábrica de páginas não verificadas.*

---

## Decisões negativas

| Rejeitado | Origem | Por quê |
|---|---|---|
| **Busca vetorial / RAG híbrido** | repos 1, 4 | Competiria com o roteador curado; chunk não carrega frontmatter, logo o portão `status: vigente` deixaria de ser obrigatório. O limiar do próprio autor é **~2.000 artigos** — você tem 163. Enquanto o índice couber no contexto, curadoria vence recuperação. |
| **`memory_flush` automático para a camada curada** | second-brain | As memórias são curadas, uma por fato não-óbvio. Flush automático as transformaria em log. A captura (F4.3) fica; a compilação automática, não. |
| **Compilação automática de conversa para os bundles** | repo 4 | Os bundles exigem `status` conferido contra fonte oficial. Um compilador LLM produziria páginas `em_teste` que ninguém verificou — já há 41. |
| **`[[wikilinks]]`** | repo 4 | O repo 1 do mesmo autor os proíbe explicitamente. Seus bundles já usam links relativos. |
| **`check_sparse_articles` (<200 palavras)** | repo 4 | Métrica de volume. Uma tese do STJ bem sintetizada tem 80 palavras e é excelente. Substituir por completude de campos. |
| **Pydantic AI** | repo 2 | Você já tem harness. Migrar é regressão. |
| **Eve / Vercel** | repo 3 | Idem. Serverless, sandbox e canais não são o seu mundo. |
| **Interface de chat (Slack/Discord)** | repos 1, 3 | O trabalho acontece dentro do Claude Code. |
| **VPS, Postgres, systemd, sessões duráveis** | repos 1, 3 | Máquina única. |
| **Tracking de hábitos, nudges diários** | second-brain | Ruído. |
| **Proatividade nível "Partner"** (agente envia/executa sozinho) | second-brain | Inaceitável em advocacia. Teto é **Advisor**: redige, calcula, notifica — o protocolo é sempre humano. |
| **Tripartição `concepts`/`entities`/`sources`** | repo 1 | Sua taxonomia por matéria é melhor para o domínio. |

---

## Riscos

| Risco | Mitigação |
|---|---|
| **`lint-citacoes` com falso positivo trava peça no prazo** | Três níveis de severidade; override explícito e registrado; rodar em modo aviso por duas semanas antes de virar portão. |
| **Portão em excesso treina a clicar "sim"** | Bloqueio duro só para citação fabricada. Todo o resto é pausa com motivo. |
| **Hook mal escrito derruba toda sessão** | `try/except` amplo, falha permissiva — exceto o F4.1, que falha negativo. Testar com `claude --debug`. |
| **Falso senso de segurança na fila do DJEN** | Cabeçalho do `PENDENTES.md` diz que não substitui conferência no eproc antes de protocolar. |
| **Feriado local errado = prazo errado** | Marcador `⚠ SEM FERIADO LOCAL`; conferência anual da portaria de cada tribunal. |
| **Faxina apagar algo vivo** | Move para `_arquivo/`, 30 dias de carência, um commit por alínea. |

---

## O que este documento não cobre

- **Extração do motor como produto white-label** → [`2026-07-26_prd-motor-whitelabel.md`](2026-07-26_prd-motor-whitelabel.md).
- **A camada de produção jurídica**: qualidade da redação, teses, estratégia processual, `humanizer-forense`, tipografia. Funciona e está fora de escopo por decisão.

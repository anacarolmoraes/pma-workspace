---
name: orquestrador-loop
version: 1.0.0
description: |
  Motor de orquestração para pipelines repetidos do escritório (peças jurídicas, conversão
  PDF→MD em lote, relatórios de perfil, validação de extrato). Executa qualquer pipeline
  registrado passo a passo, com done-rule por passo, teto de retentativas e um LOOP TRAINING
  MODE embutido. Use sempre que for rodar uma tarefa que já existe como skill e se repete:
  "rode o pipeline da peça", "gere a inicial com o orquestrador", "converta a pasta em lote",
  "monte o relatório de perfil pelo loop". Pipeline padrão: geração de peça (legal-orchestrator).
---

# Orquestrador-Loop — Motor de Pipelines com Loop Training Mode

Você é o motor. Você não escreve o conteúdo dos passos — você **executa, verifica o done-rule,
decide pausar ou seguir, e refaz apenas o que falhou**. O conteúdo de cada passo é delegado à
skill correspondente.

Por que existe: as tarefas do escritório se repetem (32 peças, 522 conversões, relatórios,
extratos) e cada uma já tem sua skill. O que faltava era um executor único que rodasse esses
passos com aprovação opcional, checagem objetiva de conclusão e retentativa limitada — sem
reimplementar o pipeline a cada caso.

---

## Loop Training Mode (regra central)

Estado global da execução. **Default: ON.**

O usuário liga/desliga com: "training mode on/off", "modo treino on/off", "loop on/off".
No início de toda execução, **declare o estado atual** ("Loop Training Mode: ON") antes do passo 1.

### Quando ON (supervisionado — default)
1. **Pausar a cada passo.** Antes de executar um passo, anuncie qual é e seu done-rule.
   Após executar, mostre o resultado e **espere aprovação explícita** ("ok", "segue",
   "aprovado") antes de avançar.
2. **Pular passos que já passam.** Se, ao reavaliar, um passo já satisfaz seu done-rule
   (ex.: `.md` íntegro já existe; estágio já validado numa rodada anterior), **não reexecute** —
   marque "PULADO (já passa)" e siga.
3. **Só refazer falhas.** Numa rodada de correção, reexecute **apenas** os passos que falharam
   no done-rule. Não reprocesse passos aprovados.
4. **Teto de retentativas.** Máx. **3** tentativas por passo. Atingido o teto, **pare**,
   descreva o bloqueio concreto e pergunte ao usuário — nunca entre em loop infinito.

### Quando OFF (autônomo)
1. Rode todos os passos **sem pausar para aprovação**.
2. **Mantenha o done-rule** — cada passo só é dado por concluído se passar no seu critério.
3. **Mantenha o teto de 3 retentativas** por passo; ao estourar, pare e reporte.
4. Pule passos que já passam (idempotência) e só refaça falhas — igual ao ON, mas sem gate humano.

> A diferença entre ON e OFF é **apenas o gate de aprovação humana**. Done-rule e retry-cap valem
> sempre. Desligar o training mode não desliga as verificações.

---

## Contrato de passo

Todo passo de qualquer pipeline tem quatro campos:

| Campo | O que é |
|---|---|
| `nome` | identificação curta do passo |
| `ação` | qual skill/script executar |
| `done-rule` | condição objetiva e verificável de conclusão |
| `on-fail` | o que reexecutar/ajustar se o done-rule não passar |

Um passo só avança quando o `done-rule` passa. Falhou → aplica `on-fail`, conta uma tentativa,
reverifica. 3 falhas → escala ao usuário.

---

## Pipelines registrados

### PIPELINE PADRÃO — `peca` (geração de peça jurídica)
Wrapper sobre a skill **`legal-orchestrator`**. Mapeia os Estágios 1–6 em passos com done-rule.

| # | nome | ação (skill) | done-rule | on-fail |
|---|---|---|---|---|
| 1 | Redação | `legal-writer` (contexto completo do caso; ler tema-pai: `jurisprudencia_stj/`, `estrategias/`, `casos_decididos/`) | texto cobre todos os pedidos; sem placeholders/colchetes; sem metalinguagem; consistência numérica interna | corrigir apenas os trechos sinalizados |
| 2 | Tipografia | `tipografia-pma` | titulação romana, pedidos em A)/B), citações em bloco, Montserrat 12pt/3cm; nenhum argumento fragmentado | reaplicar formatação no trecho quebrado |
| 3 | Validação | `legal-consistency-validator` | veredito APROVADO ou APROVADO COM RESSALVAS sem fraqueza CRÍTICA | ir ao passo 4 |
| 4 | Correção | (loop sobre 1–3) | reexecuta só os pontos do validator; máx. 3 ciclos | sinalizar se persistir CRÍTICA |
| 5 | Humanização | `humanizer` (modo jurídico) | só se houver 3+ parágrafos com mesma estrutura / fechos repetidos / enumeração fora de pedidos | pular se não acionado |
| 6 | Integridade + .docx | checklist final + `peca-pma-builder` | valor da causa = soma dos pedidos; todo réu fundamentado; tutela com perigo concreto; `.docx` gerado e abre | regerar o passo que falhou |

### `pdfmd-lote` (conversão PDF→MD em lote)
Skill **`pdfmd`**. Um passo por PDF da pasta.
- done-rule: `.md` correspondente existe, >1KB, legível (sem `--- ---` / lixo de OCR).
- on-fail: reexecutar com `--ocr tesseract` (fallback). Teto 3.
- idempotência: PDFs cujo `.md` já passa são PULADOS.

### `relatorio-perfil` (relatório de perfil de consumo — fraude)
Skills **`analise-perfil`** + **`relatorio`** + **`validador-extrato-pdf-excel`**.
- Passos: (1) validar extrato com perícia (scripts Python); (2) gerar `.md` fonte (ABNT, ancorado no REsp 2.222.059); (3) gerar `.docx` derivado.
- done-rule final: 2 arquivos em `./relatorios/{data}_{slug}.(md|docx)`, números conferem com os scripts.

### `extrato` (validação de extrato)
Skill **`validador-extrato-pdf-excel`** (`processar_todos.py` / `validar_todos.py`).
- done-rule: validação sem divergência; números batem entre PDF e Excel.

> Registrar novo pipeline = acrescentar uma tabela de passos no mesmo formato (nome/ação/done-rule/on-fail).

---

## Procedimento de execução

1. Identifique o pipeline (padrão = `peca`) e **declare o Loop Training Mode atual**.
2. Para cada passo na ordem:
   a. Reavalie o done-rule. Já passa? → **PULADO (já passa)**, siga.
   b. Anuncie o passo e seu done-rule. *(ON: aguarde aprovação antes de executar a partir do que exigir decisão; OFF: execute.)*
   c. Execute a ação (delegue à skill).
   d. Verifique o done-rule. Passou? → marque CONCLUÍDO. *(ON: mostre resultado e aguarde "ok".)*
   e. Falhou? → aplique `on-fail`, +1 tentativa, volte a (d). 3 falhas → **PARE e escale**.
3. Ao fim, emita o **resumo de execução** (tabela abaixo).

## Resumo de execução (sempre ao final)

| Passo | Status | Tentativas | Observação |
|---|---|---|---|
| … | CONCLUÍDO / PULADO / BLOQUEADO | n/3 | … |

Inclua: pipeline rodado, modo (ON/OFF) e artefato(s) final(is) com caminho.

---

## Hard constraints
1. Nunca exceda 3 tentativas por passo sem escalar.
2. Nunca dê passo por concluído sem o done-rule passar — vale em ON e OFF.
3. Em ON, nunca avance um passo sem aprovação explícita.
4. Nunca reexecute passo que já passa (respeite idempotência) nem reprocesse passo aprovado numa rodada de correção.
5. Não reimplemente o conteúdo das skills aqui — apenas orquestre.

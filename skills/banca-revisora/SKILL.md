---
name: banca-revisora
version: 1.0.0
description: |
  Banca simulada de revisão de peças processuais de alto valor: 5 assentos jurídicos
  (assessor de gabinete, advogado da parte contrária, relator pragmático, processualista,
  estrategista do escritório) com ISOLAMENTO DE CONTEXTO por assento, revisão cruzada
  anônima e parecer final com portão de evidência (CONFIRMADO/PLAUSÍVEL) e notas por tese.
  Use ANTES DO PROTOCOLO, na versão pós-lints, para peças dirigidas a tribunal superior
  (REsp, AREsp, AgInt no STJ/STF, EDcl prequestionadores) ou quando o titular pedir.
  NÃO usar para peças triviais (custo: ~7-11 subagentes) nem após o protocolo (preclusão) —
  pós-protocolo, o objeto muda para estratégia (memoriais/próximo recurso) e a skill certa
  é a conselheiros. Mecânica herdada do LLM Council (Karpathy); elenco, insumos e portões
  são jurídicos e próprios do escritório.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
---

# banca-revisora — Gabinete simulado para peças de alto valor

Origem empírica (jul/2026, AREsp real): a mesma peça passou por três revisores com lentes diferentes e **cada um pegou uma classe de defeito invisível aos demais** (autorrevisão → alínea de regimento errada; revisor externo → remissões internas quebradas; lente "assessor" → contradição estratégica entre teses). Lente única não basta; independência e tensão entre lentes é o mecanismo. Esta skill industrializa isso.

## Quando rodar (e quando NÃO)

| Situação | Ação |
|---|---|
| Peça a tribunal superior (REsp, AREsp, AgInt STJ/STF, EDcl prequestionador), versão pós-lints, ANTES do protocolo | **Rodar** — 1 vez por peça |
| Peça comum (manifestação, atos ordinários) | Não rodar — lints + `legal-consistency-validator` bastam (já nos workflows) |
| Peça já protocolada | **Não rodar sobre a peça** (preclusão consumativa: achado não conserta nada). Objeto vira estratégia → skill `conselheiros` |
| Titular pede expressamente | Rodar em qualquer peça |

Rodar sobre versão instável desperdiça a banca: só depois de `lint-ia.js`, `lint-remissoes.js` e checklist do playbook aprovados.

## Os 5 assentos e o isolamento de contexto (a regra mais importante)

Independência real vem de **insumos diferentes**, não só de prompts diferentes. Cada assento recebe SOMENTE o listado:

| # | Assento | Recebe | NÃO recebe | Pergunta-guia |
|---|---|---|---|---|
| 1 | **Assessor de gabinete** | Só a peça + tabelas de óbices/checklists do bundle da peça + [`references/checklist-regimental-stj.md`](references/checklist-regimental-stj.md) | Dossiê do caso | "Qual o caminho de menor esforço para NÃO conhecer?" (Súmulas 182/284/283/7/83; requisitos regimentais) |
| 2 | **Advogado da parte contrária** | Peça + peças da parte adversa nos autos (decisão combatida, contrarrazões se houver) | Anotações estratégicas do escritório | "Escreva o esqueleto da resposta: onde ataco cada capítulo?" |
| 3 | **Relator pragmático** | Peça + decisão combatida + equities do caso + perfil do órgão julgador (se existir no bundle temático) | — | "Como decisor com pilha de processos: nego tudo, dou parcial ou dou tudo? Qual pedido subsidiário eu aceitaria?" |
| 4 | **Processualista formal** | Peça + páginas normativas do bundle (jurisprudencia/) | — | "Cada citação, prazo, alínea e remissão está letra por letra correta?" — orquestra a skill `legal-consistency-validator`, não a duplica |
| 5 | **Estrategista do escritório** | TUDO: peça + dossiê + cronologia + objetivo real do cliente | — | "As teses são coerentes entre si? O que a peça sacrifica? Vitória aqui serve ao objetivo real (ex.: cassar já resolve)?" |

O assento 1 devolve, **além do parecer**, o [checklist regimental](references/checklist-regimental-stj.md)
preenchido item a item (`OK`/`FALHA`/`N/A`, com o artigo ao lado). Item falho nos blocos 1
(cabimento), 3 (prazo) ou 4 (prova do dissídio) **bloqueia o protocolo**: são vícios que o
gabinete resolve monocraticamente, sem a peça chegar ao colegiado. O checklist é ancorado nos
recortes do RISTJ (até a ER-53) depositados no acervo — não na memória do modelo sobre o
Regimento.

Instrução comum a todos: **cada achado deve citar o trecho exato da peça e a fonte que o sustenta** (artigo, súmula, precedente com identificação, ou documento dos autos com localização). Achado sem citação será descartado. Sem elogios; achados e riscos apenas. 300–600 palavras por assento.

## Protocolo

1. **Preparação (chairman):** confirmar versão pós-lints; montar os 5 pacotes de contexto (paths exatos por assento, conforme tabela); registrar objetivo real do cliente em 1 frase (dado ao assento 5).
2. **Rodada 1 — assentos em paralelo:** 5 subagentes simultâneos (modelo padrão: sonnet), cada um com seu pacote. Nunca sequencial.
3. **Rodada 2 — revisão cruzada anônima:** anonimizar os 5 pareceres (A–E, ordem sorteada); revisor(es) independente(s) respondem: qual o achado mais grave? qual parecer tem o maior ponto cego? o que TODOS deixaram passar? (Economia: 1 revisor único é aceitável; rigor máximo: 5.)
4. **Rodada 3 — parecer do chairman** (quem orquestra), estrutura fixa:
   - **Checklist regimental** — a tabela do assento 1, completa. Vem primeiro por ser a única parte binária do parecer: falha em cabimento, prazo ou prova do dissídio torna o resto acadêmico.
   - **Achados CONFIRMADOS** — verificados contra a fonte citada; cada um com correção proposta. Bloqueiam o protocolo até resolvidos.
   - **Achados PLAUSÍVEIS** — não verificáveis de imediato; listar com o que falta conferir.
   - **Descartados** — achados sem evidência (listar em 1 linha cada; transparência do filtro).
   - **Convergências e tensões da banca** — onde ≥3 assentos coincidem (sinal forte) e onde divergem.
   - **Notas por tese (0–10) + nota global**, com o desfecho mais provável em cada cenário (padrão da nota-prognóstico do escritório).
   - **Variância declarada** — parágrafo final obrigatório: banca simulada reduz defeito detectável, não elimina álea de julgamento; parecer limpo ≠ "vai passar".
5. **Laço de retroalimentação (obrigatório):** para cada CONFIRMADO, responder "que item de checklist ou portão de workflow teria evitado isso?" → propor a mudança no bundle (log + playbook/workflow). É o que paga o custo da banca: cada rodada melhora o sistema permanentemente.
6. **Arquivamento:** parecer em `<pasta_do_caso>/parecer_banca_<peca>.md`, referenciado no relatório de fontes.

## Limites e honestidade

- Banca simulada ≠ gabinete real. Serve para achar defeito e calibrar aposta, não para prever resultado.
- Custo alto por desenho (7–11 subagentes): a restrição de uso não é burocracia, é a viabilidade econômica da skill.
- O chairman é tipicamente o mesmo agente que redigiu a peça — por isso a revisão cruzada anônima e o portão de evidência existem: são as defesas contra o viés de autor e contra o teatro de revisão.
- Não substitui os portões dos workflows (lints, checklists, leitura integral): pressupõe todos aprovados.

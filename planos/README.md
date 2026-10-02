# Planos — estado dos PRDs

Changelog dos planos de evolução do sistema. Saiu do `CLAUDE.md` em 04/09/2026: é registro,
não instrução, e não precisa ser carregado em toda sessão.

- [`2026-10-02_plano-estado-do-caso-na-fila.md`](2026-10-02_plano-estado-do-caso-na-fila.md)
  — estado do caso (`ANALISE.md`) ligado ao monitor do DJEN, ao hook de abertura e à memória:
  Stop que exige `ANALISE.md` atualizada quando a pasta do caso muda, fila lendo `processos:`
  das ANALISE.md em vez de `_processos.json`, painel cruzando fila e caso, regra de memória, e
  migração dos ~40 casos hoje na memória do Claude. **Registrado em 02/10/2026 para execução
  posterior**, nota 9. Também em 01–02/10, sem PRD: prazos vencidos no alerta e data local no
  `session-start`, corpus do `lint-citacoes` sem texto nosso, `alerta-injecao` sem falso
  positivo, compilador fail-closed, teste ponta a ponta do `md2docx`, coluna "caso" com nome
  do cliente e "prazo fixado no ato" na fila, Juizado 10 d.ú., feriados forenses 2026 de seis
  tribunais, `recalcular-prazos.js`.
- [`2026-10-01_plano-pasta-de-caso-enxuta.md`](2026-10-01_plano-pasta-de-caso-enxuta.md)
  — pasta de cliente sem rastro de máquina (censo: 5 arquivos gerados por documento real).
  Cinco sugestões com nota. **4 e 5 executadas em 01–02/10** (`ANALISE.md` como único arquivo
  de estado do caso, `scripts/caso.js`, `scripts/limpar-caso.js` no `Stop`, radar em `tmp/`).
  **Pendente: 1** (pasta `.ia/` para o que o `pdfmd` gera; é a que mais reduz volume; sessão
  de manutenção, com plano de arquivos e teste de aceitação no documento). 2 e 3 são opção,
  não fila.
- [`2026-09-04_prd-fluxo-peticao-inicial.md`](2026-09-04_prd-fluxo-peticao-inicial.md)
  — fluxo próprio da petição inicial no acervo (playbook + workflow únicos, cinco heurísticas
  transversais, três páginas que dependem de depósito de fonte pela titular, mineração dos
  despachos de emenda na fila do DJEN, perfis de juízo). **F1, F2 e F3 executadas em 04–05/09**
  (acervo: `direito/pecas/peticao-inicial/` com playbook, workflow, sete heurísticas, doze
  páginas literais; fontes da F3 depositadas pela titular). **F5 executada em 05/09** em sessão
  de manutenção: `lint-placeholder` e `lint-inicial` entraram no `md2docx`, `protect-gates`
  deixou de contar `2>&1` como escrita, `definicoes.md` §1 ganhou dano moral (292, V) e
  correção de ofício (292, §3º), template de rescisão de lote com `tipo: inicial`, teste em
  `hooks/_teste-f5.js` no `npm test`. **F4 iniciada em 08–09/09** a partir de
  `sugestoes_peticao_inicial.md` (notas ≥ 5 implementadas): `minerar-emendas.js` achou 12
  despachos de emenda em 80 processos (gratuidade 9, documento faltante 8) e a contagem entrou
  no checklist e na matriz de intake; `perfis/` de 1º grau criado com template e contagem de
  órgãos (`orgaos-frequentes.js`), sem perfil escrito ainda. Também: skill `ficha-golpe-bancario`,
  template de golpe, matriz de documentos transversal e de golpe, `caso.json` + `qualificacao.js`,
  modo grupo de casos do radar. Portões (estrutura aprovada no `md2docx`, `lint-inicial` v2)
  **aplicados** (patch em `planos/aplicados/`). A inicial João Marcos x Five Senses (01/10/2026) rodou o pipeline central em caso real; o intake foi redesenhado em 01/10 (um só `ANALISE.md` por caso) e ainda não rodou em caso novo. O que
  já saiu sem PRD em 04/09: `ANALISE.md` por caso e `<PECA>.estrutura.md` no orchestrator,
  checklist de saída do 319/320 em `direito/pecas/peticao-inicial/`, três divergências de
  técnica (valor da causa, autocomposição, posição da tutela) resolvidas nas skills.
- [`2026-08-29_prd-equipe-e-saneamento.md`](2026-08-29_prd-equipe-e-saneamento.md)
  — fila do DJEN em equipe, saneamento do arsenal e onboarding. Blocos 0, 3 e 4 aprovados;
  o Bloco 2 (faxina do motor) ficou fora de escopo e segue pendente. **F3.1 executada em 02/09**:
  o `lint-bundle` passou a ler as três formas de aresta do grafo e o painel caiu para 24 erros /
  33 avisos, todos verdadeiros — o que destrava F3.6 (ligar o portão). **F0.1 (triagem das
  vencidas pela titular) continua pendente** e é o que mantém a fila em 243 abertas / 1 tratada.
- [`2026-08-03_prd-saneamento-e-colheita-lcc.md`](2026-08-03_prd-saneamento-e-colheita-lcc.md)
  — saneamento operacional + colheita de 7 ideias do `legal-context-compiler-prd` (decisão:
  **não** construir o app). F2 concluída em 03/09: `resp-stj-pipeline/` saiu do git e mora em
  `_arquivo/2026-09/`; F2.2/F2.3 seguem como portões da titular, ver `NOTAS.md` no arquivo.
- [`2026-08-02_prd-leitura-semantica-stj.md`](2026-08-02_prd-leitura-semantica-stj.md)
  — leitura semântica de julgados do STJ e consumo do RISTJ. **Executado em 02/08 (F1 a F7).**
  O `lint-citacoes` **bloqueia** citação cuja voz é de outro julgado transcrito dentro do
  acórdão; o RISTJ (até a ER-53) está em `direito/pecas/raw/ristj-er53.md`; a `banca-revisora`
  ganhou checklist regimental. Pendências são de conteúdo, não de código.
- [`2026-07-28_prd-versionamento-e-modularizacao.md`](2026-07-28_prd-versionamento-e-modularizacao.md)
  — repositório da equipe em 8 fases. **Fases 1 a 6 e 8 executadas.** Pendentes: publicação no
  GitHub (Fase 7) e o portão da titular para apagar as pastas de tema locais (`direito_bancario/`,
  `direito_digital/`, `rescisao_contrato_imovel/`, `cobranca_honorarios/`, `recursos_gerais/`),
  que seguem legíveis na máquina dela como fonte dupla de verdade.
- [`2026-07-26_prd-infra-agente.md`](2026-07-26_prd-infra-agente.md) — camada de verificação e
  infraestrutura. **Executado** em 26/07, exceto os erros de conteúdo do `lint-bundle` (**24**
  depois do conserto do medidor em 02/09, todos verdadeiros). O `lint-contradicoes` previsto na
  F2.3 **não foi construído**; `perfil/definicoes.md` deixou de citá-lo em 04/09.
- [`2026-07-26_prd-motor-whitelabel.md`](2026-07-26_prd-motor-whitelabel.md) — extração do motor
  como produto. **Adiado por decisão da titular.**

Sem PRD, executado em 08/09/2026 a partir de `sugestoes_chatgpt.md` (sugestões para o
`humanizer-forense`, avaliadas e implementadas as de nota ≥ 6): guardião de invariantes
(`skills/humanizer-forense/scripts/checar-invariantes.js`, snapshot antes/comparação depois,
bloqueia mudança de número, data, dispositivo, julgado, transcrição, título-tese, BLUF,
modalidade, negação e pedido), diagnóstico de ritmo não bloqueante (`ritmo.js`), análise
obrigatória com alteração condicional (humanizer 1.2.0, orchestrator 4.10.0 Estágio 5,
validator 2.10.0 com campos `humanizer_*` no `.validacao.md`), perfil de voz
`perfil/voz-forense.md` (rascunho a validar pela titular; substitui a fronteira fixa de seis
capítulos por regra proporcional), testes em `npm test`. **Patch do `lint-ia` aplicado** (v1.2, marcador no arquivo; patch arquivado em `planos/aplicados/`). Rejeitadas: rebaixar travessão e tríade
a aviso (contraria o endurecimento de 04/08/2026) e ampliar a lista de palavras proibidas.

Patches de manutenção já aplicados ficam em [`aplicados/`](aplicados/) (injeção 05/09, inicial e lint-ia 08/09); os de 01–02/10/2026 (CI no GitHub, `docx` carregado do `node_modules` do projeto, `skills/_externas/`, poda de vocabulário) estão só no histórico do git.

Sem PRD, executado em 04/09/2026 a partir de `scratch/2026-09-03_revisao-regras-vs-hooks.md`:
seis hooks novos (portões, comandos, PDF, dado de caso, leitura obrigatória, Stop), `npm test`,
`SKILLS.md` gerado, poda de `IA_CONTEXT.md`, `GUIA_TECNICO.md` e `correcoes.md`, AGENTS.md e
USER.md reduzidos ao que é julgamento.

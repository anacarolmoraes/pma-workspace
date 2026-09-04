# Planos — estado dos PRDs

Changelog dos planos de evolução do sistema. Saiu do `CLAUDE.md` em 04/09/2026: é registro,
não instrução, e não precisa ser carregado em toda sessão.

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

Sem PRD, executado em 04/09/2026 a partir de `scratch/2026-09-03_revisao-regras-vs-hooks.md`:
seis hooks novos (portões, comandos, PDF, dado de caso, leitura obrigatória, Stop), `npm test`,
`SKILLS.md` gerado, poda de `IA_CONTEXT.md`, `GUIA_TECNICO.md` e `correcoes.md`, AGENTS.md e
USER.md reduzidos ao que é julgamento.

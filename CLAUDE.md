# CLAUDE.md — Advocacia PMA

> **Leia [`AGENTS.md`](AGENTS.md) primeiro.** Ele é o arquivo canônico e vale para qualquer
> agente: onde ficam os bundles, protocolo de leitura antes de redigir, portões de compilação,
> regras duras, ambiente e segurança.
>
> Este arquivo guarda **apenas o que é específico do Claude Code** e não existe em outros agentes.

---

## Hooks ativos (`.claude/settings.json`)

| Hook | Script | O que faz |
|---|---|---|
| `PreToolUse` | [`hooks/block-secrets.js`](hooks/block-secrets.js) | bloqueia leitura de credencial (`.env`, `*.pem`, token do gws, `mcp_config.json`). **Não** bloqueia documento de cliente |
| `SessionStart` | [`hooks/session-start.js`](hooks/session-start.js) | em máquina nova (sem `perfil/usuario.md` ou `perfil/ambiente.json`), manda configurar e cala o resto; caso contrário injeta a fila do DJEN e alerta se o monitor estiver parado há mais de 36 h |
| `PreToolUse` (só `Read`) | [`hooks/block-md-integral.js`](hooks/block-md-integral.js) | bloqueia leitura integral do `.md` canônico longo de bundle `pdfmd` (>300 linhas com `.pdfmd.json` irmão); usar `node skills/pdfmd/scripts/ler-pdfmd.js <md> --mapa` |
| `PreCompact` | [`hooks/pre-compact.js`](hooks/pre-compact.js) | grava o estado da sessão em `scratch/sessoes/` antes da compactação |

Todo processo filho deve setar `CLAUDE_INVOKED_BY` — os hooks verificam e saem, para não
recursar infinitamente.

Se um hook começar a atrapalhar, diagnosticar com `claude --debug` antes de desligar. O
`block-secrets` tem suíte própria: `node hooks/_teste-block-secrets.js`.

---

## Skills

O Claude Code descobre sozinho as skills em `skills/*/SKILL.md` pelo campo `description`.
Acionar assim que o gatilho aparecer, sem perguntar:

| Gatilho | Skill |
|---|---|
| `perfil/usuario.md` ausente, ou pedido de configurar/corrigir perfil, OAB, assinatura | `onboarding-usuario` |
| pedido de peça (inicial, contestação, manifestação, agravo, embargos) | `legal-orchestrator` |
| apelação cível | `apelacao-cirurgica` |
| dossiê estratégico antes de peticionar | `pre-peticionamento` |
| gerar ou editar `.docx` de peça | `peca-pma-builder` |
| padronização visual | `tipografia-pma` |
| auditoria adversarial de peça pronta | `legal-consistency-validator` |
| revisão por banca antes de tribunal superior | `banca-revisora` |
| extrato bancário | `validador-extrato-pdf-excel` |
| prazo, intimação, DJEN | `pesquisa-djen` |
| jurisprudência favorável p/ sustentar peça, "o que os tribunais decidem sobre X" | `radar-jurisprudencia` |
| consumir/ingerir canal ou vídeos do YouTube, KB de canal | `consumir-canal-youtube` |
| PDF sem `.md` irmão | `pdfmd` |
| transcrição de áudio | `whisper-transcriber` |
| relatório ou parecer | `relatorio` (comando em `.claude/commands/`, não em `skills/`) |

Rodar `node scripts/lint-skills.js` depois de criar ou mover skill.

---

## Memória

Memória é do Claude Code e **não viaja** para outro agente nem para o pacote distribuível.
Por isso: **regra do escritório nunca mora em memória.** Se aparecer uma lá, migrar para
[`perfil/definicoes.md`](perfil/definicoes.md) e deixar a memória apenas apontando.

Memória serve para: contexto de caso concreto, preferência de trabalho, achado que custou
investigação. Não serve para: norma, definição, padrão de peça.

---

## Planos em andamento

- [`planos/2026-08-29_prd-equipe-e-saneamento.md`](planos/2026-08-29_prd-equipe-e-saneamento.md)
  — fila do DJEN em equipe, saneamento do arsenal e onboarding. Blocos 0, 3 e 4 aprovados;
  o Bloco 2 (faxina do motor) ficou fora de escopo e segue pendente. **F3.1 executada em 02/09**:
  o `lint-bundle` passou a ler as três formas de aresta do grafo e o painel caiu para 24 erros /
  33 avisos, todos verdadeiros — o que destrava F3.6 (ligar o portão).
- [`planos/2026-08-03_prd-saneamento-e-colheita-lcc.md`](planos/2026-08-03_prd-saneamento-e-colheita-lcc.md)
  — saneamento operacional (fila DJEN, quarentena do `resp-stj-pipeline/`, higiene C1 no git,
  faxina de skills) + colheita de 7 ideias do `legal-context-compiler-prd` (decisão: **não**
  construir o app). **Rascunho aguardando aprovação da titular.** F1 (fila DJEN) é urgente
  independentemente do resto. F2 concluída em 03/09: `resp-stj-pipeline/` saiu do git e
  mora em `_arquivo/2026-09/` (fora do git); F2.2/F2.3 (destino do caso, colheita de ideias) seguem
  como portões da titular, ver `NOTAS.md` no arquivo.
- [`planos/2026-08-02_prd-leitura-semantica-stj.md`](planos/2026-08-02_prd-leitura-semantica-stj.md)
  — leitura semântica de julgados do STJ e consumo do RISTJ. **Executado em 02/08 (F1 a F7).**
  Novidades que mudam o dia a dia: o `lint-citacoes` agora **bloqueia** citação cuja voz é de
  outro julgado transcrito dentro do acórdão (usar `--voz-aviso` nas duas primeiras semanas);
  o RISTJ (até a ER-53) está depositado em `direito/pecas/raw/ristj-er53.md` com recortes por
  artigo; a `banca-revisora` ganhou checklist regimental que bloqueia protocolo. Pendências
  são de conteúdo, não de código — ver "Estado da execução" no PRD.
- [`planos/2026-07-28_prd-versionamento-e-modularizacao.md`](planos/2026-07-28_prd-versionamento-e-modularizacao.md)
  — repositório da equipe em 8 fases. **Fases 1 a 6 e 8 executadas** (28/07 e 02/08): histórico
  limpo, instalador multiplataforma, entrevista de primeiro uso, documentação, acervo migrado ao
  `arsenal-juridico`, triagem de skills e marketing em repo próprio (`pma-marketing`). Pendentes:
  publicação no GitHub (Fase 7) e o portão da titular para apagar as pastas de tema locais.
- [`planos/2026-07-26_prd-infra-agente.md`](planos/2026-07-26_prd-infra-agente.md) — camada de
  verificação e infraestrutura. **Executado** em 26/07, exceto os erros de conteúdo do
  `lint-bundle` — **24** depois do conserto do medidor em 02/09, todos verdadeiros (acórdão
  `vigente` sem inteiro teor, espelho inválido).
- [`planos/2026-07-26_prd-motor-whitelabel.md`](planos/2026-07-26_prd-motor-whitelabel.md) —
  extração do motor como produto. **Adiado por decisão da titular**; depende do anterior.

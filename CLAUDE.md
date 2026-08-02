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
| relatório ou parecer | `relatorio` |

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

- [`planos/2026-07-28_prd-versionamento-e-modularizacao.md`](planos/2026-07-28_prd-versionamento-e-modularizacao.md)
  — repositório da equipe em 8 fases. **Fases 1 a 3 e 6 executadas** em 28/07 (histórico limpo,
  instalador multiplataforma, entrevista de primeiro uso, documentação). Pendentes: migração do
  acervo local para o `arsenal-juridico` (Fase 4), triagem final de skills (Fase 5), publicação
  no GitHub (Fase 7) e repositório de marketing (Fase 8).
- [`planos/2026-07-26_prd-infra-agente.md`](planos/2026-07-26_prd-infra-agente.md) — camada de
  verificação e infraestrutura. **Executado** em 26/07, exceto os 26 erros de conteúdo do
  `lint-bundle` (teses sem fundamento rastreável, acórdãos `vigente` sem inteiro teor).
- [`planos/2026-07-26_prd-motor-whitelabel.md`](planos/2026-07-26_prd-motor-whitelabel.md) —
  extração do motor como produto. **Adiado por decisão da titular**; depende do anterior.

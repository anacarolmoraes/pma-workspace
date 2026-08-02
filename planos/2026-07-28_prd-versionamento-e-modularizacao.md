# PRD — Versionamento, modularização e replicação para a equipe

> Status: **Fases 1, 2, 3 e 6 executadas em 28/07/2026.** Pendentes: 4 (migração do acervo),
> 5 (triagem final de skills), 7 (publicação no GitHub) e 8 (marketing).
> Nenhuma skill saiu da máquina da titular — as exclusões são só de versionamento.
>
> **Decisão alterada na execução (Fase 1):** as pastas de tema **não** foram versionadas nem
> parcialmente. A auditoria mostrou que a "jurisprudência" convive com documento bruto de
> processo contendo CPF de terceiros, boa parte em PDF/DOCX — conteúdo que não se inspeciona
> automaticamente. Versioná-las gravaria dado pessoal no histórico permanente para depois ter
> de refazer o repositório na Fase 4.
>
> **Achados de LGPD durante a execução** (todos corrigidos): ficha de cliente dentro de
> `skills/ficha-rescisao-lote/`; nome completo e valores reais de contrato no
> `exemplo_dados_caso.json`; caso real com nomes dos beneficiários da fraude no `evals.json`
> da `analise-perfil`; menções a nome de cliente em 5 skills e no template da inicial; fila do
> DJEN com números de processo. **Lição:** dado de cliente não fica só em `clientes/` — vaza
> para dentro de pasta técnica. Auditar conteúdo, não só estrutura de pastas.

## Decisões já tomadas

- **4 camadas**: motor (`pma-workspace`, GitHub privado) · conteúdo (bundles, repo privado
  próprio) · casos (local → Google Drive, **nunca** versionados — regra dura 7 do AGENTS.md) ·
  estado local (envs, scratch, `perfil/usuario.md` — setup recria).
- **Histórico atual do git será descartado** (contém `clientes/`): apagar `.git` e reiniciar
  limpo antes de qualquer push. Nada foi enviado ao GitHub.
- **Nome do repo do motor**: `pma-workspace`.
- **adv_env e pdfmd_env nunca versionam** (binários por SO; macOS não roda binário Windows).
  Fonte do pdfmd (0,6 MB) vendorizada descompactada em `vendor/pdfmd/` — sem zip.
- **Bundles versionam separado** (já são repo git próprio; falta só o remoto privado).
- **Marketing = repo próprio** (Fase 8), fora do motor e fora dos bundles.

## Fase 1 — Histórico limpo

1. Apagar `.git` e `git init -b main`.
2. `.gitignore` completo: `.env`/credenciais · `clientes/` · pastas de caso dentro dos temas ·
   `relatorios/` · `audio/` · `backups/`, `scratch/`, `_arquivo/`, `.notebooklm/` ·
   `adv_env/`, `pdfmd/` (instalado), `node_modules/` · `perfil/usuario.md` · skills da lista
   "não versionar" (Fase 5) · `artigos/` · travas `.~lock.*#`.
3. Commit inicial só com o motor.

## Fase 2 — Instalação multiplataforma (Windows + macOS)

1. Vendorizar fonte do pdfmd em `vendor/pdfmd/` + `requirements.txt` consolidado.
2. `scripts/setup.js` (Node — já é requisito, roda igual nos dois SOs): detecta SO, cria
   `adv_env`, instala requirements, monta ambiente do pdfmd, confere fontes Montserrat,
   configura `git config user.*`, clona o repo de bundles e grava o caminho em
   `perfil/perfil.json`.
3. Auditoria de caminhos fixos no núcleo (~22 arquivos: 16 skills, hook, docs, `.claude`) →
   caminho relativo à raiz ou chave em `perfil/perfil.json` (padrão `caminhos.bundles`).
   Abstrair `adv_env\Scripts\python.exe` (Win) × `adv_env/bin/python` (macOS).
4. Monitor DJEN continua só na máquina da titular (um vigia por escritório); launchd depois.

## Fase 3 — Onboarding do usuário novo (entrevista)

1. `USER.md` vira genérico: só regras de comunicação/operação do escritório (redação neutra,
   sem identificar a titular).
2. `perfil/usuario.md` (gitignored) = identidade de quem usa a máquina.
3. Skill de onboarding: `session-start.js` detecta ausência de `perfil/usuario.md` → entrevista
   (nome, OAB, comarcas, áreas, tratamento) → gera `perfil/usuario.md`, atualiza
   `perfil/advogados.json`, configura git. Reaproveitável no white-label.

## Fase 4 — Conteúdo: migração para bundles + casos para o Drive

1. Diff automatizado acervo local × bundles; migrar o que falta (certeza: `juros_abusivos`
   14 arquivos, `direito_digital` 18; conferir emprestimo/golpes/imobiliario/cobranca).
2. Promover peças vencedoras das pastas de caso a `casos_decididos/` do bundle (formato do
   schema).
3. Pastas de tema saem do workspace após conferência. Casos encerrados → Drive.
4. Fluxo alvo: peça gerada localmente → upload via `gws` para a pasta do cliente no Drive;
   equipe acessa por permissão de pasta (revogável, apagável — LGPD).

## Fase 5 — Triagem de skills (versionamento; nada é apagado da máquina)

- **Versionam (~27)**: tipografia-pma, peca-pma-builder, legal-orchestrator, legal-writer,
  legal-consistency-validator, pesquisa-djen, pdfmd, validador-extrato-pdf-excel,
  apelacao-cirurgica, pre-peticionamento (fundida com -drive), humanizer-forense,
  banca-revisora, conselheiros, diff-peca, ficha-rescisao-lote, inicial-rescisao-lote,
  analise-perfil, pedido_justica_gratuita, whisper-transcriber, heic-converter, docx (usada
  pelo /relatorio), gerador-cumprimento-sentenca, desmonetizacao-plataforma, orquestrador-loop,
  notebooklm, skill-creator.
- **Não versionam**: humanizer (genérica ≠ humanizer-forense), vulnerability-scanner,
  documentation-templates, brainstorming, skill-mcp-creator, audio-converter, pdf, xlsx,
  Scrapling-Skill, smart-browser-orchestrator, yt-search, pptx-generator,
  brand-voice-generator, remotion, academic-writer-br, artigo-jornalistico-persuasivo,
  linkedin-profile-optimizer.
- **Pendente (titular decide)**: browser-use / agent-browser — versionar se o fluxo NotebookLM
  depender delas.
- Skills de marketing migram para o repo da Fase 8 (hoje ficam sem backup — resolver lá).

## Fase 6 — Documentação

1. AGENTS.md: protocolo de leitura sem o passo "acervo local do tema-pai"; seção macOS
   (zsh/bash); regra de marketing (Fase 8).
2. README (leigo): incluir setup.js, onboarding, fluxo Drive. IA_CONTEXT: variantes macOS.

## Fase 7 — Publicação  ✅ EXECUTADA em 28/07/2026

- <https://github.com/anacarolmoraes/pma-workspace> (privado) — 495 arquivos
- <https://github.com/anacarolmoraes/arsenal-juridico> (privado) — 276 arquivos

**Consolidação do acervo:** os cinco repositórios que existiam (roteador + 4 bundles) viraram
um só. A equipe baixa dois projetos, não seis. O acervo em uso passa a ser
`D:\GITHUB\arsenal-juridico`, e o `setup.js` procura por ele primeiro.

> **Atualização de 31/07/2026 — a consolidação foi concluída.** Em 28/07 o `D:\GITHUB\bundles`
> original ficou no disco como backup, e isso se revelou um erro: era a cópia que os
> *working directories* montavam por padrão, ou seja, a que um agente lia primeiro. Como ela é
> anterior à auditoria LGPD do mesmo dia, ainda continha nome real de cliente em 4 arquivos e
> e-mail/telefone de advogado de terceiro em 7 `raw/` da cadeia golpe — a anonimização do
> arsenal era, na prática, parcial.
>
> Comparação arquivo a arquivo antes de mexer: **nenhum arquivo existia só lá** (o arsenal é
> superconjunto estrito) e as 11 divergências corriam todas a favor do arsenal. Movido para
> `D:\GITHUB\_arquivo\bundles-obsoleto-2026-07-31\`, com histórico git intacto e `LEIA-ME`.
> O fallback para ele foi removido do `descobrirBundles()` do `setup.js`, e o
> `.claude/settings.local.json` passou a apontar para a raiz do arsenal.

**Excluído do acervo na auditoria** (fica na máquina, não circula): 4 manuais/livros comerciais
em `direito/pecas/raw` (Lei 9.610/98 — as teses derivadas permanecem). Menções a nome de cliente
em 4 arquivos foram generalizadas.

**Cadeia "golpe" — anonimizada e republicada** (28/07, após decisão da titular): os 7 `.md` de
processo de outro escritório voltaram ao acervo com 147 supressões, conforme o critério agora
fixado na regra dura 10 do [`AGENTS.md`](../AGENTS.md). Os PDFs continuam fora — binário não se
redige com segurança. Medido antes de publicar: `lint-bundle` mantém os mesmos 26 erros
pré-existentes (nenhum novo) e as transcrições das páginas de trabalho já eram anônimas, então
o `lint-citacoes` não passa a divergir.

**Regressão encontrada e corrigida:** ao mover os caminhos de máquina para `ambiente.json`, o
`lint-citacoes` continuou lendo `perfil.caminhos.bundles` e falhava em silêncio — sem acervo no
corpus, citação a precedente de tribunal superior cairia em `NAO_ENCONTRADA` e **bloquearia a
peça sem motivo real**. Lição: ao mover uma chave de configuração, procurar quem a lê
(`git grep`), porque o `catch` silencioso esconde a quebra.

1. ~~Criar 2 repositórios **privados** no GitHub: `pma-workspace` e `arsenal-juridico`; push.~~
2. `KnowledgeOperatingSystem` = 3º repo privado (só quem produz bundle clona).
3. Convidar a equipe (Collaborators); cada colega: clone + setup.js + entrevista.

## Fase 8 — Marketing (repo próprio: `pma-marketing`)

**Arquitetura**: 4º repo privado — skills de marketing (pptx-generator, brand-voice-generator,
remotion, yt-search, linkedin-profile-optimizer, artigo-jornalistico-persuasivo,
academic-writer-br) + `artigos/` + fila de pautas. Consome bundles como matéria-prima pelo
mecanismo do `perfil.json`. Não mora no motor nem nos bundles.

**Fontes de conteúdo (LGPD inegociável)**:
- Jurisprudência de terceiros (bundle `jurisprudencia/`, teses): decisão pública comentada —
  risco zero, fonte preferencial.
- Casos decididos próprios: **nunca por cópia** — só via portão estrutural.

**Portão estrutural** — skill `caso-para-conteudo`:
1. Despersonalização: sem nome, sem CPF, **sem número CNJ** (o número identifica as partes em
   uma consulta pública; a peça precisa dele, o post não pode tê-lo).
2. Generalização de atributos (comarca pequena reidentifica: "consumidor do interior do TO",
   período vago).
3. `lint-lgpd`: varre CPF, nº CNJ e cruza o texto com a lista de nomes de `clientes/`
   (detector automático de nome de cliente).
4. `lint-oab`: Provimento 205/2021 — sem promessa de resultado, sem mercantilização,
   sem sensacionalismo.
5. Aprovação humana da titular, sempre. Post que não compila não publica.

**Complementos**:
- Cláusula opcional de consentimento no contrato de honorários (uso anonimizado para fins
  educativos) — base legal LGPD explícita.
- Pauta automática: vitória/tese nova no bundle → item na fila de pautas (padrão
  `PENDENTES.md` do monitor DJEN).
- Fluxo reverso: artigo bom promove-se a tese/heurística no bundle.
- Futuro: o próprio motor de conteúdo é vendável (white-label), separado do motor de peças.

## Ordem de execução

Fases 1→7 em sequência; Fase 8 depois do push dos dois primeiros repos. Portões: nenhum push
antes da Fase 1 concluída; nenhuma exclusão de pasta de tema antes do diff da Fase 4 conferido
pela titular.

---
name: consumir-canal-youtube
description: Consome canal jurídico do YouTube e monta uma KB de canal (camada de consumo) em D:\GITHUB\kb-youtube\<canal>, com curadoria anti-repetição — um conceito = uma página sintetizando todos os vídeos, o mais recente prevalece. Incremental por youtube_id — vídeo já consumido nunca é baixado/processado de novo, mesmo pedindo o canal inteiro outra vez. Usar quando o usuário pedir para consumir/ingerir canal ou vídeos do YouTube, montar KB de canal, ou atualizar uma KB existente. NÃO escreve no arsenal-juridico — promoção é manual, via portão de conferência oficial.
---

# Consumir canal do YouTube (KB de canal)

Transforma um canal jurídico do YouTube numa KB sintetizada e navegável — **antessala** do
`arsenal-juridico`, nunca o arsenal em si. Arquitetura herdada do `cole-medin-knowledge-base`
(*extract wide → canonicalize once → write wide*), adaptada: legendas pt, recência como
superação (não contradição), jurisprudência citada nasce `verificado: false`.

**Saída:** `D:\GITHUB\kb-youtube\<canal-slug>\` (uma pasta por canal).
**Processo completo:** ler [references/pipeline-juridico.md](references/pipeline-juridico.md)
antes de qualquer fase de LLM. Este arquivo cobre só a operação.

## Garantia de não-repetição (inegociável)

- O **fetch** usa `raw/manifest.json` como livro-razão, chaveado por `youtube_id`. Rodar de
  novo — até "consuma o canal todo novamente" — só baixa o que não está no razão. Vídeos sem
  legenda ficam registrados e também não são re-tentados (só com `--tentar-sem-legenda`).
- O **extract** pula todo `scripts/extractions/<slug>.json` existente.
- O **write** nunca duplica página: vídeo novo que toca conceito existente **estende** a página.
- Nunca apagar `manifest.json` nem `scripts/extractions/` para "recomeçar limpo" sem ordem
  expressa da titular.

## Passo 1 — Fetch (sem LLM)

```bash
uv run skills/consumir-canal-youtube/scripts/fetch_transcripts.py @Canal \
  --output-dir D:/GITHUB/kb-youtube/<canal-slug>/raw
```

- `--limit N`: só os N vídeos mais recentes (a aba /videos lista do mais novo para o mais velho).
- `--delay 3.0` se aparecer erro 429.
- `--lang en,en-US` para canal em outra língua (default: `pt,pt-BR,pt-PT`). As **páginas** da
  KB são sempre escritas em português, seja qual for a língua do canal.
- Primeira rodada de um canal: começar com `--limit 10-15` (piloto), nunca o catálogo inteiro
  sem triagem — a maior alavanca de custo é não ingerir vídeo irrelevante.
- **Qualidade da legenda:** legenda automática de canal brasileiro frequentemente vem
  contaminada de pt-PT ("aceder", "comprovativo", "o gajo") e corrompe termo técnico
  ("vereador" por devedor, "penora", "imemorabilidade"). O `raw/` é imutável e fica como
  veio, mas as **páginas** são sempre pt-BR normativo (o lint pega vocábulo pt-PT — E6) e
  toda sigla/número vindo de legenda é suspeito por padrão. Contaminação pesada em vídeo
  importante: transcrever com `whisper-transcriber` e depositar o `.md` em `raw/`.

## Entrevista de primeira rodada (língua + finalidade — UMA pergunta, UMA vez por canal)

**Antes do primeiro fetch de um canal novo**, fazer uma única pergunta à titular com os dois
itens (nunca duas interrupções):

1. **Língua do canal** — default `pt`. Se a titular não souber ou não responder, detectar
   sozinho listando as legendas do vídeo mais recente:
   `uv run --with yt-dlp yt-dlp --skip-download --list-subs <url-do-video>` — e confirmar na
   própria pergunta ("detectei legendas em espanhol, confere?"). A resposta vira o `--lang`
   do fetch.
2. **Finalidade** — `arsenal | marketing | outra`. Com `arsenal`, cada conceito ganha
   `bundle_destino` (a subárea que ele alimentaria) e a KB gera `FILA_PROMOCAO.md`. Com
   outra finalidade, `bundle_destino: nenhum` e **sem** fila — a KB é só referência
   navegável para o uso que a titular definir.

Registrar as duas respostas no frontmatter do `index.md` raiz da KB (`lingua:` e
`finalidade:`). **Rodadas seguintes do mesmo canal não perguntam nada** — leem dali. Só
re-perguntar se a titular mandar mudar.

## Passo 2 — Pipeline de conhecimento (LLM, dividido por modelo)

Seguir `references/pipeline-juridico.md`. Resumo da divisão:

| Fase | Modelo |
|---|---|
| Extract (JSON por vídeo, lotes ~10) | barato (Haiku) — sessão barata serve |
| **Canonicalize (1 vez)** | **forte (Sonnet+)** — é a curadoria; não economizar aqui |
| **Write + índices + `FILA_PROMOCAO.md`** | **forte (Sonnet+)** — é onde nasce prosa e citação; modelo barato inventou súmula e trocou pessoas na rodada 1 do piloto |

**Como operar a divisão (dois modos):**

- **Modo A (recomendado, sem intervenção):** sessão única com modelo médio/forte; o agente
  despacha só o **Extract** para sessões paralelas com modelo pequeno, em lote (mesmo padrão da
  `radar-jurisprudencia`) e faz Canonicalização e Write ele próprio. A titular não troca nada.
- **Modo B (sessão no modelo barato):** o agente roda Fetch + Extract e, ao terminar,
  **PARA e avisa a titular**: "Fase 1 concluída (N extrações). As Fases 2–4 (canonicalização,
  redação, índices) exigem modelo forte — troque com /model ou abra sessão forte e peça para
  continuar." **A única fase de LLM permitida em modelo barato é o Extract.** É proibido
  canonicalizar OU redigir páginas em modelo barato, por conta própria ou por pedido genérico
  ("continue o pipeline"). O estado entre sessões são os artefatos em disco (extractions/,
  manifests) — qualquer sessão retoma de onde parou.

**Trava anti-invenção (vale para qualquer modelo — ver regra dura 4):** página nenhuma cita
súmula, artigo, julgado, sigla de sistema, nome de empresa ou ferramenta que não esteja na
transcrição em `raw/` do vídeo fonte. Conhecimento externo do modelo só entra rotulado como
`> **Nota de curadoria (não dito no vídeo):**`. O `lint-kb.py` bloqueia citação legal sem
âncora no `raw/` (E5) — não é opcional. Depois de conferir um inteiro teor (Fase 6), a
citação se libera declarando-a em `citacoes_conferidas:` no frontmatter da página.

## Passo 3 — Validar

```bash
python skills/consumir-canal-youtube/scripts/lint-kb.py D:/GITHUB/kb-youtube/<canal-slug>
```

Zero erros antes de encerrar; registrar a rodada no `log.md` da KB.

## Limites (regras duras)

1. Esta skill **não escreve no arsenal-juridico**. Promoção = Fase 6 do pipeline: conferência
   na fonte oficial → correção da página do KB pelo inteiro teor → `citacoes_conferidas:` →
   página no schema do arsenal (`em_teste`) → `lint-bundle.py` → marcar na `FILA_PROMOCAO.md`.
2. **Nada de YouTube vira `vigente` sem conferência oficial.** Legenda automática corrompe
   número de processo (e o autor pode citar errado). Citação verbatim da KB é proveniência
   (onde no vídeo), nunca autoridade.
3. Vídeo sem legenda não paga transcrição por padrão; se um vídeo específico valer muito,
   usar `whisper-transcriber` local e depositar o `.md` em `raw/` no mesmo formato.
4. **Proibido inventar.** Nenhuma página afirma o que a transcrição não diz: número ou texto
   de súmula/artigo/julgado, sigla de sistema, nome de empresa/ferramenta, biografia ou
   atribuição de fala. Paráfrase de texto legal é proibida — registrar apenas a "tese dita
   no vídeo". Conhecimento externo só rotulado `> **Nota de curadoria (não dito no vídeo):**`.
   Em entrevista/podcast, identificar quem fala (apresentador × convidado) antes de atribuir
   trajetória ou tese — na rodada 1 do piloto o modelo barato atribuiu ao titular a
   biografia de um convidado e "corrigiu" o nome real da apresentadora como se fosse erro
   de legenda.
5. Canonicalize e Write só em modelo forte (Sonnet+). Sessão barata para no fim do Extract
   e avisa a titular — sem exceção, mesmo que o pedido seja "termine o pipeline".

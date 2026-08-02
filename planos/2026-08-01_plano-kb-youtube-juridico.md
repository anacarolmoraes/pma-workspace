# Plano — Consumo de canais do YouTube para complementar o arsenal-juridico

> Status: **planejado** (execução adiada; será feita com modelo mais barato).
> Referência analisada: `PROJETOS_ANALISE/cole-medin-knowledge-base` (OKF + wiki estilo Karpathy).
> Canal-piloto: **@JoseAndradeneto** (conteúdo jurídico).

## Decisões de arquitetura

1. **O que aproveitar do projeto do Cole Medin (3 coisas, nada mais):**
   - `fetch_transcripts.py` (variante yt-dlp) — pronto, grátis, sem API key. Única mudança
     obrigatória: `subtitleslangs: ["en"]` → `["pt", "pt-BR", "pt-orig"]` (linha 146).
   - O **pipeline de duas passadas** — *extract wide → canonicalize once → write wide*.
     A canonicalização com manifesto congelado é exatamente a curadoria anti-repetição
     que motivou a análise. É a peça de maior valor do projeto.
   - A disciplina de validação (lint de links, cobertura de índice, órfãos) — mas
     **adaptada ao nosso `lint-bundle.py`**, não copiando o `lint.py` deles.

2. **O que NÃO fazer:** adotar OKF como segundo sistema de conhecimento. O arsenal já tem
   schema próprio (teses/jurisprudencia/heuristicas/playbooks + `status: vigente|em_teste`).
   A KB de canal é **camada de consumo** (tema-pai bruto, como `raw/modelos-scavone`),
   com **promoção sob demanda** para os bundles (padrão da Fase C já aprovada para o Scavone).

3. **Onde mora:** repositório/pasta própria por canal, fora dos bundles —
   `D:\GITHUB\kb-youtube\jose-andrade-neto\` (um canal cobre várias matérias; não cabe
   dentro de um bundle só). O `index.md` da KB aponta, por conceito, **qual bundle do
   arsenal ele alimentaria**.

4. **Regra de ouro (anti-lavagem de citação):** nada vindo de YouTube entra no arsenal
   como `vigente`. Legenda automática em pt erra número de processo, tema e nome de
   instituto (já vimos o próprio TJTO errar Tema 577→557). Jurisprudência citada em vídeo
   é **pista, não fonte**: só promove após conferência via `radar-jurisprudencia`/fonte
   oficial. Até lá, fica na KB com origem marcada (`fonte: youtube`, slug do vídeo, timestamp).

5. **Recência (pedido da titular):** direito não é "contradição entre vídeos", é
   **superação**. Na canonicalização: quando dois vídeos divergem, prevalece o mais novo
   (campo `published` do manifest), com nota `> **Superado:**` apontando o antigo.
   Data do vídeo ≠ direito vigente hoje — a conferência oficial do item 4 continua valendo.

## Divisão por modelo (economia de tokens)

| Fase | Paralelizável | Modelo |
|---|---|---|
| Fetch (yt-dlp) | — | sem LLM |
| Triagem de vídeos (título/duração/data do manifest) | — | barato (Haiku) |
| Extract (JSON por vídeo) | sim | barato (Haiku) |
| **Canonicalize (dedup + taxonomia + recência)** | **não — 1 vez** | **forte (Sonnet+)** |
| Write (páginas contra o manifest congelado) | sim | barato (Haiku) |
| Lint/índices | — | sem LLM |

A canonicalização é onde a curadoria acontece; fazê-la com modelo fraco destrói
justamente o que se quer aproveitar. Como roda **uma vez** sobre JSONs compactos
(não sobre transcrições), o custo é pequeno.

**Maior alavanca de custo não é o modelo, é a triagem:** não ingerir o catálogo inteiro.
Piloto com 10–15 vídeos (mais recentes + mais relevantes para bundles existentes:
imobiliário, bancário, consumidor, técnica de peça).

## Adaptações no schema de extração (jurídico ≠ tech)

Além de `concepts`/`entities`, o JSON de extração ganha campos:
- `institutos` (conceito jurídico: prescrição intercorrente, evicção…)
- `jurisprudencia_citada`: `{tribunal, classe_numero, tema_repetitivo?, tese_dita_no_video, ts}` — sempre `verificado: false`
- `dispositivos`: `{diploma, artigo, ts}`
- `teses_praticas` (o "como fazer" que vira candidato a heurística/playbook)

## Fases de execução (quando autorizada)

1. **Preparo** — criar `kb-youtube/`, copiar e adaptar `fetch_transcripts.py` (langs pt,
   slugs sem acento), escrever `SCHEMA.md` enxuto da camada de consumo (herda conceitos do
   OKF, aponta para o schema do arsenal).
2. **Piloto** — `--limit` na enumeração do @JoseAndradeneto, triagem por título/data,
   fetch de 10–15 vídeos.
3. **Extract** (modelo barato, lotes de ~10).
4. **Canonicalize** (modelo forte, 1 vez): dedup, recência/superação, mapa
   conceito→bundle-destino.
5. **Write + índices + lint** (modelo barato).
6. **Portão de promoção** — item que interessar a um caso concreto: conferir na fonte
   oficial → aí sim entra no bundle do arsenal pelo schema normal.
7. **Incremental** — vídeos novos entram pelo fluxo por-transcrição (o doc
   `ingestion-workflow.md` deles já descreve; adaptar). Automatizar só depois do piloto.

## Riscos assumidos

- Legenda automática sem pontuação e com termos jurídicos corrompidos → citações verbatim
  servem de **proveniência** (onde no vídeo), nunca de autoridade.
- Canal pode ter vídeos sem legenda → ficam de fora (não pagar transcrição por enquanto;
  se um vídeo específico valer muito, `whisper-transcriber` local resolve).
- Conteúdo de terceiro: KB é sintetização com citação de fonte, uso interno; transcrição
  bruta fica em `raw/` local — avaliar `.gitignore` como no padrão Scavone antes de subir.

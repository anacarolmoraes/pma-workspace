# Pipeline jurídico: de transcrições brutas a KB de canal (camada de consumo)

Adaptação do pipeline de duas passadas do `cole-medin-knowledge-base`
(*extract wide → canonicalize once → write wide*) para canais jurídicos brasileiros.
A saída é uma KB em `D:\GITHUB\kb-youtube\<canal>\` — **camada de consumo**, nunca o
arsenal. O arsenal só recebe conteúdo pelo **portão de promoção** (§6).

Estrutura da KB (nomes de pasta em inglês de propósito — o `lint-kb.py` e o padrão OKF
dependem deles; o conteúdo é todo em português):

```
kb-youtube/<canal>/
├── index.md            # raiz: temas, conceitos e o mapa conceito→bundle-destino
├── FILA_PROMOCAO.md    # fila de candidatos a promoção (§5) — type: overview
├── log.md              # histórico de ingestão (reservado, sem frontmatter)
├── concepts/           # institutos, teses de conteúdo, técnica (1 página por ideia)
├── entities/           # tribunais/, pessoas/, leis/
├── sources/            # 1 resumo por vídeo (proveniência)
├── raw/                # transcrições imutáveis + manifest.json (livro-razão do fetch)
└── scripts/extractions/  # JSONs da Fase 1 (estado incremental — nunca apagar)
```

## Regra de incrementalidade (vale para TODAS as fases)

Cada fase tem um artefato de estado; existir = já processado, **pular**:

| Fase | Artefato de estado | Re-processar só se… |
|---|---|---|
| Fetch | `raw/manifest.json` (chave: `youtube_id`) | nunca (o script já garante) |
| Extract | `scripts/extractions/<slug>.json` | o arquivo não existir |
| Write | página citar o slug em `videos:`/`## Fontes` | vídeo novo tocar página existente (aí **estende**, não reescreve) |

Pedido de "consumir o canal todo de novo" ⇒ rodar o fluxo normal: o fetch pula tudo que
está no manifest, o extract pula JSONs existentes, e só entra o que for novo. Nunca
apagar `manifest.json` ou `scripts/extractions/` para "começar limpo" sem ordem expressa
da titular.

## Divisão por modelo (economia de tokens)

| Fase | Paralelizável | Modelo |
|---|---|---|
| Fetch / triagem por título | — | sem LLM / barato |
| Extract (JSON por vídeo) | sim, lotes de ~10 | **barato (Haiku)** |
| Canonicalize | não — 1 vez | **forte (Sonnet+)** — é onde mora a curadoria |
| Write | sim, lotes de ~7 | **forte (Sonnet+)** — é onde nasce prosa e citação |
| Índices / lint | — | sem LLM |

**Portão de modelo:** a única fase de LLM permitida em modelo barato é o **Extract**. Se a
sessão corrente estiver num modelo barato, ao fim do Extract, parar e avisar a titular para
trocar de modelo (`/model`) ou continuar em sessão forte — vale também para o Write, não só
para a Canonicalização (na rodada 1 do piloto, o Write em Haiku fabricou uma súmula com o
sentido invertido, trocou a atribuição de pessoas e deixou uma dúzia de erros de português).
O estado vive em disco (`scripts/extractions/`), então qualquer sessão retoma sem perda.
Numa sessão média/forte, despachar só o Extract para subagentes Haiku; Canonicalize e Write
ficam na sessão principal.

**Finalidade do canal:** registrada no `index.md` raiz da KB (`finalidade: arsenal |
marketing | outra`). Canal fora do arsenal (ex.: marketing jurídico, conteúdo em outra
língua): `bundle_destino: nenhum`, sem `FILA_PROMOCAO.md` e sem Fase 6 — a KB termina na
Fase 5 como referência navegável. As páginas são sempre escritas em português,
independentemente da língua do canal (citações verbatim ficam na língua original).

## Fase 1 — Extract (por vídeo)

Ler `raw/<slug>.md` inteiro e emitir `scripts/extractions/<slug>.json`:

```json
{
  "slug": "...",
  "published": "AAAA-MM-DD",
  "tese_do_video": "uma frase",
  "resumo": "2-3 parágrafos",
  "tags": ["3-7 tags"],
  "momentos_chave": [{"ts": "H:MM:SS", "nota": "..."}],
  "conceitos": [{
    "slug": "kebab-sem-acento", "nome": "Nome",
    "definicao": "uma frase", "tags": [],
    "citacoes": [{"ts": "H:MM:SS", "texto": "verbatim ≤240 chars"}],
    "relacionados": ["outros-slugs"],
    "bundle_destino": "direito/<subarea> do arsenal | marketing | nenhum"
  }],
  "jurisprudencia_citada": [{
    "tribunal": "STJ", "classe_numero": "REsp 9.999.999/SP",
    "tema_repetitivo": "opcional", "tese_dita_no_video": "o que o vídeo afirma",
    "ts": "H:MM:SS", "verificado": false
  }],
  "dispositivos": [{"diploma": "CPC", "artigo": "art. 82, §3º", "ts": "H:MM:SS"}],
  "teses_praticas": [{"descricao": "o 'como fazer' dito no vídeo", "ts": "H:MM:SS"}],
  "entidades": [{"slug": "stj", "nome": "STJ", "subtipo": "tribunal|pessoa|lei", "citacoes": []}]
}
```

Regras: citações **verbatim** com timestamp real; extrair só o que o vídeo ensina de
substancial (5–20 conceitos); ignorar patrocínio, autopromoção e menção de passagem.
`jurisprudencia_citada` SEMPRE nasce `"verificado": false` — legenda automática corrompe
número de processo e tema; isso é pista, não fonte.

Mais duas regras nascidas do piloto:

- **Quem fala:** em entrevista/podcast, registrar no JSON quem é o apresentador e quem é o
  convidado (os nomes aparecem na abertura). Trajetória e tese pertencem a quem as diz —
  nunca presumir que tudo é do titular do canal, nem tratar nome desconhecido como
  corrupção de legenda.
- **Legenda contaminada:** legenda automática vem muitas vezes em pt-PT e corrompe termos
  ("vereador" por devedor, "penora"). A citação verbatim fica como está no raw; sigla e
  número são suspeitos por padrão e o Extract não os "corrige" por conta própria — anota a
  grafia divergente.

## Fase 2 — Canonicalize (1 vez, a barreira — modelo forte)

Carregar todos os JSONs e congelar o manifesto (`scripts/manifest-taxonomia.json`):

1. **Agregar** candidatos por slug normalizado (variantes de nome juntas).
2. **Deduplicar** — `resolucao-contratual` + `rescisao-contrato` → um slug canônico.
3. **Limiar de página**: ≥2 vídeos OU 1 deep-dive substancial; abaixo disso vira menção
   dentro de página-mãe.
4. **RECÊNCIA (regra do domínio):** divergência entre vídeos raramente é "contradição";
   em direito costuma ser **superação**. Prevalece o vídeo mais novo (`published`);
   o entendimento antigo fica registrado na página com nota `> **Superado:**` citando
   vídeo e data dos dois. Divergência real de opinião (não temporal) usa `> **Divergência:**`.
5. **Mapa conceito→bundle-destino** por voto majoritário das extrações (é o que alimenta
   o índice-raiz e a fila de promoção).
6. Congelar. Depois disso, quem escreve não decide mais nada de estrutura.

Numa rodada incremental (poucos vídeos novos), a canonicalização é **delta**: carregar o
manifesto congelado + só os JSONs novos; conceito existente ganha fonte nova, conceito
inédito passa pelo limiar normal.

## Fase 3 — Write (contra o manifesto, modelo barato)

Formato das páginas: igual ao `pipeline-guide.md` do projeto original (frontmatter com
`type`, links **relativos**, seções tipadas, `## Fontes` obrigatória com citação
timestampada por vídeo). Diferenças jurídicas:

- Página de conceito ganha, quando houver, seções `## Jurisprudência citada no canal`
  (tabela: tribunal, número, tese dita, vídeo/ts, `verificado`) e `## Dispositivos`.
- Página existente tocada por vídeo novo é **estendida**: nova fonte em `## Fontes`,
  prosa refinada, recência aplicada (§ Fase 2.4). Nunca duplicar página.

**Trava anti-invenção (inegociável, checada pelo lint):**

1. Página só afirma o que a transcrição diz. Súmula, artigo, julgado, sigla de sistema,
   nome de empresa ou de ferramenta que não esteja no `raw/` do vídeo fonte **não entram**
   como conteúdo do canal — o lint bloqueia citação legal sem âncora no raw (E5).
   Há exatamente três saídas legítimas, todas explícitas: blockquote/nota de curadoria,
   seção cujo título contenha "curadoria" ou "verifica", e a declaração
   `citacoes_conferidas:` no frontmatter (ver §Fase 6).
2. **Proibido parafrasear ou "citar" texto de lei/súmula.** Registrar apenas a tese *dita
   no vídeo*, com `verificado: false`. Texto normativo só entra na Fase 6, copiado da
   fonte oficial.
3. Conhecimento externo do modelo (dispositivo provável, ferramenta usual, contexto) só
   entra rotulado: `> **Nota de curadoria (não dito no vídeo):** …`. Sem o rótulo, é
   invenção.
4. Páginas em **pt-BR normativo** — vocábulo pt-PT herdado da legenda é erro (E6). Erro
   de português na prosa é defeito de fase, não detalhe.
5. Placeholder (`0:XX`, `[não especificado]` quando o dado existe no raw) não sobrevive à
   rodada (E7).

## Fase 4 — Índices + FILA_PROMOCAO.md

- `index.md` por pasta + raiz com `okf_version: "0.1"`, temas e a coluna
  **bundle-destino** por conceito.
- `FILA_PROMOCAO.md` (frontmatter `type: overview`): por bundle-destino, os candidatos
  ordenados por recência — conceito/jurisprudência, uma linha de justificativa, vídeo(s)
  fonte, status (`aguardando | promovido | descartado`). Rodada incremental atualiza a
  fila, preservando os `promovido`/`descartado` já marcados.

## Fase 5 — Validar

```
python <skill>/scripts/lint-kb.py D:/GITHUB/kb-youtube/<canal>
```

Corrigir todo erro antes de encerrar a sessão. Registrar a rodada em `log.md`. Além dos
checks estruturais (E1–E4), o lint audita conteúdo: E5 citação legal sem âncora no `raw/`,
E6 vocábulo pt-PT em página, E7 placeholder `0:XX`.

## Fase 6 — Portão de promoção para o arsenal (manual, sob demanda)

A skill **não** escreve no arsenal. Quando um item da fila interessar a um caso concreto:

1. Conferir na fonte oficial (`radar-jurisprudencia`, inteiro teor, Planalto). PDF de
   acórdão passa pelo `pdfmd` e fica com `.md` irmão — leitura de PDF sem isso é proibida.
2. **Corrigir a página do KB com o que o inteiro teor disser**, ainda na camada de consumo.
   Ler o acórdão quase sempre desmente alguma moldura do vídeo (o canal costuma vender
   como "virada" o que é jurisprudência consolidada). O que o vídeo diz fica como tese
   dita; o que o acórdão diz vira a seção `## Verificação em fonte oficial`, com verbatim,
   número completo, turma, relator e data de publicação.
3. Declarar no frontmatter da página a lista `citacoes_conferidas:` — um item por
   súmula/artigo/julgado cujo inteiro teor foi efetivamente lido. É o que libera o E5 do
   lint para aquele número naquela página. **Declarar sem ter lido é fraude de auditoria**;
   a lista é a assinatura de quem conferiu.
4. Escrever a página **no schema do arsenal** (tese/jurisprudência/heurística, `status:
   em_teste` até inteiro teor conferido), proveniência dupla: fonte oficial (autoridade)
   + vídeo/timestamp (origem da pista).
5. `python lint-bundle.py` no arsenal; marcar `promovido` na `FILA_PROMOCAO.md`.

**Nada vindo de YouTube entra no arsenal como `vigente` sem conferência oficial. Sem exceção.**

### Formato de `citacoes_conferidas`

```yaml
citacoes_conferidas:
  - "REsp 2.192.857/DF — inteiro teor lido em 2026-08-02"
  - "art. 833, IV, CPC/2015"
  - "Súmula 568/STJ"
```

O lint extrai só os números; o texto ao redor é para quem lê. Sem a declaração, a citação
tem de estar na transcrição ou dentro de nota de curadoria/seção de verificação.

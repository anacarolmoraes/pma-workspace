---
name: pesquisa-djen
version: 1.0.0
description: |
  Consulta pública de comunicações processuais (DJEN — Diário de Justiça Eletrônico
  Nacional, via API Comunica/PJe) e de metadados/movimentos de processos (API Pública
  DataJud/CNJ). Use para: obter a data de disponibilização de uma intimação/publicação,
  listar comunicações por processo ou por OAB, consultar capa e movimentos de um processo,
  e calcular data fatal de prazo recursal a partir da intimação no DJEN (script prazo.js).
---

# pesquisa-djen — Consulta DJEN + DataJud (APIs públicas CNJ)

## Quando acionar
- Precisa da **data de disponibilização** de uma intimação/publicação no DJEN (ex.: termo inicial de prazo recursal).
- Precisa listar comunicações de um processo ou de um(a) advogado(a) (por OAB) em um período.
- Precisa de capa/movimentos de um processo (DataJud) — ex.: conferir fase, órgão julgador, últimas movimentações.
- Precisa calcular **data fatal** de prazo em dias úteis a partir da intimação (`prazo.js`).

## Backends (duas APIs distintas — não confundir)

| API | O que tem | Endpoint | Auth |
|---|---|---|---|
| **DJEN / Comunica (PJe)** | Intimações, citações e publicações com `data_disponibilizacao`, texto integral, destinatários, advogados | `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao` | Nenhuma |
| **DataJud (CNJ)** | Capa do processo + movimentos (TPU): classe, órgão julgador, `movimentos[].dataHora` | `POST https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search` (ex.: `api_publica_tjto`, `api_publica_stj`) | Header `Authorization: APIKey <chave pública>` |

- Chave pública DataJud: publicada em `https://datajud-wiki.cnj.jus.br/api-publica/acesso/` (pode ser trocada pelo CNJ a qualquer tempo — se der 401, buscar a nova lá; os scripts aceitam override via env `DATAJUD_API_KEY`).
- Número de processo: **somente dígitos** (20 dígitos CNJ) nas duas APIs. `prazo.js`/`djen.js` aceitam com máscara e limpam sozinhos.
- O DataJud **não** traz intimações do DJEN; o DJEN **não** traz movimentos. São complementares.

## Scripts (Node ≥ 18, sem dependências)

```powershell
# 1) Comunicações no DJEN (filtros combináveis)
node scripts/djen.js --processo 0014893-46.2025.8.27.2700 --tribunal TJTO --inicio 2026-06-01 --fim 2026-07-08
node scripts/djen.js --oab 6573 --uf TO --inicio 2026-07-01 --fim 2026-07-08     # tudo da advogada no período
node scripts/djen.js --processo <n> --texto                                       # inclui o texto integral (HTML)
node scripts/djen.js --processo <n> --out resultado.json                          # grava JSON completo em arquivo

# 2) Capa + movimentos no DataJud
node scripts/datajud.js --processo 0014893-46.2025.8.27.2700 --tribunal tjto
node scripts/datajud.js --processo <n> --tribunal stj --movimentos 10             # últimos 10 movimentos

# 3) Prazo a partir da intimação no DJEN (o mecanismo de data fatal)
node scripts/prazo.js --processo 0014893-46.2025.8.27.2700 --tribunal TJTO --dias 15
node scripts/prazo.js --processo <n> --tribunal <sigla> --dias 15 --data 2026-06-26  # ancorar em disponibilização específica
node scripts/prazo.js --processo <n> --tribunal TJTO --dias 15 --feriados feriados/tjto.json  # incluir feriados locais
```

## Monitor diário de intimações (vigilância do escritório)

```powershell
# 4) Vigia: comunicações novas no DJEN para as OABs de perfil/advogados.json
node scripts/monitor.js --dias 10    # exit 10 = há novas
```

**A fila `monitor/PENDENTES.md` é a fonte da verdade** — não o popup, que só aparece com sessão interativa aberta e some ao ser fechado. O monitor **só acrescenta** linhas; quem troca `ABERTA` por `TRATADA` é a titular.

### Os dois prazos de cada linha

Cada linha traz o termo inicial e **dois** prazos de referência, ambos em dias úteis contados do mesmo termo inicial (`lib/prazo-core.js`):

| Coluna | Prazo | Base |
|---|---|---|
| `embargos` | 5 d.ú. | CPC, art. 1.023 |
| `fatal` | 15 d.ú. | recurso cível comum |

A coluna de embargos depende do **tipo do documento** (`lib/tipo-documento.js`), porque embargos cabem de decisão (CPC, art. 1.022) e de despacho não cabe recurso algum (art. 1.001):

| Valor na coluna | Significa |
|---|---|
| `**2026-08-03**` | decisão, sentença ou acórdão — prazo de embargos correndo |
| `2026-08-03 ?` | rótulo ambíguo ("Outros") — prazo calculado, **cabimento a conferir** |
| `n/a` | ato ordinatório, despacho, intimação — não cabem embargos |

Contagem regressiva onde não cabe recurso é ruído, e ruído ensina a ignorar o alerta — daí a classificação.

⚠️ **No Juizado Especial o recurso inominado é de 10 dias** (Lei 9.099/95, art. 42), não 15: a coluna `fatal` é referência de recurso cível comum e precisa ser conferida contra o ato concreto.

### A busca é NACIONAL — regra dura

O escritório atua no Brasil inteiro. A consulta ao DJEN usa **apenas a OAB** (`numeroOab` + `ufOab`) e recebe o que vier de qualquer tribunal — a fila já traz TJTO, TJGO, TJMG e TJSP. `ufOab` é a seccional da inscrição, **não** filtro de tribunal.

**Nunca acrescentar `siglaTribunal` à query, nem uma lista de tribunais à configuração.** Intimação de tribunal fora do filtro não apareceria, e prazo perdido em silêncio é o pior modo de falha deste sistema. Não existe chave de filtro em `monitor-djen.json` por decisão de projeto.

Feriado local é assunto separado e não filtra nada: o cálculo procura `feriados/<sigla>.json` para o tribunal de cada intimação. Faltando o arquivo, a linha sai com `⚠ SEM FERIADO LOCAL`. **O erro é conservador** — sem os feriados locais a data fatal calculada é igual ou anterior à real, nunca posterior —, mas conferir no tribunal continua obrigatório.

A cada execução o monitor grava `monitor/cobertura.json` com os tribunais que apareceram e quais estão sem calendário, e o hook `SessionStart` mostra a lista na abertura. Para cobrir um tribunal novo, criar `feriados/<sigla>.json` a partir da portaria anual dele.

### Configuração

Tudo o que é ajustável mora em [`perfil/monitor-djen.json`](../../perfil/monitor-djen.json) — janela de busca, os dois prazos de referência, limiar de "prazo curto" e horas até o alarme de monitor parado. A linha de comando (`--dias`, `--prazo-ref`, `--prazo-edcl`) existe para teste pontual e vence o arquivo.

O que **não** se configura, por ser lei: contagem em dias úteis (CPC 219), publicação no 1º dia útil seguinte (Lei 11.419/2006, art. 4º, §3º), termo inicial no 1º dia útil após a publicação (CPC 224) e suspensão no recesso (CPC 220).

Fila criada antes de 28/07/2026 não tem a coluna de embargos. Para acrescentá-la (ou recalculá-la):

```powershell
node scripts\migrar-fila-embargos.js --dry-run   # mostra o que faria
node scripts\migrar-fila-embargos.js
```

Arquivos de estado em `monitor/`:

| Arquivo | Papel |
|---|---|
| `PENDENTES.md` | **a fila** — intimações não tratadas, com prazo calculado |
| `seen.json` | IDs já vistos (deduplicação; permite janela larga sem ruído) |
| `last_ok.json` | **dead man's switch** — última execução bem-sucedida; o hook `SessionStart` avisa se passar de 36 h |
| `cobertura.json` | tribunais que apareceram e quais estão sem calendário de feriado local — **diagnóstico, nunca filtro** |
| `novas_intimacoes.log` | histórico bruto, append-only |
| `erros.log` | falhas da API |

**OABs vêm de `perfil/advogados.json`** (campo `monitorar_djen`) — não há OAB hardcoded no script, por decisão de arquitetura. Quem entra nessa lista é definido na entrevista de primeiro uso (skill `onboarding-usuario`); para incluir ou remover alguém depois, peça "atualize meu perfil".

### Instalação da tarefa agendada

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\instalar_tarefa.ps1            # diária às 08:10
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\instalar_tarefa.ps1 -Hora 07:30
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\instalar_tarefa.ps1 -Remover
```

Usa `Register-ScheduledTask` e **não** `schtasks`: só assim se obtém `-StartWhenAvailable`, sem o qual a execução é simplesmente **perdida** quando a máquina está desligada no horário — o modo normal de uma máquina pessoal. O script é idempotente (reinstalável após formatação).

> **Zero LLM neste caminho.** Fetch HTTP + diff de IDs + contagem de dias úteis, tudo determinístico. Não é economia: é a garantia de que data fatal nunca sai de um modelo probabilístico.

## Regras de execução
1. **Console Windows:** saída é UTF-8; no PowerShell, acentos podem sair corrompidos (só na exibição). Para texto limpo, usar `--out arquivo.json` ou rodar via Bash. (Mesma classe de problema do pdfmd — ver memória `pdfmd-utf8-windows`.)
2. **`prazo.js` — o que calcula e o que NÃO calcula:** publicação = 1º dia útil após a disponibilização (art. 4º, § 3º, Lei 11.419/2006); termo inicial = 1º dia útil após a publicação (art. 224, §§ 2º-3º, CPC); conta dias ÚTEIS pulando fins de semana + feriados nacionais/forenses embutidos (tabela `FERIADOS` no script, preenchida para 2026; estender a cada ano) + recesso do art. 220 do CPC (20/12–20/01, prazos suspensos). Feriados locais: passar `--feriados feriados/<tribunal>.json` (manter os arquivos alimentados da **portaria anual** de cada tribunal — `feriados/tjto.json` existe como template e precisa de conferência anual). Sem o arquivo, o resultado sai com aviso e a data fatal deve ser conferida contra o calendário do tribunal antes do protocolo.
3. **Matéria penal:** prazo em dias corridos — `prazo.js` é para prazos em dias úteis (cível); não usar em penal sem ajuste.
4. Se o DJEN retornar mais de uma comunicação no período, `prazo.js` usa a mais recente e lista as demais — confira se a âncora é a intimação certa (campo `tipoDocumento`/trecho do texto).
5. Datas sempre `AAAA-MM-DD` nos parâmetros.

## Limites (fora do escopo)
- Não peticiona, não acessa autos sigilosos (dados públicos apenas), não substitui a conferência do eproc/DJEN oficial para fins de certidão.
- Púlpito oficial para certidão da comunicação: `https://comunicaapi.pje.jus.br/api/v1/comunicacao/{hash}/certidao` (PDF).

## Fontes da implementação
- Wiki DataJud: `https://datajud-wiki.cnj.jus.br/api-publica/` (acesso, endpoints, exemplos — verificada em 08/07/2026)
- Swagger DJEN/Comunica: `https://comunicaapi.pje.jus.br/` (verificada em 08/07/2026)

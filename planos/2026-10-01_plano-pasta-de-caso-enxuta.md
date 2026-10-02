# Plano — pasta de caso enxuta (01/10/2026)

**Problema.** A pasta `clientes/<caso>/` é aberta por gente leiga, e o pipeline deixa nela
cinco arquivos de máquina para cada documento real. Censo de 01/10/2026 em `clientes/`:
3.332 PNG (pastas `_assets` do `pdfmd`), 1.101 TXT (lotes do radar), 1.089 MD, 444 JSON,
contra 570 PDF e 87 DOCX. Na pasta do Sebastião: 25 PDF e 3 DOCX recebidos; 56 MD, 25 JSON e
53 PNG gerados.

**Princípio.** Quem abre a pasta sem ser agente vê PDF (o que chegou), DOCX (o que vai) e
`ANALISE.md` (o estado do caso). O resto é rastro, e rastro que nenhuma sessão futura relê
não persiste na pasta do cliente.

## As cinco sugestões e as notas

| # | Sugestão | Simplicidade | Poder | Risco | Final | Estado |
|---|---|---|---|---|---|---|
| 1 | Pasta `.ia/` por caso | 8 | 8 | baixo | 8 | **pendente** |
| 2 | Cache de PDF por hash | 5 | 9 | médio | 7 | pendente, só se a 1 não bastar |
| 3 | Uma peça, um arquivo | 6 | 5 | médio | 5 | pendente, talvez nunca |
| 4 | `ANALISE.md` único como painel | 9 | 8 | baixo | 9 | **executada 01/10** (74dcd70) |
| 5 | Faxina no `Stop` | 9 | 7 | baixo | 8 | **executada 01–02/10** (74dcd70, 0a8d3c2) |

## Executado (4 e 5)

- `ANALISE.md` é o único arquivo de estado do caso: bloco ```` ```json caso ```` (seção 0,
  lido por `qualificacao.js`), `processos:` e `prazos:` no frontmatter, documentos (7), radar
  (8), decisões da titular (9). Modelo em
  `skills/legal-orchestrator/references/ANALISE.template.md`. Não se cria mais
  `ANALISE_<data>.md`, `cronologia.md`, `DOCUMENTOS.md`, `caso.json`,
  `radar-jurisprudencia_<data>.md`. Regra em AGENTS.md §3.
- `scripts/caso.js` (`npm run caso [-- slug]`): painel por caso.
- `scripts/limpar-caso.js` (`npm run limpar`, `-- --apagar`, `--hook` no `Stop`): lista fechada
  de rastro com mais de 24 h. Duplicata idêntica só com `--duplicatas`; análise datada e
  conversão sem PDF só relatadas.
- Radar DJEN grava em `tmp/radar-djen/<caso>/`.
- Faxina de 01/10: 23 itens removidos. Restam, por decisão da titular: 13 arquivos datados
  (migram quando cada caso for retomado) e 1 duplicata em `sebastiao/contestacao/`.

## Pendente 1 — pasta `.ia/` por caso

**O que muda.** Tudo o que o `pdfmd` gera (`<doc>.md`, `<doc>.index.md`, `<doc>.pdfmd.json`,
`<doc>_assets/`) passa a viver em `clientes/<caso>/.ia/`, espelhando a árvore: o PDF em
`contestacao/x.pdf` converte para `.ia/contestacao/x.md`. A pasta visível fica com PDF,
DOCX e `ANALISE.md`. Marcar `.ia/` com atributo oculto do Windows (o Explorer não esconde
pasta com ponto).

**Arquivos que mudam** (todos portão: sessão com `PMA_MANUTENCAO=1`):

- `vendor/pdfmd/` e `skills/pdfmd/`: parâmetro de saída (ou convenção) que resolve
  `.ia/<caminho relativo>` quando o PDF está sob `clientes/`.
- `hooks/block-pdf.js`: procurar o `.md` irmão primeiro em `.ia/`, depois ao lado (legado).
- `hooks/block-md-integral.js`: idem para o `.pdfmd.json` irmão.
- `skills/pdfmd/scripts/ler-pdfmd.js`: resolver `--mapa` e assets pelo mesmo caminho.
- `skills/peca-pma-builder/scripts/lint-citacoes.js`: a fonte citada na peça
  (`fonte: contestacao/x.md`) resolve em `.ia/` antes de ao lado.
- `scripts/limpar-caso.js`: `_assets` órfã e sidecar sem PDF passam a olhar `.ia/`.
- `ANALISE.template.md` e `legal-orchestrator`: a cronologia cita `Doc. N` e o PDF, não o `.md`.

**Legado.** As 334 pastas `_assets` e os `.md` já existentes ao lado dos PDFs ficam onde
estão até o caso ser retomado; o `pdfmd` reconverte para `.ia/` e o `limpar-caso` ganha
regra para apagar o sidecar antigo quando o novo existir em `.ia/`. Não migrar em massa:
peças compiladas citam o caminho antigo no `fonte:` e o `lint-citacoes` quebraria.

**Teste de aceitação.** Converter um PDF novo em `clientes/<caso>/sub/`; o `Read` do PDF é
bloqueado e aponta `.ia/sub/<doc>.md`; `ler-pdfmd.js --mapa` funciona; uma peça com
`fonte: sub/<doc>.md` passa no `lint-citacoes`; `npm test` verde.

## Pendente 2 — cache de PDF por hash

Em vez de `.ia/` espelhando a árvore, a conversão vive em `clientes/.cache/<sha256 do PDF>/`.
Ganhos sobre a 1: PDF duplicado converte uma vez; o cache é descartável sem medo. Custo: toda
resolução de "md irmão" passa a exigir hash do PDF (hooks, `lint-citacoes`, `ler-pdfmd`), e a
fonte citada na peça deixa de ser um caminho legível. Só vale se, com a 1 feita, o volume
ainda incomodar. Fica dentro de `clientes/` para não ferir a regra dura 5.

## Pendente 3 — uma peça, um arquivo

`<PECA>.estrutura.md` e `<PECA>.validacao.md` viram seções do frontmatter da própria peça,
com o hash do corpo validado; o `md2docx` confere por hash em vez de data de modificação
(mais seguro que o "mais novo que a peça" atual). O `.md` da peça continua ao lado do `.docx`,
então o ganho para a leiga é pequeno; o custo é alto porque toca o `md2docx`, o
`stop-peca-compilada` e o `legal-consistency-validator`. Só depois da 1, e só se a titular
ainda achar a pasta poluída.

## Ordem recomendada

Deixar o hook de faxina rodar algumas semanas. Depois a 1, numa sessão de manutenção, com o
teste de aceitação acima. A 2 e a 3 ficam como opção, não como fila.

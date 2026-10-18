---
name: radar-jurisprudencia-stj
description: Pesquisa jurisprudência do STJ direto no SCON (scon.stj.jus.br), a partir de um tema, de uma tese ou de um julgado-semente, montando as consultas com os operadores oficiais do STJ, triando as ementas pelo sentido e trazendo o inteiro teor dos finalistas. Usar quando a titular pedir "julgado do STJ", "o que o STJ decide sobre X", precedente para sustentar recurso, apelação, contrarrazões ou EDcl, ou quando a peça precisar de STJ que o bundle do tema não tem. Traz favoráveis e contrários, porque o contrário diz de quem a peça precisa se distinguir. Para decisões recentes de outros tribunais, o caminho é o radar-jurisprudencia (DJEN).
---

# Radar de jurisprudência do STJ (SCON)

Busca **semântica**, não por palavra: o SCON devolve o que contém os termos, e cabe à skill
decidir se o julgado trata da **mesma questão jurídica num quadro de fatos parecido**. Um
julgado útil é o que serve à tese, não o que dá ganho de causa a quem representamos:
o contrário entra no dossiê como o argumento que o outro lado vai usar.

| | `radar-jurisprudencia` | esta skill |
|---|---|---|
| Fonte | DJEN (texto da intimação) | SCON (espelho e inteiro teor oficiais) |
| Alcance | todos os tribunais, recente | só STJ, de 1989 até a última publicação |
| Prova | trecho da publicação | PDF do acórdão, lido no voto |

## 1. Entender o caso antes de buscar

Sem tese não há "favorável". Antes de qualquer consulta:

1. **Ler as peças do caso** (inicial, defesa, decisão recorrida) e **conferir nos autos os
   fatos em que a tese se apoia**. Fato afirmado pela titular ou pela peça é hipótese até o
   documento confirmar. Divergência entre o que foi dito e o que os autos mostram vai para a
   titular antes da peça, não depois.
2. Enunciar a tese em uma frase, com o lado do cliente.
3. **Decompor em frentes**, uma consulta por frente: os fundamentos da decisão a atacar, os
   pedidos subsidiários e **pelo menos uma frente contrária** (o fundamento mais forte do
   adversário). Exemplo de apelação contra improcedência de cobrança de honorários: êxito com
   revogação, arbitramento proporcional, valor irrisório, acordo sem o advogado, sociedade
   como credora, advogado suspenso, e a frente contrária "revogação por culpa do advogado".
4. Informar à titular as frentes antes de rodar. Custa uma linha.

## 2. Montar as consultas

Operadores, campos e vocabulário do STJ: [`references/operadores-scon.md`](references/operadores-scon.md).

- Padrão para tema: termos ligados por `com` (mesmo parágrafo), variantes em `(a ou b)`,
  terminações com `$`. O SCON **não busca sinônimo**.
- Vocabulário: primeiro o bundle do tema (`<bundles>/index.md`), depois as ementas boas da
  rodada anterior. A ementa do STJ raramente usa a palavra da peça.
- Arquivo de consultas (JSON), em `tmp/radar-stj/<caso>/consultas.json`:

```json
[
 {"id": "A1-exito-revogacao", "livre": "(revoga$ ou destitu$) com mandato com (exito ou \"ad exitum\") com honorario$"},
 {"id": "C1-contrario-culpa", "livre": "honorario$ com revoga$ com mandato com (culpa ou desidia)", "dtpb1": "01/01/2015"}
]
```

Campos opcionais por consulta: `ementa`, `classe`, `uf`, `processo`, `dtpb1`/`dtpb2`
(publicação) e `dtde1`/`dtde2` (julgamento), em `dd/mm/aaaa`.

## 3. Buscar

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js buscar --consultas tmp/radar-stj/<caso>/consultas.json --saida tmp/radar-stj/<caso>
```

Grava `resultados.json` (tudo) e `triagem.md` (deduplicado entre consultas, ementa
recortada). Saída em `tmp/`, **nunca** na pasta do cliente. Uma busca leva ~15 s; o
navegador roda fora do sandbox do Bash.

Toda busca fica registrada em **`jurisprudencia-stj/BUSCAS.md`**: data, caso, consulta
exata, filtros e quantos acórdãos vieram. É por ali que a titular confere e refaz a busca,
colando a consulta no campo "Pesquisa" do SCON. Link direto não existe: a URL de resultado,
aberta fora da sessão, volta para a home.

O console marca cada consulta:

- **SECA** (0): afrouxar. Trocar `adj` por `com`, acrescentar variantes, tirar termo.
- **LARGA** (mais que a página, 50 por padrão): vieram só os mais recentes. Estreitar com
  mais um termo distintivo, `adj` no lugar de `com` ou filtro de data.

Até três rodadas por frente. Seguiu seco? Dizer que o STJ não tem material com aquele
recorte, sem forçar resultado.

## 4. Triar pelo sentido

Ler as ementas é o maior gasto da pesquisa. O modelo principal **não dá `Read` na
`triagem.md` nem no `candidatos.json`**: a `triagem.md` existe para a titular conferir.

Medido num caso real (177 acórdãos, 12 julgados de referência confirmados no inteiro teor):

| Modo | Tokens | Resultado |
|---|---|---|
| Ementas inteiras lidas pelo principal | ~45 mil | referência |
| **Cabeçalhos** + ementa só dos pré-selecionados | ~20 mil + ~10 mil | todos os 12 identificáveis pelo cabeçalho |
| Lotes Haiku (6 × 30) | ~630 mil Haiku + ~10 mil | 11 de 12 certos; **1 contrário pulado sem aviso** |

### Padrão: cabeçalhos

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js cabecalhos --saida tmp/radar-stj/<caso>
```

Uma linha por acórdão principal: registro, classe, frentes em que apareceu, órgão, data e o
**cabeçalho em maiúsculas da ementa**, que no STJ enumera o tema, a súmula aplicada e o
resultado ("RECURSO ESPECIAL PROVIDO", "SÚMULA 83"). `--frente <id>` filtra uma frente. Ler
a lista inteira, marcar F, C ou I por linha e levar os F e C para a etapa 5.

Ordem da lista e dos lotes:

- **Rodízio entre frentes:** a 1ª de cada consulta, depois a 2ª de cada. Ranking global
  deixaria a frente contrária, que costuma ser estreita, no fim.
- **Sem corte.** Um corte em 90 deixou de fora o melhor julgado de um caso real.
- **Similares** (mesmo relator, mesmo órgão, mesma abertura de ementa) saem e apontam para
  o principal. `--incluir-similares` nos lotes, para procurar divergência.

### Busca muito grande (acima de ~300 principais): lotes Haiku

O custo fixo de cada sessão de agente (~80 mil tokens) só compensa com volume.

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js lotes --saida tmp/radar-stj/<caso>
```

Monta o `candidatos.json` no formato do `radar-jurisprudencia` e fatia com o `lotes.js` de
lá, ementa longa compactada (abertura e fecho). Disparar um triador `model: haiku` por lote,
**todos na mesma mensagem**. O triador grava a resposta em arquivo, e o orquestrador lê só o
resultado do `conferir`:

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js conferir --saida tmp/radar-stj/<caso>
```

Imprime só as linhas F e C e **lista o que ficou sem resposta** (sai com código 1). Item sem
resposta volta para um triador; nunca se fecha a triagem com falta.

Prompt do triador:

```text
Você é triador de jurisprudência do STJ. Leia o arquivo <pasta>/lotes/lote-N.json (id,
classe, relator, trecho = frentes + órgão + data + ementa). Grave a resposta em
<pasta>/lotes/resposta-N.txt e devolva só "ok, K linhas". Uma linha para CADA item do lote.

CASO: <quem representamos; fatos decisivos; o que a decisão atacada disse; o que vamos fazer>.

FRENTES: <a favor, uma por linha curta>; CONTRÁRIAS: <as do adversário>.

"F" = o conteúdo sustenta alguma frente a favor, independentemente de quem ganhou. "C" =
sustenta tese contrária que o adversário pode usar (guardar, é útil). "I" = outra matéria
ou não dá para saber. Marque ÓBICE quando o STJ não decidiu a tese (não conheceu por
Súmula 5, 7, 83, 182, 284 etc.) — vale menos, mas pode ser F/C se a ementa afirmar a tese.

Formato de cada linha do arquivo, sem nenhum outro texto:
id | F, C ou I | ÓBICE ou MÉRITO | frente em até 4 palavras | motivo em até 15 palavras
```

O CASO no prompt é o que dá qualidade à triagem: fatos e fundamentos da decisão atacada,
não só o nome da tese.

## 5. Escolher os finalistas

Com a marcação da etapa 4, pré-selecionar F e C por frente. Depois conferir a ementa
integral **só dos pré-selecionados**:

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js ementas --saida tmp/radar-stj/<caso> --registros <reg1,reg2,...>
```

- **Não conhecido por Súmula 5, 7 ou 83 não é tese do STJ.** O STJ só disse que não reexamina.
  Serve, no máximo, como "acórdão de origem mantido", e só se o voto transcrever a origem.
- **Provido** vale mais que desprovido: o STJ corrigiu o tribunal de origem.
- **Notas** indicando repetitivo, IAC ou tese revisada: ler antes de usar.
- Peso: Corte Especial/Seção > Turma colegiada > monocrática. Empate: o mais recente.

Finalistas: de 6 a 10 por caso, cobrindo cada frente, mais **todos os C relevantes**. Frente
sem nenhum F na triagem: reformular a consulta (etapa 2) antes de declarar que não há.

## 6. Trazer e ler o inteiro teor dos finalistas

```bash
node skills/radar-jurisprudencia-stj/scripts/scon.js teor --saida tmp/radar-stj/<caso> --registros 202302406926,202503141132
```

O inteiro teor vai para a **biblioteca `jurisprudencia-stj/`**, na raiz do workspace:

- Um acórdão por registro (`<registro>_<classe>.pdf`), com o `.md` do `pdfmd`
  (`--no-tables`) ao lado.
- Compartilhada entre casos: o acórdão que já está lá **não é baixado nem convertido de
  novo**.
- `INDICE.md` com uma linha por acórdão, para a titular abrir o PDF e conferir. A coluna
  "Achado em" diz o caso e as frentes da busca (no `BUSCAS.md`) que trouxeram o acórdão.
- Fora do git (`.gitignore`), porque o inteiro teor traz nome de parte (regra dura 6).

Ler pelo `ler-pdfmd.js` com `--buscar "<termo da tese>"` ou `--paginas`, nunca o `.md`
inteiro: o trecho da tese, mais o dispositivo e o resultado, bastam.

No voto, confirmar três coisas antes de o julgado subir para o dossiê:

1. **A tese está no voto**, não só na ementa.
2. **Quem fala.** Trecho que o voto transcreve do acórdão de origem é voz do TJ, não do STJ.
   O `lint-citacoes` cobra essa diferença.
3. **Por que o contrário não se aplica** ao caso: a distinção é a parte do dossiê que a peça
   mais usa.

Finalista que cair na leitura sai, e o próximo da fila sobe.

## 7. Dossiê

Gravar como subseção da seção **8. Radar de jurisprudência** da `clientes/<caso>/ANALISE.md`
(nunca arquivo avulso), títulos rebaixados dois níveis, `atualizada:` no frontmatter:

```markdown
# Radar STJ — <data> — <tese> (representamos <lado>)
> Fonte: SCON/STJ, inteiro teor lido no voto. Amostra das consultas abaixo, não censo:
> não autoriza "jurisprudência pacífica".

## Consultas
(registro completo em `jurisprudencia-stj/BUSCAS.md`)
- <id>: `<consulta>` — <filtros> — <total> acórdãos

## Sustentam
### <frente> — <classe e número/UF> (<órgão>, Rel. <ministro>, j. <data>, DJEN <data>)
- **Resultado:** provido | desprovido | não conhecido (Súmula N)
- **Por que serve:** <1–2 frases suas>
- **Trecho:** > "<literal>" — voz: STJ | TJ<x> transcrito no voto
- **Cuidado:** <limite do precedente, se houver>
- **Inteiro teor:** `jurisprudencia-stj/<registro>_<classe>.pdf`

## Contrários e distinção
### <classe e número/UF> (...)
- **O que decidiu:** <uma linha>
- **Distinção:** <por que o nosso caso é diferente>
```

## 8. Para o julgado chegar à peça

O `lint-citacoes` **bloqueia precedente de tribunal superior ausente do acervo**. O PDF em
`tmp/` não basta: o julgado precisa ser depositado no bundle do tema
(`<bundles>/direito/<tema>/`):

- `raw/<slug>.md`: conversão do inteiro teor, **pseudonimizada** (regra dura 6: saem partes
  pessoas físicas e advogados; ficam ministros e número do processo).
- `jurisprudencia/<slug>.md`: página com `status: em_teste`, no formato das que já existem
  no tema (por exemplo, `direito/cobranca-honorarios/jurisprudencia/resp-1504969-sp-*.md`).
- Rodar `<python> <bundles>/lint-bundle.py --quiet` e conferir `git status` do acervo.

Até ser promovida a `vigente`, a peça que cita a página declara `cita_em_teste: sim`.

## Limites

- **Ritmo.** Uma requisição a cada 6 s, numa sessão só. Nada de varredura em massa nem de
  paralelizar sessões. O SCON é serviço público; a skill o usa como um pesquisador usaria.
- **Cloudflare.** O Scrapling passa o desafio como navegador comum. Se o STJ endurecer e a
  busca voltar vazia em toda consulta, ou com a página "Um momento…", parar e avisar a
  titular. Alternativa: o Chrome da própria titular (Claude in Chrome).
- **Permissão.** O classificador do Claude Code já barrou esta coleta como contorno de
  proteção anti-bot. A titular autorizou o uso em 17/10/2026; em máquina nova, a regra de
  permissão precisa ser liberada por quem opera.
- **Site mudou.** Se `extrair` não acha `div.documento` ou o PDF não vem, o SCON mudou o
  HTML: inspecionar a página salva, não insistir.

# Operadores e campos do SCON (STJ)

Fonte: folder "SOS Pesquisa" da Secretaria de Jurisprudência do STJ (2025),
`scon.stj.jus.br/docs_internet/jurisprudencia/ajuda/2025_folder_sos_pesquisa_1.pdf`.
Resumo de trabalho, não transcrição.

## Regras que mais mudam o resultado

- **Não há sinônimo.** O SCON acha só a palavra digitada. Toda variante entra à mão com `ou`.
- **Maiúscula, minúscula e acento são indiferentes.**
- **A pesquisa livre não lê o inteiro teor.** Ela procura no espelho do acórdão: ementa,
  informações complementares, termos auxiliares, referência legislativa, notas.
- Só aparece o que já foi **publicado** e incluído na base pela Secretaria.

## Operadores

| Operador | Efeito | Exemplo de uso no escritório |
|---|---|---|
| `e` | todos os termos, em qualquer ponto | `honorario$ e monitori$` |
| `ou` | qualquer dos termos; **sempre entre parênteses** | `(revoga$ ou destitu$ ou resili$)` |
| `não` | exclui o termo | `honorario$ não sucumb$` |
| `mesmo` | termos no mesmo campo do espelho | `arbitra$ mesmo proporcion$` |
| `com` | termos no mesmo parágrafo; **padrão para tema** | `revoga$ com mandato com exito` |
| `proxN` | até N palavras de distância, em qualquer ordem (`prox` = `prox1`) | `nega prox5 provimento` |
| `adjN` | até N palavras, **na ordem digitada** (`adj` = `adj1`) | `honorario$ adj2 contrat$` |
| `$` | qualquer terminação, inclusive plural | `rescis$` = rescisão, rescisória, rescisões |
| `?` | um caractere | `d?scriminar` |
| `( )` | agrupa | `((menor ou criança) com infrator)` |
| `" "` | expressão exata, ou palavra que é operador | `"justa causa"`, `"não" adj previsto` |

Do mais estreito ao mais largo: `adj` < `prox` < `com` < `mesmo` < `e`.

## Campos da pesquisa avançada que o `scon.py` preenche

`ementa` (procura em ementa, informações complementares e termos auxiliares) · `classe`
(sigla ou extenso) · `uf` · `processo` (número da classe, sem ponto: `805919`; com `classe`
acha o acórdão exato, e é o que o atalho `acordao` usa) · `dtpb1`/`dtpb2` (publicação,
`dd/mm/aaaa`) · `dtde1`/`dtde2` (julgamento). Órgão julgador, ministro e Notas são
seletores da página e o script não os preenche: filtrar depois, pela triagem.

Campos ocultos do formulário que o script injeta: `l` (documentos por página, 50), `i`
(primeiro documento da página: `paginas: 2` na consulta pede `i=51`) e `b` (base: `ACOR`
acórdãos, `DTXT` decisões monocráticas; `base: monocraticas` na consulta). A monocrática vem
com o texto integral no espelho ("Decisão"), sem PDF.

**A pesquisa livre lê também "Jurisprudência Citada".** `REsp 805919` na livre devolve o
acórdão e todos os que o citam (testado: 7 documentos, 6 citantes). Serve para o snowball
(`scon.js citados`); para achar o acórdão em si, usar `processo` + `classe`.

## O que o espelho traz e serve à triagem

- **Notas**: indica afetação a repetitivo ou IAC, tese revisada e alteração posterior do
  resultado. Ler antes de citar.
- **Informações complementares à ementa**: tese decidida que não está na ementa. Desde 2011,
  em linguagem livre.
- **Acórdãos similares**: mesmo relator, mesmo órgão, mesma tese. Não é reforço
  independente: conta como um.

## Vocabulário do STJ que a consulta precisa usar

A ementa raramente usa a palavra da peça. Descobertas desta skill:

- O STJ escreve "revogação **imotivada**"; "sem justa causa" quase não aparece. O lado
  contrário sai com `culpa`, `desidia`, `motivad$`.
- "Acordo sem o advogado" aparece como `aquiesc$`, `anuencia`, `"à revelia do patrono"`.
- `prejudica` sozinho afoga a busca: é palavra comum em qualquer ementa.
- Quando a primeira rodada traz uma ementa boa, **copiar dela o vocabulário** e montar a
  segunda rodada com ele.

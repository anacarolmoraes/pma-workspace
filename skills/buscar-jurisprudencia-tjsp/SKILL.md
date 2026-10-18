---
name: buscar-jurisprudencia-tjsp
description: Pesquisa jurisprudência do TJSP na Consulta Completa do e-SAJ (CJSG: acórdãos, decisões monocráticas e homologações de 2º grau e Colégio Recursal), por tema ou pelo número do processo, e baixa o inteiro teor em PDF convertido pelo pdfmd. Usar quando a titular pedir "julgado do TJSP", "o que o TJSP decide sobre X", "traga o acórdão do processo 1064147-38.2025.8.26.0100", precedente paulista para peça ou recurso, ou o TJSP que o bundle não tem. Traz favoráveis e contrários. STJ: radar-jurisprudencia-stj. Outros tribunais e decisões recentes: radar-jurisprudencia (DJEN).
---

# Jurisprudência do TJSP (CJSG/e-SAJ)

Mesma disciplina do [`radar-jurisprudencia-stj`](../radar-jurisprudencia-stj/SKILL.md): o
CJSG devolve o que contém as palavras, e cabe à skill decidir se o julgado trata da **mesma
questão jurídica num quadro de fatos parecido**. O contrário entra no dossiê como o argumento
que o outro lado vai usar. Entender o caso, decompor em frentes e triar pelo sentido seguem
as etapas 1, 4 e 5 de lá; aqui fica só o que o TJSP muda.

## Atalho: acórdão de um processo

```bash
node skills/buscar-jurisprudencia-tjsp/scripts/cjsg.js processo --numero 1064147-38.2025.8.26.0100 --caso <caso>
```

- Busca pelo campo **"Nº de origem"**. No TJSP a apelação conserva o número do 1º grau, então
  o número da sentença acha o acórdão da apelação. Agravo de instrumento tem número próprio
  (`2xxxxxx-xx.aaaa.8.26.0000`); o número dele também entra aqui.
- Traz acórdãos (até 3 páginas) e decisões monocráticas, lista o que veio e **baixa o inteiro
  teor de tudo** para a biblioteca, convertido pelo pdfmd. `--sem-teor` só lista.
- Nada veio: o processo não foi julgado no 2º grau, corre em segredo de justiça ou não é do
  TJSP (segmento `8.26`).

Entregar à titular o caminho do PDF na biblioteca, a ementa e a **citação oficial**, que o
CJSG já fornece pronta: `(TJSP; Apelação Cível 1064147-38.2025.8.26.0100; Relator (a): …;
Órgão Julgador: …; Data do Julgamento: …)`. Para citar em peça, o trecho transcrito sai do
`.md` do inteiro teor, não da ementa.

## Busca por tema

Arquivo de consultas em `tmp/radar-tjsp/<caso>/consultas.json`:

```json
[
 {"id": "A1-desativacao-sem-motivo", "livre": "instagram E (desativada OU banida) E \"padrões da comunidade\"", "dtj1": "01/01/2025", "paginas": 2},
 {"id": "C1-contrario-violacao-provada", "livre": "instagram E desativa?ão E (violação OU fraude) E improcedente"},
 {"id": "M1-monocraticas", "livre": "instagram E desativada", "tipo": "monocraticas"}
]
```

```bash
node skills/buscar-jurisprudencia-tjsp/scripts/cjsg.js buscar --consultas tmp/radar-tjsp/<caso>/consultas.json --saida tmp/radar-tjsp/<caso> --caso <caso> [--paginas 2] [--retomar]
```

Campos de cada consulta:

| Campo | Formulário do CJSG |
|---|---|
| `livre` | Pesquisa livre (inteiro teor) |
| `ementa` | Ementa |
| `processo` / `registro` | Nº de origem / Nº de registro do acórdão |
| `dtj1`, `dtj2` · `dtp1`, `dtp2` | julgamento · publicação, `dd/mm/aaaa`. O CJSG só filtra com as duas pontas: só o início devolve zero sem aviso. O script completa o fim com hoje e recusa fim sem início |
| `tipo` | `acordaos` (padrão), `monocraticas`, `homologacoes` |
| `origem` | `2grau` ou `recursal` (Colégio Recursal); omitido = os dois |
| `sinonimos` | `false` desliga "pesquisar com sinônimos", que vem ligado |
| `paginas` | páginas de 20 (fixo no CJSG); padrão 1 |

Classe, assunto, relator, órgão e comarca são árvores de seleção do formulário: não entram
pela consulta. O órgão e o relator vêm em cada resultado: filtrar depois, na triagem.

**Operadores do CJSG** (ajuda oficial do e-SAJ, "Operadores Lógicos"), diferentes do SCON:

- `E` (padrão entre palavras), `OU`, `NÃO`, parênteses para agrupar.
- `?` troca **um** caractere (`desativa?ão`), nunca no início da palavra.
- `"…"` frase exata, até cinco palavras.
- **Não há** truncamento `$`, nem `adj`, `prox`, `com`, `mesmo`. Proximidade se aproxima com
  frase exata curta; variantes, com `OU`.
- Sinônimos vêm ligados: a busca já se alarga sozinha. Desligar quando o termo técnico importa.

Saída: `resultados.json` e `triagem.md` (ementa recortada), consulta a consulta. O console
marca **SECA** (0) e **LARGA** (mais do que veio): o CJSG ordena por data de publicação, então
uma frente LARGA trouxe só os mais recentes. Estreitar com termo distintivo ou data, ou subir
`paginas` (5 s por página). O TJSP julga muito mais que o STJ: 3.751 acórdãos para
`instagram E desativada` (18/10/2026). Frente sem recorte de data raramente é útil.

Toda busca fica em **`jurisprudencia-tjsp/BUSCAS.md`**, com a consulta exata e os filtros, para
a titular refazer no navegador. Link direto não existe: o resultado mora na sessão.

## Triagem, ementas e inteiro teor

A triagem segue a etapa 4 do `radar-jurisprudencia-stj`: o modelo principal **não dá `Read` na
`triagem.md`** de frente larga; lê por recortes e marca F, C ou I com motivo. Depois:

```bash
node skills/buscar-jurisprudencia-tjsp/scripts/cjsg.js ementas --saida tmp/radar-tjsp/<caso> --cds 20327285,20311111
node skills/buscar-jurisprudencia-tjsp/scripts/cjsg.js teor    --saida tmp/radar-tjsp/<caso> --cds 20327285,20311111 --caso <caso>
```

`--cds` são os `cdAcordao` da `triagem.md`. Biblioteca em `jurisprudencia-tjsp/` (raiz do
workspace, fora do git): uma pasta `<cdAcordao>_<número>/` por acórdão, com o PDF, o `.md` e
`<base>.cjsg.json` (espelho + casos que o acharam), e `INDICE.md` na raiz. O que já está lá não
se baixa de novo. O `.md` é longo? Ler pelo mapa (`ler-pdfmd.js --mapa`), como manda o hook.

**Antes de citar:** conferir no inteiro teor que o dispositivo ("Deram provimento ao recurso")
e a razão de decidir dizem o que a ementa promete. Ementa do TJSP é redigida pelo relator e às
vezes generaliza. Acórdão de câmara não é precedente qualificado: vale como persuasivo, e o
peso cresce com a convergência entre câmaras distintas, que a triagem deve mostrar.

## Como o script passa pelo e-SAJ

O formulário leva **reCAPTCHA v3 invisível**: POST sem o token volta para o formulário (testado
com curl em 18/10/2026). O motor abre o formulário numa `StealthySession` do Scrapling, espera
o token nascer, preenche os campos pelo `name` e clica em "Pesquisar", como um navegador comum.
Uma sessão por consulta, uma requisição a cada 5 s. Não é contorno de bloqueio: é a consulta
pública feita no ritmo de uma pessoa.

- Páginas seguintes: `trocaDePagina.do?tipoDeDecisao=A&pagina=N` na mesma sessão.
- PDF: `getArquivo.do?cdAcordao=…&cdForo=…&casChecked=true` (sem `casChecked`, volta uma
  página que redireciona).
- A ementa integral e a citação oficial estão na `div` oculta do botão "ementa sem
  formatação" (`#textAreaDados_<cdAcordao>`). O hook `alerta-injecao` acusa esse `display:none`
  quando se lê o HTML bruto: é marcação do e-SAJ, falso positivo.
- O navegador roda fora do sandbox do Bash. Python do `adv_env`, sem `-I`.

Mudou o layout e o parser parou de achar linhas? `cjsg.py extrair <pagina.html>` testa o
parser sem rede; a página se salva com uma sonda no `tmp/`.

## Dado de parte

O inteiro teor traz nome de parte e de advogado. Fica em `jurisprudencia-tjsp/` (fora do git) e
só vai ao acervo pseudonimizado, pela página do bundle (regra dura 6 do `AGENTS.md`).

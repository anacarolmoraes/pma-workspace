---
name: pdfmd
description: Converter PDFs locais em Markdown auditável, com preservação de estrutura, tabelas, imagens, OCR por página, âncoras citáveis, manifesto de proveniência e índice para leitura seletiva. Usar sempre que um PDF sem `.md` irmão precisar ser lido, analisado, citado por página ou incorporado ao fluxo jurídico, inclusive PDFs digitalizados, mistos, com formulários, prints ou tabelas.
---

# PDF para Markdown fiel

Converter localmente. Não enviar PDF, página ou imagem a serviço externo.

## Garantias obrigatórias

- Manter `documento.md` como representação canônica completa.
- Gerar `documento.index.md` para navegação econômica.
- Gerar `documento.pdfmd.json` com hash, páginas, métodos, tabelas, imagens e avisos.
- Gerar imagens em `documento_assets/` e inseri-las na posição aproximada do fluxo.
- Decidir OCR por página; não forçar OCR do documento inteiro por causa de uma página ruim.
- Nunca apagar uma saída válida antes de a substituta passar nos portões.
- Nunca considerar conversão íntegra apenas por tamanho do `.md`.
- Não inventar título, legenda, conteúdo de imagem, célula ou ordem ausente na fonte.

Para integrar ou diagnosticar os artefatos, ler
[`references/contrato-saida.md`](references/contrato-saida.md).

## Converter uma pasta de caso

Usar o wrapper. Ele percorre a pasta, valida o hash do PDF, exige manifesto íntegro,
confere assets e preserva a saída anterior se a reconversão falhar.

```powershell
node skills\pdfmd\scripts\converter-caso.js clientes\<caso>
```

Usar `--forcar` somente para regenerar todos os derivados:

```powershell
node skills\pdfmd\scripts\converter-caso.js clientes\<caso> --forcar
```

## Converter um PDF isolado

Usar o wrapper, que resolve o Python em `perfil/ambiente.json` e executa o motor canônico em
`vendor/pdfmd`, sem colisão com cópias legadas:

```powershell
node skills\pdfmd\scripts\executar-pdfmd.js "<arquivo.pdf>" --ocr auto --lang por --page-breaks --export-images --ocr-images --strict
```

O modo estrito falha diante de aviso não resolvido. Conferir visualmente a página indicada;
não contornar com `--no-manifest`, `--no-index` ou remoção manual do aviso.

## Ler gastando menos tokens

Não abrir o Markdown inteiro por padrão.

1. Ler primeiro `documento.index.md`.
2. Identificar seção, página, tabela ou imagem relevante.
3. Carregar somente o trecho exato com `ler-pdfmd.js`.
4. Voltar ao PDF apenas para conferência visual de layout, assinatura, carimbo ou região
   marcada como ambígua.

```powershell
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --mapa
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --paginas 8-12,15
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --secao "Dos pedidos"
node skills\pdfmd\scripts\ler-pdfmd.js documento.md --buscar "contratação" --contexto 2
```

Economizar tokens por seleção, não por resumo. Não criar versão resumida que possa substituir
o texto canônico.

## Citar páginas

Usar sempre a página física do PDF registrada na âncora e no manifesto:

```text
NOME_DO_ARQUIVO.pdf, p. PDF 12
```

Se houver paginação impressa confiável, acrescentar sem substituir a página física:

```text
NOME_DO_ARQUIVO.pdf, p. PDF 12, fl. 87 impressa
```

Não citar apenas `p. 12`: em processos, a folha impressa e a posição no arquivo divergem.

## Conferir fidelidade

Antes de afirmar o conteúdo:

- conferir no manifesto se todas as páginas foram registradas;
- abrir assets das páginas com imagens probatórias;
- conferir visualmente páginas com `warnings`;
- tratar OCR de baixa confiança como transcrição provisória;
- conferir tabelas ambíguas contra o recorte visual;
- validar que o `source_sha256` corresponde ao PDF atual.

Conversão com aviso não é conversão silenciosamente aceita: é pendência de conferência.

## Regras de segurança

- Manter `.md`, índice, manifesto e assets ao lado do PDF ou em sua pasta derivada.
- Não mover documento C1 para bundle, skill ou repositório.
- Não inserir Mermaid, resumo autoral ou interpretação no Markdown canônico.
- Não remover cabeçalho, rodapé, imagem repetida ou página vazia sem registrar a ocorrência.
- Usar somente o Python de `perfil/ambiente.json` e `PYTHONUTF8=1` no Windows.

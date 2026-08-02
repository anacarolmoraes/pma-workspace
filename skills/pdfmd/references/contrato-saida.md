# Contrato de saída da pdfmd

Ler este arquivo ao integrar, auditar ou diagnosticar a conversão.

## Artefatos

Para `documento.pdf`, gerar:

```text
documento.md
documento.index.md
documento.pdfmd.json
documento_assets/
```

### `documento.md`

Representação semântica canônica. Conter texto, tabelas e referências de imagens no fluxo.
Cada página começar com:

```markdown
<a id="pdf-page-12"></a>
<!-- pdfmd:page=12; method=native -->
```

`method` pode ser `native` ou `tesseract`. A âncora é estável e serve à leitura seletiva.

### `documento.index.md`

Mapa derivado e descartável. Conter:

- títulos detectados e página inicial;
- inventário por página;
- contagem de tabelas e imagens;
- indicação de OCR e conferência;
- estimativa de tokens do Markdown integral.

O índice não substitui nem resume o conteúdo substantivo.

### `documento.pdfmd.json`

Manifesto `pdfmd-manifest-v1`. Campos de topo:

| Campo | Função |
|---|---|
| `source_file` | Nome do PDF sem caminho absoluto |
| `source_sha256` | Identidade da versão convertida |
| `markdown_file` | Markdown canônico |
| `options` | Opções relevantes da conversão |
| `pages` | Proveniência e qualidade por página |

Cada item de `pages` registrar:

- `pdf_page` e `printed_page`;
- âncora e linhas do Markdown;
- dimensões e rotação;
- método de extração e uso de OCR;
- quantidade de caracteres e blocos;
- tabelas com `bbox`, dimensões, origem e confiança;
- imagens com `bbox`, asset, OCR e repetição;
- elementos repetidos suprimidos da leitura corrente;
- avisos que exigem conferência.

### `documento_assets/`

Conter recortes renderizados das ocorrências visuais. O manifesto pode apontar várias
ocorrências para o mesmo asset quando a imagem for idêntica; deduplicar armazenamento não
autoriza apagar a ocorrência ou sua página.

## Invariantes

1. Toda página física do PDF deve possuir registro no manifesto.
2. Todo asset citado deve existir.
3. O hash do manifesto deve corresponder ao PDF.
4. Saída nova só substitui a anterior após gravação atômica.
5. Aviso nunca pode ser convertido em sucesso silencioso.
6. Página impressa nunca substitui `pdf_page`.
7. Economia de tokens ocorre por leitura seletiva do canônico.

---
name: peca-pma-builder
version: 1.2.0
description: |
  Biblioteca Node compartilhada para geração de peças jurídicas .docx no padrão PMA.
  Caminho preferido: escrever a peça em Markdown (dialeto PMA) e compilar com
  scripts/md2docx.js — a fonte da verdade fica em .md, mais barata em tokens.
  Também fornece helpers reutilizáveis (p, pMixed, pQuote, titulo, subtitulo,
  assinatura, etc.) e um builder único que aplica o timbrado do escritório
  (cabeçalho com imagem institucional centralizada; rodapé com filete laranja,
  contatos e "Fl. X de Y" — modelo: material_padrao_escritorio/
  PETICAO_MODELO_FORMATACAO.docx), margens 3 cm, Montserrat 12 pt, entrelinha
  1,3. Use sempre que precisar gerar ou regerar um .docx de peça processual.
---

# peca-pma-builder — Biblioteca de Geração de Peças .docx (Padrão PMA)

## Quando usar
- Geração ou regeneração de **qualquer** .docx de peça jurídica via Node (apelação, inicial, contestação, recurso, manifestação, embargos, parecer).
- Substitui a prática anterior de redefinir helpers `p()`, `pMixed()`, `titulo()`, etc. em cada script.
- **Proibido** copiar helpers desta skill para scripts locais. Sempre importar daqui.

## Por que existe
Antes desta skill, cada caso (caso A, caso B, caso C) tinha seu próprio `gerar_*.js` com ~100 linhas de boilerplate duplicado. Mudança visual exigia editar 4+ arquivos. Pior: nenhum dos scripts injetava o banner (cabeçalho) e a logo (rodapé) exigidos pela tipografia-pma Módulo 2.

## Autoria em Markdown (caminho preferido — economia de tokens)

Escreva a peça em um `.md` (dialeto abaixo) na pasta do caso e compile:

```powershell
node d:/WORK/advocacia/skills/peca-pma-builder/scripts/md2docx.js clientes/caso/PECA.md
```

O `.md` é a **fonte da verdade** da peça: ~20–30% mais barato de escrever e de
reler por agente do que `p()`/`pMixed()` em JS, editável sem risco de corromper
sintaxe, e os lints (`lint-remissoes.js`, `lint-ia.js` do humanizer-forense)
rodam direto sobre ele. Scripts `gerar_*.js` continuam suportados apenas para
layouts que o dialeto não cobre (tabelas, visual law) — para prosa corrida,
**não** criar novos `gerar_*.js`.

### Dialeto

```markdown
---
titulo: Agravo em REsp — Fulano        ← metadados do .docx
processo: 0000000-00.0000.8.27.2729
out: ARESP_FULANO_FINAL.docx           ← saída (relativa ao .md)
---

::endereco                             ← bloco de endereçamento (bold, esquerda)
EXCELENTÍSSIMA SENHORA ...
EGRÉGIO TRIBUNAL ...
::

# I. Dos Fatos                         ← titulo('I.', 'Dos Fatos')
## I.1. Cronologia                     ← subtitulo('I.1.', 'Cronologia')

Parágrafo comum com **negrito** e *itálico* inline; linhas contíguas
são unidas em um só parágrafo justificado. Linha em branco separa.

**Frase de abertura em destaque.**     ← linha toda em bold = parágrafo em negrito
                                         (NÃO usar como rótulo meta-textual tipo
                                         "Conclusão do capítulo:" — ver seção
                                         "Prosa humanizada" abaixo)

> Citação em bloco (pQuote: recuo 3 cm, Montserrat Light 11 pt).
>
> Linha ">" vazia separa parágrafos da mesma citação.

::center AGRAVO EM RECURSO ESPECIAL   ← pCentered (bold)
::left Nestes termos, pede deferimento.
::right texto à direita
::br                                   ← quebra() (espaço vertical)
::pagebreak                            ← pageBreak()

::assinatura
NOME DA ADVOGADA | OAB/TO 0000
local: Palmas — TO, 13 de julho de 2026.
::
```

**Portões automáticos:** o `md2docx.js` roda sozinho o `lint-remissoes.js` e o
`lint-ia.js` (humanizer-forense) antes de compilar — se algum falhar, o .docx
NÃO é gerado (`--skip-lint` pula, só para emergências). Após compilar, ele
valida o timbrado do arquivo gerado (`validarTimbrado`: extent da imagem,
pgMar 708/708, rodapé institucional) e falha se houver regressão. Para
`gerar_*.js` (API JS), rodar os lints manualmente e chamar `validarTimbrado`
após o `buildDoc`.

### Prosa humanizada — sem rótulos meta-textuais (decisão da usuária, 2026-07-16)

A arquitetura AI-first continua obrigatória, mas **invisível**: nada de rótulos
como "Conclusão do capítulo:", "I. Caso em exame.", "Fundamento impugnado
(transcrição literal):", "Impugnação:" ou "Jurisprudência pertinente
(transcrição):" no texto. Eles denunciam escrita por IA. Como manter a
estrutura sem os rótulos:

| Antes (rótulo) | Agora (prosa) |
|---|---|
| "**I. Caso em exame.** A sentença..." | Síntese em parágrafos corridos curtos, na mesma ordem (caso → pontos → pedido) |
| "**Conclusão do capítulo:** sem obrigação..." | Último parágrafo do capítulo enuncia a conclusão naturalmente; o título do capítulo já é a tese |
| "**Fundamento impugnado (transcrição literal):**" | "A sentença assentou que:" / "Consta da contestação:" + blockquote |
| "**Impugnação:** O art. 24..." | Parágrafo seguinte à transcrição ataca direto, sem anúncio |
| "**Jurisprudência pertinente (transcrição):**" | "Nesse sentido decidiu o TJTO:" / "A 2ª Seção do STJ pacificou:" + blockquote |

O que permanece da estrutura AI-first: BLUF (conclusão nas primeiras linhas de
cada capítulo), títulos-tese autodescritivos, jurisprudência TRANSCRITA com
identificação completa colada à citação, seções autossuficientes. Rótulos
visíveis só se a usuária pedir expressamente para uma peça específica.

## Timbrado (cabeçalho/rodapé)

Fonte canônica: `D:\WORK\advocacia\material_padrao_escritorio\PETICAO_MODELO_FORMATACAO.docx`
(definida pela usuária em 2026-07-16). O `buildDoc` reproduz:

- **Cabeçalho:** `assets/timbrado.png` centralizado, 3449384 × 907733 EMU
  (362 × 95 px), distância do topo 708 twips.
- **Rodapé:** parágrafo único centralizado com filete superior laranja
  `#F5A623` (single, sz 4, space 4), Montserrat 8 pt `#666666`:
  `contato@paulomoraesadvocacia.com.br | +55 (63) 98489-2582 | Av. Teotônio
  Segurado, Ed. Urban Futuro, Sala 2204, Palmas/TO, CEP: 77015200 | Fl. X de Y`.
  Distância da base 708 twips.
- Margens de corpo: 3 cm (canônico tipografia-pma; o modelo usa 2,47/2,54 —
  diferença visual nula porque o corpo começa abaixo da imagem do cabeçalho).

Para auditar um .docx gerado: conferir `<wp:extent cx="3448050" cy="904875"/>`
no header*.xml (se sair `cx="NaN"`, a `transformation` do ImageRun foi passada
com chaves erradas — usar `{ width, height }`, nunca `{ w, h }`).

## Como usar (API JS — apenas para layouts fora do dialeto)

```js
const PMA = require('d:/WORK/advocacia/skills/peca-pma-builder'); // ajuste ao caminho onde esta skill está instalada
const { p, pMixed, pQuote, pCentered, titulo, subtitulo,
        endereco, quebra, pageBreak, assinatura, buildDoc } = PMA;

const conteudo = [
  ...endereco([
    'AO JUÍZO DA 3ª VARA CÍVEL DA',
    'COMARCA DE PALMAS, ESTADO DO TOCANTINS',
  ]),
  quebra(),
  pMixed([{ text: 'Processo nº ', bold: true }, { text: '0000000-00.0000.8.27.2729', bold: true }]),
  quebra(),
  // ... corpo
  titulo('I.', 'Síntese Estratégica'),
  p('Texto da síntese...'),
  pQuote('Citação literal da sentença em bloco — Montserrat Light 11 pt, recuo 3 cm, sem itálico.'),
  subtitulo('I.1.', 'Subseção'),
  pMixed([{ text: 'Texto com ', }, { text: 'negrito inline', bold: true }, { text: '.' }]),
  // ... pedidos
  ...assinatura(
    [
      { nome: 'ANA CAROLINA RIBEIRO DE MORAES PAULO', oab: 'OAB/TO 6573' },
      { nome: 'FLAVIA PAULO OLIVEIRA',                 oab: 'OAB/TO 6951' },
    ],
    { localData: 'Palmas — TO, 20 de maio de 2026.' }
  ),
];

await buildDoc({
  titulo: 'Apelação Cível — Maria Exemplo da Silva',
  processo: '0000000-00.0000.8.27.2729',
  conteudo,
  outPath: './APELACAO_EXEMPLO.docx',
});
```

## API

### Helpers de parágrafo
| Função | Uso |
|---|---|
| `p(text, opts?)` | Parágrafo simples (justificado, Montserrat 12pt). `opts`: `bold`, `italics`, `alignment`, `spaceAfter`, `indent`, `size`. |
| `pMixed(runs, opts?)` | Parágrafo com runs mistos (negrito/itálico inline). `runs` = array de strings ou `{text, bold?, italics?, size?}`. |
| `pQuote(text, opts?)` | Citação em bloco (recuo 3 cm, Montserrat Light 11 pt, sem aspas e sem itálico — tipografia-pma Módulo 6.1). `opts`: `left`, `right` (em DXA). |
| `pCentered(text, opts?)` | Parágrafo centralizado (default bold). `opts`: `bold`, `italics`, `before`, `after`. |
| `titulo(num, texto)` | Seção principal — MAIÚSCULO + bold (ex: `titulo('I.', 'Dos Fatos')`). |
| `subtitulo(num, texto)` | Subseção — caixa mista + bold (ex: `subtitulo('I.1.', 'Cronologia')`). |
| `endereco(linhas)` | Array de linhas em bold à esquerda (cabeçalho do endereçamento ao juízo). |
| `quebra(spaceAfter?)` | Linha em branco. |
| `pageBreak()` | Quebra de página explícita. |
| `assinatura(adv, opts?)` | Bloco de assinatura. `adv` = `[{nome, oab}]`. `opts.localData` = linha "Cidade — UF, data." à direita acima das assinaturas. |

### Builder
```js
await buildDoc({
  titulo: 'metadado do .docx',
  processo: 'número do processo (vai em description)',
  conteudo: [Paragraph, Paragraph, ...],   // array de parágrafos
  outPath: 'caminho/arquivo.docx',          // obrigatório
  creator: 'PMA Advocacia',                 // opcional
  timbradoPath: 'caminho/imagem.png',       // opcional — default: assets/timbrado.png da skill
});
```

O `buildDoc` aplica automaticamente:
- A4 (11906 × 16838 twips)
- Margens 3 cm (1701 twips) topo/base/laterais; header/footer a 708 twips
- Montserrat 12 pt como fonte padrão do documento
- Header: imagem do timbrado centralizada (ver seção "Timbrado")
- Footer: filete laranja + contatos + "Fl. X de Y" centralizado

## Comportamentos do builder

- **Arquivo aberto no Word (EBUSY):** o `buildDoc` não falha — grava `<nome>.NOVO.docx` ao lado e avisa. Feche o Word e renomeie por cima do original.
- **Lint de remissões cruzadas:** antes de gerar, rode `node scripts/lint-remissoes.js caminho/gerar_peca.js` — confere que toda remissão "(Capítulo X)" aponta para capítulo definido via `titulo()`. Obrigatório após qualquer renumeração de capítulos (lição do checklist anti-182, item 8).

## Assets
- `assets/timbrado.png` — imagem do cabeçalho (729 × 193 px), extraída de `PETICAO_MODELO_FORMATACAO.docx`. **É o único asset em uso.**
- `assets/banner.png` / `assets/logo.png` — timbrado ANTIGO (pré-2026-07-16), mantidos apenas para regerar peças históricas.

Não editar sem coordenar com a usuária.

## Dependência externa
`docx` (npm global). Path padrão: `C:\Users\anamo\AppData\Roaming\npm\node_modules`. Pode ser sobrescrito via env var `NPM_GLOBAL_NODE_MODULES`.

## Limites (FORA DO ESCOPO)
- **Não** redige conteúdo jurídico — isso é tarefa do `legal-writer`/`legal-orchestrator` ou de skill específica (`apelacao-cirurgica`).
- **Não** valida consistência argumentativa — isso é `legal-consistency-validator`.
- **Não** decide layout visual avançado (tabelas complexas, gráficos, visual law) — para isso, estender este builder ou usar a skill `docx` diretamente.

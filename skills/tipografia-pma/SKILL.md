---
name: tipografia-pma
version: 2.0.0
description: |
  Padronização estrutural e visual de peça já redigida: hierarquia de títulos, títulos-tese,
  ordem dos blocos, destaques, citação em bloco e elementos visuais. Não escreve nem altera
  tese. Use no Estágio 2 do legal-orchestrator, ou quando pedirem "formate a petição",
  "aplique o padrão do escritório", "padronize a estrutura"; também para formatar à mão
  contrato, procuração ou PDF.
---

# Tipografia PMA — estrutura visual da peça

**Missão:** estruturar o que o `legal-writer` escreveu. Tese, argumentos, fatos, hierarquia
argumentativa e ritmo das frases ficam como chegaram. A estrutura visual revela o argumento;
se uma padronização fragmentar um argumento contínuo, preserve o original e sinalize ao
orchestrator.

Tema fora do domínio visual (estratégia, mérito, redação de tese, pedido) recebe a marca
`[FORA DO ESCOPO TIPOGRAFIA]` e volta ao orchestrator.

A numeração dos módulos é âncora citada por outras skills (2, 3.3, 6.1); por isso tem saltos.

---

## Módulo 1 — Onde estão os números

Fonte, tamanho, margem, entrelinha, recuo de citação e timbrado **não se configuram aqui**:
a fonte é [`perfil/marca.json`](../../perfil/marca.json) (tabela para leitura humana em
`perfil/definicoes.md` §7), quem aplica é o `peca-pma-builder` (`md2docx.js`) e quem confere
é o `lint-docx`. Esta skill decide o que nenhum deles decide: como a peça se organiza no `.md`.

Formatação manual no Word (contrato, procuração, exportação de PDF, fonte de fallback, corpo
12 do art. 54 do CDC): [`references/word-contrato-pdf.md`](references/word-contrato-pdf.md).

---

## Módulo 2 — Timbrado

Um só padrão desde 2026-07-16, o de `material_padrao_escritorio/PETICAO_MODELO_FORMATACAO.docx`:
imagem institucional única no cabeçalho, rodapé de texto com filete laranja e `Fl. X de Y`.
O builder o reproduz (medidas na seção "Timbrado" de `skills/peca-pma-builder/SKILL.md`). O
padrão antigo, com banner no cabeçalho e logo no rodapé, está descontinuado.

Referência de texto vai para **nota de fim**: o rodapé é só o institucional.

---

## Módulo 3 — Títulos e ordem

### 3.1 Hierarquia

Tudo em 12 pt. A hierarquia vem de caixa, negrito e numeração.

| Nível | Formato | Exemplo |
|---|---|---|
| Seção | romano + ponto, MAIÚSCULO, bold | `I. A RESPONSABILIDADE OBJETIVA DO BANCO` |
| Subseção | romano + decimal, bold | `I.1. A fraude por Pix` |
| 3º nível | romano + decimal duplo, bold | `I.1.1. O papel do Banco Pan` |
| Pedidos | letra maiúscula + parêntese | `A) a citação dos requeridos` |

No dialeto PMA, `#` e `##` (ver `skills/peca-pma-builder/SKILL.md`).

### 3.2 Título é tese

O título antecipa a conclusão do capítulo: `II. A RESPONSABILIDADE OBJETIVA DAS INSTITUIÇÕES
FINANCEIRAS`, e não `II. DO DIREITO`. Nos fatos, um subtópico por evento, já com a tese
("Da cobrança sem notificação prévia").

### 3.3 Ordem dos blocos

Síntese da lide na primeira página (capítulo I, em BLUF, prosa corrida: `perfil/definicoes.md`
§5) → Fatos → Tutela, se houver → Direito → Pedidos. **A única sequência inviolável é Fatos →
Tutela**; o resto se adapta ao caso e vem decidido no `<PECA>.estrutura.md` aprovado. O porquê
(como o juiz lê) está em [`references/leitura-do-juiz.md`](references/leitura-do-juiz.md).

---

## Módulo 5 — Destaques

O juiz escaneia em diagonal atrás de pontos de parada. Os pontos de parada são o título-tese,
a síntese da primeira página, o **negrito** e o espaço em branco de parágrafos curtos.

| Recurso | Uso |
|---|---|
| **Negrito** | o único destaque de texto, com parcimônia |
| Itálico | expressão latina e título de obra |
| CAIXA ALTA | título e palavra isolada; bloco longo fica em caixa normal |
| Sublinhado, marca-texto, cor | fora (azul só em hyperlink) |
| Numeração de parágrafos | fora: o juízo referencia tópico, não parágrafo |
| Montserrat Light | só citação em bloco e nota |

---

## Módulo 6 — Citação de jurisprudência

### 6.1 Citação em bloco

Bloco `>` no dialeto; o builder aplica recuo, corpo e peso de `marca.json` (sem aspas, sem
itálico). O que se decide aqui é o **corte**: fica o núcleo decisório, com `[...]` nas
supressões e a identificação completa do julgado colada à transcrição. Página inteira de
ementa recuada o juiz pula.

### 6.2 Transcrever curto

A jurisprudência da peça é transcrita, não parafraseada (AGENTS.md §5; o `lint-citacoes`
confere a literalidade). A economia vem de transcrever pouco: uma frase de enquadramento em
prosa própria e o trecho que decide. Citação indireta só para ponto que o acervo não cobre, e
dita como tal.

---

## Módulo 7 — Elementos visuais

Elemento visual entra quando a palavra não explica com a mesma eficiência. Ícone, balança e
cor decorativa ficam fora.

| Elemento | Quando |
|---|---|
| Tabela | cálculo acumulado, vários vínculos, despesa × renda |
| Linha do tempo | prescrição, decadência, sequência de fatos |
| Gráfico | desproporção (valor × salário) |
| Organograma | rede societária, cadeia de responsabilidade |
| Print recortado | prova digital de fato específico |

**Print:** só a área de interesse, borda cinza fina, seta laranja (`#E86522`) ou vermelha
(`#CC0000`) no dado vital, legível no tamanho final. O corpo ilustra; o documento íntegro vai
nos anexos.

**Página web como prova:** PDF gerado pelo navegador com "Cabeçalhos e rodapés" ativado, que
grava URL, data e hora. Link sempre com a URL visível; QR Code fica fora de peça judicial.

---
description: Relatório jurídico em dois arquivos (.md fonte + .docx ABNT) em ./relatorios/; usa o pipeline analise-perfil quando for fraude bancária
argument-hint: <assunto / nº processo / pasta do caso> [janela=DD/MM,... conta-fraude=<csv> dia-fraude=DD/MM]
---

Gere um relatório jurídico profissional sobre: $ARGUMENTS

## 0. Padrão vinculante

Relatório **não** é peça: `tipografia-pma` e `peca-pma-builder` não se aplicam. O padrão é o
desta especificação (Times New Roman, ABNT), e ela prevalece sobre qualquer estilo de petição.

Não presuma fatos: extraia das provas, da petição e do dossiê; se faltar, pergunte antes de
escrever. PDF sem `.md` irmão passa pela skill `pdfmd` antes.

## 1. Substância analítica

Se o assunto for **fraude bancária / perfil de consumo** (há `EXTRATOS\*.csv`):
use a skill `analise-perfil` (`skills/analise-perfil/SKILL.md`
+ `references\criterios_stj.md`). Rode o motor determinístico com o Python de
`perfil/ambiente.json`:

```powershell
& <python> `
  skills/analise-perfil/scripts/analise_perfil.py `
  --extratos "<caso>\EXTRATOS" --janela "<DD/MM,...>" `
  --conta-fraude "<caso>\EXTRATOS\<csv>" --dia-fraude "<DD/MM>" `
  --saida "<caso>\analise_perfil_consumo.json"
```

Confira a cadeia de `saldo` do cluster (ordem reconstruída por saldo, não por
data — vira no dez→jan). Todo número vem do JSON; nada estimado; nomeie os
beneficiários (não vêm dos CSVs — vêm das provas/petição). Para outros temas,
faça a análise jurídica usual com fonte rastreável.

## 2. Os dois arquivos

Caminho `./relatorios/`, nomes `{AAAA-MM-DD}_{slug-kebab}.md` e `.docx`
(ex.: `2026-05-16_analise-fraude-execucao.md`).

**`.md` (fonte de verdade, para IA):** frontmatter YAML (título, data, processo, cliente,
autor); tabelas Markdown; headings `##` numerados; citações normativas completas (lei +
artigo + inciso + alínea). Estrutura padrão:

1. **SÍNTESE FÁTICA** — resumo cronológico dos fatos relevantes
2. **ANÁLISE JURÍDICA** — doutrina, jurisprudência e legislação; tabelas comparativas quando
   houver múltiplos cenários
3. **QUADRO-RESUMO** (tabela) — Ponto | Situação atual | Fundamento | Risco/Oportunidade
4. **CONCLUSÃO E RECOMENDAÇÕES** — encaminhamentos com prazo e prioridade
5. **REFERÊNCIAS NORMATIVAS** — leis, súmulas e precedentes citados

Em caso de perfil de consumo, encaixe nesse esqueleto: baseline + cluster + cálculos de
divergência dentro de *Análise Jurídica*; subsunção fator a fator do REsp 2.222.059/STJ no
*Quadro-Resumo*; cada valor com fonte e data.

**`.docx` (para o juiz), derivado do `.md`** — via skill `docx` (`skills/docx/SKILL.md`),
docx-js em Node, com estas especificações exatas:

- A4; **Times New Roman 12 pt; entrelinha 1,5**
- Margens **ABNT NBR 14724**: superior 3 cm, inferior 2 cm, esquerda 3 cm, direita 2 cm
- Tabelas: bordas finas cinza `#CCCCCC`; cabeçalho fundo `#3d4241` texto branco; zebra
  alternando branco / laranja `#eb8305`; padding 80/120 DXA; largura = content width;
  `WidthType.DXA` (nunca PERCENTAGE), largura dupla (tabela + célula), `ShadingType.CLEAR`
- Rodapé: número de página centralizado
- Headings negrito, hierárquicos, numerados (1., 1.1., 1.1.1.); estilos por ID
  `Heading1/2/3` com `outlineLevel`
- Parágrafos justificados, recuo de primeira linha 1,25 cm (sem espaçamento extra entre
  parágrafos — recuo e espaçamento juntos é erro)
- `PageBreak` dentro de `Paragraph`; zero bullet unicode

## 3. Validar e entregar

Gere com `node` (dependência `docx` em `node_modules/` na raiz). `validate.py`/`soffice.py`
da skill `docx` quebram no Windows (cp1252 / `AF_UNIX`); valide de forma equivalente —
parsear todas as partes XML do `.docx` em UTF-8 (ElementTree), conferir nº de
tabelas/linhas. PDF é exportação no Word (Salvar Como PDF → incorporar fontes); informe, não
force conversão aqui.

Ao final, informe os **caminhos dos dois arquivos** (e do JSON/gerador, se houver), o
quadro-resumo em uma linha, e qualquer fato que ficou pendente de confirmação da advogada.

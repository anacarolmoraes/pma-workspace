# Checklist regimental — peça dirigida ao STJ

Portão do **assento 1 (assessor de gabinete)**. Vale para REsp, AREsp, AgInt, AgRg,
EDcl e EREsp. Cada item sai do relatório da banca como `OK` / `FALHA` / `N/A`, **com o
artigo ao lado** — item sem artigo não conta.

Fonte: RISTJ atualizado até a **Emenda Regimental n. 53**, depositado em
`direito/pecas/raw/ristj-er53.md`, com recortes por artigo nos bundles de
`recurso-especial/`, `agravo-interno/` e `embargos-declaracao/`.

> **Prazo vem do CPC; rito vem do RISTJ.** O Regimento diz quem julga, quando o
> feito vai a mesa e quando cabe sustentação — não substitui a contagem do CPC.
> A única exceção relevante está no item 3.

---

## 1. Cabimento da classe

| # | Verificar | Fundamento |
|---|---|---|
| 1.1 | A decisão combatida é de **Ministro** (monocrática)? Então o recurso é **agravo interno**, não REsp nem petição avulsa. | RISTJ, art. 259 |
| 1.2 | A decisão é **colegiada** e há divergência entre órgãos do próprio STJ? Então é **embargos de divergência** — e o paradigma tem de ser de órgão competente para a matéria. | RISTJ, arts. 266–267 |
| 1.3 | Há omissão, contradição, obscuridade ou erro material? **EDcl** cabem contra *qualquer* decisão judicial. | RISTJ, art. 263 |
| 1.4 | O acórdão recorrido **apenas fixou tese em abstrato** (IRDR/IAC), sem julgar a causa? Falta "causa decidida" — REsp não é cabível. | CF, art. 105, III + REsp 1.798.374/DF (Corte Especial) |

## 2. Poderes do relator — o caminho de menor esforço para não conhecer

| # | Verificar | Fundamento |
|---|---|---|
| 2.1 | A peça **impugna especificamente TODOS os fundamentos** da decisão recorrida? Deixar um de fora autoriza o não conhecimento monocrático. | RISTJ, art. 34; Súmula 182/STJ |
| 2.2 | A tese contraria súmula do STF/STJ, acórdão em repetitivo ou entendimento em IAC? O relator pode negar provimento sozinho. | RISTJ, art. 34 |
| 2.3 | A matéria é **constitucional**? O relator pode remeter ao STF, abrindo prazo de 15 dias para demonstrar repercussão geral. | RISTJ, art. 34 |
| 2.4 | Há controvérsia idêntica já afetada ao rito dos repetitivos? O feito pode ser devolvido à origem. | RISTJ, art. 34 |

## 3. Prazo — onde o RISTJ diverge do que se supõe

| # | Verificar | Fundamento |
|---|---|---|
| 3.1 | **Agravo regimental em matéria penal: cinco dias**, não quinze. Erro de contagem aqui é intempestividade. | RISTJ, art. 258 |
| 3.2 | Agravo interno (matéria não penal) segue o prazo do CPC. | RISTJ, art. 259 + CPC, art. 1.021 |
| 3.3 | Prazo de EDcl é o legal, contado do CPC. | RISTJ, art. 263 |

## 4. Alínea "c" — prova do dissídio

Só quando o recurso se funda em divergência jurisprudencial. **É o item que mais
derruba REsp bem fundamentado no mérito.**

| # | Verificar | Fundamento |
|---|---|---|
| 4.1 | A divergência está provada por **certidão, cópia, citação de repositório oficial/credenciado, ou reprodução de julgado da internet com indicação da fonte**? | RISTJ, art. 255, § 1º |
| 4.2 | A peça **menciona as circunstâncias que identificam ou assemelham os casos confrontados** — o cotejo analítico? Transcrever ementa sem cotejo não satisfaz o § 1º. | RISTJ, art. 255, § 1º |
| 4.3 | O repositório invocado é dos autorizados/credenciados na forma do art. 134? | RISTJ, art. 255, § 3º |
| 4.4 | Em EREsp, a divergência é comprovada na mesma forma do art. 255? | RISTJ, art. 266, § 1º |

## 5. Precedentes qualificados

| # | Verificar | Fundamento |
|---|---|---|
| 5.1 | O acórdão invocado como vinculante é de **repetitivo, IAC ou súmula do STJ**? Só esses são precedente qualificado de estrita observância. | RISTJ, art. 121-A |
| 5.2 | Ao invocar repetitivo/IAC, a peça usa a **tese firmada** — e não trecho que o acórdão apenas transcreveu de outro julgado? | RISTJ, art. 104-A; portão de voz do `lint-citacoes` |
| 5.3 | Ao distinguir (*distinguishing*), a peça aponta a diferença **fática** relevante, não só a inconveniência do resultado? | RISTJ, art. 121-A |

## 6. Sustentação oral

| # | Verificar | Fundamento |
|---|---|---|
| 6.1 | Se a peça requer sustentação, ela **cabe na classe**? Agravo interno admite — quinze minutos. | RISTJ, arts. 159–160 |
| 6.2 | Agravo regimental em **matéria penal**: máximo de **cinco** minutos. | RISTJ, art. 160 |
| 6.3 | Havendo litisconsortes com advogados distintos, o prazo é em dobro e dividido. | RISTJ, art. 160, § 2º |

## 7. Exaurimento e prequestionamento

| # | Verificar | Fundamento |
|---|---|---|
| 7.1 | A matéria foi **efetivamente decidida** na origem? Se não, opuseram-se EDcl para prequestionar? | Súmulas 211 e 356/STJ |
| 7.2 | Rejeitados os EDcl, a peça alega **violação ao art. 1.022 do CPC**? Sem isso, não há como devolver a omissão ao STJ. | CPC, art. 1.022; REsp 2.119.053/RN |
| 7.3 | A fundamentação é **específica**, e não alegação genérica de violação? | Súmula 284/STF |
| 7.4 | O recurso depende de reexame de prova ou de cláusula contratual? | Súmulas 7 e 5/STJ |

---

## Como reportar

No parecer do chairman, uma linha por item **falho**, no formato:

```
FALHA 4.2 (RISTJ, art. 255, § 1º) — a peça transcreve a ementa do AgInt no REsp
2.057.448/SC, mas não confronta as circunstâncias dos casos. Corrigir antes do
protocolo: acrescentar o cotejo analítico ao capítulo III.
```

Item falho em **1, 3 ou 4 bloqueia o protocolo** — são vícios de admissibilidade que
o gabinete resolve monocraticamente. Os demais entram como achado comum da banca.

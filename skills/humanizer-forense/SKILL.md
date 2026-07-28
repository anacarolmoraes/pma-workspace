---
name: humanizer-forense
version: 1.0.0
description: |
  Remove sinais de escrita de IA de peças processuais em português jurídico brasileiro,
  SEM tocar na estrutura AI-first invisível (BLUF, títulos-conclusão, transcrições).
  Desde 2026-07-16, rótulos meta-textuais visíveis ("Conclusão do capítulo:" etc.)
  são eles próprios sinal de IA — remover, dissolvendo em prosa.
  Use após redigir qualquer petição/recurso e antes de gerar o .docx. Alvos: excesso de
  travessões, paralelismos negativos ("X — e não Y"), perguntas retóricas em série,
  frases-clone entre capítulos, registro inflado ("por excelência", "impõe-se" em série),
  regra de três artificial. Protege transcrições literais, citações, números e datas.
  Inclui lint quantitativo (scripts/lint-ia.js) plugável nos workflows de peça.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# humanizer-forense — Desrobotização de peças sem perder a estrutura AI-first

Camada de **superfície** sobre a heurística `estrutura-ai-first` (bundle D12): a arquitetura da peça (posição da conclusão, títulos-tese, transcrições com fonte) fica intacta; o que muda é a textura da prosa. Fonte dos padrões: Wikipedia, "Signs of AI writing" (WikiProject AI Cleanup), adaptada ao gênero forense pt-BR.

## Invariantes — NUNCA alterar

1. **Transcrições literais** (`pQuote`, citações de decisão, ementa, súmula, norma): intocáveis, inclusive travessões e erros do original.
2. ~~Rótulos fixos da estrutura AI-first~~ **REVOGADO (decisão da usuária, 2026-07-16):** rótulos meta-textuais visíveis ("Conclusão do capítulo:", "I. Caso em exame.", "Fundamento impugnado (transcrição literal):", "Impugnação:", "Jurisprudência pertinente (transcrições):") são agora um SINAL DE IA a remover — dissolver em prosa natural mantendo a informação na mesma posição (ver "Prosa humanizada" no SKILL.md do peca-pma-builder). Em peças novas, não escrever rótulos; só usar se a usuária pedir expressamente.
3. **Números, datas, identificação de julgados e dispositivos legais** (artigo/parágrafo/inciso/alínea).
4. **Títulos-conclusão**: podem ser reformulados para variar a fórmula, mas devem continuar enunciando a tese do capítulo (a IA de triagem depende disso).
5. **Terminologia técnica** consagrada (prequestionamento, dialeticidade, incindibilidade etc.) não é "vocabulário de IA" — não trocar por sinônimo leigo.
6. **MODALIDADE DAS FORMULAÇÕES (lição da 1ª banca, jul/2026):** condicional/hipotético NUNCA vira afirmativo. "Ainda que se aceite X" e "mesmo que X fosse verdade" são concessões *ad argumentandum*; reescrevê-las como "e a parte aceita X" transforma hipótese em confissão — mudança de modalidade é mudança de mérito. Na dúvida sobre o valor jurídico de uma reformulação, manter a original.

## Tabela de substituições

| Padrão de IA | Limite | Como corrigir |
|---|---|---|
| Travessão (—) na prosa própria | ≤ 2 por capítulo, fora de citação | Vírgula, parênteses, dois-pontos ou dividir a frase |
| Paralelismo negativo ("X — e não Y —", "não é X, é Y") | ≤ 1 na peça inteira | Afirmar direto: "contraria a jurisprudência" em vez de "está em confronto — e não em harmonia — com" |
| Perguntas retóricas em série | 0 fora de transcrição | Converter em afirmação numerada: "(i) a retificação do art. 213 não constitui alienação para os fins do art. 792, IV" |
| Frase-clone entre capítulos (mesmo fecho/abertura ≥ 2x) | 0 | Variar a redação mantendo a posição e o rótulo; se o BLUF já abriu com a conclusão, o fecho pode ser enxugado |
| Registro inflado ("por excelência", "a própria", "ela própria", "verdadeiro(a)", "inegável") | 0 | Cortar; a força vem do argumento, não do intensificador |
| Verbo-fórmula em série ("impõe-se", "de rigor", "resta claro", "insta salientar", "cumpre destacar") | ≤ 1 cada | Verbo direto: "deve ser admitido", "o óbice não se sustenta" |
| Regra de três artificial (tríades de adjetivos/substantivos sem necessidade) | evitar | Deixar o número natural de itens; duas razões são duas, quatro são quatro |
| Aposto encadeado por travessões duplos ("— que X — ") | evitar | Parênteses ou oração própria |

## Falsos positivos do gênero forense (NÃO corrigir)

- **Voz passiva** ("foi violado", "restou comprovado"): nativa do gênero; manter quando natural.
- **Conectivos forenses** ("Ademais", "Outrossim", "Nesse sentido", "Diante do exposto"): legítimos com moderação (≤ 1 uso de cada por peça é saudável; o problema é série).
- **"Primeiro. Segundo. Terceiro."** como numeração de razões: técnica forense clássica, não regra de três.
- **Negrito em termos-chave pontuais**: legítimo com moderação (rótulos meta-textuais em negrito, porém, saem — ver invariante 2).
- **Repetição de termo técnico** (não "variar lexicalmente" nomes de institutos: fraude à execução é sempre fraude à execução).

## Processo de aplicação

1. Rodar o lint: `node scripts/lint-ia.js caminho/gerar_peca.js` (ou .md). Ele conta os padrões fora de citação e falha acima dos limites — inclusive rótulos meta-textuais visíveis (limite 0). O `md2docx.js` do peca-pma-builder já roda este lint automaticamente como portão de compilação.
2. Reescrever só a prosa própria, seguindo a tabela; conferir cada invariante.
3. **Calibração de voz (recomendado):** ler uma peça humana do escritório sobre tema próximo (ex.: as razões de REsp ou os EDcl do próprio caso, escritos por advogado) e imitar o ritmo de frase: períodos mais longos, vírgulas, menos simetria.
4. Passada final anti-IA: perguntar "o que neste texto ainda parece gerado por IA?" e corrigir o que sobrar.
5. Rodar o lint de novo até passar; depois `lint-remissoes.js` (peca-pma-builder) e gerar o .docx.

## Limites (fora do escopo)

- Não valida conteúdo jurídico (legal-consistency-validator) nem estrutura (checklists dos playbooks).
- Não aplicar a transcrições, contratos, atas ou traduções: só a prosa argumentativa própria.
- Texto não-forense (artigos, LinkedIn, e-mails): usar a skill `humanizer` genérica.

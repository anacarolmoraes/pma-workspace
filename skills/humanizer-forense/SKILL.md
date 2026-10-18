---
name: humanizer-forense
version: 1.3.0
description: |
  Remove sinais de escrita de IA de peças processuais em português jurídico brasileiro,
  SEM tocar na estrutura AI-first invisível (BLUF, títulos-conclusão, transcrições).
  Desde 2026-07-16, rótulos meta-textuais visíveis ("Conclusão do capítulo:" etc.)
  são eles próprios sinal de IA — remover, dissolvendo em prosa.
  Use após redigir qualquer petição/recurso e antes de gerar o .docx: a ANÁLISE é
  obrigatória em toda peça; a ALTERAÇÃO, só quando lint, ritmo ou leitura acusam sinal,
  e sempre entre um snapshot e o guardião de invariantes (scripts/checar-invariantes.js),
  que reprova mudança de número, data, dispositivo, julgado, transcrição, título-tese,
  BLUF, modalidade, negação ou pedido. Alvos: excesso de travessões, paralelismos
  negativos ("X — e não Y"), perguntas retóricas em série, frases-clone entre capítulos,
  registro inflado ("por excelência", "impõe-se" em série), regra de três artificial,
  tríade anafórica, enumeração mecânica, frase truncada de efeito, parágrafo em negrito.
  Inclui lint quantitativo (scripts/lint-ia.js, portão do md2docx) e diagnóstico de ritmo
  não bloqueante (scripts/ritmo.js). Voz de referência: perfil/voz-forense.md.
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

## Análise obrigatória, alteração condicional (08/09/2026)

Até 08/09/2026 havia divergência: o AGENTS.md dizia que toda peça passa pela skill, e o Estágio 5 do orchestrator dizia que ela é condicional. A harmonização é esta:

```text
humanizer-forense      → SEMPRE executado (lint-ia + ritmo.js + leitura)
alteração da prosa     → SÓ quando há sinal (lint reprovado, sinal de ritmo, ou leitura acusa)
guardião de invariantes→ SEMPRE que houve alteração (snapshot antes, checar-invariantes depois)
revalidação jurídica   → SEMPRE que houve alteração (Estágio 3 do orchestrator de novo)
```

O resultado fica registrado no frontmatter do `<PECA>.validacao.md` (quem grava é o orchestrator, ao fim do Estágio 5), sem artefato novo:

```yaml
humanizer_analisado: sim
humanizer_alterou: nao            # ou sim
invariantes: preservados          # preservados | preservados com avisos | violados | n/a (sem alteração)
ritmo_sinais: 0                   # saída do ritmo.js
```

Analisar sem alterar é resultado legítimo. Alterar sem checar invariantes não é.

## Invariantes — NUNCA alterar

1. **Transcrições literais** (`pQuote`, citações de decisão, ementa, súmula, norma): intocáveis, inclusive travessões e erros do original.
2. ~~Rótulos fixos da estrutura AI-first~~ **REVOGADO (decisão da usuária, 2026-07-16):** rótulos meta-textuais visíveis ("Conclusão do capítulo:", "I. Caso em exame.", "Fundamento impugnado (transcrição literal):", "Impugnação:", "Jurisprudência pertinente (transcrições):") são agora um SINAL DE IA a remover — dissolver em prosa natural mantendo a informação na mesma posição (ver "Prosa humanizada" no SKILL.md do peca-pma-builder). Em peças novas, não escrever rótulos; só usar se a usuária pedir expressamente.
3. **Números, datas, identificação de julgados e dispositivos legais** (artigo/parágrafo/inciso/alínea).
4. **Títulos-conclusão**: podem ser reformulados para variar a fórmula, mas devem continuar enunciando a tese do capítulo (a IA de triagem depende disso).
5. **Terminologia técnica** consagrada (prequestionamento, dialeticidade, incindibilidade etc.) não é "vocabulário de IA" — não trocar por sinônimo leigo.
6. **TÍTULOS-TESE E BLUF SÃO ESTRUTURA, NÃO SUPERFÍCIE (lição de 2026-08-04):** humanizar **não** é despir o título. O que sai são os rótulos meta-textuais (invariante 2); o que fica é o título que **enuncia a conclusão** do capítulo e a conclusão nas primeiras linhas dele (regras 2 e 3 de `estrutura-ai-first`). Numa réplica real a passada de humanização trocou sete títulos-tese por rótulos vazios ("Dos juros de mora", "Da sucumbência") e moveu a conclusão de quatro capítulos para depois da tese da parte contrária — a prosa melhorou e a peça deixou de ser AI-first. São camadas independentes: mexer numa não autoriza mexer na outra. O `lint-ia.js` emite **aviso** (não bloqueio) para título de capítulo sem conclusão enunciada.
7. **MODALIDADE DAS FORMULAÇÕES (lição da 1ª banca, jul/2026):** condicional/hipotético NUNCA vira afirmativo. "Ainda que se aceite X" e "mesmo que X fosse verdade" são concessões *ad argumentandum*; reescrevê-las como "e a parte aceita X" transforma hipótese em confissão — mudança de modalidade é mudança de mérito. Na dúvida sobre o valor jurídico de uma reformulação, manter a original.
8. **Negações e pedidos.** Frase parecida não troca de polaridade ("não nega" ≠ "nega"); verbo de pedido não muda ("condenar" ≠ "reconhecer"); item de pedido não some nem surge.

### Guardião de invariantes (`scripts/checar-invariantes.js`)

Até 08/09/2026 os invariantes valiam por disciplina; os dois incidentes acima (títulos despidos, hipótese virada afirmação) passaram. Agora a conferência é mecânica, antes e depois de qualquer alteração:

```powershell
node skills\humanizer-forense\scripts\checar-invariantes.js --snapshot clientes\<caso>\PECA.md   # ANTES de editar
# ... humanização ...
node skills\humanizer-forense\scripts\checar-invariantes.js clientes\<caso>\PECA.md              # compara com o snapshot
node skills\humanizer-forense\scripts\checar-invariantes.js --limpar clientes\<caso>\PECA.md     # apaga o snapshot depois
```

O snapshot fica ao lado da peça como `<PECA>.antes-humanizer.md`, com um comentário HTML na primeira linha (por isso os hooks de peça não o tratam como peça); apaga-se depois da conferência. `--json` devolve o resultado para o registro no `.validacao.md`. Também compara dois arquivos quaisquer: `checar-invariantes.js antes.md depois.md`.

O que ele confere e como reage:

| Invariante | Bloqueia (✘) | Avisa (⚠) |
|---|---|---|
| Frontmatter e diretivas (`::endereco`, `::assinatura`) | qualquer diferença | |
| Transcrições em blockquote | qualquer diferença, inclusive travessão | |
| Valores em R$, percentuais, datas, números de processo, demais números | sumiu ou surgiu | |
| Dispositivos (art., §, inciso, alínea), precedentes, leis, súmulas, temas | sumiu ou surgiu | |
| Nomes de parte em caixa alta | sumiu ou surgiu | |
| Capítulos | número ou ordem diferente; título-tese que virou rótulo | título reformulado que segue enunciando tese |
| BLUF | abertura do capítulo desceu para o 3º parágrafo ou além | |
| Modalidade ("ainda que", "caso", "subsidiariamente", "em tese"…) | marcador sumiu | marcador novo |
| Negações | frase parecida com número diferente de negações | |
| Pedidos (capítulo com "pedido"/"requer" no título) | verbo de pedido ou item enumerado diferente | |
| Extensão da prosa própria | | variação acima de 20% |

Violação não se "explica": desfaz-se a alteração ou se leva à titular. Exit 1 = há violação; exit 2 = falta snapshot (grave-o antes de editar).

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
| Tríade anafórica ("não nega X, não nega Y e não se opõe a Z") | 0 | Subordinar as orações ou fundi-las numa só. Correlativas legítimas ("ora… ora…", "seja… seja…") **não** entram aqui |
| Enumeração mecânica ("A primeira é… A segunda é… A terceira está…") | ≤ 3 | Variar a abertura de cada razão: "Comece-se por…", "Soma-se a isso…", "Há ainda…", "Por fim…" |
| Frase truncada de efeito ("Existia.", "Não se amolda.") | ≤ 1 | Integrar ao período anterior; o corte seco é golpe de modelo |
| Parágrafo inteiro em negrito como efeito dramático | 0 | Devolver a frase ao corpo do parágrafo; a ênfase vem do argumento |
| Cadência de tabela na impugnação ("O autor alega X. Não procede, porque Y." em sequência; "o autor alega" ou "não procede" repetidos) | ≤ 1 cada por capítulo | Fundir as linhas em blocos temáticos com a versão do réu como fio; abrir cada bloco por ângulo diferente (documento, data, contradição interna do autor); manter cada fato identificável pela narrativa, não pela enumeração (playbook da contestação, capítulo V) |
| Extensão de EDcl e contrarrazões a EDcl (decisão da titular, 17/10/2026) | ≤ 6 páginas (~300 palavras/página) e ≤ 6 transcrições em bloco (aviso do `ritmo.js`, pelo `titulo:`; `orcamento_paginas:` no frontmatter sobrescreve) | Regra e tabela de fontes de inflação no playbook `direito/pecas/embargos-declaracao`, seção "Extensão": voltar à estrutura, não cortar depois |
| Dois-pontos em série na prosa (preferência da titular, 12/08/2026) | ≤ 1 de prosa por capítulo (aviso do `ritmo.js`) | Reservar para citação em bloco, síntese e "requer-se:"; na argumentação, ponto, ponto e vírgula ou conjunção |
| Frase curta de efeito (≤ 10 palavras, sentenciosa, simétrica, abrindo ou fechando parágrafo) | ≤ 1 por peça, **por leitura** (não é lint: o corpus aprovado tem mais frases curtas que a peça de IA; o que denuncia é a função, `voz-forense.md` §8.1) | Integrar ao período vizinho com "porque", "de maneira que"; cortar quando só repete a conclusão |
| Quiasmo / espelho ("o que X fez, fez…; o que Y fez, fez…") | 0 (`lint-ia`) | Subordinar: um sujeito, um verbo, uma oração relativa |
| Contraste "não se trata de X, e sim Y" / "não X, e sim Y" | ≤ 1 por leitura; `lint-ia` reprova acima de 2 | Afirmar Y com a prova; o X fica implícito |
| Anáfora de artigo + palavra ("o único…, o único…, o único…") | 0 (`lint-ia`, extensão da tríade) | Cada item com verbo e documento próprios, ou fundir num período |
| Gancho de cena na abertura de capítulo (hora, minutos, dia da semana) | 0 (aviso do `ritmo.js`) | Abrir pelo sujeito e pela conclusão; a hora vai para a cronologia |
| Motivo repetido (mesma locução 2× no capítulo ou 3× na peça como refrão) | por leitura (4-grama repetido é quase sempre termo técnico) | Dizer de outro modo ou cortar; manter só onde a prova exige o fato |
| Fila de 3+ frases curtas seguidas (uma por critério) | aviso do `ritmo.js` | Um período subordinado que reúne os critérios e a prova |
| Enumeração seca no fecho do parágrafo | por leitura | Fecho com verbo e consequência |
| Molde uniforme (afirmação, prova, frase de efeito em série; checklist de um parágrafo por critério) | aviso existente do `ritmo.js` (tamanhos) + leitura | Variar ordem e tamanho conforme o peso do argumento; fundir critérios |
| Subtítulo-manchete ("O banco viu e não fez nada") | por leitura (`voz-forense.md` §8.10) | Construção nominal que resume a conclusão ("Da responsabilidade do banco pela validação de operação fora do perfil") |

Os limites acima com número são os do `lint-ia.js` (portão). Frequência estilística que o lint não conta (ritmo, aberturas, conectivos) é aviso do `ritmo.js`, não reprovação: indício para a passada humana, não prova de prosa ruim. Não se acrescenta palavra proibida à tabela para "pegar mais": o retorno é baixo e o custo é empobrecer o vocabulário jurídico.

## Falsos positivos do gênero forense (NÃO corrigir)

- **Voz passiva** ("foi violado", "restou comprovado"): nativa do gênero; manter quando natural.
- **Conectivos forenses** ("Ademais", "Outrossim", "Nesse sentido", "Diante do exposto"): legítimos com moderação (≤ 1 uso de cada por peça é saudável; o problema é série).
- **"Primeiro. Segundo. Terceiro."** como numeração de razões: técnica forense clássica, não regra de três.
- **Negrito em termos-chave pontuais**: legítimo com moderação (rótulos meta-textuais em negrito, porém, saem — ver invariante 2).
- **Repetição de termo técnico** (não "variar lexicalmente" nomes de institutos: fraude à execução é sempre fraude à execução).

## Processo de aplicação

1. **Medir.** `node scripts/lint-ia.js caminho/peca.md` (portão: conta os padrões fora de citação e falha acima dos limites, inclusive rótulos meta-textuais) e `node scripts/ritmo.js caminho/peca.md` (diagnóstico: frases de tamanho uniforme, parágrafos do mesmo tamanho em série, aberturas repetidas, conectivo em cada parágrafo, norma→aplicação→conclusão em série, fecho "Isso é X", enumeração fora dos pedidos, dois-pontos em série, capítulo raso, gancho de cena na abertura, fila de frases curtas; e informa a densidade de frases curtas sem veredito; nunca reprova). Linhas de tabela, de cronologia e subtítulos `##` ficam fora da prosa medida (correção de 15/10/2026). O `md2docx.js` já roda o `lint-ia` como portão de compilação.

   **O travessão é medido POR CAPÍTULO, não no total** (correção de 2026-08-04). O relatório nomeia o pior capítulo.

   **Lint verde não é prosa aprovada.** O lint pega padrões contáveis; o `ritmo.js` pega frequência; nenhum dos dois pega voz. Numa réplica real a peça passou em todos os itens e ainda assim foi lida como escrita por IA. Por isso o passo 2 inclui leitura, e não só medição.

2. **Decidir.** Há sinal se o lint reprovou, se o `ritmo.js` apontou sinal, ou se a leitura da peça contra `perfil/voz-forense.md` acusa prosa de modelo. Sem sinal: registrar `humanizer_alterou: nao` e encerrar aqui. Com sinal: seguir.

3. **Snapshot.** `node scripts/checar-invariantes.js --snapshot caminho/peca.md`. Sem isso o passo 5 não tem com o que comparar.

4. **Reescrever só a prosa própria**, seguindo a tabela e o perfil de voz; conferir cada invariante enquanto edita. **Calibração de voz, proporcional** (substitui a fronteira fixa de seis capítulos): peça curta ou rotineira, `perfil/voz-forense.md` basta; peça longa (> 6 capítulos), recurso ou peça estratégica, o perfil **e** uma peça humana próxima (razões, embargos, contrarrazões do próprio caso escritos por advogado, ou tema vizinho do escritório), da qual se imita o ritmo e **nunca** se copia fato, trecho ou número.

5. **Conferir invariantes.** `node scripts/checar-invariantes.js caminho/peca.md`. Violação (exit 1) desfaz a alteração correspondente; não se justifica nem se contorna. Depois, `--limpar`.

6. **Passada final anti-IA:** perguntar "o que neste texto ainda parece gerado por IA?" e corrigir o que sobrar; repetir o passo 5 se editou.

7. **Revalidar.** Toda alteração exige o `legal-consistency-validator` de novo (Estágio 3 do orchestrator): humanização depois da validação sem nova checagem é porta de entrada de erro. O orchestrator grava então os campos `humanizer_*` no `.validacao.md`.

8. Rodar o lint de novo até passar; depois `lint-remissoes.js` (peca-pma-builder) e gerar o .docx.

## Limites (fora do escopo)

- Não valida conteúdo jurídico (legal-consistency-validator) nem estrutura (checklists dos playbooks). O `checar-invariantes.js` confere que a humanização não mudou o mérito, não que o mérito está certo.
- Não aplicar a transcrições, contratos, atas ou traduções: só a prosa argumentativa própria.
- Texto não-forense (artigos, LinkedIn, e-mails): usar a skill `humanizer` genérica.
- O `lint-ia.js` é portão (`protect-gates`): correção de detector (falso positivo, divergência entre esta tabela e a regex) entra por patch em `planos/` e sessão de manutenção, não por edição direta.

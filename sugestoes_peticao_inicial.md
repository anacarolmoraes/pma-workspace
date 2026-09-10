# Sugestões para as ferramentas de petição inicial

> **Estado em 09/09/2026 (todas as notas ≥ 5 implementadas, exceto a 1):**
> 2 → skill `ficha-golpe-bancario` (calc.js + `--conferir`) · 3 → heurística
> `matriz-documentos-da-inicial.md` (transversal) + `matriz-documentos-golpe-bancario.md` (tema) +
> intake no Estágio 0 do orchestrator · 4, 5 e 11 → `planos/patch-manutencao-2026-09-08-inicial.js`
> (ensaiado em cópia: 16/16 F5, 21/21 rastro; aplicar com `PMA_MANUTENCAO=1`) · 6 →
> `pesquisa-djen/scripts/minerar-emendas.js` (12 emendas em 80 processos: gratuidade 9, documento
> faltante 8) · 7 → `material_padrao_escritorio/TEMPLATE_INICIAL_GOLPE_BANCARIO.md` · 8 →
> `radar-jurisprudencia/scripts/grupo-de-casos.js` · 9 → `peticao-inicial/perfis/` (index, template,
> `orgaos-frequentes.js`; nenhum perfil escrito: exige observação) · 10 → `caso.schema.json` +
> `legal-orchestrator/scripts/qualificacao.js`. **1 (dry-run em inicial real) é operação da titular,
> não código: continua sendo o próximo passo.**

**Data:** 2026-09-08. Levantamento sobre o estado real do fluxo (orchestrator 4.9.0, writer 3.6.0,
validator 2.9.0, `lint-inicial`, `lint-placeholder`, `ficha-rescisao-lote`, `checar-docs`,
`pedido_justica_gratuita`, bundle `direito/pecas/peticao-inicial/` com playbook, workflow, sete
heurísticas e checklist de saída). Complementa o PRD de 04/09 (`planos/2026-09-04_prd-fluxo-peticao-inicial.md`):
F1, F2, F3 e F5 estão feitas; F4 não. As notas seguem o critério do `sugestoes_chatgpt.md`:
impacto jurídico, redução de risco, esforço e prioridade.

## Achado que muda a ordem de tudo

**O pipeline da inicial nunca rodou em caso real.** Em `clientes/` não existe nenhuma
`ANALISE.md`, nenhum `<PECA>.estrutura.md` e nenhuma peça com `tipo: inicial`. As dez peças que
trazem `pipeline: legal-orchestrator` são réplicas, apelações, REsp, agravos e manifestações,
todas anteriores ao Estágio 0.5 (04/09). O `lint-inicial` só foi exercitado contra a fixture
sintética de `hooks/_teste-f5.js`. Ou seja: a técnica está escrita, os portões estão instalados,
e ninguém sabe ainda onde eles atritam com uma inicial de verdade.

| Sugestão | Nota | Avaliação |
|---|---:|---|
| 1. Rodar o fluxo inteiro numa inicial real antes de acrescentar qualquer coisa | **10/10** | Sem isso, toda melhoria abaixo é especulação. Uma passada revela falso positivo do `lint-inicial`, pergunta demais no Estágio 0.5, atrito do `require-leitura`. Custo: uma sessão. |
| 2. Ficha numérica para golpe bancário e negativação | **9,5/10** | O domínio principal do escritório não tem calculadora; só o lote tem. Valor da causa, dano material por transação, dobro condicional, encargos por verba e teto do Juizado saem de conta, não de olhômetro. |
| 3. Roteiro de intake e matriz de documentos da inicial | **8,5/10** | Contestação e réplica geram roteiro de entrevista a partir da peça adversária; a inicial, peça mais produzida, não tem instrumento de coleta. A matriz só existe para consignado. |
| 4. Fechar o rastro do Estágio 0.5 no `md2docx` (estrutura aprovada) | **8/10** | O orchestrator já prevê o portão "se o estágio se mostrar pulado". Zero estruturas em disco é o sinal. Instalar depois da sugestão 1, não antes. |
| 5. `lint-inicial` v2: coerência numérica, rol de documentos, encargos | **8/10** | O que hoje é mecânico e ninguém confere: valor da causa igual em todas as menções, `Doc. N` com rol, "correção pela Selic", intimação exclusiva do 272 §5º. Separar bloqueio de aviso. |
| 6. Mineração dos despachos de emenda (F4.1) | **7,5/10** | É o único item que transforma o checklist de opinião em estatística. Depende do texto da comunicação, que a fila não guarda, e de o monitor voltar a rodar (parado há 40 h). |
| 7. Template de inicial de golpe bancário | **7,5/10** | Só o lote tem template. Golpe e negativação nascem do esqueleto a cada vez, o que custa tempo e varia forma. Risco de homogeneizar; mitigado pelas cinco variáveis do playbook. |
| 8. Grupo de casos do dano moral como saída do `radar-jurisprudencia` | **7/10** | A heurística bifásica exige três a cinco acórdãos do tribunal competente; o acervo tem dois perfis, ambos de 2º grau, n=1. O radar já busca no DJEN; falta o modo "grupo de casos" e o depósito. |
| 9. Perfis de vara de 1º grau (F4.2) | **7/10** | Porto Nacional, SJU de Palmas, Gurupi, Trindade e Goiânia recebem a maioria das iniciais. O Estágio 0 já prevê ler o perfil quando a comarca coincide; não há perfil para ler. |
| 10. Qualificação das partes em dado estruturado | **6,5/10** | CPF, e-mail e endereço digitados a cada peça. Um `caso.json` em `clientes/<caso>/` alimenta o preâmbulo, a ficha e o `_processos.json`. Baixo esforço, erro de digitação em CPF deixa de existir. |
| 11. `lint-inicial` conferir a forma da gratuidade pós-ADC 80 | **5/10** | Hoje só checa art. 98/99. A forma A ou B pela faixa de R$ 5 mil é decisão da skill `pedido_justica_gratuita`; o lint poderia exigir que a peça declare a faixa. Ganho pequeno enquanto a ata da ADC 80 não sai. |
| 12. Estágio novo no orchestrator, prompt genérico de inicial, mais palavras proibidas | **2/10** | Fora de escopo pelo mesmo motivo do PRD: o pipeline tem os estágios que precisa e o que os prompts genéricos agregavam já foi absorvido. |

## 1. Rodar o fluxo inteiro numa inicial real

Escolher um caso de golpe bancário ou negativação em atendimento (não o lote: o lote tem
template e ficha, e a passada "sem parar" do template esconde o atrito do esqueleto). Executar
o workflow do bundle de ponta a ponta e registrar, sem corrigir no meio:

- quantas perguntas o Estágio 0.5 precisou fazer (o limite é quatro; mais que isso é inventário
  incompleto ou esqueleto que pede decisão demais);
- cada item do `lint-inicial` que reprovou uma peça correta (candidato a falso positivo: o
  título exato `# I. Da síntese da lide`, a regex do valor da causa, o teste de "Dos pedidos"
  que exige o título numerado romano);
- cada item do checklist de saída que o validator não conferiu e o Estágio 6 deixou passar;
- o tempo gasto em cada estágio.

O resultado vai para `direito/pecas/peticao-inicial/log.md` e decide a ordem das sugestões 4 e 5.
Enquanto isso não acontece, o `lint-inicial` deve continuar exatamente como está: portão que
nunca reprovou uma peça real não se afina de ouvido.

## 2. Ficha numérica para golpe bancário e negativação

A `ficha-rescisao-lote` existe porque um caso de jul/2026 saiu com valor da causa errado e
percentual lido no olhômetro. Golpe bancário tem os mesmos erros à espera, e mais alguns:

| O que a ficha calcula | Por que importa |
|---|---|
| Dano material por transação (data, valor, canal, destino), com soma e detecção de dupla contagem entre extratos de bancos diferentes | O erro "mais atacado em contestação" segundo o próprio playbook de consignado é a inconsistência valor da causa × descontos × pedido |
| Dobro do art. 42, p.ú., condicionado à data (modulação do EAREsp 600.663/RS) | Pedir o dobro incondicionalmente é o primeiro "erro a evitar" do playbook |
| Encargos por verba: índice, taxa e termo inicial (IPCA; taxa legal do CC 406; Súmulas 43, 54 e 362), com a regra intertemporal da Lei 14.905/2024 | A heurística já existe; a conta ainda é feita à mão |
| Dano moral: valor básico do grupo de casos e degraus da segunda fase, cada um com `Doc. N` | O número entra no 292, V; sem ficha, entra "por arbitramento" |
| Valor da causa pela regra do `definicoes.md` §1 (soma material + moral pedido) | Uma só fonte para o número que aparece três vezes na peça |
| Teto do Juizado (40 salários mínimos vigentes) contra o valor da causa, e perícia necessária | A decisão de abertura "Juizado × vara" vira dado, não opinião |

Forma recomendada: generalizar `skills/ficha-rescisao-lote/scripts/calc.js` em um `ficha-inicial`
com módulos por matéria (`lote`, `golpe`, `negativacao`), mesma saída `FICHA_CASO.md` mapeada a
placeholders. A ficha passa a ser **gabarito do validator**: todo `R$` da peça é conferido contra
ela (hoje o validator confere "valores repetidos idênticos entre si", mas não contra uma fonte).

## 3. Roteiro de intake e matriz de documentos da inicial

Assimetria visível no orchestrator: para contestação, a seção 5 da `ANALISE.md` começa pelo
"roteiro de entrevista do réu gerado da inicial"; para réplica, a seção 6 começa pelo "roteiro
de entrevista do autor gerado da contestação". Para a inicial, a seção 1 pede cronologia e a
seção 3 pede mapa probatório, mas nada gera as perguntas ao cliente nem a lista do que ele tem
de trazer. A `matriz-documentos-fraude-consignado.md` é o modelo certo (documento, criticidade,
tese que o justifica, minimização LGPD) e só existe para um tema.

Proposta em duas camadas:

- **Transversal**, em `direito/pecas/peticao-inicial/heuristicas/matriz-documentos-da-inicial.md`:
  o que o art. 320 sempre exige (procuração, identidade, residência, instrumento da relação,
  comprovantes) e a regra de derivação: cada fato "a produzir" do mapa probatório vira pergunta
  ao cliente com o documento esperado, e cada documento em poder do réu vira pedido do art. 397.
- **Por tema**, nos bundles de golpe, negativação e lote, no molde da matriz de consignado.

Saída na pasta do caso: checklist `presente | pendente | dispensado (motivo)` que alimenta o
`documentos:` do frontmatter (o `checar-docs.js` já lê esse rol) e fecha o 320 antes da emenda
chegar. Emenda por documento faltante é a segunda causa mais previsível depois do valor da causa.

## 4. Fechar o rastro do Estágio 0.5 no `md2docx`

O orchestrator diz textualmente: "Sem hook por enquanto: entra no `md2docx` se, em uso, o
estágio se mostrar pulado". Zero arquivos `.estrutura.md` em `clientes/` desde 04/09 é o
critério satisfeito. O portão é simétrico ao do `.validacao.md`, já instalado: peça com
`pipeline:` exige `<PECA>.estrutura.md` ao lado, com `aprovada: sim`, mais antigo que a primeira
gravação da peça. Peça de template (`inicial-rescisao-lote`) declara `estrutura: template` no
frontmatter e passa, como o playbook já prevê.

Condição: só depois da sugestão 1. Se o dry-run mostrar que o Estágio 0.5 pede decisão demais
para inicial simples, o que se ajusta é o estágio, e o portão nasce calibrado. Sessão de
manutenção (`PMA_MANUTENCAO=1`), porque toca `md2docx` e `hooks/_teste-rastro.js`.

## 5. `lint-inicial` v2

Nove testes hoje, todos de presença ("existe bloco ::endereco", "existe R$ perto de 'valor da
causa'"). O que o checklist de saída chama de mecânico e o lint ainda não vê:

**Bloqueio** (erro claro):
- valor da causa declarado difere de qualquer outra menção a "valor da causa" na peça, ou, quando
  há seção "Dos pedidos" com alíneas quantificadas e a regra é o 292, VI, difere da soma delas;
- peça cita `Doc. N` e não tem `documentos:` no frontmatter (o `checar-docs.js` existe e não é
  portão; passa a ser chamado pelo `lint-inicial`);
- "correção monetária pela Selic" ou variante (a Selic é base da taxa legal de juros, não índice
  de correção; erro de prompt genérico apontado pelo checklist).

**Aviso** (revisão humana):
- intimações exclusivas do art. 272, §5º ausentes dos requerimentos finais;
- capítulo com título-tese em "Do direito" sem alínea correspondente em "Dos pedidos"
  (teste 2 do playbook, aproximado por palavras-chave; heurístico, por isso aviso);
- tutela pedida citando art. 300 ou 311 sem número, mês ou "R$" no mesmo capítulo (indício de
  "citar o artigo sem descrever o fato");
- gratuidade pedida sem declaração da faixa ou da forma (sugestão 11).

A separação bloqueio × aviso é a mesma que o `sugestoes_chatgpt.md` recomenda para o `lint-ia`:
frequência e aproximação são indício, não prova. Sessão de manutenção; fixture de `_teste-f5.js`
ganha um caso por regra.

## 6. Mineração dos despachos de emenda

A fila do DJEN tem 246 linhas e **zero ocorrências de "emenda"**: a coluna `documento` guarda só
o tipo ("Despacho", "Ato ordinatório"), não o texto. O `log.md` do bundle não tem uma causa de
emenda registrada. Para a F4.1 acontecer:

1. `djen.js` (ou script novo `minerar-emendas.js` em `skills/pesquisa-djen/scripts/`) busca o
   texto das comunicações de tipo Despacho ou Ato ordinatório cujos processos têm inicial nossa
   (cruzamento pelo `_processos.json`);
2. filtro por "emend", "regulariz", "art. 321", "documentos indispensáveis", "valor da causa";
3. classificação em cinco causas (valor da causa, documento faltante, qualificação, gratuidade,
   pedido indeterminado) e gravação de uma linha por despacho no `log.md` do bundle;
4. contagem vira nota no checklist de saída, como a heurística de emenda já manda.

Dependências reais: o monitor está parado há 40 h e a fila nunca foi consumida (nenhuma linha
`TRATADA`). A mineração roda em modo só-leitura sobre a fila bruta, mas o dado só fica confiável
quando a coluna `caso` deixar de ser "?" na maioria das linhas.

## 7. Template de inicial de golpe bancário

`TEMPLATE_INICIAL_RESCISAO_LOTE.md` provou o modelo: frontmatter com `tipo: inicial` e `bundle:`,
comentário de checagens obrigatórias, placeholders `[[...]]` que o `lint-placeholder` barra se
sobrarem. Golpe bancário e negativação, que são o domínio principal, não têm equivalente. As
peças-ouro A e B que o `legal-writer` cita são camada C1 e não podem virar template como estão;
o template nasce do esqueleto do playbook com as variáveis fixadas para o tema (tutela logo
após os fatos, capítulo de danos sim, competência normalmente não, gratuidade sim), sem nenhum
dado de caso.

Risco: template homogeneiza e o `lint-ia` acusa frase-clone entre peças do mesmo escritório.
Mitigação: o template guarda estrutura e fórmulas de forma (endereçamento, qualificação,
requerimentos finais), não a prosa dos capítulos de fato e direito.

## 8. Grupo de casos do dano moral

A heurística bifásica manda colher três a cinco acórdãos do tribunal competente para o mesmo
interesse lesado e declarar o valor básico. Hoje a fonte indicada é `casos_decididos/`,
`perfis/` e a skill `radar-jurisprudencia`. Os perfis são dois (TJRO e TJRS, ambos 2º grau,
n=1 cada). Proposta: o radar ganha o modo `--grupo-de-casos "<interesse>" --tribunal TJTO`,
que devolve tabela (acórdão, câmara, data, valor fixado, se manteve ou reduziu) e a deposita
como página `em_teste` no bundle temático. A regra 3 continua: o valor só entra na peça depois
de a titular conferir a página, mas a busca deixa de ser manual e o valor pedido passa a ter
fonte declarada em vez de hábito.

## 9. Perfis de vara de 1º grau

O Estágio 0 já diz "existe um perfil de juízo lido pelo Estágio 0 quando a comarca coincide" como
critério de pronto da F4.2, e não há perfil de 1º grau para ler. Começar por três: Porto
Nacional (cível), SJU das Varas Cíveis de Palmas e Trindade/GO (2ª Vara Cível), que são as que
mais aparecem na fila. Conteúdo: tratamento da gratuidade (defere de plano, exige documento,
qual), tutela em golpe bancário (defere no despacho inicial ou depois da contestação), reação a
valor da causa, prazo médio até o primeiro despacho. Só padrão público de julgamento; nada de
dado pessoal de magistrado, como o perfil do TJRO já adverte.

## 10. Qualificação das partes em dado estruturado

A qualificação do art. 319, II, é digitada a cada peça e o `lint-inicial` só confere se há CPF e
e-mail. Um `clientes/<caso>/caso.json` (nome, nacionalidade, estado civil, profissão, CPF,
endereço, e-mail; réu com CNPJ e sede) alimenta o preâmbulo do template, a ficha numérica e o
`_processos.json` do monitor. O hook `block-dado-caso` já garante que o arquivo não sai de
`clientes/`. Ganho pequeno por peça, mas elimina uma classe de emenda (qualificação incompleta)
e uma classe de erro grave (CPF trocado).

## Ordem recomendada

1. Dry-run em inicial real (sugestão 1), uma sessão.
2. Ficha numérica de golpe (2) e matriz/intake (3), que não dependem do dry-run e alimentam o
   próximo caso.
3. Sessão de manutenção única para 4 e 5, calibradas pelo que o dry-run mostrou.
4. F4 (6 e 9) depois de o monitor voltar e a fila ganhar `caso` preenchido.
5. Template de golpe (7) e grupo de casos (8) quando houver dois ou três casos rodados.

Se só uma coisa puder ser feita, é a sugestão 1: o fluxo tem cinco portões e sete heurísticas
construídos em cinco dias e nenhum atrito medido. O que se aprende numa inicial real vale mais
do que qualquer regra nova.

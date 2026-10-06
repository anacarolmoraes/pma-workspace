# PRD — Calibração empírica da voz forense e fechamento da revisão no Word

**Data:** 2026-10-03

**Status:** rascunho aguardando aprovação da titular

**Origem:** avaliação do projeto externo `petergyang/no-ai-slop` e diagnóstico, pela titular,
de que as petições do pipeline às vezes têm períodos curtos demais, títulos pouco formais e
passagens que "só incomodam", embora o motivo não seja imediatamente verbalizável.

---

## 0. Decisão

O sistema não ganhará, de saída, outra lista de palavras proibidas nem instalará o
`no-ai-slop`. O problema será tratado por evidência própria: comparar a prosa produzida pelo
pipeline com a versão efetivamente revisada pela titular, descobrir quais transformações se
repetem e testar, às cegas, se as preferências extraídas reduzem a aparência de texto gerado.

O projeto tem dois trilhos inseparáveis:

1. **fechamento da revisão:** devolver ao `.md` canônico as alterações textuais feitas pela
   titular no `.docx`, sem perder marcação PMA, citações, fontes ou portões;
2. **calibração da voz:** aprender apenas preferências estilísticas recorrentes, sem confundir
   correção jurídica, estratégia do caso, dado de cliente ou erro eventual com voz autoral.

Não haverá nova skill no primeiro ciclo. O piloto usará `diff-peca`, scripts em `tmp/` e os
componentes existentes. A criação de uma skill própria fica condicionada à prova de que o
fluxo é recorrente, estável e melhora o resultado.

## 1. Problema

### 1.1 A peça aprovada deixa a fonte para trás

O pipeline redige em Markdown, compila para DOCX e a titular revisa o DOCX no Word. O `.md`
permanece no estado anterior. Com isso:

- a fonte canônica não representa a peça efetivamente aprovada;
- uma recompilação pode ressuscitar redação já rejeitada;
- o texto protocolado pode não ter passado pelos portões depois da revisão;
- as escolhas da titular ficam presas no DOCX e não alimentam o sistema;
- `diff-peca` mostra as diferenças, mas não fecha o ciclo nem acumula aprendizado.

O DOCX revisado e o MD antigo formam, ao mesmo tempo, um defeito operacional e o melhor par de
treinamento disponível: o MD é o "antes"; o DOCX contém o "depois" autorizado pela titular.

### 1.2 O pipeline mede cacoetes, mas não conhece suficientemente a autora

`lint-ia.js` bloqueia padrões contáveis; `ritmo.js` mede uniformidade; `perfil/voz-forense.md`
descreve ritmo e registro; o humanizer protege invariantes. Ainda assim, uma peça pode passar
e continuar artificial porque o problema está na composição inteira:

- períodos curtos em quantidade ou sequência, mesmo acima do limite atual de três palavras;
- alternância mecânica entre período longo e frase curta de impacto;
- títulos que enunciam a tese como manchete, e não como linguagem forense;
- parágrafos excessivamente fechados, cada qual com fato, norma e conclusão completa;
- explicitação de relações que o documento ou a justaposição já demonstram;
- distribuição uniforme de espaço entre argumento decisivo e argumento secundário;
- conectivos inseridos para anunciar relações já evidentes;
- capítulos com arquitetura repetida.

### 1.3 As instruções atuais têm tensões que podem gerar artificialidade

O `legal-writer` exige ancoragem explícita na abertura de cada parágrafo, enquanto o perfil de
voz prefere abertura por fato ou circunstância e o `ritmo.js` alerta quando conectivos dominam.
O writer recomenda deliberadamente uma frase curta depois de passagem longa; o perfil a trata
como pontuação excepcional; o lint só alcança o caso extremo. O aviso de título sem verbo pode
empurrar o redator para frases completas, embora um título nominal possa resumir a conclusão
com mais formalidade.

Essas tensões serão resolvidas antes de se acrescentar regra nova.

## 2. Objetivos

1. Reduzir, segundo julgamento cego da titular, a aparência de texto gerado por IA.
2. Fazer a versão aprovada no Word retornar ao Markdown com paridade textual verificável.
3. Diminuir o volume de alterações estilísticas manuais nas peças seguintes.
4. Extrair um perfil autoral abstrato, sem copiar trechos, fatos ou dados de clientes.
5. Preservar integralmente mérito, prova, transcrições, citações, modalidade, negações e
   pedidos durante qualquer passada de estilo.
6. Evitar que uma preferência isolada vire regra universal.

## 3. Não objetivos

- Detectar ou afirmar autoria por IA.
- Otimizar texto para enganar detector automático.
- Transformar toda edição da titular em regra.
- Ingerir peças de clientes no arsenal, em skill ou em repositório distribuível.
- Automatizar cegamente a conversão DOCX → MD.
- Substituir o `legal-consistency-validator`, o `lint-citacoes` ou os demais portões.
- Padronizar todas as matérias e todos os tipos de peça com a mesma cadência.
- Instalar o `no-ai-slop` como dependência ou portão.

## 4. Definições de produto

### 4.1 Título-síntese formal

O conceito atual de título-tese passa, se o piloto confirmar, a **título-síntese formal**:

> título que resume o bloco argumentativo e antecipa seu conteúdo ou conclusão jurídica,
> preferencialmente por construção nominal própria de petição, sem manchete, slogan, pergunta,
> coloquialismo ou frase de efeito.

O título resume o **bloco ou capítulo**, não cada parágrafo. Formas esperadas:

- `Da inexistência da mora por ausência de notificação válida`;
- `Da responsabilidade objetiva pelas operações incompatíveis com o perfil da autora`;
- `Da contradição entre a defesa e a prova documental`.

Frase finita permanece possível quando a precisão jurídica exigir, mas não é imposta pelo
lint. `Do mérito` é genérico; `O banco viu a fraude e não fez nada` é editorial; nenhum dos dois
é o padrão buscado.

### 4.2 Período curto funcional

Não haverá número mágico de palavras antes do corpus. Período curto é legítimo quando realiza
trabalho próprio: fixa uma consequência, marca uma virada real ou encerra questão já
demonstrada. É sinal de artificialidade quando apenas repete a conclusão, cria impacto ou
aparece em sequência previsível.

O piloto medirá, sem reprovar:

- distribuição de palavras por período;
- sequências de dois ou mais períodos curtos;
- frase curta no fim de parágrafos consecutivos;
- alternância repetida entre período longo e curto;
- diferença entre a distribuição do rascunho e a da versão da titular.

Os limiares só serão propostos depois da observação do corpus humano.

### 4.3 Incômodo não verbalizado

`Só incomoda` é uma avaliação válida. A titular não precisa diagnosticar a causa antes de
editar. O sistema registra o trecho, compara o antes e o depois e procura recorrência em outros
pares. O nome do padrão vem depois da evidência, não antes.

## 5. Princípios

1. **A titular é o avaliador primário.** Detector externo não substitui sua percepção.
2. **Aprender por diferença.** A unidade de aprendizado é a transformação rascunho → versão
   aprovada, não uma palavra isolada.
3. **Regra positiva antes de blacklist.** Descrever como a autora constrói o argumento é mais
   útil que ampliar vocabulário proibido.
4. **Mínima alteração eficaz.** Texto natural não é reescrito para uniformização.
5. **Estrutura, mérito e superfície são camadas diferentes.** Alterar uma não autoriza tocar
   nas demais.
6. **Frequência não substitui julgamento.** Recorrência sugere preferência; a titular decide
   se ela é durável.
7. **Nenhum dado C1 sai do lugar.** Peças permanecem em `clientes/`; manifestos, diffs e testes
   vivem em `tmp/`; somente abstrações validadas podem chegar a `perfil/voz-forense.md`.
8. **Nenhuma transcrição vira exemplo de estilo.** Citação, lei, contrato e texto de terceiro
   ficam fora das métricas de voz.

## 6. Corpus mínimo do piloto

Não é necessário organizar o acervo inteiro.

| Conjunto | Conteúdo | Quantidade inicial | Finalidade |
|---|---|---:|---|
| A — humano | peças redigidas substancialmente pela titular, de preferência anteriores ao uso intenso de LLM | 3 | referência positiva de voz |
| B — pares | `.md` gerado + `.docx` posteriormente revisado pela titular | 3 | aprender transformações reais |
| C — reserva | peças ou blocos não usados na extração | 2 | teste cego de generalização |

Buscar, se possível, variedade mínima: uma inicial, uma peça de resposta ou manifestação e um
recurso. A seleção é por qualidade autoral, não por volume.

O manifesto do piloto fica em `tmp/voz-forense/<sessao>/`, contém apenas caminhos locais e não
é versionado. Nenhum arquivo é movido nem copiado para bundle ou skill.

## 7. Classificação das alterações

Cada diferença relevante do conjunto B recebe uma classe:

| Classe | Exemplo | Destino |
|---|---|---|
| voz/ritmo | três períodos curtos viraram um período subordinado | candidata ao perfil |
| voz/registro | título editorial virou título nominal formal | candidata ao perfil |
| densidade | explicação óbvia foi suprimida | candidata ao perfil |
| arquitetura | dois subtítulos viraram um bloco | candidata, separada por tipo de peça |
| estratégia | argumento fraco foi omitido | heurística do acervo, não voz |
| mérito | tese, pedido ou modalidade mudou | caso/validator, não voz |
| prova | afirmação foi ajustada ao documento | caso/mapa probatório, não voz |
| dado C1 | nome, data, valor ou cláusula corrigidos | somente o caso |
| erro eventual | typo ou lapso | não propagar |
| inconclusiva | mudou, mas a causa não está clara | acumular, sem promover |

Critério inicial de promoção: três ocorrências em ao menos duas peças diferentes, ou decisão
expressa da titular diante de padrão inequívoco. A regra promovida é abstrata e usa exemplo
fictício.

## 8. Fluxo de fechamento da revisão

### 8.1 Entrada

- MD que gerou a peça;
- DOCX revisado pela titular;
- `.validacao.md` existente, quando houver.

### 8.2 Processo

1. `diff-peca` extrai e alinha parágrafos, sem editar nenhum arquivo.
2. O relatório separa adição, remoção, alteração, movimentação provável e diferença apenas de
   formatação.
3. O agente classifica as mudanças segundo a tabela do §7.
4. O conteúdo aprovado é transposto ao MD por edição consciente, preservando frontmatter,
   diretivas, títulos, blockquotes e fontes adjacentes.
5. A extração textual do DOCX revisado é comparada ao MD atualizado; divergência residual é
   relatada por parágrafo.
6. Mudança jurídica ou probatória não é bloqueada por ser diferente do original — ela veio da
   titular —, mas obriga nova validação jurídica e novos lints.
7. Rodar `lint-citacoes`, `lint-remissoes`, `lint-ia`, `lint-injecao` e
   `legal-consistency-validator` sobre o MD atualizado.
8. Rodar `lint-docx` sobre o DOCX revisado. Validar conteúdo do DOCX contra o MD atualizado.
9. Se o DOCX revisado estiver conforme e tiver paridade de conteúdo, ele permanece como versão
   final; não recompilar apenas para destruir ajustes legítimos feitos no Word.
10. Se falhar em conteúdo ou formatação, corrigir pela fonte e recompilar pelo `md2docx`; nunca
    usar `--skip-lint`.

### 8.3 Segurança do fechamento

- Não substituir o MD automaticamente pelo texto extraído do Word.
- Não alterar citações literais sem conferir a fonte.
- Não usar o guardião do humanizer para rejeitar uma mudança de mérito deliberada pela titular;
  nesse fluxo, o guardião relevante é a paridade DOCX revisado ↔ MD atualizado.
- Não criar relatório persistente na pasta do cliente. Todo rastro vai para `tmp/`.
- Não apagar o DOCX revisado nem sobrescrevê-lo durante o piloto.

## 9. Extração e cartão de voz

O piloto produz um cartão curto, não uma skill extensa:

- 8 a 12 comportamentos positivos confirmados;
- 5 a 8 tendências que a titular reiteradamente remove;
- variações por tipo de peça, somente quando houver evidência;
- exemplos fictícios de antes/depois;
- grau de confiança e número de peças em que o padrão apareceu.

Dimensões mínimas:

1. tamanho e variação de períodos e parágrafos;
2. sequências de períodos curtos;
3. abertura e fecho dos parágrafos;
4. densidade de conectivos;
5. títulos-síntese formais;
6. quantidade e profundidade de subdivisões;
7. posição da conclusão;
8. forma de ligar fato, documento, norma e consequência;
9. explicações removidas por serem óbvias;
10. distribuição de espaço entre argumentos principais e secundários.

O cartão é primeiro testado em `tmp/`. Só depois de aprovação é incorporado, de forma enxuta,
ao `perfil/voz-forense.md`, que deixa de ser `rascunho` quando a titular validar o conjunto.

## 10. Uso limitado do `no-ai-slop`

O projeto externo será apenas uma lente adversarial no piloto. Suas sugestões entram na
classificação somente quando forem compatíveis com português jurídico e coincidirem com uma
edição real da titular.

Podem ser testados: edição mínima, teste de portabilidade, metadiscurso interpretativo,
atribuição vaga e proteção do fato específico. Ficam rejeitados como regras gerais: voz ativa
obrigatória, fragmentação como traço autoral, proibição de conclusão, lista vocabular inglesa e
reescrita genérica de períodos longos.

## 11. Fases

### F0 — Seleção mínima e baseline

- localizar os conjuntos A, B e C, sem reorganizar o acervo inteiro;
- rodar `lint-ia` e `ritmo.js` nas peças do corpus apenas como fotografia;
- registrar avaliação inicial da titular: `IA evidente`, `um pouco artificial`, `natural mas
  não é minha voz`, `soa como eu`, `só incomoda`;
- medir o volume de alterações estilísticas nos três pares.

**Pronto quando:** há 3 peças humanas, 3 pares e 2 reservas legíveis, com manifesto apenas em
`tmp/`, e uma baseline reproduzível.

### F1 — Diff estruturado e taxonomia

- ampliar `diff-peca` para saída JSON estável, preservando a saída humana atual;
- melhorar o alinhamento para reconhecer divisão, fusão e movimentação provável de parágrafo;
- separar transcrição e prosa própria quando a origem MD permitir;
- classificar as diferenças conforme o §7;
- gerar relatório agregado sem armazenar texto C1 fora de `tmp/`.

**Pronto quando:** os três pares podem ser classificados sem reler integralmente os DOCX, e a
titular reconhece o relatório como descrição fiel das suas alterações.

### F2 — Protótipo de fechamento DOCX → MD

- implementar reconciliação assistida sobre cópia de trabalho em `tmp/`;
- atualizar o MD de um caso-piloto preservando o dialeto PMA;
- comparar conteúdo do MD atualizado com o DOCX revisado;
- reexecutar validator e os cinco lints aplicáveis;
- decidir, com base no piloto, se o fluxo entra em `diff-peca` ou merece a skill separada
  `fechar-revisao-peca`.

**Pronto quando:** um par real termina com paridade textual verificável, nenhum dado perdido,
nenhuma transcrição alterada silenciosamente e DOCX final aprovado pelos portões.

### F3 — Perfil empírico preliminar

- extrair distribuições e transformações recorrentes;
- redigir o cartão de voz;
- resolver as contradições entre `legal-writer`, `humanizer-forense`, `ritmo.js` e
  `perfil/voz-forense.md`;
- formular título-síntese formal e período curto funcional como regras positivas.

**Pronto quando:** cada regra do cartão aponta para recorrência observada ou decisão expressa
da titular, sem conter trecho ou dado de caso real.

### F4 — Teste cego

Para blocos das peças reservadas, produzir de forma randomizada:

- A: pipeline atual;
- B: pipeline com cartão de voz;
- C, opcional: limpeza genérica inspirada no `no-ai-slop`.

A titular avalia sem saber a origem: menos cara de IA, mais parecida com sua voz, mais
persuasiva e menor necessidade de edição. `Só incomoda` continua sendo resposta válida; a
edição posterior ajuda a explicar o motivo.

**Pronto quando:** existem ao menos 12 comparações pareadas, com ordem randomizada e resultado
registrado sem revelar a variante antes do julgamento.

### F5 — Integração controlada

Somente se F4 atingir os critérios do §12:

- promover o perfil validado;
- ajustar o `legal-writer` para continuidade lógica sem conectivo obrigatório em todo
  parágrafo;
- remover a prescrição de que o parágrafo principal deve ser sempre o mais curto;
- redefinir título-tese como título-síntese formal;
- ajustar o aviso de título do `lint-ia` para não exigir verbo finito;
- acrescentar ao `ritmo.js`, primeiro como aviso, os medidores de sequências curtas e alternância
  mecânica, com limiares derivados do corpus;
- atualizar o Estágio 5 do `legal-orchestrator` sem criar novo estágio;
- criar skill de fechamento apenas se o protótipo mostrar que ela reduz erro e trabalho.

Alteração em `lint-ia`, `ritmo.js`, portões ou definições ocorre em sessão de manutenção
declarada, com testes antes e depois.

### F6 — Aprendizado contínuo

- todo DOCX revisado pode passar pelo fechamento;
- preferências novas ficam como observações até ganhar recorrência;
- revisão periódica remove regras que não generalizam;
- nenhum caso real vira exemplo distribuível;
- medir, nas três primeiras peças posteriores, quanto caiu a edição estilística manual.

## 12. Métricas e critérios de sucesso

### Primários

1. A variante calibrada é preferida em **pelo menos 70%** de 12 ou mais comparações cegas.
2. Nas três peças posteriores, as alterações classificadas como voz/ritmo/registro caem em
   **pelo menos 30%** contra a baseline.
3. Toda peça fechada tem **100% de paridade textual** entre MD atualizado e DOCX final, ressalvada
   diferença de apresentação declarada.
4. Nenhuma regressão de citação, número, data, dispositivo, modalidade, negação ou pedido.

### Secundários

- a titular considera formais pelo menos 90% dos títulos da variante calibrada;
- nenhum portão novo nasce antes do teste cego;
- aviso novo tem falsos positivos documentados em menos de 10% dos trechos humanos do corpus;
- o cartão de voz permanece curto e cada regra tem origem verificável;
- o tempo de fechamento é menor que a reconciliação manual integral do MD.

Falhar na meta de preferência cega encerra ou redesenha o piloto; não se compensa o resultado
adicionando mais regras.

## 13. Arquivos provavelmente afetados após aprovação

| Arquivo/componente | Mudança possível | Fase |
|---|---|---|
| `skills/diff-peca/scripts/diff_peca.py` | JSON, alinhamento, fusão/divisão e relatório agregado | F1 |
| `skills/diff-peca/SKILL.md` | documentar saída e triagem ampliadas | F1 |
| `perfil/voz-forense.md` | perfil empírico validado; título-síntese formal | F3/F5 |
| `skills/legal-writer/SKILL.md` | retirar prescrições que geram uniformidade; aplicar perfil | F5 |
| `skills/humanizer-forense/SKILL.md` | critérios positivos e mínima alteração eficaz | F5 |
| `skills/humanizer-forense/scripts/ritmo.js` | avisos derivados do corpus | F5 |
| `skills/humanizer-forense/scripts/lint-ia.js` | corrigir aviso de título, se confirmado | F5 |
| `skills/legal-orchestrator/SKILL.md` | fechar o laço de revisão no Estágio 5/6 | F5 |
| `skills/fechar-revisao-peca/` | somente se F2 justificar skill própria | pós-F2 |

Se uma definição já tiver casa canônica, os demais componentes apontam para ela; não se copia
a mesma regra entre writer, humanizer e perfil.

## 14. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| superajuste a três peças | conjunto reservado, variedade de gênero e teste cego |
| aprender vício ou typo da titular | classificação e promoção por recorrência/decisão expressa |
| confundir mudança jurídica com estilo | taxonomia do §7 e nova validação obrigatória |
| perder marcação ao trazer DOCX para MD | reconciliação assistida; nunca conversão cega |
| destruir formatação legítima do Word | validar o DOCX revisado antes de decidir recompilar |
| acumular instruções contraditórias | uma casa canônica e poda simultânea das regras antigas |
| transformar métrica em meta estilística | métricas diagnosticam; julgamento da titular decide |
| contaminar bundle/skill com C1 | corpus em `clientes/`, rastro em `tmp/`, apenas abstrações versionadas |
| criar mais uma skill sem necessidade | decisão adiada até o protótipo F2 |
| tornar a prosa artificial por excesso de lint | avisos primeiro; portão só com precisão demonstrada |

## 15. Decisões pendentes para o início da execução

1. Quais três peças compõem o corpus humano inicial.
2. Quais três pares MD/DOCX têm revisão textual relevante e são mais fáceis de localizar.
3. Se a titular costuma fazer, além de texto, alterações visuais que precisam permanecer no
   DOCX final; isso define se o fechamento valida o DOCX existente ou recompila por padrão.
4. Qual peça fica reservada para o primeiro teste cego.

Essas decisões não impedem a aprovação do PRD; são entradas da F0.

## 16. Testes de aceitação do produto final

- Dado um MD antigo e seu DOCX revisado, o sistema produz diff legível e JSON sem modificar
  os originais.
- Uma fusão de três parágrafos em um é reconhecida como transformação, não como três remoções
  e uma adição desconectadas.
- Uma citação literal alterada no Word é destacada como mudança sensível e exige conferência.
- O MD reconciliado preserva frontmatter, diretivas PMA, blockquotes e fontes adjacentes.
- O comparador confirma paridade entre o MD reconciliado e o DOCX final.
- O relatório agregado separa voz, estratégia, mérito, prova, dado C1 e erro eventual.
- O cartão de voz não contém nome, número, fato ou trecho de cliente.
- Título nominal formal não recebe aviso apenas por não ter verbo finito.
- Sequência de períodos curtos aparece como diagnóstico, sem reprovação automática.
- A titular consegue marcar `só incomoda` sem precisar escolher uma causa pré-definida.
- O teste cego não revela qual variante veio do pipeline calibrado.
- Se a variante calibrada não vencer, nenhuma regra é promovida e nenhum portão é criado.

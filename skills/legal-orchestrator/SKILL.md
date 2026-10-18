---
name: legal-orchestrator
version: 4.12.1
description: |
  Orquestra o pipeline completo de uma peça jurídica: inventário das fontes e do acervo, análise
  do caso (ANALISE.md), estrutura aprovada pela titular, redação, padronização, validação
  adversarial, humanização e compilação com portões (md2docx). Use sempre que o usuário pedir
  para criar, elaborar, redigir ou revisar uma peça processual completa — inicial, contestação,
  réplica, recurso, manifestação, agravo, embargos ou qualquer documento jurídico formal.
  Triggers: "faça a petição", "elabore a inicial", "construa o recurso", "redija a contestação",
  "monte a peça".
---

# Legal Orchestrator — Pipeline Adaptativo de Peças Jurídicas

Você controla o processo. Você não escreve o texto — você decide o que executar, quando validar e quando corrigir.

---

## Entrada Obrigatória

Antes de iniciar qualquer estágio, confirme que você possui:

| Informação | Por quê é necessária |
|---|---|
| Tipo de peça | Define estrutura, seções obrigatórias e tom |
| Fatos do caso | Sem fatos, não há argumento — apenas formulário |
| Tese principal | Define o que o pipeline inteiro deve defender. Se a titular já a tem, entra aqui; se não, **é saída do Estágio 0** (teses candidatas na `ANALISE.md`), não pergunta ao usuário |
| Réus e suas responsabilidades | Cada réu pode exigir fundamentação diferente |
| Pedidos finais | O texto inteiro serve aos pedidos — comece sabendo quais são |
| Documentos disponíveis | Define o que pode ser citado como prova |
| Valor da causa pretendido | Inconsistência de valores é o erro mais atacável |
| Bundle da matéria | Nome da pasta em `<bundles>/direito/<tema>` que sustenta a tese; vai para o frontmatter da peça como `bundle:` |

Se mais de dois desses itens estiverem ausentes, pare e solicite ao usuário antes de prosseguir.

## Rastro obrigatório (o que o pipeline deixa gravado)

Cada estágio deixa um rastro que o portão seguinte confere. Sem o rastro, o passo não aconteceu, por mais que o texto diga que sim.

| Rastro | Quem grava | Quem confere |
|---|---|---|
| Leitura de `perfil/definicoes.md` e `perfil/usuario.md` | a sessão, antes da primeira gravação da peça | hook `require-leitura` |
| `bundle: direito/<tema>` no frontmatter e leitura de ao menos um arquivo desse bundle | Estágio 0 | hook `require-leitura` |
| `clientes/<caso>/ANALISE.md` (cronologia, teses candidatas, mapa probatório, ataques) | Estágio 0, item 4; atualizada a cada peça nova do mesmo caso | Estágio 0.5 (a estrutura aponta para ela) e Estágio 3 |
| `<PECA>.estrutura.md` ao lado da peça, com `aprovada: sim` e data | Estágio 0.5 (o agente grava; a titular aprova) | Estágio 3 (aderência), Estágio 6 e o `md2docx`, que recusa compilar sem o arquivo com `aprovada: sim` (peça de template declara `estrutura: template` no frontmatter e passa) |
| `<PECA>.validacao.md` ao lado da peça, com `veredito:` no frontmatter | Estágio 3 (o validator grava) | `md2docx`, que recusa compilar sem veredito, com veredito REPROVADO ou com veredito mais antigo que a última edição do `.md` |
| `humanizer_analisado`, `humanizer_alterou`, `invariantes`, `ritmo_sinais` no frontmatter do `<PECA>.validacao.md` | Estágio 5 (o orchestrator grava, depois da validação ou revalidação); `invariantes` vem do `checar-invariantes.js` | Estágio 6 (checklist) e a titular. Sem hook por enquanto |
| `pipeline: legal-orchestrator` no frontmatter | Estágio 7, depois de cumprido o ciclo | `md2docx` |

Peça sem matéria de acervo (manifestação puramente processual, por exemplo) declara `bundle: nenhum`. A decisão fica no documento, não numa exceção do portão.

## Estágio 0 — Inventário das fontes do caso (SEMPRE EXECUTE, ANTES DE TUDO)

Não redija com o que está à mão. Levante o que existe, **em dois lugares**, e só então decida se pode escrever.

1. **Pasta local do caso** (`clientes/<caso>/`): listar tudo. PDF sem `.md` irmão vai para o `pdfmd` antes de qualquer leitura.
2. **Drive do escritório**: buscar pelo nome do cliente **e** pelo número do processo. A pasta local costuma ter só a última peça recebida; contrato, extrato, termo de cessão e procuração costumam estar apenas no Drive.

**Peças de resposta exigem a peça que respondem.** Para réplica/impugnação, são obrigatórios: a **inicial**, a **contestação** e os **documentos que sustentam os números** (contrato assinado e extrato de pagamento). Redigir uma réplica sem a inicial produz peça que contradiz o próprio pedido; redigir sem o contrato produz afirmação de fato errada.

**Portão:** se faltar a peça anterior ou o documento que sustenta os valores, **pare e peça** — não redija com placeholder, e não infira o número a partir do que a parte contrária afirma. Quando o tema tiver skill de apuração numérica, rodá-la aqui, antes do Estágio 1, e usar a ficha como fonte dos valores da peça: `ficha-rescisao-lote` para rescisão de lote; `ficha-golpe-bancario` para golpe bancário, consignado fraudulento e negativação (dano material por transação com fonte, dupla contagem, dobro condicionado à data, encargos por verba, dano moral bifásico, valor da causa e teto do Juizado; `--conferir PECA.md` acusa todo `R$` da peça que não sai da ficha).

**Intake da inicial.** Contestação e réplica geram roteiro de entrevista a partir da peça adversária; a inicial gera o seu a partir do art. 320 e do mapa probatório, pela heurística `direito/pecas/peticao-inicial/heuristicas/matriz-documentos-da-inicial.md` do acervo (Parte A: o que toda inicial junta; Parte B: uma pergunta ao cliente por fato *frágil* ou *a produzir*, com o documento esperado; Parte C: gratuidade pela faixa da ADC 80), mais a matriz do tema quando existir (consignado, golpe). O resultado é a seção 7 (**Documentos**) da `ANALISE.md`, com estado `presente | pendente | dispensado`; os `presente` viram o rol `documentos:` do frontmatter da peça. A qualificação das partes (art. 319, II) vem do bloco ```` ```json caso ```` da seção 0 da `ANALISE.md` (schema em `skills/legal-orchestrator/references/caso.schema.json`) e o preâmbulo sai de `node skills/legal-orchestrator/scripts/qualificacao.js clientes/<caso>/ANALISE.md`, que também lista o que falta (`--checar`). Não se cria `DOCUMENTOS.md` nem `caso.json` (um arquivo de estado por caso). Despacho de emenda costuma pedir documento de gratuidade ou comprovante de endereço em nome próprio: é coleta, e se resolve aqui.

3. **Acervo (arsenal-juridico).** Abrir `<bundles>/index.md` (o roteador), escolher o bundle da matéria e ler, dentro dele, `index.md`, `jurisprudencia/`, `teses/`, `heuristicas/` e `casos_decididos/`; depois `direito/pecas/<tipo>/` para a técnica da peça. Em petição inicial, também `direito/pecas/peticao-inicial/perfis/` quando houver perfil da vara ou comarca de destino (gratuidade, tutela no despacho inicial, causas de emenda já recebidas daquele juízo). O caminho de `<bundles>` está em `perfil/ambiente.json`. O nome do bundle escolhido vai para o frontmatter da peça (`bundle: direito/<tema>`) antes da primeira gravação: o hook `require-leitura` bloqueia a gravação se o campo falta ou se nenhum arquivo daquele bundle foi lido na sessão.

**Portão:** toda tese empregada tem página no bundle. Se o acervo não cobre o ponto, a peça diz que não cobre; não se cita precedente de memória (AGENTS.md, regra dura 3). Página `status: em_teste` não foi conferida contra a fonte oficial: citá-la exige `cita_em_teste: sim` no frontmatter ou a promoção da página a `vigente` depois da conferência.

4. **Análise do caso** → `clientes/<caso>/ANALISE.md`. Uma por caso, não por peça: a análise feita para a inicial serve à réplica e à apelação; a cada peça nova, atualiza-se em vez de refazer. **É o único arquivo de estado do caso** (modelo em `references/ANALISE.template.md`): dados das partes (seção 0, bloco ```` ```json caso ````), prazos (`prazos:` no frontmatter, uma linha `AAAA-MM-DD | ato | nota` por prazo), documentos (seção 7), radar de jurisprudência (seção 8) e decisões da titular (seção 9) moram nela. Não se cria `ANALISE_<data>.md`, `cronologia.md`, `DOCUMENTOS.md`, `caso.json` nem `radar-jurisprudencia_<data>.md`: quem abre a pasta sem ser agente vê PDF, DOCX e esta análise. `node scripts/caso.js <caso>` mostra o painel lido daqui. Não tem portão de aprovação; a estrutura da peça (Estágio 0.5) aponta para ela. Seções de análise:

   1. **Cronologia.** Todo fato datado, em ordem, com a fonte (`Doc. N`, p. X). Partes e papel de cada uma. O problema jurídico em uma frase. O que ainda precisa ser esclarecido. **Prescrição e decadência:** para cada pretensão, o termo inicial, o prazo, a norma e a data-limite; se houver causa de interrupção ou suspensão, a data e a prova. Pretensão prescrita não vira pedido.
   2. **Teses candidatas.** Só as que têm página em `teses/` ou `heuristicas/` do bundle. Para cada uma: requisitos, fatos da cronologia que os preenchem, fragilidade e risco. Antes de listar, quatro decisões que mudam a fundamentação inteira, cada uma com o fato que a sustenta: **regime** (CDC ou Código Civil), **regime temporal** (a lei que vigia na data do contrato ou do fato: Lei 13.786/2018 só para contrato de 28/12/2018 em diante; Lei 14.181/2021 para o superendividamento; a data vem da cronologia com `Doc. N`, e sem ela a decisão vai para "falta saber", não se presume), **responsabilidade** (contratual ou extracontratual; objetiva ou subjetiva) e **ônus da prova** (regra do art. 373 ou inversão, pelo §1º ou pelo art. 6º, VIII, do CDC). Se cabe tutela provisória, dizer qual (urgência, art. 300, ou evidência, art. 311) e qual fato concreto a justifica. **Audiência de conciliação (art. 334), em inicial e em contestação:** registrar a decisão de interesse ou desinteresse e o fato que a motiva (histórico de tratativas, réu que nunca responde, matéria que não admite autocomposição). Na inicial, o desinteresse vai na própria peça (art. 319, VII, e art. 334, § 5º). Na contestação, se a audiência já está designada, o desinteresse do réu é **petição avulsa até dez dias antes da audiência** (art. 334, § 5º): é um terceiro prazo, anotado ao lado do da contestação e do agravo, e a decisão é da titular. Se a pasta e o Drive não dizem se a audiência foi designada, isso vai para "falta saber" da estrutura, e o agente pergunta antes de contar o prazo. **Autocomposição** (art. 319, VII, c/c 334, § 5º): interesse ou desinteresse, decidido pelo réu e pelo histórico (banco e plataforma raramente transacionam na audiência; loteadora e particular às vezes sim); nenhum template ou peça-ouro fixa o padrão. Terminar com a escolha (principal e subsidiárias) e o motivo; a tese que a titular já trouxe entra como candidata e é confrontada com as outras, não aceita de ofício.
   3. **Mapa probatório.** Para cada fato relevante, um de três estados: **comprovado** (documento nos autos, `Doc. N`), **frágil** (só declaração da parte, print sem metadado, documento de terceiro sem assinatura) ou **a produzir** (testemunha, perícia, ofício, exibição). Fato de tese sem prova comprovada ou a produzir é fato que a tese não pode afirmar.
   4. **Ataques previstos.** Os três melhores argumentos do advogado da parte contrária contra a tese escolhida, cada um com a prova que ele atacaria e a resposta disponível (ou a constatação de que não há resposta, o que muda a escolha da tese).

   5. **Impugnação especificada** (só quando a peça é contestação). Antes dela, o frontmatter da `ANALISE.md` declara **`lado: consumidor`** (padrão do escritório) **ou `lado: fornecedor`** (exceção, declarada pela titular no início): o lado decide quem pede e quem enfrenta a inversão do ônus e avisa que, para fornecedor, o acervo tende a não cobrir as defesas. A seção 3 mapeia os fatos da nossa tese; esta mapeia os fatos da **inicial do autor**, um a um, porque fato não impugnado precisamente presume-se verdadeiro (art. 341, CPC). Preencher a tabela da heurística `direito/pecas/contestacao/heuristicas/tabela-impugnacao-especificada.md` do acervo, Partes 0 a 3: primeiro o **roteiro de entrevista do réu gerado da inicial** (cada fato vira pergunta ao cliente com o documento esperado); depois, para cada fato alegado, por episódio e não por frase, a prova do autor e o estado dela, a **versão do réu**, a prova do réu (`Doc. N`) e a postura (nega, admite, admite com ressalva, fato novo); a **exposição por pedido** com resposta principal e subsidiária (compensação e dedução do já pago se pedem, não se presumem); a postura por documento do autor (art. 436); depois os treze incisos do art. 337 com "cabe" ou "não cabe e por quê" (incompetência relativa e convenção de arbitragem precluem se caladas), prescrição e decadência como prejudiciais, e as posturas acessórias (reconvenção, denunciação, chamamento, falsidade, exibição, gratuidade do réu) como decisão da titular. Fato novo sem `Doc.` do réu não se alega: o ônus dele é do réu (art. 373, II). Fluxo do procedimento comum: no Juizado Especial (Lei 9.099, arts. 30 e 31) parar e sinalizar. Se há tutela deferida contra o réu, o prazo do agravo (art. 1.003, § 5º) corre em paralelo e costuma vencer antes: anotar os dois e levar a decisão à titular.

   6. **Mapa da contestação** (só quando a peça é réplica). A seção 3 mapeia a prova da nossa tese; esta mapeia a **contestação e todos os anexos dela**, lidos inteiros, porque a defesa é ao mesmo tempo o que se responde e prova do autor. Preencher a tabela da heurística `direito/pecas/replica/heuristicas/tabela-alegacoes-resposta.md` do acervo, Partes 0 a 4: primeiro o **roteiro de entrevista do autor gerado da contestação** (cada fato novo ou documento do réu vira pergunta ao cliente com o documento esperado); depois cada alegação da contestação em um de **cinco eixos** (preliminar do art. 337, inclusive impugnação à gratuidade; fato impeditivo, modificativo ou extintivo do art. 350; documento novo do art. 437, com postura do art. 436; **tese jurídica da defesa**, conferida primeiro no **repertório de defesas típicas** do bundle temático (`direito/pecas/replica/heuristicas/repertorio-de-defesas-tipicas.md` aponta os três existentes) e respondida pela página do acervo ou declarada como lacuna; negativa pura, que não aciona resposta), cada uma com a **prova do réu e o estado dela** (comprovado, frágil, sem prova, invocado e não juntado), porque o estado decide a resposta antes do mérito (art. 373, II); o **espelho do art. 341**, fato da inicial por fato, com o que a contestação fez com ele (impugnado, negativa geral, admitido, silenciado), porque silenciado e negativa geral são incontroversos e cabe ao autor cobrar a fixação no saneamento (art. 357, II), e o **espelho dos pedidos**, pedido da inicial por pedido (combatido, combatido só por consequência, não combatido), porque pedido não combatido é incontroverso e vai para requerimento de julgamento antecipado parcial (art. 356, I e § 2º); as **confissões, documentos do réu contra ele, contradições internas e documentos invocados sem juntar** (arts. 389 a 395, 408 e 396 a 400), com a cisão do art. 395 anotada quando o réu admitiu e acrescentou fato novo e com o pedido de exibição (art. 399, II; presunção do art. 400) para o que o réu invocou e não trouxe; e as **posturas acessórias com relógio próprio** (reconvenção, art. 343, § 1º, quinze dias para contestação à reconvenção, sem a qual a revelia é do autor; agravo do réu contra a tutela; arguição de falsidade, art. 430; pedido de julgamento antecipado; denunciação), cada uma anotada em `prazos:` do frontmatter da `ANALISE.md`, ao lado do prazo da réplica, com a decisão da titular sobre peça conjunta ou separada. **Portão de cabimento:** só negativa pura e nada colhido nas Partes 2 a 4 é réplica dispensável, levada à titular como parecer curto; não se redige memorial antecipado. A regra de ouro do art. 329, II, veda fato constitutivo e pedido novos; argumento de direito novo contra a tese da defesa é permitido (art. 322, § 2º).

   Frontmatter: `caso:`, `bundle:`, `atualizada:` (data), `processos:` (lista de números CNJ), `prazos:` (lista `AAAA-MM-DD | ato | nota`) e, em contestação, `lado:`. **Não** usar `tipo:`, `pipeline:` nem `titulo:` + `processo:`, que fazem os hooks tratarem o arquivo como peça.

**Portão:** tese sem página no bundle não é candidata; fato "a produzir" não é afirmado como provado em nenhuma peça do caso. Em contestação, **nenhum fato da inicial sem linha na seção 5** e nenhum inciso do art. 337 sem decisão registrada. Em réplica, **nenhuma alegação da contestação sem eixo na seção 6**, nenhum fato da inicial sem resultado no espelho do art. 341 e nenhum anexo da contestação sem leitura integral.

---

## Estágio 0.5 — Arquitetura da peça (SEMPRE EXECUTE, ANTES DE QUALQUER PROSA)

Mexer em estrutura depois do texto é o retrabalho mais caro do pipeline: invalida o `.validacao.md`, refaz humanização e recompila. Por isso a arquitetura se decide aqui, em quarenta linhas que a titular lê em dois minutos, e não em quinze páginas.

Com o inventário feito, o bundle lido e a `ANALISE.md` do caso escrita ou atualizada, apresente **só a estrutura**, sem redigir conteúdo, e grave em `<PECA>.estrutura.md` ao lado da peça:

1. **Seções, na ordem em que aparecerão**, separando preliminares, mérito, tutela e pedidos. A posição da tutela é escolha declarada: antes do direito, logo após os fatos, quando o perigo é o destaque da peça; depois do direito quando a probabilidade depende da tese.
2. **Em cada seção:** o fato que ela afirma, o estado dele no mapa probatório (**comprovado** com `Doc. N` · **frágil** · **a produzir**), a página do bundle que sustenta a tese e o `status` dessa página. Página `em_teste` aparece aqui, quando ainda é barato trocar a tese, e não como exit 3 do `md2docx`. Fato *frágil* é narrado com a cautela correspondente; fato *a produzir* vai para o protesto por provas (art. 319, VI, CPC), com o meio de prova nomeado.
3. **Argumento em destaque** (o que abre a peça) e por quê. É a tese escolhida na `ANALISE.md`, seção 2.
4. **Peso relativo** de cada parte, em porcentagem aproximada. Não se estima em páginas.
5. **O que fica de fora**, com um de dois motivos: *não agrega* (dilui o destaque) ou *o acervo não cobre* (regra dura 3, aplicada antes de escrever).
6. **Ataques respondidos:** para cada ataque previsto na `ANALISE.md`, seção 4, a seção da peça que o neutraliza, ou a decisão de não enfrentá-lo e por quê.
7. **O que falta saber:** pergunta que a pasta e o Drive não respondem, ligada à seção que depende dela.
8. **Em contestação, o espelho da tabela:** cada linha "nega", "admite com ressalva" e "fato novo" da `ANALISE.md`, seção 5, aponta a seção que a absorve; cada "cabe" do checklist do art. 337 vira subseção de preliminar, na ordem do Código; prescrição e decadência têm seção própria de prejudicial quando cabem; cada pedido da inicial tem a seção que o responde; reconvenção e demais posturas acessórias aparecem com a decisão da titular. Linha sem seção é fato que vai passar por incontroverso. A estrutura de referência é a do playbook `direito/pecas/contestacao/playbooks/playbook-contestacao.md`, com capítulos presentes só quando a tabela os aciona. Essas perguntas vão à titular junto com a apresentação da estrutura, **no máximo quatro** (no Claude Code, pela ferramenta de pergunta ao usuário; em outro agente, na própria mensagem); se são mais de quatro, o inventário do Estágio 0 está incompleto, e é lá que se volta.
9. **Em réplica, o espelho da contestação:** cada linha dos eixos 1 a 4 da `ANALISE.md`, seção 6, aponta o capítulo que a absorve (preliminar e impugnação à gratuidade em subseção própria; fato novo, tese e documento em subseção própria); cada fato silenciado ou de negativa geral do espelho do art. 341 aponta o capítulo de incontrovérsia; cada confissão, documento do réu contra ele e contradição aponta o capítulo que a usa; cada postura acessória aponta um capítulo ou uma peça própria com prazo anotado. Linha sem capítulo é preliminar que vai passar por concordada, ou confissão que vai se perder. A ordem entre incontrovérsia, fato novo e tese é escolha declarada (a incontrovérsia antes quando esvazia o fato novo; o fato novo antes quando a confissão está dentro dele). A estrutura de referência é a do playbook `direito/pecas/replica/playbooks/playbook-replica.md`, sete capítulos, com II a VI presentes só quando a tabela os aciona. Mesmo limite de quatro perguntas à titular.

Formato do arquivo:

```markdown
---
peca: contestacao.md
aprovada: não
bundle: direito/<tema>
analise: ANALISE.md
---

## Destaque
<argumento que abre a peça e por quê>

## Seções e peso
1. <Seção> (N %) — fato: <comprovado Doc. N | frágil | a produzir: testemunha>; <bundle>/<pasta>/<pagina>.md (vigente | em_teste)
...

## Provas a produzir
- <fato>: <meio de prova>, pedido na seção <X>

## Fora
- <tese ou seção>: não agrega | acervo não cobre

## Ataques respondidos
- <ataque 1 da ANALISE.md>: seção <X> | não enfrentado porque <motivo>

## Espelho da impugnação (só contestação)
- fato <#> da inicial (<postura>): seção <X>
- art. 337, <inciso> (cabe): seção <X> | não cabe porque <motivo>
- pedido <letra> da inicial: seção <X>
- reconvenção | denunciação | gratuidade do réu: sim, seção <X> | não, porque <motivo>

## Espelho da contestação (só réplica)
- alegação <#> da contestação (<eixo>): seção <X> | sem resposta porque negativa pura
- fato <#> da inicial (<silenciado | negativa geral>): capítulo de incontrovérsia, seção <X>
- pedido <letra> da inicial (não combatido): requerimento de julgamento parcial, art. 356, I, seção <X>
- confissão | documento do réu | contradição <#> (fl. <N> da contestação): seção <X>
- documento invocado e não juntado <#> ("<como a contestação o chama>"): pedido de exibição, arts. 396 a 400, seção <X>
- reconvenção | agravo do réu | falsidade | gratuidade impugnada: seção <X> | peça própria, prazo <data>

## Falta saber
- <Seção X> depende de <pergunta>. <Onde procurar, se houver pista>
```

**Portão humano.** Em peça argumentativa livre (contestação, réplica, apelação, agravo, REsp, embargos, manifestação de mérito), **pare e aguarde a aprovação da titular**. Ajuste pedido por ela é feito no arquivo, não na conversa; a versão com `aprovada: sim` e a data no frontmatter é a que o Estágio 1 recebe, e é vinculante: o legal-writer não cria seção, não reordena e não muda o destaque. Se durante a redação a estrutura se mostrar errada, voltar aqui e reapresentar; não improvisar.

Em peça contra decisão (apelação, EDcl, contrarrazões, agravo), antes deste estágio roda-se `node scripts/conferir-decisao.js <caso> <decisao.md>`: toda data, valor, percentual, cláusula, documento e nome que a decisão afirma e nenhum `.md` do caso contém sai listado, e cada item é conferido no PDF antes de virar vício ou capítulo (método: `direito/pecas/apelacao/heuristicas/sentenca-contra-os-autos.md` do arsenal).

Em peça com template ou estrutura canônica (`inicial-rescisao-lote`, apelação pelo `direito/pecas/apelacao/workflows/apelacao.md` do arsenal, cumprimento de sentença), a estrutura é o modelo: gravar o arquivo apontando o template, listar só os desvios e seguir sem parar. Desvio grande do modelo (seção nova, tese fora do template) volta a exigir aprovação.

Aprovação sem leitura é rastro falso, pior que nenhum. O arquivo existe para ser lido.

---

## Estágio 1 — Redação Jurídica (SEMPRE EXECUTE)

Execute o legal-writer com o contexto completo do caso **e com o `<PECA>.estrutura.md` aprovado no Estágio 0.5**, que é entrada vinculante: seções, ordem, destaque e o Doc. previsto para cada fato.

**Instrua o legal-writer a:**
- Seguir exatamente a estrutura aprovada, ancorando cada afirmação de fato no documento que a estrutura previu para aquela seção
- Verificar metalinguagem antes de finalizar (nenhuma referência ao processo de escrita deve aparecer no texto)
- Confirmar consistência numérica interna (valores da causa, danos, datas)
- Usar citação indireta sempre que a ementa real não estiver disponível

**Auto-verificação obrigatória antes de encerrar o Estágio 1:**

Antes de finalizar o texto, responda:
1. Há parágrafos consecutivos que abrem com sujeito novo sem nenhum conectivo de retomada ou contraste? Se sim, corrija a abertura de ao menos metade deles.
2. Há enumerações `(a)/(b)/(c)` com travessões internos em seções argumentativas (fora da seção de pedidos)? Se sim, converta em parágrafos encadeados.
3. O padrão de fecho `"Isso é [X]"` ou `"Isso, Excelência, é [X]"` aparece mais de uma vez na mesma seção? Se sim, substitua as ocorrências excedentes por variações (consequência direta, citação de prova, afirmação factual seca).

**Critério de conclusão do Estágio 1:**
O texto está completo, cobre todos os pedidos, não contém placeholders ou notas entre colchetes, e passou pelos três itens da auto-verificação acima.

---

## Estágio 2 — Padronização Tipográfica (SEMPRE EXECUTE)

Aplique a tipografia-pma ao texto produzido pelo Estágio 1.

**Preserve:**
- 100% do conteúdo argumentativo
- O ritmo de variação entre parágrafos longos e curtos
- A hierarquia dos argumentos (principal e subsidiários)

**Ajuste:**
- Titulação em algarismos romanos (I., I.1., etc.), escrita no dialeto PMA (`#` e `##`; ver `skills/peca-pma-builder/SKILL.md`)
- Endereçamento, capítulo I, gratuidade, valor da causa e assinatura conforme `perfil/definicoes.md` (a skill aponta, não repete)
- Citações em bloco (`>`), com a identificação completa do julgado colada à transcrição
- Tipografia: não se configura aqui; o `md2docx` aplica `perfil/marca.json`

**Critério de conclusão do Estágio 2:**
A estrutura visual está aplicada e nenhum argumento foi fragmentado ou removido.

---

## Estágio 3 — Validação Adversarial (SEMPRE EXECUTE)

Execute o legal-consistency-validator no texto resultante do Estágio 2.

O validator grava o veredito em `<PECA>.validacao.md`, ao lado da peça (formato na seção "Registro do veredito" do validator). Esse arquivo é o rastro que o `md2docx` confere: sem ele, ou com ele mais antigo que a última edição do `.md`, a peça não compila. Toda edição da peça depois deste estágio exige nova validação, e portanto novo arquivo.

**Leia o VEREDITO retornado pelo validator. Tome a decisão:**

| Veredito | Ação |
|---|---|
| APROVADO | Avance para o Estágio 5 |
| APROVADO COM RESSALVAS | Execute o Estágio 4 para corrigir as fraquezas MÉDIO ou BAIXO apontadas |
| REPROVADO | Execute o Estágio 4 imediatamente |

O mapeamento severidade → veredito é fixo e está definido no legal-consistency-validator: REPROVADO significa que há ao menos uma fraqueza CRÍTICA ou ALTA; APROVADO COM RESSALVAS significa que há apenas fraquezas MÉDIO e/ou BAIXO.

---

## Estágio 4 — Loop de Correção (CONDICIONAL)

Execute se o Estágio 3 retornar REPROVADO (há fraqueza CRÍTICA ou ALTA) ou APROVADO COM RESSALVAS (apenas fraquezas MÉDIO ou BAIXO a corrigir).

**Regras do loop:**
1. Corrija apenas os pontos sinalizados pelo validator. Não refaça o texto inteiro.
2. Preserve todos os argumentos que o validator não sinalizou.
3. Após cada correção, reexecute o Estágio 3.
4. **Limite máximo: 3 iterações.** Se após 3 ciclos ainda houver fraquezas CRÍTICAS, sinalize ao usuário e descreva o problema irresolvível — não continue em loop indefinido.

**O que sempre corrigir imediatamente (CRÍTICO automático):**
- Metalinguagem vazada no texto (referências ao processo de redação)
- Ementas com travessões em cadeia sem referência verificável
- Inconsistência numérica: valor da causa fora da regra do art. 292 aplicável (`perfil/definicoes.md` §1), ou o mesmo valor escrito de dois jeitos na peça
- Proposta de acordo inserida no corpo da petição inicial (deve ser reservada para audiência)

---

## Estágio 5 — Humanização (SEMPRE ANALISA; ALTERA SÓ COM SINAL)

**A análise é obrigatória em toda peça; a alteração, condicional; a conferência de invariantes e a revalidação, obrigatórias sempre que houve alteração.**

**1. Medir (sempre):**

```powershell
node skills\humanizer-forense\scripts\lint-ia.js clientes\<caso>\PECA.md
node skills\humanizer-forense\scripts\ritmo.js   clientes\<caso>\PECA.md
```

O `lint-ia` é portão (reprova acima dos limites). O `ritmo.js` é diagnóstico e nunca reprova: mede o que o lint não conta (frases de comprimento uniforme, quatro ou mais parágrafos do mesmo tamanho, parágrafos abrindo igual, conectivo em cada parágrafo, norma, aplicação e conclusão em série, fecho "Isso é [X]" repetido, enumeração (a)/(b) fora dos pedidos, dois-pontos em série, capítulo raso). Além dos medidores, ler a peça contra `perfil/voz-forense.md`.

**2. Decidir.** Há sinal se o `lint-ia` reprovou, se o `ritmo.js` apontou sinal, ou se a leitura acusa prosa de modelo.
- **Sem sinal:** não alterar. Gravar o registro (item 4) com `humanizer_alterou: nao` e seguir ao Estágio 6.
- **Com sinal:** acionar a skill **`humanizer-forense`** (a do escritório: protege transcrições, títulos-tese e BLUF, traz o `lint-ia.js`, o `ritmo.js` e o guardião de invariantes).

**3. Alterar entre snapshot e guardião.** Antes de tocar na prosa, `checar-invariantes.js --snapshot PECA.md`; depois da passada, `checar-invariantes.js PECA.md`. Violação (exit 1: número, data, dispositivo, julgado, transcrição, título-tese, BLUF, modalidade, negação ou pedido alterado) desfaz a alteração correspondente; não se justifica nem se contorna. Depois, `--limpar`. **Calibração de voz proporcional:** peça curta, `perfil/voz-forense.md` basta; peça longa (mais de 6 capítulos), recurso ou peça estratégica, o perfil e uma peça humana próxima, da qual se imita o ritmo e nunca se copia fato ou trecho.

**Revalidação obrigatória:** se o humanizer alterou o texto, reexecute o Estágio 3 sobre a versão humanizada antes de avançar ao Estágio 6 — humanização depois da validação sem nova checagem é porta de entrada de erro. Se a revalidação retornar REPROVADO, trate no Estágio 4 (o limite de 3 iterações continua valendo).

**4. Registrar no `<PECA>.validacao.md`** (frontmatter, depois da validação ou revalidação; sem artefato novo):

```yaml
humanizer_analisado: sim
humanizer_alterou: nao            # ou sim
invariantes: n/a                  # preservados | preservados com avisos | violados (não avança) | n/a se não alterou
ritmo_sinais: 0                   # número de sinais do ritmo.js na versão final
```

A humanização é sempre a da `humanizer-forense`; o humanizer genérico (coloquial, primeira pessoa) não se aplica a peça.

---

## Estágio 6 — Verificação Final de Integridade

**Documentos citados.** Toda peça que cita `Doc. N` declara o rol no frontmatter (`documentos:` com `n`, `descricao` e, quando houver, `arquivo`) e passa por `node skills/legal-consistency-validator/scripts/checar-docs.js <PECA>.md`: citado sem rol, rol sem citação ou arquivo ausente na pasta é erro a corrigir antes de compilar. `--rol` imprime o rol para o fim da peça. Em contestação isso não é capricho: a documental vai com a peça (art. 434) e o que faltou só entra depois nas hipóteses do art. 435.

**Reconvenção, quando houver:** é inicial embutida; conferir causa de pedir própria, pedido certo, valor da causa pelo art. 292 (`perfil/definicoes.md`, § 1) e custas ou gratuidade (art. 319). Em réplica, o inverso: reconvenção do réu exige **contestação à reconvenção** em quinze dias (art. 343, § 1º), com os requisitos de contestação (tabela de impugnação especificada para os fatos da reconvenção), em capítulo próprio ou peça separada por decisão da titular; a réplica não a responde de passagem.

Antes de entregar o output, confirme:

- [ ] A peça segue o `<PECA>.estrutura.md` aprovado (seções, ordem, destaque); todo desvio foi reaprovado, não improvisado
- [ ] Nenhuma contradição detectada entre seções
- [ ] Valor da causa conforme o inciso do art. 292 aplicável ao objeto da ação (`perfil/definicoes.md` §1); os valores repetidos na peça são idênticos entre si
- [ ] Nenhum placeholder, nota entre colchetes ou referência ao processo de escrita
- [ ] Todos os réus têm fundamentação específica, não apenas menção genérica
- [ ] A tutela de urgência, se pedida, descreve o perigo concreto (não apenas cita o art. 300)
- [ ] Nenhum fato marcado *a produzir* na `ANALISE.md` é afirmado como provado; todos aparecem no protesto por provas com o meio nomeado
- [ ] O `.validacao.md` traz `humanizer_analisado: sim`; se `humanizer_alterou: sim`, `invariantes` não é `violados` e a revalidação é posterior à alteração
- [ ] Toda jurisprudência está **transcrita** em bloco, com fonte declarada e página correspondente no bundle (o `lint-citacoes` confere literalidade e voz do julgado). Citação indireta só para ponto que o acervo não cobre, e dita como tal
- [ ] `<PECA>.validacao.md` é mais novo que a última edição da peça e não diz REPROVADO
- [ ] **Checklist de saída do tipo de peça**, em `<bundles>/direito/pecas/<tipo>/index.md` (petição inicial: requisitos do art. 319 I–VII, documentos do art. 320, encargos, requerimentos finais; réplica: preliminares respondidas, incontroversos listados com folha, confissões transcritas, posturas do art. 436, especificação de provas fato a fato, prazos paralelos na cronologia). A técnica da peça mora no acervo; o orchestrator só aponta

---

## Estágio 7 — Compilação com portões (SEMPRE EXECUTE)

O ciclo não termina em "pronto para gerar o .docx". Termina no `.docx` gerado e validado.

1. Declarar `pipeline: legal-orchestrator` no frontmatter. Só agora: o campo afirma que os estágios 0 a 6 foram cumpridos.
2. Compilar:

```powershell
node skills\peca-pma-builder\scripts\md2docx.js clientes\<caso>\PECA.md
```

O `md2docx` confere o veredito do Estágio 3, roda `lint-remissoes`, `lint-ia` e `lint-citacoes`, gera o `.docx` e valida timbrado e conteúdo. Exit 1 é erro a corrigir na peça; exit 3 é citação de página `em_teste`, decisão da titular (ver AGENTS.md §4). Depois de qualquer correção no `.md`, voltar ao Estágio 3.

3. Não encerrar o turno com o `.docx` desatualizado: o hook `Stop` bloqueia, salvo `rascunho: sim` declarado no frontmatter.

---

## Regras de Eficiência

- Aplique correções localizadas. Não refaça o texto inteiro por um problema pontual.
- Se um estágio já foi executado corretamente, não o reexecute sem necessidade.
- O Estágio 4 deve corrigir exatamente e apenas o que o Estágio 3 identificou.

---

## Hard Constraints (Nunca viole)

1. Não introduza fatos novos em nenhum estágio após o Estágio 1.
2. Não enfraqueça argumentos durante refinamento — se a correção exige remover um argumento forte, sinalize ao usuário.
3. Não entregue texto com metalinguagem vazada sob nenhuma circunstância.
4. Não avance do Estágio 3 com fraqueza CRÍTICA sem resolver ou sinalizar ao usuário.

---

## Output Final

Entregue o texto completo, validado e formatado.

O resultado deve ser:
- Argumentativamente sólido (resistiu ao teste adversarial)
- Tipograficamente padronizado (pronto para gerar .docx)
- Livre de metalinguagem
- Consistente numericamente
- Pronto para protocolo judicial
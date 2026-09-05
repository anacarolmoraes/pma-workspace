---
name: legal-orchestrator
version: 4.6.0
description: |
  Orquestra o pipeline completo de geração de peças jurídicas: inventário das fontes e leitura do
  acervo, análise do caso por caso (ANALISE.md: cronologia, teses candidatas do bundle, mapa
  probatório, ataques previstos), arquitetura da peça aprovada pela titular antes de qualquer prosa (<PECA>.estrutura.md),
  redação argumentativa (legal-writer), padronização tipográfica (tipografia-pma), validação
  adversarial (legal-consistency-validator, que grava o veredito ao lado da peça), humanização
  seletiva (humanizer-forense) e compilação com portões (md2docx). Use sempre que o usuário pedir para criar, 
  elaborar, redigir ou revisar uma peça processual completa — inicial, contestação, recurso, 
  manifestação, agravo, embargos ou qualquer documento jurídico formal. Triggers: "faça a petição", 
  "elabore a inicial", "construa o recurso", "redija a contestação", "monte a peça".
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
| `<PECA>.estrutura.md` ao lado da peça, com `aprovada: sim` e data | Estágio 0.5 (o agente grava; a titular aprova) | Estágio 3 (aderência) e Estágio 6. Sem hook por enquanto: entra no `md2docx` se, em uso, o estágio se mostrar pulado |
| `<PECA>.validacao.md` ao lado da peça, com `veredito:` no frontmatter | Estágio 3 (o validator grava) | `md2docx`, que recusa compilar sem veredito, com veredito REPROVADO ou com veredito mais antigo que a última edição do `.md` |
| `pipeline: legal-orchestrator` no frontmatter | Estágio 7, depois de cumprido o ciclo | `md2docx` |

Peça sem matéria de acervo (manifestação puramente processual, por exemplo) declara `bundle: nenhum`. A decisão fica no documento, não numa exceção do portão.

## Estágio 0 — Inventário das fontes do caso (SEMPRE EXECUTE, ANTES DE TUDO)

Não redija com o que está à mão. Levante o que existe, **em dois lugares**, e só então decida se pode escrever.

1. **Pasta local do caso** (`clientes/<caso>/`): listar tudo. PDF sem `.md` irmão vai para o `pdfmd` antes de qualquer leitura.
2. **Drive do escritório**: buscar pelo nome do cliente **e** pelo número do processo. A pasta local costuma ter só a última peça recebida; contrato, extrato, termo de cessão e procuração costumam estar apenas no Drive.

**Peças de resposta exigem a peça que respondem.** Para réplica/impugnação, são obrigatórios: a **inicial**, a **contestação** e os **documentos que sustentam os números** (contrato assinado e extrato de pagamento). Redigir uma réplica sem a inicial produz peça que contradiz o próprio pedido; redigir sem o contrato produz afirmação de fato errada.

Lição de 2026-08-04, caso real: a pasta local tinha apenas a contestação em PDF. A réplica foi redigida sem a inicial e sem o contrato, e afirmou que o cliente não pagara sinal — o contrato registrava R$ 1.339,96 no campo "sinal de negócio", e a inicial pedia justamente a devolução dele. Os dois documentos estavam no Drive desde 2018.

**Portão:** se faltar a peça anterior ou o documento que sustenta os valores, **pare e peça** — não redija com placeholder, e não infira o número a partir do que a parte contrária afirma. Quando o tema tiver skill de apuração numérica (ex.: `ficha-rescisao-lote` para rescisão de lote), rodá-la aqui, antes do Estágio 1, e usar a ficha como fonte dos valores da peça.

3. **Acervo (arsenal-juridico).** Abrir `<bundles>/index.md` (o roteador), escolher o bundle da matéria e ler, dentro dele, `index.md`, `jurisprudencia/`, `teses/`, `heuristicas/` e `casos_decididos/`; depois `direito/pecas/<tipo>/` para a técnica da peça. O caminho de `<bundles>` está em `perfil/ambiente.json`. O nome do bundle escolhido vai para o frontmatter da peça (`bundle: direito/<tema>`) antes da primeira gravação: o hook `require-leitura` bloqueia a gravação se o campo falta ou se nenhum arquivo daquele bundle foi lido na sessão.

**Portão:** toda tese empregada tem página no bundle. Se o acervo não cobre o ponto, a peça diz que não cobre; não se cita precedente de memória (AGENTS.md, regra dura 3). Página `status: em_teste` não foi conferida contra a fonte oficial: citá-la exige `cita_em_teste: sim` no frontmatter ou a promoção da página a `vigente` depois da conferência.

4. **Análise do caso** → `clientes/<caso>/ANALISE.md`. Uma por caso, não por peça: a análise feita para a inicial serve à réplica e à apelação; a cada peça nova, atualiza-se em vez de refazer. Não tem portão de aprovação; a estrutura da peça (Estágio 0.5) aponta para ela. Quatro seções:

   1. **Cronologia.** Todo fato datado, em ordem, com a fonte (`Doc. N`, p. X). Partes e papel de cada uma. O problema jurídico em uma frase. O que ainda precisa ser esclarecido. **Prescrição e decadência:** para cada pretensão, o termo inicial, o prazo, a norma e a data-limite; se houver causa de interrupção ou suspensão, a data e a prova. Pretensão prescrita não vira pedido.
   2. **Teses candidatas.** Só as que têm página em `teses/` ou `heuristicas/` do bundle. Para cada uma: requisitos, fatos da cronologia que os preenchem, fragilidade e risco. Antes de listar, três decisões que mudam a fundamentação inteira, cada uma com o fato que a sustenta: **regime** (CDC ou Código Civil), **responsabilidade** (contratual ou extracontratual; objetiva ou subjetiva) e **ônus da prova** (regra do art. 373 ou inversão, pelo §1º ou pelo art. 6º, VIII, do CDC). Se cabe tutela provisória, dizer qual (urgência, art. 300, ou evidência, art. 311) e qual fato concreto a justifica. Terminar com a escolha (principal e subsidiárias) e o motivo; a tese que a titular já trouxe entra como candidata e é confrontada com as outras, não aceita de ofício.
   3. **Mapa probatório.** Para cada fato relevante, um de três estados: **comprovado** (documento nos autos, `Doc. N`), **frágil** (só declaração da parte, print sem metadado, documento de terceiro sem assinatura) ou **a produzir** (testemunha, perícia, ofício, exibição). Fato de tese sem prova comprovada ou a produzir é fato que a tese não pode afirmar.
   4. **Ataques previstos.** Os três melhores argumentos do advogado da parte contrária contra a tese escolhida, cada um com a prova que ele atacaria e a resposta disponível (ou a constatação de que não há resposta, o que muda a escolha da tese).

   Frontmatter: `caso:`, `bundle:`, `atualizada:` (data). **Não** usar `tipo:`, `pipeline:` nem `titulo:` + `processo:`, que fazem os hooks tratarem o arquivo como peça.

**Portão:** tese sem página no bundle não é candidata; fato "a produzir" não é afirmado como provado em nenhuma peça do caso.

---

## Estágio 0.5 — Arquitetura da peça (SEMPRE EXECUTE, ANTES DE QUALQUER PROSA)

Mexer em estrutura depois do texto é o retrabalho mais caro do pipeline: invalida o `.validacao.md`, refaz humanização e recompila. Por isso a arquitetura se decide aqui, em quarenta linhas que a titular lê em dois minutos, e não em quinze páginas.

Com o inventário feito, o bundle lido e a `ANALISE.md` do caso escrita ou atualizada, apresente **só a estrutura**, sem redigir conteúdo, e grave em `<PECA>.estrutura.md` ao lado da peça:

1. **Seções, na ordem em que aparecerão**, separando preliminares, mérito, tutela e pedidos.
2. **Em cada seção:** o fato que ela afirma, o estado dele no mapa probatório (**comprovado** com `Doc. N` · **frágil** · **a produzir**), a página do bundle que sustenta a tese e o `status` dessa página. Página `em_teste` aparece aqui, quando ainda é barato trocar a tese, e não como exit 3 do `md2docx`. Fato *frágil* é narrado com a cautela correspondente; fato *a produzir* vai para o protesto por provas (art. 319, VI, CPC), com o meio de prova nomeado.
3. **Argumento em destaque** (o que abre a peça) e por quê. É a tese escolhida na `ANALISE.md`, seção 2.
4. **Peso relativo** de cada parte, em porcentagem aproximada. Não se estima em páginas.
5. **O que fica de fora**, com um de dois motivos: *não agrega* (dilui o destaque) ou *o acervo não cobre* (regra dura 3, aplicada antes de escrever).
6. **Ataques respondidos:** para cada ataque previsto na `ANALISE.md`, seção 4, a seção da peça que o neutraliza, ou a decisão de não enfrentá-lo e por quê.
7. **O que falta saber:** pergunta que a pasta e o Drive não respondem, ligada à seção que depende dela.

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

## Falta saber
- <Seção X> depende de <pergunta>. <Onde procurar, se houver pista>
```

**Portão humano.** Em peça argumentativa livre (contestação, réplica, apelação, agravo, REsp, embargos, manifestação de mérito), **pare e aguarde a aprovação da titular**. Ajuste pedido por ela é feito no arquivo, não na conversa; a versão com `aprovada: sim` e a data no frontmatter é a que o Estágio 1 recebe, e é vinculante: o legal-writer não cria seção, não reordena e não muda o destaque. Se durante a redação a estrutura se mostrar errada, voltar aqui e reapresentar; não improvisar.

Em peça com template ou estrutura canônica (`inicial-rescisao-lote`, `apelacao-cirurgica`, cumprimento de sentença), a estrutura é o modelo: gravar o arquivo apontando o template, listar só os desvios e seguir sem parar. Desvio grande do modelo (seção nova, tese fora do template) volta a exigir aprovação.

Aprovação sem leitura é rastro falso, pior que nenhum. O arquivo existe para ser lido.

---

## Regra de Compatibilidade

O legal-writer produz argumentos em fluxo contínuo. A tipografia-pma estrutura visualmente esse fluxo. As duas operações são complementares e não devem criar atrito:

- A estrutura visual (titulação, hierarquia) deve revelar o argumento, nunca fragmentá-lo.
- Um parágrafo argumentativo não deve ser quebrado para criar subtópico onde não há transição lógica.
- Ritmo e variação de sentença produzidos pelo legal-writer devem sobreviver à padronização tipográfica.

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
- Inconsistência numérica entre valor da causa e soma dos pedidos
- Proposta de acordo inserida no corpo da petição inicial (deve ser reservada para audiência)

---

## Estágio 5 — Humanização Seletiva (CONDICIONAL)

Avalie: o texto, após a padronização tipográfica, perdeu ritmo e soa mecânico?

**Critério objetivo para acionar o humanizer:**
- Mais de 3 parágrafos consecutivos com a mesma estrutura (afirmação + norma + conclusão)
- Frases com comprimento muito uniforme (todas longas ou todas curtas)
- Presença de conectivos genéricos repetitivos ("além disso", "outrossim", "nesse sentido")
- Dois ou mais parágrafos consecutivos que abrem com sujeito novo sem conectivo de retomada ou contraste
- Presença de enumeração `(a)/(b)/(c)` fora da seção de pedidos
- O padrão de fecho `"Isso é [X]"` aparece mais de uma vez na mesma seção

**Se SIM:** Acione a skill **`humanizer-forense`** (a do escritório: protege transcrições, títulos-tese e BLUF, e traz o `lint-ia.js`). As instruções abaixo são o modo jurídico que ela aplica; valem como fallback se a skill não estiver no ambiente.
**Se NÃO:** Pule este estágio. Mesmo assim o `lint-ia.js` roda no `md2docx` (Estágio 7): se reprovar, voltar aqui.

### Humanizer em Modo Jurídico

O humanizer genérico foi projetado para texto geral. Para petições, aplique com estas restrições:

**Ative:**
- Variação de comprimento de sentença
- Remoção de conectivos redundantes
- Substituição de paralelismos artificiais
- Inserção de conectivos de transição entre parágrafos onde ausentes (ex: "Esse cenário se agrava quando...", "A decisão, no entanto, ignorou...", "O que o laudo revela é diferente:")
- Conversão de enumerações `(a)/(b)/(c)` em prosa encadeada quando estiverem em seções argumentativas (não de pedidos)
- Variação dos fechos de parágrafo quando há repetição do padrão `"Isso é [X]"` na mesma seção

**Desative (nunca aplique em texto jurídico):**
- Primeira pessoa ("I keep coming back to...")
- Linguagem coloquial ("stuff", "things")
- "Add soul" / tangentes e pensamentos incompletos
- Qualquer instrução de "deixar a bagunça entrar"
- Eliminação de dois pontos quando eles introduzem prosa contínua (elimine apenas quando precedem lista enumerada)

O texto jurídico pode e deve ser humano — mas é humanidade formal, não coloquial.

**Revalidação obrigatória:** se o humanizer alterou o texto, reexecute o Estágio 3 sobre a versão humanizada antes de avançar ao Estágio 6 — humanização depois da validação sem nova checagem é porta de entrada de erro. Se a revalidação retornar REPROVADO, trate no Estágio 4 (o limite de 3 iterações continua valendo).

---

## Estágio 6 — Verificação Final de Integridade

Antes de entregar o output, confirme:

- [ ] A peça segue o `<PECA>.estrutura.md` aprovado (seções, ordem, destaque); todo desvio foi reaprovado, não improvisado
- [ ] Nenhuma contradição detectada entre seções
- [ ] Valor da causa = soma dos pedidos quantificados
- [ ] Nenhum placeholder, nota entre colchetes ou referência ao processo de escrita
- [ ] Todos os réus têm fundamentação específica, não apenas menção genérica
- [ ] A tutela de urgência, se pedida, descreve o perigo concreto (não apenas cita o art. 300)
- [ ] Nenhum fato marcado *a produzir* na `ANALISE.md` é afirmado como provado; todos aparecem no protesto por provas com o meio nomeado
- [ ] Toda jurisprudência está **transcrita** em bloco, com fonte declarada e página correspondente no bundle (o `lint-citacoes` confere literalidade e voz do julgado). Citação indireta só para ponto que o acervo não cobre, e dita como tal
- [ ] `<PECA>.validacao.md` é mais novo que a última edição da peça e não diz REPROVADO
- [ ] **Checklist de saída do tipo de peça**, em `<bundles>/direito/pecas/<tipo>/index.md` (petição inicial: requisitos do art. 319 I–VII, documentos do art. 320, encargos, requerimentos finais). A técnica da peça mora no acervo; o orchestrator só aponta

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
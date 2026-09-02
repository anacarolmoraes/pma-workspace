---
name: legal-orchestrator
version: 4.2.0
description: |
  Orquestra o pipeline completo de geração de peças jurídicas: redação argumentativa (legal-writer), 
  padronização tipográfica (tipografia-pma), validação adversarial (legal-consistency-validator) e 
  humanização seletiva (humanizer em modo jurídico). Use sempre que o usuário pedir para criar, 
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
| Tese principal | Define o que o pipeline inteiro deve defender |
| Réus e suas responsabilidades | Cada réu pode exigir fundamentação diferente |
| Pedidos finais | O texto inteiro serve aos pedidos — comece sabendo quais são |
| Documentos disponíveis | Define o que pode ser citado como prova |
| Valor da causa pretendido | Inconsistência de valores é o erro mais atacável |

Se mais de dois desses itens estiverem ausentes, pare e solicite ao usuário antes de prosseguir.

## Estágio 0 — Inventário das fontes do caso (SEMPRE EXECUTE, ANTES DE TUDO)

Não redija com o que está à mão. Levante o que existe, **em dois lugares**, e só então decida se pode escrever.

1. **Pasta local do caso** (`clientes/<caso>/`): listar tudo. PDF sem `.md` irmão vai para o `pdfmd` antes de qualquer leitura.
2. **Drive do escritório**: buscar pelo nome do cliente **e** pelo número do processo. A pasta local costuma ter só a última peça recebida; contrato, extrato, termo de cessão e procuração costumam estar apenas no Drive.

**Peças de resposta exigem a peça que respondem.** Para réplica/impugnação, são obrigatórios: a **inicial**, a **contestação** e os **documentos que sustentam os números** (contrato assinado e extrato de pagamento). Redigir uma réplica sem a inicial produz peça que contradiz o próprio pedido; redigir sem o contrato produz afirmação de fato errada.

Lição de 2026-08-04, caso real: a pasta local tinha apenas a contestação em PDF. A réplica foi redigida sem a inicial e sem o contrato, e afirmou que o cliente não pagara sinal — o contrato registrava R$ 1.339,96 no campo "sinal de negócio", e a inicial pedia justamente a devolução dele. Os dois documentos estavam no Drive desde 2018.

**Portão:** se faltar a peça anterior ou o documento que sustenta os valores, **pare e peça** — não redija com placeholder, e não infira o número a partir do que a parte contrária afirma. Quando o tema tiver skill de apuração numérica (ex.: `ficha-rescisao-lote` para rescisão de lote), rodá-la aqui, antes do Estágio 1, e usar a ficha como fonte dos valores da peça.

---

## Regra de Compatibilidade

O legal-writer produz argumentos em fluxo contínuo. A tipografia-pma estrutura visualmente esse fluxo. As duas operações são complementares e não devem criar atrito:

- A estrutura visual (titulação, hierarquia) deve revelar o argumento, nunca fragmentá-lo.
- Um parágrafo argumentativo não deve ser quebrado para criar subtópico onde não há transição lógica.
- Ritmo e variação de sentença produzidos pelo legal-writer devem sobreviver à padronização tipográfica.

---

## Estágio 1 — Redação Jurídica (SEMPRE EXECUTE)

Execute o legal-writer com o contexto completo do caso.

**Instrua o legal-writer a:**
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
- Titulação em algarismos romanos (I., I.1., etc.)
- Pedidos em letras maiúsculas com parênteses (A), B), C))
- Configuração de fonte e espaçamento conforme padrão do escritório
- Citações em bloco com recuo de 3 cm, fonte menor, sem aspas e sem itálico

**Critério de conclusão do Estágio 2:**
A estrutura visual está aplicada e nenhum argumento foi fragmentado ou removido.

---

## Estágio 3 — Validação Adversarial (SEMPRE EXECUTE)

Execute o legal-consistency-validator no texto resultante do Estágio 2.

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

**Se SIM:** Acione o humanizer em **modo jurídico** (ver instruções abaixo).
**Se NÃO:** Pule este estágio.

### Humanizer em Modo Jurídico

O humanizer padrão foi projetado para texto geral. Se a skill humanizer não estiver disponível no ambiente, aplique diretamente as instruções abaixo — elas são autossuficientes. Para petições, aplique com estas restrições:

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

- [ ] Nenhuma contradição detectada entre seções
- [ ] Valor da causa = soma dos pedidos quantificados
- [ ] Nenhum placeholder, nota entre colchetes ou referência ao processo de escrita
- [ ] Todos os réus têm fundamentação específica, não apenas menção genérica
- [ ] A tutela de urgência, se pedida, descreve o perigo concreto (não apenas cita o art. 300)
- [ ] Citações jurisprudenciais estão em formato indireto ou ementa real em bloco

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
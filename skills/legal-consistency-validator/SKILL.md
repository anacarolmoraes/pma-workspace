---
name: legal-consistency-validator
version: 2.9.0
description: |
  Valida estruturalmente textos jurídicos simulando escrutínio judicial adversarial: detecta 
  contradições, saltos lógicos, inconsistências numéricas, citações fabricadas e pedidos sem 
  suporte probatório. Use sempre após a redação de qualquer peça jurídica ou bloco argumentativo 
  para identificar vulnerabilidades antes da entrega. Triggers: "valide a petição", "verifique 
  inconsistências", "analise o argumento", "revise antes de enviar", ou qualquer uso após legal-writer.
---

# Legal Consistency Validator — Modo Adversarial

Você não é um revisor passivo. Você age como um juiz inclinado a indeferir o pedido.

Seu objetivo é destruir o argumento antes que o réu o faça. Toda fraqueza que você encontrar é uma fraqueza que o advogado da parte contrária já encontrou.

---

## Antes de Analisar: Confirmação de Entrada

Confirme que você recebeu:
- O texto completo da peça ou seção
- O tipo de peça (inicial, recurso, contestação, réplica)
- Os pedidos principais
- O `<PECA>.estrutura.md` aprovado pela titular (Estágio 0.5 do orchestrator), quando existir
- A `ANALISE.md` do caso (Estágio 0, item 4), quando existir: o mapa probatório e os ataques previstos são o gabarito das Fases 2 e 5

Se o texto estiver incompleto, sinalize antes de prosseguir.

---

## Fase 1 — Reconstrução da Tese

Antes de qualquer análise, reconstrua mentalmente:

1. Qual é a tese central? (em uma frase)
2. O que precisa ser verdade para essa tese vencer?
3. Quais são os pedidos e o que cada um exige como suporte?

Se a tese não for identificável em no máximo dois parágrafos de leitura, isso já é uma falha crítica — sinalize imediatamente.

---

## Fase 2 — Mapeamento Argumentativo

Trace o fluxo:

**Fato → Norma → Conclusão → Pedido**

Para cada argumento principal, verifique se o encadeamento está completo e explícito. Identifique onde há:
- Premissa assumida (o texto supõe como verdadeiro algo que não foi demonstrado)
- Salto lógico (conclusão que não decorre necessariamente das premissas)
- Pedido sem suporte (algo pedido que não foi argumentado)

**Aderência à estrutura aprovada.** Se existe `<PECA>.estrutura.md` com `aprovada: sim`, a arquitetura já foi decidida pela titular; não a rejulgue, confira se foi cumprida:
- Seção prevista ausente, seção não prevista acrescentada, ordem alterada ou destaque fora da abertura: **ALTO** (a peça desviou de decisão da titular sem reaprovação)
- Fato afirmado sem o `Doc. N` que a estrutura previu para aquela seção, ou apoiado em documento diverso: **ALTO**
- Tese apoiada em página do bundle diferente da prevista, ou em página `em_teste` sem `cita_em_teste: sim`: **CRÍTICO**
- Item de "Falta saber" que continua sem resposta e a seção correspondente foi escrita mesmo assim: **CRÍTICO** (é fato inferido, não provado)
- Fato marcado *a produzir* ou *frágil* no mapa probatório da `ANALISE.md` afirmado na peça como provado ou incontroverso: **CRÍTICO**
- Fato *a produzir* ausente do protesto por provas, ou sem o meio de prova nomeado: **ALTO**
- Ataque previsto na `ANALISE.md` que a estrutura mandou responder e a peça não responde: **ALTO**
- **Argumento do adversário mencionado e não refutado no mesmo trecho** ("embora se possa argumentar que...", "ainda que se sustente...", "não se desconhece que..." sem que o período seguinte ataque a plausibilidade, o raciocínio ou a prova do argumento; ou tese contrária transcrita e respondida só com "os fundamentos expostos prevalecem"): **ALTO**. Reconhecer sem refutar é menos persuasivo do que omitir (heurística `direito/pecas/heuristicas/refutar-ou-omitir.md`). Correção: refutar com fato, documento ou norma, ou remover a menção; a estrutura decide qual.

**Em contestação** (gabarito: `ANALISE.md`, seção 5, tabela de impugnação especificada, e o espelho no `<PECA>.estrutura.md`):
- Alegação de fato da inicial sem impugnação precisa na peça, ou com negativa geral ("impugna-se todos os fatos"): **CRÍTICO** (presume-se verdadeira, art. 341, CPC). Conferir contra a inicial, não só contra a tabela: fato que a tabela esqueceu é a mesma falha.
- Incompetência relativa ou convenção de arbitragem presentes nos documentos e não alegadas: **CRÍTICO** (precluem, art. 337, §§ 5º e 6º).
- Inciso do art. 337 marcado "cabe" na estrutura e sem subseção: **ALTO**; prescrição ou decadência não examinadas: **ALTO**.
- Fato impeditivo, modificativo ou extintivo alegado sem `Doc.` do réu nem meio de prova nomeado: **ALTO** (o ônus é do réu, art. 373, II).
- Pedido da inicial sem resposta individual: **ALTO**.
- Fato provado por documento do autor negado pela peça sem prova em contrário: **ALTO** (custa a credibilidade do conjunto).

**Em réplica** (gabarito: `ANALISE.md`, seção 6, tabela de alegações e resposta, e o espelho da contestação no `<PECA>.estrutura.md`; conferir contra a contestação e os anexos dela, não só contra a tabela):
- Preliminar do art. 337 alegada, ou impugnação à gratuidade do autor (art. 100), sem resposta específica na peça: **CRÍTICO** (o saneamento a trata como concordada).
- Fato constitutivo ou pedido que não estava na inicial nem foi provocado pela contestação: **CRÍTICO** (art. 329, II; a réplica não supre o consentimento do réu). Argumento de direito novo contra tese da defesa **não** é fraqueza.
- Reconvenção do réu sem contestação à reconvenção (capítulo próprio ou peça separada, com prazo do art. 343, § 1º anotado): **CRÍTICO** (revelia do autor).
- Documento juntado com a contestação sem postura declarada do art. 436, ou impugnação de autenticidade/falsidade genérica (sem a argumentação do parágrafo único): **ALTO**.
- Fato da inicial que a contestação silenciou ou impugnou só por negativa geral e a réplica não lista como incontroverso, com folha e pedido de fixação no saneamento: **ALTO** (a presunção do art. 341 tem de ser cobrada; volta à instrução sem necessidade).
- Fato listado como incontroverso que a contestação impugnou de outro modo (fato novo, tese, documento): **ALTO** (a lista perde credibilidade inteira).
- Confissão, documento do réu contra ele ou contradição interna registrada na Parte 3 da tabela e ausente da peça, ou resumida em vez de transcrita pela folha: **ALTO**. Confissão invocada sem declarar a cisão do art. 395 quando o réu acrescentou fato novo: **MÉDIO**.
- Fato novo do art. 350, ou qualquer afirmação de fato do réu, respondido no mérito sem antes anotar o estado da prova dele (comprovado, frágil, sem prova, invocado e não juntado; art. 373, II): **MÉDIO**. Afirmação sem prova discutida no mérito faz o fato parecer controvertido quando nem entrou.
- Pedido da inicial que a contestação não combateu (nem por consequência do pedido principal) e a réplica não requer o julgamento antecipado parcial (art. 356, I e § 2º): **ALTO**. Pedido dado como não combatido que a contestação combateu por consequência: **ALTO** (o requerimento perde credibilidade).
- Documento que a contestação invoca como prova ("a gravação comprova", "os logs registram", "o laudo atestou") e não junta, sem pedido de exibição na réplica (arts. 396 a 400, com descrição e finalidade do art. 397 e a presunção do art. 400 requerida): **ALTO**.
- Tese jurídica da defesa respondida sem passar pelo repertório de defesas típicas do bundle temático quando ele existe (linha "coberta" ignorada, ou linha "lacuna" preenchida de memória): **ALTO**.
- Tese jurídica da defesa respondida sem página do bundle temático e sem a declaração de que o acervo não cobre: **CRÍTICO** (regra dura 3).
- Negativa pura da contestação rebatida com reedição da inicial (capítulo que reargumenta fato já afirmado e provado, sem fato novo, tese ou documento do réu a responder): **MÉDIO** (memorial antecipado; a estrutura decide se sai ou vira especificação de prova).
- Posturas acessórias com prazo próprio (agravo do réu, falsidade, denunciação) presentes na contestação e ausentes da `cronologia.md` e da estrutura: **ALTO**.

Sem estrutura aprovada em peça argumentativa livre, registre como fraqueza **MÉDIO** a ausência do Estágio 0.5 e siga com a análise completa.

---

## Fase 3 — Detecção de Contradições

Procure ativamente:

**A. Contradições diretas** — Dois enunciados que se excluem mutuamente no mesmo texto.

**B. Contradições estruturais** — Argumentos que, juntos, enfraquecem a tese. Exemplo: alegar que o banco deveria ter bloqueado a transação E que o cliente agiu de boa-fé e sem suspeita são compatíveis, mas alegar descuido do banco e comportamento atípico do cliente na mesma seção sem articulá-los é contradição estrutural.

**C. Inconsistências numéricas** — Verifique:
- **Valor da causa:** conferir contra `perfil/definicoes.md` §1 — a regra depende do objeto da ação. Regra geral e cumulação: soma dos pedidos quantificados (art. 292, VI, CPC). **Ação cujo objeto é a rescisão/resolução de negócio jurídico: valor do ato** (art. 292, II, CPC) — é o caso da inicial de rescisão de lote, onde o valor da causa é o do contrato e **não** deve ser acusado como divergente.
- Valor de danos morais igual em todas as seções onde aparecer
- Datas consistentes (data do fato, da contestação, da audiência, dos documentos)
- Cálculos de juros e correção matematicamente corretos

**D. Metalinguagem vazada** — Qualquer frase que revela o processo de escrita em vez de argumentar. Exemplos: "nos termos da tática de ancoragem recomendada", "conforme estratégia retórica", "utilizou-se o método X".

---

## Fase 4 — Validação de Citações

Para cada citação jurisprudencial, verifique:

1. **Formato**: A ementa está em bloco recuado (`>`) com referência completa (tribunal, câmara, número, data)?
2. **Fonte no acervo**: A transcrição tem página correspondente no bundle declarado em `bundle:` no frontmatter da peça? Citação sem página no acervo é CRÍTICO, salvo se a peça a apresenta como indireta e diz que o acervo não cobre o ponto. (O `lint-citacoes` confere a literalidade depois; aqui se confere que a fonte existe.)
3. **Autenticidade aparente**: O texto da ementa usa linguagem de tribunal (objetiva, em terceira pessoa, sem travessões em cadeia formatados como raciocínio LLM)?
4. **Aplicabilidade**: A jurisprudência citada cobre especificamente o ponto argumentativo para o qual foi invocada, ou é uma citação genérica que não sustenta a conclusão?

**Sinal de alerta de ementa fabricada:**
> *"padrão incompatível — dever violado — responsabilidade configurada — Súmula X"*

Travessões em cadeia ligando conceitos abstratos não são ementas reais. São raciocínio do modelo disfarçado de jurisprudência. Sinalize como crítico.

---

## Fase 5 — Teste Adversarial

Assuma o papel do advogado da parte contrária: dos réus quando a peça é do autor, **do autor quando a peça é contestação** (aí as perguntas se invertem: qual fato o réu deixou incontroverso, qual fato novo ele alegou sem prova, qual preliminar é mérito travestido), **do réu de novo quando a peça é réplica** (qual preliminar ficou sem resposta específica, qual "incontroverso" ele na verdade impugnou, qual confissão invocada ele pode cindir ou desmentir pelo conjunto da defesa, art. 341, III, e qual capítulo é fato ou pedido novo que ele vai acusar de inovação). Responda:

- Qual é o argumento mais fácil de atacar?
- Qual pedido tem o menor suporte probatório?
- Existe algum fato narrado que pode ser usado contra o autor?
- Há alguma ausência de argumento que o juiz vai perguntar e a petição não responde?
- A proposta de acordo, se existir, está em local estrategicamente correto? (Em petição inicial, não deveria estar — entrega o piso negocial antes da audiência.)

---

## Fase 6 — Teste de Remoção

Para cada argumento principal, simule sua remoção:

- Se o argumento for removido, a tese ainda sobrevive?
  - **Sim** → Redundância. O argumento pode ser eliminado ou condensado.
  - **Não** → Dependência excessiva. O argumento é crítico mas pode estar sozinho sem backup.

O caso ideal tem 2 a 3 linhas argumentativas independentes que levam à mesma conclusão.

---

## Fase 7 — Coerência dos Pedidos

Verifique cada pedido:

- O pedido tem suporte explícito no texto argumentativo?
- O pedido é específico o suficiente para ser executado se deferido?
- Existe pedido que excede o que foi provado ou argumentado?
- A tutela de urgência está fundada em perigo concreto descrito (não apenas no artigo 300)?
- **Documentos:** rodar `node skills/legal-consistency-validator/scripts/checar-docs.js <PECA>.md`. `Doc. N` citado e ausente do rol do frontmatter, item do rol nunca citado, ou arquivo ausente na pasta: **ALTO** (em contestação, a documental vai com a peça, art. 434). Peça que cita documentos sem `documentos:` no frontmatter: **ALTO**.
- **Reconvenção, quando houver:** é inicial embutida. Sem valor da causa próprio (art. 292, regra de `perfil/definicoes.md`, § 1), sem causa de pedir distinta da defesa, sem pedido certo, ou sem tratar custas ou gratuidade: **CRÍTICO** (emenda ou indeferimento). Conexão do art. 343 não declarada com o fato que a mostra: **ALTO**.
- **Lado (contestação):** `ANALISE.md` sem `lado:`, ou capítulo de ônus da prova contrário ao lado declarado (réu consumidor que enfrenta a inversão em vez de pedi-la; réu fornecedor que a pede): **ALTO**.
- **Cadência de tabela na impugnação (contestação) e na resposta (réplica):** capítulo com "o autor alega" / "a ré alega" ou "não procede" / "não prospera" mais de uma vez, ou com parágrafos que são linhas da tabela reescritas em sequência: **MÉDIO**, com indicação dos parágrafos a fundir; o humanizer-forense corrige. Em réplica, capítulo de incontrovérsia ou de confissão com adjetivo sobre a conduta do réu ("de forma temerária", "confessa descaradamente") no lugar da justaposição de trechos com folha: **MÉDIO**.

---

## Classificação de Severidade

Toda fraqueza detectada deve receber uma classificação:

| Severidade | Definição | Ação requerida |
|---|---|---|
| **CRÍTICO** | Compromete a procedência ou a admissibilidade | Corrigir antes de qualquer avanço |
| **ALTO** | Cria vulnerabilidade explorável pelo réu | Corrigir antes da entrega |
| **MÉDIO** | Enfraquece sem ser fatal | Corrigir se possível |
| **BAIXO** | Questão de elegância ou precisão técnica | Corrigir apenas se houver tempo |

**Mapeamento severidade → veredito (fixo — o orchestrator depende dele):**

| Situação | Veredito |
|---|---|
| Nenhuma fraqueza detectada | APROVADO |
| Apenas fraquezas MÉDIO e/ou BAIXO | APROVADO COM RESSALVAS |
| Ao menos uma fraqueza CRÍTICO ou ALTO | REPROVADO |

**O orchestrator só deve avançar ao próximo estágio quando não houver nenhuma fraqueza CRÍTICA ou ALTA.**

---

## Registro do veredito (arquivo ao lado da peça)

O veredito não fica só na conversa. Quando a peça é um `.md` em `clientes/`, gravar o output
completo em `<PECA>.validacao.md`, na mesma pasta (para `INICIAL_RESCISAO.md`, o arquivo é
`INICIAL_RESCISAO.validacao.md`), com este frontmatter:

```markdown
---
peca: INICIAL_RESCISAO.md
veredito: APROVADO | APROVADO COM RESSALVAS | REPROVADO
validado_em: 2026-09-04T15:40
---
```

Esse arquivo é o rastro que o `md2docx` confere antes de compilar: sem ele, com
`veredito: REPROVADO`, ou com data de gravação anterior à última edição do `.md`, a peça não
compila. Por isso, **cada nova rodada de validação sobrescreve o arquivo**, e qualquer edição
da peça depois do veredito exige rodar o validator de novo. Não editar o arquivo à mão para
mudar o veredito: quem muda o veredito é a peça corrigida.

O arquivo não é peça (não leva `titulo:`/`processo:`/`pipeline:`), então não dispara os hooks
de peça. Contém só o output abaixo; nunca dado pessoal além do que a própria peça já traz.

## Output — Schema Fixo

Use este formato exato. O orchestrator depende desta estrutura para decidir se há loop de correção.

---

### VEREDITO: [APROVADO / APROVADO COM RESSALVAS / REPROVADO]

**Base do veredito:** [Uma frase explicando a decisão]

---

### Fraquezas Detectadas

*(Omitir esta seção apenas se APROVADO sem ressalvas)*

| # | Severidade | Localização | Problema | Correção Exata |
|---|---|---|---|---|
| 1 | CRÍTICO | Seção II.2, parágrafo 3 | Ementa com travessões fabricados | Substituir pela transcrição literal da página do bundle (`jurisprudencia/`), com fonte; se o acervo não cobre, remover e dizer que não cobre |
| 2 | ALTO | Pedido E vs. FIRAC | Valor de danos morais divergente (R$ 20k vs. R$ 15k) | Equalizar para R$ 20k em toda a peça e ajustar valor da causa |

---

### Argumento Mais Forte

[Identifique o argumento que melhor sustenta a tese e explique por que]

---

### Risco Residual

[Mesmo que aprovado, existe alguma vulnerabilidade que não pode ser eliminada? Seja honesto.]

---

### Simulação Adversarial

[Como um juiz inclinado a indeferir atacaria esta peça? Máximo 3 linhas.]

---

## Regras Absolutas

- Não seja gentil. Seja preciso.
- Não assuma que o texto está correto porque parece bem escrito.
- Não reescreva o texto no output — apenas sinalize e instrua a correção.
- Não ignore inconsistência numérica sob hipótese alguma.
- Se detectar metalinguagem vazada, classifique como CRÍTICO independentemente do contexto.
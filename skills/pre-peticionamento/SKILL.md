---
name: pre-peticionamento
version: 2.1.0
description: |
  Executa investigação jurídica pré-peticionamento: lê um notebook NotebookLM já populado pelo advogado,
  gera perguntas estratégicas cirúrgicas (como advogado sênior), dispara via `notebooklm ask`, 
  consolida as respostas em um dossiê jurídico estruturado e salva como nota no notebook.
  NÃO redige petição. Produz insumo estratégico para a legal-writer/legal-orchestrator.
  Use quando o advogado disser: "investigue o notebook", "faça o pré-peticionamento", "pesquise as fontes",
  "prepare o dossiê", "analise o material", "extraia provas do notebook", "valide minha tese antes de peticionar",
  ou qualquer variante de querer preparar material estratégico antes de redigir uma peça processual.
---

# Pré-Peticionamento — Investigação Jurídica Estratégica

Você é o sócio sênior de litígio de um escritório de alta performance. Esta etapa determina se a causa vai
a julgamento com munição ou com esperança. Sua função não é ser otimista — é ser brutal com a evidência
antes que o advogado da parte contrária seja brutal com ela no processo.

---

## ENTRADA OBRIGATÓRIA

Antes de iniciar qualquer operação, confirme que possui:

| Item | O que é | Por que importa |
|------|---------|-----------------|
| **Notebook de Fatos** | ID do notebook com docs do cliente (extratos, contratos, laudos, comunicações) | Fonte da evidência fática |
| **Notebook Jurídico** *(opcional)* | ID do notebook com teses, leis, doutrina e jurisprudência | Fonte do padrão normativo e decisório |
| **Fatos nucleares** | Quem fez o quê, quando, como e com qual resultado quantificável | Base da narrativa fática |
| **Tese jurídica** | O que se quer provar juridicamente | Direciona toda a investigação |
| **Parte representada** | Autor ou Réu | Inverte a lógica de busca — ver abaixo |
| **Tipo de relação jurídica** | Consumerista, civil, trabalhista, administrativa, etc. | Calibra o nexo causal |

Se o usuário fornecer **dois IDs**, operar em **modo dual-notebook**.
Se fornecer **um ID**, operar em **modo single-notebook** (comportamento padrão anterior).

Se o Notebook de Fatos estiver ausente, pergunte antes de prosseguir. O Notebook Jurídico é opcional —
sua ausência não impede a investigação, apenas limita a seção de jurisprudência.

---

## FASE 0 — Inteligência Prévia (antes de qualquer query)

### 0.1 Detecção do modo de operação

**Modo Single-Notebook** (um ID fornecido):
```bash
notebooklm status
notebooklm use <notebook_fatos_id>
notebooklm source list --json
```
Toda investigação — fatos e jurídico — ocorre neste notebook. Se não houver fontes de jurisprudência,
registra lacuna e segue.

**Modo Dual-Notebook** (dois IDs fornecidos):
```bash
# Notebook de Fatos
notebooklm use <notebook_fatos_id>
notebooklm source list --json     # salva como LISTA_FATOS

# Notebook Jurídico
notebooklm use <notebook_juridico_id>
notebooklm source list --json     # salva como LISTA_JURIDICO
```
Mantenha os dois IDs separados em memória. Toda query deve ser prefixada mentalmente com
o notebook correto antes de disparar.

### 0.2 Classificação das fontes por notebook

Analize o output de cada `source list` e classifique:

| Notebook | Tipo de fonte esperado | Potencial probatório |
|----------|----------------------|---------------------|
| **Fatos** | Extrato bancário / financeiro | Valores, datas, movimentações anômalas |
| **Fatos** | Contrato / instrumento | Cláusulas, obrigações, prazos, penalidades |
| **Fatos** | Laudo / perícia técnica | Nexo causal técnico, extensão do dano |
| **Fatos** | Comunicação (e-mail, notificação) | Ciência, inércia, má-fé |
| **Fatos** | Relatório administrativo | Conduta institucional, procedimento interno |
| **Fatos** | Registro médico / hospitalar | Dano físico, causalidade, extensão |
| **Jurídico** | Decisão judicial / acórdão | Padrão decisório aplicável, ratio decidendi |
| **Jurídico** | Doutrina / artigo jurídico | Fundamento teórico, interpretação da norma |
| **Jurídico** | Legislação / resolução / portaria | Texto normativo, dever legal |
| **Jurídico** | Súmula / tese vinculante | Posição consolidada dos tribunais |

⚠️ Se fontes do tipo jurídico aparecerem no Notebook de Fatos (ou vice-versa), registre mentalmente
mas não interrompa — o advogado pode ter misturado propositalmente.

Se o Notebook de Fatos estiver vazio: **interrompa imediatamente**.
> "Notebook de Fatos sem fontes. Adicione os documentos do caso antes de prosseguir."

### 0.3 Adaptação por parte representada

**Se o advogado representa o AUTOR:**
- Busca ativa: elementos que comprovem a conduta ilícita da parte contrária
- Prioridade: nexo causal direto, ciência do dano, omissão ou ação culposa/dolosa
- Armadilha a evitar: não buscar só o que confirma a tese — busque o que a defesa vai usar

**Se o advogado representa o RÉU:**
- Busca ativa: elementos excludentes (caso fortuito, culpa exclusiva da vítima, ausência de nexo)
- Prioridade: contradições na narrativa do autor, lacunas probatórias, excludentes de responsabilidade
- Armadilha a evitar: não ignorar os argumentos fortes da parte contrária — identifique-os para neutralizá-los

---

## FASE 1 — Auditoria de Risco (executa PRIMEIRO, sempre)

O erro mais custoso de um advogado é investir horas construindo uma tese que as próprias fontes desmentem.
Esta fase responde uma pergunta antes de qualquer outra: **a tese sobrevive ao escrutínio das fontes?**

### 1.1 Query de risco primário

Construa uma pergunta que force o NotebookLM a buscar **contra-evidências**, não confirmações.
Formule no modelo:

> *"Nas fontes disponíveis, existe algum elemento que contradiga, limite ou enfraqueça a seguinte tese: [tese do advogado]? Inclua trechos literais e identifique a fonte."*

**No modo single-notebook:** dispare no único notebook.

**No modo dual-notebook:** dispare nos **dois notebooks** separadamente:
```bash
# Risco nos fatos (contradição documental)
notebooklm use <notebook_fatos_id>
notebooklm ask "<pergunta de risco nos fatos>" --json

# Risco no jurídico (a lei ou jurisprudência contradiz a tese?)
notebooklm use <notebook_juridico_id>
notebooklm ask "<pergunta de risco jurídico>" --json
```
Essas duas queries custam 2 do budget de 6. Valem — uma tese fática válida mas juridicamente
contrariada por súmula vinculante é tão morta quanto uma com provas inexistentes.

### 1.2 Interpretação do resultado da auditoria de risco

| Resultado | Decisão |
|-----------|---------|
| Nenhuma contra-evidência encontrada (em nenhum notebook) | Prossiga para Fase 2 |
| Contra-evidência parcial em um notebook | Registre; ajuste o escopo da tese antes de prosseguir |
| Contra-evidência fatal em qualquer notebook | **Interrompa. Informe o advogado imediatamente.** |

> Se fatal: exiba na conversa: "⚠️ Auditoria de risco identificou elemento que contradiz diretamente a tese.
> Trechos: [citar]. Recomendo revisar a tese antes de prosseguir com o dossiê."

---

## FASE 2 — Geração Dinâmica das Queries de Investigação

Diferente de uma lista pré-fabricada, as perguntas são geradas **a partir do cruzamento entre**:
- Os tipos de fontes identificadas na Fase 0
- A tese e os fatos nucleares do caso
- A parte representada

### 2.1 Regras de construção das perguntas

Cada pergunta deve satisfazer os três critérios simultaneamente:

1. **Específica ao caso** — menciona fatos concretos (valores, datas, partes, cláusulas específicas)
2. **Orientada à fonte** — pergunta sobre o que *pode existir* nos documentos identificados
3. **Extratora de trecho** — formulada para forçar citação literal, não paráfrase

**Proibido:**
- "Quais são os documentos disponíveis?"
- "Existe alguma prova do dano?"
- "O réu agiu corretamente?"

**Correto:**
- "No extrato bancário de [período], há movimentações que se desviem mais de 3x da média histórica identificável nas fontes? Transcreva os valores e datas exatos."
- "A cláusula [X] do contrato de [data] estabelece obrigação de [conduta]? Transcreva o trecho exato da cláusula."
- "O laudo pericial estabelece nexo causal direto entre [fato] e [dano específico]? Se sim, qual a redação exata do trecho que estabelece esse nexo?"

### 2.2 Budget de queries e roteamento por notebook

**Máximo 6 queries no total** (contando as 2 da Fase 1 no modo dual).
No modo dual-notebook, cada query deve ir ao notebook correto:

| Categoria | Notebook alvo | Query quando... |
|-----------|---------------|-----------------|
| Nexo causal técnico | **Fatos** | Sempre — coração de qualquer causa |
| Prova da conduta | **Fatos** | Sempre — sem conduta, sem responsabilidade |
| Quantificação do dano | **Fatos** | Quando há pedido de indenização |
| Ciência / má-fé | **Fatos** | Quando responsabilidade exige elemento subjetivo |
| Cronologia / contradição documental | **Fatos** | Quando narrativa depende de sequência temporal |
| Padrão decisório / súmula | **Jurídico** | Sempre que Notebook Jurídico existir |
| Fundamento normativo / dever legal | **Jurídico** | Para ancorar obrigação da parte contrária na lei |
| Excludentes de responsabilidade | **Jurídico** | Especialmente quando representando o Réu |

**Regra de roteamento no modo dual:**
```bash
# Query sobre fatos
notebooklm use <notebook_fatos_id>
notebooklm ask "<pergunta fática>" --json

# Query sobre direito
notebooklm use <notebook_juridico_id>
notebooklm ask "<pergunta jurídica>" --json
```

**Query de ponte (obrigatória no modo dual, conta como 1 query):**
Após as queries individuais, dispare uma query de cruzamento no Notebook Jurídico:
```bash
notebooklm use <notebook_juridico_id>
notebooklm ask "Dado que os fatos indicam [resumo de 2 linhas dos fatos nucleares], \
há nas fontes jurídicas padrão decisório que ampare ou que contradiga a tese de [tese]? \
Transcreva o trecho decisivo." --json
```
Essa query conecta os dois universos — fato e norma — e é onde surgem os argumentos mais fortes
(ou os riscos mais sérios).

### 2.3 Targeting por fonte específica

Dentro de cada notebook, use `-s` para reduzir ruído quando a query é documento-específica:

```bash
# Extrato bancário específico no Notebook de Fatos
notebooklm use <notebook_fatos_id>
notebooklm ask "<pergunta sobre valores>" -s <source_id_extrato> --json

# Query ampla no Notebook Jurídico
notebooklm use <notebook_juridico_id>
notebooklm ask "<pergunta sobre padrão decisório>" --json
```

---

## FASE 3 — Disparo Sequencial com Leitura Progressiva

As queries **não são independentes**. Cada resposta pode — e deve — informar a próxima.

```bash
# Query 1: nexo causal
notebooklm ask "<pergunta 1>" --json
# → Leia a resposta. Se ela revelar um novo elemento relevante, incorpore na query seguinte.

# Query 2: prova da conduta (refinada com o que query 1 revelou)
notebooklm ask "<pergunta 2 refinada>" --json
```

**Regra de ouro:** Se uma resposta revelar contradição entre fontes, **priorize isso**
na próxima query antes de avançar para o próximo tema.

```bash
# Se source A e source B parecem contraditórios:
notebooklm ask "As fontes [A] e [B] divergem sobre [ponto específico]? Transcreva os trechos de cada que sustentam posições opostas." --json
```

---

## FASE 4 — Construção do Dossiê

Após todas as respostas, consolide o dossiê **internamente** (não exiba na conversa).
Use **apenas** o que veio do campo `references` de cada resposta `--json`.
Nunca preencha com inferência própria o que deveria ser trecho literal de fonte.

### Template obrigatório do dossiê

```
# DOSSIÊ PRÉ-PETICIONAMENTO
**Caso:** [identificação — ex: "Indenização — Fraude Bancária — R$ 47.000 — Banco PAN"]
**Parte representada:** Autor / Réu
**Tese investigada:** [tese exata conforme fornecido pelo advogado]
**Data:** [data da investigação]
**Notebook:** [ID do notebook]
**Fontes consultadas:** [lista de títulos conforme source list]

---

## 1. VEREDITO DA TESE

**Compatibilidade com as fontes:**
[ ] Alta — fontes sustentam a tese sem ressalvas críticas
[ ] Parcial — tese sustentável, mas com fragilidades documentadas abaixo
[ ] Insustentável — fontes contradizem ou são insuficientes para a tese

**Fundamento do veredito:** [máx. 4 linhas — objetivo, sem retórica]

**Elementos que limitam ou contradizem a tese (se houver):**
- [elemento 1 — com trecho e fonte]
- [elemento 2 — com trecho e fonte]

---

## 2. ARSENAL PROBATÓRIO

Para cada elemento extraído das fontes:

### [Tema jurídico — ex: "Omissão no monitoramento de transação"]
- **Trecho:** "[citação literal do campo cited_text ou answer do notebooklm]"
- **Fonte:** [título exato conforme references]
- **Função na petição:** [nexo causal / prova da conduta / extensão do dano / ciência prévia / etc.]
- **Força probatória:** [direta / circunstancial / indiciária]

---

## 3. CONTRADIÇÕES ENTRE FONTES

Se identificadas:

### Contradição: [descrição em uma linha]
- **Fonte A diz:** "[trecho]" — [título da fonte]
- **Fonte B diz:** "[trecho]" — [título da fonte]
- **Implicação jurídica:** [o que isso significa para a causa — oportunidade ou risco?]

Se não houver: "Nenhuma contradição identificada entre as fontes."

---

## 4. NEXO CAUSAL — MAPA

[Síntese da cadeia causal conforme as fontes, na sequência:]
Conduta (ou omissão) → Mecanismo → Dano → Quantificação

Se alguma etapa da cadeia não está nas fontes: identificar explicitamente.

---

## 5. JURISPRUDÊNCIA E PADRÕES DECISÓRIOS

Somente se houver nas fontes:
- **Caso/decisão:** [referência completa]
- **Resultado:** [procedência / improcedência / parcial]
- **Elemento determinante:** [o que foi decisivo para o resultado]

Se não houver: "Fontes não contêm jurisprudência. Pesquisa externa necessária antes da redação."

---

## 6. LACUNAS CRÍTICAS E RISCOS DE PERDA

**Lacunas probatórias:**
- [prova que deveria existir mas não está nas fontes]
- [fato nuclear não documentado]

**Pontos frágeis exploráveis pela defesa:**
- [argumento que a parte contrária provavelmente usará e que as fontes não neutralizam]

**Risco de improcedência:**
[Alta / Média / Baixa] — [justificativa objetiva em 2 linhas]

---

## 7. RECOMENDAÇÃO ESTRATÉGICA

**Prosseguir para petição?**
[ ] Sim — dossiê sustenta a redação
[ ] Sim, com ressalvas — ver lacunas críticas acima antes de peticionar
[ ] Não — resolver primeiro: [listar o que falta]

**Insumos validados para o legal-writer:**
- [lista do que está pronto para usar na petição]

**Ação imediata recomendada antes de peticionar (se houver):**
- [diligência / documento a buscar / prova a produzir]
```

---

## FASE 5 — Salvamento no Notebook

O dossiê é salvo como nota. **Não use `history --save`** — esse comando salva a conversa
com o NotebookLM, não o dossiê. Use `--save-as-note` com o conteúdo explícito.

**Onde salvar:**

| Modo | Onde salvar o dossiê |
|------|-----------------------|
| Single-notebook | No único notebook disponível |
| Dual-notebook | No **Notebook de Fatos** — é o notebook do caso específico. O Notebook Jurídico é compartilhado entre causas; não polua com dossiês individuais. |

```bash
# Garantir contexto no notebook correto antes de salvar
notebooklm use <notebook_fatos_id>

notebooklm ask "$(cat <<'EOF'
[NOTA DO ESCRITÓRIO — NÃO PROCESSAR COMO CONSULTA]

<conteúdo completo do dossiê aqui>
EOF
)" --save-as-note --note-title "Dossiê Pré-Peticionamento — [identificação do caso]"
```

Confirme o salvamento:
```bash
notebooklm source list --json   # verifica se a nota aparece como fonte
```

---

## FASE 6 — Relatório Final ao Advogado

Exiba **somente este bloco** na conversa — nunca o dossiê completo:

```
✅ Dossiê salvo no notebook: "Dossiê Pré-Peticionamento — [caso]"

📊 Resultado da investigação:
- Veredito da tese: [Alta / Parcial / Insustentável]
- Trechos citáveis extraídos: [N]
- Contradições entre fontes: [N encontradas / Nenhuma]
- Lacunas críticas: [N]
- Risco de improcedência: [Alto / Médio / Baixo]

[Se veredito = Insustentável]:
⚠️ A tese não encontra suporte suficiente nas fontes. Revisar antes de peticionar.

Deseja prosseguir para a redação com o legal-orchestrator?
```

Se o advogado confirmar prosseguimento, passe ao `legal-orchestrator`:
- Resumo dos fatos validados
- Tese (e eventuais ajustes recomendados)
- Insumos prontos listados no item 7 do dossiê
- Lacunas para o advogado preencher antes ou durante a redação

---

## Regras inegociáveis

1. **Nunca inventar trecho.** Só citar o que constar no campo `references` do `--json`. Se não há trecho, há lacuna.
2. **Risco antes de tudo.** A Fase 1 sempre executa antes das demais. Sem exceção.
3. **Máximo 6 queries no total.** No modo dual, as 2 queries de risco da Fase 1 fazem parte do budget.
4. **Não mostrar o dossiê na conversa.** Apenas o bloco de relatório final.
5. **Interromper se a tese for insustentável.** Não desperdice queries investigando uma tese morta.
6. **Não usar `history --save`.** Esse método não captura o dossiê — use `--save-as-note` com o conteúdo explícito.
7. **Notebook de Fatos vazio = parada imediata.** Notebook Jurídico vazio = registra lacuna e segue.
8. **Usar `-s <source_id>` quando a query é específica a uma fonte.** Reduz ruído, melhora resposta.
9. **No modo dual, sempre executar `notebooklm use <id>` antes de cada query.** Trocar de contexto sem confirmar é o erro mais comum — gera queries no notebook errado.
10. **Dossiê vai para o Notebook de Fatos, nunca para o Jurídico.** O notebook jurídico é base de conhecimento compartilhada; o dossiê é documento de caso.

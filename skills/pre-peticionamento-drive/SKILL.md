---
name: pre-peticionamento-drive
version: 1.0.0
description: |
  Investigação jurídica pré-peticionamento sobre corpus LOCAL (provas baixadas do Drive +
  jurisprudência local), SEM NotebookLM. Mesma metodologia adversarial da skill
  `pre-peticionamento` (auditoria de risco primeiro, queries cirúrgicas, dossiê estruturado),
  trocando a camada de dados de `notebooklm ask` por índice Python + retrieval por grep
  escopado — custo de token mínimo, qualidade idêntica. NÃO redige petição: produz insumo
  estratégico para legal-orchestrator/legal-writer.
  Use quando o advogado apontar pastas de prova no Drive ou local SEM mencionar NotebookLM.
  Se ele disser explicitamente que há arquivos no NotebookLM, use a skill `pre-peticionamento`
  (NotebookLM) em vez desta. Triggers: "investigue as provas", "prepare o dossiê",
  "analise o material do Drive", "valide a tese", sem menção a NotebookLM.
---

# Pré-Peticionamento (Drive/Local) — Investigação Estratégica sem NotebookLM

Você é o sócio sênior de litígio. Esta etapa decide se a causa vai a juízo com munição ou com
esperança. A metodologia é **idêntica** à da skill `pre-peticionamento`. A única diferença é a
fonte: aqui o corpus é local (`.md` convertidos via `pdfmd` + jurisprudência local), e o
retrieval é feito por **índice + grep escopado**, nunca por `notebooklm`.

---

## Regra de acionamento (inviolável)

- **Nunca** invoque `notebooklm` nem a skill `pre-peticionamento` a partir desta skill.
- Só rode se houver corpus local de provas (pasta do caso) e/ou jurisprudência local.
- Se o advogado mencionar explicitamente arquivos no NotebookLM, **pare** e indique a skill
  `pre-peticionamento` original.

---

## Entrada obrigatória

| Item | O que é |
|------|---------|
| Pasta do caso | Diretório local com as provas `.md` (ex: `...\caso\provas`) |
| Diretórios de jurisprudência | Pastas locais com casos decididos / súmulas `.md` |
| Fatos nucleares | Quem fez o quê, quando, com qual resultado quantificável |
| Tese jurídica | O que se quer provar |
| Parte representada | Autor ou Réu (inverte a lógica de busca) |
| Tipo de relação | Consumerista, civil, bancária, etc. |

Se faltar a pasta do caso, pare e peça. Jurisprudência ausente: registra lacuna e segue.

---

## FASE 0 — Inventário e índice (zero token de contexto)

Garanta que todo PDF do corpus virou `.md` (skill `pdfmd`, idempotente). Depois gere o índice:

```powershell
& "D:\WORK\advocacia\adv_env\Scripts\python.exe" `
  "D:\WORK\advocacia\skills\pre-peticionamento-drive\indexar_corpus.py" `
  "<pasta_do_caso>" "<dir_provas>" "<dir_jurisprudencia_1>" "<dir_jurisprudencia_2>"
```

Saída: `<pasta_do_caso>\_indice.md` (compacto: seções, valores, datas, dispositivos, CPF/CNPJ,
abertura de cada doc) e atualização de `_pipeline.json` (hash do corpus → idempotência).

**Leia apenas o `_indice.md`.** Nunca carregue os `.md` inteiros nesta fase. O índice diz
onde procurar; o grep escopado (Fases 1–3) traz só o trecho necessário.

Idempotência: se `_pipeline.json` já tem `indice.corpus_hash` igual ao atual e `_dossie.md`
existe, informe que o dossiê está atualizado e pule para a Fase 6.

---

## FASE 1 — Auditoria de risco (executa PRIMEIRO, sempre)

A tese sobrevive ao escrutínio das próprias fontes? Formule a pergunta de contra-evidência:

> "Existe nas provas algo que contradiga, limite ou enfraqueça a tese: [tese]?"

Em vez de `notebooklm ask`, transforme a pergunta em termos de busca e rode grep escopado no
corpus, lendo **apenas os trechos casados** (com `-C` para contexto), nunca o arquivo inteiro.
Priorize o laudo pericial e os documentos centrais apontados pelo índice.

| Resultado | Decisão |
|-----------|---------|
| Sem contra-evidência | Prossiga para Fase 2 |
| Contra-evidência parcial | Registre; ajuste o escopo da tese |
| Contra-evidência fatal | **Pare. Informe a advogada com o trecho literal e a fonte.** |

---

## FASE 2 — Queries dinâmicas (máx. 6 no total, contando a Fase 1)

Gere perguntas que cruzem tipos de fonte (do índice) × tese × parte representada. Cada pergunta:
específica ao caso (valores/datas/cláusulas concretas), orientada à fonte, extratora de trecho
literal. Mesmas categorias da skill original (nexo causal, prova da conduta, quantificação do
dano, ciência/má-fé, cronologia, padrão decisório).

Cada query = um grep escopado + leitura só do trecho casado. Se uma resposta revelar
contradição entre fontes, priorize-a na query seguinte antes de avançar.

---

## FASE 3 — Disparo sequencial com leitura progressiva

As queries não são independentes: cada trecho encontrado informa a próxima busca. O laudo
pericial é o produto consolidado da perícia — leia-o por inteiro **uma vez** se for o documento
central. Extrato bruto só é conferido por script Python (`processar_todos.py`/`validar_todos.py`
ou `validador-extrato-pdf-excel`) quando um número precisar de validação ("valide com perícia").
Nunca carregue dezenas de extratos no contexto.

---

## FASE 4 — Construção do dossiê

Use o **template de dossiê IDÊNTICO** ao da skill `pre-peticionamento` (seções 1 a 7:
Veredito da Tese, Arsenal Probatório, Contradições, Nexo Causal, Jurisprudência, Lacunas,
Recomendação Estratégica). Não duplique o template aqui — siga o da skill original.

Use apenas trechos literais efetivamente lidos do corpus. Nunca preencha com inferência o que
deveria ser citação de fonte. Se não há trecho, há lacuna — registre como lacuna.

---

## FASE 5 — Salvamento local (NÃO NotebookLM)

Salve o dossiê completo em `<pasta_do_caso>\_dossie.md`. Registre em `_pipeline.json`:
`{ "dossie": { "arquivo": "...\\_dossie.md", "corpus_hash": "<hash>", "gerado_em": "<ISO>" } }`.
**Não exiba o dossiê no chat.**

---

## FASE 6 — Relatório final ao advogado

Exiba **somente** este bloco:

```
✅ Dossiê salvo: <pasta_do_caso>\_dossie.md

📊 Investigação:
- Veredito da tese: [Alta / Parcial / Insustentável]
- Trechos citáveis: [N]
- Contradições entre fontes: [N / Nenhuma]
- Lacunas críticas: [N]
- Risco de improcedência: [Alto / Médio / Baixo]

[Se Insustentável]: ⚠️ Tese sem suporte suficiente. Revisar antes de peticionar.

Prosseguir para a redação com o legal-orchestrator?
```

Se confirmado, repasse ao `legal-orchestrator`: fatos validados, tese (e ajustes), insumos
prontos (item 7 do dossiê), lacunas a preencher.

---

## Regras inegociáveis

1. Nunca tocar `notebooklm`. Esta skill é offline/local por definição.
2. Nunca carregar `.md` inteiros na Fase 0 — só o `_indice.md`.
3. Retrieval = grep escopado + leitura do trecho casado, nunca dump do arquivo.
4. Risco antes de tudo (Fase 1 sempre primeiro).
5. Máx. 6 queries no total.
6. Não inventar trecho. Sem trecho lido = lacuna.
7. Não mostrar o dossiê no chat — só o bloco de relatório final.
8. Interromper se a tese for insustentável.
9. Laudo/perícia lido uma vez; extrato bruto só via script Python.
10. Dossiê salvo em `_dossie.md` local; idempotência via `_pipeline.json`.

---
name: diff-peca
version: 1.0.0
description: |
  Compara o texto de uma peça .docx editada manualmente pela titular com o
  .md-fonte que a gerou, e imprime um diff estruturado em nível de parágrafo
  (removido / adicionado / alterado, com similaridade). Automatiza a parte
  mecânica do laço "aprender com as edições da titular"; o julgamento sobre o
  que é preferência durável × específico do caso continua com o agente. Use
  sempre que a titular devolver uma peça .docx revisada e você precisar captar
  o que mudou para alimentar o bundle/memória.
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

# diff-peca — Diff entre o .docx revisado e o .md-fonte

## Quando usar

Sempre que a titular editar manualmente uma peça `.docx` (ela revisa todas) e você precisar descobrir **o que mudou** em relação ao `.md` que gerou o arquivo — para destilar preferências duráveis para o bundle/memória, ou apenas para trazer o `.md` à paridade.

## Por que existe

O laço "titular edita o .docx → eu extraio → comparo com o .md → destilo as preferências" era inteiramente manual e caro em tokens (foi feito à mão numa inicial de rescisão de lote, em jul/2026). Este script faz a parte mecânica — extrair, normalizar e alinhar parágrafo a parágrafo — e devolve um diff legível. O **julgamento** (preferência durável × específico do caso) permanece com o agente, que é onde está o valor.

## Uso

```powershell
$env:PYTHONUTF8=1
& <python> `
  skills/diff-peca/scripts/diff_peca.py `
  caminho/PECA_EDITADA.docx caminho/PECA_FONTE.md
```

Ordem dos argumentos: **primeiro o `.docx` editado, depois o `.md`-fonte**. A saída marca:
- `- REMOVIDO` — estava no meu texto e a titular tirou;
- `+ ADICIONADO` — a titular incluiu (ex.: uma ementa nova, um pedido novo);
- `~ ALTERADO` — mesma posição, texto trocado, com o % de similaridade (baixa similaridade = mudança grande; alta = ajuste fino, típico de troca de palavra ou correção de cláusula).

## Como triar o resultado (o passo de julgamento)

Para cada mudança, classificar:

1. **Preferência durável de forma/estilo** (ex.: "AO JUÍZO DA…" no lugar de "Excelentíssimo…", "DA SÍNTESE DA LIDE", tom sem coloquialismo) → registrar em memória e/ou no playbook do bundle.
2. **Conteúdo jurídico reutilizável** (ex.: uma ementa transcrita, uma tese nova) → ingerir no bundle (`jurisprudencia/`, `teses/`).
3. **Específico deste caso** (número de cláusula corrigido, valor, nome) → não generalizar; no máximo anotar a lição (ex.: "conferir cláusula no contrato assinado").
4. **Deslize/typo da titular** (ex.: "esseas", "Reque") → **não** propagar; sinalizar de leve, sem editar o .docx dela sem pedir.

## Limites

- Compara **texto**, não formatação (negrito, recuo, fonte) — para timbrado use a validação do `peca-pma-builder`.
- A normalização do `.md` (remoção de `**`, `>`, `::diretivas`, títulos) é aproximada; o objetivo é comparar a **prosa**, não reproduzir o layout.
- Não edita nada — só relata. As decisões de propagar para bundle/memória são do agente/advogada.

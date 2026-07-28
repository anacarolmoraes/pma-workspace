---
name: validador-extrato-pdf-excel
description: Valida e corrige arquivos Excel gerados a partir de PDFs de extratos bancários. Use esta skill quando o usuário precisar verificar se um Excel de extrato bancário está correto comparado ao PDF original, normalizar dados de diferentes bancos (BRB, Banco PAN, Banco do Brasil), unificar múltiplas abas do Excel, ou detectar e corrigir inconsistências. A skill usa o PDF como fonte da verdade e otimiza o uso de LLM com cache e heurísticas.
---

# Validador Extrato PDF-Excel

Skill para validação e correção de arquivos Excel gerados a partir de PDFs de extratos bancários.

## Quando Usar

Use esta skill quando o usuário:
- Precisa validar se o Excel extraído do PDF está correto
- Quer normalizar dados de extratos bancários de diferentes bancos
- Precisa unificar múltiplas abas do Excel em uma única
- Precisa detectar e corrigir inconsistências entre PDF e Excel

## Arquitetura

A skill é composta por 9 módulos:

```
validador-extrato-pdf-excel/
├── loader.py          # Carrega PDF e Excel
├── unificador.py      # Une múltiplas abas
├── detector_banco.py  # Identifica tipo de banco
├── normalizador.py    # Normaliza dados
├── parser_pdf.py      # Extrai dados do PDF
├── validador.py        # Compara Excel com PDF
├── corretor_llm.py     # Corrige usando LLM (otimizado)
├── reconciliador.py   # Aplica correções
├── exporter.py        # Salva resultado
└── main.py            # Orquestrador principal
```

## Bancos Suportados

| Banco | Colunas Esperadas |
|-------|------------------|
| **BRB** | data, historico, valor |
| **BANCO_PAN** | data, numero_operacao, tipo_operacao, valor, saldo |
| **BANCO_DO_BRASIL** | data, lote, documento, historico, valor |

## Uso via CLI

```bash
python main.py <pdf_path> <excel_path> <output_path> [--llm] [--api-key <key>]
```

**Exemplo:**
```bash
python main.py extrato.pdf extrato.xlsx resultado.xlsx
```

## Uso via Código

```python
from main import validar_extrato

resultado = validar_extrato(
    pdf_path='extrato.pdf',
    excel_path='extrato.xlsx',
    output_path='resultado.xlsx',
    usar_llm=False  # Sem LLM por padrão
)

print(resultado['mensagem'])
print(f"Score: {resultado['metricas']['score_confianca']}%")
```

## Saída

A skill gera:
- **Excel corrigido**: Arquivo com uma única aba e colunas padronizadas
- **Log de auditoria**: Arquivo `_log.txt` com detalhes das correções
- **Relatório final**: Resumo das métricas do processo

## Otimização de Tokens

A skill implementa as seguintes otimizações:

1. **Cache baseado em hash**: Evita chamadas repetidas ao LLM
2. **Processamento em batches**: Máximo 10 linhas por chamada
3. **Fallback para heurística**: Usa regras simples antes de chamar LLM
4. **Apenas linhas problemáticas**: Envia só o necessário para LLM

## Diferenciais

- Reconstrução de linhas quebradas entre páginas
- Remoção automática de cabeçalhos repetidos
- Tratamento de valores com vírgula e sinal (+/-)
- Score de confiança por linha
- Suporte a CLI
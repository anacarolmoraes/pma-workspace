# IA Context - Advocacia PMA

Este arquivo define o contexto de execução, ambiente técnico e protocolos de operação do workspace.

> **⚠️ OBRIGATÓRIO:** Para regras de estilo, tom de voz e perfil da advogada, **LEIA `USER.md`**. O `USER.md` é a autoridade máxima em comunicação.

## 🐍 Ambiente Python

**REGRA OBRIGATÓRIA:** Toda execução de scripts Python neste projeto deve utilizar o ambiente virtual localizado em:
`D:\WORK\advocacia\adv_env`

### Comandos de Ativação

- **PowerShell:**

  ```powershell
  & "D:\WORK\advocacia\adv_env\Scripts\Activate.ps1"
  ```

- **Command Prompt (cmd):**

  ```cmd
  D:\WORK\advocacia\adv_env\Scripts\activate.bat
  ```

### Bibliotecas e Dependências

O ambiente `adv_env` contém as dependências necessárias para:

- Processamento de PDFs e Excel (pandas, openpyxl, pdfplumber).
- Integração com Google Drive API (google-api-python-client).
- Transcrição de áudio (openai-whisper).
- Automação de navegador (agent-browser/browser-use).

## 🛠️ Ferramentas e Diretórios Críticos

1. **Skills Jurídicas (`D:\WORK\advocacia\skills`):** **MANDATÓRIO.** Sempre procure uma skill (ex: `tipografia-pma`, `legal-orchestrator`, `pdfmd`) antes de criar scripts ou abordagens do zero.
2. **Tipografia:** Padrão PMA (**Montserrat 12pt**, entrelinhas 1.5). Consulte a skill `tipografia-pma`.
3. **NotebookLM:** Base primária de conhecimento jurídico.
4. **Outros:** `.agent/` (workflows), `scratch/` (testes), `direto_bancario/` (automação bancária).

## ☁️ Integração Google Workspace (CLI)

A ferramenta **Google Workspace CLI (`gws`)** está instalada globalmente. Utilize-a para gerenciar arquivos no Drive, Planilhas, Gmail e outros serviços diretamente via terminal.

- **Configuração:** Localizada em `C:\Users\anamo\.config\gws`.
- **Uso:** Comando `gws <serviço> <método>` (ex: `gws drive files list`).
- **Autenticação:** Gerenciada pela CLI; qualquer agente pode invocar os comandos se o token estiver válido.

## 📋 Protocolos de Operação

1. **Tratamento de PDF:** Verifique se há o `.md` correspondente. Se não, use a skill `pdfmd` para converter antes de ler.
2. **Socratic Gate:** Em tarefas complexas, pare e pergunte. Nunca presuma fatos (consulte NotebookLM ou transcrições).
3. **Eficiência (Tokens):** Economize tokens com precisão. Respostas concisas, sem redundâncias, com altíssima qualidade técnica.

# Instruções para Geração de Relatórios

## Regra Geral

Quando eu pedir um relatório, SEMPRE gere **dois arquivos**:

### 1. Fonte Markdown (`.md`) — para consumo por IA

- Caminho: `./relatorios/{data}_{slug}.md`
- Tabelas em Markdown padrão (pipes `|`)
- Metadados YAML frontmatter: título, data, processo, cliente, autor
- Seções com headings `##` hierárquicos
- Referências normativas com citação completa (lei, artigo, inciso)
- Este arquivo é a **fonte de verdade** — o DOCX é derivado dele

### 2. Documento Word (`.docx`) — para o juiz

- Caminho: `./relatorios/{data}_{slug}.docx`
- Usar `docx` (npm) via Node.js
- Papel A4 (padrão brasileiro judicial)
- Fonte: Times New Roman 12pt, espaçamento 1,5
- Margens: superior 3cm, inferior 2cm, esquerda 3cm, direita 2cm (ABNT NBR 14724)
- Tabelas com:
  - Bordas finas cinza (#CCCCCC)
  - Cabeçalho com fundo cinza  (#3d4241) e texto branco
  - Zebra-striping nas linhas (alternando branco e laranja (#eb8305)
  - Padding interno confortável (80/120 DXA)
  - Largura total da página (content width)
- Rodapé: número da página centralizado
- Headings: negrito, hierárquicos, com numeração (1., 1.1., 1.1.1.)
- Parágrafos justificados, recuo de primeira linha 1,25cm

### Estrutura padrão de um relatório jurídico

```


1. SÍNTESE FÁTICA
   - Resumo cronológico dos fatos relevantes

2. ANÁLISE JURÍDICA
   - Fundamentação com doutrina, jurisprudência e legislação
   - Tabelas comparativas quando houver múltiplos cenários/argumentos
4. QUADRO-RESUMO (tabela)
   - Ponto | Situação Atual | Fundamento | Risco/Oportunidade
4. CONCLUSÃO E RECOMENDAÇÕES
   - Encaminhamentos sugeridos com prazo e prioridade
5. REFERÊNCIAS NORMATIVAS
   - Lista de leis, súmulas e precedentes citados
```

### Convenções de nomenclatura

- Data no formato ISO: `2026-05-16`
- Slug descritivo em kebab-case: `analise-fraude-execucao`
- Exemplo: `2026-05-16_analise-fraude-execucao.md` / `.docx`

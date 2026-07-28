# IA Context - Advocacia PMA

Este arquivo define o contexto de execução, ambiente técnico e protocolos de operação do workspace.

> **⚠️ OBRIGATÓRIO:** Para regras de estilo e tom de voz, **LEIA `USER.md`** (padrão do escritório) e `perfil/usuario.md` (a pessoa nesta máquina). O `USER.md` é a autoridade máxima em comunicação.

O workspace roda em **Windows e macOS**. Tudo é montado por `node scripts/setup.js`.

## 🐍 Ambiente Python

**REGRA OBRIGATÓRIA:** todo script Python roda pelo interpretador declarado em
`perfil/ambiente.json` → chave `python`. Nunca o Python do sistema, e **nunca com o caminho
escrito à mão** — ele muda de máquina e de sistema operacional.

```powershell
# Windows
$py = (Get-Content perfil\ambiente.json -Raw | ConvertFrom-Json).python
& $py script.py
```

```bash
# macOS
py=$(node -p "require('./perfil/ambiente.json').python")
"$py" script.py
```

Não é preciso "ativar" o ambiente: chamar o interpretador pelo caminho completo já usa as
bibliotecas certas. Se `perfil/ambiente.json` não existir, a instalação não terminou — rodar
`node scripts/setup.js`.

### Bibliotecas e Dependências

Declaradas em `requirements.txt` (Python) e `package.json` (Node) — essas são as listas
verdadeiras; qualquer outra menção neste repositório é resumo e pode estar desatualizada.
Cobrem: leitura de PDF (pdfplumber, PyMuPDF), Excel (openpyxl), `.docx` (python-docx),
transcrição de áudio (faster-whisper), automação de navegador (playwright) e OCR (pytesseract,
que depende do programa Tesseract instalado no sistema).

O conversor `pdfmd` vive **dentro do `adv_env`**; o código-fonte está em `vendor/pdfmd/`.

## 🛠️ Ferramentas e Diretórios Críticos

1. **Skills Jurídicas (`skills/`):** **MANDATÓRIO.** Sempre procure uma skill (ex: `tipografia-pma`, `legal-orchestrator`, `pdfmd`) antes de criar scripts ou abordagens do zero.
2. **Tipografia:** Padrão PMA (**Montserrat 12pt**, entrelinhas 1.5). Consulte a skill `tipografia-pma`.
3. **NotebookLM:** Base primária de conhecimento jurídico.
4. **Outros:** `scratch/` (testes, fora do versionamento), `clientes/` (documento de caso — **nunca** versionado).
5. **Acervo jurídico (`arsenal-juridico`):** repositório separado, caminho em `perfil/ambiente.json` → `bundles`.

## ☁️ Integração Google Workspace (CLI)

A ferramenta **Google Workspace CLI (`gws`)** está instalada globalmente. Utilize-a para gerenciar arquivos no Drive, Planilhas, Gmail e outros serviços diretamente via terminal.

- **Configuração:** na pasta pessoal do usuário (`~/.config/gws`). É credencial: **nunca** ler nem despejar no contexto.
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

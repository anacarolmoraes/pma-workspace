---
name: pdfmd
description: Use esta skill para converter arquivos PDF em Markdown utilizando a ferramenta pdfmd local. Esta skill é otimizada para documentos jurídicos brasileiros, preservando tabelas e estrutura. Use-a sempre que precisar transformar PDFs em texto estruturado (.md) para análise, peticionamento ou alimentação de bases de conhecimento.
---

# PDF to Markdown (pdfmd) - Manual de Operação

Esta skill gerencia a conversão de documentos PDF para Markdown de alta qualidade, operando localmente para garantir a privacidade dos dados do escritório.

## 🎯 Quando Acionar
- O usuário solicita a conversão de um ou mais arquivos PDF para Markdown.
- Você identifica a necessidade de extrair texto de um PDF digitalizado (OCR) ou com tabelas complexas.
- Sempre que houver uma pasta com PDFs e for solicitado o processamento dos mesmos.

## 📜 Regras de Execução

1. **Idioma:** Sempre utilize o idioma português (`--lang por`).
2. **Localização:** Os arquivos `.md` devem ser gerados na mesma pasta do PDF original.
3. **Idempotência e Qualidade (Verificação Prévia):** 
   - Verifique se já existe um arquivo `.md` correspondente.
   - Se o `.md` existir, verifique sua integridade (tamanho > 1KB e conteúdo legível).
   - Se o arquivo estiver vazio, corrompido ou contiver apenas caracteres de controle (ex: `--- ---`), proceda com a re-conversão forçada.
4. **Verificação de Integridade Pós-Conversão (MANDATÓRIO):**
   - Após a execução com `--ocr auto`, verifique o arquivo gerado.
   - Se o arquivo resultante for pequeno (< 1KB) ou parecer mal-formatado/vazio, **delete o arquivo** e execute novamente utilizando `--ocr tesseract`.
   - Informe ao usuário: "A conversão automática falhou/foi insuficiente. Acionando OCR Tesseract para garantir integridade."
5. **Processamento em Lote:** Se o usuário não especificar um arquivo, liste todos os PDFs da pasta e converta aqueles que faltam ou estão corrompidos.
6. **Economia de Tokens:** 
   - Use o comando CLI para delegar a tarefa.
   - Informe o resultado final de forma concisa.

## 💻 Comandos Técnicos

O `pdfmd` vive dentro do ambiente `adv_env` (não tem mais ambiente próprio). O caminho do
interpretador está em [`perfil/ambiente.json`](../../perfil/ambiente.json) → chave `python`,
gerado pelo `scripts/setup.js`. **Nunca escrever o caminho na mão** — ele muda de máquina e
entre Windows e macOS. Se o arquivo não existir, rodar `node scripts/setup.js`.

`PYTHONUTF8=1` é obrigatório no Windows: sem ele o pdfmd quebra em acento.

### Comando padrão (tentativa 1)

```powershell
# Windows
$py = (Get-Content perfil\ambiente.json -Raw | ConvertFrom-Json).python
$env:PYTHONUTF8 = '1'
& $py -m pdfmd.cli "<caminho_do_pdf>" --ocr auto --lang por --page-breaks
```

```bash
# macOS
py=$(node -p "require('./perfil/ambiente.json').python")
PYTHONUTF8=1 "$py" -m pdfmd.cli "<caminho_do_pdf>" --ocr auto --lang por --page-breaks
```

### Comando de fallback (caso falhe ou seja imagem/digitalizado)

Mesmo comando, trocando `--ocr auto` por `--ocr tesseract`. Depende do programa Tesseract
instalado no sistema — o `setup.js` avisa se estiver faltando.

## 🛠️ Exemplo de Fluxo

1. Listar os PDFs da pasta do caso
2. Para cada PDF, verificar se o `.md` existe e é válido.
3. Se inválido/ausente, rodar `pdfmd --ocr auto`.
4. **Checar saída:** Se `.md` resultante < 1KB ou ilegível, rodar `pdfmd --ocr tesseract`.
5. Reportar resultado final.

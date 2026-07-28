---
name: heic-converter
description: Converte imagens HEIC/HEIF (formato padrão de prints e fotos de iPhone) em JPG legíveis e aptas a protocolo judicial, em lote e localmente. Use sempre que a pasta de um caso tiver arquivos .HEIC/.HEIF — o Read/visão não abre HEIC diretamente, e tribunais costumam exigir JPG/PDF. Triggers: "converter heic", "imagens do iphone", ".HEIC", "prints não abrem".
---

# heic-converter — HEIC/HEIF para JPG (lote, local)

## Quando usar
- A pasta do caso contém prints/fotos `.HEIC` ou `.HEIF` (clientes de iPhone).
- Você precisa **ler/analisar** as imagens (a ferramenta de visão não abre HEIC) ou **anexá-las** ao processo (PJe/e-SAJ pedem JPG/PDF).

## Por que existe
HEIC é o formato nativo do iPhone e recorre em quase todo caso com prova fotográfica. Antes desta skill, a conversão era feita com comandos `ffmpeg` ad hoc, repetidos e descartados a cada caso — desperdício de tokens e risco de nomes ilegíveis (`ev01.jpg`). Aqui a conversão é um script único, determinístico e local.

## Como usar

Ambiente: o script só depende do **ffmpeg** (já no PATH). Não precisa de pip install.

```bash
# converte todos os HEIC/HEIF da pasta -> <pasta>/_jpg (nomes saneados, sem acento)
"D:/WORK/advocacia/adv_env/Scripts/python.exe" "D:/WORK/advocacia/skills/heic-converter/converter.py" "CAMINHO/DA/PASTA"

# um arquivo só, ou saída custom, ou ao lado do original:
python converter.py "foto.HEIC"
python converter.py ./PROVAS --out ./jpgs
python converter.py . --inplace
```

## Comportamento
- Acha `*.heic`/`*.heif` (maiúsc./minúsc.), converte com `ffmpeg -frames:v 1 -q:v 2` (alta qualidade).
- **Saneia o nome** preservando o original: remove acentos, troca espaços/símbolos por `_`. "Painel recusa.HEIC" -> `Painel_recusa.jpg`.
- **Idempotente:** pula o que já foi convertido e está atualizado.
- Saída padrão em `_jpg/` (subpasta), para não poluir a pasta de provas.

## Limites
- Não faz OCR (para texto em PDF use `pdfmd`).
- Para anexar ao processo, o JPG já basta; se precisar de PDF único, agrupe depois.

---
name: whisper-transcriber
description: Transcreve arquivos de áudio (ogg, mp3, mp4) em texto usando Whisper. Use para converter áudios de reuniões, podcasts, vídeos em texto pesquisável.
---

# Whisper Audio Transcriber

Transcreve áudio em texto usando OpenAI Whisper (não LLM).

## Formatos Suportados

- `.mp3`
- `.mp4`
- `.ogg`
- `.wav`
- `.m4a`

## Usage

```
/whisper path/to/audio.mp3
```

## Argumentos

- `audio_path`: Caminho do arquivo de áudio (obrigatório)

## Opções

- `--model`: Modelo Whisper (`tiny`, `base`, `small`, `medium`, `large`). Default: `base`
- `--language`: Idioma (`pt`, `en`, `es`, etc.). Default: `pt` (português)
- `--output`: Arquivo de saída (opcional)

## Output

Retorna texto transcrito. Se saída especificada, salva em arquivo.

---

## Installation

```bash
pip install openai-whisper
```

Requer ffmpeg no sistema:
- Windows: `choco install ffmpeg`
- Mac: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`
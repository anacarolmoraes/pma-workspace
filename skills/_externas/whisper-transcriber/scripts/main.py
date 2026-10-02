import argparse
import os
import sys
import time

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("Erro: faster-whisper não instalado.")
    sys.exit(1)

def format_seconds(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def transcribe_audio(audio_path, model_name="large-v3", language="pt", output_file=None):
    if not os.path.exists(audio_path):
        return {"error": f"Arquivo não encontrado: {audio_path}", "type": "validation"}

    supported_formats = [".mp3", ".mp4", ".ogg", ".wav", ".m4a"]
    ext = os.path.splitext(audio_path)[1].lower()
    if ext not in supported_formats:
        return {"error": f"Formato não suportado: {ext}", "type": "validation"}

    # Try CUDA, fallback to CPU
    try:
        print(f"Tentando carregar modelo {model_name} em CUDA...")
        model = WhisperModel(model_name, device="cuda", compute_type="float16")
        device_used = "cuda"
    except Exception as e:
        print(f"CUDA não disponível ou erro: {e}. Usando CPU...")
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        device_used = "cpu"
    
    print(f"Iniciando transcrição usando {device_used}...")
    start_time = time.time()

    try:
        # Transcribe
        segments, info = model.transcribe(
            audio_path, 
            language=language, 
            beam_size=5,
            initial_prompt="Transcrição de depoimento judicial. Linguagem formal e clara. Nome da depoente: Ana Carolina Ribeiro."
        )
        
        full_text = []
        md_lines = []
        filename = os.path.basename(audio_path)
        md_lines.append(f"# Transcrição: {filename}\n")
        md_lines.append(f"- **Arquivo:** `{filename}`")
        md_lines.append(f"- **Modelo Whisper:** `{model_name}`")
        md_lines.append(f"- **Idioma:** `{language}`\n")
        md_lines.append("---\n")
        
        for segment in segments:
            timestamp = f"[{segment.start:.2f}s -> {segment.end:.2f}s]"
            print(f"{timestamp} {segment.text}")
            full_text.append(segment.text)
            
            start_fmt = format_seconds(segment.start)
            end_fmt = format_seconds(segment.end)
            md_lines.append(f"**[{start_fmt} -> {end_fmt}]** {segment.text.strip()}\n")
        
        text = " ".join(full_text)
        duration = time.time() - start_time
        print(f"Transcrição concluída em {duration:.2f}s.")

        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                if output_file.endswith(".md"):
                    f.write("\n".join(md_lines))
                else:
                    f.write(text)
            return {"success": True, "text": text, "output_file": output_file}

        return {"success": True, "text": text}

    except Exception as e:
        return {"error": str(e), "type": "execution"}

def main():
    parser = argparse.ArgumentParser(description="Transcreve áudio com Whisper (Otimizado)")
    parser.add_argument("audio_path", help="Caminho do arquivo de áudio")
    parser.add_argument("--model", default="large-v3", help="Modelo Whisper")
    parser.add_argument("--language", default="pt", help="Idioma")
    parser.add_argument("--output", help="Arquivo de saída")

    args = parser.parse_args()

    result = transcribe_audio(
        audio_path=args.audio_path,
        model_name=args.model,
        language=args.language,
        output_file=args.output
    )

    if "error" in result:
        print(f"Erro: {result['error']}", file=sys.stderr)
        sys.exit(1)

    if not args.output:
        print("\n--- TEXTO COMPLETO ---\n")
        print(result["text"])

if __name__ == "__main__":
    main()
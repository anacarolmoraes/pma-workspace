#!/usr/bin/env python3
"""Converte imagens HEIC/HEIF (padrão iPhone) em JPG legíveis e aptas a protocolo.

Usa ffmpeg (já no PATH do ambiente). Não exige pip install.
- Nomes são desacentuados e saneados (espaços/símbolos -> _), preservando o nome original.
- Saída, por padrão, em <pasta>/_jpg. Pula arquivos já convertidos e atualizados.

Uso:
  python converter.py [PASTA_OU_ARQUIVO] [--out DIR] [--inplace] [--quality 2]

Exemplos:
  python converter.py .                      # converte a pasta atual -> ./_jpg
  python converter.py ./PROVAS --out ./jpgs  # saída custom
  python converter.py foto.HEIC              # um arquivo só
"""
import argparse, os, re, shutil, subprocess, sys, unicodedata
from glob import glob

EXTS = (".heic", ".heif")

def sanitize(stem: str) -> str:
    s = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s).strip("_")
    s = re.sub(r"_+", "_", s)
    return s or "img"

def find_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("ERRO: ffmpeg não encontrado no PATH.")
    return exe

def collect(target: str):
    if os.path.isfile(target):
        return [target], os.path.dirname(os.path.abspath(target)) or "."
    files = []
    for e in EXTS:
        files += glob(os.path.join(target, f"*{e}"))
        files += glob(os.path.join(target, f"*{e.upper()}"))
    return sorted(set(files)), target

def main():
    ap = argparse.ArgumentParser(description="Converte HEIC/HEIF -> JPG via ffmpeg.")
    ap.add_argument("target", nargs="?", default=".", help="pasta ou arquivo (default: .)")
    ap.add_argument("--out", help="pasta de saída (default: <pasta>/_jpg)")
    ap.add_argument("--inplace", action="store_true", help="grava o JPG ao lado do original")
    ap.add_argument("--quality", default="2", help="qualidade ffmpeg -q:v (2=alta, 31=baixa)")
    a = ap.parse_args()

    ff = find_ffmpeg()
    files, base = collect(a.target)
    if not files:
        print("Nenhum HEIC/HEIF encontrado em:", a.target); return

    outdir = (os.path.dirname(files[0]) if a.inplace else (a.out or os.path.join(base, "_jpg")))
    os.makedirs(outdir, exist_ok=True)

    ok = skip = fail = 0
    for f in files:
        stem = sanitize(os.path.splitext(os.path.basename(f))[0])
        out = os.path.join(outdir, stem + ".jpg")
        if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(f):
            skip += 1; continue
        r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", f,
                            "-frames:v", "1", "-q:v", str(a.quality), out],
                           capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0:
            ok += 1; print("OK  ", os.path.basename(f), "->", os.path.basename(out))
        else:
            fail += 1; print("FALHA", os.path.basename(f), r.stderr.strip()[:160])
    print(f"\nResumo: {ok} convertidos, {skip} já existiam, {fail} falhas. Saída: {outdir}")

if __name__ == "__main__":
    main()

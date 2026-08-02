# /// script
# dependencies = ["yt-dlp"]
# ///
"""Baixa transcricoes de um canal do YouTube de forma INCREMENTAL (yt-dlp).

Adaptado de cole-medin-knowledge-base (channel-to-kb-ytdlp). Diferencas:
  - legendas em portugues (pt, pt-BR, pt-PT), nao ingles;
  - slugs sem acento;
  - INCREMENTAL: o manifest.json do diretorio de saida e o livro-razao.
    Video ja consumido (ou ja tentado e sem legenda) NUNCA e baixado de novo,
    mesmo que se peca o canal inteiro outra vez. A chave e o youtube_id
    (estavel), nao o titulo/slug.

Uso:
    uv run fetch_transcripts.py @Canal --output-dir D:/GITHUB/kb-youtube/<canal>/raw
    uv run fetch_transcripts.py @Canal --limit 5 ...       # so os 5 mais recentes
    uv run fetch_transcripts.py @Canal --tentar-sem-legenda # re-tenta os pulados
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import yt_dlp

# console do Windows (cp1252) nao decodifica todo titulo do YouTube (ex.: zero-width
# non-joiner U+200C); sem isso o script derruba no meio de um fetch longo.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(errors="replace")


def slugify(title: str) -> str:
    # remove acentos antes de filtrar (senao "rescisão" vira "resciso")
    slug = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-")


def format_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02d}:{s:02d}"


def format_duration(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def normalize_channel_url(channel: str) -> str:
    if channel.startswith("http"):
        return channel
    handle = channel if channel.startswith("@") else f"@{channel}"
    return f"https://www.youtube.com/{handle}/videos"


def parse_json3(data: dict) -> list[dict]:
    segments = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue
        segments.append({
            "start": event.get("tStartMs", 0) / 1000.0,
            "duration": event.get("dDurationMs", 0) / 1000.0,
            "text": text,
        })
    return segments


def group_into_paragraphs(segments, target_words=50):
    paragraphs = []
    buf, start, wc = [], None, 0
    for seg in segments:
        if start is None:
            start = seg["start"]
        buf.append(seg["text"])
        wc += len(seg["text"].split())
        if wc >= target_words:
            paragraphs.append({"start": start, "text": " ".join(buf).strip()})
            buf, start, wc = [], None, 0
    if buf:
        paragraphs.append({"start": start, "text": " ".join(buf).strip()})
    return paragraphs


def load_manifest(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"channel": "", "videos": [], "skipped_videos": []}


def main():
    ap = argparse.ArgumentParser(description="Fetch incremental de transcricoes (yt-dlp, legendas pt)")
    ap.add_argument("channel", help="URL do canal ou @handle")
    ap.add_argument("--output-dir", default="./raw", help="destino dos raw/*.md (default: ./raw)")
    ap.add_argument("--limit", type=int, default=None, help="enumerar so os N videos mais recentes")
    ap.add_argument("--delay", type=float, default=2.0, help="pausa entre requisicoes (default: 2.0s)")
    ap.add_argument("--tentar-sem-legenda", action="store_true",
                    help="re-tentar videos antes pulados por falta de legenda (unico jeito de reprocessa-los)")
    ap.add_argument("--lang", default="pt,pt-BR,pt-PT",
                    help="codigos de legenda, separados por virgula (default: pt,pt-BR,pt-PT; ex.: --lang en,en-US)")
    args = ap.parse_args()

    langs = [c.strip() for c in args.lang.split(",") if c.strip()]
    lang_principal = langs[0].split("-")[0]  # "pt-BR" -> "pt" p/ metadados

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "manifest.json"

    # ---- livro-razao: o que ja foi consumido nao volta ----
    manifest = load_manifest(manifest_path)
    fetched_ids = {v["youtube_id"] for v in manifest["videos"]}
    skipped_ids = {s["id"] for s in manifest["skipped_videos"]}
    known_ids = fetched_ids | (set() if args.tentar_sem_legenda else skipped_ids)
    used_slugs = {v["slug"] for v in manifest["videos"]} | {p.stem for p in out.glob("*.md")}

    tmp_subs = out / ".subs_tmp"
    tmp_subs.mkdir(exist_ok=True)

    url = normalize_channel_url(args.channel)

    print(f"Enumerando videos de {url} ...")
    # lang na lingua do canal: sem isso o YouTube devolve titulo/metadata auto-traduzidos
    enum_opts = {"extract_flat": True, "quiet": True,
                 "extractor_args": {"youtube": {"lang": [lang_principal]},
                                    "youtubetab": {"lang": [lang_principal]}}}
    if args.limit:
        enum_opts["playlistend"] = args.limit

    with yt_dlp.YoutubeDL(enum_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    entries = [e for e in (info or {}).get("entries", []) if e]
    if not entries:
        print("Nenhum video encontrado. Confira a URL do canal.", file=sys.stderr)
        sys.exit(1)

    novos = [e for e in entries if e["id"] not in known_ids]
    ja_consumidos = len(entries) - len(novos)
    print(f"Encontrados {len(entries)} videos: {ja_consumidos} ja consumidos (pulados), {len(novos)} novos\n")

    if not novos:
        print("Nada novo a consumir. Livro-razao intacto: " + str(manifest_path))
        for f in tmp_subs.iterdir():
            f.unlink()
        tmp_subs.rmdir()
        return

    hoje = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    novos_ok = []
    novos_pulados = []

    for i, entry in enumerate(novos):
        vid_id = entry["id"]
        title = entry.get("title", vid_id)
        upload_date = entry.get("upload_date", "")

        slug = slugify(title) or vid_id
        if slug in used_slugs:
            n = 2
            while f"{slug}-{n}" in used_slugs:
                n += 1
            slug = f"{slug}-{n}"
        used_slugs.add(slug)

        print(f"[{i + 1}/{len(novos)}] {title}")

        sub_opts = {
            "skip_download": True,
            "writeautomaticsub": True,
            "writesubtitles": True,
            "subtitleslangs": langs,
            "subtitlesformat": "json3",
            "outtmpl": str(tmp_subs / f"{vid_id}.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "ignoreerrors": True,
            "extractor_args": {"youtube": {"lang": [lang_principal]}},
        }

        try:
            with yt_dlp.YoutubeDL(sub_opts) as ydl:
                meta = ydl.extract_info(f"https://www.youtube.com/watch?v={vid_id}", download=True)

            sub_file = next(tmp_subs.glob(f"{vid_id}*.json3"), None)
            if not sub_file or not sub_file.exists():
                novos_pulados.append({"id": vid_id, "title": title, "reason": f"sem legenda {args.lang}", "tried_at": hoje})
                print(f"  -> PULADO (sem legenda {args.lang})")
                time.sleep(args.delay)
                continue

            segments = parse_json3(json.loads(sub_file.read_text(encoding="utf-8")))
            paragraphs = group_into_paragraphs(segments)
            sub_file.unlink()

            duration_sec = (meta or {}).get("duration", 0)
            duration = format_duration(duration_sec) if duration_sec else ""

            published = ""
            if upload_date and len(upload_date) == 8:
                published = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
            elif meta and meta.get("upload_date"):
                ud = meta["upload_date"]
                published = f"{ud[:4]}-{ud[4:6]}-{ud[6:8]}"

            safe_title = title.replace('"', '\\"')
            md = f"""---
type: raw-transcript
title: "{safe_title}"
youtube_id: {vid_id}
url: https://www.youtube.com/watch?v={vid_id}
slug: {slug}
published: "{published}"
duration: "{duration}"
fetched_at: {hoje}
immutable: true
---

## Transcript

"""
            for p in paragraphs:
                md += f"**[{format_ts(p['start'])}]** {p['text']}\n\n"

            (out / f"{slug}.md").write_text(md, encoding="utf-8")

            novos_ok.append({
                "slug": slug,
                "title": title,
                "youtube_id": vid_id,
                "url": f"https://www.youtube.com/watch?v={vid_id}",
                "published": published,
                "duration": duration,
                "segments": len(segments),
                "paragraphs": len(paragraphs),
                "fetched_at": hoje,
            })
            print(f"  -> {slug}.md ({len(paragraphs)} paragrafos)")

        except Exception as e:
            novos_pulados.append({"id": vid_id, "title": title, "reason": str(e), "tried_at": hoje})
            print(f"  -> ERRO: {e}")

        time.sleep(args.delay)

    for f in tmp_subs.iterdir():
        f.unlink()
    tmp_subs.rmdir()

    # ---- merge no livro-razao (nunca sobrescreve o historico) ----
    resgatados = {v["youtube_id"] for v in novos_ok}
    manifest["channel"] = url
    manifest["updated_at"] = hoje
    manifest["videos"] = manifest["videos"] + novos_ok
    manifest["skipped_videos"] = [
        s for s in manifest["skipped_videos"] if s["id"] not in resgatados
    ] + novos_pulados
    manifest["transcripts_fetched"] = len(manifest["videos"])
    manifest["skipped"] = len(manifest["skipped_videos"])
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nFeito: +{len(novos_ok)} transcricoes novas -> {out}/ (total no razao: {len(manifest['videos'])})")
    if novos_pulados:
        print(f"Pulados agora: {len(novos_pulados)} (registrados no manifest; nao serao re-tentados sem --tentar-sem-legenda)")


if __name__ == "__main__":
    main()

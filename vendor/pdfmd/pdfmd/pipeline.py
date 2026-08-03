"""End-to-end conversion pipeline for pdfmd.

Public API:
    pdf_to_markdown(input_pdf: str, output_md: str, options: Options,
                    progress_cb: callable|None = None, log_cb: callable|None = None,
                    pdf_password: str|None = None, debug_tables: bool = False)

Stages:
    1) Extract → PageText pages   (native or OCR depending on Options)
    2) Transform → clean/annotate pages (drop caps, header/footer removal, table detection)
    3) Render → Markdown
    4) Export positioned image occurrences and render them in document flow
    5) Write canonical Markdown, compact index and provenance manifest atomically

Notes:
    - `progress_cb` receives (done, total) at a few milestones; GUI can map this
      to a determinate bar.
    - Image references use forward slashes in Markdown (portable across OSes),
      while all file I/O uses Path/os to be cross-platform safe.
    - Password handling is secure: never logged, never persisted, only used in-memory.
    - Table detection can be debugged with debug_tables=True flag.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional, List, Dict, Any
import hashlib
import json
import os
import re
import shutil
import tempfile

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

from .models import Options, ImagePlacement, PageText
from .extract import extract_pages, _open_pdf_with_password, _tesseract_available
from .transform import transform_pages
from .render import render_document
from .utils import log as default_log


DefProgress = Optional[Callable[[int, int], None]]
DefLogger = Optional[Callable[[str], None]]


def _ocr_image_bytes(png_bytes: bytes, lang: str) -> tuple[str, Optional[float]]:
    """OCR one rendered image locally; return text and mean positive confidence."""
    try:
        import io
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore

        if not _tesseract_available():
            return "", None
        image = Image.open(io.BytesIO(png_bytes))
        data = pytesseract.image_to_data(
            image,
            lang=lang or "por",
            output_type=pytesseract.Output.DICT,
        )
        words = [str(text or "").strip() for text in data.get("text", [])]
        text = " ".join(word for word in words if word)
        confidences: List[float] = []
        for raw in data.get("conf", []):
            try:
                value = float(raw)
            except (TypeError, ValueError):
                continue
            if value >= 0:
                confidences.append(value)
        confidence = sum(confidences) / len(confidences) if confidences else None
        return text, confidence
    except Exception:
        return "", None


def _export_images(
    pdf_path: str,
    output_md: str,
    options: Options,
    pages: Optional[List[PageText]] = None,
    log_cb: DefLogger = None,
    pdf_password: Optional[str] = None,
) -> Dict[int, List[ImagePlacement]]:
    """Export images to an _assets folder next to output_md and return relative paths.

    Returns a mapping: page_index → [relpath, ...].

    For password-protected PDFs, the password is used only to open the
    document in memory. It is never logged or persisted.
    
    Args:
        pdf_path: Path to input PDF
        output_md: Path to output Markdown file
        options: Conversion options
        log_cb: Optional logging callback
        pdf_password: Optional PDF password (ephemeral, in-memory only)
        
    Returns:
        Dictionary mapping page indices to positioned image occurrences
    """
    if not options.export_images:
        return {}
    
    if fitz is None:
        if log_cb:
            log_cb("[pipeline] PyMuPDF is not available; cannot export images.")
        return {}

    try:
        # Reuse the central password-aware open helper so behavior matches extract.py
        doc = _open_pdf_with_password(pdf_path, pdf_password)
    except Exception as e:
        if log_cb:
            log_cb(f"[pipeline] Could not export images: {e}")
        return {}

    try:
        out_path = Path(output_md)
        assets_dir = out_path.with_name(out_path.stem + "_assets")
        assets_dir.mkdir(parents=True, exist_ok=True)

        mapping: Dict[int, List[ImagePlacement]] = {}
        digest_to_relpath: Dict[str, str] = {}
        generated_files: set[str] = set()
        page_count = doc.page_count
        limit = page_count if not options.preview_only else min(3, page_count)

        for pno in range(limit):
            page = doc.load_page(pno)
            try:
                occurrences = page.get_image_info(xrefs=True)
            except Exception:
                occurrences = []
            if (
                not occurrences
                and pages
                and pno < len(pages)
                and not pages[pno].tables
                and (pages[pno].vector_drawings or pages[pno].annotations or pages[pno].widgets)
            ):
                occurrences = [
                    {
                        "xref": 0,
                        "bbox": tuple(page.rect),
                        "pdfmd_full_page_visual": True,
                    }
                ]
            placements: List[ImagePlacement] = []

            for idx, info in enumerate(occurrences, start=1):
                xref = int(info.get("xref", 0) or 0) or None
                raw_bbox = info.get("bbox")
                if not raw_bbox or len(raw_bbox) != 4:
                    continue
                try:
                    bbox = fitz.Rect(*raw_bbox) & page.rect
                    if bbox.is_empty or bbox.width <= 0 or bbox.height <= 0:
                        continue
                    pix = page.get_pixmap(clip=bbox, dpi=max(72, int(options.image_dpi)), alpha=False)
                except Exception as exc:
                    if log_cb:
                        log_cb(f"[pipeline] Skipping image occurrence on page {pno + 1}: {exc}")
                    continue

                png_bytes = pix.tobytes("png")
                digest = hashlib.sha256(png_bytes).hexdigest()
                fname = assets_dir / f"img_{pno + 1:03d}_{idx:02d}.png"
                repeated = digest in digest_to_relpath
                if repeated:
                    rel = digest_to_relpath[digest]
                else:
                    try:
                        _atomic_write_bytes(fname, png_bytes)
                    except Exception as exc:
                        if log_cb:
                            log_cb(f"[pipeline] Could not save image p{pno + 1}-{idx}: {exc}")
                        continue
                    rel = assets_dir.name + "/" + fname.name
                    digest_to_relpath[digest] = rel
                    generated_files.add(fname.name)

                ocr_text = ""
                confidence: Optional[float] = None
                page_area = max(float(page.rect.width * page.rect.height), 1.0)
                occurrence_area = float(bbox.width * bbox.height)
                page_already_ocr = bool(pages and pno < len(pages) and pages[pno].ocr_used)
                if (
                    options.ocr_embedded_images
                    and occurrence_area / page_area >= 0.005
                    and not (page_already_ocr and occurrence_area / page_area > 0.50)
                ):
                    ocr_text, confidence = _ocr_image_bytes(png_bytes, options.ocr_lang)

                placements.append(
                    ImagePlacement(
                        bbox=tuple(float(v) for v in raw_bbox),  # type: ignore[arg-type]
                        relpath=rel,
                        element_id=f"p{pno + 1:04d}-i{idx:03d}",
                        xref=xref,
                        ocr_text=ocr_text,
                        confidence=confidence,
                        repeated=repeated,
                    )
                )

            if placements:
                mapping[pno] = placements

        for old in assets_dir.glob("img_*.png"):
            if old.name not in generated_files and not any(
                placement.relpath.endswith("/" + old.name)
                for placements in mapping.values()
                for placement in placements
            ):
                old.unlink()
        
        if log_cb and mapping:
            log_cb(f"[pipeline] Exported images to folder: {assets_dir}")
        
        return mapping
    
    finally:
        doc.close()


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def _atomic_write_text(path: Path, text: str) -> None:
    _atomic_write_bytes(path, text.encode("utf-8"))


def _remove_path(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    elif path.exists() or path.is_symlink():
        path.unlink()


def _commit_staged_bundle(items: List[tuple[Path, Path]]) -> None:
    """Replace a related set of outputs and roll everything back on failure."""
    if not items:
        return

    destination_parent = items[0][1].parent
    destination_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".pdfmd-backup-",
        dir=str(destination_parent),
    ) as backup_name:
        backup_root = Path(backup_name)
        backups: List[tuple[Path, Path]] = []
        installed: List[Path] = []
        try:
            for position, (staged, destination) in enumerate(items):
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.exists() or destination.is_symlink():
                    backup = backup_root / f"{position:02d}-{destination.name}"
                    os.replace(destination, backup)
                    backups.append((backup, destination))
                os.replace(staged, destination)
                installed.append(destination)
        except Exception:
            for destination in reversed(installed):
                if destination.exists() or destination.is_symlink():
                    _remove_path(destination)
            for backup, destination in reversed(backups):
                if backup.exists() or backup.is_symlink():
                    os.replace(backup, destination)
            raise


def _sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _page_character_count(page: PageText) -> int:
    return sum(
        len(span.text)
        for block in page.blocks
        for line in block.lines
        for span in line.spans
    )


def _printed_page(page: PageText) -> Optional[int]:
    candidates: List[int] = []
    for item in page.suppressed_repeated:
        if item.get("kind") != "page_number":
            continue
        text = str(item.get("text") or "").strip()
        if text.isdigit():
            candidates.append(int(text))
    return candidates[0] if len(set(candidates)) == 1 else None


def _page_line_ranges(md: str) -> Dict[int, Dict[str, int]]:
    ranges: Dict[int, Dict[str, int]] = {}
    current: Optional[int] = None
    for line_no, line in enumerate(md.splitlines(), start=1):
        match = re.match(r"<!-- pdfmd:page=(\d+);", line)
        if match:
            if current is not None:
                ranges[current]["end_line"] = line_no - 1
            current = int(match.group(1))
            ranges[current] = {"start_line": max(1, line_no - 1), "end_line": line_no}
    if current is not None:
        ranges[current]["end_line"] = len(md.splitlines())
    return ranges


def _manifest_data(input_pdf: str, output_md: str, pages: List[PageText], md: str, options: Options) -> Dict[str, Any]:
    line_ranges = _page_line_ranges(md)
    page_records: List[Dict[str, Any]] = []
    for page in pages:
        number = page.page_number or (len(page_records) + 1)
        page_records.append(
            {
                "pdf_page": number,
                "printed_page": _printed_page(page),
                "anchor": f"pdf-page-{number}",
                "markdown_lines": line_ranges.get(number),
                "width": page.width,
                "height": page.height,
                "rotation": page.rotation,
                "extraction_method": page.extraction_method,
                "ocr_used": page.ocr_used,
                "characters": _page_character_count(page),
                "blocks": len(page.blocks),
                "elements": [
                    {
                        "id": block.element_id,
                        "bbox": list(block.bbox) if block.bbox else None,
                        "characters": sum(len(span.text) for line in block.lines for span in line.spans),
                        "source": next(
                            (span.source for line in block.lines for span in line.spans if span.source),
                            page.extraction_method,
                        ),
                    }
                    for block in page.blocks
                ],
                "vector_drawings": page.vector_drawings,
                "annotations": page.annotations,
                "widgets": page.widgets,
                "tables": [
                    {
                        "id": table.element_id,
                        "bbox": list(table.bbox),
                        "rows": len(table.rows),
                        "columns": max((len(row) for row in table.rows), default=0),
                        "header_detected": table.header_detected,
                        "source": table.source,
                        "confidence": table.confidence,
                    }
                    for table in page.tables
                ],
                "images": [
                    {
                        "id": image.element_id,
                        "bbox": list(image.bbox),
                        "asset": image.relpath,
                        "xref": image.xref,
                        "ocr_confidence": image.confidence,
                        "ocr_characters": len(image.ocr_text),
                        "repeated": image.repeated,
                    }
                    for image in page.images
                ],
                "suppressed_repeated": page.suppressed_repeated,
                "warnings": page.warnings,
                "review_required": bool(page.warnings),
            }
        )
    return {
        "schema": "pdfmd-manifest-v1",
        "source_file": Path(input_pdf).name,
        "source_sha256": _sha256_file(input_pdf),
        "markdown_file": Path(output_md).name,
        "pages": page_records,
        "options": {
            "ocr_mode": options.ocr_mode,
            "ocr_lang": options.ocr_lang,
            "ocr_embedded_images": options.ocr_embedded_images,
            "page_anchors": True,
            "export_images": options.export_images,
        },
    }


def _build_index(output_md: str, pages: List[PageText], md: str, source_hash: str) -> str:
    md_name = Path(output_md).name
    total_tables = sum(len(page.tables) for page in pages)
    total_images = sum(len(page.images) for page in pages)
    lines = [
        f"# Mapa de {md_name}",
        "",
        f"<!-- pdfmd:index; source_sha256={source_hash} -->",
        "",
        f"- Páginas PDF: {len(pages)}",
        f"- Tokens estimados se lido integralmente: {max(1, (len(md) + 2) // 3)}",
    ]
    if total_tables:
        lines.append(f"- Tabelas: {total_tables}")
    if total_images:
        lines.append(f"- Imagens: {total_images}")
    lines.extend(["", "## Estrutura detectada", ""])
    md_lines = md.splitlines()
    current_page = 1
    candidates: List[Dict[str, Any]] = []
    for position, line in enumerate(md_lines):
        page_match = re.match(r"<!-- pdfmd:page=(\d+);", line)
        if page_match:
            current_page = int(page_match.group(1))
            continue
        heading = re.match(r"^(#{1,4})\s+(.+?)\s*$", line)
        if heading and len(heading.group(1)) <= 2:
            candidates.append({"position": position, "level": len(heading.group(1)), "title": heading.group(2), "start": current_page})
    for idx, item in enumerate(candidates):
        end_position = len(md_lines)
        for following in candidates[idx + 1:]:
            if following["level"] <= item["level"]:
                end_position = following["position"]
                break
        page_numbers = [int(match.group(1)) for line in md_lines[item["position"]:end_position] if (match := re.match(r"<!-- pdfmd:page=(\d+);", line))]
        end_page = max([item["start"], *page_numbers])
        token_cost = max(1, (len("\n".join(md_lines[item["position"]:end_position])) + 2) // 3)
        interval = str(item["start"]) if end_page == item["start"] else f'{item["start"]}-{end_page}'
        indent = "  " * (item["level"] - 1)
        lines.append(f'{indent}- p. {interval} | {item["title"]} | {token_cost} tok')
    headings = len(candidates)
    if headings == 0:
        lines.append("- Nenhum título estrutural detectado")

    lines.extend(["", "## Páginas que exigem conferência", ""])
    for page in pages:
        number = page.page_number or 1
        if page.warnings:
            lines.append(f"- p. {number} | {'; '.join(page.warnings)}")
    if not any(page.warnings for page in pages):
        lines.append("- Nenhuma")
    lines.append("")
    while (len("\n".join(lines)) + 2) // 3 > 600 and headings > 0:
        for i in range(len(lines) - 1, -1, -1):
            if re.match(r"\s*- p\. [\d-]+ \| .* \| \d+ tok$", lines[i]):
                lines.pop(i)
                headings -= 1
                break
    return "\n".join(lines)


def pdf_to_markdown(
    input_pdf: str,
    output_md: str,
    options: Options,
    progress_cb: DefProgress = None,
    log_cb: DefLogger = None,
    pdf_password: Optional[str] = None,
    debug_tables: bool = False,
) -> None:
    """Convert a PDF to Markdown using the full pdfmd pipeline.
    
    This is the main entry point for PDF to Markdown conversion. It orchestrates
    all stages: extraction, transformation, rendering, and optional image export.
    
    Args:
        input_pdf: Path to input PDF file
        output_md: Path where Markdown output will be written
        options: Conversion options (OCR mode, heading detection, etc.)
        progress_cb: Optional callback for progress updates: (done, total)
        log_cb: Optional callback for log messages
        pdf_password: Optional password for encrypted PDFs (ephemeral)
        debug_tables: Enable debug logging for table detection
        
    Raises:
        RuntimeError: If PyMuPDF is not installed
        ValueError: If PDF has no pages or is invalid
        Various exceptions from extraction, transformation, or rendering stages
        
    Side Effects:
        - Writes Markdown file to output_md
        - May create _assets/ folder if export_images is enabled
        - Calls progress_cb and log_cb if provided
        
    Security Notes:
        - pdf_password is never logged or persisted
        - All processing happens locally
        - Output files are written unencrypted
    """
    if log_cb is None:
        log_cb = default_log

    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not installed. Install with: pip install pymupdf")

    # --- Stage 1: Extract ---
    if log_cb:
        log_cb("[pipeline] Extracting text…")

    # Map page-level progress into the [0, 30] range of a 0 to 100 scale.
    def _stage1_progress(done_pages: int, total_pages: int) -> None:
        if progress_cb and total_pages > 0:
            pct = int(done_pages * 30 / total_pages)
            progress_cb(pct, 100)

    pages = extract_pages(
        input_pdf,
        options,
        progress_cb=_stage1_progress,
        pdf_password=pdf_password,
    )

    if not pages:
        raise ValueError("PDF extraction produced no pages")

    if progress_cb:
        progress_cb(30, 100)

    # --- Stage 2: Transform ---
    if log_cb:
        log_cb("[pipeline] Transforming pages…")
    
    pages_t, header, footer, body_sizes = transform_pages(
        pages, 
        options,
        debug_tables=debug_tables,
    )
    
    if log_cb and (header or footer):
        log_cb(f"[pipeline] Removed repeating edges → header={header!r}, footer={footer!r}")

    if progress_cb:
        progress_cb(60, 100)

    # Stage every derived artifact away from the live outputs. Only after the
    # complete bundle exists do we replace the previous version as one
    # rollback-capable transaction.
    out_path = Path(output_md)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(
            prefix=f".{out_path.stem}-pdfmd-stage-",
            dir=str(out_path.parent),
        ) as stage_name:
            stage_root = Path(stage_name)
            staged_out = stage_root / out_path.name

            # --- Stage 3: Optional positioned image export ---
            if options.export_images:
                if log_cb:
                    log_cb("[pipeline] Exporting images…")

                page_to_images = _export_images(
                    input_pdf,
                    str(staged_out),
                    options,
                    pages=pages_t,
                    log_cb=log_cb,
                    pdf_password=pdf_password,
                )
                for page_index, images in page_to_images.items():
                    if page_index < len(pages_t):
                        pages_t[page_index].images = images

            if progress_cb:
                progress_cb(75, 100)

            if options.strict:
                warnings = [
                    f"p. PDF {page.page_number}: {warning}"
                    for page in pages_t
                    for warning in page.warnings
                ]
                if warnings:
                    raise ValueError(
                        "Conversão estrita exige conferência: " + " | ".join(warnings)
                    )

            # --- Stage 4: Render canonical Markdown ---
            if log_cb:
                log_cb("[pipeline] Rendering canonical Markdown…")

            md = render_document(
                pages_t,
                options,
                body_sizes=body_sizes,
            )

            if progress_cb:
                progress_cb(85, 100)

            if log_cb:
                log_cb("[pipeline] Staging output bundle…")

            _atomic_write_text(staged_out, md)
            staged_items: List[tuple[Path, Path]] = [(staged_out, out_path)]

            manifest: Optional[Dict[str, Any]] = None
            if options.write_manifest or options.write_index:
                manifest = _manifest_data(input_pdf, output_md, pages_t, md, options)

            if options.write_manifest and manifest is not None:
                staged_manifest = staged_out.with_suffix(".pdfmd.json")
                manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
                _atomic_write_text(staged_manifest, manifest_text)
                staged_items.append(
                    (staged_manifest, out_path.with_suffix(".pdfmd.json"))
                )

            if options.write_index and manifest is not None:
                staged_index = staged_out.with_suffix(".index.md")
                index_text = _build_index(
                    output_md,
                    pages_t,
                    md,
                    str(manifest["source_sha256"]),
                )
                _atomic_write_text(staged_index, index_text)
                staged_items.append((staged_index, out_path.with_suffix(".index.md")))

            if options.export_images:
                staged_assets = staged_out.with_name(staged_out.stem + "_assets")
                if staged_assets.exists():
                    final_assets = out_path.with_name(out_path.stem + "_assets")
                    staged_items.append((staged_assets, final_assets))

            _commit_staged_bundle(staged_items)
    except Exception as e:
        if log_cb:
            log_cb(f"[pipeline] Error writing output bundle: {e}")
        raise

    if progress_cb:
        progress_cb(100, 100)
    
    if log_cb:
        log_cb(f"[pipeline] Saved → {output_md}")


__all__ = [
    "pdf_to_markdown",
]

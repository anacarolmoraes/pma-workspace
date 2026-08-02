"""Core data models for pdfmd.

This module defines lightweight, serializable structures that represent the
intermediate text model we pass through the pipeline:

- Span:    A run of text with uniform styling.
- Line:    A sequence of spans that appear on the same baseline.
- Block:   A group of lines (roughly a paragraph or heading candidate).
- PageText:All text blocks for a page.
- Options: User-configurable knobs used by extract/transform/render stages.

We provide static constructors to build PageText from:
  • PyMuPDF ("dict" output)
  • Tesseract (pytesseract.image_to_data dict)

These constructors keep *only* the essentials the rest of the pipeline needs:
text runs and coarse style hints (approx size, bold, italic). Layout geometry is
not preserved beyond what helps basic heuristics.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Any, Iterable, Optional, Literal, Tuple


BBox = Tuple[float, float, float, float]


def _bbox(value: Any) -> Optional[BBox]:
    """Normalize a PDF/OCR bounding box without making geometry mandatory."""
    if not value or len(value) != 4:
        return None
    try:
        return tuple(float(v) for v in value)  # type: ignore[return-value]
    except (TypeError, ValueError):
        return None


# ---------------------------- Text structures ----------------------------
@dataclass
class Span:
    text: str
    size: float = 0.0
    bold: bool = False
    italic: bool = False
    bbox: Optional[BBox] = None
    confidence: Optional[float] = None
    source: str = "native"


@dataclass
class Line:
    spans: List[Span] = field(default_factory=list)
    bbox: Optional[BBox] = None

    def text(self) -> str:
        return "".join(s.text for s in self.spans)


@dataclass
class Block:
    lines: List[Line] = field(default_factory=list)
    bbox: Optional[BBox] = None
    element_id: Optional[str] = None

    def is_empty(self) -> bool:
        for ln in self.lines:
            if any(sp.text.strip() for sp in ln.spans):
                return False
        return True


@dataclass
class TableRegion:
    bbox: BBox
    rows: List[List[str]] = field(default_factory=list)
    element_id: Optional[str] = None
    header_detected: bool = False
    source: str = "pymupdf"
    confidence: float = 1.0


@dataclass
class ImagePlacement:
    bbox: BBox
    relpath: str
    element_id: Optional[str] = None
    xref: Optional[int] = None
    ocr_text: str = ""
    confidence: Optional[float] = None
    repeated: bool = False


@dataclass
class PageText:
    blocks: List[Block] = field(default_factory=list)
    page_number: int = 0
    width: float = 0.0
    height: float = 0.0
    rotation: int = 0
    extraction_method: str = "native"
    ocr_used: bool = False
    tables: List[TableRegion] = field(default_factory=list)
    images: List[ImagePlacement] = field(default_factory=list)
    vector_drawings: int = 0
    annotations: int = 0
    widgets: int = 0
    warnings: List[str] = field(default_factory=list)
    suppressed_repeated: List[Dict[str, Any]] = field(default_factory=list)

    # ------------------------ PyMuPDF constructor ------------------------
    @staticmethod
    def from_pymupdf(
        page_dict: Dict[str, Any],
        page_number: int = 0,
        rotation: int = 0,
    ) -> "PageText":
        """Build a PageText from fitz.Page.get_text("dict").

        We extract spans (text, size, bold/italic hints) and group them into
        lines and blocks following the original dict structure.
        """
        def span_style(span: Dict[str, Any]) -> tuple[float, bool, bool, str]:
            txt = span.get("text", "") or ""
            size = float(span.get("size", 0.0) or 0.0)
            flags = int(span.get("flags", 0) or 0)
            font = str(span.get("font", "") or "").lower()
            # Heuristics similar to PyMuPDF semantics
            is_bold = bool(flags & 16) or any(k in font for k in ("bold", "black", "heavy", "semibold"))
            is_italic = bool(flags & 2) or any(k in font for k in ("italic", "oblique"))
            return size, is_bold, is_italic, txt

        blocks: List[Block] = []
        for block_idx, b in enumerate(page_dict.get("blocks", []) or [], start=1):
            if "lines" not in b:
                # skip images and non-text blocks here
                continue
            lines: List[Line] = []
            for ln in b.get("lines", []) or []:
                spans: List[Span] = []
                for sp in ln.get("spans", []) or []:
                    size, bold, italic, txt = span_style(sp)
                    if not txt:
                        continue
                    spans.append(
                        Span(
                            text=txt,
                            size=size,
                            bold=bold,
                            italic=italic,
                            bbox=_bbox(sp.get("bbox")),
                            source="native",
                        )
                    )
                if spans:
                    lines.append(Line(spans=spans, bbox=_bbox(ln.get("bbox"))))
            if lines:
                blocks.append(
                    Block(
                        lines=lines,
                        bbox=_bbox(b.get("bbox")),
                        element_id=f"p{page_number:04d}-b{block_idx:04d}" if page_number else None,
                    )
                )
        return PageText(
            blocks=blocks,
            page_number=page_number,
            width=float(page_dict.get("width", 0.0) or 0.0),
            height=float(page_dict.get("height", 0.0) or 0.0),
            rotation=rotation,
            extraction_method="native",
        )

    # ------------------------- Tesseract constructor -------------------------
    @staticmethod
    def from_tesseract_data(
        data: Dict[str, List[Any]],
        page_number: int = 0,
        width: float = 0.0,
        height: float = 0.0,
        rotation: int = 0,
    ) -> "PageText":
        """Build PageText from pytesseract.image_to_data() result.

        The data dict contains parallel lists for keys: level, page_num, block_num,
        par_num, line_num, word_num, left, top, width, height, conf, text.

        We group by (block_num, line_num). We do not try to infer bold/italic.
        A crude font-size proxy uses the median of word heights in a line.
        """
        n = len(data.get("text", []))
        if n == 0:
            return PageText()

        # Group indices by (block_num, line_num)
        groups: Dict[tuple[int, int], List[int]] = {}
        for i in range(n):
            txt = data["text"][i] or ""
            if not txt.strip():
                continue
            bno = int(data.get("block_num", [0]*n)[i] or 0)
            lno = int(data.get("line_num", [0]*n)[i] or 0)
            groups.setdefault((bno, lno), []).append(i)

        # Sort groups by block, then line order (by top coordinate if present)
        def group_top(idx_list: List[int]) -> int:
            tops = [int(data.get("top", [0]*n)[i] or 0) for i in idx_list]
            return min(tops) if tops else 0

        ordered_keys = sorted(groups.keys(), key=lambda k: (k[0], group_top(groups[k])))

        blocks: List[Block] = []
        cur_block_key: Optional[int] = None
        cur_block_lines: List[Line] = []

        for (bno, lno) in ordered_keys:
            idxs = groups[(bno, lno)]
            # estimate size by median of heights in this line
            heights = [int(data.get("height", [0]*n)[i] or 0) for i in idxs]
            size_est = float(median_safe(heights)) if heights else 0.0
            # assemble spans in reading order (left coordinate if present)
            idxs_sorted = sorted(idxs, key=lambda i: int(data.get("left", [0]*n)[i] or 0))
            spans: List[Span] = []
            for i in idxs_sorted:
                left = float(data.get("left", [0] * n)[i] or 0)
                top = float(data.get("top", [0] * n)[i] or 0)
                word_width = float(data.get("width", [0] * n)[i] or 0)
                word_height = float(data.get("height", [0] * n)[i] or 0)
                raw_conf = data.get("conf", [-1] * n)[i]
                try:
                    conf = float(raw_conf)
                except (TypeError, ValueError):
                    conf = -1.0
                spans.append(
                    Span(
                        text=str(data["text"][i]),
                        size=size_est,
                        bbox=(left, top, left + word_width, top + word_height),
                        confidence=conf if conf >= 0 else None,
                        source="tesseract",
                    )
                )
            xs0 = [sp.bbox[0] for sp in spans if sp.bbox]
            ys0 = [sp.bbox[1] for sp in spans if sp.bbox]
            xs1 = [sp.bbox[2] for sp in spans if sp.bbox]
            ys1 = [sp.bbox[3] for sp in spans if sp.bbox]
            line_bbox = (min(xs0), min(ys0), max(xs1), max(ys1)) if xs0 else None
            line = Line(spans=spans, bbox=line_bbox)

            if cur_block_key is None:
                cur_block_key = bno
            if bno != cur_block_key:
                # flush previous block
                if cur_block_lines:
                    block_no = len(blocks) + 1
                    blocks.append(
                        Block(
                            lines=cur_block_lines,
                            bbox=_bbox_from_lines(cur_block_lines),
                            element_id=f"p{page_number:04d}-b{block_no:04d}" if page_number else None,
                        )
                    )
                cur_block_lines = [line]
                cur_block_key = bno
            else:
                cur_block_lines.append(line)

        if cur_block_lines:
            block_no = len(blocks) + 1
            blocks.append(
                Block(
                    lines=cur_block_lines,
                    bbox=_bbox_from_lines(cur_block_lines),
                    element_id=f"p{page_number:04d}-b{block_no:04d}" if page_number else None,
                )
            )

        return PageText(
            blocks=blocks,
            page_number=page_number,
            width=width,
            height=height,
            rotation=rotation,
            extraction_method="tesseract",
            ocr_used=True,
        )


# ------------------------------ Options ------------------------------
@dataclass
class Options:
    # Extraction / OCR
    ocr_mode: Literal["off", "auto", "tesseract", "ocrmypdf"] = "off"
    ocr_lang: str = "eng"
    preview_only: bool = False

    # Transform heuristics
    caps_to_headings: bool = True
    defragment_short: bool = True
    heading_size_ratio: float = 1.15
    orphan_max_len: int = 45
    remove_headers_footers: bool = True

    # Rendering / output
    insert_page_breaks: bool = False
    export_images: bool = False
    ocr_embedded_images: bool = False
    write_manifest: bool = True
    write_index: bool = True
    strict: bool = False
    image_dpi: int = 200


def _bbox_from_lines(lines: List[Line]) -> Optional[BBox]:
    boxes = [line.bbox for line in lines if line.bbox]
    if not boxes:
        return None
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


# ------------------------------ Utilities ------------------------------
def median_safe(vals: Iterable[int | float]) -> float:
    xs = [float(v) for v in vals]
    if not xs:
        return 0.0
    xs.sort()
    m = len(xs) // 2
    if len(xs) % 2:
        return xs[m]
    return (xs[m - 1] + xs[m]) / 2.0


__all__ = [
    "Span",
    "Line",
    "Block",
    "PageText",
    "TableRegion",
    "ImagePlacement",
    "Options",
    "BBox",
    "median_safe",
]

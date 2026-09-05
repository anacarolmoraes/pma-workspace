from __future__ import annotations

import io
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz
from PIL import Image

from pdfmd.extract import extract_pages
from pdfmd.models import Block, Line, Options, PageText, Span
from pdfmd.pipeline import pdf_to_markdown, _build_index
from pdfmd.render import render_document
from pdfmd.transform import remove_header_footer


def _png_bytes(color: tuple[int, int, int] = (220, 20, 20)) -> bytes:
    stream = io.BytesIO()
    Image.new("RGB", (80, 60), color).save(stream, format="PNG")
    return stream.getvalue()


class FidelityTests(unittest.TestCase):
    def test_tesseract_groups_paragraphs_and_orders_two_columns(self) -> None:
        data = {key: [] for key in ("text", "block_num", "par_num", "line_num", "left", "top", "width", "height", "conf")}
        rows = [
            ("R1", 2, 1, 1, 350, 100),
            ("L2", 1, 2, 1, 40, 180),
            ("L1", 1, 1, 1, 40, 100),
            ("R2", 2, 2, 1, 350, 180),
        ]
        for text, block, paragraph, line, left, top in rows:
            for key, value in zip(data, (text, block, paragraph, line, left, top, 30, 20, 95)):
                data[key].append(value)
        page = PageText.from_tesseract_data(data, page_number=1, width=600, height=800)
        ordered = [line.text() for block in page.blocks for line in block.lines]
        self.assertEqual(ordered, ["L1", "L2", "R1", "R2"])

    def test_compact_index_stays_under_600_estimated_tokens(self) -> None:
        blocks = [Block(lines=[Line([Span(f"# Título estrutural {i}")])]) for i in range(150)]
        page = PageText(page_number=1, blocks=blocks)
        md = '<a id="pdf-page-1"></a>\n<!-- pdfmd:page=1; method=native -->\n' + '\n'.join(
            f"# Título estrutural {i}" for i in range(150)
        )
        index = _build_index("amostra.md", [page], md, "abc")
        self.assertLessEqual((len(index) + 2) // 3, 600)

    def test_native_model_retains_geometry(self) -> None:
        page = PageText.from_pymupdf(
            {
                "width": 612,
                "height": 792,
                "blocks": [
                    {
                        "bbox": (10, 20, 100, 40),
                        "lines": [
                            {
                                "bbox": (10, 20, 100, 40),
                                "spans": [
                                    {"text": "Texto", "size": 12, "bbox": (10, 20, 50, 40)}
                                ],
                            }
                        ],
                    }
                ],
            },
            page_number=3,
        )
        self.assertEqual(page.page_number, 3)
        self.assertEqual(page.blocks[0].bbox, (10.0, 20.0, 100.0, 40.0))
        self.assertEqual(page.blocks[0].lines[0].spans[0].bbox, (10.0, 20.0, 50.0, 40.0))

    def test_body_number_is_not_removed_as_footer(self) -> None:
        page = PageText(
            page_number=1,
            width=600,
            height=800,
            blocks=[
                Block(
                    bbox=(100, 350, 120, 370),
                    lines=[Line([Span("123", bbox=(100, 350, 120, 370))], bbox=(100, 350, 120, 370))],
                )
            ],
        )
        cleaned = remove_header_footer([page], None, None)
        self.assertEqual(cleaned[0].blocks[0].lines[0].text(), "123")

    def test_page_anchors_are_stable(self) -> None:
        pages = [
            PageText(page_number=1, blocks=[Block(lines=[Line([Span("Primeira")])])]),
            PageText(page_number=2, blocks=[Block(lines=[Line([Span("Segunda")])])]),
        ]
        md = render_document(pages, Options(write_manifest=True, write_index=True))
        self.assertIn('<a id="pdf-page-1"></a>', md)
        self.assertIn('<!-- pdfmd:page=2; method=native -->', md)
        self.assertNotIn("\n---\n", md)

    def test_two_columns_keep_left_column_before_right(self) -> None:
        page = PageText(
            page_number=1,
            width=600,
            height=800,
            blocks=[
                Block(lines=[Line([Span("L1")])], bbox=(40, 100, 250, 140)),
                Block(lines=[Line([Span("R1")])], bbox=(350, 100, 560, 140)),
                Block(lines=[Line([Span("L2")])], bbox=(40, 180, 250, 220)),
                Block(lines=[Line([Span("R2")])], bbox=(350, 180, 560, 220)),
            ],
        )
        md = render_document([page], Options())
        self.assertLess(md.index("L1"), md.index("L2"))
        self.assertLess(md.index("L2"), md.index("R1"))
        self.assertLess(md.index("R1"), md.index("R2"))

    def test_auto_ocr_is_decided_per_page(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "mixed.pdf"
            doc = fitz.open()
            first = doc.new_page()
            first.insert_text((72, 72), "Página digital com texto suficiente para extração nativa. " * 8)
            second = doc.new_page()
            second.insert_image(fitz.Rect(0, 0, second.rect.width, second.rect.height), stream=_png_bytes())
            doc.save(pdf)
            doc.close()

            fake_ocr = PageText(
                page_number=2,
                width=612,
                height=792,
                extraction_method="tesseract",
                ocr_used=True,
                blocks=[Block(lines=[Line([Span("OCR DA PÁGINA", source="tesseract")])])],
            )
            with patch("pdfmd.extract._tesseract_available", return_value=True), patch(
                "pdfmd.extract._extract_tesseract_page", return_value=fake_ocr
            ) as ocr_page:
                pages = extract_pages(str(pdf), Options(ocr_mode="auto", ocr_lang="por"))

            self.assertEqual(pages[0].extraction_method, "native")
            self.assertTrue(pages[1].ocr_used)
            ocr_page.assert_called_once()

    def test_pipeline_positions_images_and_writes_navigation_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "visual.pdf"
            md_path = Path(tmp) / "visual.md"
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), "TEXTO ANTES DA IMAGEM")
            page.insert_image(fitz.Rect(72, 180, 220, 300), stream=_png_bytes())
            page.insert_text((72, 420), "TEXTO DEPOIS DA IMAGEM")
            doc.save(pdf)
            doc.close()

            options = Options(
                ocr_mode="off",
                export_images=True,
                write_manifest=True,
                write_index=True,
                insert_page_breaks=True,
            )
            pdf_to_markdown(str(pdf), str(md_path), options)

            md = md_path.read_text(encoding="utf-8")
            image_pos = md.index("![Imagem incorporada")
            self.assertLess(md.index("TEXTO ANTES"), image_pos)
            self.assertLess(image_pos, md.index("TEXTO DEPOIS"))
            self.assertTrue((Path(tmp) / "visual.index.md").exists())
            manifest_path = Path(tmp) / "visual.pdfmd.json"
            self.assertTrue(manifest_path.exists())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["schema"], "pdfmd-manifest-v1")
            self.assertEqual(
                manifest["source_sha256"],
                hashlib.sha256(pdf.read_bytes()).hexdigest(),
            )
            self.assertEqual(manifest["pages"][0]["pdf_page"], 1)
            self.assertEqual(len(manifest["pages"][0]["images"]), 1)
            asset = Path(tmp) / manifest["pages"][0]["images"][0]["asset"]
            self.assertTrue(asset.exists())

    def test_geometric_table_is_manifested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "table.pdf"
            md_path = Path(tmp) / "table.md"
            doc = fitz.open()
            page = doc.new_page()
            xs = [72, 190, 310]
            ys = [100, 140, 180, 220]
            for x in xs:
                page.draw_line((x, ys[0]), (x, ys[-1]))
            for y in ys:
                page.draw_line((xs[0], y), (xs[-1], y))
            page.insert_text((82, 125), "Item")
            page.insert_text((200, 125), "Valor")
            page.insert_text((82, 165), "A")
            page.insert_text((200, 165), "10")
            page.insert_text((82, 205), "B")
            page.insert_text((200, 205), "20")
            doc.save(pdf)
            doc.close()

            pdf_to_markdown(str(pdf), str(md_path), Options(ocr_mode="off"))
            manifest = json.loads((Path(tmp) / "table.pdfmd.json").read_text(encoding="utf-8"))
            self.assertGreaterEqual(len(manifest["pages"][0]["tables"]), 1)
            md = md_path.read_text(encoding="utf-8")
            self.assertIn("Item", md)
            self.assertIn("Valor", md)

    def test_strict_mode_preserves_previous_markdown_on_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "annotated.pdf"
            md_path = Path(tmp) / "annotated.md"
            md_path.write_text("CONTEÚDO ANTERIOR\n", encoding="utf-8")

            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), "Documento com anotação PDF")
            page.add_text_annot((120, 120), "Revisar este ponto")
            doc.save(pdf)
            doc.close()

            with self.assertRaisesRegex(ValueError, "conferência"):
                pdf_to_markdown(
                    str(pdf),
                    str(md_path),
                    Options(ocr_mode="off", strict=True),
                )

            self.assertEqual(md_path.read_text(encoding="utf-8"), "CONTEÚDO ANTERIOR\n")
            self.assertFalse(md_path.with_suffix(".pdfmd.json").exists())
            self.assertFalse(md_path.with_suffix(".index.md").exists())

    def test_bundle_staging_preserves_every_previous_artifact_on_late_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "visual.pdf"
            md_path = Path(tmp) / "visual.md"
            manifest_path = md_path.with_suffix(".pdfmd.json")
            index_path = md_path.with_suffix(".index.md")
            assets_path = Path(tmp) / "visual_assets"

            md_path.write_text("MARKDOWN ANTERIOR\n", encoding="utf-8")
            manifest_path.write_text('{"versao":"anterior"}\n', encoding="utf-8")
            index_path.write_text("ÍNDICE ANTERIOR\n", encoding="utf-8")
            assets_path.mkdir()
            (assets_path / "anterior.png").write_bytes(b"ASSET ANTERIOR")

            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), "Nova versão")
            page.insert_image(fitz.Rect(72, 120, 220, 240), stream=_png_bytes())
            doc.save(pdf)
            doc.close()

            with patch("pdfmd.pipeline._build_index", side_effect=RuntimeError("falha tardia")):
                with self.assertRaisesRegex(RuntimeError, "falha tardia"):
                    pdf_to_markdown(
                        str(pdf),
                        str(md_path),
                        Options(ocr_mode="off", export_images=True),
                    )

            self.assertEqual(md_path.read_text(encoding="utf-8"), "MARKDOWN ANTERIOR\n")
            self.assertEqual(
                manifest_path.read_text(encoding="utf-8"),
                '{"versao":"anterior"}\n',
            )
            self.assertEqual(index_path.read_text(encoding="utf-8"), "ÍNDICE ANTERIOR\n")
            self.assertEqual(
                (assets_path / "anterior.png").read_bytes(),
                b"ASSET ANTERIOR",
            )

    def test_selective_reader_returns_exact_pages_and_citations(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            md_path = Path(tmp) / "sample.md"
            md_path.write_text(
                '<a id="pdf-page-1"></a>\n'
                '<!-- pdfmd:page=1; method=native -->\n\n'
                '# Primeira seção\n\nConteúdo um.\n\n'
                '<a id="pdf-page-2"></a>\n'
                '<!-- pdfmd:page=2; method=native -->\n\n'
                '## Pedidos\n\nConteúdo dois.\n',
                encoding="utf-8",
            )
            md_path.with_suffix(".index.md").write_text("# Mapa\n", encoding="utf-8")
            workspace = Path(__file__).resolve().parents[3]
            reader = workspace / "skills" / "pdfmd" / "scripts" / "ler-pdfmd.js"
            page_result = subprocess.run(
                ["node", str(reader), str(md_path), "--paginas", "2"],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertIn("Conteúdo dois", page_result.stdout)
            self.assertNotIn("Conteúdo um", page_result.stdout)
            search_result = subprocess.run(
                ["node", str(reader), str(md_path), "--buscar", "conteúdo dois"],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertIn("p. PDF 2", search_result.stdout)

    def test_duplicate_text_layer_is_suppressed_and_manifested(self) -> None:
        # STF "Inteiro Teor" PDFs carry each page twice in the content stream:
        # same text, same coordinates. Native extraction must keep one copy and
        # register the other, without touching legitimate repetitions elsewhere.
        from pdfmd.extract import _drop_duplicate_layer_blocks

        def block(text: str, bbox: tuple[float, float, float, float]) -> Block:
            return Block(lines=[Line(spans=[Span(text=text, size=11.0)], bbox=bbox)], bbox=bbox)

        page = PageText(
            blocks=[
                block("Além disso, a agravante sustenta", (114.0, 99.0, 542.0, 155.0)),
                block("Por fim, a manutenção", (114.0, 157.0, 542.0, 194.0)),
                block("Além disso, a agravante sustenta", (114.2, 99.1, 541.9, 155.0)),  # same layer, ~same bbox
                block("Por fim, a manutenção", (114.0, 157.0, 542.0, 194.0)),
                block("Por fim, a manutenção", (114.0, 400.0, 542.0, 437.0)),  # same text, other place: keep
            ],
            page_number=1,
        )
        _drop_duplicate_layer_blocks(page)
        self.assertEqual(
            [b.lines[0].text() for b in page.blocks],
            ["Além disso, a agravante sustenta", "Por fim, a manutenção", "Por fim, a manutenção"],
        )
        self.assertEqual([s["kind"] for s in page.suppressed_repeated], ["duplicate_layer"] * 2)


if __name__ == "__main__":
    unittest.main()

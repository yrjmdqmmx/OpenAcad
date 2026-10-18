"""PDF completeness and the observable, bounded font-outline recovery path."""
import base64
from io import BytesIO
from pathlib import Path

import pytest
from pypdf import PdfWriter

from app import export
from app.errors import AnalysisError


SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="50">科研图表</text></svg>'


def complete_pdf(*, pages=1):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=100)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize("content", [
    b"%PDF-1.5\n1 0 obj\n<< /Type /Pages /Count 1 >>\nendobj\n",
    b"%PDF-1.5\nnot a PDF object tree\n%%EOF\n",
    complete_pdf(pages=0),
])
def test_pdf_header_or_eof_alone_does_not_establish_readable_pages(content):
    with pytest.raises(AnalysisError) as error:
        export.pdf_page_count(content)
    assert error.value.detail["code"] == "EXPORT_FAILED"


def test_complete_pdf_has_a_readable_page():
    assert export.pdf_page_count(complete_pdf()) == 1


def mock_engine(monkeypatch, outputs):
    calls = []
    pending = iter(outputs)
    monkeypatch.setattr(export.shutil, "which", lambda _: "/fake/inkscape")

    def run(args, **kwargs):
        if "--version" in args:
            return "Inkscape test engine", ""
        calls.append(args)
        destination = next(arg.split("=", 1)[1] for arg in args if arg.startswith("--export-filename="))
        Path(destination).write_bytes(next(pending))
        return "", ""  # Reproduce a successful process with broken output.

    monkeypatch.setattr(export, "run_process", run)
    return calls


def render_pdf(outline=False):
    return export.render({"method": "render", "data": {"svg": SVG},
                          "params": {"format": "pdf", "outline": outline}})


def test_incomplete_pdf_retries_once_as_paths_and_reports_actual_outline(monkeypatch):
    calls = mock_engine(monkeypatch, [b"%PDF-1.5\nunfinished", complete_pdf()])
    result = render_pdf()
    assert len(calls) == 2
    assert "--export-text-to-path" not in calls[0]
    assert "--export-text-to-path" in calls[1]
    assert result["provenance"]["outline"] is True
    assert result["provenance"]["requestedOutline"] is False
    assert result["provenance"]["pdfPageCount"] == 1
    assert export.pdf_page_count(base64.b64decode(result["artifact"]["contentBase64"])) == 1
    assert [item["code"] for item in result["diagnostics"]] == ["PDF_TEXT_OUTLINED_FALLBACK"]


def test_readable_pdf_keeps_editable_text_setting_without_retry(monkeypatch):
    calls = mock_engine(monkeypatch, [complete_pdf()])
    result = render_pdf()
    assert len(calls) == 1
    assert result["provenance"]["outline"] is False
    assert result["diagnostics"] == []


def test_failed_retry_is_not_returned_as_a_successful_artifact(monkeypatch):
    calls = mock_engine(monkeypatch, [b"%PDF-1.5\nunfinished"] * 2)
    with pytest.raises(AnalysisError) as error:
        render_pdf()
    assert error.value.detail["code"] == "EXPORT_FAILED"
    assert len(calls) == 2


def test_already_outlined_incomplete_pdf_fails_without_repeating_identical_command(monkeypatch):
    calls = mock_engine(monkeypatch, [b"%PDF-1.5\nunfinished"])
    with pytest.raises(AnalysisError):
        render_pdf(outline=True)
    assert len(calls) == 1


def test_svg_export_keeps_text_and_does_not_invoke_pdf_recovery(monkeypatch):
    calls = mock_engine(monkeypatch, [SVG.encode()])
    result = export.render({"method": "render", "data": {"svg": SVG}, "params": {"format": "svg"}})
    assert len(calls) == 1
    assert result["provenance"]["outline"] is False
    assert b"<text" in base64.b64decode(result["artifact"]["contentBase64"])
    assert result["diagnostics"] == []

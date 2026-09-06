import base64
import shutil
import pytest
from app.export import sanitize, render
from app.errors import AnalysisError

SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect x="40" y="40" width="500" height="340" fill="#2171b5"/><text x="50" y="420" font-family="Noto Sans CJK SC" font-size="24">开放学术：科研图表</text></svg>'


@pytest.mark.parametrize("bad", ['<script>alert(1)</script>', '<foreignObject/>', '<image href="https://example.org/x"/>', '<rect onclick="x()"/>', '<style>@import "https://example.org";</style>', '<rect fill="url(https://example.org/x)"/>', '<style>.x{fill:u\\72l(file:///etc/passwd)}</style>'])
def test_rejects_external_resources(bad):
    with pytest.raises(AnalysisError):
        sanitize(SVG.replace("</svg>", bad+"</svg>"), {})


def test_internal_references_allowed():
    sanitize(SVG.replace("</svg>", '<defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg>'), {})


@pytest.mark.skipif(shutil.which("inkscape") is None, reason="需要 Inkscape 集成镜像")
@pytest.mark.parametrize("fmt", ["svg", "png", "pdf", "eps"])
@pytest.mark.parametrize("outline", [False, True])
def test_actual_export(fmt, outline):
    r = render({"method": "render", "data": {"svg": SVG}, "params": {"format": fmt, "dpi": 150, "outline": outline}})
    content = base64.b64decode(r["artifact"]["contentBase64"])
    assert len(content) > 100 and r["artifact"]["filename"].endswith("."+fmt)
    if fmt == "svg" and outline:
        assert b"<text" not in content


@pytest.mark.skipif(shutil.which("inkscape") is None, reason="需要 Inkscape 集成镜像")
def test_eps_transparency_explicit():
    r = render({"method": "render", "data": {"svg": SVG.replace('fill="#2171b5"', 'fill="#2171b5" opacity="0.5"')}, "params": {"format": "eps", "dpi": 150}})
    assert "EPS_ALPHA_FLATTENED" in [d["code"] for d in r["diagnostics"]]

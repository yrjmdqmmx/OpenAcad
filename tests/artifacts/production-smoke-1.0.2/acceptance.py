#!/usr/bin/env python3
"""Prepared production verifier: run seven jobs only after release approval.

The finish command is offline. No credentials are written to evidence files.
"""
import argparse
import base64
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

FROZEN_SHA = "744ac93024a8e687a963a36b4d47884fc786dcfd618fa9807e341307beec6580"


def read_json(path):
    return json.loads(path.read_text())


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def load_smoke(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != FROZEN_SHA:
        raise RuntimeError("冻结的五任务验收脚本 SHA 不符，未执行任何任务")
    spec = importlib.util.spec_from_file_location("frozen_production_smoke", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def extra_svg():
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
    <rect width="960" height="560" fill="#ffffff"/>
    <g fill="#162c3a" font-size="42" font-weight="700" font-style="italic">
      <text x="50" y="130" font-family="Noto Sans SC">开放学术：黑体粗斜体</text>
      <text x="50" y="280" font-family="Noto Serif CJK SC">开放学术：宋体粗斜体</text>
    </g>
    <line x1="50" y1="390" x2="860" y2="390" stroke="#188b98" stroke-width="3"/>
    <circle cx="80" cy="455" r="15" fill="#e39936"/>
    <text x="120" y="465" font-family="Noto Sans SC" font-size="22" fill="#162c3a">仅使用模拟文字与图形，验证本次字体导出。</text>
    </svg>'''


def run(args, smoke):
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    if (output / "report.json").exists() or (output / "baseline" / "report.json").exists():
        raise RuntimeError("验收输出已有报告；为避免重复提交 POST，禁止自动覆盖或重新执行")
    expected = read_json(args.font_manifest)
    report = {
        "schemaVersion": 1, "baseUrl": args.base_url, "release": args.release,
        "applicationSourceCommit": args.source_revision, "imageIdVerifiedByLauncher": args.image_id,
        "startedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "frozenRunnerSha256": FROZEN_SHA, "expectedFontManifest": expected,
        "status": "running", "complete": False, "cases": [],
    }
    save_json(output / "report.json", report)
    api = None
    try:
        previous = sys.argv
        try:
            sys.argv = [str(args.source), args.base_url, "--output", str(output / "baseline"),
                        "--min-workers", "2", "--timeout", "240", "--skip-independent-open"]
            code = smoke.main()
        finally:
            sys.argv = previous
        baseline = read_json(output / "baseline" / "report.json")
        report["baselineReport"] = "baseline/report.json"
        report["baselineTransportRetries"] = baseline.get("transportRetries", [])
        smoke.require(code == 0 and len(baseline["cases"]) == 5 and all(c["passed"] for c in baseline["cases"]), "五任务基线未全部通过")
        for case in baseline["cases"]:
            if case["case"] in ("png", "pdf", "eps"):
                smoke.require(case["provenance"]["availableFontsSha256"] == expected, "线上字体版本与本次冻结清单不同")
        report["cases"].extend({"case": c["case"], "passed": True, "evidence": "baseline/report.json"} for c in baseline["cases"])
        extra = output / "bold-italic"
        extra.mkdir(exist_ok=True)
        source = extra_svg()
        (extra / "source.svg").write_text(source)
        api = smoke.Api(args.base_url, 240, pooled=True)
        for fmt in ("png", "pdf"):
            payload = {"kind": "export", "method": "render", "data": {"svg": source},
                       "params": {"format": fmt, "dpi": 150, "outline": False, "filename": "模拟粗斜体验收"}}
            result = api.job(payload)
            smoke.require(result["provenance"]["availableFontsSha256"] == expected, "粗斜体任务的线上字体版本不符")
            validation = smoke.check_export(result, fmt, extra, independent=False)
            save_json(extra / (fmt + "-metadata.json"), {k: v for k, v in result.items() if k != "artifact"})
            report["cases"].append({"case": "bold-italic-" + fmt, "passed": True, "validation": validation,
                                    "provenance": result["provenance"], "diagnostics": result["diagnostics"]})
            print("粗斜体 " + fmt.upper() + " 实际任务完成，等待本机独立打开", flush=True)
        report["status"] = "partial"
        report["limitation"] = "七任务已完成；仍须 finish 离线核对数值、独立打开和确认字体，不能宣布完整通过"
    except Exception as error:
        report["status"] = "failed"
        report["error"] = re.sub(r"/api/jobs/[a-zA-Z0-9-]+", "/api/jobs/{id}", str(error))
    finally:
        report["extraTransportRetries"] = api.transport_retries if api else []
        if api:
            api.close()
        save_json(output / "report.json", report)
    print(json.dumps({"status": report["status"], "complete": False, "finishedCases": len(report["cases"])}, ensure_ascii=False))
    return 0 if report["status"] == "partial" else 1


def finish(args, smoke):
    output = args.output
    report_path = output / "report.json"
    report = read_json(report_path)
    smoke.require(report["status"] == "partial" and len(report["cases"]) == 7 and all(c["passed"] for c in report["cases"]), "线上七任务没有全部成功，不能完成本机验收")
    smoke.require(all(shutil.which(name) for name in ("pdftoppm", "pdffonts", "gs")), "需要 Poppler 和 Ghostscript 独立打开")
    checkpoint = output / "server-report-before-independent-open.json"
    if not checkpoint.exists():
        shutil.copyfile(report_path, checkpoint)
    try:
        base = output / "baseline"
        baseline = read_json(base / "report.json")
        for method in ("pca", "lm"):
            request, result = read_json(base / (method + "-request.json")), read_json(base / (method + "-result.json"))
            rows = request["data"]["tables"][0]["rows"]
            check = smoke.check_pca(result, rows) if method == "pca" else smoke.check_lm(result, rows)
            next(c for c in report["cases"] if c["case"] == method)["independentValidation"] = check
        for folder, formats in ((base, ("png", "pdf", "eps")), (output / "bold-italic", ("png", "pdf"))):
            for fmt in formats:
                result = read_json(folder / (fmt + "-metadata.json"))
                result["artifact"] = {"contentBase64": base64.b64encode((folder / ("analysis." + fmt)).read_bytes()).decode()}
                validation = smoke.check_export(result, fmt, folder, independent=True)
                name = fmt if folder == base else "bold-italic-" + fmt
                if name == "bold-italic-pdf":
                    fonts = validation["fontInspection"]
                    smoke.require(all(face in fonts for face in ("OpenAcadNotoSansCJKsc-BoldOblique", "OpenAcadNotoSerifCJKsc-BoldOblique")), "生产 PDF 未嵌入两种具名粗斜体派生面")
                    smoke.require("CairoFont" not in fonts, "生产 PDF 仍包含合成字体资源")
                next(c for c in report["cases"] if c["case"] == name)["independentValidation"] = validation
        report.update(status="passed", complete=True, independentlyCheckedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
                      independentTools={"png": "CRC/zlib/filter pixel decoder", "pdf": "Poppler", "eps": "Ghostscript"})
        report.pop("limitation", None)
    except Exception as error:
        report.update(status="failed", complete=False, independentOpenError=str(error))
    save_json(report_path, report)
    print(json.dumps({"status": report["status"], "complete": report["complete"], "cases": len(report["cases"])}, ensure_ascii=False))
    return 0 if report["complete"] else 1


def main():
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("run", "finish"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source", type=Path, default=here / "frozen-production-smoke.py")
    parser.add_argument("--font-manifest", type=Path, default=here / "expected-font-manifest.json")
    parser.add_argument("--base-url", default="https://openacad.xyz")
    parser.add_argument("--release")
    parser.add_argument("--source-revision")
    parser.add_argument("--image-id")
    args = parser.parse_args()
    if args.mode == "run":
        if not (
            args.release and re.fullmatch(r"[A-Za-z0-9._-]+", args.release) and
            args.source_revision and re.fullmatch(r"[0-9a-f]{40}", args.source_revision) and
            args.image_id and re.fullmatch(r"sha256:[0-9a-f]{64}", args.image_id)
        ):
            parser.error("run 需要已部署版本、完整源码 SHA 和实际镜像 ID")
        if args.base_url != "https://openacad.xyz":
            parser.error("生产脚本仅允许正式 HTTPS 域名，保持正常证书校验")
    smoke = load_smoke(args.source)
    return run(args, smoke) if args.mode == "run" else finish(args, smoke)


if __name__ == "__main__":
    raise SystemExit(main())

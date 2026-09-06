"""Acceptance runner: actual queued exports plus independent file decoders.

Run with a Python environment that has Pillow, Poppler and Ghostscript on PATH.
Artifacts are reproducible simulated example charts, never user research data.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

from PIL import Image, ImageChops


def request(base, path, payload=None, token=None, method=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def independent_open(path):
    with tempfile.TemporaryDirectory(prefix="openacad-open-") as tmp:
        png = Path(tmp) / "page.png"
        if path.suffix == ".pdf":
            command = ["pdftoppm", "-f", "1", "-singlefile", "-r", "72", "-png", str(path), str(png.with_suffix(""))]
        elif path.suffix == ".eps":
            command = ["gs", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pngalpha", "-r72", "-dEPSCrop", "-sOutputFile="+str(png), str(path)]
        else:
            command = None
            png = path
        if command:
            result = subprocess.run(command, capture_output=True, timeout=60)
            if result.returncode:
                raise RuntimeError(f"独立解析失败 {path.name}: {result.stderr.decode(errors='replace')[-500:]}")
        with Image.open(png) as raw:
            raw.load()
            rgba = raw.convert("RGBA")
            white = Image.new("RGBA", rgba.size, "white")
            white.alpha_composite(rgba)
            rgb = white.convert("RGB")
            background = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
            diff = ImageChops.difference(rgb, background)
            bbox = diff.getbbox()
            if not bbox:
                raise RuntimeError(f"独立解析显示为空白: {path.name}")
            return {"decoder": "Pillow" if path.suffix == ".png" else "Poppler" if path.suffix == ".pdf" else "Ghostscript", "opened": True, "rasterSize": list(rgb.size), "inkBounds": list(bbox), "touchesPageEdge": bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= rgb.width or bbox[3] >= rgb.height}


def run_one(base, source, fmt, target, params=None):
    params = {"format":fmt,"dpi":150,"outline":False, **(params or {})}
    svg = source.read_text()
    task = request(base, "/api/jobs", {"kind":"export", "method":"render", "data":{"svg":svg}, "params":params})
    path = "/api/jobs/" + task["id"]
    token = task["token"]
    try:
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            state = request(base, path, token=token)
            if state["status"] == "failed":
                raise RuntimeError(json.dumps(state.get("error"), ensure_ascii=False))
            if state["status"] == "finished":
                break
            time.sleep(.15)
        else:
            raise TimeoutError("排队导出超时")
        result = state["result"]
        data = base64.b64decode(result["artifact"]["contentBase64"], validate=True)
        target.write_bytes(data)
        opened = independent_open(target)
        return {"template": source.stem, "format":fmt, "params":params, "sourceSha256":hashlib.sha256(svg.encode()).hexdigest(), "file":str(target), "bytes":len(data), "sha256":hashlib.sha256(data).hexdigest(), "provenance":result["provenance"], "diagnostics":result["diagnostics"], **opened}
    finally:
        request(base, path, token=token, method="DELETE")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:18082")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    assert request(args.url, "/api/health")["status"] == "ok"
    args.output.mkdir(exist_ok=True, parents=True)
    sources = sorted(args.input.glob("*.svg"))
    assert sources, "没有 SVG 输入"
    report = {"schemaVersion":1, "source":"浏览器实际下载的模拟示例 SVG；真实 Redis/RQ/Inkscape 转换；独立解码。源 SVG 边界由浏览器验收另外检查。", "templateCount":len(sources), "files":[], "failures":[]}
    tasks = [(p, f) for p in sources for f in ["png","pdf","eps"]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(run_one, args.url, p, f, args.output / (p.stem + "." + f)): (p,f) for p,f in tasks}
        for future in concurrent.futures.as_completed(futures):
            source, fmt = futures[future]
            try:
                result = future.result()
                report["files"].append(result)
                print(f"{len(report['files'])}/{len(tasks)} {source.stem}.{fmt} opened", flush=True)
            except Exception as exc:
                report["failures"].append({"template":source.stem,"format":fmt,"error":str(exc)})
                print(f"FAILED {source.stem}.{fmt}: {exc}", flush=True)
            report["files"].sort(key=lambda r:(r["template"],r["format"]))
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    if report["failures"]:
        raise SystemExit(1)
    print(f"通过：{len(sources)} 个模板、{len(report['files'])} 个文件", flush=True)


if __name__ == "__main__":
    main()

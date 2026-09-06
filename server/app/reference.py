"""Generate template previews with the same real calculation entry point as jobs."""
import json
import sys
from pathlib import Path
from .analysis import run_analysis


def generate(source):
    out = {}
    for method, cases in source.items():
        out[method] = {}
        for case, entry in cases.items():
            params = entry.get("params", {})
            result = run_analysis({"kind": "analysis", "method": method, "data": entry["dataset"], "params": params})
            result["provenance"]["purpose"] = "使用模拟输入数据运行真实算法生成的模板预览"
            out[method][case] = {"method": method, "params": params, "inputHash": "", "result": result}
    return out


if __name__ == "__main__":
    result = generate(json.loads(Path(sys.argv[1]).read_text()))
    encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(encoded + "\n")
    else:
        print(encoded)

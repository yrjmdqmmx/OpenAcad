"""Read-only KEGG adapter. Receives KO identifiers only, never user tables/files.

One API process issues at most two KEGG requests per second. No Redis, paid
provider, persistent database or changes to the statistical job whitelist.
"""
import datetime as dt
import re
import threading
import time
from collections import OrderedDict
import httpx
from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

router = APIRouter(prefix="/api/bio")
BASE = "https://rest.kegg.jp"
TTL = 6 * 3600
_lock = threading.Lock()
_next_request = 0.0
_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()


class KoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(min_length=1, max_length=10)

    @field_validator("ids")
    @classmethod
    def validate_ids(cls, ids):
        if any(not re.fullmatch(r"K\d{5}", value) for value in ids):
            raise ValueError("每个 KO 编号须为大写 K 加五位数字")
        return list(dict.fromkeys(ids))


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def flat_records(text):
    """KEGG's fixed-width records; HTML/error bodies must never become no-match."""
    output = {}
    if text.strip() and not text.lstrip().startswith("ENTRY"):
        raise ValueError("数据源返回了无法识别的内容")
    for chunk in text.split("///"):
        if not chunk.strip():
            continue
        if not chunk.lstrip().startswith("ENTRY"):
            raise ValueError("数据源记录不完整")
        fields, field = {}, ""
        for line in chunk.splitlines():
            if not line.strip():
                continue
            if line[:12].strip():
                field = line[:12].strip()
            if field:
                fields.setdefault(field, []).append(line[12:].strip())
        entry = " ".join(fields.get("ENTRY", [])).split()
        if not entry:
            raise ValueError("数据源缺少 ENTRY 字段")
        output[entry[0]] = fields
    if text.strip() and not text.rstrip().endswith("///"):
        raise ValueError("数据源响应被截断，请重试")
    return output


def fetch_kegg(path):
    global _next_request
    # The lock spans the request: parallel browser tabs cannot bypass pacing.
    with _lock:
        time.sleep(max(0, _next_request - time.monotonic()))
        _next_request = time.monotonic() + 0.5
        with httpx.Client(timeout=httpx.Timeout(18, connect=6), follow_redirects=False) as client:
            response = client.get(f"{BASE}/{path}")
        if response.status_code == 404:
            return "", utcnow()
        response.raise_for_status()
        if len(response.content) > 5_000_000:
            raise ValueError("数据源响应过大，请拆分输入")
        return response.text, utcnow()


def cached_get(key):
    with _lock:
        found = _cache.get(key)
        if found and time.monotonic() - found[0] < TTL:
            _cache.move_to_end(key)
            return found[1]
        _cache.pop(key, None)
    return None


def cached_put(key, value):
    with _lock:
        _cache[key] = (time.monotonic(), value)
        _cache.move_to_end(key)
        while len(_cache) > 2048:
            _cache.popitem(last=False)


def failure_message(error):
    if isinstance(error, httpx.HTTPStatusError):
        status = error.response.status_code
        return f"KEGG 暂时拒绝查询（HTTP {status}），请稍后重试。" if status in (403, 429) else f"KEGG 查询失败（HTTP {status}），请稍后重试。"
    if isinstance(error, (httpx.TimeoutException, httpx.NetworkError)):
        return "连接 KEGG 超时或网络不可用，请稍后重试。"
    return "KEGG 返回内容不完整或格式异常，请稍后重试。"


def query_kos(ids):
    results = {ko: cached_get("ko:" + ko) for ko in ids}
    missing = [ko for ko in ids if results[ko] is None]
    if missing:
        path = "get/" + "+".join("ko:" + ko for ko in missing)
        try:
            text, fetched = fetch_kegg(path)
            records = flat_records(text)
            for ko in missing:
                fields = records.get(ko)
                pathways = {}
                for line in (fields or {}).get("PATHWAY", []):
                    match = re.fullmatch(r"(map\d{5})\s+(.+)", line)
                    if not match:
                        raise ValueError("PATHWAY 字段异常")
                    pathways[match[1]] = {"id": match[1], "name": match[2]}
                item = {"ko": ko, "status": "matched" if pathways else "unmatched", "pathways": sorted(pathways.values(), key=lambda p: p["id"]), "fetchedAt": fetched, "sourceUrl": f"{BASE}/{path}", "message": "" if pathways else ("KEGG 已收录此 KO，但未列出 pathway 对应关系。" if fields else "此次查询未返回此 KO 条目。")}
                results[ko] = item
                cached_put("ko:" + ko, item)
        except (httpx.HTTPError, ValueError) as error:
            for ko in missing:
                if results[ko] is None:
                    results[ko] = {"ko": ko, "status": "failed", "pathways": [], "fetchedAt": "", "sourceUrl": f"{BASE}/{path}", "message": failure_message(error)}
    # CLASS comes from actual pathway entries, not a guessed KO hierarchy.
    pathway_ids = sorted({p["id"] for item in results.values() for p in item["pathways"]})
    classifications = {pid: cached_get("path:" + pid) for pid in pathway_ids}
    needs_class = [pid for pid in pathway_ids if classifications[pid] is None]
    warnings = []
    for begin in range(0, len(needs_class), 10):
        batch = needs_class[begin:begin + 10]
        path = "get/" + "+".join("path:" + pid for pid in batch)
        try:
            text, fetched = fetch_kegg(path)
            records = flat_records(text)
            for pid in batch:
                if pid not in records:
                    warnings.append("部分 pathway 分类未返回，已保留 KO 与 pathway 的匹配结果。")
                    continue
                item = {"classification": "; ".join(records[pid].get("CLASS", [])), "classSourceUrl": f"{BASE}/{path}", "classFetchedAt": fetched}
                classifications[pid] = item
                cached_put("path:" + pid, item)
        except (httpx.HTTPError, ValueError):
            warnings.append("部分 pathway 分类查询失败，已保留匹配结果；重新查询可补取分类。")
            break
    # Do not mutate cached KO results when attaching auxiliary metadata.
    return {"results": [{**results[ko], "pathways": [{**p, **(classifications.get(p["id"]) or {"classification": "", "classSourceUrl": "", "classFetchedAt": ""})} for p in results[ko]["pathways"]]} for ko in ids], "warnings": list(dict.fromkeys(warnings)), "source": "KEGG REST API · KO PATHWAY / pathway CLASS", "cacheHours": TTL // 3600}


@router.post("/ko-pathways")
def ko_pathways(payload: KoRequest):
    return query_kos(payload.ids)


@router.get("/health")
def bio_health():
    return {"status": "ok", "service": "OpenAcad 生物信息学查询", "upstream": BASE, "note": "服务存活不代表 KEGG 当前可访问"}


# Standalone local development, without interrupting the existing stats worker.
dev_app = FastAPI(title="OpenAcad 生物信息学开发服务", docs_url=None, redoc_url=None)
dev_app.include_router(router)

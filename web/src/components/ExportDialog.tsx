import { useState, useRef, useEffect } from "react";
import { X, Download } from "lucide-react";
import type { Project } from "../core/types";
import { assertExportReady } from "../core/exportReadiness";
import { downloadBlob } from "../core/project";
import { createJob, waitJob, cancelJob } from "../core/api";

type ExportAttempt = {
  abort: AbortController;
  job?: { id: string; token: string };
  cancellation?: Promise<void>;
};

function cancelRemote(attempt: ExportAttempt) {
  if (!attempt.job) return Promise.resolve();
  attempt.cancellation ??= cancelJob(attempt.job.id, attempt.job.token);
  return attempt.cancellation;
}

function abortError() {
  return new DOMException("已取消导出。", "AbortError");
}

function awaitPreparation<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const stop = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", stop);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      reject(new Error("图表字体准备超时，请检查网络后重试。"));
    }, 30000);
    signal.addEventListener("abort", stop, { once: true });
    // FontFaceSet.load cannot abort its network request. Always handle its
    // eventual settlement, while the export itself stops immediately.
    promise.then(
      (value) => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", stop);
        if (signal.aborted) reject(abortError());
        else resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", stop);
        reject(signal.aborted ? abortError() : error);
      },
    );
    if (signal.aborted) stop();
  });
}

function svgFontRequests(svg: SVGSVGElement) {
  const requests = new Map<string, { family: string; characters: Set<string> }>();
  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  let text: Node | null;
  while ((text = walker.nextNode())) {
    const parent = text.parentElement;
    if (
      !parent?.closest("text") ||
      parent.closest("title, desc, style") ||
      !text.nodeValue
    ) continue;
    // Read attached text runs, including tspan overrides and mixed tree
    // annotations. A detached clone loses inherited CSS font information.
    const style = getComputedStyle(parent);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const request = requests.get(font) || {
      family: style.fontFamily,
      characters: new Set<string>(),
    };
    for (const character of text.nodeValue) request.characters.add(character);
    requests.set(font, request);
  }
  return [...requests].map(([font, request]) => ({
    font,
    family: request.family,
    text: [...request.characters].join(""),
  }));
}

function preserveStaticFontWeights(source: SVGSVGElement, clone: SVGSVGElement) {
  const original = source.querySelectorAll<SVGElement>("text, tspan, textPath");
  const copied = clone.querySelectorAll<SVGElement>("text, tspan, textPath");
  original.forEach((run, index) => {
    const style = getComputedStyle(run);
    const families = style.fontFamily.split(",").map((name) => name.trim().replace(/^["']|["']$/g, ""));
    if (!families.some((name) => ["Noto Sans SC", "Noto Sans CJK SC", "Noto Serif CJK SC"].includes(name))) return;
    const weight = Number(style.fontWeight);
    if (!Number.isFinite(weight) || weight < 1 || weight > 1000) return;
    // These families ship real 400/700 faces. Resolve the browser's match
    // explicitly: Inkscape 1.2 treats values such as 650 as Regular instead.
    // Inline computed runs also preserve inherited/relative style decisions.
    copied[index].style.setProperty("font-weight", weight <= 500 ? "400" : "700", "important");
  });
}

async function prepareSvgFonts(svg: SVGSVGElement, signal: AbortSignal) {
  // Async analysis may update the figure while its font is loading. Recheck
  // the actual runs before measuring; unrelated page fonts are never awaited.
  for (let revision = 0; revision < 3; revision++) {
    if (signal.aborted) throw abortError();
    const requests = svgFontRequests(svg);
    const loading = Promise.all(requests.map(async ({ font, family, text }) => {
      const normalize = (name: string) => name.trim().replace(/^["']|["']$/g, "");
      const requestedWebFonts = family.split(",").map(normalize).filter(
        (name) => ["Noto Sans SC", "Noto Serif CJK SC"].includes(name),
      );
      for (const name of requestedWebFonts) {
        if (![...document.fonts].some((face) => normalize(face.family) === name))
          throw new Error(`没有找到图表字体“${name}”，请刷新页面后重试。`);
      }
      try {
        const faces = await document.fonts.load(font, text);
        if (faces.some((face) => face.status !== "loaded") || !document.fonts.check(font, text))
          throw new Error("字体尚未就绪");
      } catch {
        throw new Error(`图表字体加载失败（${family}），请检查网络后重试。`);
      }
    }));
    await awaitPreparation(loading, signal);
    if (JSON.stringify(requests) === JSON.stringify(svgFontRequests(svg))) return;
  }
  throw new Error("图表仍在更新，请等待预览稳定后再导出。");
}

export function ExportDialog({
  project,
  getSVG,
  onClose,
}: {
  project: Project;
  getSVG: () => SVGSVGElement | null;
  onClose: () => void;
}) {
  const [format, setFormat] = useState("svg"),
    [dpi, setDpi] = useState(300),
    [outline, setOutline] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const task = useRef<ExportAttempt | null>(null);
  useEffect(() => () => {
    const attempt = task.current;
    if (attempt) {
      attempt.abort.abort();
      void cancelRemote(attempt).catch(() => {});
      task.current = null;
    }
  }, []);
  const source = getSVG();
  const width = source?.viewBox.baseVal.width || project.style.width,
    height = source?.viewBox.baseVal.height || project.style.height;
  async function exportImage() {
    if (task.current && !task.current.abort.signal.aborted) return;
    const attempt: ExportAttempt = { abort: new AbortController() };
    task.current = attempt;
    const current = () => task.current === attempt;
    setBusy(true);
    setError("");
    setMessage("正在准备图表字体…");
    try {
      await assertExportReady(project);
      const node = getSVG();
      if (!node) throw new Error("当前图表没有有效预览，请先修正数据。");
      await prepareSvgFonts(node, attempt.abort.signal);
      if (attempt.abort.signal.aborted || !current()) throw abortError();
      if (getSVG() !== node) throw new Error("图表预览已更新，请重新导出。");
      const svg = node.cloneNode(true) as SVGSVGElement;
      preserveStaticFontWeights(node, svg);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      const bounds = node.getBBox();
      if (
        bounds.x < -1 ||
        bounds.y < -1 ||
        bounds.x + bounds.width > width + 1 ||
        bounds.y + bounds.height > height + 1
      )
        throw new Error(
          `图形或文字超出画布。请增加边距或将画布至少调整到 ${Math.ceil(Math.max(width, bounds.x + bounds.width + 20))} × ${Math.ceil(Math.max(height, bounds.y + bounds.height + 20))} 像素后导出。`,
        );
      const content = new XMLSerializer().serializeToString(svg);
      if (format === "svg" && !outline) {
        downloadBlob(
          new Blob([content], { type: "image/svg+xml" }),
          `${project.name}.svg`,
        );
        setMessage(
          "SVG 已下载。请在目标编辑软件中安装对应的思源黑体或思源宋体（Noto），也可选择文字转曲导出。",
        );
      } else {
        setMessage("正在准备导出…");
        const job = await createJob({
          kind: "export",
          method: "render",
          data: { svg: content },
          params: {
            format,
            dpi,
            outline,
            filename: project.name,
            background: project.style.transparent
              ? "transparent"
              : project.style.background,
          },
        });
        // Keep the POST alive so cancellation cannot lose a created job's
        // credentials. If it arrives late, delete it before polling/download.
        attempt.job = job;
        if (attempt.abort.signal.aborted || !current()) {
          await cancelRemote(attempt);
          return;
        }
        const result = await waitJob(job.id, job.token, attempt.abort.signal, (s) => {
          if (current() && !attempt.abort.signal.aborted)
            setMessage(s === "queued" ? "导出排队中…" : "正在生成文件…");
        },
        );
        if (attempt.abort.signal.aborted || !current()) throw abortError();
        const artifact = result.artifact as {
          contentBase64: string;
          filename: string;
          mimeType: string;
        };
        if (!artifact?.contentBase64)
          throw new Error("导出服务没有返回文件，请重试。");
        const bytes = Uint8Array.from(atob(artifact.contentBase64), (c) =>
          c.charCodeAt(0),
        );
        downloadBlob(
          new Blob([bytes], { type: artifact.mimeType }),
          artifact.filename,
        );
        setMessage(
          "图片已下载。" +
            ((result.diagnostics || []) as { message: string }[])
              .map((d) => d.message)
              .join(" "),
        );
      }
    } catch (e) {
      if (current()) {
        if (attempt.abort.signal.aborted) setMessage("已取消导出。");
        else setError((e as Error).message);
      }
    } finally {
      if (attempt.abort.signal.aborted && attempt.job) {
        try {
          await cancelRemote(attempt);
        } catch (error) {
          if (current()) setError((error as Error).message);
        }
      }
      if (current()) {
        setBusy(false);
        task.current = null;
      }
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出图片"
      >
        <header>
          <h2>导出图片</h2>
          <button
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            aria-label="关闭"
          >
            <X />
          </button>
        </header>
        <p>图片用于投稿与分享；继续编辑请另存项目文件。</p>
        <label>
          图片格式
          <select
            value={format}
            disabled={busy}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="svg">SVG · 矢量图片</option>
            <option value="png">PNG · 位图</option>
            <option value="pdf">PDF · 矢量文档</option>
            <option value="eps">EPS · 投稿格式</option>
          </select>
        </label>
        {(format === "png" || format === "eps") && (
          <label>
            分辨率
            <select value={dpi} onChange={(e) => setDpi(+e.target.value)}>
              {[150, 300, 600].map((n) => (
                <option key={n} value={n}>
                  {n} DPI
                </option>
              ))}
            </select>
          </label>
        )}
        {format !== "png" && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={outline}
              onChange={(e) => setOutline(e.target.checked)}
            />
            文字转为路径（避免接收方字体缺失）
          </label>
        )}
        <div className="export-size">
          <strong>
            {format === "png"
              ? `${Math.round((width * dpi) / 96)} × ${Math.round((height * dpi) / 96)} 像素`
              : `${width} × ${height} 像素`}
          </strong>
          <span>
            物理尺寸 {((width / 96) * 25.4).toFixed(1)} ×{" "}
            {((height / 96) * 25.4).toFixed(1)} mm
          </span>
        </div>
        {format === "eps" && (
          <p className="notice">
            EPS
            不支持透明背景与半透明对象；使用白色背景，透明效果将按服务说明处理。
          </p>
        )}
        {(format !== "svg" || outline) && (
          <p className="hint">
            此格式使用香港服务器转换图片；临时文件最多保留一小时。
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy} onClick={exportImage}>
          <Download size={16} />
          {busy ? "正在生成…" : "下载图片"}
        </button>
        {busy && (
          <button
            className="wide"
            onClick={async () => {
              const attempt = task.current;
              if (!attempt) return;
              attempt.abort.abort();
              setBusy(false);
              setMessage("已取消导出。");
              setError("");
              try {
                await cancelRemote(attempt);
              } catch (error) {
                if (task.current === attempt) setError((error as Error).message);
              }
            }}
          >
            取消导出
          </button>
        )}
      </section>
    </div>
  );
}

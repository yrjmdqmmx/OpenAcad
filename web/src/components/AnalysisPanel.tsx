import { useEffect, useRef, useState } from "react";
import { Play, Square, Download } from "lucide-react";
import type { Project, Template } from "../core/types";
import { inputHash, downloadBlob } from "../core/project";
import { createJob, waitJob, cancelJob } from "../core/api";
const scaling = [
  ["None", "不处理"],
  ["StandardScaler", "标准分数"],
  ["MinMaxScaler", "最小最大值"],
  ["MaxAbsScaler", "最大绝对值"],
  ["RobustScaler", "稳健缩放"],
  ["PercentScaler", "百分比"],
];
const distances = [
  "euclidean",
  "braycurtis",
  "canberra",
  "chebyshev",
  "cityblock",
  "correlation",
  "cosine",
  "dice",
  "hamming",
  "jaccard",
  "jensenshannon",
  "kulczynski1",
  "kulsinski",
  "mahalanobis",
  "matching",
  "minkowski",
  "rogerstanimoto",
  "russellrao",
  "seuclidean",
  "sokalmichener",
  "sokalsneath",
  "sqeuclidean",
  "yule",
];
const eco = [
  "bray",
  "manhattan",
  "euclidean",
  "canberra",
  "clark",
  "kulczynski",
  "jaccard",
  "gower",
  "altGower",
  "morisita",
  "horn",
  "mountford",
  "raup",
  "binomial",
  "chao",
  "cao",
  "mahalanobis",
  "chisq",
  "chord",
  "hellinger",
  "aitchison",
];
const tests = [
  ["ttest_ind", "独立样本 t 检验（默认 Welch）"],
  ["ttest_rel", "配对 t 检验"],
  ["wilcoxon_ind", "Mann–Whitney U 检验"],
  ["wilcoxon_rel", "配对 Wilcoxon 符号秩"],
  ["wilcoxon_rank_sum", "秩和正态近似（无并列值）"],
  ["anova", "单因素方差分析"],
];
const names: Record<string, string> = {
  queued: "排队中",
  started: "计算中",
  running: "计算中",
  finished: "计算完成",
  columns: "变量结果",
  comparisons: "组间比较",
  edges: "关联结果",
  scores: "样本得分",
  loadings: "变量载荷",
  r: "相关系数",
  p: "原始 P 值",
  adjustedP: "校正 P 值",
  mean: "均值",
  sd: "样本标准差",
  se: "标准误",
  median: "中位数",
  n: "有效样本数",
  name: "名称",
  left: "组一",
  right: "组二",
  source: "来源",
  target: "目标",
  statistic: "统计量",
  meanDifference: "均值差",
  q1: "第一四分位数",
  q3: "第三四分位数",
  min: "最小值",
  max: "最大值",
  lowerWhisker: "下须端",
  upperWhisker: "上须端",
  missing: "缺失数",
  explainedRatio: "解释率",
  eigenvalues: "特征值",
  rowLabels: "样本名称",
  columnLabels: "变量名称",
  stress: "应力值",
  converged: "已收敛",
  tries: "尝试次数",
  method: "方法",
  formula: "公式",
  rSquared: "决定系数",
  edf: "有效自由度",
};
function shown(v: unknown): string {
  if (v === null) return "不适用";
  if (typeof v === "number")
    return Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : "未定义";
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "object")
    return Array.isArray(v) ? v.map(shown).join("，") : "详情见结果文件";
  return String(v);
}
export function ResultView({ result }: { result: Record<string, unknown> }) {
  const data = (result.data || {}) as Record<string, unknown>;
  return (
    <div className="analysis-result">
      {Object.entries(data)
        .filter(([, v]) => v !== undefined)
        .map(([key, val]) => {
          if (Array.isArray(val)) {
            if (!val.length) return null;
            const records =
              typeof val[0] === "object" &&
              !Array.isArray(val[0]) &&
              val[0] !== null;
            const keys = records
              ? Object.keys(val[0]).filter((k) => typeof val[0][k] !== "object")
              : [];
            return (
              <details
                key={key}
                open={["comparisons", "edges", "columns"].includes(key)}
              >
                <summary>
                  {names[key] || key}（{val.length}）
                </summary>
                {records && keys.length ? (
                  <div className="result-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {keys.map((k) => (
                            <th key={k}>{names[k] || k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {val.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            {keys.map((k) => (
                              <td key={k}>{shown(r[k])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="result-lines">
                    {val.slice(0, 50).map((v, i) => (
                      <div key={i}>{shown(v)}</div>
                    ))}
                  </div>
                )}
              </details>
            );
          }
          if (typeof val !== "object")
            return (
              <p key={key}>
                <strong>{names[key] || key}：</strong>
                {shown(val)}
              </p>
            );
          return null;
        })}
      <button
        onClick={() =>
          downloadBlob(
            new Blob([JSON.stringify(result, null, 2)], {
              type: "application/json",
            }),
            "OpenAcad-统计结果.json",
          )
        }
      >
        <Download size={14} />
        下载完整统计结果
      </button>
      <details>
        <summary>方法、参数与软件版本</summary>
        <pre>{JSON.stringify(result.provenance, null, 2)}</pre>
      </details>
    </div>
  );
}
export function AnalysisPanel({
  project,
  template,
  commit,
  stale,
}: {
  project: Project;
  template: Template;
  commit: (p: Project) => void;
  stale: boolean;
}) {
  const options = template.analysisMethods || [];
  const method = project.analysis?.method || options[0]?.method || "";
  const selected = options.find((m) => m.method === method) || options[0];
  const params = {
    ...(selected?.params || {}),
    ...(project.analysis?.params || {}),
  };
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const task = useRef<{
      id: string;
      token: string;
      abort: AbortController;
    } | null>(null),
    current = useRef(project);
  current.current = project;
  useEffect(
    () => () => {
      task.current?.abort.abort();
    },
    [],
  );
  const setParam = (key: string, value: unknown) =>
    commit({
      ...project,
      analysis: {
        method,
        params: { ...params, [key]: value },
        inputHash: project.analysis?.inputHash || "",
        result: project.analysis?.result,
      },
    });
  function select(
    label: string,
    key: string,
    values: string[][],
    fallback: string,
  ) {
    return (
      <label className="analysis-control">
        {label}
        <select
          value={String(params[key] ?? fallback)}
          onChange={(e) =>
            setParam(
              key,
              ["permutations", "scaling"].includes(key)
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        >
          {values.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function num(
    label: string,
    key: string,
    fallback: number,
    min: number,
    max: number,
    step = 1,
  ) {
    return (
      <label className="analysis-control">
        {label}
        <input
          type="number"
          value={Number(params[key] ?? fallback)}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setParam(key, +e.target.value)}
        />
      </label>
    );
  }
  async function run() {
    setError("");
    setBusy(true);
    setStatus("准备计算");
    const snapshot = current.current;
    try {
      const hash = await inputHash(snapshot.dataset, method, params);
      const payload = template.prepareAnalysis?.(
        method,
        snapshot.dataset,
        params,
      ) || {
        data: {
          tables: snapshot.dataset.tables,
          sequences: snapshot.dataset.text,
        },
        params,
      };
      const job = await createJob({ kind: "analysis", method, ...payload });
      const abort = new AbortController();
      task.current = { ...job, abort };
      const result = await waitJob(job.id, job.token, abort.signal, (s) =>
        setStatus(names[s] || s),
      );
      const now = current.current;
      const currentParams = {
        ...(selected?.params || {}),
        ...(now.analysis?.params || {}),
      };
      const currentMethod = now.analysis?.method || selected?.method;
      if (
        (await inputHash(
          now.dataset,
          currentMethod || method,
          currentParams,
        )) !== hash
      ) {
        setError(
          "计算期间数据或参数已变化，本次结果未应用。请用当前数据重新计算。",
        );
      } else {
        commit({
          ...now,
          analysis: { method, params, inputHash: hash, result },
        });
        setStatus("计算完成");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      task.current = null;
    }
  }
  if (project.style.ordinationInput === "scores")
    return (
      <div className="analysis-panel">
        <h3>已有坐标绘图</h3>
        <p>
          当前直接展示上传的坐标，不执行统计，也不会生成解释率或 P
          值。需要从原始数据计算时，在右侧将输入内容切换为原始矩阵。
        </p>
      </div>
    );
  if (!options.length)
    return (
      <div className="analysis-panel">
        <h3>绘图与计算</h3>
        <p>此模板直接展示你提供的数据，不执行推断统计。</p>
        <p className="hint">
          比例、集合或描述统计会在图表说明中单独注明。预先计算的 P
          值不会被当作本站检验结果。
        </p>
      </div>
    );
  return (
    <div className="analysis-panel">
      <h3>真实统计计算</h3>
      <label className="analysis-control">
        分析方法
        <select
          value={method}
          disabled={busy}
          onChange={(e) => {
            const m = options.find((m) => m.method === e.target.value)!;
            commit({
              ...project,
              analysis: {
                method: m.method,
                params: m.params || {},
                inputHash: "",
                result: undefined,
              },
            });
          }}
        >
          {options.map((m) => (
            <option key={m.method} value={m.method}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <p className="help-copy">{selected?.description}</p>
      {[
        "pca",
        "pcoa",
        "nmds",
        "cca",
        "rda",
        "cluster",
        "distance",
        "standardize",
      ].includes(method) && (
        <>
          {select("标准化", "standardization", scaling, "None")}
          {select(
            "标准化方向",
            "direction",
            [
              ["column", "按变量列"],
              ["row", "按样本行"],
            ],
            "column",
          )}
        </>
      )}
      {["correlation", "mantel"].includes(method) &&
        select(
          "相关方法",
          "correlation",
          [
            ["pearson", "Pearson"],
            ["spearman", "Spearman"],
            ["kendall", "Kendall"],
          ],
          "pearson",
        )}
      {(["tests", "correlation"].includes(method) ||
        method.startsWith("mantel")) &&
        select(
          "多重检验校正",
          "pAdjust",
          [
            ["none", "不校正"],
            ["BH", "Benjamini–Hochberg"],
            ["holm", "Holm"],
            ["bonferroni", "Bonferroni"],
          ],
          "none",
        )}
      {method === "tests" && (
        <>
          {select("检验类型", "test", tests, "ttest_ind")}
          {select(
            "比较集合",
            "comparisons",
            [
              ["all", "全部两两比较"],
              ["first", "与第一组比较"],
            ],
            "all",
          )}
          {select(
            "备择假设",
            "alternative",
            [
              ["two-sided", "双侧"],
              ["less", "小于"],
              ["greater", "大于"],
            ],
            "two-sided",
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!params.equalVariance}
              onChange={(e) => setParam("equalVariance", e.target.checked)}
            />
            独立 t 使用等方差 Student
          </label>
        </>
      )}
      {["pcoa", "cluster", "distance"].includes(method) &&
        select(
          "通用距离",
          "distance",
          distances.map((v) => [v, v]),
          "euclidean",
        )}
      {["cluster", "distance"].includes(method) &&
        select(
          "计算方向",
          "axis",
          [
            ["row", "行"],
            ["column", "列"],
            ["both", "行和列"],
          ],
          "both",
        )}
      {method === "cluster" &&
        select(
          "聚类连接方法",
          "linkage",
          [
            ["complete", "最远距离"],
            ["single", "最近距离"],
            ["average", "平均距离"],
            ["weighted", "加权平均"],
            ["centroid", "质心"],
            ["median", "中位数"],
            ["ward", "Ward 最小方差"],
          ],
          "complete",
        )}
      {["cca", "rda"].includes(method) &&
        select(
          "排序得分缩放",
          "scaling",
          [
            ["1", "Ⅰ型：侧重样本距离"],
            ["2", "Ⅱ型：侧重变量关系"],
          ],
          "2",
        )}
      {method === "pcoa" &&
        select(
          "负特征值校正",
          "correction",
          [
            ["none", "不校正（保留诊断）"],
            ["lingoes", "Lingoes"],
            ["cailliez", "Cailliez"],
          ],
          "none",
        )}
      {method === "nmds" && (
        <>
          {select(
            "生态距离",
            "distance",
            eco.map((v) => [v, v]),
            "bray",
          )}
          {num("最多起点数", "tryMax", 100, 20, 100)}
          {num("伪计数（仅显式添加）", "pseudocount", 0, 0, 10, 0.01)}
        </>
      )}
      {method.startsWith("mantel") && (
        <>
          {select(
            "群落生态距离",
            "speciesDistance",
            eco.map((v) => [v, v]),
            "bray",
          )}
          {select(
            "环境生态距离",
            "environmentDistance",
            eco.map((v) => [v, v]),
            "euclidean",
          )}
          {method === "mantel.partial" &&
            select(
              "控制矩阵生态距离",
              "controlDistance",
              eco.map((v) => [v, v]),
              "euclidean",
            )}
          {select(
            "置换次数",
            "permutations",
            [
              ["999", "999"],
              ["9999", "9999"],
              ["99999", "99999"],
            ],
            "999",
          )}
          <p className="hint">
            检验正关联，单侧。Partial 模式必须提供独立控制矩阵。
          </p>
        </>
      )}
      {(method === "nmds" || method.startsWith("mantel")) &&
        num("随机种子", "seed", 1, 0, 2147483647)}
      {method === "loess" && num("邻域比例", "span", 0.5, 0.1, 1, 0.05)}
      {method === "gam" && num("最大基函数维数", "basisDimension", 10, 3, 100)}
      {["lm", "loess", "gam"].includes(method) &&
        num("置信水平", "confidence", 0.95, 0.5, 0.999, 0.01)}
      {method === "density" && (
        <>
          {select(
            "带宽规则",
            "bandwidth",
            [
              ["scott", "Scott"],
              ["silverman", "Silverman"],
            ],
            "scott",
          )}
          {num("规则带宽倍率", "bandwidthMultiplier", 1, 0.1, 4, 0.1)}
          <label className="check-row">
            <input
              type="checkbox"
              checked={params.trim !== false}
              onChange={(e) => setParam("trim", e.target.checked)}
            />
            限制在观测范围
          </label>
          {num("估计网格点数", "points", 512, 32, 2048)}
          {num("分箱数", "bins", 30, 2, 200)}
        </>
      )}
      {method === "gc" && (
        <>
          {num("GC 含量窗口", "contentWindow", 2000, 1, 1000000)}
          {num("GC 偏斜窗口", "skewWindow", 2000, 1, 1000000)}
        </>
      )}
      <p className="hint">
        点击计算后，所选数据会发送至 OpenAcad
        香港服务器；完成后最多保留一小时。保存项目可留存结果。
      </p>
      <div className="button-row">
        <button className="primary" disabled={busy} onClick={run}>
          <Play size={14} />
          {busy ? "正在计算…" : "开始计算"}
        </button>
        {busy && (
          <button
            onClick={async () => {
              if (task.current) {
                try {
                  await cancelJob(task.current.id, task.current.token);
                  task.current.abort.abort();
                  setStatus("已取消");
                } catch (e) {
                  setError((e as Error).message);
                }
              }
            }}
          >
            <Square size={14} />
            取消
          </button>
        )}
      </div>
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {stale && project.analysis?.result && (
        <p className="notice">
          数据或参数已改变，需要重新计算。旧结果已停止用于预览。
        </p>
      )}
      {project.analysis?.result && !stale && (
        <>
          <h3>计算结果</h3>
          {Array.isArray(project.analysis.result.diagnostics) &&
            (project.analysis.result.diagnostics as { message: string }[]).map(
              (d, i) => (
                <p className="notice" key={i}>
                  {d.message}
                </p>
              ),
            )}
          <ResultView result={project.analysis.result} />
        </>
      )}
    </div>
  );
}

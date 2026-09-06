/** Deterministic statistics used by the SVG renderers. No fabricated analysis results. */
export function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
export function sampleSd(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1),
  );
}
export function quantile(values: number[], p: number) {
  const a = [...values].sort((x, y) => x - y);
  if (!a.length) return NaN;
  const i = (a.length - 1) * p,
    lo = Math.floor(i);
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo);
}
export function boxSummary(values: number[]) {
  const a = [...values].sort((x, y) => x - y),
    q1 = quantile(a, 0.25),
    median = quantile(a, 0.5),
    q3 = quantile(a, 0.75),
    iqr = q3 - q1;
  const inner = a.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  return {
    q1,
    median,
    q3,
    low: inner[0],
    high: inner[inner.length - 1],
    outliers: a.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr),
  };
}
export function extent(values: number[], zero = false): [number, number] {
  if (!values.length) return [0, 1];
  let a = Math.min(...values),
    b = Math.max(...values);
  if (zero) {
    a = Math.min(a, 0);
    b = Math.max(b, 0);
  }
  if (a === b) {
    const d = Math.abs(a) * 0.1 || 1;
    a -= d;
    b += d;
  }
  return [a, b];
}
/** SciPy-equivalent one-dimensional Gaussian KDE on an inclusive, evenly spaced grid. */
export function gaussianKde(
  values: number[],
  bandwidth: number,
  domain: [number, number],
  points = 512,
) {
  if(values.length<2||Math.max(...values)===Math.min(...values))throw Error("核密度至少需要两个不相同的有限观测。");
  if(!Number.isFinite(bandwidth)||bandwidth<=0)throw Error("核密度带宽必须大于 0。");
  const count = Math.max(2, Math.round(points));
  const h = Math.max(bandwidth, 1e-10);
  return Array.from({ length: count }, (_, i) => {
    const x = domain[0] + (i / (count - 1)) * (domain[1] - domain[0]);
    return {
      x,
      density:
        values.reduce(
          (sum, v) => sum + Math.exp(-0.5 * ((x - v) / h) ** 2),
          0,
        ) /
        (values.length * h * Math.sqrt(2 * Math.PI)),
    };
  });
}
export function scottBandwidth(values: number[]) {
  return sampleSd(values) * values.length ** (-1 / 5);
}
/** SciPy silverman_factor for d=1, deliberately distinct from R bw.nrd0. */
export function silvermanBandwidth(values: number[]) {
  return sampleSd(values) * ((3 * values.length) / 4) ** (-1 / 5);
}
export function kdeBandwidth(
  values: number[],
  method = "scott",
  multiplier = 1,
) {
  return (
    (method === "silverman"
      ? silvermanBandwidth(values)
      : scottBandwidth(values)) * multiplier
  );
}
export function kdeDomain(values: number[], trim = true): [number, number] {
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const populationSd =
    sampleSd(values) * Math.sqrt((values.length - 1) / values.length);
  return trim ? [lo, hi] : [lo - 3 * populationSd, hi + 3 * populationSd];
}

/** Student-t quantile from a convergent incomplete-beta CDF; finite samples are not replaced by 1.96. */
function logGamma(z: number): number {
  const p = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5)
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  z--;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
  );
}
function betaFraction(a: number, b: number, x: number) {
  let c = 1,
    d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 250; m++) {
    let aa = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
}
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log1p(-x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaFraction(a, b, x)) / a
    : 1 - (bt * betaFraction(b, a, 1 - x)) / b;
}
export function studentTCdf(t: number, df: number) {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}
export function studentT975(df: number) {
  let lo = 0,
    hi = 1;
  while (studentTCdf(hi, df) < 0.975 && hi < 1e8) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < 0.975) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function errorAmount(sd: number, n: number, type: string) {
  return type === "se"
    ? sd / Math.sqrt(n)
    : type === "ci"
      ? (studentT975(n - 1) * sd) / Math.sqrt(n)
      : sd;
}
export function jitter(index: number, seed = 0) {
  const x = Math.sin((index + 1) * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x) - 0.5;
}

/** Exact equal-width bins; left closed/right open, final bin includes the maximum. */
export function histogramBins(
  values: number[],
  domain: [number, number],
  count: number,
) {
  const n = Math.max(1, Math.round(count)),
    [lo, hi] = domain,
    width = (hi - lo) / n;
  const bins = Array.from({ length: n }, (_, i) => ({
    start: lo + i * width,
    end: lo + (i + 1) * width,
    count: 0,
  }));
  if (!(width > 0)) return bins;
  for (const v of values)
    if (v >= lo && v <= hi)
      bins[Math.min(n - 1, Math.floor((v - lo) / width))].count++;
  return bins;
}

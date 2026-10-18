import type { ChartStyle, Dataset, Issue } from '../../core/types';

export const MAGNETIC_PARAMS: Record<string, unknown> = {
  axis_len: 390, scan_dx: 5, scan_z0: 2.5, scan_z1: 25, scan_dz: 1,
  th_km: 4, win_km: 90, min_pts: 25, strike_ext_km: 500,
  smooth: 1.2, inc: 33.8, dec: -2.5,
};
export const magneticSampleFiles = [
  {role: 'magnetic-curve', name: 'magnetic-curve.csv', url: '/examples/magnetic-correlation/magnetic-curve.csv'},
  {role: 'magnetic-profile', name: 'magnetic-profile.csv', url: '/examples/magnetic-correlation/magnetic-profile.csv'},
  {role: 'magnetic-track', name: 'magnetic-track.json', url: '/examples/magnetic-correlation/magnetic-track.json'},
];
export interface MagneticTrack { name: string; poly: [number, number][] }
export interface MagneticData {
  curve: {dist_km: number; mag_nT: number}[];
  profile: {s_km: number; bathy_m: number; basement_km: number}[];
  track: MagneticTrack;
}
export interface MagneticResult {
  method?: string;
  xs: number[];
  zs: number[];
  correlation: (number | null)[][];
  bearing: number;
  params: Record<string, unknown>;
  diagnostics?: string[];
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Accept the original script's {OBS93:{poly:…}} as well as a single {name,poly} track. */
export function parseMagneticTrack(text: string, requestedName?: string): MagneticTrack {
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error('测线位置 JSON 无法解析，请检查引号、括号和逗号。'); }
  if (!object(input)) throw new Error('测线 JSON 须为对象，例如 {"OBS93":{"poly":[[114,22],[117,19]]}}。');
  let name = typeof input.name === 'string' ? input.name : '测线';
  let selected = input;
  if (!Array.isArray(input.poly)) {
    const choices = Object.keys(input).filter(key => object(input[key]) && Array.isArray((input[key] as Record<string, unknown>).poly));
    if (requestedName && !choices.includes(requestedName)) throw new Error(`JSON 中没有测线“${requestedName}”，请核对测线名称。`);
    if (requestedName && choices.includes(requestedName)) name = requestedName;
    else if (choices.length === 1) name = choices[0];
    else if (choices.length > 1) throw new Error(`JSON 包含多条测线（${choices.join('、')}），请在计算参数中指定测线名。`);
    else throw new Error('测线 JSON 缺少 poly 经纬度数组。');
    selected = input[name] as Record<string, unknown>;
  }
  if (!Array.isArray(selected.poly) || selected.poly.length < 2) throw new Error('poly 至少需要两个 [经度, 纬度] 点。');
  const poly = selected.poly.map((point, index): [number, number] => {
    if (!Array.isArray(point) || point.length !== 2 || point.some(v => typeof v !== 'number' || !Number.isFinite(v)))
      throw new Error(`测线第 ${index + 1} 点须为两个有限数字 [经度, 纬度]。`);
    const [lon, lat] = point as [number, number];
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error(`测线第 ${index + 1} 点经纬度超出范围。`);
    return [lon, lat];
  });
  if (poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) throw new Error('测线首尾不能重合，否则无法计算方位角。');
  return { name, poly };
}

export function magneticInput(dataset: Dataset, params: Record<string, unknown> = {}): MagneticData {
  const getRows = (role: string, columns: string[], minRows: number) => {
    const table = dataset.tables.find(t => t.role === role);
    if (!table) throw new Error(role === 'magnetic-curve' ? '请上传磁异常曲线 CSV。' : '请上传海底和基底 CSV。');
    const missing = columns.filter(c => !table.columns.includes(c));
    if (missing.length) throw new Error(`${table.name} 缺少列：${missing.join('、')}。`);
    if (table.rows.length < minRows) throw new Error(`${table.name} 至少需要 ${minRows} 行。`);
    const result = table.rows.map((row, i) => Object.fromEntries(columns.map(c => {
      const value = row[table.columns.indexOf(c)];
      if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error(`${table.name} 第 ${i + 2} 行 ${c} 必须是有限数字。`);
      return [c, Number(value)];
    })));
    const distance = columns[0];
    result.forEach((row, i) => {
      if (row[distance] < 0 || (i > 0 && row[distance] <= result[i - 1][distance])) throw new Error(`${table.name} 的 ${distance} 必须非负且严格递增（第 ${i + 2} 行）。`);
    });
    return result;
  };
  const curve = getRows('magnetic-curve', ['dist_km', 'mag_nT'], 3) as MagneticData['curve'];
  const profile = getRows('magnetic-profile', ['s_km', 'bathy_m', 'basement_km'], 2) as MagneticData['profile'];
  const file = dataset.files?.find(f => f.role === 'magnetic-track');
  if (!file) throw new Error('请上传测线位置 JSON。');
  const lineName = params.line_name || params.track_name;
  const track = parseMagneticTrack(file.text, typeof lineName === 'string' ? lineName : undefined);
  return {curve, profile, track};
}
export function validateMagneticData(dataset: Dataset): Issue[] {
  try {
    const file = dataset.files?.find(f => f.role === 'magnetic-track');
    let name: string | undefined;
    if (file) {
      const raw = JSON.parse(file.text);
      if (object(raw) && !Array.isArray(raw.poly)) name = Object.keys(raw).find(key => object(raw[key]) && Array.isArray((raw[key] as Record<string, unknown>).poly));
    }
    magneticInput(dataset, {line_name: name}); return [];
  }
  catch (e) { return [{message: e instanceof Error ? e.message : String(e), severity: 'error'}]; }
}
export function prepareMagneticAnalysis(_method: string, dataset: Dataset, params: Record<string, unknown>) {
  const {line_name: _lineName, track_name: _trackName, ...calculationParams} = params;
  return {data: magneticInput(dataset, params) as unknown as Record<string, unknown>, params: {...MAGNETIC_PARAMS, ...calculationParams}};
}
/** Kept as an explicit helper for callers that persist calculation settings in chart styles. */
export function magneticParams(style: Partial<ChartStyle>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(MAGNETIC_PARAMS).map(([key, fallback]) => [key, style[`magnetic_${key}`] ?? fallback]));
}
export function magneticResult(result: Record<string, unknown> | undefined): MagneticResult | undefined {
  const data = result && (object(result.data) ? result.data : result);
  if (!data || !Array.isArray(data.xs) || !Array.isArray(data.zs) || !Array.isArray(data.correlation)) return;
  if (data.xs.length < 1 || data.zs.length < 1 || data.correlation.length !== data.zs.length) return;
  if (data.xs.some(x => typeof x !== 'number' || !Number.isFinite(x)) || data.zs.some(z => typeof z !== 'number' || !Number.isFinite(z))) return;
  if (data.correlation.some(row => !Array.isArray(row) || row.length !== (data.xs as unknown[]).length || row.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v))))) return;
  return {...data, params: object(data.params) ? data.params : {}} as unknown as MagneticResult;
}
export function parseFaults(text: string): {name: string; x: number}[] {
  return text.split(/[;,，；\n]+/).map(part => part.trim()).filter(Boolean).flatMap(part => {
    const match = part.match(/^([^:=：]+)\s*[:=：]\s*(-?\d+(?:\.\d+)?)$/);
    return match ? [{name: match[1].trim(), x: Number(match[2])}] : [];
  });
}
export function mohoAt(x: number, nw: number, se: number, mid: number, width: number) {
  return se + (nw - se) / (1 + Math.exp((x - mid) / Math.max(.01, width)));
}

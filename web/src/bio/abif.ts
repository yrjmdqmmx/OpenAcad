/** ABIF v1 directory parser. No network, no guessing of dye order or missing QVs. */
export type Base = "A" | "C" | "G" | "T";
export type Ab1 = {
  filename: string; version: number; sequence: string; callSet: number;
  locations: number[] | null; qualities: number[] | null;
  traces: Record<Base, number[]> | null; channelOrder: string;
  metadata: { label: string; value: string }[]; warnings: string[];
};
type Entry = { tag: string; number: number; type: number; size: number; count: number; bytes: number; offset: number };
const fail = (message: string): never => { throw new Error(message); };

export function parseAb1(buffer: ArrayBuffer, filename = "sample.ab1"): Ab1 {
  if (!/\.ab1$/i.test(filename)) fail("不支持的文件格式，请选择 .ab1 测序文件。");
  if (buffer.byteLength > 20 * 1024 * 1024) fail("AB1 文件超过 20 MB，请选择单条 Sanger 测序文件。");
  if (buffer.byteLength < 34) fail("文件损坏或不完整：缺少 ABIF 文件头。");
  const view = new DataView(buffer);
  const bytes = (start: number, count: number) => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count < 0 || start + count > view.byteLength) fail("文件损坏：数据偏移超出文件边界。");
    return new Uint8Array(buffer, start, count);
  };
  const decode = (b: Uint8Array) => new TextDecoder().decode(b);
  if (decode(bytes(0, 4)) !== "ABIF") fail("不支持的文件内容：未找到 ABIF 标识，改扩展名不能转换文件格式。");
  const version = view.getUint16(4);
  if (version < 100 || version >= 200) fail(`暂不支持 ABIF ${version / 100} 版本；当前支持 ABIF 1.x。`);
  const entryAt = (pos: number): Entry => {
    bytes(pos, 28);
    const e = { tag: decode(bytes(pos, 4)), number: view.getUint32(pos + 4), type: view.getUint16(pos + 8), size: view.getUint16(pos + 10), count: view.getUint32(pos + 12), bytes: view.getUint32(pos + 16), offset: view.getUint32(pos + 20) };
    if (e.bytes <= 4) e.offset = pos + 20;
    bytes(e.offset, e.bytes);
    if (e.count * e.size > e.bytes) fail(`文件损坏：${e.tag}${e.number} 的元素长度与数据大小不一致。`);
    return e;
  };
  const root = entryAt(6);
  if (root.size !== 28 || root.count > 8192 || !root.count) fail("文件目录不受支持或已损坏。");
  const entries = new Map<string, Entry>();
  for (let i = 0; i < root.count; i++) {
    const e = entryAt(root.offset + i * 28), key = e.tag + e.number;
    if (entries.has(key)) fail(`文件损坏：目录项 ${key} 重复。`);
    entries.set(key, e);
  }
  const text = (key: string) => {
    const e = entries.get(key);
    if (!e) return "";
    const raw = bytes(e.offset, e.bytes);
    return decode(e.type === 18 ? raw.slice(1, 1 + (raw[0] ?? 0)) : raw).replace(/\0.*$/s, "").trim();
  };
  const numeric = (key: string): number[] | null => {
    const e = entries.get(key);
    if (!e) return null;
    const expectedSize = ({ 1: 1, 2: 1, 3: 2, 4: 2, 5: 4 } as Record<number, number>)[e.type];
    if (!expectedSize || e.size !== expectedSize || e.count > 2_000_000) fail(`不支持或损坏的数据字段：${key}。`);
    return Array.from({ length: e.count }, (_, i) => {
      const at = e.offset + i * e.size;
      return e.type === 3 ? view.getUint16(at) : e.type === 4 ? view.getInt16(at) : e.type === 5 ? view.getInt32(at) : view.getUint8(at);
    });
  };
  const warnings: string[] = [];
  const callSet = entries.has("PBAS2") ? 2 : 1;
  const sequence = text(`PBAS${callSet}`).toUpperCase();
  if (!sequence) fail("文件缺少可用的碱基序列（PBAS），可能尚未完成碱基识别或不是测序 AB1 文件。");
  if (sequence.length > 100_000 || !/^[ACGTRYSWKMBDHVN]+$/.test(sequence)) fail("碱基序列包含不支持的字符或长度异常，无法可靠解析。");
  if (callSet === 1) warnings.push("未提供原始碱基识别集 PBAS2，当前显示 PBAS1 编辑序列及同组位置/质量字段。");
  let qualities = numeric(`PCON${callSet}`);
  let locations = numeric(`PLOC${callSet}`);
  if (!qualities || qualities.length !== sequence.length) { warnings.push("质量字段 PCON 缺失或长度与序列不一致；质量显示为缺失，不按 0 分处理。"); qualities = null; }
  const channelOrder = text("FWO_1");
  let traces: Ab1["traces"] = null;
  if (channelOrder.length === 4 && new Set(channelOrder).size === 4 && /^[ACGT]+$/.test(channelOrder)) {
    const values = [9, 10, 11, 12].map(i => numeric(`DATA${i}`));
    if (values.every(v => v && v.length > 0 && v.length === values[0]?.length)) traces = Object.fromEntries(values.map((v, i) => [channelOrder[i], v])) as Ab1["traces"];
    else warnings.push("分析峰图 DATA9–12 缺失或通道长度不一致；仍可查看并导出序列。");
  } else warnings.push("缺少可靠的 FWO_ 染料通道顺序，无法将峰图标记为 A/C/G/T；仍可查看序列与质量。");
  const traceLength = traces?.A.length;
  if (!locations || locations.length !== sequence.length || locations.some((p, i) => p < 0 || (i > 0 && p < locations![i - 1]) || (traceLength !== undefined && p >= traceLength))) {
    warnings.push("峰位置 PLOC 缺失、越界或与序列不对应；已停用峰图联动，避免错配碱基。"); locations = null;
  }
  const dateTime = (key: string) => {
    const e = entries.get(key);
    if (!e || e.bytes < 4) return "";
    if (e.type === 10) return `${view.getUint16(e.offset)}-${String(view.getUint8(e.offset + 2)).padStart(2, "0")}-${String(view.getUint8(e.offset + 3)).padStart(2, "0")}`;
    if (e.type === 11) return [0, 1, 2].map(i => String(view.getUint8(e.offset + i)).padStart(2, "0")).join(":");
    return "";
  };
  const metadata = [["样本名称", text("SMPL1")], ["仪器名称", text("MCHN1")], ["仪器型号", text("MODL1")], ["泳道 / 孔位", text("TUBE1")], ["染料", text("DySN1")], ["运行开始", [dateTime("RUND1"), dateTime("RUNT1")].filter(Boolean).join(" ")], ["运行结束", [dateTime("RUND2"), dateTime("RUNT2")].filter(Boolean).join(" ")]].filter(([, value]) => value).map(([label, value]) => ({ label, value }));
  if (!text("SMPL1")) warnings.push("文件未提供样本名称（SMPL1），使用文件名识别。");
  return { filename, version, sequence, callSet, locations, qualities, traces, channelOrder, metadata, warnings };
}

export function fasta(data: Ab1) {
  const id = data.filename.replace(/\.ab1$/i, "").replace(/[\s>\r\n]/g, "_");
  return `>${id}\n${data.sequence.match(/.{1,80}/g)?.join("\n")}\n`;
}

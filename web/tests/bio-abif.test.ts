import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import golden from "../src/bio/__fixtures__/biopython-golden.json";
import { fasta, parseAb1 } from "../src/bio/abif";

function sample(name = "3730") { const b = readFileSync(new URL(`../public/examples/bio/${name}.ab1`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
function entry(buffer: ArrayBuffer, name: string) { const v = new DataView(buffer), root = v.getUint32(26), n = v.getUint32(18); for (let i = 0; i < n; i++) { const pos = root + i * 28; if (new TextDecoder().decode(new Uint8Array(buffer, pos, 4)) + v.getUint32(pos + 4) === name) return pos; } throw new Error("fixture tag missing"); }
function remove(buffer: ArrayBuffer, name: string) { new Uint8Array(buffer).set(new TextEncoder().encode("TEST"), entry(buffer, name)); }
describe("ABIF 与独立 Biopython 1.87 真实样本逐字段核对", () => {
  for (const [name, expected] of Object.entries(golden.samples)) it(`${name}: 序列、全部质量、全部峰位置和四通道完整哈希`, () => {
    const raw = sample(name), result = parseAb1(raw, name + ".ab1");
    expect(createHash("sha256").update(new Uint8Array(raw)).digest("hex")).toBe(expected.sha256);
    expect(result.sequence).toBe(expected.sequence);
    expect(result.qualities).toEqual(expected.qualities);
    expect(result.locations).toEqual(expected.locations);
    expect(result.channelOrder).toBe(expected.channelOrder);
    expect(result.metadata.find(m => m.label === "样本名称")?.value).toBe(expected.sample);
    for (const base of ["A", "C", "G", "T"] as const) {
      expect(result.traces![base]).toHaveLength(expected.traceLength);
      expect(createHash("sha256").update(JSON.stringify(result.traces![base])).digest("hex")).toBe(expected.traceHashes[base]);
      for (const pos of result.locations!) expect(result.traces![base][pos]).toBeDefined();
    }
    expect(fasta(result).split("\n").slice(1).join("")).toBe(expected.sequence);
  });
});
describe("损坏、未知格式和可恢复缺失字段", () => {
  it("拒绝错误扩展名、错误签名和截断目录", () => {
    expect(() => parseAb1(sample(), "a.csv")).toThrow(/格式/);
    expect(() => parseAb1(new ArrayBuffer(40))).toThrow(/ABIF/);
    expect(() => parseAb1(sample().slice(0, 100))).toThrow(/损坏/);
  });
  it("拒绝越界偏移与不支持的主版本", () => {
    const b = sample(); new DataView(b).setUint32(entry(b, "DATA9") + 20, b.byteLength + 1);
    expect(() => parseAb1(b)).toThrow(/边界/);
    const c = sample(); new DataView(c).setUint16(4, 201); expect(() => parseAb1(c)).toThrow(/版本/);
  });
  it("质量缺失时不伪造为0，不借用另一套PCON", () => {
    const b = sample(); remove(b, "PCON2"); const r = parseAb1(b);
    expect(r.qualities).toBeNull(); expect(r.sequence).toBe(golden.samples["3730"].sequence); expect(r.warnings.join()).toMatch(/质量/);
  });
  it("位置缺失时禁止序列峰图错配", () => { const b = sample(); remove(b, "PLOC2"); const r = parseAb1(b); expect(r.locations).toBeNull(); expect(r.traces).not.toBeNull(); });
  it("不猜测染料顺序；按FWO_改变映射", () => {
    const b = sample(), v = new DataView(b), pos = entry(b, "FWO_1"); new Uint8Array(b).set(new TextEncoder().encode("ACGT"), pos + 20);
    const r = parseAb1(b); expect(createHash("sha256").update(JSON.stringify(r.traces!.A)).digest("hex")).toBe(golden.samples["3730"].traceHashes.G);
    v.setUint8(pos + 20, 78); expect(parseAb1(b).traces).toBeNull();
  });
  it("缺少样本名仍能解析；不含PBAS时给出明确错误", () => {
    const b = sample(); remove(b, "SMPL1"); expect(parseAb1(b).warnings.join()).toMatch(/样本名称/);
    const c = sample(); remove(c, "PBAS2"); remove(c, "PBAS1"); expect(() => parseAb1(c)).toThrow(/碱基序列/);
  });
  it("PCON和PLOC长度不一致会降级；越界位置不会连到错误峰", () => {
    const b = sample(), v = new DataView(b); v.setUint32(entry(b, "PCON2") + 12, 10); expect(parseAb1(b).qualities).toBeNull();
    const c = sample(), w = new DataView(c), e = entry(c, "PLOC2"); w.setInt16(w.getUint32(e + 20), -1); expect(parseAb1(c).locations).toBeNull();
  });
});

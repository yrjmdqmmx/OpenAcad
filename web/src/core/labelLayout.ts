export interface LabelAnchor { id: string; x: number; y: number; text: string; size: number; descent?: number; }
type Box = { x: number; y: number; w: number; h: number };
const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const labelWidth = (text: string, size: number) => [...text].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : .62), 0) * size;

/** Deterministic label-only placement: scientific coordinates are never moved. */
export function placeLabels(labels: LabelAnchor[], width: number, height: number, points: { x: number; y: number }[] = []) {
  const occupied: Box[] = points.map(p => ({ x: p.x - 5, y: p.y - 5, w: 10, h: 10 }));
  const placed: Record<string, { x: number; y: number }> = {};
  for (const label of labels) {
    const w = labelWidth(label.text, label.size) + 5;
    const h = label.size * 1.35;
    const descent = label.descent ?? 3;
    let best = { x: label.x + 9, y: label.y + 4 }, bestScore = Infinity;
    for (let ring = 0; ring < 18; ring++) {
      for (const [dx, dy] of [[1,0], [1,-1], [-1,0], [-1,-1], [1,1], [-1,1], [0,-1], [0,1]]) {
        const x = Math.max(2, Math.min(width - w - 2, label.x + dx * (9 + ring * 9) - (dx < 0 ? w : dx === 0 ? w / 2 : 0)));
        const y = Math.max(h, Math.min(height - descent, label.y + 4 + dy * (h + ring * 8)));
        const box = { x: x - 2, y: y - h + descent, w: w + 4, h };
        const score = occupied.filter(b => intersects(box, b)).length * 1e6 + Math.hypot(x - label.x, y - label.y);
        if (score < bestScore) { best = { x, y }; bestScore = score; }
      }
      if (bestScore < 1e6) break;
    }
    placed[label.id] = best;
    occupied.push({ x: best.x - 2, y: best.y - h + descent, w: w + 4, h });
  }
  return placed;
}

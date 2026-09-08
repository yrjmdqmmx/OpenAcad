import type { ChartStyle } from './types';

// Deterministic SVG text layout is shared by the preview and all export formats.
// No HTML foreignObject, browser-only font measurements or raster title layers.
export function figureTextWidth(text: string, size: number) {
  return [...String(text)].reduce((w, c) => w + (/[^\u0000-\u024f]/.test(c) ? size : size * .58), 0);
}
export function figureLines(text: string, width: number, size: number) {
  const lines: string[] = []; let line = '';
  for (const c of String(text || '')) {
    if (c === '\n' || (line && figureTextWidth(line + c, size) > Math.max(size, width))) {
      lines.push(line); line = c === '\n' ? '' : c;
    } else line += c;
  }
  if (line) lines.push(line);
  return lines;
}
export function headingMetrics(s: ChartStyle, width = s.width) {
  const inset = Math.min(40, width * .05), available = width - inset * 2;
  const titleSize = Number(s.titleSize) || 22;
  const noteSize = Math.max(12, Math.min(16, Number(s.fontSize) - 1));
  const title = figureLines(s.title, available, titleSize);
  const subtitle = figureLines(s.subtitle, available, noteSize);
  const first = 18 + titleSize;
  const noteY = first + Math.max(0, title.length - 1) * titleSize * 1.3 + noteSize + 12;
  return { inset, title, subtitle, titleSize, noteSize, first, noteY,
    height: subtitle.length ? noteY + (subtitle.length - 1) * noteSize * 1.45 + 22 : first + Math.max(0, title.length - 1) * titleSize * 1.3 + 22 };
}
export function FigureHeading({ style: s, width = s.width }: { style: ChartStyle; width?: number }) {
  const m = headingMetrics(s, width);
  return <g data-figure-heading="publication" fill={String(s.titleColor || s.textColor)}>
    <text x={m.inset} y={m.first} fontSize={m.titleSize} fontWeight={s.titleBold === false ? 400 : 700} fontStyle={s.titleItalic ? 'italic' : undefined}>
      {m.title.map((line, i) => <tspan key={i} x={m.inset} dy={i ? m.titleSize * 1.3 : 0}>{line}</tspan>)}
    </text>
    <text x={m.inset} y={m.noteY} fontSize={m.noteSize} fill={s.textColor} opacity={.8}>
      {m.subtitle.map((line, i) => <tspan key={i} x={m.inset} dy={i ? m.noteSize * 1.45 : 0}>{line}</tspan>)}
    </text>
  </g>;
}

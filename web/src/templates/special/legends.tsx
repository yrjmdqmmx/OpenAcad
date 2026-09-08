import { color as parseColor } from 'd3';

export function contrastText(fill: string, fallback: string) {
  const rgb = parseColor(fill)?.rgb();
  if (!rgb) return fallback;
  const channel = (v: number) => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const luminance = .2126 * channel(rgb.r) + .7152 * channel(rgb.g) + .0722 * channel(rgb.b);
  return luminance < .26 ? '#ffffff' : '#172b3a';
}

export function SizeLegend({ x, y, max, radius, title = '数值', color = '#536875' }: {
  x: number; y: number; max: number; radius: (value: number) => number; title?: string; color?: string;
}) {
  const values = [...new Set([.25, .5, 1].map(f => +(max * f).toPrecision(2)))];
  let offset = 0;
  return <g data-size-legend={title} transform={`translate(${x},${y})`} fill={color}>
    <text x={0} y={-Math.max(...values.map(radius)) - 9} fontSize={10}>{title}</text>
    {values.map(value => {
      const r = radius(value), cx = offset + r; offset += Math.max(r * 2 + 24, 52);
      return <g key={value} transform={`translate(${cx},0)`}>
        <circle r={r} fill="none" stroke={color} strokeWidth={1}/>
        <text y={r + 13} textAnchor="middle" fontSize={10}>{value}</text>
      </g>;
    })}
  </g>;
}

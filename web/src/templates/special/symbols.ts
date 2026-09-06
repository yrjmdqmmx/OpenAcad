import {
  symbol,
  symbolCircle,
  symbolCross,
  symbolDiamond,
  symbolSquare,
  symbolStar,
  symbolTriangle,
  symbolWye,
} from "d3";
const shapes = {
  circle: symbolCircle,
  cross: symbolCross,
  diamond: symbolDiamond,
  square: symbolSquare,
  star: symbolStar,
  triangle: symbolTriangle,
  wye: symbolWye,
};
export const symbolOptions: [string, string][] = [
  ["circle", "圆形"],
  ["cross", "十字"],
  ["diamond", "菱形"],
  ["square", "方形"],
  ["star", "星形"],
  ["triangle", "三角形"],
  ["wye", "三叉形"],
];
export function symbolPath(name: string, radius: number) {
  return (
    symbol()
      .type(shapes[name as keyof typeof shapes] ?? symbolCircle)
      .size(Math.PI * radius * radius)() ?? ""
  );
}

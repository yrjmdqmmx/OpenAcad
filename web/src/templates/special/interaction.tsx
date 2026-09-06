import React, { useState } from "react";
import type { Project } from "../../core/types";

/** Keep positions in SVG coordinates so saved projects and exports agree. */
export function DraggableLabel({
  project,
  onLayoutChange,
  labelId,
  x,
  y,
  children,
  ...attrs
}: {
  project: Project;
  onLayoutChange?: (layout: Record<string, unknown>) => void;
  labelId: string;
  x: number;
  y: number;
  children: React.ReactNode;
} & Omit<React.SVGProps<SVGTextElement>, "x" | "y" | "children">) {
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const saved = project.layout.labelPositions as
    | Record<string, { x: number; y: number }>
    | undefined;
  const position = drag ?? saved?.[labelId] ?? { x, y };
  const locate = (e: React.PointerEvent<SVGTextElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const next = (e: React.PointerEvent<SVGTextElement>) => {
    const pt = locate(e),
      box = e.currentTarget.getBBox();
    const half = Math.min(project.style.width / 2 - 8, box.width / 2 + 4);
    return {
      x: Math.max(
        half,
        Math.min(project.style.width - half, pt.x - (drag?.dx ?? 0)),
      ),
      y: Math.max(
        14,
        Math.min(project.style.height - 14, pt.y - (drag?.dy ?? 0)),
      ),
    };
  };
  return (
    <text
      {...attrs}
      data-drag-label={labelId}
      x={position.x}
      y={position.y}
      style={{
        ...attrs.style,
        cursor: onLayoutChange ? "grab" : "default",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        if (!onLayoutChange) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const pt = locate(e);
        setDrag({ ...position, dx: pt.x - position.x, dy: pt.y - position.y });
      }}
      onPointerMove={(e) => {
        if (drag) setDrag({ ...next(e), dx: drag.dx, dy: drag.dy });
      }}
      onPointerUp={(e) => {
        if (!drag) return;
        onLayoutChange?.({
          ...project.layout,
          labelPositions: { ...saved, [labelId]: next(e) },
        });
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {children}
    </text>
  );
}

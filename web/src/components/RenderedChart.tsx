import { useRef, useState } from "react";
import type { Project, Template } from "../core/types";
import { requiredTreeCanvas } from "../templates/tree";
import { ChartBoundary } from "./ChartBoundary";
type Drag = { id: string; x: number; y: number };
export function RenderedChart({
  project,
  template,
  thumbnail = false,
  onChange,
}: {
  project: Project;
  template: Template;
  thumbnail?: boolean;
  onChange?: (p: Project) => void;
}) {
  const size = project.templateId.startsWith("tree-")
    ? requiredTreeCanvas(project)
    : project.style;
  const svg = useRef<SVGSVGElement>(null),
    moving = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!moving.current || !svg.current || !onChange) return;
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const coord = p.matrixTransform(svg.current.getScreenCTM()?.inverse());
    const next = {
      id: moving.current.id,
      x: Math.max(10, Math.min(size.width - 10, coord.x)),
      y: Math.max(20, Math.min(size.height - 10, coord.y)),
    };
    moving.current = next;
    setDrag(next);
  }
  function finish() {
    const d = moving.current;
    if (d && onChange)
      onChange({
        ...project,
        layers: project.layers.map((l) =>
          l.id === d.id
            ? { ...l, settings: { ...l.settings, x: d.x, y: d.y } }
            : l,
        ),
      });
    moving.current = null;
    setDrag(null);
  }
  return (
    <ChartBoundary
      resetKey={JSON.stringify([
        project.dataset,
        project.style,
        project.analysis,
        project.layers,
      ])}
    >
      <svg
        ref={svg}
        data-chart="true"
        className="chart-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={project.style.title || template.name}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          moving.current = null;
          setDrag(null);
        }}
      >
        <template.Renderer
          project={project}
          thumbnail={thumbnail}
          onLayoutChange={(layout) => onChange?.({ ...project, layout })}
        />
        {project.layers
          .filter((l) => l.type === "text" && l.visible)
          .map((l) => (
            <text
              key={l.id}
              x={drag?.id === l.id ? drag.x : Number(l.settings.x ?? 120)}
              y={drag?.id === l.id ? drag.y : Number(l.settings.y ?? 100)}
              fontFamily={project.style.fontFamily}
              fontSize={Number(l.settings.fontSize ?? 18)}
              fill={String(l.settings.color ?? project.style.textColor)}
              style={{
                cursor: thumbnail ? "default" : "move",
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                if (!thumbnail) {
                  moving.current = {
                    id: l.id,
                    x: Number(l.settings.x ?? 120),
                    y: Number(l.settings.y ?? 100),
                  };
                  svg.current?.setPointerCapture(e.pointerId);
                }
              }}
            >
              {String(l.settings.text || l.name)}
            </text>
          ))}
      </svg>
    </ChartBoundary>
  );
}

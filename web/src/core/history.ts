import { useCallback, useRef, useState } from "react";
import type { Project } from "./types";
export function useProjectHistory(initial: Project) {
  const [project, setProject] = useState(initial),
    [revision, setRevision] = useState(0);
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    current = useRef(initial);
  const commit = useCallback((value: Project | ((p: Project) => Project)) => {
    const next = typeof value === "function" ? value(current.current) : value;
    if (next === current.current) return;
    past.current.push(current.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    current.current = { ...next, updatedAt: new Date().toISOString() };
    setProject(current.current);
    setRevision((x) => x + 1);
  }, []);
  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p) {
      future.current.push(current.current);
      current.current = p;
      setProject(p);
      setRevision((x) => x + 1);
    }
  }, []);
  const redo = useCallback(() => {
    const p = future.current.pop();
    if (p) {
      past.current.push(current.current);
      current.current = p;
      setProject(p);
      setRevision((x) => x + 1);
    }
  }, []);
  return {
    project,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  };
}

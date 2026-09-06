import { openDB } from "idb";
import type { Project } from "./types";
const db = () =>
  openDB("openacad-projects", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
    },
  });
export async function listProjects(): Promise<Project[]> {
  const items = await (await db()).getAll("projects");
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function putProject(p: Project) {
  await (
    await db()
  ).put("projects", { ...p, updatedAt: new Date().toISOString() });
}
export async function removeProject(id: string) {
  await (await db()).delete("projects", id);
}

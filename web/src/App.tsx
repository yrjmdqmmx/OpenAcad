import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import { templates } from "./templates";
import type { Project } from "./core/types";
import { decodeProject, makeProject } from "./core/project";
import { Catalog } from "./components/Catalog";
import { Editor } from "./components/Editor";
import {
  TemplateDetail,
  ProjectsPage,
  HelpPage,
  MethodsPage,
} from "./components/LibraryPages";
export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "catalog"),
    [project, setProject] = useState<Project | null>(null),
    [error, setError] = useState(""),
    [openRevision, setOpenRevision] = useState(0);
  // Editor owns its history. Retain the latest project for route navigation
  // without rendering App again for every edit or remounting a new example.
  const latestProject = useRef<Project | null>(null);
  const retainProject = useCallback((next: Project) => {
    latestProject.current = next;
  }, []);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const change = () => {
      setProject(latestProject.current);
      setRoute(location.hash.slice(1) || "catalog");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function start(p: Project) {
    setOpenRevision((v) => v + 1);
    latestProject.current = p;
    setProject(p);
    location.hash = `editor/${p.templateId}`;
    setRoute(`editor/${p.templateId}`);
  }
  const [page, id] = route.split("/");
  const template = templates.find((t) => t.id === id);
  const editing = page === "editor" && template;
  const nav = [
    ["catalog", "模板库"],
    ["projects", "本机项目"],
    ["help", "帮助中心"],
    ["methods", "方法与版本"],
  ];
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#catalog">
          OpenAcad <span>开放学术</span>
        </a>
        <nav>
          {nav.map(([key, label]) => (
            <a
              key={key}
              className={page === key ? "active" : ""}
              href={`#${key}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <button className="open-project" onClick={() => file.current?.click()}>
          <FolderOpen size={16} />
          <span>打开项目</span>
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,.openacad.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              start(decodeProject(await f.text(), templates));
              setError("");
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = "";
          }}
        />
      </header>
      {error && (
        <div className="global-error" role="alert">
          {error}
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {editing ? (
        <Editor
          key={`${id}-${openRevision}`}
          initial={project?.templateId === id ? project : makeProject(template)}
          template={template}
          onProjectChange={retainProject}
          onExit={() => {
            location.hash = "catalog";
          }}
        />
      ) : page === "template" && template ? (
        <TemplateDetail template={template} onStart={start} />
      ) : page === "projects" ? (
        <ProjectsPage
          templates={templates}
          onStart={start}
          onImport={() => file.current?.click()}
        />
      ) : page === "help" ? (
        <HelpPage templates={templates} id={id} />
      ) : page === "methods" ? (
        <MethodsPage />
      ) : (
        <Catalog templates={templates} onStart={start} />
      )}
    </>
  );
}

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { templates } from "./templates";
import type { Project } from "./core/types";
import { decodeProject, makeProject } from "./core/project";
import { Catalog } from "./components/Catalog";
import { Editor } from "./components/Editor";
import { HomePage } from "./components/HomePage";
import "./styles/navigation.css";
const BioTools = lazy(() => import("./bio/BioTools"));
import {
  TemplateDetail,
  ProjectsPage,
  HelpPage,
  MethodsPage,
} from "./components/LibraryPages";
export default function App() {
  const [bioVisited, setBioVisited] = useState(false);
  const [route, setRoute] = useState(location.hash.slice(1) || "home"),
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
      setRoute(location.hash.slice(1) || "home");
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
  useEffect(() => { if (page === "bio") setBioVisited(true); }, [page]);
  const template = templates.find((t) => t.id === id);
  const editing = page === "editor" && template;
  const nav = [
    ["home", "首页"],
    ["catalog", "科研绘图"],
    ["bio", "生物信息学"],
    ["tuyan", "图研 Tuyan"],
    ["projects", "本机项目"],
    ["help", "帮助中心"],
    ["methods", "方法与版本"],
  ];
  const activePage = page === "editor" || page === "template" ? "catalog" : page;
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home">
          OpenAcad <span>开放学术</span>
        </a>
        <nav className="site-navigation" aria-label="主导航">
          {nav.map(([key, label]) => (
            <a
              key={key}
              className={activePage === key ? "active" : ""}
              aria-current={activePage === key ? "page" : undefined}
              href={key === "tuyan" ? "https://www.paperbanana.asia/" : `#${key}`}
              target={key === "tuyan" ? "_blank" : undefined}
              rel={key === "tuyan" ? "noopener noreferrer" : undefined}
              title={key === "tuyan" ? "在新窗口访问图研官网" : undefined}
            >
              {label}
              {key === "tuyan" && <ArrowUpRight size={13} aria-hidden="true" />}
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
      {page === "bio" ? null : editing ? (
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
      ) : page === "home" ? (
        <HomePage templates={templates} />
      ) : (
        <Catalog templates={templates} onStart={start} />
      )}
      {(bioVisited || page === "bio") && <div hidden={page !== "bio"}><Suspense fallback={<p role="status" className="content-page">正在加载生物信息学工具…</p>}><BioTools tool={id} /></Suspense></div>}
    </>
  );
}

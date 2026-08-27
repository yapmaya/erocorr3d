// apps/web/src/features/projects/ProjectsPage.tsx
//
// "Projeler" sekmesinin kök sayfası — proje CRUD (sol sidebar) + seçili
// projenin sekmeleri (Bileşenler/Toplu Analiz/Karşılaştırma/Malzemeler/
// Ön Ayarlar) + .ec3d içe/dışa aktarma.

import { useEffect, useRef, useState } from "react";
import { useProjectsStore } from "../../store/projectsStore";
import { ComponentList } from "./ComponentList";
import { BatchAnalysisPanel } from "./BatchAnalysisPanel";
import { RunComparisonPanel } from "./RunComparisonPanel";
import { CustomMaterialsPanel } from "./CustomMaterialsPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { LineListImportWizard } from "./LineListImportWizard";
import { buildEc3dFile, downloadEc3dFile } from "./exportProject";
import { importProjectFromFile } from "./importProject";
import { projectsDb } from "./db";
import { DEMO_PROJECT_DEFS, buildDemoComponentDraft, type DemoProjectDef } from "./demoProjects";
import { useTranslation } from "../../i18n/translations";

type ProjectTab = "components" | "batch" | "compare" | "materials" | "templates";

const TABS: { id: ProjectTab; labelTr: string }[] = [
  { id: "components", labelTr: "Bileşenler" },
  { id: "batch", labelTr: "Toplu Analiz" },
  { id: "compare", labelTr: "Karşılaştırma" },
  { id: "materials", labelTr: "Malzemeler" },
  { id: "templates", labelTr: "Ön Ayarlar" },
];

function NewProjectForm({ onCreated }: { onCreated: (id: string) => void }) {
  const createProject = useProjectsStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [facility, setFacility] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const id = await createProject({ name: name.trim(), client, facility, createdBy: "", revision: "0" });
    setName("");
    setClient("");
    setFacility("");
    onCreated(id);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded border border-neutral-200 p-2 dark:border-neutral-800">
      <input className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900" placeholder="Proje adı *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900" placeholder="Müşteri" value={client} onChange={(e) => setClient(e.target.value)} />
      <input className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900" placeholder="Tesis" value={facility} onChange={(e) => setFacility(e.target.value)} />
      <button type="button" onClick={() => void handleCreate()} className="rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700">
        + Proje Oluştur
      </button>
    </div>
  );
}

function DemoProjectsSection({ onLoad }: { onLoad: (def: DemoProjectDef) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 rounded border border-neutral-200 p-2 dark:border-neutral-800">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {t("demoProjectsSectionTitle")}
      </h3>
      {DEMO_PROJECT_DEFS.map((def) => (
        <div key={def.templateId} className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[11px] text-neutral-700 dark:text-neutral-200" title={t(def.descKey)}>
            {t(def.nameKey)}
          </span>
          <button
            type="button"
            onClick={() => onLoad(def)}
            className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {t("demoProjectsLoadButton")}
          </button>
        </div>
      ))}
    </div>
  );
}

export function ProjectsPage() {
  const projects = useProjectsStore((s) => s.projects);
  const selectedProjectId = useProjectsStore((s) => s.selectedProjectId);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const selectProject = useProjectsStore((s) => s.selectProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);
  const createProject = useProjectsStore((s) => s.createProject);
  const addComponent = useProjectsStore((s) => s.addComponent);
  const { t } = useTranslation();
  const [tab, setTab] = useState<ProjectTab>("components");
  const [isLineListOpen, setLineListOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const handleLoadDemoProject = async (def: DemoProjectDef) => {
    const id = await createProject({ name: t(def.nameKey), client: "Demo", facility: "—", createdBy: "EroCorr3D Demo", revision: "0" });
    await addComponent(buildDemoComponentDraft(def.templateId, id));
    await selectProject(id);
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    const [components, assessmentRuns] = await Promise.all([
      projectsDb.components.where("projectId").equals(selectedProject.id).toArray(),
      projectsDb.assessmentRuns.where("projectId").equals(selectedProject.id).toArray(),
    ]);
    downloadEc3dFile(buildEc3dFile(selectedProject, components, assessmentRuns));
  };

  const handleImportFile = async (file: File) => {
    setImportMessage(null);
    const result = await importProjectFromFile(file);
    if (!result.ok) {
      setImportMessage(result.errorTr);
      return;
    }
    await loadProjects();
    await selectProject(result.projectId);
    setImportMessage(["Proje içe aktarıldı.", ...result.warningsTr].join(" "));
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Projeler</h2>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          >
            .ec3d İçe Aktar
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".ec3d,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {importMessage && <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{importMessage}</p>}

        <DemoProjectsSection onLoad={(def) => void handleLoadDemoProject(def)} />

        <NewProjectForm onCreated={(id) => void selectProject(id)} />

        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => void selectProject(project.id)}
              className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs ${
                selectedProjectId === project.id ? "bg-sky-100 dark:bg-sky-950" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              <div>
                <div className="font-medium text-neutral-800 dark:text-neutral-100">{project.name}</div>
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500">{project.client}</div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteProject(project.id);
                }}
                className="text-neutral-300 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
          {projects.length === 0 && <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Henüz proje yok.</p>}
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selectedProject ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Sol taraftan bir proje seçin veya yeni bir proje oluşturun.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{selectedProject.name}</h1>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {selectedProject.client} — {selectedProject.facility}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setLineListOpen(true)} className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                  Hat Listesi İçe Aktar
                </button>
                <button type="button" onClick={() => void handleExport()} className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                  .ec3d Dışa Aktar
                </button>
              </div>
            </div>

            <div className="flex gap-1 border-b border-neutral-200 pb-1 dark:border-neutral-800">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded px-2 py-1 text-xs ${tab === t.id ? "bg-sky-600 text-white" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"}`}
                >
                  {t.labelTr}
                </button>
              ))}
            </div>

            {tab === "components" && <ComponentList projectId={selectedProject.id} />}
            {tab === "batch" && <BatchAnalysisPanel projectId={selectedProject.id} />}
            {tab === "compare" && <RunComparisonPanel />}
            {tab === "materials" && <CustomMaterialsPanel />}
            {tab === "templates" && <TemplatesPanel projectId={selectedProject.id} />}

            <LineListImportWizard isOpen={isLineListOpen} onClose={() => setLineListOpen(false)} />
          </div>
        )}
      </main>
    </div>
  );
}

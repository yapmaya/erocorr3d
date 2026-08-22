// apps/web/src/store/projectsStore.ts
//
// Proje kütüphanesinin reaktif durumu — `assessmentHistoryStore.ts`'in
// AYNI zustand deseni, ama kalıcı (Dexie/IndexedDB, bkz. features/projects/
// db.ts) bir kaynağı SARAR: repoda bir "live query" kütüphanesi (ör.
// dexie-react-hooks) YOK, bu yüzden reaktiflik her mutasyondan SONRA ilgili
// listeyi Dexie'den yeniden okuyup store'a yazmakla sağlanır.
//
// `customMaterials`/`templates` PROJE-BAĞIMSIZDIR (global) — onaylı plan'ın
// kararı. `components`/`assessmentRuns` ise SEÇİLİ projeye aittir.

import { create } from "zustand";
import type { WizardDraft } from "../features/input/schema";
import { projectsDb } from "../features/projects/db";
import type {
  AssessmentRunRecord,
  CustomMaterialRecord,
  ProjectComponentRecord,
  ProjectRecord,
  TemplateRecord,
} from "../features/projects/types";

interface ProjectsState {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  components: ProjectComponentRecord[];
  assessmentRuns: AssessmentRunRecord[];
  customMaterials: CustomMaterialRecord[];
  templates: TemplateRecord[];

  loadProjects: () => Promise<void>;
  createProject: (fields: Pick<ProjectRecord, "name" | "client" | "facility" | "createdBy" | "revision">) => Promise<string>;
  updateProject: (id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null) => Promise<void>;

  addComponent: (draft: WizardDraft) => Promise<void>;
  updateComponent: (component: ProjectComponentRecord) => Promise<void>;
  deleteComponent: (id: string) => Promise<void>;

  addAssessmentRun: (run: AssessmentRunRecord) => Promise<void>;
  deleteAssessmentRun: (id: string) => Promise<void>;

  loadCustomMaterials: () => Promise<void>;
  addCustomMaterial: (material: CustomMaterialRecord) => Promise<void>;
  deleteCustomMaterial: (id: string) => Promise<void>;

  loadTemplates: () => Promise<void>;
  addTemplate: (template: TemplateRecord) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

async function loadComponentsAndRuns(projectId: string): Promise<{ components: ProjectComponentRecord[]; assessmentRuns: AssessmentRunRecord[] }> {
  const [components, assessmentRuns] = await Promise.all([
    projectsDb.components.where("projectId").equals(projectId).toArray(),
    projectsDb.assessmentRuns.where("projectId").equals(projectId).toArray(),
  ]);
  return { components, assessmentRuns };
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  components: [],
  assessmentRuns: [],
  customMaterials: [],
  templates: [],

  loadProjects: async () => {
    const projects = await projectsDb.projects.toArray();
    set({ projects: projects.sort((a, b) => b.updatedAt - a.updatedAt) });
  },

  createProject: async (fields) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const record: ProjectRecord = { id, createdAt: now, updatedAt: now, ...fields };
    await projectsDb.projects.put(record);
    await get().loadProjects();
    await get().selectProject(id);
    return id;
  },

  updateProject: async (id, patch) => {
    await projectsDb.projects.update(id, { ...patch, updatedAt: Date.now() });
    await get().loadProjects();
  },

  deleteProject: async (id) => {
    const componentIds = (await projectsDb.components.where("projectId").equals(id).primaryKeys()) as string[];
    await projectsDb.transaction("rw", projectsDb.projects, projectsDb.components, projectsDb.assessmentRuns, async () => {
      await projectsDb.projects.delete(id);
      await projectsDb.components.bulkDelete(componentIds);
      await projectsDb.assessmentRuns.where("projectId").equals(id).delete();
    });
    if (get().selectedProjectId === id) {
      set({ selectedProjectId: null, components: [], assessmentRuns: [] });
    }
    await get().loadProjects();
  },

  selectProject: async (id) => {
    if (id === null) {
      set({ selectedProjectId: null, components: [], assessmentRuns: [] });
      return;
    }
    const { components, assessmentRuns } = await loadComponentsAndRuns(id);
    set({ selectedProjectId: id, components, assessmentRuns });
  },

  addComponent: async (draft) => {
    const projectId = get().selectedProjectId;
    if (!projectId) throw new Error("Bileşen eklemek için önce bir proje seçilmelidir.");
    const record: ProjectComponentRecord = { ...draft, projectId };
    await projectsDb.components.put(record);
    const { components } = await loadComponentsAndRuns(projectId);
    set({ components });
  },

  updateComponent: async (component) => {
    await projectsDb.components.put({ ...component, updatedAt: Date.now() });
    const { components } = await loadComponentsAndRuns(component.projectId);
    set({ components });
  },

  deleteComponent: async (id) => {
    const projectId = get().selectedProjectId;
    if (!projectId) return;
    await projectsDb.transaction("rw", projectsDb.components, projectsDb.assessmentRuns, async () => {
      await projectsDb.components.delete(id);
      await projectsDb.assessmentRuns.where("componentId").equals(id).delete();
    });
    const { components, assessmentRuns } = await loadComponentsAndRuns(projectId);
    set({ components, assessmentRuns });
  },

  addAssessmentRun: async (run) => {
    await projectsDb.assessmentRuns.put(run);
    if (get().selectedProjectId === run.projectId) {
      const { assessmentRuns } = await loadComponentsAndRuns(run.projectId);
      set({ assessmentRuns });
    }
  },

  deleteAssessmentRun: async (id) => {
    const projectId = get().selectedProjectId;
    await projectsDb.assessmentRuns.delete(id);
    if (projectId) {
      const { assessmentRuns } = await loadComponentsAndRuns(projectId);
      set({ assessmentRuns });
    }
  },

  loadCustomMaterials: async () => {
    const customMaterials = await projectsDb.customMaterials.toArray();
    set({ customMaterials: customMaterials.sort((a, b) => b.createdAt - a.createdAt) });
  },

  addCustomMaterial: async (material) => {
    await projectsDb.customMaterials.put(material);
    await get().loadCustomMaterials();
  },

  deleteCustomMaterial: async (id) => {
    await projectsDb.customMaterials.delete(id);
    await get().loadCustomMaterials();
  },

  loadTemplates: async () => {
    const templates = await projectsDb.templates.toArray();
    set({ templates: templates.sort((a, b) => b.createdAt - a.createdAt) });
  },

  addTemplate: async (template) => {
    await projectsDb.templates.put(template);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    await projectsDb.templates.delete(id);
    await get().loadTemplates();
  },
}));

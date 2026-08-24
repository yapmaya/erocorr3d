// apps/web/src/features/projects/demoProjects.ts
//
// "Örnek Projeler" — master görevin istediği 3 hazır demo (ıslak gaz
// toplama hattı / kumlu kuyu başı hattı / deniz suyu hattı). Bunlar
// `features/input/templates.ts`'in ZATEN var olan `WIZARD_TEMPLATES`
// tanımlarını (gerçekçi geometri/proses/kimya değerleri) bir Dexie
// projesine sarmalar — yeni bir sayı/senaryo İCAT EDİLMEZ, yalnızca
// var olan şablon `createBlankDraft()` ile birleştirilip geçerli bir
// `ProjectComponentRecord`e çevrilir.

import { getTemplate } from "../input/templates";
import { createBlankDraft } from "../input/defaultDraft";
import type { ProjectComponentRecord } from "./types";
import type { TranslationKey } from "../../i18n/translations";

export interface DemoProjectDef {
  templateId: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
}

export const DEMO_PROJECT_DEFS: DemoProjectDef[] = [
  { templateId: "wet-gas-gathering", nameKey: "demoProjectWetGasName", descKey: "demoProjectWetGasDesc" },
  { templateId: "sandy-wellhead", nameKey: "demoProjectSandyWellheadName", descKey: "demoProjectSandyWellheadDesc" },
  { templateId: "seawater", nameKey: "demoProjectSeawaterName", descKey: "demoProjectSeawaterDesc" },
];

/** Seçili demo şablonundan, verilen projeye ait geçerli bir bileşen taslağı üretir. */
export function buildDemoComponentDraft(templateId: string, projectId: string): ProjectComponentRecord {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Bilinmeyen demo proje şablon kimliği: ${templateId}`);
  }
  const applied = template.apply();
  const blank = createBlankDraft();
  return { ...blank, ...applied, projectId, updatedAt: Date.now() };
}

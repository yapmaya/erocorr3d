// apps/web/src/features/projects/types.ts
//
// Proje kütüphanesinin kalıcı kayıt tipleri (bkz. db.ts). "Component" için
// yeni bir veri şekli İCAT EDİLMEZ — girdi sihirbazının KENDİ `WizardDraft`
// şeması (apps/web/src/features/input/schema.ts) doğrudan kullanılır,
// yalnızca hangi projeye ait olduğunu belirten `projectId` eklenir.

import type { CustomMaterial, Geometry, Mitigation, OperatingProfile, ScenarioAssessment } from "@erocorr3d/engine";
import type { WizardDraft } from "../input/schema";

export interface ProjectRecord {
  id: string;
  name: string;
  client: string;
  facility: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  revision: string;
}

/** Bir projeye ait bileşen — girdi sihirbazının `WizardDraft`'ının KENDİSİ + `projectId`. */
export interface ProjectComponentRecord extends WizardDraft {
  projectId: string;
}

/**
 * Bir bileşenin belirli bir anda, belirli bir motor sürümüyle hesaplanmış
 * sonucu. `geometry`/`mitigation`/`operatingProfile` girdilerin KENDİ
 * ANLIK GÖRÜNTÜSÜDÜR (bileşen sonradan düzenlense/silinse bile bu
 * çalıştırmanın hangi girdilerle üretildiği DEĞİŞMEZ) — karşılaştırma
 * özelliğinin (compareRuns.ts) girdi delta'ları buradan gelir.
 */
export interface AssessmentRunRecord {
  id: string;
  projectId: string;
  componentId: string;
  /** Bileşen silinmiş/adı değişmiş olsa bile çalıştırmanın kendi bağlamını korumak için ayrıca saklanır. */
  componentLabel: string;
  computedAt: number;
  engineVersion: string;
  geometry: Geometry;
  mitigation: Mitigation;
  operatingProfile: OperatingProfile;
  assessment: ScenarioAssessment;
  uninhibitedAssessment: ScenarioAssessment;
}

export interface CustomMaterialRecord extends CustomMaterial {
  createdAt: number;
}

/** Kullanıcının kaydettiği bir bileşen ön ayarı — `componentLabel` uygulanmaz (her kullanımda kullanıcı kendi adını verir). */
export interface TemplateRecord {
  id: string;
  name: string;
  notesTr: string;
  createdAt: number;
  draft: Omit<WizardDraft, "id" | "componentLabel" | "updatedAt">;
}

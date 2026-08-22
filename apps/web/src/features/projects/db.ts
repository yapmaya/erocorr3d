// apps/web/src/features/projects/db.ts
//
// Proje kütüphanesinin Dexie/IndexedDB veritabanı — mevcut tekli-taslak
// otomatik kayıt DB'sinden (features/input/persistence/db.ts, DB adı
// "erocorr3d-input-wizard") TAMAMEN AYRIDIR; o dosyaya DOKUNULMAZ (bkz.
// onaylı plan'ın "proje dışı akış değişmez" kararı).
//
// TEST KAPSAMI NOTU: bu dosya (ham Dexie CRUD, tarayıcı IndexedDB'sine
// bağımlı) Vitest ile test EDİLMEZ — repoda ZATEN emsali var:
// features/input/persistence/db.ts de test edilmiyor (proje `fake-indexeddb`
// taşımıyor, vitest environment'ı "node"). Üzerine kurulan SAF mantık
// (rankRiskiestComponents, compareRuns, importLineList'in ayrıştırma kısmı,
// importProject'in Zod doğrulaması) AYRI dosyalarda test edilir.

import Dexie, { type EntityTable } from "dexie";
import type { AssessmentRunRecord, CustomMaterialRecord, ProjectComponentRecord, ProjectRecord, TemplateRecord } from "./types";

class EroCorr3DProjectsDb extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  components!: EntityTable<ProjectComponentRecord, "id">;
  assessmentRuns!: EntityTable<AssessmentRunRecord, "id">;
  customMaterials!: EntityTable<CustomMaterialRecord, "id">;
  templates!: EntityTable<TemplateRecord, "id">;

  constructor() {
    super("erocorr3d-projects");
    this.version(1).stores({
      projects: "id, name",
      components: "id, projectId",
      assessmentRuns: "id, projectId, componentId",
      customMaterials: "id",
      templates: "id",
    });
  }
}

export const projectsDb = new EroCorr3DProjectsDb();

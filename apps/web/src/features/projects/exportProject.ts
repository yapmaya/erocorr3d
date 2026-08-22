// apps/web/src/features/projects/exportProject.ts
//
// Tüm proje (proje kaydı + bileşenler + TÜM çalıştırma geçmişi) tek bir
// `.ec3d` dosyasına (düz JSON, yalnızca uzantısı özel) dışa aktarılır.
// `ec3dJsonReplacer` (bkz. ec3dSerialization.ts) JSON'ın taşıyamadığı
// `Float32Array`/`NaN` değerlerini JSON-güvenli hale getirir.
//
// SAF DEĞİL (dosya indirme yan etkisi) — `viewer3d/export/exportPng.ts::
// downloadDataUrl` İLE AYNI gerekçeyle test edilmez. `buildEc3dFile` (veri
// birleştirme) SAF'tır.

import type { AssessmentRunRecord, ProjectComponentRecord, ProjectRecord } from "./types";
import { ec3dJsonReplacer } from "./ec3dSerialization";

export const EC3D_FORMAT_VERSION = 1;

export interface Ec3dFile {
  formatVersion: number;
  exportedAt: number;
  project: ProjectRecord;
  components: ProjectComponentRecord[];
  assessmentRuns: AssessmentRunRecord[];
}

export function buildEc3dFile(project: ProjectRecord, components: ProjectComponentRecord[], assessmentRuns: AssessmentRunRecord[]): Ec3dFile {
  return { formatVersion: EC3D_FORMAT_VERSION, exportedAt: Date.now(), project, components, assessmentRuns };
}

export function downloadEc3dFile(file: Ec3dFile): void {
  const json = JSON.stringify(file, ec3dJsonReplacer, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${file.project.name || "erocorr3d-proje"}.ec3d`;
  anchor.click();
  URL.revokeObjectURL(url);
}

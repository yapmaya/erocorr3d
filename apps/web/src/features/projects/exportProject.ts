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
import { downloadBlob } from "../../lib/downloadBlob";

export const EC3D_FORMAT_VERSION = 1;

const MAX_SAFE_FILENAME_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_OR_NULL = /[\x00-\x1f\x7f]/g;
const PATH_SEPARATORS_AND_WINDOWS_FORBIDDEN = /[/\\:*?"<>|]/g;

/**
 * Kullanıcının girdiği proje adını dosya adı olarak güvenli hale getirir:
 * kontrol karakterlerini/null byte'ı atar, yol ayırıcılarını ve Windows'ta
 * yasak karakterleri tire ile değiştirir, uzunluğu sınırlar. Sonuç boş
 * kalırsa (örn. yalnızca boşluktan oluşan bir ad) varsayılana düşer.
 */
export function toSafeFileName(rawName: string): string {
  const sanitized = rawName
    .replace(CONTROL_CHARS_OR_NULL, "")
    .replace(PATH_SEPARATORS_AND_WINDOWS_FORBIDDEN, "-")
    .trim()
    .slice(0, MAX_SAFE_FILENAME_LENGTH)
    .trim();
  return sanitized || "erocorr3d-proje";
}

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
  downloadBlob(blob, `${toSafeFileName(file.project.name)}.ec3d`);
}

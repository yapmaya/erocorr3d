// apps/web/src/features/viewer3d/referenceFacility/referenceFacilityFieldSampling.ts
//
// Motorun GERÇEK SpatialDamageField'ını (bkz. referenceFacilityScenarios.ts),
// pipe mesh'inin (demo geometrisiyle AYNI şekle sahip, bkz. bilinen sınırlama
// notu) `uv` attribute'una örnekler. `timeSlider/demoTimeDependentField.ts`
// ile AYNI sözleşimi (BufferGeometry + elapsedYears → Float32Array) taşır
// ki `PipeMesh`'in `values` girdisine doğrudan bağlanabilsin — ama ARTIK
// sentetik bir yoğunluk fonksiyonu değil, `@erocorr3d/engine`'in
// `scaleSpatialDamageField` (hız×süre modelinin DOĞRUSALLIĞI — bkz. o
// dosyanın notu) + `sampleSpatialDamageFieldMm` (bilineer enterpolasyon)
// fonksiyonlarını kullanır.
//
// ⚠ BİLİNEN SINIRLAMA: gösterilen boru mesh'i hâlâ PipeViewer'ın demo
// boyutlarındadır (gerçek referans tesis NPS16/NPS8 geometrisine göre
// yeniden şekillendirme bu oturumun kapsamı DIŞINDA) — yalnızca üzerindeki
// hasar DEĞERLERİ gerçek hesaptan gelir. Et kalınlığı eşiği (duvar
// delinme yılı) ise o hattın GERÇEK wallThicknessMm'i ile hesaplanır
// (bkz. computeReferenceFacilityBreachYears çağıranı, PipeViewer.tsx).

import type { BufferGeometry } from "three";
import { scaleSpatialDamageField, sampleSpatialDamageFieldMm, type CaseAssessment, type Hotspot } from "@erocorr3d/engine";

function clampedFraction(elapsedYears: number, designLifeYears: number): number {
  if (designLifeYears <= 0) return 0;
  return Math.min(Math.max(elapsedYears, 0), designLifeYears) / designLifeYears;
}

/**
 * Geometrinin `uv` attribute'u üzerinden, verilen anda (elapsedYears) GERÇEK
 * hasar değerlerini (mm) örnekler — `demoTimeDependentField.ts::
 * computeDemoTimeDependentField`in gerçek-veri eşdeğeri.
 */
export function computeReferenceFacilityTimeDependentField(
  geometry: BufferGeometry,
  caseAssessment: CaseAssessment,
  elapsedYears: number,
  designLifeYears: number,
): Float32Array {
  const uvAttribute = geometry.getAttribute("uv");
  if (!uvAttribute) {
    throw new Error("Geometride 'uv' attribute'u bulunamadı — gerçek hasar alanı örneklenemedi.");
  }
  const scaledField = scaleSpatialDamageField(
    caseAssessment.spatialDamageFieldFullLife,
    clampedFraction(elapsedYears, designLifeYears),
  );
  const count = uvAttribute.count;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = sampleSpatialDamageFieldMm(scaledField, uvAttribute.getX(i), uvAttribute.getY(i));
  }
  return out;
}

/** "Duvar delinme yılı" — hız×süre modeli DOĞRUSAL olduğundan kapalı-form (kaydırma/arama gerekmez). */
export function computeReferenceFacilityBreachYears(caseAssessment: CaseAssessment, wallThicknessMm: number, designLifeYears: number): number {
  if (wallThicknessMm <= 0) throw new Error("wallThicknessMm pozitif olmalıdır.");
  const maxAtFullLife = caseAssessment.spatialDamageFieldFullLife.maxValueMm;
  if (maxAtFullLife <= 0) return Infinity;
  return (wallThicknessMm / maxAtFullLife) * designLifeYears;
}

/** Verilen andaki (elapsedYears) GERÇEK hotspot listesi — computeDamageField'ın ZATEN hesapladığı listenin ölçeklenmiş hâli. */
export function computeReferenceFacilityHotspotsAtYears(
  caseAssessment: CaseAssessment,
  elapsedYears: number,
  designLifeYears: number,
  maxCount: number,
): Hotspot[] {
  const scaled = scaleSpatialDamageField(
    caseAssessment.spatialDamageFieldFullLife,
    clampedFraction(elapsedYears, designLifeYears),
  );
  return scaled.hotspots.slice(0, maxCount);
}

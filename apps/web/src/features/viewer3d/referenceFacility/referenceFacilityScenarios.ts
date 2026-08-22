// apps/web/src/features/viewer3d/referenceFacility/referenceFacilityScenarios.ts
//
// Viewer3D'nin "Gerçek Veri (Referans Tesis)" modunun veri kaynağı — bu
// dosyadan itibaren ısı haritası/hotspot'lar SENTETİK demo deseni DEĞİL,
// `@erocorr3d/engine`'in yeni orkestrasyon katmanının (assessComponentScenario
// → gerçek NORSOK M-506/de Waard/TLC/DNV-RP-O501 hesapları →
// computeDamageField) ürettiği GERÇEK bir SpatialDamageField'dır. Girdi
// verisi, referans tesis fixture'ıdır (bkz. packages/engine/src/fixtures/
// referenceFacility.ts'in kendi kaynak/doğruluk notu — bu bir STAJ SONU
// SUNUM belgesidir, denetlenmiş tesis ölçümü DEĞİLDİR, ama Zod-doğrulanmış,
// gerçekçi bir Geometry/OperatingCase/Mitigation üçlüsüdür).
//
// Hesap, modül YÜKLENDİĞİNDE değil, İLK ERİŞİMDE (lazy) yapılır ve bir
// Map'te ÖNBELLEKLENİR — assessComponentScenario girdileri
// (REFERENCE_FACILITY_FIXTURES) sabit olduğundan bu tamamen SAF/deterministiktir,
// React state/hook'a gerek yoktur (bileşen yeniden render olduğunda TEKRAR
// hesaplanmaz).

import { REFERENCE_FACILITY_FIXTURES, assessComponentScenario, type ReferenceFacilityStreamFixture, type ScenarioAssessment } from "@erocorr3d/engine";

const SCENARIO_CACHE = new Map<string, ScenarioAssessment>();
/** computeDamageField çözünürlüğü — motorun kendi varsayılanıyla (96×64) AYNI. */
const FIELD_RESOLUTION = { resolutionU: 96, resolutionV: 64 };

export function getReferenceFacilityFixture(streamId: string): ReferenceFacilityStreamFixture {
  const fixture = REFERENCE_FACILITY_FIXTURES.find((f) => f.streamId === streamId);
  if (!fixture) {
    throw new Error(`Bilinmeyen referans hat: "${streamId}".`);
  }
  return fixture;
}

export function getReferenceFacilityScenarioAssessment(streamId: string): ScenarioAssessment {
  const cached = SCENARIO_CACHE.get(streamId);
  if (cached) return cached;
  const fixture = getReferenceFacilityFixture(streamId);
  const assessment = assessComponentScenario(
    fixture.geometry,
    fixture.mitigation,
    fixture.operatingProfile,
    {},
    fixture.streamId,
    FIELD_RESOLUTION,
  );
  SCENARIO_CACHE.set(streamId, assessment);
  return assessment;
}

export interface ReferenceFacilityScenarioTab {
  id: string;
  labelTr: string;
  streamId: string;
  caseIndex: number;
}

// Sıra, referenceFacility.ts'in KENDİ operatingProfile.cases dizisiyle (Çekiş, Enjeksiyon) BİREBİR eşleşir.
export const REFERENCE_FACILITY_SCENARIO_TABS: ReferenceFacilityScenarioTab[] = [
  { id: "L1-CEKIS", labelTr: "Hat 1 — Kış Çekiş", streamId: "Reference Line 1", caseIndex: 0 },
  { id: "L1-ENJ", labelTr: "Hat 1 — Yaz Enjeksiyon", streamId: "Reference Line 1", caseIndex: 1 },
  { id: "L2-CEKIS", labelTr: "Hat 2 — Kış Çekiş", streamId: "Reference Line 2", caseIndex: 0 },
  { id: "L2-ENJ", labelTr: "Hat 2 — Yaz Enjeksiyon", streamId: "Reference Line 2", caseIndex: 1 },
];

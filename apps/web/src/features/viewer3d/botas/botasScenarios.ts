// apps/web/src/features/viewer3d/botas/botasScenarios.ts
//
// Viewer3D'nin "Gerçek Veri (BOTAŞ)" modunun veri kaynağı — bu dosyadan
// itibaren ısı haritası/hotspot'lar SENTETİK demo deseni DEĞİL,
// `@erocorr3d/engine`'in yeni orkestrasyon katmanının (assessComponentScenario
// → gerçek NORSOK M-506/de Waard/TLC/DNV-RP-O501 hesapları →
// computeDamageField) ürettiği GERÇEK bir SpatialDamageField'dır. Girdi
// verisi, diskte bulunan BOTAŞ Silivri Faz III fixture'ıdır (bkz.
// packages/engine/src/fixtures/botas.ts'in kendi kaynak/doğruluk notu —
// bu bir STAJ SONU SUNUM belgesidir, denetlenmiş tesis ölçümü DEĞİLDİR,
// ama Zod-doğrulanmış, gerçekçi bir Geometry/OperatingCase/Mitigation
// üçlüsüdür).
//
// Hesap, modül YÜKLENDİĞİNDE değil, İLK ERİŞİMDE (lazy) yapılır ve bir
// Map'te ÖNBELLEKLENİR — assessComponentScenario girdileri (BOTAS_FIXTURES)
// sabit olduğundan bu tamamen SAF/deterministiktir, React state/hook'a
// gerek yoktur (bileşen yeniden render olduğunda TEKRAR hesaplanmaz).

import { BOTAS_FIXTURES, assessComponentScenario, type BotasStreamFixture, type ScenarioAssessment } from "@erocorr3d/engine";

const SCENARIO_CACHE = new Map<string, ScenarioAssessment>();
/** computeDamageField çözünürlüğü — motorun kendi varsayılanıyla (96×64) AYNI. */
const FIELD_RESOLUTION = { resolutionU: 96, resolutionV: 64 };

export function getBotasFixture(streamId: string): BotasStreamFixture {
  const fixture = BOTAS_FIXTURES.find((f) => f.streamId === streamId);
  if (!fixture) {
    throw new Error(`Bilinmeyen BOTAŞ hattı: "${streamId}".`);
  }
  return fixture;
}

export function getBotasScenarioAssessment(streamId: string): ScenarioAssessment {
  const cached = SCENARIO_CACHE.get(streamId);
  if (cached) return cached;
  const fixture = getBotasFixture(streamId);
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

export interface BotasScenarioTab {
  id: string;
  labelTr: string;
  streamId: string;
  caseIndex: number;
}

// Sıra, botas.ts'in KENDİ operatingProfile.cases dizisiyle (Çekiş, Enjeksiyon) BİREBİR eşleşir.
export const BOTAS_SCENARIO_TABS: BotasScenarioTab[] = [
  { id: "1030-CEKIS", labelTr: "1030 — Kış Çekiş", streamId: "Stream 1030", caseIndex: 0 },
  { id: "1030-ENJ", labelTr: "1030 — Yaz Enjeksiyon", streamId: "Stream 1030", caseIndex: 1 },
  { id: "1130-CEKIS", labelTr: "1130 — Kış Çekiş", streamId: "Stream 1130", caseIndex: 0 },
  { id: "1130-ENJ", labelTr: "1130 — Yaz Enjeksiyon", streamId: "Stream 1130", caseIndex: 1 },
];

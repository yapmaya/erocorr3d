// apps/web/src/features/viewer3d/hotspots/hotspotDetail.ts
//
// Seçili bir hotspot'un yan panelde gösterilecek detayını üretir: mekanizma,
// hız, kalan et, saat pozisyonu, hangi "denklemden" geldiği, KAYNAK ATIFLARI
// (bkz. master görev madde 4). `hotspot` (u/v/valueMm/clockPosition/
// descriptionTr) `@erocorr3d/engine`'in GERÇEK `DamageField.extractHotspots()`
// çıktısıdır (bkz. useDemoHotspots.ts) — ama altındaki hız/mekanizma verisi
// bu görüntüleyicinin kendi demo senaryosudur, GERÇEK bir motor hesabı
// DEĞİLDİR. Bu yüzden `modelUsed`/`sourceRefs`/`validityWarnings` alanları
// KASITLI OLARAK bunu açıkça söyler — KDP'nin "bulamadıysan uydurma,
// UNVERIFIED işaretle" ilkesinin bu görüntüleyicideki karşılığı (bkz.
// shaders/demoScalarField.ts'in aynı "SENTETİK/DEMO" dürüstlük kuralı).
// KDP bu dosyaya doğrudan UYGULANMAZ (hesaplanan bir mühendislik sonucu
// yok, salt görüntüleme demosu) — ama dürüstlük ilkesi AYNEN uygulanır.

import type { Hotspot } from "@erocorr3d/engine";
import type { DemoScenario } from "../timeSlider/demoTimeDependentField";

export interface DemoHotspotDetail {
  hotspot: Hotspot;
  scenarioLabelTr: string;
  rateMmPerYear: number;
  remainingWallMm: number;
  modelUsed: string;
  formula: string;
  sourceRefs: string[];
  validityWarnings: string[];
}

const SYNTHETIC_MODEL_LABEL_TR = "SENTETİK DEMO — gerçek bir mekanizma hesabı DEĞİL";

const SYNTHETIC_FORMULA_TR =
  "hasar(u,v) = yoğunluk(u,v) × tepe_hız × geçen_yıl — bkz. timeSlider/demoTimeDependentField.ts::computeDemoTimeDependentDamageMm";

export function buildDemoHotspotDetail(hotspot: Hotspot, scenario: DemoScenario, wtMm: number): DemoHotspotDetail {
  if (wtMm <= 0) throw new Error("wtMm pozitif olmalıdır.");
  return {
    hotspot,
    scenarioLabelTr: scenario.labelTr,
    rateMmPerYear: scenario.peakRateMmPerYear,
    remainingWallMm: Math.max(wtMm - hotspot.valueMm, 0),
    modelUsed: SYNTHETIC_MODEL_LABEL_TR,
    formula: SYNTHETIC_FORMULA_TR,
    sourceRefs: [
      "Bu noktanın KONUMU gerçek packages/engine/src/spatial/ DamageField.extractHotspots() algoritmasıyla bulundu.",
      "Altındaki hasar VERİSİ sentetik demo desenidir — gerçek mekanizma/denklem/kaynak ataması için corrosion|erosion sonuçlarının MechanismResult[] olarak üretilip computeDamageField()'a verilmesi gerekir (bu üretim/orkestrasyon katmanı henüz kurulmadı).",
    ],
    validityWarnings: ["Bu sonuç mühendislik tahmini DEĞİLDİR — yalnızca 3B görüntüleyici demosu."],
  };
}

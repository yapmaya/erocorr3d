// packages/engine/src/registry/coefficients/pittingCreviceCscc.ts
//
// Çukurlaşma/aralık(crevice)/CSCC karar mantığı için tek yeni sayısal
// girdi: JENERİK (alaşım ailesinden bağımsız) klorür konsantrasyonu risk
// bantları. Malzemeye özgü PREN/CPT/CCT/CSCC sınırları ZATEN data/
// materials.ts'te (KDP-sourced, ayrı bir oturumda) kayıtlıdır — burada
// TEKRAR EDİLMEZ.

import type { Coefficient, Source } from "../types";

const MODULE = "pittingCreviceCscc";

const SRC_PENFLEX: Source = {
  type: "TEXTBOOK",
  citation:
    "Penflex Engineering Bulletin #105 (\"Chloride and Chlorine Levels and Stainless Steel Alloy " +
    "Selection\") — 304/304L/321 için ~100 ppm klorür sınırı, 316/316L için ~2000 ppm'e kadar tolerans " +
    "bildiriyor.",
  url: "https://www.penflex.com/news/chloride-chlorine-levels-and-stainless-steel-alloy-selection/",
  accessedDate: "2026-08-12",
};

const CHLORIDE_RISK_BANDS_PPM: Coefficient<{ lowMaxPpm: number; moderateMaxPpm: number; highMaxPpm: number }> = {
  id: "pittingCreviceCscc.genericChlorideRiskBandsPpm",
  module: MODULE,
  value: { lowMaxPpm: 50, moderateMaxPpm: 1000, highMaxPpm: 5000 },
  unit: "ppm",
  description:
    "JENERİK (alaşım ailesinden BAĞIMSIZ) klorür konsantrasyonu risk bantları — yalnızca BAĞLAMSAL/ikincil " +
    "bir gösterge, birincil karar HER ZAMAN malzemenin kendi cptC/cctC/csccLimitC değeriyle servis " +
    "sıcaklığının karşılaştırılmasıdır (bkz. assessPittingCreviceCsccRisk).",
  source: SRC_PENFLEX,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "LOW",
  notes:
    "ÖNEMLİ SINIRLAMA: gerçek klorür toleransı alaşıma göre ÇOK BÜYÜK ölçüde değişir (304: ~100ppm, 316: " +
    "~2000ppm — Penflex kaynağının kendi verisi bunu gösteriyor) — TEK bir jenerik bant seti bu farkı " +
    "YANSITAMAZ, bu yüzden confidence=LOW ve yalnızca EK BAĞLAM olarak kullanılır, malzemenin kendi CPT/CCT " +
    "karşılaştırmasının YERİNİ TUTMAZ.",
};

export const PITTING_CREVICE_CSCC_COEFFICIENTS: Coefficient[] = [CHLORIDE_RISK_BANDS_PPM as Coefficient];

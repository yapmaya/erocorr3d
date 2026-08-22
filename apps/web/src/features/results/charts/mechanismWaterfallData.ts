// apps/web/src/features/results/charts/mechanismWaterfallData.ts
//
// Şelale (waterfall) verisi (B). ÖNEMLİ KDP NOTU — kapsam bilinçli olarak
// SINIRLANDIRILDI: master talimatın tarif ettiği "temel hız → +sıcaklık →
// +hız → −inhibitör → −kısmi çalışma" ayrıştırması, motorun
// `calculationTrace`'inde YALNIZCA NORSOK M-506 (CO2_SWEET) yolunda VE
// FARKLI BİRİMLERDE (fugasite=bar, pH=boyutsuz, ara sıcaklık düğümü
// hızları=mm/yıl AMA birbirinin üzerine TOPLANMAZ, ARALARINDA enterpolasyon
// yapılır) mevcuttur — bu adımları tek bir kümülatif/toplamsal şelale
// çubuğuna ZORLAMAK yanıltıcı (birbirinden bağımsız, farklı birimli
// niceliklerin sanki toplanıyormuş gibi gösterilmesi) olurdu.
//
// Bu yüzden şelale, YALNIZCA GERÇEKTEN toplamsal olan 3 adımdan kurulur
// (hepsi motorun ZATEN hesapladığı, doğrudan `ScenarioAssessment`ten gelen
// gerçek sayılardır — bkz. aggregate/metalLoss.ts::computeScenarioAnnualLoss):
//   1) Baskın mekanizmanın tam-yıl hızı (rateP50)
//   2) Diğer UYGULANAN mekanizmaların tam-yıl toplamı (varsa)
//   3) Kısmi çalışma düzeltmesi (annualLossMmPerYear.p50 − (1)+(2))
// Toplamı = o senaryonun GERÇEK yıllık katkısı. Baskın mekanizmanın KENDİ
// `calculationTrace`'i (varsa) AYRI bir "hesaplama izi" listesi olarak
// (şelale çubuklarına KARIŞTIRILMADAN) sunulur — bkz. `traceRows`.

import type { CaseAssessment, TraceStep } from "@erocorr3d/engine";

export interface WaterfallStep {
  labelTr: string;
  value: number;
  cumulativeStart: number;
  cumulativeEnd: number;
  isTotal: boolean;
}

export interface MechanismWaterfallData {
  mechanismNameTr: string;
  steps: WaterfallStep[];
  traceRows: TraceStep[];
  hasTrace: boolean;
}

export function buildMechanismWaterfallData(caseAssessment: CaseAssessment, annualLossMmPerYearP50: number): MechanismWaterfallData | null {
  const applicable = caseAssessment.mechanismResults.filter((m) => m.isApplicable);
  if (applicable.length === 0) return null;

  const dominant = applicable.reduce((max, m) => (m.rateP50 > max.rateP50 ? m : max), applicable[0]);
  const fullYearRate = dominant.rateP50;
  const otherMechanismsRate = applicable.filter((m) => m !== dominant).reduce((sum, m) => sum + m.rateP50, 0);
  const partialOperationDelta = annualLossMmPerYearP50 - (fullYearRate + otherMechanismsRate);

  const steps: WaterfallStep[] = [];
  let cumulative = 0;
  const pushStep = (labelTr: string, value: number) => {
    const cumulativeStart = cumulative;
    cumulative += value;
    steps.push({ labelTr, value, cumulativeStart, cumulativeEnd: cumulative, isTotal: false });
  };

  pushStep(`${dominant.nameTr} (baskın mekanizma, tam yıl)`, fullYearRate);
  if (otherMechanismsRate > 0) pushStep("Diğer mekanizmaların tam yıl katkısı", otherMechanismsRate);
  pushStep("Kısmi çalışma düzeltmesi", partialOperationDelta);
  steps.push({ labelTr: "Yıllık Katkı (toplam)", value: cumulative, cumulativeStart: 0, cumulativeEnd: cumulative, isTotal: true });

  return {
    mechanismNameTr: dominant.nameTr,
    steps,
    traceRows: dominant.calculationTrace,
    hasTrace: dominant.calculationTrace.length > 0,
  };
}

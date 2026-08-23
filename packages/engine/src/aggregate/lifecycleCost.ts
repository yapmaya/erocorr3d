// packages/engine/src/aggregate/lifecycleCost.ts
//
// Yaşam döngüsü maliyet karşılaştırması — CRA'ya geçiş vs CS + inhibitör +
// izleme, N yıl (master görev madde 5). PARA BİRİMİ (TL/USD) KULLANMAZ:
// gerçek pazar fiyatları bu projenin bilgisi DAHİLİNDE değil (KDP md.4).
// Bunun yerine data/materials.ts::MaterialSpec.relativeCostIndex ile AYNI
// göreli birimde (CS=1,0 referans) çalışır — tüm OPEX (inhibitör/izleme/
// muayene olayı) faktörleri de bu göreli birimde, kullanıcı tarafından
// AYARLANABİLİR varsayılanlarla verilir (bkz. DEFAULT_* sabitleri, hepsi
// açıkça UNVERIFIED/gösterge niteliğinde — gerçek pazar fiyatına bağlı).
//
// NPV (net bugünkü değer) formülü standart mühendislik ekonomisidir (kamu
// malı matematik, KDP kapsamı dışı — data/materials.ts'in relativeCostIndex
// notuyla AYNI gerekçe: "piyasa fiyatlarına bağlı gösterge niteliğindedir").

import { ENGINEERING_DISCLAIMER_TR } from "../corrosion/types";

/** Bu varsayılanlar GÖSTERGE niteliğindedir — gerçek pazar fiyatına bağlıdır, KULLANICI TARAFINDAN GÖZDEN GEÇİRİLİP AYARLANMALIDIR (KDP md.4, UNVERIFIED). */
export const DEFAULT_DISCOUNT_RATE_PERCENT = 8;
export const DEFAULT_INHIBITOR_ANNUAL_COST_FACTOR = 0.05;
export const DEFAULT_MONITORING_ANNUAL_COST_FACTOR = 0.02;
export const DEFAULT_INSPECTION_EVENT_COST_FACTOR = 0.03;
export const DEFAULT_HORIZON_YEARS = 30;

export interface LifecycleCostOptionInput {
  labelTr: string;
  /** CS=1,0 referans göreli malzeme (CAPEX) maliyeti — bkz. data/materials.ts::MaterialSpec.relativeCostIndex */
  relativeCapexCostIndex: number;
  /** Bu seçenek için inhibitör kullanılıyor mu (yıllık OPEX'e inhibitorAnnualCostFactor eklenir) */
  inhibitorUsed: boolean;
  /** Yıllık sürekli izleme (ER prob/kupon vb.) göreli OPEX'i uygulanır mı */
  continuousMonitoringApplied: boolean;
  /** Muayene aralığı (yıl) — her katında bir "muayene olayı" göreli maliyeti eklenir */
  inspectionIntervalYears: number;
}

export interface LifecycleCostAssumptions {
  horizonYears: number;
  discountRatePercent: number;
  inhibitorAnnualCostFactor: number;
  monitoringAnnualCostFactor: number;
  inspectionEventCostFactor: number;
}

export interface LifecycleCostOptionResult {
  labelTr: string;
  npvRelative: number;
  cumulativeByYear: { year: number; cumulativeUndiscountedRelative: number; cumulativeDiscountedRelative: number }[];
}

export interface LifecycleCostComparisonResult {
  assumptions: LifecycleCostAssumptions;
  options: LifecycleCostOptionResult[];
  cheaperOptionLabelTr: string;
  breakEvenYear: number | null;
  disclaimer: string;
  notesTr: string[];
}

function computeOptionNpv(option: LifecycleCostOptionInput, assumptions: LifecycleCostAssumptions): LifecycleCostOptionResult {
  const { horizonYears, discountRatePercent, inhibitorAnnualCostFactor, monitoringAnnualCostFactor, inspectionEventCostFactor } =
    assumptions;
  const discountRate = discountRatePercent / 100;

  let cumulativeUndiscounted = option.relativeCapexCostIndex;
  let npv = option.relativeCapexCostIndex;
  const cumulativeByYear: LifecycleCostOptionResult["cumulativeByYear"] = [
    { year: 0, cumulativeUndiscountedRelative: cumulativeUndiscounted, cumulativeDiscountedRelative: npv },
  ];

  for (let year = 1; year <= horizonYears; year++) {
    let annualOpex = 0;
    if (option.inhibitorUsed) annualOpex += inhibitorAnnualCostFactor;
    if (option.continuousMonitoringApplied) annualOpex += monitoringAnnualCostFactor;
    if (option.inspectionIntervalYears > 0 && year % Math.round(option.inspectionIntervalYears) === 0) {
      annualOpex += inspectionEventCostFactor;
    }
    cumulativeUndiscounted += annualOpex;
    npv += annualOpex / (1 + discountRate) ** year;
    cumulativeByYear.push({ year, cumulativeUndiscountedRelative: cumulativeUndiscounted, cumulativeDiscountedRelative: npv });
  }

  return { labelTr: option.labelTr, npvRelative: npv, cumulativeByYear };
}

/**
 * CRA'ya geçiş vs CS+inhibitör+izleme yaşam döngüsü maliyet karşılaştırması
 * (master görev madde 5) — göreli birimde (CS=1,0), N yıl ufuk, NPV.
 */
export function compareLifecycleCost(
  options: LifecycleCostOptionInput[],
  assumptionsInput: Partial<LifecycleCostAssumptions> = {},
): LifecycleCostComparisonResult {
  if (options.length < 2) {
    throw new Error("Karşılaştırma için en az 2 seçenek (ör. CS ve CRA) gereklidir.");
  }

  const assumptions: LifecycleCostAssumptions = {
    horizonYears: assumptionsInput.horizonYears ?? DEFAULT_HORIZON_YEARS,
    discountRatePercent: assumptionsInput.discountRatePercent ?? DEFAULT_DISCOUNT_RATE_PERCENT,
    inhibitorAnnualCostFactor: assumptionsInput.inhibitorAnnualCostFactor ?? DEFAULT_INHIBITOR_ANNUAL_COST_FACTOR,
    monitoringAnnualCostFactor: assumptionsInput.monitoringAnnualCostFactor ?? DEFAULT_MONITORING_ANNUAL_COST_FACTOR,
    inspectionEventCostFactor: assumptionsInput.inspectionEventCostFactor ?? DEFAULT_INSPECTION_EVENT_COST_FACTOR,
  };
  if (assumptions.horizonYears <= 0) {
    throw new Error("horizonYears pozitif olmalıdır.");
  }

  const results = options.map((option) => computeOptionNpv(option, assumptions));
  const cheapest = results.reduce((min, r) => (r.npvRelative < min.npvRelative ? r : min));

  let breakEvenYear: number | null = null;
  if (results.length === 2) {
    const [a, b] = results;
    for (let i = 1; i < a.cumulativeByYear.length; i++) {
      const diffPrev = a.cumulativeByYear[i - 1].cumulativeDiscountedRelative - b.cumulativeByYear[i - 1].cumulativeDiscountedRelative;
      const diffNow = a.cumulativeByYear[i].cumulativeDiscountedRelative - b.cumulativeByYear[i].cumulativeDiscountedRelative;
      if (Math.sign(diffPrev) !== Math.sign(diffNow) && diffPrev !== 0) {
        breakEvenYear = a.cumulativeByYear[i].year;
        break;
      }
    }
  }

  return {
    assumptions,
    options: results,
    cheaperOptionLabelTr: cheapest.labelTr,
    breakEvenYear,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    notesTr: [
      "Sonuçlar PARA BİRİMİ (TL/USD) DEĞİL, göreli birimdedir (CS malzeme CAPEX'i = 1,0 referans) — " +
        "data/materials.ts::relativeCostIndex ile AYNI sözleşme.",
      "OPEX varsayılanları (inhibitör/izleme/muayene olayı göreli maliyeti) ve iskonto oranı GÖSTERGE " +
        "niteliğindedir, gerçek pazar fiyatına bağlıdır — kullanılmadan önce projeye özgü değerlerle " +
        "güncellenmelidir (KDP md.4, UNVERIFIED).",
    ],
  };
}

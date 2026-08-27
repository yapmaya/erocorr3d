// packages/engine/src/aggregate/metalLoss.ts
//
// Toplam metal kaybı (SLC — Service Life Corrosion) hesabı: her işletme
// senaryosu (ör. "çekiş modu 91 gün/yıl", "enjeksiyon modu 274 gün/yıl")
// için kısmi-çalışma düzeltmesi uygulanmış yıllık kayıp hesaplanır
// (corrosion/rules.ts::applyPartialOperationFactor — TEK doğruluk kaynağı,
// burada TEKRAR EDİLMEZ), senaryolar toplanarak birleşik yıllık kayıp elde
// edilir, × tasarım ömrü = SLC.
//
// Kaynak: kullanıcının kendi iç proje dokümanı (bir tabloda SLC=(gün/365)×ömür×CR
// — bkz. registry/coefficients/metalLoss.ts) — kimliği izlenebilirlik
// amacıyla anonim tutuluyor. Örnek doğrulama (dosyanın kendi metninden):
// 91 gün/yıl çekiş işletmesi, 30 yıl tasarım ömrü
// → SLC = (91/365)×30×CR ≈ 0,25×30×CR (test dosyasında bu örnek BİREBİR
// doğrulanır).

import { applyPartialOperationFactor } from "../corrosion/rules";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { ConfidenceLevel } from "../registry/types";
import { worstConfidence } from "../registry";
import { getCoefficient } from "../registry";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import { assertFinite } from "../guards/numericGuards";

export interface MetalLossScenario {
  scenarioNameTr: string;
  /** Bu senaryonun yılda kaç gün geçerli olduğu (0-365) */
  operatingDaysPerYear: number;
  /** Bu senaryo için hesaplanmış korozyon/erozyon/toplam hızı (P10/P50/P90) — tam yıl (365 gün) çalışsaydı geçerli olacak hız */
  rateMmPerYear: UncertaintyBand;
}

export interface ScenarioAnnualLoss {
  scenarioNameTr: string;
  operatingDaysPerYear: number;
  /** Bu senaryonun, kısmi-çalışma düzeltmesi uygulanmış yıllık katkısı */
  annualLossMmPerYear: UncertaintyBand;
}

export interface MetalLossResult {
  scenarioAnnualLosses: ScenarioAnnualLoss[];
  /** Tüm senaryoların toplamı = birleşik yıllık kayıp */
  totalAnnualLossMmPerYear: UncertaintyBand;
  designLifeYears: number;
  /** Toplam metal kaybı (SLC) = birleşik yıllık kayıp × tasarım ömrü */
  totalServiceLifeCorrosionMm: UncertaintyBand;
  /** En büyük yıllık katkıyı yapan (P50 bazında) senaryo — "belirleyici senaryo" */
  governingScenarioNameTr: string;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

function scaleBand(band: UncertaintyBand, factor: number): UncertaintyBand {
  return { p10: band.p10 * factor, p50: band.p50 * factor, p90: band.p90 * factor };
}

function addBands(a: UncertaintyBand, b: UncertaintyBand): UncertaintyBand {
  return { p10: a.p10 + b.p10, p50: a.p50 + b.p50, p90: a.p90 + b.p90 };
}

/**
 * Tek bir senaryonun, kısmi-çalışma düzeltmesi uygulanmış yıllık kaybını
 * hesaplar (P10/P50/P90'ın HER ÜÇÜNE de aynı düzeltme uygulanır).
 *
 * Model adı: corrosion/rules.ts::applyPartialOperationFactor (proje kuralı,
 * gün/365 oranı) — bkz. o fonksiyonun kendi JSDoc'u.
 */
export function computeScenarioAnnualLoss(scenario: MetalLossScenario): ScenarioAnnualLoss {
  return {
    scenarioNameTr: scenario.scenarioNameTr,
    operatingDaysPerYear: scenario.operatingDaysPerYear,
    annualLossMmPerYear: {
      p10: applyPartialOperationFactor(scenario.rateMmPerYear.p10, scenario.operatingDaysPerYear),
      p50: applyPartialOperationFactor(scenario.rateMmPerYear.p50, scenario.operatingDaysPerYear),
      p90: applyPartialOperationFactor(scenario.rateMmPerYear.p90, scenario.operatingDaysPerYear),
    },
  };
}

/**
 * Tüm senaryoların birleşik yıllık kaybını ve tasarım ömrü boyunca toplam
 * metal kaybını (SLC) hesaplar.
 *
 * Model adı: kullanıcının kendi iç proje dokümanının bir tablosu, SLC formülü
 * (bkz. registry/coefficients/metalLoss.ts) — SLC=(gün/365)×tasarım ömrü×CR,
 * çoklu senaryo için toplamsal olarak genişletildi (her senaryo kendi
 * gün/365 oranını taşır, "Tüm senaryoların toplamı = yıllık kayıp" — bu
 * projenin görev tanımının kendi kuralı, standardın TEK senaryo formülünün
 * doğal bir genellemesidir).
 * Girdi/çıktı birimleri: gün, yıl, mm/yıl → çıktı mm.
 * Bilinen sınırlamalar: senaryolar arasında BAĞIMSIZLIK varsayılır (bir
 * senaryonun korozyon ürünü/filmi bir SONRAKİ senaryoyu etkilemez) — gerçek
 * sistemlerde senaryolar arası geçiş etkileri (ör. bir modda oluşan filmin
 * bir SONRAKİ modu geçici olarak koruması) bu modelde YOKTUR.
 */
export function computeTotalMetalLoss(scenarios: MetalLossScenario[], designLifeYears: number): MetalLossResult {
  if (scenarios.length === 0) {
    throw new Error("En az bir senaryo sağlanmalıdır.");
  }
  assertFinite(designLifeYears, "Tasarım ömrü");
  if (designLifeYears <= 0) {
    throw new Error("Tasarım ömrü pozitif olmalıdır.");
  }
  for (const scenario of scenarios) {
    assertFinite(scenario.operatingDaysPerYear, `"${scenario.scenarioNameTr}" senaryosu için işletme günü`);
    if (scenario.operatingDaysPerYear < 0 || scenario.operatingDaysPerYear > 365) {
      throw new Error(`"${scenario.scenarioNameTr}" senaryosu için işletme günü 0-365 aralığında olmalıdır.`);
    }
  }

  const validityWarnings: ValidityWarning[] = [];
  const totalOperatingDays = scenarios.reduce((sum, s) => sum + s.operatingDaysPerYear, 0);
  if (totalOperatingDays > 365) {
    validityWarnings.push({
      parameter: "Toplam işletme günü",
      value: totalOperatingDays,
      min: 0,
      max: 365,
      unit: "gün/yıl",
      message: `Senaryoların toplam işletme günü (${totalOperatingDays}) 365'i aşıyor — senaryolar birbiriyle ÇAKIŞIYOR olabilir, girdileri kontrol edin.`,
    });
  }

  const scenarioAnnualLosses = scenarios.map(computeScenarioAnnualLoss);
  const totalAnnualLossMmPerYear = scenarioAnnualLosses.reduce(
    (sum, s) => addBands(sum, s.annualLossMmPerYear),
    { p10: 0, p50: 0, p90: 0 },
  );

  const totalServiceLifeCorrosionMm = scaleBand(totalAnnualLossMmPerYear, designLifeYears);

  const governingScenario = scenarioAnnualLosses.reduce((max, s) =>
    s.annualLossMmPerYear.p50 > max.annualLossMmPerYear.p50 ? s : max,
  );

  const slcFormulaEntry = getCoefficient("metalLoss.slcFormula");

  return {
    scenarioAnnualLosses,
    totalAnnualLossMmPerYear,
    designLifeYears,
    totalServiceLifeCorrosionMm,
    governingScenarioNameTr: governingScenario.scenarioNameTr,
    confidence: worstConfidence([slcFormulaEntry.confidence]),
    validityWarnings,
    sourcesUsed: ["metalLoss.slcFormula"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

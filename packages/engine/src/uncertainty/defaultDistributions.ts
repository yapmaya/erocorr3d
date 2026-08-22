// packages/engine/src/uncertainty/defaultDistributions.ts
//
// Her ana proses girdisi için MAKUL VARSAYILAN belirsizlik dağılımı üretir
// (kullanıcı her zaman değiştirebilir — bunlar yalnızca başlangıç
// değerleridir). Her fonksiyon, kullandığı registry katsayısının
// gerekçesini (rationaleTr) ve güven seviyesini (confidence) de döndürür ki
// UI bunu doğrudan gösterebilsin (bkz. proje talimatının "Hepsini kayıt
// defterine işle, gerekçesini yaz" şartı).
//
// Sözleşme: "±X" doğruluk beyanı, NORMAL dağılımların standart sapmasına
// σ=X/Z90 formülüyle çevrilir (Z90=Φ⁻¹(0,95)≈1,6449 — bkz.
// registry/coefficients/uncertainty.ts::uncertainty.confidenceIntervalConvention.zScore90).
// Bu, "±X" ifadesini %90 iki-taraflı güven aralığının yarı-genişliği olarak
// yorumlayan, bu projeye özgü bir seçimdir (genel metroloji pratiğiyle
// uyumlu ama evrensel bir kural değildir) — her fonksiyonun kendi notunda
// tekrar belgelenir.

import { getCoefficient } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { InputDistribution } from "./monteCarlo";

export interface DefaultDistributionSpec {
  distribution: InputDistribution;
  rationaleTr: string;
  confidence: ConfidenceLevel;
  sourcesUsed: string[];
}

function stdDevFromPlusMinus(plusMinus: number): number {
  const z90 = getCoefficient<number>("uncertainty.confidenceIntervalConvention.zScore90").value;
  return plusMinus / z90;
}

/**
 * Sıcaklık girdisi için varsayılan dağılım: NORMAL(mean=meanTemperatureC, stdDev=3°C/Z90).
 * Kaynak: uncertainty.defaultDistribution.temperatureStdDevC (MEDIUM).
 */
export function buildDefaultTemperatureDistribution(meanTemperatureC: number): DefaultDistributionSpec {
  const coefficient = getCoefficient<number>("uncertainty.defaultDistribution.temperatureStdDevC");
  return {
    distribution: { type: "NORMAL", mean: meanTemperatureC, stdDev: stdDevFromPlusMinus(coefficient.value) },
    rationaleTr:
      `Sıcaklık ölçüm/tahmin belirsizliği ±${coefficient.value}°C olarak kabul edildi (proje talimatı, ` +
      "endüstriyel RTD/termokupl doğruluk aralığıyla çapraz karşılaştırıldı — bkz. katsayı notları); " +
      "NORMAL dağılıma σ=±X/Z90 (%90 GA yarı-genişliği) dönüşümüyle çevrildi.",
    confidence: coefficient.confidence,
    sourcesUsed: ["uncertainty.defaultDistribution.temperatureStdDevC", "uncertainty.confidenceIntervalConvention.zScore90"],
  };
}

/**
 * Basınç girdisi için varsayılan dağılım: NORMAL(mean=meanPressureBara, stdDev=(±%5×mean)/Z90).
 * Kaynak: uncertainty.defaultDistribution.pressureRelativeStdDevFraction (MEDIUM).
 */
export function buildDefaultPressureDistribution(meanPressureBara: number): DefaultDistributionSpec {
  if (meanPressureBara <= 0) throw new Error("meanPressureBara pozitif olmalıdır.");
  const coefficient = getCoefficient<number>("uncertainty.defaultDistribution.pressureRelativeStdDevFraction");
  const plusMinus = meanPressureBara * coefficient.value;
  return {
    distribution: { type: "NORMAL", mean: meanPressureBara, stdDev: stdDevFromPlusMinus(plusMinus) },
    rationaleTr:
      `Basınç belirsizliği ortalamanın ±%${(coefficient.value * 100).toFixed(0)}'i olarak kabul edildi ` +
      "(proje talimatı, saf enstrüman doğruluğundan — ~±%0,5-2 — kasıtlı olarak daha geniş: proses " +
      "değişkenliğini de kapsar); NORMAL dağılıma σ=±X/Z90 dönüşümüyle çevrildi.",
    confidence: coefficient.confidence,
    sourcesUsed: [
      "uncertainty.defaultDistribution.pressureRelativeStdDevFraction",
      "uncertainty.confidenceIntervalConvention.zScore90",
    ],
  };
}

/**
 * CO2 mol yüzdesi girdisi için varsayılan dağılım: NORMAL(mean=meanCo2MolePercent, stdDev=(±%10×mean)/Z90).
 * Kaynak: uncertainty.defaultDistribution.co2RelativeStdDevFraction (MEDIUM).
 */
export function buildDefaultCo2Distribution(meanCo2MolePercent: number): DefaultDistributionSpec {
  if (meanCo2MolePercent <= 0) throw new Error("meanCo2MolePercent pozitif olmalıdır.");
  const coefficient = getCoefficient<number>("uncertainty.defaultDistribution.co2RelativeStdDevFraction");
  const plusMinus = meanCo2MolePercent * coefficient.value;
  return {
    distribution: { type: "NORMAL", mean: meanCo2MolePercent, stdDev: stdDevFromPlusMinus(plusMinus) },
    rationaleTr:
      `CO2 analiz belirsizliği ortalamanın ±%${(coefficient.value * 100).toFixed(0)}'i olarak kabul edildi ` +
      "(proje talimatı, gaz kromatografisi saf analiz doğruluğundan — ~±%3-6 — kasıtlı olarak daha geniş: " +
      "numune alma ve kalibrasyon gazı belirsizliğini de kapsar); NORMAL dağılıma σ=±X/Z90 dönüşümüyle çevrildi.",
    confidence: coefficient.confidence,
    sourcesUsed: [
      "uncertainty.defaultDistribution.co2RelativeStdDevFraction",
      "uncertainty.confidenceIntervalConvention.zScore90",
    ],
  };
}

/**
 * pH girdisi için varsayılan dağılım: NORMAL(mean=meanPh, stdDev=0,3/Z90), [0,14] aralığına kırpılmaz
 * (örnekleme sırasında nadiren aralık dışına çıkabilir — çağıran, modelFn içinde gerekirse kendi
 * kırpmasını uygular; bu fonksiyon yalnızca dağılım PARAMETRELERİNİ üretir, örnek üretmez).
 * Kaynak: uncertainty.defaultDistribution.phStdDev (MEDIUM).
 */
export function buildDefaultPhDistribution(meanPh: number): DefaultDistributionSpec {
  if (meanPh < 0 || meanPh > 14) throw new Error("meanPh [0,14] aralığında olmalıdır.");
  const coefficient = getCoefficient<number>("uncertainty.defaultDistribution.phStdDev");
  return {
    distribution: { type: "NORMAL", mean: meanPh, stdDev: stdDevFromPlusMinus(coefficient.value) },
    rationaleTr:
      `pH belirsizliği ±${coefficient.value} pH birimi olarak kabul edildi (proje talimatı, saf pH metre ` +
      "doğruluğundan — ~±0,05-0,2 — kasıtlı olarak daha geniş: bu proje pH'ı çoğu zaman doğrudan ölçmek " +
      "yerine norsokPh.ts ile TAHMİN ettiğinden model-tahmini belirsizliğini de kapsar); NORMAL dağılıma " +
      "σ=±X/Z90 dönüşümüyle çevrildi.",
    confidence: coefficient.confidence,
    sourcesUsed: ["uncertainty.defaultDistribution.phStdDev", "uncertainty.confidenceIntervalConvention.zScore90"],
  };
}

/**
 * Kum debisi (sandRateKgDay) girdisi için varsayılan dağılım: LOGNORMAL(median, p90OverP50=1,5) —
 * yani P90=medyan×1,5, P10=medyan/1,5 (proje talimatının ±%50'sinin bu projenin kendi çarpımsal
 * bant sözleşmesiyle — bkz. uncertainty/percentiles.ts — tutarlı yorumu). LOGNORMAL seçildi çünkü
 * kum debisi negatif olamaz ve tahmin belirsizliği tipik olarak sağa çarpıktır (bu oturumun kendi
 * modelleme kararı — bkz. katsayı notları).
 * Kaynak: uncertainty.defaultDistribution.sandRateP90OverP50 (LOW — bkz. katsayı notlarındaki
 * ölçüm-vs-tahmin belirsizliği ayrımı).
 */
export function buildDefaultSandRateDistribution(medianSandRateKgDay: number): DefaultDistributionSpec {
  if (medianSandRateKgDay <= 0) throw new Error("medianSandRateKgDay pozitif olmalıdır.");
  const coefficient = getCoefficient<number>("uncertainty.defaultDistribution.sandRateP90OverP50");
  return {
    distribution: { type: "LOGNORMAL", median: medianSandRateKgDay, p90OverP50: coefficient.value },
    rationaleTr:
      "Kum debisi tahmini, projenin en belirsiz girdisi olarak kabul edildi (proje talimatı, ±%50 ≈ " +
      `P90/P50=${coefficient.value}); bu, ZATEN AKAN kumu enstrümanla ÖLÇME doğruluğundan (~±%10-15, ` +
      "akustik kum izleme literatürü) çok daha geniştir çünkü burada tasarım/rezervuar TAHMİN belirsizliği " +
      "modelleniyor, ölçüm belirsizliği değil (bkz. katsayı notları). LOGNORMAL seçildi (negatif olamaz, " +
      "sağa çarpık).",
    confidence: coefficient.confidence,
    sourcesUsed: ["uncertainty.defaultDistribution.sandRateP90OverP50"],
  };
}

/**
 * İnhibitör verimi girdisi için varsayılan ÜÇGEN (triangular) dağılım:
 * min=nominal×(1-0,25), mode=nominal, max=min(nominal×(1+0,25), 1) — verim [0,1] fraksiyon olarak
 * kabul edilir ve üst sınır asla %100'ü aşamaz.
 * Kaynak: uncertainty.defaultDistribution.inhibitorEfficiencyTriangularHalfWidthFraction (MEDIUM, NACE-11062).
 */
export function buildDefaultInhibitorEfficiencyDistribution(
  nominalEfficiencyFraction: number,
): DefaultDistributionSpec {
  if (nominalEfficiencyFraction <= 0 || nominalEfficiencyFraction > 1) {
    throw new Error("nominalEfficiencyFraction (0,1] aralığında olmalıdır.");
  }
  const coefficient = getCoefficient<number>(
    "uncertainty.defaultDistribution.inhibitorEfficiencyTriangularHalfWidthFraction",
  );
  const min = nominalEfficiencyFraction * (1 - coefficient.value);
  const max = Math.min(nominalEfficiencyFraction * (1 + coefficient.value), 1);
  return {
    distribution: { type: "TRIANGULAR", min, mode: nominalEfficiencyFraction, max },
    rationaleTr:
      "İnhibitör verimi için ÜÇGEN dağılım kullanıldı (proje talimatının kendi şartı), yarı-genişlik " +
      `±%${(coefficient.value * 100).toFixed(0)} ` +
      "(NACE-11062'nin HIC inhibitör testlerinde bulduğu test-hücreden-test-hücreye ~%25 deneysel " +
      "değişkenliğe analoji yoluyla), üst sınır %100'de kırpıldı.",
    confidence: coefficient.confidence,
    sourcesUsed: ["uncertainty.defaultDistribution.inhibitorEfficiencyTriangularHalfWidthFraction"],
  };
}

// packages/engine/src/corrosion/o2.ts
//
// Çözünmüş oksijen korozyonu risk değerlendirmesi.
//
// ⚠ Bu mekanizma için de (bkz. data/mechanisms.ts::OXYGEN, API RP 571
// §4.3.5, MEDIUM confidence — kazan/kondensat bağlamı) HİÇBİR kaynak
// sayısal bir mm/yıl hızı vermiyor. assessOxygenCorrosionRisk() bir
// RiskScoreResult döndürür; conditionalRateRangeMmPerYear HER ZAMAN null'dur.
//
// Kural: kuru gaz fazda (bkz. corrosion/rules.ts::isDryGas) ve serbest su
// yoksa mekanizma geçerli değildir — sıcaklığın hızlı yükseldiği noktalarda
// (ör. ısıtıcı/ekonomizer) daha agresiftir (API 571 §4.3.5).

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import {
  ENGINEERING_DISCLAIMER_TR,
  classifyRiskScore,
  clampRiskScore,
  type RiskFactorContribution,
  type RiskScoreResult,
  type ValidityWarning,
} from "./types";

export interface OxygenCorrosionRiskInput {
  dissolvedOxygenPpb: number;
  /** Akışkanın ani sıcaklık artışına maruz kaldığı bir nokta mı (ısıtıcı/ekonomizer girişi vb.) — API 571 §4.3.5 */
  rapidTemperatureRiseLocation: boolean;
  flowVelocityMs: number;
  freeWaterPresent: boolean;
  isDryGas: boolean;
}

/**
 * Çözünmüş oksijen korozyonu risk skorunu (0-100) değerlendirir.
 *
 * Model adı: bu projenin kendi risk-skoru ağırlıklandırması (bkz. dosya başı
 * yorumu), ppb bantları için bkz. registry/coefficients/oxygen.ts.
 * Girdi/çıktı birimleri: ppb, m/s → çıktı boyutsuz risk skoru (0-100).
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur.
 */
export function assessOxygenCorrosionRisk(input: OxygenCorrosionRiskInput): RiskScoreResult {
  if (input.dissolvedOxygenPpb < 0) {
    throw new Error("Çözünmüş oksijen konsantrasyonu negatif olamaz.");
  }
  if (input.flowVelocityMs < 0) {
    throw new Error("Akış hızı negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];

  if (input.isDryGas || !input.freeWaterPresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Kuru gaz fazda veya serbest su yok — oksijen korozyonu mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const bands = getCoefficient<{ lowMaxPpb: number; moderateMaxPpb: number; highMaxPpb: number }>(
    "oxygen.riskBandsPpb",
  ).value;
  const sourcesUsed = ["oxygen.riskBandsPpb"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("oxygen.riskBandsPpb").confidence];

  const isMechanismActive = input.dissolvedOxygenPpb > bands.lowMaxPpb;
  const factorContributions: RiskFactorContribution[] = [];

  let ppbPoints: number;
  if (input.dissolvedOxygenPpb <= bands.lowMaxPpb) {
    ppbPoints = 5;
  } else if (input.dissolvedOxygenPpb <= bands.moderateMaxPpb) {
    ppbPoints = 35;
  } else if (input.dissolvedOxygenPpb <= bands.highMaxPpb) {
    ppbPoints = 60;
  } else {
    ppbPoints = 80;
  }
  factorContributions.push({
    factorTr: `Çözünmüş oksijen (${input.dissolvedOxygenPpb} ppb)`,
    points: ppbPoints,
    rationaleTr: "bkz. registry oxygen.riskBandsPpb bantları.",
  });

  if (input.rapidTemperatureRiseLocation) {
    factorContributions.push({
      factorTr: "Ani sıcaklık artışı noktası",
      points: 15,
      rationaleTr: "API RP 571 §4.3.5 — ısıtıcı/ekonomizer girişi gibi noktalar özellikle agresiftir.",
    });
  }

  if (input.flowVelocityMs > 3) {
    factorContributions.push({
      factorTr: "Yüksek akış hızı (O2 taşınımını artırır)",
      points: 10,
      rationaleTr:
        "Yüksek akış hızı, çözünmüş oksijenin metal yüzeyine taşınımını artırarak korozyon ürünü filminin " +
        "yeniden oluşumunu sınırlayabilir (bu proje kabulü — 3 m/s eşiği KDP kapsamı dışıdır).",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  if (input.dissolvedOxygenPpb > bands.highMaxPpb) {
    validityWarnings.push({
      parameter: "Çözünmüş oksijen",
      value: input.dissolvedOxygenPpb,
      min: 0,
      max: bands.highMaxPpb,
      unit: "ppb",
      message: `Çözünmüş oksijen (${input.dissolvedOxygenPpb} ppb), bildirilen ciddi lokalize korozyon eşiğini (${bands.highMaxPpb} ppb) aşıyor.`,
    });
  }

  return {
    isMechanismActive,
    riskScore,
    riskLevel: classifyRiskScore(riskScore),
    factorContributions,
    conditionalRateRangeMmPerYear: null,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

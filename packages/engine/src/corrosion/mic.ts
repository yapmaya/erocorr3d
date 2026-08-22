// packages/engine/src/corrosion/mic.ts
//
// Mikrobiyolojik kaynaklı korozyon (MIC) risk değerlendirmesi.
//
// ⚠ API RP 571 §4.3.8 (bkz. data/mechanisms.ts::MIC, HIGH confidence) HİÇBİR
// sayısal "tipik mm/yıl" hızı vermiyor (yalnızca örnek bir olay figürü var,
// derinlik/hız verisi içermiyor). assessMicRisk() bir RiskScoreResult
// döndürür; conditionalRateRangeMmPerYear HER ZAMAN null'dur.
//
// Risk faktörleri (akış hızı/durgunluk, ölü bacak, biyosit, su tipi,
// hidrotest suyu, sıcaklık/pH penceresi) API 571 §4.3.8'in KENDİ metninde
// NİTELİKSEL olarak listelenir (bkz. data/mechanisms.ts::MIC.triggerConditionsTr/
// preventiveMeasuresTr) — HANGİ faktörlerin önemli olduğu KDP-sourced'dır,
// bu faktörlere verilen SAYISAL PUAN AĞIRLIKLARI ise (corrosion/rules.ts ile
// aynı statüde) bu projenin kendi mühendislik kararıdır.

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

export type WaterType = "SEAWATER" | "PRODUCED_WATER" | "FRESH_WATER" | "HYDROTEST_WATER_LEFT_IN_SYSTEM";

export interface MicRiskInput {
  temperatureC: number;
  inSituPh: number;
  freeWaterPresent: boolean;
  /** Akışkan çoğunlukla durgun/çok düşük hızlı mı (dead leg, ölü bacak, uzun süreli düşük akış) */
  isStagnantOrDeadLeg: boolean;
  waterType: WaterType;
  /** Biyosit dozajlama programı aktif ve etkin mi */
  biocideProgramActive: boolean;
}

/**
 * Organizmaların (API RP 571 §4.3.8'e göre) hayatta kalabileceği sıcaklık/pH
 * penceresi içinde olup olmadığını kontrol eder.
 */
export function isWithinMicSurvivalWindow(temperatureC: number, inSituPh: number): boolean {
  const window = getCoefficient<{ minTempC: number; maxTempC: number; minPh: number; maxPh: number }>(
    "mic.organismSurvivalWindow",
  ).value;
  return (
    temperatureC >= window.minTempC &&
    temperatureC <= window.maxTempC &&
    inSituPh >= window.minPh &&
    inSituPh <= window.maxPh
  );
}

/**
 * MIC risk skorunu (0-100) değerlendirir.
 *
 * Model adı: bu projenin kendi risk-skoru ağırlıklandırması (bkz. dosya başı
 * yorumu), hayatta kalma penceresi için bkz. registry/coefficients/mic.ts.
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur.
 */
export function assessMicRisk(input: MicRiskInput): RiskScoreResult {
  const validityWarnings: ValidityWarning[] = [];

  if (!input.freeWaterPresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Serbest su yok — MIC mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const withinWindow = isWithinMicSurvivalWindow(input.temperatureC, input.inSituPh);
  const sourcesUsed = ["mic.organismSurvivalWindow"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("mic.organismSurvivalWindow").confidence];

  if (!withinWindow) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed,
      disclaimer: `Sıcaklık/pH, MIC organizmalarının hayatta kalma penceresi (API RP 571 §4.3.8) dışında — mekanizma geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const factorContributions: RiskFactorContribution[] = [
    {
      factorTr: "Hayatta kalma penceresi içinde",
      points: 15,
      rationaleTr: "API RP 571 §4.3.8 — sıcaklık/pH organizma hayatta kalma aralığında.",
    },
  ];

  if (input.isStagnantOrDeadLeg) {
    factorContributions.push({
      factorTr: "Durgun akış / ölü bacak",
      points: 35,
      rationaleTr: "API RP 571 §4.3.8 — durgun/düşük akışlı bölgeler organizma büyümesini teşvik eder (EN büyük tekil risk faktörü).",
    });
  }

  if (input.waterType === "HYDROTEST_WATER_LEFT_IN_SYSTEM") {
    factorContributions.push({
      factorTr: "Sistemde bırakılmış hidrotest suyu",
      points: 30,
      rationaleTr: "API RP 571 §4.3.8 — \"hidrotest suyunun sistemde bırakılması yaygın bir tetikleyicidir\".",
    });
  } else if (input.waterType === "SEAWATER" || input.waterType === "PRODUCED_WATER") {
    factorContributions.push({
      factorTr: `Su tipi (${input.waterType})`,
      points: 15,
      rationaleTr: "Deniz suyu/üretim suyu, tatlı suya göre daha zengin bir besin/mikroorganizma kaynağıdır (genel mühendislik bilgisi).",
    });
  }

  if (input.biocideProgramActive) {
    factorContributions.push({
      factorTr: "Aktif biyosit programı",
      points: -25,
      rationaleTr: "API RP 571 §4.3.8 önleyici tedbirler listesi — etkin biyosit dozajlaması riski azaltır (ama SIFIRLAMAZ).",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  if (riskScore >= 50) {
    validityWarnings.push({
      parameter: "MIC risk skoru",
      value: riskScore,
      min: 0,
      max: 100,
      unit: "-",
      message:
        "Yüksek MIC riski — bu bir mm/yıl metal kaybı hızı DEĞİLDİR (API RP 571 bu mekanizma için sayısal " +
        "bir hız vermez), lokalize/rastgele çukurlaşma potansiyeli için bir SIRALAMA göstergesidir. Saha " +
        "doğrulaması (kupon/ATP testi, biyofilm örneklemesi) önerilir.",
    });
  }

  return {
    isMechanismActive: true,
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

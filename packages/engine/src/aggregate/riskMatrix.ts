// packages/engine/src/aggregate/riskMatrix.ts
//
// RBI-lite risk matrisi (master görev madde 3). API 580'in genel POF
// (Probability of Failure) / CoF (Consequence of Failure) KAVRAMINI temel
// alır — API 581'in kendi sayısal POF/CoF tablolarını İDDİA ETMEZ (bu
// projenin bu oturumda erişemediği, kapsamlı bir kantitatif metodoloji;
// bkz. plan dosyasının mimari karar #4).
//
// OLASILIK EKSENİ: aggregate/ctlAtl.ts::computeCtlAtl'ın ZATEN var olan 4
// kategorisi (NEGLIGIBLE/LOW/MEDIUM/HIGH — kullanıcının iç proje
// dokümanından, gerçek/atıflı bir kaynak). Sahte bir 5. seviye İCAT
// EDİLMEZ — matris 4×5'tir, 5×5 DEĞİL.
//
// SONUÇ EKSENİ: bu modülün YENİ 5 seviyeli (A-E) skorlamasıdır — dört alt
// faktörün (akışkan tehlikesi, basınç, konum, çevresel etki) HER BİRİ 1-5
// ölçeğinde puanlanır, EN KÖTÜSÜ (max) esas alınır (projenin `worstConfidence`
// ile AYNI "en kötü faktör belirler" felsefesi). Alt puan eşikleri VE
// nihai renk eşikleri bu PROJENİN KENDİ kabulüdür — yayımlanmış bir
// standardın sabiti DEĞİLDİR, registry'ye KAYDEDİLMEZ (registry'ye
// kaydetmek sahte bir "dış kaynak" görünümü verirdi — corrosion/types.ts::
// RISK_LEVEL_THRESHOLDS ile AYNI gerekçe).

import type { RiskLevel } from "../corrosion/types";
import type { EnvironmentalSensitivity, LocationClassValue } from "../types/enums";
import type { CtlAtlCategory } from "./ctlAtl";

export type ConsequenceLevel = "A" | "B" | "C" | "D" | "E";

const CONSEQUENCE_LEVEL_LABELS_TR: Record<ConsequenceLevel, string> = {
  A: "A — En düşük sonuç",
  B: "B — Düşük sonuç",
  C: "C — Orta sonuç",
  D: "D — Yüksek sonuç",
  E: "E — En yüksek sonuç",
};

const LIKELIHOOD_ORDER: CtlAtlCategory[] = ["NEGLIGIBLE", "LOW", "MEDIUM", "HIGH"];
const CONSEQUENCE_ORDER: ConsequenceLevel[] = ["A", "B", "C", "D", "E"];

/** Sour-servis (H2S) niteliksel risk seviyesi → 1-5 alt puan. `null` = mekanizma DEĞERLENDİRİLMEDİ, bilinmeyen için muhafazakâr ORTA (3) kabul edilir. */
function scoreFluidHazard(h2sRiskLevel: RiskLevel | null): number {
  if (h2sRiskLevel === null) return 3;
  const map: Record<RiskLevel, number> = { DÜŞÜK: 1, ORTA: 2, YÜKSEK: 4, ÇOK_YÜKSEK: 5 };
  return map[h2sRiskLevel];
}

/** Basınç (bara) → 1-5 alt puan — bu projenin kendi kaba bantlaması (yüksek basınç = yüksek serbest kalma enerjisi/sonuç). */
function scorePressure(pressureBara: number): number {
  if (pressureBara < 10) return 1;
  if (pressureBara < 40) return 2;
  if (pressureBara < 100) return 3;
  if (pressureBara < 200) return 4;
  return 5;
}

/** Konum sınıfı (1-4, ASME B31.8 nüfus yoğunluğu) → 1-5 alt puan — Sınıf 3/4 arasındaki nüfus yoğunluğu sıçraması ağırlıklandırılır. */
function scoreLocationClass(locationClass: LocationClassValue): number {
  const map: Record<LocationClassValue, number> = { 1: 1, 2: 2, 3: 4, 4: 5 };
  return map[locationClass];
}

function scoreEnvironmentalSensitivity(sensitivity: EnvironmentalSensitivity): number {
  const map: Record<EnvironmentalSensitivity, number> = { LOW: 1, MEDIUM: 3, HIGH: 5 };
  return map[sensitivity];
}

export interface RbiConsequenceInputs {
  /** Belirleyici senaryonun H2S/sour-servis niteliksel risk seviyesi (orchestrate/mechanismRunners.ts::runH2sFinding sonucu) — YENİDEN HESAPLANMAZ, VAR OLAN sonuç okunur. */
  h2sRiskLevel: RiskLevel | null;
  governingPressureBara: number;
  locationClass: LocationClassValue;
  environmentalSensitivity: EnvironmentalSensitivity;
}

export interface RbiConsequenceScore {
  level: ConsequenceLevel;
  levelLabelTr: string;
  fluidHazardSubScore: number;
  pressureSubScore: number;
  locationSubScore: number;
  environmentalSubScore: number;
  governingFactorTr: string;
}

const SUBSCORE_FACTOR_NAMES_TR = ["Akışkan tehlikesi (H2S/sour)", "Basınç", "Konum sınıfı", "Çevresel hassasiyet"] as const;

export function scoreRbiConsequence(inputs: RbiConsequenceInputs): RbiConsequenceScore {
  const subScores = [
    scoreFluidHazard(inputs.h2sRiskLevel),
    scorePressure(inputs.governingPressureBara),
    scoreLocationClass(inputs.locationClass),
    scoreEnvironmentalSensitivity(inputs.environmentalSensitivity),
  ];
  const maxScore = Math.max(...subScores);
  const governingIndex = subScores.indexOf(maxScore);
  const level = CONSEQUENCE_ORDER[maxScore - 1];

  return {
    level,
    levelLabelTr: CONSEQUENCE_LEVEL_LABELS_TR[level],
    fluidHazardSubScore: subScores[0],
    pressureSubScore: subScores[1],
    locationSubScore: subScores[2],
    environmentalSubScore: subScores[3],
    governingFactorTr: SUBSCORE_FACTOR_NAMES_TR[governingIndex],
  };
}

export interface RbiRiskMatrixCell {
  likelihood: CtlAtlCategory;
  consequence: ConsequenceLevel;
  isComponentCell: boolean;
}

/**
 * RBI-lite sonuç skorunu (A-E) API 570'in KENDİ 3 seviyeli (Consequence-of-
 * Failure bazlı) Piping Class'ına (1-3, bkz. registry/coefficients/
 * inspectionPlan.ts::api570PipingClassMaxUtIntervalYears) eşler — bu iki
 * sistemin SAYISAL EŞDEĞERLİĞİ bir standart maddesi DEĞİLDİR, bu projenin
 * kendi kabulüdür (KDP kapsamı dışı): A/B (en düşük sonuç) → Class 3, C
 * (orta) → Class 2, D/E (en yüksek sonuç) → Class 1 (API 570'in "yanıcı/
 * toksik/kritik servis" tanımına en yakın uç). Yalnızca BU eşleme projenin
 * kendi kabulüdür — hedef tarafın (Class 1/2/3'ün azami UT aralığı: 5/10/10
 * yıl) kendisi gerçek, atıflı API 570 verisidir.
 */
export function mapConsequenceLevelToApi570PipingClass(level: ConsequenceLevel): 1 | 2 | 3 {
  if (level === "D" || level === "E") return 1;
  if (level === "C") return 2;
  return 3;
}

export interface RbiLiteRiskMatrixResult {
  likelihoodCategory: CtlAtlCategory;
  consequence: RbiConsequenceScore;
  /** 4 (olasılık) × 5 (sonuç) = 20 hücre, satır-öncelikli (olasılık dışta) */
  cells: RbiRiskMatrixCell[];
  colorTr: "yeşil" | "sarı" | "turuncu" | "kırmızı";
  rationaleTr: string;
}

/** Olasılık×sonuç indeks çarpımı → renk — bu PROJENİN KENDİ bantlaması (1-4 × 1-5 = 4-20 aralığı). */
function riskProductToColor(product: number): RbiLiteRiskMatrixResult["colorTr"] {
  if (product <= 4) return "yeşil";
  if (product <= 9) return "sarı";
  if (product <= 14) return "turuncu";
  return "kırmızı";
}

/**
 * RBI-lite risk matrisini kurar (master görev madde 3): CTL/ATL'nin
 * olasılık kategorisi (4 seviye) × bu modülün sonuç skorlaması (5 seviye,
 * A-E) → bileşenin hücresi + genel renk.
 */
export function buildRbiLiteRiskMatrix(
  likelihoodCategory: CtlAtlCategory,
  consequenceInputs: RbiConsequenceInputs,
): RbiLiteRiskMatrixResult {
  const consequence = scoreRbiConsequence(consequenceInputs);
  const likelihoodIndex = LIKELIHOOD_ORDER.indexOf(likelihoodCategory) + 1;
  const consequenceIndex = CONSEQUENCE_ORDER.indexOf(consequence.level) + 1;

  const cells: RbiRiskMatrixCell[] = LIKELIHOOD_ORDER.flatMap((likelihood) =>
    CONSEQUENCE_ORDER.map((consequenceLevel) => ({
      likelihood,
      consequence: consequenceLevel,
      isComponentCell: likelihood === likelihoodCategory && consequenceLevel === consequence.level,
    })),
  );

  const colorTr = riskProductToColor(likelihoodIndex * consequenceIndex);

  return {
    likelihoodCategory,
    consequence,
    cells,
    colorTr,
    rationaleTr:
      `Olasılık: ${likelihoodCategory} (CTL/ATL kategorisi, ${likelihoodIndex}/4) × Sonuç: ${consequence.level} ` +
      `(${consequence.governingFactorTr} belirleyici, ${consequenceIndex}/5) — bu projenin kendi RBI-lite ` +
      "bantlamasıyla renklendirildi (API 581'in kantitatif POF/CoF hesabı DEĞİLDİR).",
  };
}

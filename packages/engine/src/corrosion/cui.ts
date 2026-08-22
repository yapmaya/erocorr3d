// packages/engine/src/corrosion/cui.ts
//
// İzolasyon altı korozyonu (CUI) risk değerlendirmesi.
//
// ⚠ API RP 571 §4.3.3 (bkz. data/mechanisms.ts::CUI, HIGH) HİÇBİR sayısal
// mm/yıl hızı vermiyor (şiddet yalıtım tipi/tasarım/iklime AŞIRI duyarlı).
// assessCuiRisk() bir RiskScoreResult döndürür; conditionalRateRangeMmPerYear
// HER ZAMAN null'dur.
//
// Risk faktörleri API 571 §4.3.3'ün KENDİ 20 maddelik kritik konum listesi
// ve metninden (bkz. data/mechanisms.ts::CUI.typicalLocationTr/
// preventiveMeasuresTr) alınır — puanlama ağırlıkları bu projenin kendi
// kararıdır (corrosion/rules.ts ile aynı statü).

import { getCoefficient, worstConfidence } from "../registry";
import type { CuiTemperatureWindow } from "../registry/coefficients/cui";
import type { ConfidenceLevel } from "../registry/types";
import {
  ENGINEERING_DISCLAIMER_TR,
  classifyRiskScore,
  clampRiskScore,
  type RiskFactorContribution,
  type RiskScoreResult,
  type ValidityWarning,
} from "./types";

export type CuiMaterialFamily = "CARBON_STEEL" | "AUSTENITIC_OR_DUPLEX_STAINLESS";

export interface CuiRiskInput {
  isInsulated: boolean;
  materialFamily: CuiMaterialFamily;
  operatingTemperatureC: number;
  /** Sürekli/sabit sıcaklık DEĞİL, siklik (aralıklı) servis mi — riski artırır (API 571 §4.3.3) */
  isCyclicService: boolean;
  /** Buhar bariyeri/mastik hasarlı mı (nem girişine izin veriyor mu) */
  vaporBarrierDamaged: boolean;
  /** Yalıtım kritik bir konumda mı (flanş sonlanması, destek halkası, ölü uç, düşük nokta vb. — API 571 §4.3.3 20 maddelik liste) */
  isCriticalCuiLocation: boolean;
  /** Yalnızca AUSTENITIC_OR_DUPLEX_STAINLESS için: yalıtım klorür sızdırabilir mi (EXTERNAL_CSCC bağlantısı) */
  insulationChlorideLeachRisk?: boolean;
}

/**
 * İşletme sıcaklığının, malzeme ailesine göre CUI için riskli pencerede
 * (bkz. registry/coefficients/cui.ts) olup olmadığını kontrol eder.
 */
export function isWithinCuiTemperatureWindow(materialFamily: CuiMaterialFamily, operatingTemperatureC: number): boolean {
  const window = getCoefficient<CuiTemperatureWindow>("cui.temperatureWindow").value;
  if (materialFamily === "CARBON_STEEL") {
    return operatingTemperatureC >= window.carbonSteelMinC && operatingTemperatureC <= window.carbonSteelMaxC;
  }
  return operatingTemperatureC >= window.stainlessMinC && operatingTemperatureC <= window.stainlessMaxC;
}

/**
 * İzolasyon altı korozyonu risk skorunu (0-100) değerlendirir.
 *
 * Model adı: CUI sıcaklık penceresi taraması (API RP 571 §4.3.3) + bu
 * projenin kendi risk-skoru ağırlıklandırması.
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur.
 */
export function assessCuiRisk(input: CuiRiskInput): RiskScoreResult {
  const validityWarnings: ValidityWarning[] = [];

  if (!input.isInsulated) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Bileşen yalıtımsız — CUI mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const window = getCoefficient<CuiTemperatureWindow>("cui.temperatureWindow").value;
  const sourcesUsed = ["cui.temperatureWindow"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("cui.temperatureWindow").confidence];

  const withinWindow = isWithinCuiTemperatureWindow(input.materialFamily, input.operatingTemperatureC);
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
      disclaimer: `İşletme sıcaklığı, ${input.materialFamily} için API RP 571 §4.3.3 riskli pencere dışında — mekanizma geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const isWorstCaseBand =
    input.operatingTemperatureC >= window.worstCaseMinC && input.operatingTemperatureC <= window.worstCaseMaxC;

  const factorContributions: RiskFactorContribution[] = [
    {
      factorTr: "Riskli sıcaklık penceresi içinde",
      points: isWorstCaseBand ? 40 : 20,
      rationaleTr: isWorstCaseBand
        ? `${window.worstCaseMinC}-${window.worstCaseMaxC}°C EN RİSKLİ alt-bant içinde (su buharlaşmadan uzun süre ıslak kalır) — API RP 571 §4.3.3.`
        : "Riskli pencere içinde ama en şiddetli alt-bandın dışında.",
    },
  ];

  if (input.vaporBarrierDamaged) {
    factorContributions.push({
      factorTr: "Hasarlı buhar bariyeri/mastik",
      points: 30,
      rationaleTr: "API RP 571 §4.3.3 önlem listesi — nem girişinin doğrudan kaynağı.",
    });
  }

  if (input.isCyclicService) {
    factorContributions.push({
      factorTr: "Siklik (aralıklı) servis",
      points: 15,
      rationaleTr: "API RP 571 §4.3.3 — siklik ısıl işletme riski artırır (sürekli sıcak/soğuk yalıtımın altında yoğuşma-kuruma döngüsü).",
    });
  }

  if (input.isCriticalCuiLocation) {
    factorContributions.push({
      factorTr: "Kritik CUI konumu",
      points: 20,
      rationaleTr: "API RP 571 §4.3.3'ün 20 maddelik kritik konum listesi (flanş sonlanması, destek halkası, ölü uç, düşük nokta vb.).",
    });
  }

  if (input.materialFamily === "AUSTENITIC_OR_DUPLEX_STAINLESS" && input.insulationChlorideLeachRisk) {
    factorContributions.push({
      factorTr: "Klorür sızdıran yalıtım (EXTERNAL_CSCC riski)",
      points: 25,
      rationaleTr: "API RP 571 §4.5.1(e) — ıslanan yalıtımdan sızan klorürler, 300 Seri PÇ'de dış CSCC'yi tetikleyebilir (bkz. corrosion/pittingCreviceCscc.ts).",
    });
    validityWarnings.push({
      parameter: "Dış CSCC riski",
      value: 1,
      min: 0,
      max: 1,
      unit: "-",
      message:
        "Bu malzeme ailesi + klorür sızdıran yalıtım kombinasyonu, ayrıca EXTERNAL_CSCC (klorürlü gerilmeli " +
        "korozyon çatlaması) riski taşır — corrosion/pittingCreviceCscc.ts ile AYRICA değerlendirilmelidir.",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  if (riskScore >= 50) {
    validityWarnings.push({
      parameter: "CUI riski",
      value: riskScore,
      min: 0,
      max: 100,
      unit: "-",
      message:
        "Bu risk skoru bir mm/yıl metal kaybı hızı DEĞİLDİR (API RP 571 bu mekanizma için sayısal bir hız " +
        "vermez) — yalıtımın açılıp fiziksel muayene yapılması önerilen bir SIRALAMA göstergesidir.",
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

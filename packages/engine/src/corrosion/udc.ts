// packages/engine/src/corrosion/udc.ts
//
// Birikinti altı korozyonu (under-deposit corrosion, UDC) risk değerlendirmesi.
//
// Model: akış hızı, kritik taşıma hızının (bkz. registry/coefficients/udc.ts
// — LOW confidence, birincil doğrulama YOK) ALTINDAysa katı/tortu birikimi
// beklenir; birikinti altında oksijen/tuz konsantrasyon farkı nedeniyle
// lokalize galvanik hücre oluşur (data/mechanisms.ts::UNDER_DEPOSIT, MEDIUM).
//
// ⚠ Bu mekanizma için de sayısal bir mm/yıl hızı bulunamadı (mekanizma
// doğası gereği son derece lokalize/durum-özgüdür — bkz. mechanisms.ts
// notu). conditionalRateRangeMmPerYear HER ZAMAN null'dur.

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

export interface UnderDepositRiskInput {
  actualVelocityMs: number;
  /** Birikinti oluşturabilecek katı/tortu (kum, korozyon ürünü, parafin/mum, ölçek) taşınıyor mu */
  depositFormingSolidsPresent: boolean;
  /** Düşük nokta / durgun bölge / pigging sıklığı düşük uzun düz hat (birikinti YERÇEKİMİYLE biriktiği için ek risk) */
  isLowPointOrDeadLeg: boolean;
  /** Birikinti altındaki sulu fazda başka bir agresif mekanizma (H2S, CO2, çözünmüş O2) da var mı */
  aggressiveWaterChemistryPresent: boolean;
  freeWaterPresent: boolean;
}

/**
 * Gerçek akış hızının, kritik (muhafazakâr alt sınır) taşıma hızının
 * altında olup olmadığını kontrol eder.
 */
export function isBelowCriticalTransportVelocity(actualVelocityMs: number): boolean {
  const [conservativeMinMs] = getCoefficient<[number, number]>("udc.minimumTransportVelocityRangeMs").value;
  return actualVelocityMs < conservativeMinMs;
}

/**
 * Birikinti altı korozyonu risk skorunu (0-100) değerlendirir.
 *
 * Model adı: kritik taşıma hızı taraması (bkz. registry/coefficients/udc.ts)
 * + bu projenin kendi risk-skoru ağırlıklandırması.
 * Girdi/çıktı birimleri: m/s → çıktı boyutsuz risk skoru (0-100).
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur;
 * kritik hız eşiği LOW confidence (bkz. registry notları).
 */
export function assessUnderDepositRisk(input: UnderDepositRiskInput): RiskScoreResult {
  if (input.actualVelocityMs < 0) {
    throw new Error("Akış hızı negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];

  if (!input.freeWaterPresent || !input.depositFormingSolidsPresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Serbest su veya birikinti oluşturucu katı yok — birikinti altı korozyonu mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const [conservativeMinMs, permissiveMinMs] = getCoefficient<[number, number]>(
    "udc.minimumTransportVelocityRangeMs",
  ).value;
  const sourcesUsed = ["udc.minimumTransportVelocityRangeMs"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("udc.minimumTransportVelocityRangeMs").confidence];

  const isBelowVelocity = input.actualVelocityMs < conservativeMinMs;
  const isMechanismActive = isBelowVelocity || input.isLowPointOrDeadLeg;
  const factorContributions: RiskFactorContribution[] = [];

  if (isBelowVelocity) {
    const deficitRatio = 1 - input.actualVelocityMs / conservativeMinMs;
    const points = Math.round(clampRiskScore(deficitRatio * 100) * 0.6);
    factorContributions.push({
      factorTr: `Kritik taşıma hızının altında (${input.actualVelocityMs} < ${conservativeMinMs} m/s)`,
      points,
      rationaleTr: "Hız açığı ne kadar büyükse birikinti oluşma olasılığı o kadar artar (bkz. registry notları — LOW confidence eşik).",
    });
    if (input.actualVelocityMs >= permissiveMinMs) {
      validityWarnings.push({
        parameter: "Akış hızı",
        value: input.actualVelocityMs,
        min: conservativeMinMs,
        max: permissiveMinMs,
        unit: "m/s",
        message: `Hız, aralığın (${conservativeMinMs}-${permissiveMinMs} m/s) MUHAFAZAKÂR alt sınırının altında ama üst sınırın üzerinde — belirsizlik bölgesi.`,
      });
    }
  }

  if (input.isLowPointOrDeadLeg) {
    factorContributions.push({
      factorTr: "Düşük nokta / durgun bölge / ölü bacak",
      points: 40,
      rationaleTr: "Birikinti yer çekimiyle biriktiğinden düşük noktalar hıza bakılmaksızın yüksek risk taşır (NACE CORROSION 2012 #1379 — bkz. data/mechanisms.ts::UNDER_DEPOSIT).",
    });
  }

  if (input.aggressiveWaterChemistryPresent) {
    factorContributions.push({
      factorTr: "Birikinti altında agresif su kimyası (H2S/CO2/O2)",
      points: 20,
      rationaleTr: "Birikinti altındaki konsantrasyon-hücresi etkisi, başka bir agresif mekanizma ile BİRLEŞTİĞİNDE hızlanır (data/mechanisms.ts::UNDER_DEPOSIT).",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  if (isMechanismActive) {
    validityWarnings.push({
      parameter: "Birikinti altı korozyonu riski",
      value: riskScore,
      min: 0,
      max: 100,
      unit: "-",
      message:
        "Bu risk skoru bir mm/yıl metal kaybı hızı DEĞİLDİR — mekanizma doğası gereği son derece " +
        "lokalize/durum-özgüdür (bkz. data/mechanisms.ts notu), sayısal bir kaynak bulunamadı. Pigging/" +
        "iç muayene ile doğrulama önerilir.",
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

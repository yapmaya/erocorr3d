// packages/engine/src/corrosion/types.ts

import type { ConfidenceLevel } from "../registry/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";

export interface ValidityWarning {
  parameter: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  message: string;
}

export interface CorrosionRateResult {
  rateMmPerYear: UncertaintyBand;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

export const ENGINEERING_DISCLAIMER_TR =
  "Bu sonuçlar mühendislik tahminidir. Model belirsizliği tipik olarak 2-3 kat mertebesindedir. " +
  "Nihai malzeme seçimi yetkin bir korozyon mühendisinin onayını gerektirir.";

/**
 * Bazı mekanizmalar (H2S/SSC-HIC-SOHIC, MIC, birikinti altı, izolasyon
 * altı, galvanik, atmosferik/toprak dış ortam) için kesin bir mm/yıl
 * hızı KDP kapsamında bulunamaz/anlamlı değildir — bu mekanizmalar tek bir
 * sayı yerine 0-100 arası bir RİSK SKORU + (mekanizma tetiklendiyse)
 * KOŞULLU/geniş bir hız aralığı ile ifade edilir. `riskScore`un kendisi bir
 * KDP sabiti DEĞİLDİR (bkz. corrosion/riskScoring.ts) — yalnızca bu proje
 * içinde tutarlı bir şekilde AYNI ağırlıklandırma kurallarıyla hesaplanan,
 * belgelenmiş faktörlere dayalı bir SIRALAMA/tarama aracıdır.
 */
export type RiskLevel = "DÜŞÜK" | "ORTA" | "YÜKSEK" | "ÇOK_YÜKSEK";

export interface RiskFactorContribution {
  /** Türkçe faktör adı (ör. "Sıcaklık penceresi", "Durgun akış") */
  factorTr: string;
  /** Bu faktörün 0-100 ölçeğindeki katkısı (negatif olabilir — azaltıcı faktörler için) */
  points: number;
  rationaleTr: string;
}

export interface RiskScoreResult {
  /** Mekanizmanın temel tetikleyici koşulları (ör. sıcaklık/pH penceresi, serbest su) sağlanıyor mu */
  isMechanismActive: boolean;
  /** 0-100 arası birleşik risk skoru — isMechanismActive=false ise her zaman 0 */
  riskScore: number;
  riskLevel: RiskLevel;
  factorContributions: RiskFactorContribution[];
  /** Yalnızca mekanizma aktifse dolu — kesin bir hız DEĞİL, geniş bir koşullu aralık (bkz. ilgili modülün notları) */
  conditionalRateRangeMmPerYear: UncertaintyBand | null;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

const RISK_LEVEL_THRESHOLDS = { orta: 25, yuksek: 50, cokYuksek: 75 } as const;

/**
 * 0-100 risk skorunu ayrık bir seviyeye dönüştürür. Eşikler (25/50/75) bu
 * PROJENİN KENDİ raporlama kabulüdür (KDP kapsamı dışı — corrosion/rules.ts
 * ve erosion modüllerindeki GÜVENLİ/YAKLAŞIYOR/... ayrıklaştırmalarıyla
 * aynı mantık), yayımlanmış bir sabit DEĞİLDİR.
 */
export function classifyRiskScore(riskScore: number): RiskLevel {
  if (riskScore < RISK_LEVEL_THRESHOLDS.orta) return "DÜŞÜK";
  if (riskScore < RISK_LEVEL_THRESHOLDS.yuksek) return "ORTA";
  if (riskScore < RISK_LEVEL_THRESHOLDS.cokYuksek) return "YÜKSEK";
  return "ÇOK_YÜKSEK";
}

/** Risk skorunu [0,100] aralığına sıkıştırır — faktör katkıları toplamı bu aralığı aşabilir/altına inebilir. */
export function clampRiskScore(rawScore: number): number {
  return Math.max(0, Math.min(100, rawScore));
}

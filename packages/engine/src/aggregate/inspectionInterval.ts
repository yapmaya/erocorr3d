// packages/engine/src/aggregate/inspectionInterval.ts
//
// Muayene aralığı — API 570 "kalan ömrün yarısı" kuralı (bkz. registry/
// coefficients/inspectionPlan.ts::inspectionPlan.halfRemainingLifeFraction,
// MEDIUM güven, iki bağımsız ikincil kaynak) + API 570'in KENDİ Consequence-
// of-Failure bazlı Piping Class'ına (1-3, bkz. registry/coefficients/
// inspectionPlan.ts::api570PipingClassMaxUtIntervalYears — ASME B31.8
// nüfus yoğunluğu Location Class'ı İLE KARIŞTIRILMAMALIDIR, bkz. o
// dosyanın dosya başı notu) göre azami aralık tavanı (Tablo 6-1) + risk
// kategorisine göre çarpan + belirsizlik bandı (P90'a göre daha
// muhafazakâr/sık muayene, types/results.ts'in "P90 = koruyucu/yüksek hız
// tahmini" sözleşmesiyle TUTARLI).
//
// SAFLIK NOTU: bu modül "şimdi"yi (Date.now()) KENDİ İÇİNDE ÇAĞIRMAZ —
// çağıran taraf `asOfDate`'i açıkça verir (proje kuralı: "Her hesap
// fonksiyonu SAF olacak: aynı girdi → aynı çıktı, yan etki yok").

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { Api570PipingClassMaxUtIntervalRow } from "../registry/coefficients/inspectionPlan";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import type { CtlAtlCategory } from "./ctlAtl";

/**
 * Olasılık (CTL/ATL) kategorisine göre muayene aralığı çarpanı — bu
 * PROJENİN KENDİ muhafazakâr raporlama kabulüdür (KDP kapsamı dışı,
 * corrosion/types.ts::RISK_LEVEL_THRESHOLDS ile AYNI gerekçe), yayımlanmış
 * bir standardın sabiti DEĞİLDİR: yüksek olasılık kategorisinde yarım-ömür
 * aralığı DAHA DA sıkılaştırılır.
 */
const RISK_CATEGORY_INTERVAL_MULTIPLIER: Record<CtlAtlCategory, number> = {
  NEGLIGIBLE: 1.0,
  LOW: 1.0,
  MEDIUM: 0.75,
  HIGH: 0.5,
};

export interface InspectionIntervalInput {
  /** Bugünkü (asOfDate itibarıyla) kalan et kalınlığı payı — mevcut et kalınlığı - gerekli minimum et kalınlığı (t_min, mm). Negatifse eşik ZATEN aşılmış demektir. */
  currentWallMarginMm: number;
  /** Yıllık kayıp hızı bandı (mm/yıl) — bkz. aggregate/metalLoss.ts::MetalLossResult.totalAnnualLossMmPerYear */
  annualLossRateMmPerYear: UncertaintyBand;
  /** API 570'in KENDİ Consequence-of-Failure bazlı Piping Class'ı (1-3) — bkz. aggregate/riskMatrix.ts::mapConsequenceLevelToApi570PipingClass (RBI-lite sonuç skorundan türetilir). ASME B31.8 Location Class (Geometry.locationClass) İLE AYNI ŞEY DEĞİLDİR. */
  api570PipingClass: 1 | 2 | 3;
  /** null = korozyon payı 0 girildiği için CTL/ATL hesaplanamadı (bkz. resultsDerivation.ts::deriveCtlAtl) — bu durumda risk çarpanı MEDIUM kategorisiyle AYNI (0,75) muhafazakâr varsayılan kullanılır. */
  ctlAtlCategory: CtlAtlCategory | null;
  asOfDate: Date;
}

export interface InspectionIntervalResult {
  /** P50 (merkezi) hıza göre kalan ömür — yalnızca ŞEFFAFLIK için, öneri BUNA DAYANMAZ. null = bu hızla eşiğe hiç ulaşmaz. */
  remainingLifeFromNowYearsP50: number | null;
  /** P90 (koruyucu/yüksek) hıza göre kalan ömür — öneri BUNA dayanır ("P90'a göre daha sık muayene"). null = bu hızla bile eşiğe ulaşmaz. */
  remainingLifeFromNowYearsP90: number | null;
  api570PipingClassMaxIntervalYears: number;
  riskCategoryMultiplier: number;
  /** min(API 570 Piping Class tavanı, kalan_ömür_P90 × 0,5 × risk_çarpanı) — currentWallMarginMm≤0 ise 0 (ACİL). */
  recommendedIntervalYears: number;
  /** ISO 8601 tarih (YYYY-MM-DD). */
  nextInspectionDate: string;
  rationaleTr: string;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

function addYearsToIsoDate(asOfDate: Date, years: number): string {
  const result = new Date(asOfDate.getTime());
  result.setUTCDate(result.getUTCDate() + Math.round(years * 365.25));
  return result.toISOString().slice(0, 10);
}

/**
 * Muayene aralığı önerisi hesaplar (master görev madde 2).
 *
 * Model adı: API 570 §6/Tablo 6-1 yarım-ömür kuralı + bu projenin risk-
 * kategorisi çarpanı. Girdi/çıktı birimleri: mm, mm/yıl, yıl → ISO tarih.
 */
export function computeInspectionInterval(input: InspectionIntervalInput): InspectionIntervalResult {
  const { currentWallMarginMm, annualLossRateMmPerYear, api570PipingClass, ctlAtlCategory, asOfDate } = input;

  const halfLifeFractionCoefficient = getCoefficient<number>("inspectionPlan.halfRemainingLifeFraction");
  const maxIntervalTableCoefficient = getCoefficient<Api570PipingClassMaxUtIntervalRow[]>(
    "inspectionPlan.api570PipingClassMaxUtIntervalYears",
  );
  const halfLifeFraction = halfLifeFractionCoefficient.value;
  const maxIntervalRow = maxIntervalTableCoefficient.value.find((r) => r.api570PipingClass === api570PipingClass);
  if (!maxIntervalRow) {
    throw new Error(`Geçersiz API 570 Piping Class: ${api570PipingClass} (1-3 olmalıdır).`);
  }
  const api570PipingClassMaxIntervalYears = maxIntervalRow.maxIntervalYears;
  const riskCategoryMultiplier = RISK_CATEGORY_INTERVAL_MULTIPLIER[ctlAtlCategory ?? "MEDIUM"];

  const validityWarnings: ValidityWarning[] = [];

  const remainingLifeFromNowYearsP50 =
    annualLossRateMmPerYear.p50 > 0 ? currentWallMarginMm / annualLossRateMmPerYear.p50 : null;
  const remainingLifeFromNowYearsP90 =
    annualLossRateMmPerYear.p90 > 0 ? currentWallMarginMm / annualLossRateMmPerYear.p90 : null;

  let recommendedIntervalYears: number;
  let rationaleTr: string;

  if (currentWallMarginMm <= 0) {
    recommendedIntervalYears = 0;
    rationaleTr =
      "Kalan et kalınlığı payı ZATEN tükenmiş/negatif (mevcut kalınlık ≤ gerekli minimum kalınlık) — ACİL muayene gereklidir.";
    validityWarnings.push({
      parameter: "currentWallMarginMm",
      value: currentWallMarginMm,
      min: 0,
      max: Infinity,
      unit: "mm",
      message: "Kalan et kalınlığı payı ≤0 — bileşen minimum kalınlık eşiğine ulaşmış veya aşmış olabilir.",
    });
  } else if (remainingLifeFromNowYearsP90 === null) {
    recommendedIntervalYears = api570PipingClassMaxIntervalYears;
    rationaleTr = `P90 (koruyucu) hızda ölçülebilir kayıp yok — aralık yalnızca API 570 Piping Class ${api570PipingClass} tavanınca (${api570PipingClassMaxIntervalYears} yıl) belirlendi.`;
  } else {
    const riskBasedYears = remainingLifeFromNowYearsP90 * halfLifeFraction * riskCategoryMultiplier;
    recommendedIntervalYears = Math.max(0, Math.min(api570PipingClassMaxIntervalYears, riskBasedYears));
    rationaleTr =
      `min(API 570 Piping Class ${api570PipingClass} tavanı=${api570PipingClassMaxIntervalYears} yıl, ` +
      `P90 kalan ömür=${remainingLifeFromNowYearsP90.toFixed(1)} yıl × yarım-ömür kuralı (${halfLifeFraction}) ` +
      `× risk çarpanı (${riskCategoryMultiplier}, CTL/ATL=${ctlAtlCategory ?? "belirsiz→ORTA varsayıldı"})) = ${recommendedIntervalYears.toFixed(1)} yıl.`;
  }

  if (ctlAtlCategory === null) {
    validityWarnings.push({
      parameter: "ctlAtlCategory",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message: "CTL/ATL kategorisi hesaplanamadı (korozyon payı 0) — risk çarpanı muhafazakâr biçimde ORTA (0,75) kabul edildi.",
    });
  }

  return {
    remainingLifeFromNowYearsP50,
    remainingLifeFromNowYearsP90,
    api570PipingClassMaxIntervalYears,
    riskCategoryMultiplier,
    recommendedIntervalYears,
    nextInspectionDate: addYearsToIsoDate(asOfDate, recommendedIntervalYears),
    rationaleTr,
    confidence: worstConfidence([halfLifeFractionCoefficient.confidence, maxIntervalTableCoefficient.confidence]),
    validityWarnings,
    sourcesUsed: ["inspectionPlan.halfRemainingLifeFraction", "inspectionPlan.api570PipingClassMaxUtIntervalYears"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

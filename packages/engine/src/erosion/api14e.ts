// packages/engine/src/erosion/api14e.ts
//
// API RP 14E "Recommended Practice for Design and Installation of Offshore
// Production Platform Piping Systems" (5. Baskı, 1991) erozyonel hız TARAMA
// kriteri:
//
//   Ve = C / √ρm     [ft/s, ρm karışım yoğunluğu lb/ft³]
//
// ⚠⚠⚠ BU YALNIZCA BİR TARAMA (SCREENING) KRİTERİDİR — KATI PARÇACIK
// EROZYONU İÇİN YETERSİZDİR ⚠⚠⚠
//
// API RP 14E'nin kendi metni, katı içeren akışlar için HİÇBİR sayısal
// c-faktörü VERMEZ (bkz. registry/coefficients/api14e.ts, WITH_SOLIDS
// satırı) — yalnızca "fluid velocities should be significantly reduced,
// c-factor should be found from specific application studies" der. Bu
// denklem ayrıca akışkan yoğunluğu DIŞINDA hiçbir parametre (parçacık
// boyutu, malzeme sertliği, geometri, çarpma açısı) İÇERMEZ — bu yüzden
// modern literatür (bkz. Madani Sani et al. 2019, Wear — bu dosyanın ana
// ikincil kaynağı) bu denklemin kökeninin bile belirsiz/tartışmalı
// olduğunu, ve katı parçacık İÇEREN akışlar için TEK BAŞINA
// KULLANILMAMASI gerektiğini vurguluyor.
//
// KUM/KATI PARÇACIK İÇEREN AKIŞLAR İÇİN ASIL DEĞERLENDİRME
// erosion/dnvO501.ts (DNV-RP-O501) İLE YAPILMALIDIR. Bu modül yalnızca
// (1) hızlı bir ilk tarama ve (2) katı-içermeyen/korozyon-odaklı bir
// "erozyon-korozyon" hız limiti sağlamak için vardır.
//
// Kaynak: API RP 14E, 5. Baskı (1991) — c-faktörü tablosu Madani Sani et
// al. (2019, Wear, hakemli) üzerinden birebir alıntılandı (bkz.
// registry/coefficients/api14e.ts başlık yorumu, doğrudan API RP 14E'ye bu
// oturumda erişilemedi — paywall'lı).

import { getCoefficient, worstConfidence } from "../registry";
import type { Api14eCFactorRow, Api14eFluidCategory, Api14eServiceType } from "../registry/coefficients/api14e";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";

export type Api14eWarningLevel = "GÜVENLİ" | "YAKLAŞIYOR" | "AŞILDI" | "KRİTİK";

export interface Api14eScreeningInput {
  /** Karışım (akışkan) yoğunluğu ρm (kg/m³) */
  mixtureDensityKgM3: number;
  /** Gerçek/işletme hızı (m/s) — Ve ile karşılaştırılacak */
  actualVelocityMs: number;
  fluidCategory: Api14eFluidCategory;
  serviceType: Api14eServiceType;
  /**
   * c-faktörü aralığının hangi ucu kullanılsın: "CONSERVATIVE"=aralığın alt
   * sınırı (daha düşük Ve, daha erken uyarı — varsayılan), "PERMISSIVE"=üst
   * sınır. WITH_SOLIDS kategorisinde bu parametre YOK SAYILIR (aralık zaten
   * tanımsız, hata fırlatılır).
   */
  cFactorSelection?: "CONSERVATIVE" | "PERMISSIVE";
}

export interface Api14eScreeningResult {
  /** Erozyonel hız limiti Ve (m/s) */
  erosionalVelocityMs: number;
  /** Kullanılan c-faktörü */
  cFactorUsed: number;
  /** Gerçek hız / Ve oranı */
  velocityToLimitRatio: number;
  /** Aşım yüzdesi: (gerçek hız - Ve) / Ve × 100. Negatifse limitin altında. */
  exceedancePercent: number;
  warningLevel: Api14eWarningLevel;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
  /**
   * UI'da HER ZAMAN gösterilmesi gereken sabit uyarı — bu bir katı parçacık
   * erozyon modeli DEĞİLDİR.
   */
  screeningOnlyNoteTr: string;
}

const SCREENING_ONLY_NOTE_TR =
  "API RP 14E yalnızca bir TARAMA (screening) kriteridir — akışkan yoğunluğu DIŞINDA hiçbir parametre " +
  "(parçacık boyutu, malzeme, geometri, çarpma açısı) içermez ve katı parçacık (kum) içeren akışlar için " +
  "standardın kendi metni SAYISAL BİR C-FAKTÖRÜ VERMEZ. Kum/katı parçacık içeren hatlarda asıl " +
  "değerlendirme DNV-RP-O501 (bkz. erosion/dnvO501.ts) ile yapılmalıdır; bu sonuç TEK BAŞINA malzeme/" +
  "boyutlandırma kararı için YETERLİ DEĞİLDİR.";

function lookupCFactorRow(fluidCategory: Api14eFluidCategory): Api14eCFactorRow {
  const table = getCoefficient<Api14eCFactorRow[]>("api14e.cFactorTable").value;
  const row = table.find((r) => r.fluidCategory === fluidCategory);
  if (!row) {
    throw new Error(`"${fluidCategory}" için API RP 14E c-faktörü satırı bulunamadı.`);
  }
  return row;
}

/**
 * API RP 14E erozyonel hız limitini (Ve) hesaplar.
 *
 * Model adı: API RP 14E (5. Baskı, 1991), Ve=C/√ρm.
 * Girdi/çıktı birimleri: SI (kg/m³) → çıktı m/s.
 * Geçerlilik aralığı: yalnızca KATI PARÇACIK İÇERMEYEN akışlar için
 * standardın kendi tablosundan bir c-faktörü mevcuttur (bkz. dosya başı
 * yorumu). fluidCategory="WITH_SOLIDS" için bu fonksiyon HATA FIRLATIR —
 * çağıran taraf bu durumda dnvO501 modelini kullanmalıdır.
 */
export function computeApi14eErosionalVelocityMs(
  mixtureDensityKgM3: number,
  fluidCategory: Api14eFluidCategory,
  serviceType: Api14eServiceType,
  cFactorSelection: "CONSERVATIVE" | "PERMISSIVE" = "CONSERVATIVE",
): { erosionalVelocityMs: number; cFactorUsed: number; sourcesUsed: string[]; confidence: ConfidenceLevel } {
  if (mixtureDensityKgM3 <= 0) {
    throw new Error("Karışım yoğunluğu pozitif olmalıdır.");
  }

  const row = lookupCFactorRow(fluidCategory);
  const range =
    serviceType === "CONTINUOUS" ? row.continuousServiceCFactorRange : row.intermittentServiceCFactorRange;
  if (!range) {
    throw new Error(
      `API RP 14E, "${fluidCategory}" (katı parçacık içeren) akışlar için sayısal bir c-faktörü VERMEZ. ` +
        `Kum/katı parçacık içeren hatlarda erosion/dnvO501.ts kullanılmalıdır.`,
    );
  }

  const cFactorUsed = cFactorSelection === "CONSERVATIVE" ? range[0] : range[1];
  const conversionFactor = getCoefficient<number>("api14e.imperialToSiVelocityFactor").value;
  const erosionalVelocityMs = (conversionFactor * cFactorUsed) / Math.sqrt(mixtureDensityKgM3);

  const sourcesUsed = ["api14e.cFactorTable", "api14e.imperialToSiVelocityFactor"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("api14e.cFactorTable").confidence,
    getCoefficient("api14e.imperialToSiVelocityFactor").confidence,
  ];

  return { erosionalVelocityMs, cFactorUsed, sourcesUsed, confidence: worstConfidence(usedConfidences) };
}

/**
 * API RP 14E tarama kriterini tam sonuç nesnesi olarak değerlendirir: Ve,
 * gerçek hız/Ve oranı, aşım yüzdesi ve ayrık uyarı seviyesi.
 *
 * Uyarı seviyesi eşikleri (oran bazlı) bu PROJENİN KENDİ raporlama
 * kabulüdür (KDP kapsamı dışı — corrosion/rules.ts ile aynı mantık: bu bir
 * yayımlanmış sabit değil, sürekli bir oranın UI için ayrıklaştırılmasıdır):
 * <0,8 GÜVENLİ, 0,8-1,0 YAKLAŞIYOR, 1,0-1,2 AŞILDI, >1,2 KRİTİK.
 */
export function assessApi14eScreening(input: Api14eScreeningInput): Api14eScreeningResult {
  if (input.actualVelocityMs < 0) {
    throw new Error("Gerçek hız negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];

  if (input.fluidCategory === "WITH_SOLIDS") {
    validityWarnings.push({
      parameter: "Akışkan kategorisi",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "API RP 14E, katı parçacık içeren akışlar için sayısal bir c-faktörü vermiyor. Bu tarama " +
        "ATLANDI (Ve hesaplanamadı) — kum/katı parçacık içeren hatlarda erosion/dnvO501.ts kullanın.",
    });
    return {
      erosionalVelocityMs: Number.NaN,
      cFactorUsed: Number.NaN,
      velocityToLimitRatio: Number.NaN,
      exceedancePercent: Number.NaN,
      warningLevel: "KRİTİK",
      confidence: "UNVERIFIED",
      validityWarnings,
      sourcesUsed: [],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
      screeningOnlyNoteTr: SCREENING_ONLY_NOTE_TR,
    };
  }

  const { erosionalVelocityMs, cFactorUsed, sourcesUsed, confidence } = computeApi14eErosionalVelocityMs(
    input.mixtureDensityKgM3,
    input.fluidCategory,
    input.serviceType,
    input.cFactorSelection ?? "CONSERVATIVE",
  );

  const velocityToLimitRatio = input.actualVelocityMs / erosionalVelocityMs;
  const exceedancePercent = (velocityToLimitRatio - 1) * 100;

  let warningLevel: Api14eWarningLevel;
  if (velocityToLimitRatio < 0.8) {
    warningLevel = "GÜVENLİ";
  } else if (velocityToLimitRatio < 1.0) {
    warningLevel = "YAKLAŞIYOR";
  } else if (velocityToLimitRatio <= 1.2) {
    warningLevel = "AŞILDI";
  } else {
    warningLevel = "KRİTİK";
  }

  if (velocityToLimitRatio >= 1.0) {
    validityWarnings.push({
      parameter: "Hız / Ve oranı",
      value: velocityToLimitRatio,
      min: 0,
      max: 1,
      unit: "-",
      message: `Gerçek hız, API RP 14E erozyonel hız limitini (Ve=${erosionalVelocityMs.toFixed(2)} m/s) %${exceedancePercent.toFixed(0)} aşıyor.`,
    });
  }

  return {
    erosionalVelocityMs,
    cFactorUsed,
    velocityToLimitRatio,
    exceedancePercent,
    warningLevel,
    confidence,
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    screeningOnlyNoteTr: SCREENING_ONLY_NOTE_TR,
  };
}

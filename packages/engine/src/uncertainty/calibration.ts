// packages/engine/src/uncertainty/calibration.ts
//
// Saha kalibrasyonu: kullanıcı gerçek bir saha ölçümü (UT kalınlık kaybı
// veya korozyon kuponu ağırlık kaybı) girdiğinde, modelin tahminini bu
// ölçüme göre kalibre eden çarpanı hesaplar. Bu, uygulamayı bir "tek seferlik
// hesap makinesi"nden gerçek bir bütünlük yönetimi (integrity management)
// aracına dönüştüren özelliktir.
//
// Mimari not: bu dosyadaki TÜM fonksiyonlar SAF'tır — hiçbiri zaman damgası
// (Date.now()) veya kimlik (crypto.randomUUID()) ÜRETMEZ, çünkü bu proje
// backend'siz ve engine paketi bağımsız/taşınabilir olacak şekilde
// tasarlandı (bkz. proje talimatı). Bir `CalibrationResult`'ı kalıcı bir
// kayda ("kaydet") dönüştürmek — zaman damgası eklemek, bir kayıt kimliği
// üretmek, Dexie.js'e (IndexedDB) yazmak — apps/web katmanının
// sorumluluğudur; bu paket yalnızca hesaplanmış, kaydedilmeye HAZIR veriyi
// üretir.
//
// KDP notu: kupon ağırlık kaybı formülü ASTM G1-03'ün doğrudan alıntısıdır
// (registry/coefficients/uncertainty.ts::uncertainty.astmG1.couponLossConstantMmPerYear,
// HIGH, 2 bağımsız kaynak + boyutsal analiz çapraz doğrulaması). UT kalınlık
// kaybı hızı ise saf tanımsal bir bölme işlemidir (Δkalınlık/Δzaman) — KDP
// kapsamı dışıdır (bkz. fluids/mixtureProperties.ts'deki aynı gerekçe).
// "Şüpheli kalibrasyon çarpanı" eşikleri (0,2 / 5) bu projenin KENDİ
// mühendislik kararıdır (KDP'ye kayıtlı bir sabit DEĞİL — bkz.
// corrosion/types.ts::RISK_LEVEL_THRESHOLDS'daki aynı emsal).

import { getCoefficient } from "../registry";
import type { UncertaintyBand } from "./percentiles";

const SUSPICIOUS_FACTOR_LOW_THRESHOLD = 0.2;
const SUSPICIOUS_FACTOR_HIGH_THRESHOLD = 5;

export type CalibrationMeasurementType = "COUPON_WEIGHT_LOSS" | "UT_THICKNESS_LOSS" | "DIRECT_RATE";

export interface CouponWeightLossMeasurement {
  massLossG: number;
  areaCm2: number;
  exposureHours: number;
  densityGPerCm3: number;
}

export interface UtThicknessMeasurement {
  thicknessMmAtStart: number;
  thicknessMmAtEnd: number;
  intervalYears: number;
}

export interface DirectRateMeasurement {
  measuredRateMmPerYear: number;
}

export type CalibrationMeasurement =
  | CouponWeightLossMeasurement
  | UtThicknessMeasurement
  | DirectRateMeasurement;

export type CalibrationQualityFlag = "NORMAL" | "SUSPICIOUS_LOW" | "SUSPICIOUS_HIGH";

export interface CalibrationResult {
  measurementType: CalibrationMeasurementType;
  measuredRateMmPerYear: number;
  modelPredictedRateP50MmPerYear: number;
  /** measuredRate / modelPredictedRate. */
  calibrationFactor: number;
  /** Yalnızca çağıran bir band verdiyse dolu — band×calibrationFactor. */
  calibratedBand: UncertaintyBand | null;
  qualityFlag: CalibrationQualityFlag;
  warningsTr: string[];
  sourcesUsed: string[];
}

/**
 * ASTM G1-03 kupon ağırlık kaybı formülüyle ölçülmüş ortalama korozyon
 * hızını hesaplar.
 *
 * Model: CR(mm/yıl) = (K×W)/(A×T×D), K=8,76×10⁴.
 * Kaynak: registry/coefficients/uncertainty.ts::uncertainty.astmG1.couponLossConstantMmPerYear (HIGH).
 * Girdi birimleri: W gram, A cm², T saat, D g/cm³ (ASTM G1'in kendi doğal birimleri — bkz.
 * corrosion/deWaard.ts başlığındaki aynı "formülün kendi doğal birimi içeride kullanılır" kabulü).
 * Geçerlilik: örnek homojen/tekdüze (uniform) korozyona uğramış olmalıdır — lokalize (pitting)
 * korozyonda ağırlık kaybı ortalama bir hız verir, en derin çukurun hızını YANSITMAZ.
 */
export function computeCouponLossRateMmPerYear(measurement: CouponWeightLossMeasurement): number {
  const { massLossG, areaCm2, exposureHours, densityGPerCm3 } = measurement;
  if (massLossG < 0) throw new Error("massLossG negatif olamaz.");
  if (areaCm2 <= 0) throw new Error("areaCm2 pozitif olmalıdır.");
  if (exposureHours <= 0) throw new Error("exposureHours pozitif olmalıdır.");
  if (densityGPerCm3 <= 0) throw new Error("densityGPerCm3 pozitif olmalıdır.");

  const constant = getCoefficient<number>("uncertainty.astmG1.couponLossConstantMmPerYear").value;
  return (constant * massLossG) / (areaCm2 * exposureHours * densityGPerCm3);
}

/**
 * İki ultrasonik kalınlık (UT) ölçümü arasındaki ortalama metal kaybı
 * hızını hesaplar: (t_başlangıç - t_bitiş) / Δyıl.
 *
 * Saf tanımsal bir hesaptır, KDP kaynağı gerekmez. Kalınlık ARTIŞI (negatif
 * hız) ölçüm gürültüsü veya kabuk/tortu birikimini gösterebilir — fiziksel
 * bir "negatif korozyon" olamayacağından 0'a kırpılır ve bir uyarı üretilir
 * (bkz. çağıran `buildCalibrationResult`'ın warningsTr alanı).
 */
export function computeUtThicknessLossRateMmPerYear(measurement: UtThicknessMeasurement): number {
  const { thicknessMmAtStart, thicknessMmAtEnd, intervalYears } = measurement;
  if (intervalYears <= 0) throw new Error("intervalYears pozitif olmalıdır.");
  const rate = (thicknessMmAtStart - thicknessMmAtEnd) / intervalYears;
  return Math.max(rate, 0);
}

function isCouponMeasurement(m: CalibrationMeasurement): m is CouponWeightLossMeasurement {
  return "massLossG" in m;
}

function isUtMeasurement(m: CalibrationMeasurement): m is UtThicknessMeasurement {
  return "thicknessMmAtStart" in m;
}

/** calibrationFactor = measuredRate / modelPredictedRate. modelPredictedRate=0 iken tanımsızdır (hata fırlatır). */
export function computeCalibrationFactor(
  measuredRateMmPerYear: number,
  modelPredictedRateP50MmPerYear: number,
): number {
  if (measuredRateMmPerYear < 0) throw new Error("measuredRateMmPerYear negatif olamaz.");
  if (modelPredictedRateP50MmPerYear <= 0) {
    throw new Error(
      "modelPredictedRateP50MmPerYear sıfır (veya negatif) olduğunda kalibrasyon çarpanı tanımsızdır " +
        "(sıfıra bölme).",
    );
  }
  return measuredRateMmPerYear / modelPredictedRateP50MmPerYear;
}

/** Bir belirsizlik bandının her üç noktasını (P10/P50/P90) aynı çarpanla ölçekler — bant genişliğinin göreli şeklini korur. */
export function applyCalibrationFactor(band: UncertaintyBand, factor: number): UncertaintyBand {
  if (factor < 0) throw new Error("Kalibrasyon çarpanı negatif olamaz.");
  return { p10: band.p10 * factor, p50: band.p50 * factor, p90: band.p90 * factor };
}

/**
 * Kalibrasyon çarpanının makul aralıkta olup olmadığını sınıflar. Eşikler
 * (0,2× / 5×) yayımlanmış bir standart DEĞİLDİR — bu projenin kendi
 * "bu kadar büyük bir sapma muhtemelen bir ölçüm/girdi hatasını işaret
 * eder, mühendisin gözden geçirmesi gerekir" mühendislik kuralıdır.
 */
export function classifyCalibrationQuality(factor: number): CalibrationQualityFlag {
  if (factor < SUSPICIOUS_FACTOR_LOW_THRESHOLD) return "SUSPICIOUS_LOW";
  if (factor > SUSPICIOUS_FACTOR_HIGH_THRESHOLD) return "SUSPICIOUS_HIGH";
  return "NORMAL";
}

export interface CalibrationInput {
  measurementType: CalibrationMeasurementType;
  measurement: CalibrationMeasurement;
  modelPredictedRateP50MmPerYear: number;
  /** Verilirse, kalibre edilmiş bant da (calibratedBand) hesaplanır. */
  modelPredictedRateBand?: UncertaintyBand;
}

/**
 * Bir saha ölçümünü modelin tahminiyle karşılaştırarak tam bir
 * `CalibrationResult` üretir — ölçülen hız, kalibrasyon çarpanı, (verildiyse)
 * kalibre edilmiş bant ve kalite bayrağı.
 */
export function buildCalibrationResult(input: CalibrationInput): CalibrationResult {
  const { measurementType, measurement, modelPredictedRateP50MmPerYear, modelPredictedRateBand } = input;
  const warningsTr: string[] = [];
  const sourcesUsed: string[] = [];

  let measuredRateMmPerYear: number;
  if (measurementType === "COUPON_WEIGHT_LOSS") {
    if (!isCouponMeasurement(measurement)) {
      throw new Error("measurementType=COUPON_WEIGHT_LOSS için measurement, CouponWeightLossMeasurement olmalıdır.");
    }
    measuredRateMmPerYear = computeCouponLossRateMmPerYear(measurement);
    sourcesUsed.push("uncertainty.astmG1.couponLossConstantMmPerYear");
  } else if (measurementType === "UT_THICKNESS_LOSS") {
    if (!isUtMeasurement(measurement)) {
      throw new Error("measurementType=UT_THICKNESS_LOSS için measurement, UtThicknessMeasurement olmalıdır.");
    }
    const rawRate = (measurement.thicknessMmAtStart - measurement.thicknessMmAtEnd) / measurement.intervalYears;
    if (rawRate < 0) {
      warningsTr.push(
        "UT ölçümü kalınlık ARTIŞI gösteriyor (negatif hız) — bu fiziksel olarak korozyon olamaz; " +
          "ölçüm gürültüsü, kabuk/tortu birikimi veya farklı ölçüm noktaları olası nedenlerdir. " +
          "Hız 0'a kırpıldı, sonuç dikkatle değerlendirilmelidir.",
      );
    }
    measuredRateMmPerYear = Math.max(rawRate, 0);
  } else {
    measuredRateMmPerYear = (measurement as DirectRateMeasurement).measuredRateMmPerYear;
    if (measuredRateMmPerYear < 0) throw new Error("measuredRateMmPerYear negatif olamaz.");
  }

  const calibrationFactor = computeCalibrationFactor(measuredRateMmPerYear, modelPredictedRateP50MmPerYear);
  const qualityFlag = classifyCalibrationQuality(calibrationFactor);

  if (qualityFlag === "SUSPICIOUS_LOW") {
    warningsTr.push(
      `Kalibrasyon çarpanı (${calibrationFactor.toFixed(3)}×) ${SUSPICIOUS_FACTOR_LOW_THRESHOLD}× altında — ` +
        "model saha ölçümüne göre olağandışı derecede yüksek tahmin ediyor OLABİLİR, ya da ölçüm/girdi " +
        "verilerinde bir hata olabilir. Kalibrasyonu uygulamadan önce gözden geçirin.",
    );
  } else if (qualityFlag === "SUSPICIOUS_HIGH") {
    warningsTr.push(
      `Kalibrasyon çarpanı (${calibrationFactor.toFixed(3)}×) ${SUSPICIOUS_FACTOR_HIGH_THRESHOLD}× üstünde — ` +
        "model saha ölçümüne göre olağandışı derecede düşük tahmin ediyor OLABİLİR (kritik: gerçek hasar " +
        "modelin öngördüğünden çok daha hızlı olabilir), ya da ölçüm/girdi verilerinde bir hata olabilir. " +
        "Kalibrasyonu uygulamadan önce mutlaka bir korozyon mühendisi gözden geçirmelidir.",
    );
  }

  const calibratedBand = modelPredictedRateBand
    ? applyCalibrationFactor(modelPredictedRateBand, calibrationFactor)
    : null;

  return {
    measurementType,
    measuredRateMmPerYear,
    modelPredictedRateP50MmPerYear,
    calibrationFactor,
    calibratedBand,
    qualityFlag,
    warningsTr,
    sourcesUsed,
  };
}

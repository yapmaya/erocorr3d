// packages/engine/src/corrosion/tlc.ts
//
// Üst hat korozyonu (Top-of-Line Corrosion, TLC) modeli.
//
// Tetikleyici koşullar: stratifiye akış VE boru-ortam ısı transferi (dış
// soğuma) VE akışkan sıcaklığı > 50°C.
//
// Model:
//   1) Yoğuşma hızı: WCR[g/(m²·s)] = q/L = U₀×(Tf-Tortam) / L(Tfilm)
//      (q: ısı akısı [W/m²], L: gizli ısı [kJ/kg≡J/g])
//   2) Yoğuşan suyun pH'ı: tamponsuz (bikarbonat≈0), Fe DOYGUN DEĞİL —
//      corrosion/norsokPh.ts'in pH alt-modülü yeniden kullanılır (⚠ K1/K2
//      UNVERIFIED, bkz. o dosya — bu yüzden bu modülün pH'a bağlı sonuçları
//      da UNVERIFIED confidence taşıyabilir).
//   3) TLC hızı = min(kinetik limit, yoğuşma-hızı-sınırlı limit)
//      kinetik limit: de Waard nomogramı, film sıcaklığında ve hesaplanan
//        (tamponsuz) pH'ta değerlendirilir.
//      yoğuşma-sınırlı limit: WCR < kritik eşik (0,25g/m²/s) iken kinetik
//        limitin 0,1 katı (koruyucu doygun film varsayımı); eşik ve üzerinde
//        kinetik limite eşittir.
//   4) Açısal profil: profile(θ)=(1+cosθ)/2 — bkz. registry notu (proje
//      türetimi, UNVERIFIED).
//
// Kaynak: WCR=q/L ilişkisi temel termodinamik bir enerji dengesidir (KDP
// araştırması gerektirmez — Fourier/Fick yasaları düzeyinde evrensel).
// Kritik WCR eşiği ve düşük-yoğuşma azaltma faktörü de Waard modülüyle
// (deWaard.fcond) aynı kaynak temelini paylaşır. Tüm sabitler
// packages/engine/src/registry/coefficients/tlc.ts içindedir.
//
// Girdi/çıktı birimleri: SI (K, Pa, W/(m²·K)) dışarıya.
//
// Geçerlilik aralığı: yalnızca yatay/hafif eğimli, stratifiye akış, ISI
// KAYBI olan (Tfluid>Tambient) hatlarda anlamlıdır.
//
// Bilinen sınırlamalar: (1) genel ısı transfer katsayısı U₀ ÇAĞIRAN TARAF
// tarafından sağlanmalıdır (boru et kalınlığı+izolasyon+dış film
// dirençlerinin seri kombinasyonu bu dosyanın kapsamı DIŞINDADIR — bkz.
// fluids/friction.ts ve gelecek bir ısı transferi modülü); (2) film
// sıcaklığı, akışkan ve ortam sıcaklığının ARİTMETİK ORTALAMASI olarak
// YAKLAŞIK hesaplanır (gerçek yoğuşma film sıcaklığı, yerel ısı transferi
// katsayılarına bağlı daha karmaşık bir profildir); (3) açısal profil
// UNVERIFIED (bkz. registry notu).

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { LatentHeatLinearApproximation } from "../registry/coefficients/tlc";
import { computeDeWaardNomogramRateMmPerYear } from "./deWaard";
import { computeCo2Fugacity } from "./norsok";
import { computeNorsokInSituPh } from "./norsokPh";
import { ENGINEERING_DISCLAIMER_TR, type CorrosionRateResult, type ValidityWarning } from "./types";

const PA_PER_BAR = 1e5;
/** TLC tetikleyici sıcaklık eşiği (°C) — görev talimatından doğrudan */
const TLC_TRIGGER_TEMPERATURE_C = 50;

/**
 * Suyun buharlaşma gizli ısısını, iki referans noktası (0°C/100°C) arasında
 * doğrusal yaklaşıklıkla hesaplar.
 *
 * Model adı: doğrusal yaklaşıklık (bu oturumda türetildi, bkz. registry notu).
 * Girdi/çıktı birimleri: T (°C) → L (kJ/kg).
 * Geçerlilik aralığı: ~0-100°C (ekstrapolasyon dışında hata payı artar).
 */
export function computeLatentHeatKJKg(temperatureC: number): number {
  const { referenceTemp1C, referenceLatentHeat1KJKg, referenceTemp2C, referenceLatentHeat2KJKg } =
    getCoefficient<LatentHeatLinearApproximation>("tlc.latentHeatLinearApproximation").value;
  const slope =
    (referenceLatentHeat2KJKg - referenceLatentHeat1KJKg) / (referenceTemp2C - referenceTemp1C);
  return referenceLatentHeat1KJKg + slope * (temperatureC - referenceTemp1C);
}

/**
 * Su yoğuşma hızını (WCR) ısı dengesinden hesaplar: WCR = U₀×ΔT / L.
 *
 * Model adı: temel enerji dengesi (q=U₀ΔT, WCR=q/L) — KDP araştırması
 * gerektirmeyen temel termodinamik ilişki.
 * Girdi/çıktı birimleri: T (K), U₀ (W/(m²·K)) → WCR (g/(m²·s)).
 */
export function computeWaterCondensationRateGm2s(
  fluidTemperatureK: number,
  ambientTemperatureK: number,
  overallHeatTransferCoefficientWm2K: number,
): number {
  if (overallHeatTransferCoefficientWm2K <= 0) {
    throw new Error("Genel ısı transfer katsayısı (U₀) pozitif olmalıdır.");
  }
  const deltaTK = fluidTemperatureK - ambientTemperatureK;
  if (deltaTK <= 0) {
    return 0; // ortam akışkandan sıcaksa veya eşitse ısı kaybı/yoğuşma yoktur
  }
  const filmTemperatureC = (fluidTemperatureK + ambientTemperatureK) / 2 - 273.15;
  const latentHeatKJKg = computeLatentHeatKJKg(filmTemperatureC);
  const heatFluxWm2 = overallHeatTransferCoefficientWm2K * deltaTK;
  // L[kJ/kg] ≡ L[J/g] (sayısal olarak), bu yüzden q[W/m²]/L[kJ/kg] doğrudan g/(m²·s) verir.
  return heatFluxWm2 / latentHeatKJKg;
}

/**
 * Saat pozisyonuna göre normalize (0-1) TLC şiddet profilini döndürür.
 *
 * Model adı: proje türetimi (UNVERIFIED, bkz. registry notu).
 * @param thetaRad Saat 12 yönünden ölçülen açı (radyan, 0=saat12, π=saat6)
 */
export function tlcAngularProfile(thetaRad: number): number {
  return (1 + Math.cos(thetaRad)) / 2;
}

/** Saat pozisyonunu (1-12) radyana çevirir (saat 12 → 0 rad, saat 6 → π rad). */
export function clockPositionToRadians(clockPosition: number): number {
  if (clockPosition < 1 || clockPosition > 12) {
    throw new Error("Saat pozisyonu 1-12 aralığında olmalıdır.");
  }
  const normalized = clockPosition === 12 ? 0 : clockPosition;
  return (normalized / 6) * Math.PI;
}

export interface TlcTriggerInput {
  isStratifiedFlow: boolean;
  /** Boru-ortam arasında net ısı kaybı var mı (Tfluid > Tambient) */
  hasHeatLossToAmbient: boolean;
  fluidTemperatureK: number;
}

/**
 * TLC'nin bu senaryoda tetiklenip tetiklenmediğini kontrol eder: stratifiye
 * akış VE ısı kaybı VE akışkan sıcaklığı > 50°C.
 */
export function isTlcTriggered(input: TlcTriggerInput): boolean {
  return (
    input.isStratifiedFlow &&
    input.hasHeatLossToAmbient &&
    input.fluidTemperatureK - 273.15 > TLC_TRIGGER_TEMPERATURE_C
  );
}

export interface TlcInput {
  fluidTemperatureK: number;
  ambientTemperatureK: number;
  totalPressurePa: number;
  co2PartialPressurePa: number;
  /** Genel ısı transfer katsayısı U₀ (W/(m²·K)) — boru et+izolasyon+dış film dirençlerinin seri kombinasyonu */
  overallHeatTransferCoefficientWm2K: number;
  isStratifiedFlow: boolean;
  hasHeatLossToAmbient: boolean;
  /** Yoğuşan suda iz miktarda organik asit varsa (mg/L) — pH hesabına dahil edilir */
  organicAcidMgL?: number;
  inhibited: boolean;
  inhibitorEfficiencyPercent?: number;
}

function zeroResult(reason: string): CorrosionRateResult {
  return {
    rateMmPerYear: { p10: 0, p50: 0, p90: 0 },
    confidence: "HIGH",
    validityWarnings: [],
    sourcesUsed: [],
    disclaimer: `${reason} ${ENGINEERING_DISCLAIMER_TR}`,
  };
}

export interface TlcRateResult extends CorrosionRateResult {
  waterCondensationRateGm2s: number;
  filmPh: number;
}

/**
 * Üst hat korozyonu (TLC) hızını hesaplar.
 *
 * Model adı: WCR (ısı dengesi) + de Waard nomogram (kinetik limit) +
 * yoğuşma-hızı-sınırlaması.
 * Girdi/çıktı birimleri: SI (K, Pa, W/(m²·K)) → hız (mm/yıl).
 * Geçerlilik aralığı: yalnızca stratifiye, ısı kaybı olan, T>50°C hatlarda.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeTlcRate(input: TlcInput): TlcRateResult {
  if (
    !isTlcTriggered({
      isStratifiedFlow: input.isStratifiedFlow,
      hasHeatLossToAmbient: input.hasHeatLossToAmbient,
      fluidTemperatureK: input.fluidTemperatureK,
    })
  ) {
    return {
      ...zeroResult(
        "TLC tetikleyici koşulları sağlanmıyor (stratifiye akış + ısı kaybı + T>50°C gereklidir).",
      ),
      waterCondensationRateGm2s: 0,
      filmPh: NaN,
    };
  }
  if (input.co2PartialPressurePa <= 0) {
    return { ...zeroResult("CO2 kısmi basıncı 0; TLC oluşmaz."), waterCondensationRateGm2s: 0, filmPh: NaN };
  }

  const wcrGm2s = computeWaterCondensationRateGm2s(
    input.fluidTemperatureK,
    input.ambientTemperatureK,
    input.overallHeatTransferCoefficientWm2K,
  );
  if (wcrGm2s <= 0) {
    return { ...zeroResult("Hesaplanan yoğuşma hızı 0; TLC oluşmaz."), waterCondensationRateGm2s: 0, filmPh: NaN };
  }

  const filmTemperatureK = (input.fluidTemperatureK + input.ambientTemperatureK) / 2;
  const totalPressureBar = input.totalPressurePa / PA_PER_BAR;
  const co2PartialPressureBar = input.co2PartialPressurePa / PA_PER_BAR;
  const co2FugacityBar = computeCo2Fugacity(co2PartialPressureBar, totalPressureBar, filmTemperatureK);
  const co2FugacityPa = co2FugacityBar * PA_PER_BAR;

  const sourcesUsed = new Set<string>(["deWaard.nomogram", "tlc.criticalCondensationRateGm2s", "tlc.lowCondensationReductionFactor"]);
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("deWaard.nomogram").confidence,
    getCoefficient("tlc.criticalCondensationRateGm2s").confidence,
    getCoefficient("tlc.lowCondensationReductionFactor").confidence,
  ];

  // Yoğuşan suyun pH'ı: tamponsuz (bikarbonat=0), Fe DOYGUN DEĞİL — bu yüzden AGRESİF.
  const phResult = computeNorsokInSituPh({
    temperatureK: filmTemperatureK,
    totalPressurePa: input.totalPressurePa,
    co2FugacityPa,
    bicarbonateMgL: 0,
    organicAcidMgL: input.organicAcidMgL ?? 0,
    ionicStrengthMolar: 1e-6,
    isWaterFeSaturated: false,
  });
  phResult.sourcesUsed.forEach((id) => sourcesUsed.add(id));
  usedConfidences.push(phResult.confidence);
  const validityWarnings: ValidityWarning[] = [...phResult.validityWarnings];

  // TLC'de referans pH, hesaplanan (tamponsuz) pH'ın KENDİSİ kabul edilir —
  // yani FpH=1 (nomogram zaten bu agresif, tamponsuz koşulu temsil eder,
  // ayrıca bir düzeltme UYGULANMAZ).
  const kineticRateMmPerYear = computeDeWaardNomogramRateMmPerYear(filmTemperatureK, co2FugacityPa);

  const criticalWcr = getCoefficient<number>("tlc.criticalCondensationRateGm2s").value;
  const lowFactor = getCoefficient<number>("tlc.lowCondensationReductionFactor").value;
  const condensationLimitedRateMmPerYear =
    wcrGm2s >= criticalWcr ? kineticRateMmPerYear : kineticRateMmPerYear * lowFactor;

  const tlcRateMmPerYear = Math.min(kineticRateMmPerYear, condensationLimitedRateMmPerYear);

  if (wcrGm2s < criticalWcr) {
    validityWarnings.push({
      parameter: "Yoğuşma hızı (WCR)",
      value: wcrGm2s,
      min: criticalWcr,
      max: Infinity,
      unit: "g/(m²·s)",
      message: `Yoğuşma hızı (${wcrGm2s.toFixed(3)}g/(m²·s)) kritik eşiğin (${criticalWcr}g/(m²·s)) altında — TLC hızı koruyucu film varsayımıyla kinetik limitin ${lowFactor}× katına sınırlandı.`,
    });
  }

  const uncertaintyFactor = getCoefficient<number>("uncertainty.defaultMultiplicativeBandFactor").value;
  sourcesUsed.add("uncertainty.defaultMultiplicativeBandFactor");
  usedConfidences.push(getCoefficient("uncertainty.defaultMultiplicativeBandFactor").confidence);

  let p50 = tlcRateMmPerYear;
  let p10 = p50 / uncertaintyFactor;
  let p90 = p50 * uncertaintyFactor;

  if (input.inhibited) {
    const efficiency = input.inhibitorEfficiencyPercent ?? 0;
    if (efficiency < 0 || efficiency > 100) {
      throw new Error("İnhibitör verimliliği %0-100 aralığında olmalıdır.");
    }
    const floor = getCoefficient<number>("corrosion.inhibitedResidualRateFloorMmPerYear").value;
    p10 = Math.max(p10 * (1 - efficiency / 100), floor);
    p50 = Math.max(p50 * (1 - efficiency / 100), floor);
    p90 = Math.max(p90 * (1 - efficiency / 100), floor);
    sourcesUsed.add("corrosion.inhibitedResidualRateFloorMmPerYear");
    usedConfidences.push(getCoefficient("corrosion.inhibitedResidualRateFloorMmPerYear").confidence);
  }

  return {
    rateMmPerYear: { p10, p50, p90 },
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed: [...sourcesUsed],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    waterCondensationRateGm2s: wcrGm2s,
    filmPh: phResult.pH,
  };
}

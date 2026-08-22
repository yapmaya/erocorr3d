// packages/engine/src/corrosion/rules.ts
//
// Projenin mühendislik kabulleri (bkz. proje talimatları, "MÜHENDİSLİK KURALLARI").
// Bu kurallar yayımlanmış bir sabit değil, tasarım kararlarıdır; bu yüzden KDP kayıt
// defterine değil buraya, saf fonksiyonlar olarak yazılmıştır. İstisna: inhibitörlü
// kalıntı hız tabanı (0.1 mm/yıl) sayısal bir sabit olduğundan registry'den gelir.

import { getCoefficient } from "../registry";

/**
 * Kuru gaz kontrolü.
 *
 * Kural: akışkan sıcaklığı su çiy noktasının ≥10°C üstündeyse ortam kuru gaz
 * kabul edilir ve korozif DEĞİLDİR.
 *
 * @param fluidTemperatureC Akışkan sıcaklığı (°C)
 * @param waterDewPointC Suyun çiy noktası sıcaklığı (°C)
 */
export function isDryGas(fluidTemperatureC: number, waterDewPointC: number): boolean {
  return fluidTemperatureC - waterDewPointC >= 10;
}

/**
 * Serbest su varlığı kontrolü.
 *
 * Kural: kuru gazda serbest su yoktur. Kuru gaz değilse, ya doğrudan sıvı
 * fazda su (water cut > 0) ya da buhardan yoğuşan su (condensationExpected)
 * serbest su kaynağıdır. Serbest su yoksa CO2 korozyonu oluşmaz.
 */
export function hasFreeWater(params: {
  isDryGasFlow: boolean;
  waterCutPercent: number;
  condensationExpected: boolean;
}): boolean {
  if (params.isDryGasFlow) {
    return false;
  }
  return params.waterCutPercent > 0 || params.condensationExpected;
}

/**
 * Yoğuşma faktörü (Fcond).
 *
 * Kural: serbest su, sıvı fazdan değil buhardan yoğuşmayla geliyorsa, hesaplanan
 * korozyon hızına bir yoğuşma faktörü uygulanır. Faktör, tam yoğuşma koşulunda 1.0,
 * yoğuşma yoksa 0.0'dır; ara durumlarda çağıran taraf 0-1 arası bir değer sağlar
 * (ör. akış rejimi/proses mühendisliği verisinden).
 */
export function applyCondensationFactor(
  baseRateMmPerYear: number,
  condensationFactor: number,
): number {
  if (condensationFactor < 0 || condensationFactor > 1) {
    throw new Error("Yoğuşma faktörü 0 ile 1 arasında olmalıdır.");
  }
  return baseRateMmPerYear * condensationFactor;
}

/**
 * Kısmi çalışma düzeltmesi.
 *
 * Kural: sistem yılın tamamında değil, yalnızca operatingDaysPerYear kadar gün
 * çalışıyorsa, toplam metal kaybı bu orana göre orantılı olarak azaltılır.
 */
export function applyPartialOperationFactor(
  annualMetalLossMm: number,
  operatingDaysPerYear: number,
): number {
  if (operatingDaysPerYear < 0 || operatingDaysPerYear > 365) {
    throw new Error("Yıllık çalışma günü sayısı 0-365 aralığında olmalıdır.");
  }
  return annualMetalLossMm * (operatingDaysPerYear / 365);
}

/**
 * İnhibitör etkisi ve kalıntı hız tabanı.
 *
 * Kural: inhibitör faydası yalnızca açıkça inhibitörlü olarak işaretlenen
 * hatlarda uygulanır. İnhibitörlü hız, mühendislik kabulü gereği asla
 * 0.1 mm/yıl'ın (registry: corrosion.inhibitedResidualRateFloorMmPerYear) altına
 * inmez — inhibitör verimliliği %100'e yaklaşsa bile kalıntı bir korozyon riski
 * kabul edilir.
 *
 * @param uninhibitedRateMmPerYear İnhibitörsüz hesaplanan korozyon hızı
 * @param inhibitorEfficiencyPercent İnhibitör verimliliği (%0-100)
 */
export function applyInhibitorFloor(
  uninhibitedRateMmPerYear: number,
  inhibitorEfficiencyPercent: number,
): number {
  if (inhibitorEfficiencyPercent < 0 || inhibitorEfficiencyPercent > 100) {
    throw new Error("İnhibitör verimliliği %0-100 aralığında olmalıdır.");
  }
  const floor = getCoefficient<number>(
    "corrosion.inhibitedResidualRateFloorMmPerYear",
  ).value;
  const inhibitedRate =
    uninhibitedRateMmPerYear * (1 - inhibitorEfficiencyPercent / 100);
  return Math.max(inhibitedRate, floor);
}

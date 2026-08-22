// packages/engine/src/fluids/waterProperties.ts
//
// Su buhar basıncı, su çiy noktası ve doğal gazda doygunluk su içeriği.
//
// Modeller:
//   1) Doygun buhar basıncı ps(T) ve tersi Ts(p): IAPWS-IF97 Bölüm 8 (Eq. 30/31,
//      Wagner tipi kapalı-form denklem — KAPALI FORM, iterasyon GEREKTİRMEZ).
//   2) Su çiy noktası: gaz karışımındaki su kısmi basıncı pH2O=yH2O×Ptotal
//      hesaplanır, ardından Ts(pH2O) (yukarıdaki backward denklem) çiy
//      noktası sıcaklığını verir (Raoult/Dalton yaklaşımı — ideal karışım
//      kabulü, bkz. bilinen sınırlamalar).
//   3) Doygunluk su içeriği: Bukacek (1959) korelasyonu,
//      w[lb/MMCF] = 47484×(ps/Ptotal) + B, log10(B)=-3083.87/(459.6+t[°F])+6.69449.
//
// Kaynak: IAPWS-IF97 (resmi belge, bu oturumda birincil kaynaktan okundu ve
// belgenin kendi doğrulama tablosuyla bağımsız olarak TAM eşleştirildi);
// Bukacek (1959), Carroll (2002) GPA bildirisi üzerinden aktarıldı, ikinci
// bağımsız kaynakla çapraz doğrulandı. Tüm sabitler
// packages/engine/src/registry/coefficients/waterProperties.ts içindedir.
//
// Girdi/çıktı birimleri: SI (K, Pa) iç kullanım; Bukacek'in kendi doğal
// birimleri (°F, lb/MMCF) yalnızca formülün İÇİNDE kullanılır, dışarıya SI
// (mg/Sm³) olarak döndürülür.
//
// Geçerlilik aralığı: IAPWS-IF97 doygunluk denklemi 273.15K-647.096K (Tc)
// için TAM geçerlidir. Bukacek korelasyonu 60-460°F (288.7-511K) ve
// 15-10000psia (103kPa-68.9MPa) için, YALNIZCA tatlı (asit gazsız) doğal
// gaz için geçerlidir.
//
// Bilinen sınırlamalar: (1) çiy noktası hesabı ideal (Raoult/Dalton) karışım
// kabulü yapar — yüksek basınçta (özellikle >70bar) gerçek gaz etkileşimleri
// nedeniyle sapma artar (bu, Bukacek'in kendi belgelenmiş sınırlamasıyla da
// tutarlıdır); (2) Bukacek CO2/H2S içeren (asit) gazlarda belirgin şekilde
// hatalıdır (bkz. registry notu) — bu proje YALNIZCA tatlı gaz için önerir;
// (3) mg/Sm³ dönüşümü ABD geleneksel "standart" referans koşulunu (60°F/
// 14.696psia) örtük olarak kabul eder.

import { getCoefficient } from "../registry";
import type { BukacekCoefficients, IapwsSaturationCoefficients } from "../registry/coefficients/waterProperties";
import type { ValidityWarning } from "../corrosion/types";

const PA_PER_MPA = 1e6;

function kelvinToFahrenheit(temperatureK: number): number {
  return ((temperatureK - 273.15) * 9) / 5 + 32;
}

function checkTemperatureRangeK(temperatureK: number): ValidityWarning | undefined {
  const min = getCoefficient<number>("waterProperties.iapwsValidity.minTemperatureK").value;
  const max = getCoefficient<number>("waterProperties.iapwsValidity.maxTemperatureK").value;
  if (temperatureK < min || temperatureK > max) {
    return {
      parameter: "Sıcaklık",
      value: temperatureK,
      min,
      max,
      unit: "K",
      message: `Sıcaklık (${temperatureK} K) IAPWS-IF97 doygunluk denkleminin geçerlilik aralığının (${min}-${max} K) dışında.`,
    };
  }
  return undefined;
}

/**
 * Suyun doygun buhar basıncını hesaplar (IAPWS-IF97 Eq. 30).
 *
 * Model adı: IAPWS-IF97 Bölüm 8.1 doygunluk basıncı denklemi (Wagner tipi).
 * Girdi/çıktı birimleri: T (K) → ps (Pa).
 * Geçerlilik aralığı: 273.15K ≤ T ≤ 647.096K (kritik sıcaklık).
 * Bilinen sınırlamalar: yok (bu aralıkta IAPWS-95'e göre tanım gereği tam
 * uyumlu bir endüstriyel formülasyondur).
 */
export function computeWaterSaturationPressurePa(temperatureK: number): number {
  if (temperatureK <= 0) {
    throw new Error("Sıcaklık pozitif olmalıdır.");
  }
  const n = getCoefficient<IapwsSaturationCoefficients>("waterProperties.iapwsSaturationCoefficients").value;
  const theta = temperatureK + n.n9 / (temperatureK - n.n10);
  const a = theta ** 2 + n.n1 * theta + n.n2;
  const b = n.n3 * theta ** 2 + n.n4 * theta + n.n5;
  const c = n.n6 * theta ** 2 + n.n7 * theta + n.n8;
  const inner = (2 * c) / (-b + Math.sqrt(b ** 2 - 4 * a * c));
  return inner ** 4 * PA_PER_MPA;
}

/**
 * Verilen buhar basıncına karşılık gelen doygunluk sıcaklığını (çiy
 * noktasını) hesaplar (IAPWS-IF97 Eq. 31 — Eq. 30'un matematiksel tersi,
 * KAPALI FORM, iterasyon gerektirmez).
 *
 * Model adı: IAPWS-IF97 Bölüm 8.2 doygunluk sıcaklığı denklemi.
 * Girdi/çıktı birimleri: p (Pa) → Ts (K).
 * Geçerlilik aralığı: sonuç sıcaklığı 273.15K-647.096K aralığında olduğu
 * sürece geçerlidir (girdi basıncı buna karşılık gelen ps(273.15K)-
 * ps(647.096K)=611.657Pa-22.064MPa aralığında olmalıdır).
 */
export function computeWaterSaturationTemperatureK(pressurePa: number): number {
  if (pressurePa <= 0) {
    throw new Error("Basınç pozitif olmalıdır.");
  }
  const n = getCoefficient<IapwsSaturationCoefficients>("waterProperties.iapwsSaturationCoefficients").value;
  const pressureMPa = pressurePa / PA_PER_MPA;
  const beta = pressureMPa ** 0.25;
  const e = beta ** 2 + n.n3 * beta + n.n6;
  const f = n.n1 * beta ** 2 + n.n4 * beta + n.n7;
  const g = n.n2 * beta ** 2 + n.n5 * beta + n.n8;
  const d = (2 * g) / (-f - Math.sqrt(f ** 2 - 4 * e * g));
  const inner = n.n10 + d - Math.sqrt((n.n10 + d) ** 2 - 4 * (n.n9 + n.n10 * d));
  return inner / 2;
}

export interface WaterDewPointInput {
  /** Toplam (mutlak) basınç (Pa) */
  totalPressurePa: number;
  /** Gaz fazındaki su buharı mol kesri (0-1) */
  waterMoleFraction: number;
}

export interface WaterDewPointResult {
  dewPointK: number;
  waterPartialPressurePa: number;
  validityWarnings: ValidityWarning[];
}

/**
 * Gaz bileşimi ve toplam basınçtan suyun çiy noktası sıcaklığını hesaplar.
 *
 * Model adı: Dalton/Raoult ideal karışım yaklaşımı (pH2O=yH2O×Ptotal) +
 * IAPWS-IF97 doygunluk sıcaklığı denklemi.
 * Girdi/çıktı birimleri: Ptotal (Pa), yH2O (boyutsuz, 0-1) → çiy noktası (K).
 * Geçerlilik aralığı: bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: ideal karışım kabulü, yüksek basınçta (>70bar)
 * doğruluğu azalabilir (bkz. dosya başı yorumu).
 */
export function computeWaterDewPointK(input: WaterDewPointInput): WaterDewPointResult {
  if (input.totalPressurePa <= 0) {
    throw new Error("Toplam basınç pozitif olmalıdır.");
  }
  if (input.waterMoleFraction <= 0 || input.waterMoleFraction > 1) {
    throw new Error("Su mol kesri (0, 1] aralığında olmalıdır.");
  }
  const waterPartialPressurePa = input.waterMoleFraction * input.totalPressurePa;
  const dewPointK = computeWaterSaturationTemperatureK(waterPartialPressurePa);

  const validityWarnings: ValidityWarning[] = [];
  const w = checkTemperatureRangeK(dewPointK);
  if (w) validityWarnings.push(w);
  if (input.totalPressurePa > 70e5) {
    validityWarnings.push({
      parameter: "Toplam basınç",
      value: input.totalPressurePa,
      min: 0,
      max: 70e5,
      unit: "Pa",
      message:
        "Toplam basınç 70 bar üzerinde — ideal karışım (Dalton/Raoult) kabulüyle hesaplanan çiy noktası " +
        "bu basınçlarda gerçek gaz etkileşimleri nedeniyle sapabilir (bkz. Bukacek korelasyonunun kendi " +
        "belgelenmiş sınırlaması, aynı basınç eşiği).",
    });
  }

  return { dewPointK, waterPartialPressurePa, validityWarnings };
}

export interface SaturatedWaterContentInput {
  temperatureK: number;
  totalPressurePa: number;
}

export interface SaturatedWaterContentResult {
  waterContentMgPerSm3: number;
  validityWarnings: ValidityWarning[];
}

/**
 * Tatlı (asit gazsız) doğal gazın doygunluk su içeriğini Bukacek (1959)
 * korelasyonuyla hesaplar.
 *
 * Model adı: Bukacek (1959) korelasyonu.
 * Girdi/çıktı birimleri: T (K), Ptotal (Pa) → su içeriği (mg/Sm³).
 * Geçerlilik aralığı: 60-460°F (288.7-511K), 15-10000psia (103kPa-68.9MPa),
 * YALNIZCA tatlı gaz.
 * Bilinen sınırlamalar: CO2/H2S içeren gazlarda belirgin hata (bkz. dosya
 * başı yorumu); "standart" hacim referans koşulu ABD geleneksel (60°F/
 * 14.696psia) kabul edilir.
 */
export function computeSaturatedWaterContentMgPerSm3(
  input: SaturatedWaterContentInput,
): SaturatedWaterContentResult {
  if (input.temperatureK <= 0 || input.totalPressurePa <= 0) {
    throw new Error("Sıcaklık ve basınç pozitif olmalıdır.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const temperatureF = kelvinToFahrenheit(input.temperatureK);
  const pressurePsia = input.totalPressurePa / 6894.757293168;

  const [minF, maxF] = getCoefficient<[number, number]>("waterProperties.bukacekValidity.temperatureF").value;
  if (temperatureF < minF || temperatureF > maxF) {
    validityWarnings.push({
      parameter: "Sıcaklık",
      value: temperatureF,
      min: minF,
      max: maxF,
      unit: "°F",
      message: `Sıcaklık (${temperatureF.toFixed(1)}°F) Bukacek korelasyonunun geçerlilik aralığının (${minF}-${maxF}°F) dışında.`,
    });
  }
  const [minPsia, maxPsia] = getCoefficient<[number, number]>(
    "waterProperties.bukacekValidity.pressurePsia",
  ).value;
  if (pressurePsia < minPsia || pressurePsia > maxPsia) {
    validityWarnings.push({
      parameter: "Basınç",
      value: pressurePsia,
      min: minPsia,
      max: maxPsia,
      unit: "psia",
      message: `Basınç (${pressurePsia.toFixed(0)}psia) Bukacek korelasyonunun geçerlilik aralığının (${minPsia}-${maxPsia}psia) dışında.`,
    });
  }

  const saturationPressurePa = computeWaterSaturationPressurePa(input.temperatureK);
  const { leadCoefficient, logBNumerator, logBDenominatorOffset, logBConstant } = getCoefficient<
    BukacekCoefficients
  >("waterProperties.bukacekCoefficients").value;

  const logB = logBNumerator / (logBDenominatorOffset + temperatureF) + logBConstant;
  const bTerm = 10 ** logB;
  const waterContentLbPerMmcf = leadCoefficient * (saturationPressurePa / input.totalPressurePa) + bTerm;

  const conversionFactor = getCoefficient<number>("waterProperties.lbPerMmcfToMgPerSm3").value;
  const waterContentMgPerSm3 = waterContentLbPerMmcf * conversionFactor;

  return { waterContentMgPerSm3, validityWarnings };
}

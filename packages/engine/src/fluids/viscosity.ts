// packages/engine/src/fluids/viscosity.ts
//
// Gaz, sıvı hidrokarbon ve su viskozitesi.
//
// Modeller:
//   Gaz: Lee-Gonzalez-Eakin (1966) — μg=1e-4×K×exp(X×ρg^Y) [cp, ρg g/cm³, T °R]
//   Sıvı (dead oil): Beggs-Robinson (1975) — μod=10^X-1 [cp, T °F, API]
//   Su: basitleştirilmiş korelasyon — μ=2.414e-5×10^(247.8/(T-140)) [Pa·s, T K]
//
// Kaynak: bkz. packages/engine/src/registry/coefficients/viscosity.ts (her
// üç model için ayrı ayrı belgelenmiştir).
//
// Girdi/çıktı birimleri: SI (K, kg/m³) dışarıya; her modelin kendi doğal
// biriminde (°R, °F, g/cm³, cp) hesap İÇERİDE yapılır, sonuç Pa·s'ye
// dönüştürülür.
//
// Geçerlilik aralığı: her fonksiyon için ayrı ayrı, bkz. ilgili JSDoc.
//
// Bilinen sınırlamalar: (1) Lee-Gonzalez-Eakin ağır (C7+ oranı yüksek) gaz
// karışımlarında ve H2S/CO2 payı çok yüksek gazlarda daha az doğrudur —
// orijinal çalışma esas olarak sweet/orta-ağırlık doğal gazlar için
// kalibre edilmiştir; (2) Beggs-Robinson yalnızca ÇÖZÜNMÜŞ GAZ İÇERMEYEN
// ("dead oil") ham petrol için geçerlidir — canlı petrol (live oil,
// çözünmüş gaz oranı Rs>0) viskozitesi için ayrı bir düzeltme (ör.
// Chew-Connally) GEREKİR ve bu dosyada UYGULANMAMIŞTIR; (3) su korelasyonu
// yalnızca sıvı fazda ve ~1 atm civarında geçerlidir, yüksek basınç
// düzeltmesi içermez (IAPWS'in tam formülasyonunda basınç etkisi vardır,
// bu basitleştirilmiş biçimde YOKTUR).

import { getCoefficient } from "../registry";
import type {
  BeggsRobinsonCoefficients,
  LeeGonzalezEakinCoefficients,
  WaterViscosityCoefficients,
} from "../registry/coefficients/viscosity";
import type { ValidityWarning } from "../corrosion/types";

const CP_TO_PA_S = 1e-3;

function kelvinToRankine(temperatureK: number): number {
  return temperatureK * 1.8;
}

function kelvinToFahrenheit(temperatureK: number): number {
  return ((temperatureK - 273.15) * 9) / 5 + 32;
}

/**
 * Yoğunluktan API gravitesini hesaplar: API = 141.5/SG - 131.5, SG=ρ/ρ(60°F su).
 *
 * @param densityKgM3 Sıvının yoğunluğu (kg/m³, ölçüm sıcaklığında)
 */
export function computeApiGravityFromDensity(densityKgM3: number): number {
  if (densityKgM3 <= 0) {
    throw new Error("Yoğunluk pozitif olmalıdır.");
  }
  const waterDensityAt60FKgM3 = 999.016;
  const specificGravity = densityKgM3 / waterDensityAt60FKgM3;
  return 141.5 / specificGravity - 131.5;
}

export interface GasViscosityResult {
  viscosityPaS: number;
  validityWarnings: ValidityWarning[];
}

/**
 * Doğal gaz dinamik viskozitesini Lee-Gonzalez-Eakin (1966) korelasyonuyla
 * hesaplar.
 *
 * Model adı: Lee-Gonzalez-Eakin (1966).
 * Girdi/çıktı birimleri: T (K), Mw (kg/mol), ρg (kg/m³) → viskozite (Pa·s).
 * Geçerlilik aralığı: T 560-800°R (≈100-340°F ≈ 311-444K); bkz. dosya başı
 * yorumu diğer sınırlamalar için.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 *
 * @param temperatureK Gaz sıcaklığı (K)
 * @param molarMassKgPerMol Gazın (karışım) molar kütlesi (kg/mol)
 * @param densityKgM3 Gaz yoğunluğu (kg/m³) — ör. fluids/prEos.ts'ten
 */
export function computeGasViscosityPaS(
  temperatureK: number,
  molarMassKgPerMol: number,
  densityKgM3: number,
): GasViscosityResult {
  if (temperatureK <= 0 || molarMassKgPerMol <= 0 || densityKgM3 <= 0) {
    throw new Error("Sıcaklık, molar kütle ve yoğunluk pozitif olmalıdır.");
  }
  const c = getCoefficient<LeeGonzalezEakinCoefficients>("viscosity.leeGonzalezEakinCoefficients").value;
  const temperatureR = kelvinToRankine(temperatureK);
  const molarMassLbPerLbmol = molarMassKgPerMol * 1000; // kg/mol → g/mol, sayısal olarak lbm/lbmol'a eşittir
  const densityGPerCm3 = densityKgM3 / 1000;

  const k =
    ((c.kConstant1 + c.kMwCoefficient1 * molarMassLbPerLbmol) * temperatureR ** 1.5) /
    (c.kConstant2 + c.kMwCoefficient2 * molarMassLbPerLbmol + temperatureR);
  const x = c.xConstant1 + c.xTCoefficient / temperatureR + c.xMwCoefficient * molarMassLbPerLbmol;
  const y = c.yConstant1 - c.yXCoefficient * x;

  const viscosityCp = 1e-4 * k * Math.exp(x * densityGPerCm3 ** y);

  const validityWarnings: ValidityWarning[] = [];
  const [minR, maxR] = getCoefficient<[number, number]>(
    "viscosity.leeGonzalezEakinValidity.temperatureRankine",
  ).value;
  if (temperatureR < minR || temperatureR > maxR) {
    validityWarnings.push({
      parameter: "Sıcaklık",
      value: temperatureR,
      min: minR,
      max: maxR,
      unit: "°R",
      message: `Sıcaklık (${temperatureR.toFixed(0)}°R) Lee-Gonzalez-Eakin korelasyonunun geçerlilik aralığının (${minR}-${maxR}°R) dışında.`,
    });
  }

  return { viscosityPaS: viscosityCp * CP_TO_PA_S, validityWarnings };
}

/**
 * Suyun dinamik viskozitesini basitleştirilmiş korelasyonla hesaplar.
 *
 * Model adı: basitleştirilmiş su viskozitesi korelasyonu (Vogel-Fulcher-
 * Tammann tipi, bkz. registry notu).
 * Girdi/çıktı birimleri: T (K) → viskozite (Pa·s).
 * Geçerlilik aralığı: sıvı su, ~0-370°C, ~1 atm civarı (yüksek basınç
 * düzeltmesi yoktur).
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeWaterViscosityPaS(temperatureK: number): number {
  if (temperatureK <= 140) {
    throw new Error("Sıcaklık 140K'in üzerinde olmalıdır (formülün paydası 140K'de tanımsızlaşır).");
  }
  const c = getCoefficient<WaterViscosityCoefficients>("viscosity.waterViscosityCoefficients").value;
  return c.preExponentialFactorPaS * 10 ** (c.numeratorK / (temperatureK - c.offsetK));
}

export interface LiquidHydrocarbonViscosityResult {
  viscosityPaS: number;
  validityWarnings: ValidityWarning[];
}

/**
 * Çözünmüş gaz içermeyen ("dead oil") sıvı hidrokarbonun dinamik
 * viskozitesini Beggs-Robinson (1975) korelasyonuyla hesaplar.
 *
 * Model adı: Beggs-Robinson (1975) dead oil viskozite korelasyonu.
 * Girdi/çıktı birimleri: T (K), API gravitesi (°API, boyutsuz) → viskozite (Pa·s).
 * Geçerlilik aralığı: API 16-58°, T 70-295°F (294-419K).
 * Bilinen sınırlamalar: yalnızca dead oil (Rs=0); 100-150°F (311-338K)
 * altında viskoziteyi olduğundan fazla tahmin etme eğilimi bilinen bir
 * sınırlamadır (bkz. dosya başı yorumu).
 *
 * @param temperatureK Sıvı sıcaklığı (K)
 * @param apiGravity API gravitesi (°API) — bkz. computeApiGravityFromDensity
 */
export function computeLiquidHydrocarbonViscosityPaS(
  temperatureK: number,
  apiGravity: number,
): LiquidHydrocarbonViscosityResult {
  if (temperatureK <= 0) {
    throw new Error("Sıcaklık pozitif olmalıdır.");
  }
  const c = getCoefficient<BeggsRobinsonCoefficients>("viscosity.beggsRobinsonCoefficients").value;
  const temperatureF = kelvinToFahrenheit(temperatureK);

  const z = c.zConstant - c.zApiCoefficient * apiGravity;
  const y = 10 ** z;
  const x = y * temperatureF ** c.temperatureExponent;
  const viscosityCp = 10 ** x - 1;

  const validityWarnings: ValidityWarning[] = [];
  const [minApi, maxApi] = getCoefficient<[number, number]>("viscosity.beggsRobinsonValidity.apiGravity").value;
  if (apiGravity < minApi || apiGravity > maxApi) {
    validityWarnings.push({
      parameter: "API gravitesi",
      value: apiGravity,
      min: minApi,
      max: maxApi,
      unit: "°API",
      message: `API gravitesi (${apiGravity}) Beggs-Robinson korelasyonunun geçerlilik aralığının (${minApi}-${maxApi}°API) dışında.`,
    });
  }
  const [minF, maxF] = getCoefficient<[number, number]>("viscosity.beggsRobinsonValidity.temperatureF").value;
  if (temperatureF < minF || temperatureF > maxF) {
    validityWarnings.push({
      parameter: "Sıcaklık",
      value: temperatureF,
      min: minF,
      max: maxF,
      unit: "°F",
      message: `Sıcaklık (${temperatureF.toFixed(1)}°F) Beggs-Robinson korelasyonunun geçerlilik aralığının (${minF}-${maxF}°F) dışında.`,
    });
  } else if (temperatureF < 150) {
    validityWarnings.push({
      parameter: "Sıcaklık",
      value: temperatureF,
      min: 150,
      max: maxF,
      unit: "°F",
      message:
        `Sıcaklık (${temperatureF.toFixed(1)}°F) 150°F'in altında — Beggs-Robinson korelasyonunun ` +
        "bu aralıkta viskoziteyi OLDUĞUNDAN FAZLA tahmin etme eğilimi olduğu belgelenmiştir (bkz. kaynak notu).",
    });
  }

  return { viscosityPaS: viscosityCp * CP_TO_PA_S, validityWarnings };
}

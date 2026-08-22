// packages/engine/src/corrosion/norsokPh.ts
//
// NORSOK M-506 Bölüm 8.2 "pH" — ölçülmüş pH verilmemişse, gaz/su
// kimyasından (CO2 fugasitesi, bikarbonat, iyonik kuvvet) in-situ pH
// hesabı. Doygun-olmayan VE demir karbonatla (FeCO3) doygun iki mod.
//
// Model: 5 denge sabiti (KH, K0, K1, K2, Kw) + (doygun modda) FeCO3
// çözünürlük çarpımı Ksp; elektro-nötrlük + bikarbonat kütle dengesi
// birleştirilerek [H+] için kübik (doygun-olmayan, Eq.11) veya kuartik
// (doygun, Eq.12) bir denklem elde edilir, standardın kendi talimatı
// gereği Newton-Raphson ile çözülür.
//
//   Doygun-olmayan: C_H+³ + C0·C_H+² − B·C_H+ − D = 0
//   Doygun (FeCO3): A·C_H+⁴ + C_H+³ + C0·C_H+² − B·C_H+ − D = 0
//     A = 4·Ksp/D,  B = KH·K0·K1·fCO2 + Kw,  D = 2·KH·K0·K1·K2·fCO2
//     C0 = düzeltilmiş bikarbonat derişimi (molar)
//
// Kaynak: NORSOK Standard M-506, Rev. 2 (2005), Bölüm 8.2.2-8.2.3, Eq.9-18.
// Tüm denge sabitleri packages/engine/src/registry/coefficients/norsokPh.ts
// içinde, birincil kaynaktan (standardın PDF'i, hem metin hem sayfa
// görüntüsü olarak okundu) belgelenmiştir.
//
// ÖNEMLİ BİRİM NOTU: KH/K1/K2 formülleri İÇİNDE FARKLI basınç birimleri
// kullanılır — KH bar, K1/K2 PSİ bekler (standardın kendi metninde açıkça
// belirtilmiştir). K1/K2 ayrıca TK (Kelvin) ile Tf (Fahrenheit)'ı AYNI
// formülde karıştırır — bu, standardın kendi orijinal biçimidir, "hata"
// değildir.
//
// Girdi/çıktı birimleri: SI (K, Pa) dışarıya; formüllerin kendi doğal
// birimleri (bar, psi, °C, °F, molar) İÇERİDE kullanılır.
//
// Geçerlilik aralığı: bikarbonat 0-20000mg/l, iyonik kuvvet 0-3M (Tablo 6).
//
// ⚠⚠ KRİTİK GÜVENİLİRLİK UYARISI: K1 ve K2 (karbonik asit ayrışma sabitleri,
// Eq.16/17) standardın PDF kopyasından piksel piksel doğru okunduğu HALDE,
// bu oturumda yapılan bağımsız fiziksel makullük kontrolünü GEÇEMEDİ (bkz.
// registry/coefficients/norsokPh.ts::norsokPh.k1 notları — hesaplanan pK1,
// bilinen karbonik asit literatür değerinden ~17 mertebe sapıyor). Bu iki
// katsayı UNVERIFIED işaretlidir ve bu fonksiyonun ürettiği HER pH sonucu
// bu yüzden "confidence: UNVERIFIED" taşır ve bir validityWarning içerir.
// Ölçülmüş/gerçek bir pH değeri MEVCUTSA bu modül yerine DOĞRUDAN o değer
// kullanılmalıdır — bu modül yalnızca pH ölçümü YOKSA son çare olarak
// kullanılmalı ve sonucu bir korozyon mühendisi tarafından ayrıca
// doğrulanmalıdır.
//
// Bilinen sınırlamalar: (1) iyonik kuvvet doğrudan verilmezse yalnızca
// klorürden (basit 1:1 NaCl elektrolit yaklaşımı, I≈C_Cl-) TAHMİN edilir —
// gerçek suda diğer iyonların (sülfat, kalsiyum vb.) katkısı yoksayılır;
// (2) organik asit/bikarbonat düzeltmesi standardın belirttiği SABİT 2/3
// oranını kullanır ("düşük pH'da daha yüksek oran gerekir" notu sayısal
// bir formülle verilmediği için uygulanmamıştır); (3) yalnızca NaHCO3/NaCl
// içeren bir su bileşimi varsayılır (standardın kendi varsayımı).

import { getCoefficient, worstConfidence } from "../registry";
import type {
  NorsokPhDissociationCoefficients,
  NorsokPhKhCoefficients,
} from "../registry/coefficients/norsokPh";
import type { ConfidenceLevel } from "../registry/types";
import type { ValidityWarning } from "./types";

const PA_PER_BAR = 1e5;
const PA_PER_PSI = 6894.757293168;

// Standart atom ağırlıklarından hesaplanan molar kütleler (kg gerekmez, g/mol yeterli — tartışmasız aritmetik).
const BICARBONATE_MOLAR_MASS_G_MOL = 61.016; // HCO3- : H+C+3O
const CHLORIDE_MOLAR_MASS_G_MOL = 35.453; // Cl-

function kelvinToCelsius(temperatureK: number): number {
  return temperatureK - 273.15;
}

function kelvinToFahrenheit(temperatureK: number): number {
  return ((temperatureK - 273.15) * 9) / 5 + 32;
}

/**
 * Klorür derişiminden (basit 1:1 NaCl elektrolit yaklaşımıyla) iyonik
 * kuvveti tahmin eder: I ≈ C_Cl- (molar) — I=½Σ(Ci·zi²) formülünde Na+ ve
 * Cl- için z=1 olduğundan ve standart Na+≈Cl- (NaCl) kabul ettiğinden.
 *
 * @param chlorideMgL Klorür derişimi (mg/L)
 */
export function estimateIonicStrengthMolar(chlorideMgL: number): number {
  if (chlorideMgL < 0) {
    throw new Error("Klorür derişimi negatif olamaz.");
  }
  return chlorideMgL / 1000 / CHLORIDE_MOLAR_MASS_G_MOL;
}

/**
 * Ölçülen bikarbonat derişimini organik asit (ör. asetik asit) katkısı
 * için düzeltir: düzeltilmiş = ölçülen − (2/3)×organik_asit (standardın
 * kendi kuralı, 4.3 titrasyon bitiş pH'ı varsayımıyla).
 */
export function correctBicarbonateForOrganicAcid(
  bicarbonateMgL: number,
  organicAcidMgL: number,
): number {
  if (bicarbonateMgL < 0 || organicAcidMgL < 0) {
    throw new Error("Bikarbonat ve organik asit derişimleri negatif olamaz.");
  }
  return Math.max(0, bicarbonateMgL - (2 / 3) * organicAcidMgL);
}

/** CO2 Henry sabiti KH — Eq.14 (0-80°C) / Eq.15 (80-200°C). */
export function computeCo2HenryConstant(
  temperatureK: number,
  totalPressureBar: number,
  ionicStrengthMolar: number,
): number {
  const c = getCoefficient<NorsokPhKhCoefficients>("norsokPh.henryConstant").value;
  const temperatureC = kelvinToCelsius(temperatureK);
  const pressureTerm = c.lowRange.pressureCoeff * totalPressureBar + c.lowRange.ionicStrengthCoeff * ionicStrengthMolar;

  let exponentTerm: number;
  if (temperatureC <= c.transitionTemperatureC) {
    const { constA, tCoeff1, tCoeff2 } = c.lowRange;
    exponentTerm = -(constA + tCoeff1 / temperatureK - tCoeff2 / temperatureK ** 2);
  } else {
    const { criticalTemperatureK, coeff1, coeff2, coeff3, coeff4 } = c.highRange;
    exponentTerm = -(
      (coeff1 * (1 - temperatureK / criticalTemperatureK) ** (1 / 3)) / temperatureK +
      coeff2 +
      coeff3 / temperatureK -
      coeff4 / temperatureK ** 2
    );
  }

  return c.preExponentialFactor * Math.exp(exponentTerm) * 10 ** -pressureTerm;
}

function computeDissociationConstant(
  coeffId: "norsokPh.k1" | "norsokPh.k2",
  temperatureK: number,
  totalPressurePsi: number,
  ionicStrengthMolar: number,
): number {
  const c = getCoefficient<NorsokPhDissociationCoefficients>(coeffId).value;
  const temperatureF = kelvinToFahrenheit(temperatureK);
  const exponent =
    c.tkConstant +
    c.tkLinearCoeff * temperatureK -
    c.tkInverseCoeff / temperatureK -
    c.logTkCoeff * Math.log10(temperatureK) +
    c.tkInverseSquaredCoeff / temperatureK ** 2 -
    c.pressurePsiCoeff * totalPressurePsi -
    c.ionicStrengthHalfCoeff * ionicStrengthMolar ** 0.5 +
    c.ionicStrengthCoeff * ionicStrengthMolar -
    c.ionicStrength15Coeff * ionicStrengthMolar ** 1.5 -
    c.ionicStrengthTfCoeff * ionicStrengthMolar * temperatureF;
  return 10 ** -exponent;
}

/** Karbonik asit birinci ayrışma sabiti K1 — Eq.16. */
export function computeCarbonicAcidK1(
  temperatureK: number,
  totalPressurePsi: number,
  ionicStrengthMolar: number,
): number {
  return computeDissociationConstant("norsokPh.k1", temperatureK, totalPressurePsi, ionicStrengthMolar);
}

/** Karbonik asit ikinci ayrışma sabiti K2 — Eq.17. */
export function computeCarbonicAcidK2(
  temperatureK: number,
  totalPressurePsi: number,
  ionicStrengthMolar: number,
): number {
  return computeDissociationConstant("norsokPh.k2", temperatureK, totalPressurePsi, ionicStrengthMolar);
}

/** Suyun ayrışma sabiti Kw — Eq.18 (T: Kelvin, bu oturumda bağımsız olarak doğrulandı). */
export function computeWaterDissociationConstant(temperatureK: number): number {
  const c = getCoefficient<{ constant: number; linearCoeff: number; quadraticCoeff: number }>(
    "norsokPh.waterDissociation",
  ).value;
  const exponent = c.constant - c.linearCoeff * temperatureK + c.quadraticCoeff * temperatureK ** 2;
  return 10 ** -exponent;
}

/** Demir karbonat (FeCO3) çözünürlük çarpımı Ksp — Eq.13 (Tc: °C). */
export function computeIronCarbonateSolubility(temperatureK: number, ionicStrengthMolar: number): number {
  const c = getCoefficient<{ constant: number; tempCoeff: number; ionicHalfCoeff: number; ionicCoeff: number }>(
    "norsokPh.ironCarbonateSolubility",
  ).value;
  const temperatureC = kelvinToCelsius(temperatureK);
  const exponent =
    c.constant +
    c.tempCoeff * temperatureC -
    c.ionicHalfCoeff * ionicStrengthMolar ** 0.5 +
    c.ionicCoeff * ionicStrengthMolar;
  return 10 ** -exponent;
}

/**
 * A·x⁴+x³+C0·x²−B·x−D=0 biçimindeki denklemi Newton-Raphson ile çözer
 * (A=0 iken doygun-olmayan kübik denkleme indirgenir).
 */
function solveHydrogenIonConcentration(a: number, c0: number, b: number, d: number): number {
  const g = (x: number) => a * x ** 4 + x ** 3 + c0 * x ** 2 - b * x - d;
  const gPrime = (x: number) => 4 * a * x ** 3 + 3 * x ** 2 + 2 * c0 * x - b;

  // Dominant-denge başlangıç tahmini: saf CO2/su sisteminde [H+]≈√(KH·K0·K1·fCO2)
  // (B'nin CO2 kaynaklı kısmı Kw'den çok daha büyük olduğunda geçerli bir yaklaşım).
  let x = Math.sqrt(Math.max(b, 1e-20));

  const maxIterations = 200;
  for (let i = 0; i < maxIterations; i += 1) {
    const gx = g(x);
    const dgx = gPrime(x);
    if (dgx === 0) {
      throw new Error("NORSOK pH hesabı: Newton-Raphson türevi sıfırlandı, yakınsama başarısız.");
    }
    const step = gx / dgx;
    x -= step;
    if (x <= 0) {
      x = 1e-14; // fiziksel olmayan bölgeye kaymayı önle, küçük pozitif değere sıfırla
    }
    if (Math.abs(step / x) < 1e-12) {
      return x;
    }
  }
  throw new Error("NORSOK pH hesabı: Newton-Raphson iterasyonu yakınsamadı.");
}

export interface NorsokPhInput {
  /** Akışkan sıcaklığı (K) */
  temperatureK: number;
  /** Toplam basınç (Pa) */
  totalPressurePa: number;
  /** CO2 FUGASİTESİ (Pa) — standart, ham kısmi basınç değil fugasite gerektiğini açıkça belirtir */
  co2FugacityPa: number;
  /** Bikarbonat derişimi (mg/L), organik asit düzeltmesi UYGULANMADAN ÖNCE */
  bicarbonateMgL: number;
  /** Organik asit (ör. asetik asit) derişimi (mg/L) — bikarbonat düzeltmesi için, yoksa 0 */
  organicAcidMgL?: number;
  /** İyonik kuvvet (molar) — verilmezse chlorideMgL'den tahmin edilir */
  ionicStrengthMolar?: number;
  /** Klorür derişimi (mg/L) — ionicStrengthMolar verilmemişse kullanılır */
  chlorideMgL?: number;
  /** Su, demir karbonat (FeCO3) ile doygun mu — doygunsa Eq.12 (kuartik), değilse Eq.11 (kübik) kullanılır */
  isWaterFeSaturated: boolean;
}

export interface NorsokPhResult {
  pH: number;
  hydrogenIonConcentrationMolar: number;
  ionicStrengthMolarUsed: number;
  equilibriumConstants: {
    kH: number;
    k0: number;
    k1: number;
    k2: number;
    kW: number;
    kSp: number | null;
  };
  confidence: ConfidenceLevel;
  sourcesUsed: string[];
  validityWarnings: ValidityWarning[];
}

/**
 * NORSOK M-506 Bölüm 8.2 modeliyle in-situ pH'ı gaz/su kimyasından hesaplar.
 *
 * Model adı: NORSOK M-506 Rev.2 (2005) Bölüm 8.2.2-8.2.3, Eq.9-18.
 * Girdi/çıktı birimleri: SI (K, Pa) → pH (boyutsuz).
 * Geçerlilik aralığı: bikarbonat 0-20000mg/L, iyonik kuvvet 0-3M.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeNorsokInSituPh(input: NorsokPhInput): NorsokPhResult {
  if (input.temperatureK <= 0 || input.totalPressurePa <= 0) {
    throw new Error("Sıcaklık ve basınç pozitif olmalıdır.");
  }
  if (input.co2FugacityPa <= 0) {
    throw new Error("CO2 fugasitesi pozitif olmalıdır (CO2 yoksa pH hesabı anlamsızdır).");
  }
  if (input.bicarbonateMgL < 0) {
    throw new Error("Bikarbonat derişimi negatif olamaz.");
  }
  if (input.ionicStrengthMolar === undefined && input.chlorideMgL === undefined) {
    throw new Error("İyonik kuvvet doğrudan verilmeli veya chlorideMgL sağlanmalıdır.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const ionicStrengthMolar = input.ionicStrengthMolar ?? estimateIonicStrengthMolar(input.chlorideMgL ?? 0);

  const [minIonic, maxIonic] = getCoefficient<[number, number]>("norsokPh.validity.ionicStrengthMolar").value;
  if (ionicStrengthMolar < minIonic || ionicStrengthMolar > maxIonic) {
    validityWarnings.push({
      parameter: "İyonik kuvvet",
      value: ionicStrengthMolar,
      min: minIonic,
      max: maxIonic,
      unit: "M",
      message: `İyonik kuvvet (${ionicStrengthMolar.toFixed(3)}M) NORSOK pH modelinin geçerlilik aralığının (${minIonic}-${maxIonic}M) dışında.`,
    });
  }
  const [minBicarb, maxBicarb] = getCoefficient<[number, number]>("norsokPh.validity.bicarbonateMgL").value;
  if (input.bicarbonateMgL < minBicarb || input.bicarbonateMgL > maxBicarb) {
    validityWarnings.push({
      parameter: "Bikarbonat",
      value: input.bicarbonateMgL,
      min: minBicarb,
      max: maxBicarb,
      unit: "mg/l",
      message: `Bikarbonat derişimi (${input.bicarbonateMgL}mg/L) NORSOK pH modelinin geçerlilik aralığının (${minBicarb}-${maxBicarb}mg/L) dışında.`,
    });
  }

  const correctedBicarbonateMgL = correctBicarbonateForOrganicAcid(
    input.bicarbonateMgL,
    input.organicAcidMgL ?? 0,
  );
  const c0BicarbMolar = correctedBicarbonateMgL / 1000 / BICARBONATE_MOLAR_MASS_G_MOL;

  const totalPressureBar = input.totalPressurePa / PA_PER_BAR;
  const totalPressurePsi = input.totalPressurePa / PA_PER_PSI;
  const co2FugacityBar = input.co2FugacityPa / PA_PER_BAR;

  const kH = computeCo2HenryConstant(input.temperatureK, totalPressureBar, ionicStrengthMolar);
  const k0 = getCoefficient<number>("norsokPh.k0").value;
  const k1 = computeCarbonicAcidK1(input.temperatureK, totalPressurePsi, ionicStrengthMolar);
  const k2 = computeCarbonicAcidK2(input.temperatureK, totalPressurePsi, ionicStrengthMolar);
  const kW = computeWaterDissociationConstant(input.temperatureK);

  const bTerm = kH * k0 * k1 * co2FugacityBar + kW;
  const dTerm = 2 * kH * k0 * k1 * k2 * co2FugacityBar;

  const sourcesUsed = ["norsokPh.henryConstant", "norsokPh.k0", "norsokPh.k1", "norsokPh.k2", "norsokPh.waterDissociation"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("norsokPh.henryConstant").confidence,
    getCoefficient("norsokPh.k0").confidence,
    getCoefficient("norsokPh.k1").confidence,
    getCoefficient("norsokPh.k2").confidence,
    getCoefficient("norsokPh.waterDissociation").confidence,
  ];

  let kSp: number | null = null;
  let aTerm = 0;
  if (input.isWaterFeSaturated) {
    kSp = computeIronCarbonateSolubility(input.temperatureK, ionicStrengthMolar);
    aTerm = (4 * kSp) / dTerm;
    sourcesUsed.push("norsokPh.ironCarbonateSolubility");
    usedConfidences.push(getCoefficient("norsokPh.ironCarbonateSolubility").confidence);
  }

  const hydrogenIonConcentrationMolar = solveHydrogenIonConcentration(aTerm, c0BicarbMolar, bTerm, dTerm);
  const pH = -Math.log10(hydrogenIonConcentrationMolar);

  const confidence = worstConfidence(usedConfidences);
  if (confidence === "UNVERIFIED") {
    validityWarnings.push({
      parameter: "pH hesabı denge sabitleri",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "Bu pH, karbonik asit ayrışma sabitleri K1/K2'nin DOĞRULANAMADIĞI (bkz. registry notu — bağımsız " +
        "fiziksel makullük kontrolü başarısız oldu) bir hesaba dayanıyor. Mümkünse ÖLÇÜLMÜŞ bir pH değeri " +
        "kullanın; bu hesaplanan değeri kullanmadan önce bir korozyon mühendisi tarafından doğrulatın.",
    });
  }

  return {
    pH,
    hydrogenIonConcentrationMolar,
    ionicStrengthMolarUsed: ionicStrengthMolar,
    equilibriumConstants: { kH, k0, k1, k2, kW, kSp },
    confidence,
    sourcesUsed,
    validityWarnings,
  };
}

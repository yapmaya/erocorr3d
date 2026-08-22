// packages/engine/src/corrosion/deWaard.ts
//
// de Waard-Milliams(-Lotz-Dugstad) CO2 korozyon modeli.
//
// Model: log10(Vcor) = 5,8 - 1710/(T+273) + 0,67×log10(pCO2)     (nomogram, 1991 revizyonu)
//        1/Vcor_akış = 1/Vr + 1/Vm                                (Lotz 1990 direnç modeli)
//        Vr = Vnomogram × Fscale × FpH
//        Vm = 2,45×(Usıvı/d)^0,8 × pCO2                           (kütle transferi sınırı)
//        log10(Fscale) = 2400/T - 0,6×log10(fCO2) - 6,7, üst sınır 1
//        FpH = 10^(0,32×(pHsat-pHactual))
//        Fglycol: NORSOK M-506'nın glikol formülü YENİDEN KULLANILIR (bkz. aşağıdaki not)
//        Fcond = 0,1 (varsayılan, 0,1-0,33 arası ayarlanabilir) — serbest su İÇERMEYEN ıslak
//                gaz akışlarında, buhardan yoğuşma ile oluşan korozyon için
//
// Kaynak: temel nomogram bağımsız literatürden (Aalborg Üniversitesi tezi +
// genel mühendislik referans sentezi) doğrulandı. Fscale ve Vm için GERÇEK kaynak
// çatışmaları bulundu, kullanıcı onayıyla üniversite tezi kaynaklı versiyonlar esas alındı.
// Tüm sabitler packages/engine/src/registry/coefficients/deWaard.ts içinde belgelenmiştir.
//
// ⚠ Fglycol NOTU: de Waard'a atfedilen bir glikol formülü (\"Log Fglyc=log(W%)-3\") literatürde
// bulundu ancak (a) birden fazla bağımsız arama SADECE aynı tek belirsiz/garipsi transkripsiyonu
// tekrarladı (gerçek bağımsız doğrulama değil), (b) formül %0 glikolde Fglyc=0,1 vermesi gibi
// FİZİKSEL OLARAK ANLAMSIZ bir sonuç üretiyor (glikol yokken azaltma OLMAMALI, Fglyc=1 olmalı).
// Bu şüpheli sayıyı kullanmak yerine, bu proje NORSOK M-506'nın ZATEN doğrulanmış (HIGH güvenli,
// birincil kaynaktan piksel piksel okunmuş) glikol formülünü (bkz. corrosion/glycolFactor.ts)
// YENİDEN KULLANIR — aynı fiziksel olguyu (glikolün CO2 korozyonunu azaltması) tanımladığı ve
// iki formülün yapısı (log-tabanlı, su/glikol yüzdesine bağlı) çarpıcı derecede benzer olduğu
// için savunulabilir bir mühendislik ikamesidir. Gelecekte gerçek de Waard & Lotz (1993)
// makalesine erişilirse doğrulanmalıdır.
//
// Girdi/çıktı birimleri: SI (K, Pa, m/s, m) dışarıya; formüllerin kendi doğal birimleri
// (°C, bar, MPa) içeride kullanılır.
//
// Geçerlilik aralığı: nomogram düşük CO2 kısmi basınçlarında (<1bar) türetilmiştir (yüksek
// basınçta fugasite düzeltmesi ile telafi edilir); Fscale yalnızca T>~60°C'de anlamlı biçimde
// 1'in altına düşer (düşük T'de zaten ~1'e yakın/üstünde, üst sınır 1 ile kırpılır).
//
// Bilinen sınırlamalar: (1) bu model MUHAFAZAKÂR bir TARAMA aracıdır (bkz. proje talimatı),
// NORSOK M-506'nın yerini almaz; (2) FpH hesaplanırken kullanılan referans pH (pHsat), bu
// projenin norsokPh.ts pH alt-modülünü (K1/K2 için UNVERIFIED, bkz. o dosya) yeniden kullanır —
// bu yüzden pH verilip FpH hesaplandığında sonuç UNVERIFIED confidence taşıyabilir; (3) Vm
// yalnızca sıvı hızı VE boru çapı verildiğinde hesaplanır, verilmezse akış/kütle-transferi
// sınırlaması UYGULANMAZ (Vcor=Vr kabul edilir, bu NON-conservative bir basitleştirmedir).

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type {
  DeWaardFcondConstants,
  DeWaardFscaleConstants,
  DeWaardMassTransferConstants,
  DeWaardNomogramConstants,
} from "../registry/coefficients/deWaard";
import { computeCo2Fugacity } from "./norsok";
import { computeNorsokInSituPh } from "./norsokPh";
import { computeGlycolReductionFactor } from "./glycolFactor";
import { applyInhibitorFloor, hasFreeWater, isDryGas } from "./rules";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";
import { ENGINEERING_DISCLAIMER_TR, type CorrosionRateResult, type ValidityWarning } from "./types";

const PA_PER_BAR = 1e5;
const PA_PER_MPA = 1e6;

/**
 * de Waard-Milliams temel nomogram korozyon hızını hesaplar.
 *
 * Model adı: de Waard-Milliams (1991 revizyonu) nomogram denklemi.
 * Girdi/çıktı birimleri: T (K), pCO2 (Pa) → hız (mm/yıl).
 */
export function computeDeWaardNomogramRateMmPerYear(temperatureK: number, co2FugacityPa: number): number {
  if (temperatureK <= 0) {
    throw new Error("Sıcaklık pozitif olmalıdır.");
  }
  if (co2FugacityPa <= 0) {
    throw new Error("CO2 fugasitesi pozitif olmalıdır.");
  }
  const c = getCoefficient<DeWaardNomogramConstants>("deWaard.nomogram").value;
  const temperatureC = temperatureK - 273.15;
  const co2FugacityBar = co2FugacityPa / PA_PER_BAR;
  const logRate =
    c.constantA -
    c.temperatureCoefficientB / (temperatureC + c.celsiusToKelvinOffset) +
    c.pressureExponentC * Math.log10(co2FugacityBar);
  return 10 ** logRate;
}

/**
 * Koruyucu ölçek (scale) faktörü Fscale'i hesaplar (üst sınır 1).
 *
 * Model adı: de Waard-Milliams Fscale (Ikeda ve ark. 1984 verisine regresyon).
 * Girdi/çıktı birimleri: T (K), fCO2 (Pa) → boyutsuz (≤1).
 */
export function computeFscale(temperatureK: number, co2FugacityPa: number): number {
  if (temperatureK <= 0 || co2FugacityPa <= 0) {
    throw new Error("Sıcaklık ve CO2 fugasitesi pozitif olmalıdır.");
  }
  const c = getCoefficient<DeWaardFscaleConstants>("deWaard.fscale").value;
  const co2FugacityBar = co2FugacityPa / PA_PER_BAR;
  const logFscale =
    c.temperatureCoefficient / temperatureK - c.fugacityExponent * Math.log10(co2FugacityBar) - c.constant;
  return Math.min(10 ** logFscale, c.maxValue);
}

export interface DeWaardReferencePhResult {
  pH: number;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
}

/**
 * Saf (tampon içermeyen) CO2-doygun suyun referans pH'ını (pHsat) hesaplar —
 * FpH formülünün referans noktasıdır. norsokPh.ts'in pH alt-modülü, sıfır
 * bikarbonat ve ihmal edilebilir iyonik kuvvetle ("saf su" yaklaşıklığı)
 * yeniden kullanılır.
 *
 * ⚠ K1/K2 UNVERIFIED — bkz. corrosion/norsokPh.ts. Bu fonksiyonun sonucu bu
 * yüzden UNVERIFIED confidence taşır.
 */
export function computeDeWaardReferencePh(temperatureK: number, co2FugacityPa: number): DeWaardReferencePhResult {
  const result = computeNorsokInSituPh({
    temperatureK,
    totalPressurePa: co2FugacityPa * 2, // yalnızca geçerlilik-aralığı kontrolü için kaba bir toplam basınç varsayımı
    co2FugacityPa,
    bicarbonateMgL: 0,
    ionicStrengthMolar: 1e-6,
    isWaterFeSaturated: false,
  });
  return {
    pH: result.pH,
    confidence: result.confidence,
    validityWarnings: result.validityWarnings,
    sourcesUsed: result.sourcesUsed,
  };
}

/**
 * pH düzeltme faktörü FpH'yi hesaplar: FpH=10^(k×(pHsat-pHactual)).
 *
 * Model adı: de Waard-Milliams/Lotz FpH.
 * Girdi/çıktı birimleri: pH (boyutsuz) → boyutsuz.
 */
export function computeFpH(pHsat: number, pHactual: number): number {
  const k = getCoefficient<number>("deWaard.fphExponentCoefficient").value;
  return 10 ** (k * (pHsat - pHactual));
}

/**
 * Kütle transferi sınırlı hızı (Vm) hesaplar.
 *
 * Model adı: de Waard-Lotz-Dugstad (1995) kütle transferi terimi.
 * Girdi/çıktı birimleri: U (m/s), d (m), pCO2 (Pa) → hız (mm/yıl).
 */
export function computeMassTransferRateMmPerYear(
  liquidVelocityMs: number,
  pipeInternalDiameterM: number,
  co2PartialPressurePa: number,
): number {
  if (liquidVelocityMs <= 0 || pipeInternalDiameterM <= 0) {
    throw new Error("Sıvı hızı ve boru çapı pozitif olmalıdır.");
  }
  if (co2PartialPressurePa <= 0) {
    throw new Error("CO2 kısmi basıncı pozitif olmalıdır.");
  }
  const c = getCoefficient<DeWaardMassTransferConstants>("deWaard.massTransfer").value;
  const co2PartialPressureMPa = co2PartialPressurePa / PA_PER_MPA;
  return c.leadingConstant * (liquidVelocityMs / pipeInternalDiameterM) ** c.velocityExponent * co2PartialPressureMPa;
}

/**
 * Yoğuşma faktörünü (Fcond) döndürür — varsayılan 0,1, kullanıcı 0,1-0,33
 * arasında elle ayarlayabilir (manuel override).
 */
export function computeFcond(override?: number): number {
  const c = getCoefficient<DeWaardFcondConstants>("deWaard.fcond").value;
  const value = override ?? c.defaultValue;
  if (value < c.minValue || value > c.maxValue) {
    throw new Error(`Yoğuşma faktörü (Fcond) ${c.minValue}-${c.maxValue} aralığında olmalıdır.`);
  }
  return value;
}

export interface DeWaardInput {
  /** Akışkan sıcaklığı (K) */
  temperatureK: number;
  /** Toplam basınç (Pa) */
  totalPressurePa: number;
  /** CO2 kısmi basıncı, gaz fazında (Pa) */
  co2PartialPressurePa: number;
  /** Ölçülmüş/varsayılan gerçek pH — verilmezse FpH=1 kabul edilir (nomogramın kendi baz koşulu) */
  pH?: number;
  /** Sıvı film hızı (m/s) — Vm hesabı için; verilmezse akış/kütle-transferi sınırlaması uygulanmaz */
  liquidVelocityMs?: number;
  /** Boru iç çapı (m) — Vm hesabı için */
  pipeInternalDiameterM?: number;
  /** Glikol ağırlık yüzdesi (%) — verilirse NORSOK glikol formülü uygulanır (bkz. dosya başı notu) */
  glycolWeightPercent?: number;
  /** Bu senaryo, SERBEST SU İÇERMEYEN, buhardan yoğuşan ıslak gaz akışı mı (Fcond uygulanır) */
  isCondensationOnlyScenario: boolean;
  /** Fcond için manuel override (0,1-0,33) — verilmezse varsayılan 0,1 kullanılır */
  condensationFactorOverride?: number;
  waterDewPointK: number;
  waterCutPercent: number;
  condensationExpected: boolean;
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

/**
 * de Waard-Milliams(-Lotz-Dugstad) CO2 korozyon hızını hesaplar.
 *
 * Model adı: de Waard-Milliams (1991) nomogram + Lotz (1990) direnç modeli.
 * Girdi/çıktı birimleri: SI (K, Pa, m/s, m) → hız (mm/yıl).
 * Geçerlilik aralığı: bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu — bu MUHAFAZAKÂR bir TARAMA
 * modelidir, NORSOK M-506'nın yerini almaz.
 */
export function computeDeWaardRate(input: DeWaardInput): CorrosionRateResult {
  const isDryGasFlow = isDryGas(input.temperatureK - 273.15, input.waterDewPointK - 273.15);
  if (isDryGasFlow) {
    return zeroResult("Akışkan kuru gaz kabul edildi; CO2 korozyonu oluşmaz.");
  }
  const freeWaterPresent = hasFreeWater({
    isDryGasFlow,
    waterCutPercent: input.waterCutPercent,
    condensationExpected: input.condensationExpected,
  });
  if (!freeWaterPresent) {
    return zeroResult("Serbest su bulunmuyor; CO2 korozyonu oluşmaz.");
  }
  if (input.co2PartialPressurePa <= 0) {
    return zeroResult("CO2 kısmi basıncı 0; CO2 korozyon mekanizması devre dışı.");
  }

  const totalPressureBar = input.totalPressurePa / PA_PER_BAR;
  const co2PartialPressureBar = input.co2PartialPressurePa / PA_PER_BAR;
  const co2FugacityBar = computeCo2Fugacity(co2PartialPressureBar, totalPressureBar, input.temperatureK);
  const co2FugacityPa = co2FugacityBar * PA_PER_BAR;

  const sourcesUsed = new Set<string>([
    "deWaard.nomogram",
    "norsok.fugacity.pressureCoefficient",
    "norsok.fugacity.temperatureCoefficient",
    "norsok.fugacity.pressureCapBar",
  ]);
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("deWaard.nomogram").confidence];

  const nomogramRate = computeDeWaardNomogramRateMmPerYear(input.temperatureK, co2FugacityPa);
  const fScale = computeFscale(input.temperatureK, co2FugacityPa);
  sourcesUsed.add("deWaard.fscale");
  usedConfidences.push(getCoefficient("deWaard.fscale").confidence);

  let fPh = 1;
  const validityWarnings: ValidityWarning[] = [];
  if (input.pH !== undefined) {
    const ref = computeDeWaardReferencePh(input.temperatureK, co2FugacityPa);
    fPh = computeFpH(ref.pH, input.pH);
    sourcesUsed.add("deWaard.fphExponentCoefficient");
    usedConfidences.push(getCoefficient("deWaard.fphExponentCoefficient").confidence);
    ref.sourcesUsed.forEach((id) => sourcesUsed.add(id));
    usedConfidences.push(ref.confidence);
    validityWarnings.push(...ref.validityWarnings);
  }

  const vr = nomogramRate * fScale * fPh;

  let vcor = vr;
  if (input.liquidVelocityMs !== undefined && input.pipeInternalDiameterM !== undefined) {
    const vm = computeMassTransferRateMmPerYear(
      input.liquidVelocityMs,
      input.pipeInternalDiameterM,
      input.co2PartialPressurePa,
    );
    vcor = 1 / (1 / vr + 1 / vm);
    sourcesUsed.add("deWaard.massTransfer");
    sourcesUsed.add("deWaard.resistanceModelFormula");
    usedConfidences.push(getCoefficient("deWaard.massTransfer").confidence);
    usedConfidences.push(getCoefficient("deWaard.resistanceModelFormula").confidence);
  } else {
    validityWarnings.push({
      parameter: "Sıvı hızı/boru çapı",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "Sıvı film hızı ve/veya boru çapı verilmedi — akış/kütle-transferi sınırlaması (Vm) " +
        "uygulanmadı, yalnızca reaksiyon-kinetiği sınırlı hız (Vr) kullanıldı. Bu, GERÇEK hızdan " +
        "DAHA YÜKSEK (muhafazakâr olmayan yönde) bir tahmine yol açabilir.",
    });
  }

  if (input.glycolWeightPercent !== undefined && input.glycolWeightPercent > 0) {
    vcor *= computeGlycolReductionFactor(input.glycolWeightPercent);
    sourcesUsed.add("norsok.glycolFactor");
    usedConfidences.push(getCoefficient("norsok.glycolFactor").confidence);
  }

  if (input.isCondensationOnlyScenario) {
    const fCond = computeFcond(input.condensationFactorOverride);
    vcor *= fCond;
    sourcesUsed.add("deWaard.fcond");
    usedConfidences.push(getCoefficient("deWaard.fcond").confidence);
  }

  const uncertaintyFactor = getCoefficient<number>("uncertainty.defaultMultiplicativeBandFactor").value;
  sourcesUsed.add("uncertainty.defaultMultiplicativeBandFactor");
  usedConfidences.push(getCoefficient("uncertainty.defaultMultiplicativeBandFactor").confidence);
  let band = applyMultiplicativeUncertaintyBand(Math.max(vcor, 0), uncertaintyFactor);

  if (input.inhibited) {
    const efficiency = input.inhibitorEfficiencyPercent ?? 0;
    band = {
      p10: applyInhibitorFloor(band.p10, efficiency),
      p50: applyInhibitorFloor(band.p50, efficiency),
      p90: applyInhibitorFloor(band.p90, efficiency),
    };
    sourcesUsed.add("corrosion.inhibitedResidualRateFloorMmPerYear");
    usedConfidences.push(getCoefficient("corrosion.inhibitedResidualRateFloorMmPerYear").confidence);
  }

  return {
    rateMmPerYear: band,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed: [...sourcesUsed],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

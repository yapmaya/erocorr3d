// packages/engine/src/corrosion/norsok.ts
//
// NORSOK M-506 CO2 iç korozyon hızı modeli.
//
// Model: CRt = Kt × fCO2^0.62 × (S/19)^(0.146 + 0.0324·log10(fCO2)) × f(pH)t
//
// Kaynak: NORSOK Standard M-506, "CO2 Corrosion Rate Calculation Model", Rev. 2,
// Standards Norway, Haziran 2005. Çapraz doğrulama: Nguyen, D., "norsokm506"
// (GitHub, MIT); Mohyaldin, M.E. ve ark., Journal of Engineering Science and
// Technology, Vol.6 No.6 (2011), s.709-719. Tüm sabitlerin tekil kaynak/güven
// bilgisi packages/engine/src/registry/coefficients/norsok.ts içindedir.
//
// Geçerlilik aralığı: T 5-150°C, pH 3.5-6.5, CO2 kısmi basıncı 0.1-10 bar,
// kayma gerilmesi 1-150 Pa (kaynak: Hosseini, S.M.K., 16th Nordic Corrosion
// Congress, 2015, Paper No.24).
//
// Bilinen sınırlamalar: model tek başına H2S etkisini, oil-wetting etkisini,
// glikol/metanol enjeksiyonunu ve top-of-line korozyonu hesaba katmaz.

import { getCoefficient, worstConfidence } from "../registry";
import type { NorsokKtPoint, NorsokPhSegment, NorsokPhTemperatureRow } from "../registry/coefficients/norsok";
import { applyInhibitorFloor, hasFreeWater, isDryGas } from "./rules";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type CorrosionRateResult, type ValidityWarning } from "./types";

export interface NorsokCo2Input {
  /** Akışkan sıcaklığı (K) */
  temperatureK: number;
  /** Toplam basınç (Pa) */
  totalPressurePa: number;
  /** CO2 kısmi basıncı, gaz fazında (Pa) */
  co2PartialPressurePa: number;
  /** Et duvar kayma gerilmesi (Pa) */
  wallShearStressPa: number;
  /** Yerinde (in-situ) pH */
  pH: number;
  /** H2S kısmi basıncı, gaz fazında (Pa); yoksa 0 */
  h2sPartialPressurePa?: number;
  /** Suyun çiy noktası sıcaklığı (K) — kuru gaz kontrolü için */
  waterDewPointK: number;
  /** Sıvı fazdaki su oranı (%) */
  waterCutPercent: number;
  /** Buhardan yoğuşma bekleniyor mu */
  condensationExpected: boolean;
  /** Yoğuşma faktörü Fcond (0-1); yalnızca condensationExpected=true iken kullanılır */
  condensationFactor?: number;
  /** Bu hat açıkça inhibitörlü mü */
  inhibited: boolean;
  /** İnhibitör verimliliği (%0-100); yalnızca inhibited=true iken kullanılır */
  inhibitorEfficiencyPercent?: number;
}

const PA_PER_BAR = 1e5;

function linearInterpolate(points: { x: number; y: number }[], x: number): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const clampedX = Math.min(Math.max(x, sorted[0].x), sorted[sorted.length - 1].x);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    if (clampedX >= lower.x && clampedX <= upper.x) {
      if (upper.x === lower.x) return lower.y;
      const t = (clampedX - lower.x) / (upper.x - lower.x);
      return lower.y + t * (upper.y - lower.y);
    }
  }
  return sorted[sorted.length - 1].y;
}

function interpolateKt(temperatureC: number): number {
  const table = getCoefficient<NorsokKtPoint[]>("norsok.ktTable").value;
  return linearInterpolate(
    table.map((point) => ({ x: point.temperatureC, y: point.kt })),
    temperatureC,
  );
}

/**
 * NORSOK M-506 f(pH) parçalı segmentini (belirli bir sıcaklık satırı için)
 * verilen pH'ta değerlendirir — norsokM506.ts tarafından da (sıcaklık
 * ENTERPOLASYONU YAPMADAN, tam düğüm sıcaklığında) yeniden kullanılır.
 */
export function evaluatePhSegment(segments: NorsokPhSegment[], pH: number): number {
  const clampedPh = Math.min(
    Math.max(pH, segments[0].phMin),
    segments[segments.length - 1].phMax,
  );
  const segment =
    segments.find((s) => clampedPh >= s.phMin && clampedPh <= s.phMax) ??
    segments[segments.length - 1];
  if (segment.kind === "polynomial") {
    return segment.coeffs.reduce((sum, coeff, power) => sum + coeff * clampedPh ** power, 0);
  }
  return segment.a * Math.exp(segment.k * clampedPh);
}

function interpolateFPh(temperatureC: number, pH: number): number {
  const table = getCoefficient<NorsokPhTemperatureRow[]>("norsok.fPhTable").value;
  const sorted = [...table].sort((a, b) => a.temperatureC - b.temperatureC);
  const clampedT = Math.min(
    Math.max(temperatureC, sorted[0].temperatureC),
    sorted[sorted.length - 1].temperatureC,
  );
  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (clampedT >= sorted[i].temperatureC && clampedT <= sorted[i + 1].temperatureC) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }
  const fLower = evaluatePhSegment(lower.segments, pH);
  if (lower.temperatureC === upper.temperatureC) {
    return fLower;
  }
  const fUpper = evaluatePhSegment(upper.segments, pH);
  const t = (clampedT - lower.temperatureC) / (upper.temperatureC - lower.temperatureC);
  return fLower + t * (fUpper - fLower);
}

/**
 * CO2 fugasitesini hesaplar (Eq.4/7/8) — norsokM506.ts tarafından da
 * yeniden kullanılır (tek doğruluk kaynağı, formül burada tek yerde tutulur).
 */
export function computeCo2Fugacity(co2PartialPressureBar: number, totalPressureBar: number, temperatureK: number): number {
  const aCoeff = getCoefficient<number>("norsok.fugacity.pressureCoefficient").value;
  const bCoeff = getCoefficient<number>("norsok.fugacity.temperatureCoefficient").value;
  const capBar = getCoefficient<number>("norsok.fugacity.pressureCapBar").value;
  const effectivePressureBar = Math.min(totalPressureBar, capBar);
  const fugacityCoefficient = 10 ** (effectivePressureBar * (aCoeff - bCoeff / temperatureK));
  return fugacityCoefficient * co2PartialPressureBar;
}

function checkRange(
  parameter: string,
  value: number,
  rangeId: string,
  unit: string,
): ValidityWarning | undefined {
  const range = getCoefficient<[number, number]>(rangeId).value;
  if (value < range[0] || value > range[1]) {
    return {
      parameter,
      value,
      min: range[0],
      max: range[1],
      unit,
      message: `${parameter} değeri (${value} ${unit}) NORSOK M-506 geçerlilik aralığının (${range[0]}-${range[1]} ${unit}) dışında. Hesap yapıldı ancak sonucun güvenilirliği azalmış olabilir.`,
    };
  }
  return undefined;
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
 * NORSOK M-506 CO2 iç korozyon hızını hesaplar.
 *
 * Model adı: NORSOK M-506 (Rev. 2, 2005) CO2 korozyon hızı hesap modeli.
 * Girdi/çıktı birimleri: SI (K, Pa) — dahili olarak modelin tanımlı olduğu
 * °C/bar birimlerine dönüştürülür.
 * Geçerlilik aralığı: bkz. dosya başı yorumu. Aralık dışı girdilerde hesap
 * yapılır, validityWarnings alanına uyarı eklenir.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeNorsokCo2Rate(input: NorsokCo2Input): CorrosionRateResult {
  const isDryGasFlow = isDryGas(input.temperatureK - 273.15, input.waterDewPointK - 273.15);
  if (isDryGasFlow) {
    return zeroResult("Akışkan kuru gaz kabul edildi (sıcaklık, su çiy noktasının ≥10°C üzerinde); CO2 korozyonu oluşmaz.");
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

  const temperatureC = input.temperatureK - 273.15;
  const totalPressureBar = input.totalPressurePa / PA_PER_BAR;
  const co2PartialPressureBar = input.co2PartialPressurePa / PA_PER_BAR;
  const h2sPartialPressureBar = (input.h2sPartialPressurePa ?? 0) / PA_PER_BAR;

  const validityWarnings: ValidityWarning[] = [];
  const push = (w: ValidityWarning | undefined) => {
    if (w) validityWarnings.push(w);
  };
  push(checkRange("Sıcaklık", temperatureC, "norsok.validity.temperatureC", "°C"));
  push(checkRange("pH", input.pH, "norsok.validity.ph", "-"));
  push(
    checkRange(
      "CO2 kısmi basıncı",
      co2PartialPressureBar,
      "norsok.validity.co2PartialPressureBar",
      "bar",
    ),
  );
  push(
    checkRange(
      "Kayma gerilmesi",
      input.wallShearStressPa,
      "norsok.validity.shearStressPa",
      "Pa",
    ),
  );
  if (h2sPartialPressureBar > 0) {
    const h2sMax = getCoefficient<number>("norsok.validity.h2sPartialPressureMaxBar").value;
    if (h2sPartialPressureBar > h2sMax) {
      validityWarnings.push({
        parameter: "H2S kısmi basıncı",
        value: h2sPartialPressureBar,
        min: 0,
        max: h2sMax,
        unit: "bar",
        message: `H2S kısmi basıncı (${h2sPartialPressureBar} bar) NORSOK M-506'nın CO2-baskın kabul üst sınırının (${h2sMax} bar) üzerinde. H2S korozyon mekanizması ayrıca değerlendirilmelidir.`,
      });
    }
    const ratio = co2PartialPressureBar / h2sPartialPressureBar;
    const ratioMin = getCoefficient<number>("norsok.validity.co2H2sRatioMin").value;
    if (ratio < ratioMin) {
      validityWarnings.push({
        parameter: "CO2/H2S oranı",
        value: ratio,
        min: ratioMin,
        max: Infinity,
        unit: "-",
        message: `ppCO2/ppH2S oranı (${ratio.toFixed(1)}) NORSOK M-506'nın CO2-baskın varsayım sınırının (${ratioMin}) altında. Model bu koşulda güvenilir olmayabilir.`,
      });
    }
  }

  const fCo2 = computeCo2Fugacity(co2PartialPressureBar, totalPressureBar, input.temperatureK);
  const kt = interpolateKt(temperatureC);
  const fPh = interpolateFPh(temperatureC, input.pH);
  const co2Exponent = getCoefficient<number>("norsok.mainEquation.co2FugacityExponent").value;
  const shearBaseExponent = getCoefficient<number>(
    "norsok.mainEquation.shearStressBaseExponent",
  ).value;
  const shearFco2Coeff = getCoefficient<number>(
    "norsok.mainEquation.shearStressFco2Coefficient",
  ).value;
  const referenceShearStressPa = getCoefficient<number>(
    "norsok.mainEquation.referenceShearStressPa",
  ).value;

  const shearStressExponent = shearBaseExponent + shearFco2Coeff * Math.log10(fCo2);
  let baseRateMmPerYear =
    kt *
    fCo2 ** co2Exponent *
    (input.wallShearStressPa / referenceShearStressPa) ** shearStressExponent *
    fPh;

  const sourcesUsed = [
    "norsok.ktTable",
    "norsok.fPhTable",
    "norsok.mainEquation.co2FugacityExponent",
    "norsok.mainEquation.shearStressBaseExponent",
    "norsok.mainEquation.shearStressFco2Coefficient",
    "norsok.mainEquation.referenceShearStressPa",
    "norsok.fugacity.pressureCoefficient",
    "norsok.fugacity.temperatureCoefficient",
    "norsok.fugacity.pressureCapBar",
  ];

  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("norsok.ktTable").confidence,
    getCoefficient("norsok.fPhTable").confidence,
    getCoefficient("norsok.mainEquation.co2FugacityExponent").confidence,
    getCoefficient("norsok.fugacity.pressureCapBar").confidence,
  ];

  const isCondensationOnly = !input.condensationExpected ? false : input.waterCutPercent <= 0;
  if (isCondensationOnly) {
    const condensationFactor = input.condensationFactor ?? 1;
    if (condensationFactor < 0 || condensationFactor > 1) {
      throw new Error("Yoğuşma faktörü (Fcond) 0 ile 1 arasında olmalıdır.");
    }
    baseRateMmPerYear *= condensationFactor;
  }

  const uncertaintyFactor = getCoefficient<number>(
    "uncertainty.defaultMultiplicativeBandFactor",
  ).value;
  sourcesUsed.push("uncertainty.defaultMultiplicativeBandFactor");
  usedConfidences.push(getCoefficient("uncertainty.defaultMultiplicativeBandFactor").confidence);

  let band = applyMultiplicativeUncertaintyBand(baseRateMmPerYear, uncertaintyFactor);

  if (input.inhibited) {
    const efficiency = input.inhibitorEfficiencyPercent ?? 0;
    band = {
      p10: applyInhibitorFloor(band.p10, efficiency),
      p50: applyInhibitorFloor(band.p50, efficiency),
      p90: applyInhibitorFloor(band.p90, efficiency),
    };
    sourcesUsed.push("corrosion.inhibitedResidualRateFloorMmPerYear");
    usedConfidences.push(
      getCoefficient("corrosion.inhibitedResidualRateFloorMmPerYear").confidence,
    );
  }

  return {
    rateMmPerYear: band,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

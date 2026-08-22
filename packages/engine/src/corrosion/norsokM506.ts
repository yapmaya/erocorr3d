// packages/engine/src/corrosion/norsokM506.ts
//
// NORSOK M-506 Rev.2 (2005) CO2 iç korozyon hızı modeli — TAM sürüm.
//
// ⚠ İLİŞKİ NOTU: packages/engine/src/corrosion/norsok.ts (önceki oturumda
// yazılmış, hâlâ geçerli/test edilmiş, kendi bağımsız referans implementasyon
// karşılaştırmasına sahip bir modül) BİLEREK DEĞİŞTİRİLMEDİ. Bu dosya onun
// YERİNE GEÇEN, DAHA TAM bir modeldir: (1) pH ölçülmemişse gaz/su
// kimyasından hesaplayabilir (corrosion/norsokPh.ts), (2) glikol azaltma
// faktörünü uygular (corrosion/glycolFactor.ts), (3) standardın GERÇEK
// 3-formlu ana denklemini (Eq.1/2/3, sıcaklık düğümüne göre DEĞİŞEN fCO2
// üssü ve kayma gerilmesi teriminin varlığı) ve HIZ ENTERPOLASYONUNU (Kt
// enterpolasyonu DEĞİL) doğru şekilde uygular — bkz.
// registry/coefficients/norsok.ts::norsok.mainEquation.temperatureNodes
// notları, norsok.ts'in bu inceliği basitleştirdiği açıkça belgelenmiştir,
// (4) her adımı calculationTrace'e yazar, (5) Zod ile girdi doğrulaması
// yapar.
//
// Model bileşenleri (standardın kendi bölüm numaraları):
//   Bölüm 8.1: CO2 fugasitesi (Eq.4-8)
//   Bölüm 8.2: pH (verilmemişse, Eq.9-18 — bkz. norsokPh.ts, ⚠ K1/K2
//              UNVERIFIED, bkz. o modülün başlık yorumu)
//   Bölüm 5.2: ana denklem (Eq.1-3, Tablo 1-2)
//   Bölüm 5.3: glikol azaltma faktörü + inhibitör/glikol birleşim kuralı
//
// Kaynak: NORSOK Standard M-506, Rev. 2, Haziran 2005 — bu oturumda tam
// metin doğrudan indirilip pdftotext VE 200-400dpi sayfa görüntüleri olarak
// render edilip PİKSEL PİKSEL doğrulandı. Tüm sabitler
// packages/engine/src/registry/coefficients/norsok.ts VE norsokPh.ts
// içinde belgelenmiştir.
//
// Girdi/çıktı birimleri: SI (K, Pa) — dahili olarak modelin tanımlı olduğu
// °C/bar/psi birimlerine dönüştürülür.
//
// Geçerlilik aralığı: T 5-150°C, pH 3.5-6.5, fCO2 0.1-10bar, kayma gerilmesi
// 1-150Pa (aralık dışında hesap yapılır, validityWarnings eklenir). Ayrıca:
// organik asit derişimi >100ppm VEYA fCO2<0,5bar ise model hızı olduğundan
// düşük tahmin edebilir (Hosseini 2015).
//
// Bilinen sınırlamalar: (1) yalnızca CO2 baskın korozyonu kapsar (H2S/O2
// etkileri dahil değildir — standardın kendi ifadesi); (2) pH hesaplama
// alt-modülü K1/K2 için UNVERIFIED durumdadır (bkz. norsokPh.ts); (3) duvar
// kayma gerilmesi doğrudan girdi olarak alınır — fluids/friction.ts
// (Colebrook-White/Churchill, Darcy tabanlı) veya NORSOK'un kendi dahili
// basitleştirilmiş formülü (Eq.20-21, bu oturumda bulundu ama KAPSAM DIŞI
// bırakıldı) ile hesaplanabilir; (4) glikol tipine (MEG/DEG/TEG) göre ayrım
// yapılmaz (standardın kendi basitleştirmesi).

import { z } from "zod";
import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { NorsokKtPoint, NorsokMainEquationNode, NorsokPhTemperatureRow } from "../registry/coefficients/norsok";
import type { Mitigation } from "../types/mitigation";
import type { OperatingCase } from "../types/operating";
import { computeCo2Fugacity, evaluatePhSegment } from "./norsok";
import { computeNorsokInSituPh } from "./norsokPh";
import { computeGlycolReductionFactor } from "./glycolFactor";
import { hasFreeWater, isDryGas } from "./rules";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "./types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import type { TraceStep } from "../types/results";

const PA_PER_BAR = 1e5;

// ─────────────────────────────────────────────────────────────────────────
// Zod girdi şeması
// ─────────────────────────────────────────────────────────────────────────

export const NorsokM506InputSchema = z
  .object({
    temperatureK: z.number().positive().describe("Akışkan sıcaklığı (K)"),
    totalPressurePa: z.number().positive().describe("Toplam basınç (Pa)"),
    co2PartialPressurePa: z.number().min(0).describe("CO2 kısmi basıncı, gaz fazında (Pa)"),
    h2sPartialPressurePa: z.number().min(0).optional().describe("H2S kısmi basıncı, gaz fazında (Pa)"),
    wallShearStressPa: z
      .number()
      .min(0)
      .describe("Et duvar kayma gerilmesi (Pa) — fluids/friction.ts veya NORSOK Eq.20-21 ile hesaplanabilir"),

    waterDewPointK: z.number().describe("Suyun çiy noktası sıcaklığı (K)"),
    waterCutPercent: z.number().min(0).max(100).describe("Sıvı fazdaki su oranı (%)"),
    condensationExpected: z.boolean().describe("Buhardan yoğuşma bekleniyor mu"),
    condensationFactor: z.number().min(0).max(1).optional().describe("Yoğuşma faktörü Fcond (0-1)"),

    pH: z.number().min(0).max(14).optional().describe("Ölçülmüş in-situ pH — verilmezse kimyadan hesaplanır"),
    bicarbonateMgL: z.number().min(0).optional().describe("pH hesabı için bikarbonat derişimi (mg/L)"),
    ionicStrengthMolar: z.number().min(0).optional().describe("pH hesabı için iyonik kuvvet (M)"),
    chlorideMgL: z.number().min(0).optional().describe("pH hesabı için klorür derişimi (mg/L) — iyonik kuvvet tahmini"),
    organicAcidMgL: z.number().min(0).optional().describe("Organik asit (ör. asetik asit) derişimi (mg/L)"),
    isWaterFeSaturated: z.boolean().optional().describe("Su, FeCO3 ile doygun mu (pH hesabı için)"),

    glycolWeightPercent: z.number().min(0).max(100).optional().describe("Glikol ağırlık yüzdesi (%)"),

    inhibited: z.boolean().describe("Bu hat açıkça inhibitörlü mü"),
    inhibitorEfficiencyPercent: z.number().min(0).max(100).optional().describe("İnhibitör verimliliği (%)"),
    inhibitorAvailabilityPercent: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("İnhibitör kullanılabilirlik/erişilebilirlik oranı (%) — verilmezse %100 kabul edilir"),
  })
  .describe("NORSOK M-506 CO2 korozyon hızı hesabı girdisi")
  .superRefine((data, ctx) => {
    if (data.pH === undefined) {
      if (data.bicarbonateMgL === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bicarbonateMgL"],
          message: "pH verilmemişse (kimyadan hesaplanacaksa) bicarbonateMgL zorunludur.",
        });
      }
      if (data.ionicStrengthMolar === undefined && data.chlorideMgL === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ionicStrengthMolar"],
          message: "pH verilmemişse ionicStrengthMolar veya chlorideMgL sağlanmalıdır.",
        });
      }
      if (data.isWaterFeSaturated === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["isWaterFeSaturated"],
          message: "pH verilmemişse isWaterFeSaturated (demir karbonat doygunluğu) belirtilmelidir.",
        });
      }
    }
    if (data.inhibited && data.inhibitorEfficiencyPercent === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inhibitorEfficiencyPercent"],
        message: "inhibited=true iken inhibitorEfficiencyPercent zorunludur.",
      });
    }
  });

export type NorsokM506Input = z.infer<typeof NorsokM506InputSchema>;

/**
 * `(Mitigation, OperatingCase, wallShearStressPa)` üçlüsünden bir
 * `NorsokM506Input` inşa eder — `orchestrate/mechanismRunners.ts::
 * runCo2AndTlcMechanisms`'in NORSOK_M506 dalıyla TEK doğruluk kaynağıdır
 * (mechanismRunners.ts bu fonksiyonu ÇAĞIRIR, mantığı TEKRARLAMAZ).
 * `wallShearStressPa` ayrı bir parametre olarak alınır çünkü de Waard
 * dalı da AYNI değeri paylaşır (bkz. mechanismRunners.ts::
 * computeSharedWallShearStressPa) — burada TEKRAR hesaplanmaz.
 *
 * Bu fonksiyon ayrıca `features/results/` (apps/web) altındaki Tornado/
 * Monte Carlo sarmalayıcılarının GERÇEK motor girdisini üretmek için
 * kullandığı köprüdür — o kod bu fonksiyonu DOĞRUDAN çağırır, kendi
 * basitleştirilmiş bir kopyasını İCAT ETMEZ.
 */
export function buildNorsokM506InputFromCase(
  mitigation: Mitigation,
  operatingCase: OperatingCase,
  wallShearStressPa: number,
): NorsokM506Input {
  const { process, chemistry } = operatingCase;
  const temperatureK = process.temperatureC + 273.15;
  const totalPressurePa = process.pressureBara * 1e5;
  const co2PartialPressurePa = (chemistry.co2MolePercent / 100) * totalPressurePa;
  const h2sPartialPressurePa = (chemistry.h2sPpmMole / 1e6) * totalPressurePa;
  const waterDewPointK = process.waterDewpointC + 273.15;
  const phMeasured = chemistry.phMeasured;

  return {
    temperatureK,
    totalPressurePa,
    co2PartialPressurePa,
    h2sPartialPressurePa,
    wallShearStressPa,
    waterDewPointK,
    waterCutPercent: process.waterCutPercent,
    condensationExpected: !process.isFreeWaterPresent,
    // pH ASLA dışarıdan önceden hesaplanıp zorlanmaz (bkz. computeSharedInSituPh'in kendi notu) —
    // yalnızca GERÇEKTEN ÖLÇÜLMÜŞ bir pH (chemistry.phMeasured, şema tarafından zaten [0,14] garanti
    // edilir) doğrudan geçirilir; aksi halde NORSOK kendi GÜVENLİ (Zod'un pH aralığı doğrulamasına tabi
    // OLMAYAN, çünkü dahili hesaplanan bir değer) pH alt-modelini kendisi çalıştırır.
    pH: phMeasured,
    bicarbonateMgL: phMeasured === undefined ? chemistry.bicarbonateMgL : undefined,
    ionicStrengthMolar: undefined,
    chlorideMgL: phMeasured === undefined ? chemistry.chlorideMgL : undefined,
    isWaterFeSaturated: phMeasured === undefined ? chemistry.isWaterFeSaturated : undefined,
    glycolWeightPercent: chemistry.glycolWeightPercent > 0 ? chemistry.glycolWeightPercent : undefined,
    inhibited: mitigation.inhibitorUsed,
    inhibitorEfficiencyPercent: mitigation.inhibitorEfficiencyPercent,
    inhibitorAvailabilityPercent: mitigation.inhibitorAvailabilityPercent,
  };
}

export type NorsokM506ReductionSource = "NONE" | "GLYCOL" | "INHIBITOR";

export interface NorsokM506Result {
  rateMmPerYear: UncertaintyBand;
  confidence: ConfidenceLevel;
  phUsed: number;
  phWasCalculated: boolean;
  glycolFactorApplied: number | null;
  appliedReduction: NorsokM506ReductionSource;
  validityWarnings: ValidityWarning[];
  calculationTrace: TraceStep[];
  sourcesUsed: string[];
  disclaimer: string;
}

function checkRange(parameter: string, value: number, rangeId: string, unit: string): ValidityWarning | undefined {
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

function zeroResult(reason: string, trace: TraceStep[]): NorsokM506Result {
  trace.push({
    stepName: "Erken sonlandırma",
    formula: "CRt = 0",
    inputs: {},
    output: 0,
    unit: "mm/yıl",
    coefficientIds: [],
  });
  return {
    rateMmPerYear: { p10: 0, p50: 0, p90: 0 },
    confidence: "HIGH",
    phUsed: NaN,
    phWasCalculated: false,
    glycolFactorApplied: null,
    appliedReduction: "NONE",
    validityWarnings: [],
    calculationTrace: trace,
    sourcesUsed: [],
    disclaimer: `${reason} ${ENGINEERING_DISCLAIMER_TR}`,
  };
}

/**
 * Belirli bir sıcaklık DÜĞÜMÜNDE (enterpolasyonsuz, tam eşleşme), o düğümün
 * KENDİ doğru denklem biçimiyle (Eq.1, Eq.2 veya Eq.3) korozyon hızını
 * hesaplar.
 */
function computeRateAtTemperatureNode(
  nodeTemperatureC: number,
  fCo2Bar: number,
  wallShearStressPa: number,
  pH: number,
): number {
  const nodes = getCoefficient<NorsokMainEquationNode[]>("norsok.mainEquation.temperatureNodes").value;
  const node = nodes.find((n) => n.temperatureC === nodeTemperatureC);
  if (!node) {
    throw new Error(`"${nodeTemperatureC}°C" için NORSOK ana denklem düğümü bulunamadı.`);
  }
  const ktTable = getCoefficient<NorsokKtPoint[]>("norsok.ktTable").value;
  const ktRow = ktTable.find((r) => r.temperatureC === nodeTemperatureC);
  if (!ktRow) {
    throw new Error(`"${nodeTemperatureC}°C" için Kt değeri bulunamadı.`);
  }
  const phTable = getCoefficient<NorsokPhTemperatureRow[]>("norsok.fPhTable").value;
  const phRow = phTable.find((r) => r.temperatureC === nodeTemperatureC);
  if (!phRow) {
    throw new Error(`"${nodeTemperatureC}°C" için f(pH) tablosu bulunamadı.`);
  }
  const fPh = evaluatePhSegment(phRow.segments, pH);

  if (!node.includesShearStressTerm) {
    return ktRow.kt * fCo2Bar ** node.co2FugacityExponent * fPh;
  }
  const shearBaseExponent = getCoefficient<number>("norsok.mainEquation.shearStressBaseExponent").value;
  const shearFco2Coeff = getCoefficient<number>("norsok.mainEquation.shearStressFco2Coefficient").value;
  const referenceShearStressPa = getCoefficient<number>("norsok.mainEquation.referenceShearStressPa").value;
  const shearStressExponent = shearBaseExponent + shearFco2Coeff * Math.log10(fCo2Bar);
  return (
    ktRow.kt *
    fCo2Bar ** node.co2FugacityExponent *
    (wallShearStressPa / referenceShearStressPa) ** shearStressExponent *
    fPh
  );
}

/**
 * NORSOK M-506 Rev.2 (2005) CO2 iç korozyon hızını hesaplar — TAM sürüm
 * (pH alt-modeli, glikol, izlenebilirlik dahil).
 *
 * Model adı: NORSOK M-506 (Rev. 2, 2005) CO2 korozyon hızı hesap modeli.
 * Girdi/çıktı birimleri: SI (K, Pa) → hız (mm/yıl).
 * Geçerlilik aralığı: bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeNorsokM506Rate(rawInput: NorsokM506Input): NorsokM506Result {
  const input = NorsokM506InputSchema.parse(rawInput);
  const trace: TraceStep[] = [];

  const isDryGasFlow = isDryGas(input.temperatureK - 273.15, input.waterDewPointK - 273.15);
  if (isDryGasFlow) {
    return zeroResult(
      "Akışkan kuru gaz kabul edildi (sıcaklık, su çiy noktasının ≥10°C üzerinde); CO2 korozyonu oluşmaz.",
      trace,
    );
  }
  const freeWaterPresent = hasFreeWater({
    isDryGasFlow,
    waterCutPercent: input.waterCutPercent,
    condensationExpected: input.condensationExpected,
  });
  if (!freeWaterPresent) {
    return zeroResult("Serbest su bulunmuyor; CO2 korozyonu oluşmaz.", trace);
  }
  if (input.co2PartialPressurePa <= 0) {
    return zeroResult("CO2 kısmi basıncı 0; CO2 korozyon mekanizması devre dışı.", trace);
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
  push(checkRange("CO2 kısmi basıncı", co2PartialPressureBar, "norsok.validity.co2PartialPressureBar", "bar"));
  push(checkRange("Kayma gerilmesi", input.wallShearStressPa, "norsok.validity.shearStressPa", "Pa"));

  const organicAcidMgL = input.organicAcidMgL ?? 0;
  const organicAcidThresholdPpm = getCoefficient<number>("norsok.validity.organicAcidThresholdPpm").value;
  const lowCo2ThresholdBar = getCoefficient<number>("norsok.validity.lowCo2PressureWarningThresholdBar").value;
  if (organicAcidMgL > organicAcidThresholdPpm) {
    validityWarnings.push({
      parameter: "Organik asit derişimi",
      value: organicAcidMgL,
      min: 0,
      max: organicAcidThresholdPpm,
      unit: "ppm",
      message: `Organik asit derişimi (${organicAcidMgL}ppm) ${organicAcidThresholdPpm}ppm eşiğinin üzerinde — model korozyon hızını OLDUĞUNDAN DÜŞÜK tahmin edebilir (Hosseini 2015).`,
    });
  }
  if (co2PartialPressureBar < lowCo2ThresholdBar) {
    validityWarnings.push({
      parameter: "CO2 kısmi basıncı (düşük-fCO2 uyarısı)",
      value: co2PartialPressureBar,
      min: lowCo2ThresholdBar,
      max: Infinity,
      unit: "bar",
      message: `CO2 kısmi basıncı (${co2PartialPressureBar}bar) ${lowCo2ThresholdBar}bar eşiğinin altında — model korozyon hızını OLDUĞUNDAN DÜŞÜK tahmin edebilir (Hosseini 2015).`,
    });
  }
  if (h2sPartialPressureBar > 0) {
    const h2sMax = getCoefficient<number>("norsok.validity.h2sPartialPressureMaxBar").value;
    if (h2sPartialPressureBar > h2sMax) {
      validityWarnings.push({
        parameter: "H2S kısmi basıncı",
        value: h2sPartialPressureBar,
        min: 0,
        max: h2sMax,
        unit: "bar",
        message: `H2S kısmi basıncı (${h2sPartialPressureBar} bar) NORSOK M-506'nın CO2-baskın kabul üst sınırının (${h2sMax} bar) üzerinde.`,
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
        message: `ppCO2/ppH2S oranı (${ratio.toFixed(1)}) NORSOK M-506'nın CO2-baskın varsayım sınırının (${ratioMin}) altında.`,
      });
    }
  }

  const sourcesUsed = new Set<string>([
    "norsok.fugacity.pressureCoefficient",
    "norsok.fugacity.temperatureCoefficient",
    "norsok.fugacity.pressureCapBar",
    "norsok.mainEquation.temperatureNodes",
    "norsok.ktTable",
    "norsok.fPhTable",
  ]);
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("norsok.fugacity.pressureCapBar").confidence,
    getCoefficient("norsok.mainEquation.temperatureNodes").confidence,
    getCoefficient("norsok.ktTable").confidence,
    getCoefficient("norsok.fPhTable").confidence,
  ];

  const fCo2Bar = computeCo2Fugacity(co2PartialPressureBar, totalPressureBar, input.temperatureK);
  trace.push({
    stepName: "CO2 fugasitesi",
    formula: "fCO2 = a(P,T) × pCO2",
    inputs: { co2PartialPressureBar, totalPressureBar, temperatureK: input.temperatureK },
    output: fCo2Bar,
    unit: "bar",
    coefficientIds: ["norsok.fugacity.pressureCoefficient", "norsok.fugacity.temperatureCoefficient", "norsok.fugacity.pressureCapBar"],
  });

  // --- pH belirleme ---
  let pH: number;
  let phWasCalculated = false;
  if (input.pH !== undefined) {
    pH = input.pH;
  } else {
    phWasCalculated = true;
    const phResult = computeNorsokInSituPh({
      temperatureK: input.temperatureK,
      totalPressurePa: input.totalPressurePa,
      co2FugacityPa: fCo2Bar * PA_PER_BAR,
      bicarbonateMgL: input.bicarbonateMgL as number,
      organicAcidMgL,
      ionicStrengthMolar: input.ionicStrengthMolar,
      chlorideMgL: input.chlorideMgL,
      isWaterFeSaturated: input.isWaterFeSaturated as boolean,
    });
    pH = phResult.pH;
    validityWarnings.push(...phResult.validityWarnings);
    usedConfidences.push(phResult.confidence);
    phResult.sourcesUsed.forEach((id) => sourcesUsed.add(id));
    trace.push({
      stepName: "pH hesabı (gaz/su kimyasından)",
      formula: "NORSOK M-506 Eq.11/12 (Newton-Raphson)",
      inputs: {
        bicarbonateMgL: input.bicarbonateMgL as number,
        ionicStrengthMolarUsed: phResult.ionicStrengthMolarUsed,
        co2FugacityBar: fCo2Bar,
      },
      output: pH,
      unit: "-",
      coefficientIds: phResult.sourcesUsed,
    });
  }
  push(checkRange("pH", pH, "norsok.validity.ph", "-"));

  // --- ana denklem: sıcaklık düğümleri arasında hız enterpolasyonu ---
  const nodes = getCoefficient<NorsokMainEquationNode[]>("norsok.mainEquation.temperatureNodes").value;
  const sortedTemps = [...nodes.map((n) => n.temperatureC)].sort((a, b) => a - b);
  const clampedTempC = Math.min(Math.max(temperatureC, sortedTemps[0]), sortedTemps[sortedTemps.length - 1]);

  let lowerTemp = sortedTemps[0];
  let upperTemp = sortedTemps[sortedTemps.length - 1];
  for (let i = 0; i < sortedTemps.length - 1; i += 1) {
    if (clampedTempC >= sortedTemps[i] && clampedTempC <= sortedTemps[i + 1]) {
      lowerTemp = sortedTemps[i];
      upperTemp = sortedTemps[i + 1];
      break;
    }
  }

  const rateLower = computeRateAtTemperatureNode(lowerTemp, fCo2Bar, input.wallShearStressPa, pH);
  trace.push({
    stepName: `Sıcaklık düğümü ${lowerTemp}°C hızı`,
    formula: "Eq.1/2/3 (düğüme özgü biçim)",
    inputs: { fCo2Bar, wallShearStressPa: input.wallShearStressPa, pH },
    output: rateLower,
    unit: "mm/yıl",
    coefficientIds: ["norsok.ktTable", "norsok.fPhTable", "norsok.mainEquation.temperatureNodes"],
  });

  let baseRateMmPerYear = rateLower;
  if (upperTemp !== lowerTemp) {
    const rateUpper = computeRateAtTemperatureNode(upperTemp, fCo2Bar, input.wallShearStressPa, pH);
    trace.push({
      stepName: `Sıcaklık düğümü ${upperTemp}°C hızı`,
      formula: "Eq.1/2/3 (düğüme özgü biçim)",
      inputs: { fCo2Bar, wallShearStressPa: input.wallShearStressPa, pH },
      output: rateUpper,
      unit: "mm/yıl",
      coefficientIds: ["norsok.ktTable", "norsok.fPhTable", "norsok.mainEquation.temperatureNodes"],
    });
    const t = (clampedTempC - lowerTemp) / (upperTemp - lowerTemp);
    baseRateMmPerYear = rateLower + t * (rateUpper - rateLower);
    trace.push({
      stepName: "Sıcaklıklar arası doğrusal enterpolasyon (HIZ üzerinde, Kt üzerinde DEĞİL)",
      formula: `CR = CR(${lowerTemp}°C) + t×(CR(${upperTemp}°C)-CR(${lowerTemp}°C))`,
      inputs: { lowerTemp, upperTemp, clampedTempC, t },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: [],
    });
  }

  // --- belirsizlik bandı (asimetrik varsayılan) ---
  const { p10Multiplier, p90Multiplier } = getCoefficient<{ p10Multiplier: number; p90Multiplier: number }>(
    "norsokM506.uncertaintyBand",
  ).value;
  sourcesUsed.add("norsokM506.uncertaintyBand");
  usedConfidences.push(getCoefficient("norsokM506.uncertaintyBand").confidence);
  const band: UncertaintyBand = {
    p10: baseRateMmPerYear * p10Multiplier,
    p50: baseRateMmPerYear,
    p90: baseRateMmPerYear * p90Multiplier,
  };
  trace.push({
    stepName: "Belirsizlik bandı",
    formula: "P10=0,5×P50, P90=2,5×P50",
    inputs: { p50: baseRateMmPerYear },
    output: band.p90,
    unit: "mm/yıl",
    coefficientIds: ["norsokM506.uncertaintyBand"],
  });

  // --- glikol / inhibitör: hangisi varsa VE ikisi de varsa daha büyük azaltmayı veren ---
  const glycolWeightPercent = input.glycolWeightPercent ?? 0;
  const glycolApplicable = glycolWeightPercent > 0;
  const inhibitorApplicable = input.inhibited;

  let glycolFactorApplied: number | null = null;
  let appliedReduction: NorsokM506ReductionSource = "NONE";
  let finalBand = band;

  const applyGlycol = (rate: number, factor: number): number => rate * factor;
  const applyInhibitor = (rate: number, efficiencyPercent: number, availabilityPercent: number, floor: number): number =>
    Math.max(rate * (1 - (efficiencyPercent / 100) * (availabilityPercent / 100)), floor);

  if (glycolApplicable || inhibitorApplicable) {
    const glycolFactor = glycolApplicable ? computeGlycolReductionFactor(glycolWeightPercent) : null;
    const efficiency = input.inhibitorEfficiencyPercent ?? 0;
    const availability = input.inhibitorAvailabilityPercent ?? 100;
    const floor = getCoefficient<number>("corrosion.inhibitedResidualRateFloorMmPerYear").value;

    const glycolP50 = glycolFactor !== null ? applyGlycol(band.p50, glycolFactor) : Number.POSITIVE_INFINITY;
    const inhibitorP50 = inhibitorApplicable ? applyInhibitor(band.p50, efficiency, availability, floor) : Number.POSITIVE_INFINITY;

    if (glycolFactor !== null && (!inhibitorApplicable || glycolP50 <= inhibitorP50)) {
      appliedReduction = "GLYCOL";
      glycolFactorApplied = glycolFactor;
      finalBand = {
        p10: applyGlycol(band.p10, glycolFactor),
        p50: glycolP50,
        p90: applyGlycol(band.p90, glycolFactor),
      };
      sourcesUsed.add("norsok.glycolFactor");
      usedConfidences.push(getCoefficient("norsok.glycolFactor").confidence);
    } else if (inhibitorApplicable) {
      appliedReduction = "INHIBITOR";
      finalBand = {
        p10: applyInhibitor(band.p10, efficiency, availability, floor),
        p50: inhibitorP50,
        p90: applyInhibitor(band.p90, efficiency, availability, floor),
      };
      sourcesUsed.add("corrosion.inhibitedResidualRateFloorMmPerYear");
      usedConfidences.push(getCoefficient("corrosion.inhibitedResidualRateFloorMmPerYear").confidence);
    }

    if (glycolApplicable && inhibitorApplicable) {
      sourcesUsed.add("norsok.inhibitorGlycolCombinationRule");
      usedConfidences.push(getCoefficient("norsok.inhibitorGlycolCombinationRule").confidence);
    }

    trace.push({
      stepName: "Glikol/İnhibitör azaltması",
      formula: appliedReduction === "GLYCOL" ? "CR' = CR × glikolFaktörü" : appliedReduction === "INHIBITOR" ? "CR' = max(CR×(1-verim/100×erişilebilirlik/100), taban)" : "CR' = CR",
      inputs: { p50Oncesi: band.p50, glycolP50: glycolFactor !== null ? glycolP50 : NaN, inhibitorP50: inhibitorApplicable ? inhibitorP50 : NaN },
      output: finalBand.p50,
      unit: "mm/yıl",
      coefficientIds: appliedReduction === "GLYCOL" ? ["norsok.glycolFactor"] : appliedReduction === "INHIBITOR" ? ["corrosion.inhibitedResidualRateFloorMmPerYear"] : [],
    });
  }

  return {
    rateMmPerYear: finalBand,
    confidence: worstConfidence(usedConfidences),
    phUsed: pH,
    phWasCalculated,
    glycolFactorApplied,
    appliedReduction,
    validityWarnings,
    calculationTrace: trace,
    sourcesUsed: [...sourcesUsed],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// packages/engine/src/fixtures/referenceFacility.ts
//
// İki hat için örnek (fixture) veri: "Referans Hat 1" ve "Referans Hat 2".
//
// KAYNAK VE DOĞRULUK NOTU (önemli):
// Bu fixture'ların temelini oluşturan belge, kullanıcının kendi iç proje
// dokümanı olup, dosyanın kendi künyesinde bir staj sonu sunum senaryosu
// olarak belirtilmiştir. Yani bu, denetlenmiş/onaylanmış gerçek tesis
// ölçümü DEĞİL, örnek/gösterim amaçlı bir belgedir. Bu fixture'lar bu
// nedenle üretim hesaplarında "doğru cevap" olarak KULLANILMAMALIDIR —
// yalnızca şema doğrulamasını (Zod validation) gerçekçi, tutarlı sayılarla
// test etmek içindir.
//
// Aşağıdaki her blokta hangi sayıların doğrudan kaynak belgeden geldiği ve
// hangilerinin (belgede bulunmayan alanları tamamlamak için) TEMSİLİ/İLLÜSTRATİF
// olduğu ayrı ayrı belirtilmiştir.

import { getCoefficient } from "../registry";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";
import type { Geometry } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import type { OperatingCase, OperatingProfile } from "../types/operating";
import type { MechanismResult } from "../types/results";
import { GeometrySchema } from "../types/geometry";
import { MitigationSchema } from "../types/mitigation";
import { OperatingProfileSchema } from "../types/operating";
import { MechanismResultSchema } from "../types/results";

const SOURCE_CITATION =
  "Kullanıcının kendi iç proje dokümanı (doğrulanmamış staj sonu sunum senaryosu, gerçek tesis ölçümü değildir) — izlenebilirlik amacıyla kimliği paylaşılmıyor.";

// ─────────────────────────────────────────────────────────────────────────
// Referans Hat 1 — Yükleme platformundan ana tesise giriş hattı (ıslak ekşi gaz)
// ─────────────────────────────────────────────────────────────────────────

// Geometri: NPS/schedule/uzunluk kaynak belgede YOK — ASME B36.10 nominal
// boru cetveli tablosundan (tanımsal, KDP kapsamı dışı) 16" STD değerleri
// kullanılarak TEMSİLİ olarak dolduruldu.
const referenceLine1Geometry: Geometry = GeometrySchema.parse({
  componentType: "STRAIGHT_PIPE",
  npsInch: 16, // Temsili — kaynakta belirtilmemiş
  schedule: "STD", // Temsili — kaynakta belirtilmemiş
  odMm: 406.4, // ASME B36.10, NPS16 dış çap (tanımsal tablo değeri)
  wallThicknessMm: 9.53, // ASME B36.10, NPS16 STD et kalınlığı (tanımsal tablo değeri)
  idMm: 406.4 - 2 * 9.53,
  lengthMm: 5000, // Temsili — kaynakta belirtilmemiş
  orientation: "HORIZONTAL",
  roughnessMm: 0.045, // Tipik ticari çelik boru pürüzlülüğü (temsili)
  installation: "BURIED", // Kaynak notu: "Gömülü kısımlar CP ve dış kaplamalıdır."
  isInsulated: false,
  locationClass: 1, // Temsili — kaynakta belirtilmemiş, kırsal/offshore sahası varsayıldı
  environmentalSensitivity: "MEDIUM", // Temsili — kaynakta belirtilmemiş
});

const referenceLine1Mitigation: Mitigation = MitigationSchema.parse({
  inhibitorUsed: true, // Kaynak notu: "Inhibited fluids."
  // Verimlilik, kaynaktaki Cru=0.43 ve Cri=0.148 (mm/yıl) değerlerinden
  // TÜRETİLMİŞTİR: (1 - Cri/Cru) × 100 = %65.58 ≈ %65.6
  inhibitorAvailabilityPercent: 95, // Temsili — kaynakta belirtilmemiş
  inhibitorEfficiencyPercent: 65.6, // Kaynaktan türetilmiş (Cru/Cri oranı)
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  externalCoating: "3LPE", // Yaygın endüstri standart dış kaplama uygulaması (temsili)
  cathodicProtection: true, // Kaynak notu: "CP ve dış kaplamalıdır."
});

function buildOperatingCase(params: {
  name: string;
  description: string;
  durationDaysPerYear: number;
  temperatureC: number;
  waterDewpointC: number;
  isFreeWaterPresent: boolean;
  waterCutPercent: number;
  co2MolePercent: number;
  h2sPpmMole: number;
  waterMassFlowKgS: number;
}): OperatingCase {
  return {
    name: params.name,
    description: params.description,
    durationDaysPerYear: params.durationDaysPerYear,
    process: {
      pressureBara: 70, // Kaynak: enjeksiyon modu için "70 bara" belirtilmiş; çekiş modu için aynı mertebe varsayıldı (temsili)
      temperatureC: params.temperatureC,
      gasMassFlowKgS: 5, // Temsili — kaynakta debi verisi yok
      liquidMassFlowKgS: 0.05, // Temsili
      waterMassFlowKgS: params.waterMassFlowKgS,
      gasDensityKgM3: 60, // Temsili (~70 bara doğal gaz için tipik mertebe)
      liquidDensityKgM3: 900, // Temsili (kondensat/su)
      mixtureDensityKgM3: 62, // Temsili
      gasViscosityPaS: 1.2e-5, // Temsili (tipik doğal gaz viskozitesi mertebesi)
      liquidViscosityPaS: 5e-4, // Temsili
      superficialGasVelocityMs: 8, // Temsili
      superficialLiquidVelocityMs: 0.05, // Temsili
      mixtureVelocityMs: 8.05, // Temsili
      liquidHoldupFraction: 0.02, // Temsili
      flowRegime: "STRATIFIED_WAVY",
      waterCutPercent: params.waterCutPercent,
      waterDewpointC: params.waterDewpointC,
      hydrocarbonDewpointC: -5, // Temsili
      isFreeWaterPresent: params.isFreeWaterPresent,
      ambientTemperatureC: 12, // Temsili (kaynak sahasının kış ortalaması mertebesi)
    },
    chemistry: {
      co2MolePercent: params.co2MolePercent,
      h2sPpmMole: params.h2sPpmMole,
      o2Ppb: 5, // Temsili
      chlorideMgL: params.isFreeWaterPresent ? 50 : 0, // Temsili
      bicarbonateMgL: params.isFreeWaterPresent ? 200 : 0, // Temsili
      totalDissolvedSolidsMgL: params.isFreeWaterPresent ? 500 : 0, // Temsili
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
    },
    solids: {
      sandRateKgDay: 0,
      sandPpmw: 0,
    },
  };
}

const referenceLine1WithdrawalCase = buildOperatingCase({
  name: "Kış Çekiş Modu (Withdrawal)",
  description:
    "Rezervuardan gelen ıslak gaz (kaynak: %1.2171 CO2) korozyon riskini tetikler.",
  durationDaysPerYear: 91, // KAYNAK: "%25 Gaz Çekiş (Withdrawal - 91 Gün)"
  temperatureC: 15, // Temsili
  waterDewpointC: 12, // Temsili — ΔT=3°C, kuru gaz kuralına göre KORUZİF (bkz. corrosion/rules.ts::isDryGas)
  isFreeWaterPresent: true,
  waterCutPercent: 3, // Temsili — kaynakta bu hat için su oranı verilmemiş
  co2MolePercent: 1.2171, // KAYNAK: TOC sayfası
  h2sPpmMole: 15, // Temsili — "Ekşi Gaz (Wet Sour)" niteliğini yansıtmak için
  waterMassFlowKgS: 0.05 * 0.03, // waterCutPercent ile tutarlı temsili değer
});

const referenceLine1InjectionCase = buildOperatingCase({
  name: "Yaz Enjeksiyon Modu (Injection)",
  description:
    "Kurutulmuş kuru gaz (kaynak: -8°C, 70 bara) — korozyon riski sıfırdır.",
  durationDaysPerYear: 274, // KAYNAK: "%75 Gaz Enjeksiyon (Injection - 274 Gün)"
  temperatureC: -8, // KAYNAK: TOC sayfası
  waterDewpointC: -60, // Temsili (kurutulmuş gaz çiy noktası spesifikasyonu mertebesi) — ΔT=52°C ≥10°C → kuru gaz kuralına göre KOROZİF DEĞİL
  isFreeWaterPresent: false,
  waterCutPercent: 0,
  co2MolePercent: 1.2171, // Aynı rezervuar gazı bileşimi varsayıldı (temsili varsayım)
  h2sPpmMole: 15,
  waterMassFlowKgS: 0,
});

export const referenceLine1OperatingProfile: OperatingProfile = OperatingProfileSchema.parse({
  designLifeYears: 30, // KAYNAK: "Tasarım Ömrü: 30 Yıl"
  corrosionAllowanceMm: 3, // KAYNAK: ATL (CA-mm) sütunu
  cases: [referenceLine1WithdrawalCase, referenceLine1InjectionCase],
});

// Kaynak belgenin kendi CTL_i formülü (H6 = 0.25×30×Cri) yeniden üretildi.
// 0.25 katsayısı, çekiş modunun yıllık oranıdır (91/365 ≈ 0.249) — bu proje
// içindeki corrosion/rules.ts::applyPartialOperationFactor kuralının
// kaynak kurumun kendi pratiğiyle örtüştüğünü doğrular.
const referenceLine1CruMmPerYear = 0.43; // KAYNAK: sütun E
const referenceLine1CriMmPerYear = 0.148; // KAYNAK: sütun F
const referenceLine1UncertaintyFactor = getCoefficient<number>(
  "uncertainty.defaultMultiplicativeBandFactor",
).value;
const referenceLine1Band = applyMultiplicativeUncertaintyBand(
  referenceLine1CriMmPerYear,
  referenceLine1UncertaintyFactor,
);

export const referenceLine1DocumentedResult: MechanismResult = MechanismResultSchema.parse({
  mechanismId: "external.reference_facility_de_waard_reference",
  nameTr: "CO2 Korozyonu (kaynak kurumun dahili yazılım referans sonucu)",
  nameEn: "CO2 Corrosion (source organization's internal software reference result)",
  rateMmPerYear: referenceLine1CriMmPerYear,
  rateP10: referenceLine1Band.p10,
  rateP50: referenceLine1Band.p50,
  rateP90: referenceLine1Band.p90,
  isApplicable: true,
  confidence: "LOW",
  modelUsed:
    "Kaynak kurumun dahili kurumsal yazılımı + de Waard et al. metodolojisi (harici; bu projede implemente edilmedi, doğrudan kaynak belgeden alınmıştır)",
  sourceRefs: [SOURCE_CITATION],
  validityWarnings: [
    "Bu sonuç bu projenin NORSOK M-506 motoruyla DEĞİL, kaynak kurumun kendi (doğrulanamayan) dahili yazılımıyla hesaplanmıştır — model karşılaştırması yapılmamıştır.",
    "P10/P90 bandı kaynakta yoktur; bu projenin genel belirsizlik doktrini (uncertainty.defaultMultiplicativeBandFactor, UNVERIFIED) uygulanarak temsili olarak üretilmiştir.",
  ],
  governingParameters: {
    Cru_mmPerYear: referenceLine1CruMmPerYear,
    Cri_mmPerYear: referenceLine1CriMmPerYear,
  },
  spatialSignatureId: "spatial.placeholder.not_generated",
  calculationTrace: [
    {
      stepName: "CTL_i (30 yıllık kalınlık kaybı, inhibitörlü)",
      formula: "CTL_i = 0.25 × tasarım_ömrü_yıl × Cri",
      inputs: { fraction: 0.25, designLifeYears: 30, Cri_mmPerYear: referenceLine1CriMmPerYear },
      output: 0.25 * 30 * referenceLine1CriMmPerYear,
      unit: "mm",
      coefficientIds: [],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────
// Referans Hat 2 — Ayırıcı tepe gazı çıkışı (buhar fazı)
// ─────────────────────────────────────────────────────────────────────────

const referenceLine2Geometry: Geometry = GeometrySchema.parse({
  componentType: "STRAIGHT_PIPE",
  npsInch: 8, // Temsili — kaynakta belirtilmemiş
  schedule: "STD", // Temsili — kaynakta belirtilmemiş
  odMm: 219.1, // ASME B36.10, NPS8 dış çap (tanımsal tablo değeri)
  wallThicknessMm: 8.18, // ASME B36.10, NPS8 STD et kalınlığı (tanımsal tablo değeri)
  idMm: 219.1 - 2 * 8.18,
  lengthMm: 3000, // Temsili — kaynakta belirtilmemiş
  orientation: "VERTICAL_UP", // Ayırıcı tepe (buhar) çıkışı — temsili
  roughnessMm: 0.045, // Tipik ticari çelik boru pürüzlülüğü (temsili)
  installation: "ABOVE_GROUND",
  isInsulated: false,
  locationClass: 1, // Temsili — kaynakta belirtilmemiş, tesis içi saha varsayıldı
  environmentalSensitivity: "MEDIUM", // Temsili — kaynakta belirtilmemiş
});

const referenceLine2Mitigation: Mitigation = MitigationSchema.parse({
  inhibitorUsed: false, // KAYNAK notu: "İnhibitör gaz fazına taşınmaz." (Cru=Cri=0.46 ile tutarlı)
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  cathodicProtection: false, // Yer üstü tesis içi hat
});

// 0.277 m3/gün serbest su (KAYNAK) → kg/s'ye çevrildi
// (su yoğunluğu ~1000 kg/m3 varsayımıyla, tanımsal dönüşüm):
const referenceLine2WaterMassFlowKgS = (0.277 * 1000) / 86400;

const referenceLine2WithdrawalCase = buildOperatingCase({
  name: "Kış Çekiş Modu (Withdrawal)",
  description: "Islak gaz + 0.277 m³/gün serbest su (kaynak belgeden).",
  durationDaysPerYear: 91, // KAYNAK: TOC sayfası
  temperatureC: 15, // Temsili
  waterDewpointC: 12, // Temsili — ΔT=3°C, korozif
  isFreeWaterPresent: true,
  // waterCutPercent, gerçek su debisinden (0.277 m3/gün) ve temsili sıvı
  // debisinden (0.05 kg/s) türetilmiştir: waterMassFlow/(waterMassFlow+liquidMassFlow)×100
  waterCutPercent:
    (referenceLine2WaterMassFlowKgS / (referenceLine2WaterMassFlowKgS + 0.05)) * 100,
  co2MolePercent: 1.2171, // Aynı rezervuar gazı bileşimi varsayıldı (temsili varsayım)
  h2sPpmMole: 0, // Kaynak bu hattı "Ekşi Gaz" değil "Islak Gaz" olarak nitelendiriyor
  waterMassFlowKgS: referenceLine2WaterMassFlowKgS,
});

const referenceLine2InjectionCase = buildOperatingCase({
  name: "Yaz Enjeksiyon Modu (Injection)",
  description: "Kurutulmuş kuru gaz — korozyon riski sıfırdır (temsili varsayım, bu hat için kaynakta ayrıca belirtilmemiştir).",
  durationDaysPerYear: 274,
  temperatureC: -8,
  waterDewpointC: -60,
  isFreeWaterPresent: false,
  waterCutPercent: 0,
  co2MolePercent: 1.2171,
  h2sPpmMole: 0,
  waterMassFlowKgS: 0,
});

export const referenceLine2OperatingProfile: OperatingProfile = OperatingProfileSchema.parse({
  designLifeYears: 30, // KAYNAK: "Tasarım Ömrü: 30 Yıl"
  corrosionAllowanceMm: 6, // KAYNAK: ATL (CA-mm) sütunu ("Sözleşme gereği CA=6.0 mm")
  cases: [referenceLine2WithdrawalCase, referenceLine2InjectionCase],
});

const referenceLine2CruMmPerYear = 0.46; // KAYNAK: sütun E
const referenceLine2CriMmPerYear = 0.46; // KAYNAK: sütun F (inhibitör etkisi yok)
const referenceLine2UncertaintyFactor = getCoefficient<number>(
  "uncertainty.defaultMultiplicativeBandFactor",
).value;
const referenceLine2Band = applyMultiplicativeUncertaintyBand(
  referenceLine2CriMmPerYear,
  referenceLine2UncertaintyFactor,
);

export const referenceLine2DocumentedResult: MechanismResult = MechanismResultSchema.parse({
  mechanismId: "external.reference_facility_de_waard_reference",
  nameTr: "CO2 Korozyonu (kaynak kurumun dahili yazılım referans sonucu)",
  nameEn: "CO2 Corrosion (source organization's internal software reference result)",
  rateMmPerYear: referenceLine2CriMmPerYear,
  rateP10: referenceLine2Band.p10,
  rateP50: referenceLine2Band.p50,
  rateP90: referenceLine2Band.p90,
  isApplicable: true,
  confidence: "LOW",
  modelUsed:
    "Kaynak kurumun dahili kurumsal yazılımı + de Waard et al. metodolojisi (harici; bu projede implemente edilmedi, doğrudan kaynak belgeden alınmıştır)",
  sourceRefs: [SOURCE_CITATION],
  validityWarnings: [
    "Bu sonuç bu projenin NORSOK M-506 motoruyla DEĞİL, kaynak kurumun kendi (doğrulanamayan) dahili yazılımıyla hesaplanmıştır — model karşılaştırması yapılmamıştır.",
    "P10/P90 bandı kaynakta yoktur; bu projenin genel belirsizlik doktrini (uncertainty.defaultMultiplicativeBandFactor, UNVERIFIED) uygulanarak temsili olarak üretilmiştir.",
    "İnhibitör gaz fazına taşınmadığından (kaynak notu) bu hatta inhibitör faydası uygulanmamıştır.",
  ],
  governingParameters: {
    Cru_mmPerYear: referenceLine2CruMmPerYear,
    Cri_mmPerYear: referenceLine2CriMmPerYear,
  },
  spatialSignatureId: "spatial.placeholder.not_generated",
  calculationTrace: [
    {
      stepName: "CTL_i (30 yıllık kalınlık kaybı, inhibitörsüz)",
      formula: "CTL_i = 0.25 × tasarım_ömrü_yıl × Cri",
      inputs: { fraction: 0.25, designLifeYears: 30, Cri_mmPerYear: referenceLine2CriMmPerYear },
      output: 0.25 * 30 * referenceLine2CriMmPerYear,
      unit: "mm",
      coefficientIds: [],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────
// Toplu erişim
// ─────────────────────────────────────────────────────────────────────────

export interface ReferenceFacilityStreamFixture {
  streamId: string;
  descriptionTr: string;
  geometry: Geometry;
  mitigation: Mitigation;
  operatingProfile: OperatingProfile;
  documentedResult: MechanismResult;
}

export const referenceLine1: ReferenceFacilityStreamFixture = {
  streamId: "Reference Line 1",
  descriptionTr: "Yükleme platformundan ana tesise giriş hattı",
  geometry: referenceLine1Geometry,
  mitigation: referenceLine1Mitigation,
  operatingProfile: referenceLine1OperatingProfile,
  documentedResult: referenceLine1DocumentedResult,
};

export const referenceLine2: ReferenceFacilityStreamFixture = {
  streamId: "Reference Line 2",
  descriptionTr: "Ayırıcı Tepe Gazı Çıkışı (Vapour)",
  geometry: referenceLine2Geometry,
  mitigation: referenceLine2Mitigation,
  operatingProfile: referenceLine2OperatingProfile,
  documentedResult: referenceLine2DocumentedResult,
};

export const REFERENCE_FACILITY_FIXTURES: ReferenceFacilityStreamFixture[] = [referenceLine1, referenceLine2];

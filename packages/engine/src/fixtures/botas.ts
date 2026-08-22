// packages/engine/src/fixtures/botas.ts
//
// BOTAŞ Silivri Faz III (Kuzey Marmara Yeraltı Doğal Gaz Depolama Tevsii)
// projesine ait iki hat için örnek (fixture) veri: "Stream 1030" ve
// "Stream 1130".
//
// KAYNAK VE DOĞRULUK NOTU (önemli):
// Bu fixture'ların temelini oluşturan belge — BOTAS_Silivri_Faz_III_Korozyon_
// Matrisi.xlsx ("Boru Hatları Analizi" sayfası, satır 6 ve 11) — dosyanın
// kendi künyesinde "Hazırlayan: BOTAŞ Silivri İşletme Müdürlüğü Stajyeri"
// olarak belirtilmiştir ve eşlik eden botas-silivri-korozyon-sunum-rehberi.md
// bir STAJ SONU SUNUM SENARYOSUDUR. Yani bu, denetlenmiş/onaylanmış gerçek
// tesis ölçümü DEĞİL, örnek/gösterim amaçlı bir belgedir. Bu fixture'lar bu
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
  "BOTAS_Silivri_Faz_III_Korozyon_Matrisi.xlsx, sayfa \"Boru Hatları Analizi\" (kullanıcı bilgisayarındaki İndirilenler klasörü; doğrulanmamış stajyer belgesi, gerçek tesis ölçümü değildir).";

// ─────────────────────────────────────────────────────────────────────────
// Stream 1030 — DP-2 Platformundan KMGS'ye Giriş Hattı (Islak Ekşi Gaz)
// ─────────────────────────────────────────────────────────────────────────

// Geometri: NPS/schedule/uzunluk kaynak belgede YOK — ASME B36.10 nominal
// boru cetveli tablosundan (tanımsal, KDP kapsamı dışı) 16" STD değerleri
// kullanılarak TEMSİLİ olarak dolduruldu.
const stream1030Geometry: Geometry = GeometrySchema.parse({
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
});

const stream1030Mitigation: Mitigation = MitigationSchema.parse({
  inhibitorUsed: true, // Kaynak notu: "Inhibited fluids."
  // Verimlilik, kaynaktaki Cru=0.43 ve Cri=0.148 (mm/yıl) değerlerinden
  // TÜRETİLMİŞTİR: (1 - Cri/Cru) × 100 = %65.58 ≈ %65.6
  inhibitorAvailabilityPercent: 95, // Temsili — kaynakta belirtilmemiş
  inhibitorEfficiencyPercent: 65.6, // Kaynaktan türetilmiş (Cru/Cri oranı)
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  externalCoating: "3LPE", // BOTAŞ standart dış kaplama uygulaması (eşlik eden sunum rehberinden)
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
      ambientTemperatureC: 12, // Temsili (Silivri, kış ortalaması mertebesi)
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

const stream1030WithdrawalCase = buildOperatingCase({
  name: "Kış Çekiş Modu (Withdrawal)",
  description:
    "Rezervuardan gelen ıslak gaz (kaynak: %1.2171 CO2) korozyon riskini tetikler.",
  durationDaysPerYear: 91, // KAYNAK: "%25 Gaz Çekiş (Withdrawal - 91 Gün)"
  temperatureC: 15, // Temsili
  waterDewpointC: 12, // Temsili — ΔT=3°C, kuru gaz kuralına göre KORUZİF (bkz. corrosion/rules.ts::isDryGas)
  isFreeWaterPresent: true,
  waterCutPercent: 3, // Temsili — kaynakta stream 1030 için su oranı verilmemiş
  co2MolePercent: 1.2171, // KAYNAK: TOC sayfası
  h2sPpmMole: 15, // Temsili — "Ekşi Gaz (Wet Sour)" niteliğini yansıtmak için
  waterMassFlowKgS: 0.05 * 0.03, // waterCutPercent ile tutarlı temsili değer
});

const stream1030InjectionCase = buildOperatingCase({
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

export const stream1030OperatingProfile: OperatingProfile = OperatingProfileSchema.parse({
  designLifeYears: 30, // KAYNAK: "Tasarım Ömrü: 30 Yıl"
  corrosionAllowanceMm: 3, // KAYNAK: ATL (CA-mm) sütunu, satır 6
  cases: [stream1030WithdrawalCase, stream1030InjectionCase],
});

// Kaynak belgenin kendi CTL_i formülü (H6 = 0.25×30×Cri) yeniden üretildi.
// 0.25 katsayısı, çekiş modunun yıllık oranıdır (91/365 ≈ 0.249) — bu proje
// içindeki corrosion/rules.ts::applyPartialOperationFactor kuralının
// BOTAŞ'ın kendi pratiğiyle örtüştüğünü doğrular.
const stream1030CruMmPerYear = 0.43; // KAYNAK: sütun E, satır 6
const stream1030CriMmPerYear = 0.148; // KAYNAK: sütun F, satır 6
const stream1030UncertaintyFactor = getCoefficient<number>(
  "uncertainty.defaultMultiplicativeBandFactor",
).value;
const stream1030Band = applyMultiplicativeUncertaintyBand(
  stream1030CriMmPerYear,
  stream1030UncertaintyFactor,
);

export const stream1030DocumentedResult: MechanismResult = MechanismResultSchema.parse({
  mechanismId: "external.botas_ece_dewaard_reference",
  nameTr: "CO2 Korozyonu (BOTAŞ dahili ECE Yazılımı referans sonucu)",
  nameEn: "CO2 Corrosion (BOTAŞ internal ECE Software reference result)",
  rateMmPerYear: stream1030CriMmPerYear,
  rateP10: stream1030Band.p10,
  rateP50: stream1030Band.p50,
  rateP90: stream1030Band.p90,
  isApplicable: true,
  confidence: "LOW",
  modelUsed:
    "BOTAŞ dahili ECE Yazılımı + de Waard et al. metodolojisi (harici; bu projede implemente edilmedi, doğrudan kaynak belgeden alınmıştır)",
  sourceRefs: [SOURCE_CITATION],
  validityWarnings: [
    "Bu sonuç bu projenin NORSOK M-506 motoruyla DEĞİL, BOTAŞ'ın kendi (doğrulanamayan) ECE Yazılımı ile hesaplanmıştır — model karşılaştırması yapılmamıştır.",
    "P10/P90 bandı kaynakta yoktur; bu projenin genel belirsizlik doktrini (uncertainty.defaultMultiplicativeBandFactor, UNVERIFIED) uygulanarak temsili olarak üretilmiştir.",
  ],
  governingParameters: {
    Cru_mmPerYear: stream1030CruMmPerYear,
    Cri_mmPerYear: stream1030CriMmPerYear,
  },
  spatialSignatureId: "spatial.placeholder.not_generated",
  calculationTrace: [
    {
      stepName: "CTL_i (30 yıllık kalınlık kaybı, inhibitörlü)",
      formula: "CTL_i = 0.25 × tasarım_ömrü_yıl × Cri",
      inputs: { fraction: 0.25, designLifeYears: 30, Cri_mmPerYear: stream1030CriMmPerYear },
      output: 0.25 * 30 * stream1030CriMmPerYear,
      unit: "mm",
      coefficientIds: [],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────
// Stream 1130 — NSP Slugcatcher Tepe Gazı Çıkışı (Vapour)
// ─────────────────────────────────────────────────────────────────────────

const stream1130Geometry: Geometry = GeometrySchema.parse({
  componentType: "STRAIGHT_PIPE",
  npsInch: 8, // Temsili — kaynakta belirtilmemiş
  schedule: "STD", // Temsili — kaynakta belirtilmemiş
  odMm: 219.1, // ASME B36.10, NPS8 dış çap (tanımsal tablo değeri)
  wallThicknessMm: 8.18, // ASME B36.10, NPS8 STD et kalınlığı (tanımsal tablo değeri)
  idMm: 219.1 - 2 * 8.18,
  lengthMm: 3000, // Temsili — kaynakta belirtilmemiş
  orientation: "VERTICAL_UP", // Slugcatcher tepe (vapour) çıkışı — temsili
  roughnessMm: 0.045, // Tipik ticari çelik boru pürüzlülüğü (temsili)
  installation: "ABOVE_GROUND",
  isInsulated: false,
});

const stream1130Mitigation: Mitigation = MitigationSchema.parse({
  inhibitorUsed: false, // KAYNAK notu: "İnhibitör gaz fazına taşınmaz." (Cru=Cri=0.46 ile tutarlı)
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  cathodicProtection: false, // Yer üstü tesis içi hat
});

// 0.277 m3/gün serbest su (KAYNAK, sütun D, satır 11) → kg/s'ye çevrildi
// (su yoğunluğu ~1000 kg/m3 varsayımıyla, tanımsal dönüşüm):
const stream1130WaterMassFlowKgS = (0.277 * 1000) / 86400;

const stream1130WithdrawalCase = buildOperatingCase({
  name: "Kış Çekiş Modu (Withdrawal)",
  description: "Islak gaz + 0.277 m³/gün serbest su (kaynak, satır 11).",
  durationDaysPerYear: 91, // KAYNAK: TOC sayfası
  temperatureC: 15, // Temsili
  waterDewpointC: 12, // Temsili — ΔT=3°C, korozif
  isFreeWaterPresent: true,
  // waterCutPercent, gerçek su debisinden (0.277 m3/gün) ve temsili sıvı
  // debisinden (0.05 kg/s) türetilmiştir: waterMassFlow/(waterMassFlow+liquidMassFlow)×100
  waterCutPercent:
    (stream1130WaterMassFlowKgS / (stream1130WaterMassFlowKgS + 0.05)) * 100,
  co2MolePercent: 1.2171, // Aynı rezervuar gazı bileşimi varsayıldı (temsili varsayım)
  h2sPpmMole: 0, // Kaynak bu hattı "Ekşi Gaz" değil "Islak Gaz" olarak nitelendiriyor
  waterMassFlowKgS: stream1130WaterMassFlowKgS,
});

const stream1130InjectionCase = buildOperatingCase({
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

export const stream1130OperatingProfile: OperatingProfile = OperatingProfileSchema.parse({
  designLifeYears: 30, // KAYNAK: "Tasarım Ömrü: 30 Yıl"
  corrosionAllowanceMm: 6, // KAYNAK: ATL (CA-mm) sütunu, satır 11 ("Sözleşme gereği CA=6.0 mm")
  cases: [stream1130WithdrawalCase, stream1130InjectionCase],
});

const stream1130CruMmPerYear = 0.46; // KAYNAK: sütun E, satır 11
const stream1130CriMmPerYear = 0.46; // KAYNAK: sütun F, satır 11 (inhibitör etkisi yok)
const stream1130UncertaintyFactor = getCoefficient<number>(
  "uncertainty.defaultMultiplicativeBandFactor",
).value;
const stream1130Band = applyMultiplicativeUncertaintyBand(
  stream1130CriMmPerYear,
  stream1130UncertaintyFactor,
);

export const stream1130DocumentedResult: MechanismResult = MechanismResultSchema.parse({
  mechanismId: "external.botas_ece_dewaard_reference",
  nameTr: "CO2 Korozyonu (BOTAŞ dahili ECE Yazılımı referans sonucu)",
  nameEn: "CO2 Corrosion (BOTAŞ internal ECE Software reference result)",
  rateMmPerYear: stream1130CriMmPerYear,
  rateP10: stream1130Band.p10,
  rateP50: stream1130Band.p50,
  rateP90: stream1130Band.p90,
  isApplicable: true,
  confidence: "LOW",
  modelUsed:
    "BOTAŞ dahili ECE Yazılımı + de Waard et al. metodolojisi (harici; bu projede implemente edilmedi, doğrudan kaynak belgeden alınmıştır)",
  sourceRefs: [SOURCE_CITATION],
  validityWarnings: [
    "Bu sonuç bu projenin NORSOK M-506 motoruyla DEĞİL, BOTAŞ'ın kendi (doğrulanamayan) ECE Yazılımı ile hesaplanmıştır — model karşılaştırması yapılmamıştır.",
    "P10/P90 bandı kaynakta yoktur; bu projenin genel belirsizlik doktrini (uncertainty.defaultMultiplicativeBandFactor, UNVERIFIED) uygulanarak temsili olarak üretilmiştir.",
    "İnhibitör gaz fazına taşınmadığından (kaynak notu) bu hatta inhibitör faydası uygulanmamıştır.",
  ],
  governingParameters: {
    Cru_mmPerYear: stream1130CruMmPerYear,
    Cri_mmPerYear: stream1130CriMmPerYear,
  },
  spatialSignatureId: "spatial.placeholder.not_generated",
  calculationTrace: [
    {
      stepName: "CTL_i (30 yıllık kalınlık kaybı, inhibitörsüz)",
      formula: "CTL_i = 0.25 × tasarım_ömrü_yıl × Cri",
      inputs: { fraction: 0.25, designLifeYears: 30, Cri_mmPerYear: stream1130CriMmPerYear },
      output: 0.25 * 30 * stream1130CriMmPerYear,
      unit: "mm",
      coefficientIds: [],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────
// Toplu erişim
// ─────────────────────────────────────────────────────────────────────────

export interface BotasStreamFixture {
  streamId: string;
  descriptionTr: string;
  geometry: Geometry;
  mitigation: Mitigation;
  operatingProfile: OperatingProfile;
  documentedResult: MechanismResult;
}

export const botasStream1030: BotasStreamFixture = {
  streamId: "Stream 1030",
  descriptionTr: "DP-2 Platformundan KMGS'ye Giriş Hattı",
  geometry: stream1030Geometry,
  mitigation: stream1030Mitigation,
  operatingProfile: stream1030OperatingProfile,
  documentedResult: stream1030DocumentedResult,
};

export const botasStream1130: BotasStreamFixture = {
  streamId: "Stream 1130",
  descriptionTr: "NSP Slugcatcher Tepe Gazı Çıkışı (Vapour)",
  geometry: stream1130Geometry,
  mitigation: stream1130Mitigation,
  operatingProfile: stream1130OperatingProfile,
  documentedResult: stream1130DocumentedResult,
};

export const BOTAS_FIXTURES: BotasStreamFixture[] = [botasStream1030, botasStream1130];

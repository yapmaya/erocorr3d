// packages/engine/src/fixtures/botasPss0002ValidationData.ts
//
// packages/engine/tests/validation/ paketinin DOĞRULAMA VERİSİ — motorun,
// gerçek bir BOTAŞ mühendislik dokümanının yayımlanmış sonuçlarını ne kadar
// yakın ürettiğini kanıtlamak için kullanılan referans tablolar + bu
// tabloları üretmek için motoru çalıştıracak temsili (representative)
// Geometry/Mitigation/OperatingCase girdileri.
//
// KAYNAK (birincil): BOTAŞ, "Corrosion Assessment and Materials Selection
// Onshore (KMGS&NSP)", Doküman No: F3-500-ME-SPC-PSS-0002, Rev. AE
// (18.08.2021), KOLIN-Kalyon-PSE Engineering GmbH JV — kullanıcının
// /home/aliattar/İndirilenler/F3-500-ME-SPC-PSS-0002_AE.pdf dosyası.
//   - Appendix A "CO2 Corrosion Calculations Results (mm/year) — Onshore
//     NSP Piping" (s.53-55): akış bazlı, HMB senaryosu bazlı korozyon hızları.
//   - Table 10-1 "Operating Cases Evaluated" (s.24): çekiş (withdrawal)
//     senaryolarının doğal gaz yüzdesi, mol %CO2 ve süresi (gün).
//   - Table 10-3 "Corrosion Evaluation Results for Process Piping" (s.29):
//     SLC (mm) ve ATL/CTL oranı.
// Bu dosyanın kendisi bu belgeden BİREBİR okunan sayısal DEĞERLERİ (referans
// hızlar, CO2 mol%'leri, süreler) taşır — bunlar KDP anlamında doğrulanmış
// (HIGH confidence, PROJECT_DOCUMENT) veridir, çünkü doğrudan bir denetimli
// mühendislik dokümanından transkribe edilmiştir.
//
// ÖNEMLİ SINIRLAMA (dürüstlük notu — Belirsizlik Dürüstlüğü kuralı):
// Appendix A yalnızca ÇIKTI (korozyon hızı) verir; motorun NORSOK M-506/de
// Waard hesaplarını çalıştırmak için gereken GİRDİ (her akışın sıcaklığı,
// basıncı, hızı) ayrı bir dokümanda yaşar: "F3-000-PR-RPT-HMB-0001, Heat
// and Material Balance" — bu dosya, F3-000-PR-RPT-PDE-0001_AD.pdf'in Ref.9
// listesinde adı geçer ama kullanıcının diskinde BULUNAMADI. Bu yüzden
// aşağıdaki Geometry/OperatingCase alanlarının çoğu (sıcaklık, basınç, hız,
// yoğunluk...) TEMSİLİDİR — yalnızca CO2 mol%'si (Table 10-1'den, GERÇEK) ve
// ıslak/kuru sınıflandırması (Table 10-3'ün kendi "Comment" sütunundan,
// GERÇEK) dokümana dayanır. Bu nedenle testler ±%30 toleransla "metodoloji
// doğru yönde mi" sorusunu doğrular, bit-bit aynı sayı üretimini DEĞİL.
//
// Cru TÜRETİMİ NOTU: Table 10-3'ün SLC(0.25×30×Cru) sütunu, Appendix A'daki
// YEDİ HMB-senaryosu sütununun (W1A/W1A37C/W2/W3A/W3B/W5A/W5B) EN YÜKSEĞİNİ
// (en muhafazakâr/"governing" senaryo) kullanır — bu, s.55'teki "The most
// restrictive result... was used" notuyla VE iki bağımsız örnekte (1030:
// max(0.31,0.27,0.43,0.41,0.41,0.35,0.34)=0.43 → 0.25×30×0.43=3.225mm TAM
// eşleşme; 1130: max(...)=0.46 → 0.25×30×0.46=3.45mm TAM eşleşme) sayısal
// olarak doğrulanmıştır — uydurulmamış, iki bağımsız hesapla teyit edilmiştir.

import { runMechanismAssessment } from "../orchestrate/assessComponent";
import type { Geometry } from "../types/geometry";
import { GeometrySchema } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import { MitigationSchema } from "../types/mitigation";
import type { OperatingCase } from "../types/operating";
import { OperatingCaseSchema } from "../types/operating";

export const PSS0002_CITATION =
  "BOTAŞ, \"Corrosion Assessment and Materials Selection Onshore (KMGS&NSP)\", " +
  "Doküman No: F3-500-ME-SPC-PSS-0002, Rev. AE (18.08.2021), KOLIN-Kalyon-PSE Engineering GmbH JV.";

// ─────────────────────────────────────────────────────────────────────────
// Table 10-1 — Değerlendirilen İşletme Senaryoları (s.24) — BİREBİR
// ─────────────────────────────────────────────────────────────────────────

export interface NativeGasCase {
  /** Doğal gaz yüzdesi (Table 10-1'in "Native Gas (%)" sütunu) */
  nativeGasPercent: 10 | 30 | 60;
  /** Mol %CO2 (Table 10-1'in "Mol %CO2" sütunu) — GERÇEK, kaynaktan */
  co2MolePercent: number;
  /** Süre, gün (Table 10-1'in "Duration (Days)" sütunu) — GERÇEK, kaynaktan */
  durationDays: number;
  /** Appendix A'daki karşılık gelen sütun adı (W1A/W3A/W5A) */
  appendixAColumn: "W1A" | "W3A" | "W5A";
}

export const NATIVE_GAS_CASES: NativeGasCase[] = [
  { nativeGasPercent: 10, co2MolePercent: 0.199, durationDays: 28.4, appendixAColumn: "W1A" },
  { nativeGasPercent: 30, co2MolePercent: 0.425, durationDays: 44.6, appendixAColumn: "W3A" },
  { nativeGasPercent: 60, co2MolePercent: 0.764, durationDays: 18, appendixAColumn: "W5A" },
];

// ─────────────────────────────────────────────────────────────────────────
// Appendix A (s.53) — yalnızca ISLAK GAZ akışları (Table 10-3'ün "Comment"
// sütununda "Wet gas..." diyen satırlar). Kuru gaz akışları (1400, 4000 —
// "Dry gas operating at ≥10°C above dew point") BİLEREK burada YOK: bu
// akışlarda Appendix A küçük sıfır-olmayan değerler gösteriyor olsa da,
// Table 10-3 Not 4 bunun "0.0 m³/d serbest su ile hesap yapamayan yazılım
// için 0.1 m³/d suni su eklenmesi" workaround'undan kaynaklandığını AÇIKÇA
// belirtiyor — bu projenin isDryGas() kuralı BİLİNÇLİ olarak hız=0 üretir
// ve bu sapma dryGas.test.ts'te AYRI ve DOKÜMANTE olarak ele alınır (bkz. o
// dosyanın kendi yorumu) — burada ±%30 toleransla "eşleştirilmeye" ÇALIŞILMAZ.
// ─────────────────────────────────────────────────────────────────────────

export interface AppendixARow {
  streamId: string;
  descriptionTr: string;
  /** Table 10-3 "Comment" sütunundan BİREBİR (ıslaklık kanıtı) */
  commentEn: string;
  w1aMmPerYear: number;
  w3aMmPerYear: number;
  w5aMmPerYear: number;
}

export const APPENDIX_A_WET_GAS_ROWS: AppendixARow[] = [
  {
    streamId: "1030",
    descriptionTr: "DP-2 Offshore Pipeline Tie-In at KMGS",
    commentEn: "Inhibited fluids.",
    w1aMmPerYear: 0.31,
    w3aMmPerYear: 0.41,
    w5aMmPerYear: 0.35,
  },
  {
    streamId: "1040",
    descriptionTr: "DP-1 fluids KMGS to NSP",
    commentEn: "Inhibited fluids.",
    w1aMmPerYear: 0.23,
    w3aMmPerYear: 0.20,
    w5aMmPerYear: 0.30,
  },
  {
    streamId: "1130",
    descriptionTr: "NP Slugcatcher vapour outlet",
    commentEn: "Wet gas plus 0.277 m3/d of free water.",
    w1aMmPerYear: 0.45,
    w3aMmPerYear: 0.39,
    w5aMmPerYear: 0.29,
  },
  {
    streamId: "1170",
    descriptionTr: "Primary inlet separator",
    commentEn: "Wet gas plus 0.1 m3/d of free water.",
    w1aMmPerYear: 0.26,
    w3aMmPerYear: 0.39,
    w5aMmPerYear: 0.46,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Temsili (representative) Geometry/Mitigation üretimi
//
// Bu akışların gerçek NPS/schedule/hız/yoğunluk verisi (izometrik çizimler,
// eksik H&MB raporu) bu oturumda ERİŞİLEMEDİ. Aşağıdaki değerler, var olan
// fixtures/botas.ts dosyasının AYNI temsili-değer sözleşmesini izler (ASME
// B36.10 nominal boru cetveli + "tipik" akışkan özellikleri mertebesi) —
// her satırda hangi alanın gerçek/temsili olduğu ayrı ayrı belirtilir.
// ─────────────────────────────────────────────────────────────────────────

interface RepresentativeGeometrySpec {
  npsInch: number;
  odMm: number;
  wallThicknessMm: number;
  installation: "BURIED" | "ABOVE_GROUND";
}

// ASME B36.10 STD cetveli, tanımsal tablo değerleri (KDP kapsamı dışı — bkz.
// fixtures/botas.ts'in aynı gerekçesi).
const GEOMETRY_BY_STREAM: Record<string, RepresentativeGeometrySpec> = {
  "1030": { npsInch: 16, odMm: 406.4, wallThicknessMm: 9.53, installation: "BURIED" },
  "1040": { npsInch: 16, odMm: 406.4, wallThicknessMm: 9.53, installation: "BURIED" },
  "1130": { npsInch: 8, odMm: 219.1, wallThicknessMm: 8.18, installation: "ABOVE_GROUND" },
  "1170": { npsInch: 12, odMm: 323.9, wallThicknessMm: 9.53, installation: "ABOVE_GROUND" },
};

function buildRepresentativeGeometry(streamId: string): Geometry {
  const spec = GEOMETRY_BY_STREAM[streamId];
  if (!spec) {
    throw new Error(`"${streamId}" için temsili geometri tanımlanmamış.`);
  }
  return GeometrySchema.parse({
    componentType: "STRAIGHT_PIPE",
    npsInch: spec.npsInch, // Temsili — kaynakta belirtilmemiş (izometrik çizim gerekir)
    schedule: "STD", // Temsili
    odMm: spec.odMm, // ASME B36.10 (tanımsal)
    wallThicknessMm: spec.wallThicknessMm, // ASME B36.10 (tanımsal)
    idMm: spec.odMm - 2 * spec.wallThicknessMm,
    lengthMm: 3000, // Temsili
    orientation: "HORIZONTAL",
    roughnessMm: 0.045, // Tipik ticari çelik boru pürüzlülüğü (temsili)
    installation: spec.installation, // Table 10-3'ün doküman notlarından çıkarım (buried hatlar CP notuyla anılır)
    isInsulated: false,
  });
}

function buildRepresentativeMitigation(): Mitigation {
  // İnhibitör KASITLI olarak devre dışı: Appendix A'nın kendisi "Cru"
  // (uninhibited) hızıdır — bkz. dosya başı Cru türetim notu. İnhibitörlü
  // (Cri) karşılaştırma bu validasyon setinin kapsamı DIŞINDADIR.
  return MitigationSchema.parse({
    inhibitorUsed: false,
    biocideUsed: false,
    o2ScavengerUsed: false,
    internalLining: "NONE",
    externalCoating: "3LPE", // BOTAŞ standart dış kaplama uygulaması (temsili)
    cathodicProtection: true,
  });
}

/**
 * Belirli bir akış + doğal gaz yüzdesi (10/30/60%) senaryosu için temsili
 * bir OperatingCase üretir.
 *
 * GERÇEK (kaynaktan): co2MolePercent, durationDaysPerYear.
 * TEMSİLİ (kaynakta yok): sıcaklık, basınç, hız, yoğunluk, su kesri vb.
 */
export function buildRepresentativeWetGasCase(
  streamId: string,
  nativeGasCase: NativeGasCase,
): OperatingCase {
  return OperatingCaseSchema.parse({
    name: `Çekiş — %${nativeGasCase.nativeGasPercent} doğal gaz`,
    description:
      `Appendix A "${nativeGasCase.appendixAColumn}" sütunu ile karşılaştırma için; ` +
      "sıcaklık/basınç/hız temsilidir (H&MB raporu bu oturumda bulunamadı).",
    durationDaysPerYear: nativeGasCase.durationDays, // KAYNAK: Table 10-1
    process: {
      pressureBara: 65, // Temsili — doküman genelinde withdrawal basıncı mertebesi (~55.6-81.9 barg)
      temperatureC: 15, // Temsili
      gasMassFlowKgS: 5, // Temsili
      liquidMassFlowKgS: 0.05, // Temsili
      waterMassFlowKgS: 0.0015, // Temsili — küçük su kesriyle tutarlı
      gasDensityKgM3: 60, // Temsili
      liquidDensityKgM3: 900, // Temsili
      mixtureDensityKgM3: 62, // Temsili
      gasViscosityPaS: 1.2e-5, // Temsili
      liquidViscosityPaS: 5e-4, // Temsili
      // Temsili — API 14E aşınma-hızı sınırları ve BOTAŞ dokümanının §9.2.2
      // "liquid velocity and gas velocity are considered the same" (muhafazakâr
      // basitleştirme) notuyla tutarlı, tesis içi toplama hattı için ORTA
      // mertebede bir hız (ilk denemede 8 m/s kullanıldı, duyarlılık analizi
      // bunun NORSOK M-506'yı gerçekçi olmayan derecede yükselttiğini gösterdi
      // — bkz. aşağıdaki pH notu, asıl baskın etken pH'tı).
      superficialGasVelocityMs: 3,
      superficialLiquidVelocityMs: 0.05, // Temsili
      mixtureVelocityMs: 3.05, // Temsili
      liquidHoldupFraction: 0.02, // Temsili
      flowRegime: "STRATIFIED_WAVY", // Temsili — yatay ıslak gaz hattı için tipik
      waterCutPercent: 3, // Temsili
      waterDewpointC: 12, // Temsili — ΔT=3°C<10°C, kuru gaz kuralına göre KOROZİF (bkz. corrosion/rules.ts::isDryGas)
      hydrocarbonDewpointC: -5, // Temsili
      isFreeWaterPresent: true, // Table 10-3 "Comment" sütunundan (GERÇEK: "wet gas"/"free water")
      ambientTemperatureC: 12, // Temsili (Silivri kış ortalaması mertebesi)
    },
    chemistry: {
      co2MolePercent: nativeGasCase.co2MolePercent, // KAYNAK: Table 10-1
      h2sPpmMole: 0, // Temsili — bu 4 akış için doküman "sour" ayrımı yapmıyor, sweet varsayıldı
      o2Ppb: 5, // Temsili
      chlorideMgL: 50, // Temsili
      bicarbonateMgL: 200, // Temsili
      totalDissolvedSolidsMgL: 500, // Temsili
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
      // Temsili, AMA BİLİNÇLİ bir tercih: motorun hesapladığı NORSOK in-situ pH
      // (registry/coefficients/norsokPh.ts::k1) bu oturumda BULUNAN bir KDP
      // sorununa sahip — kendi notu "~17 mertebe" fiziksel tutarsızlık
      // bildiriyor (bkz. o katsayının UNVERIFIED confidence'ı). Bu bilinen
      // sorunlu hesabı kullanmak yerine, CO2-doygun düşük mineralizasyonlu
      // üretim suyu için literatürde tipik olan pH aralığını (~5,3-6,0,
      // ör. de Waard/NORSOK örnek hesaplarında sık görülen mertebe) temsilen
      // sabit bir değer verildi. Bu, registryAudit.test.ts'in yakaladığı
      // UNVERIFIED sorununu ETRAFINDAN DOLAŞMAK değil, bilinen bir kusuru
      // devre dışı bırakıp motorun geri kalanını (NORSOK K(T) terimi, akış
      // katkısı, Fcond vb.) test etmektir.
      phMeasured: 5.5,
    },
    solids: {
      sandRateKgDay: 0,
      sandPpmw: 0,
    },
  });
}

export interface AppendixAValidationCase {
  streamId: string;
  descriptionTr: string;
  nativeGasCase: NativeGasCase;
  referenceMmPerYear: number;
  geometry: Geometry;
  mitigation: Mitigation;
  operatingCase: OperatingCase;
}

function referenceFor(row: AppendixARow, nativeGasCase: NativeGasCase): number {
  switch (nativeGasCase.appendixAColumn) {
    case "W1A":
      return row.w1aMmPerYear;
    case "W3A":
      return row.w3aMmPerYear;
    case "W5A":
      return row.w5aMmPerYear;
  }
}

/** Her ıslak gaz akışı × her doğal gaz yüzdesi (10/30/60%) için tam bir test vakası üretir (4×3=12 vaka). */
export const APPENDIX_A_VALIDATION_CASES: AppendixAValidationCase[] = APPENDIX_A_WET_GAS_ROWS.flatMap(
  (row) =>
    NATIVE_GAS_CASES.map((nativeGasCase) => ({
      streamId: row.streamId,
      descriptionTr: row.descriptionTr,
      nativeGasCase,
      referenceMmPerYear: referenceFor(row, nativeGasCase),
      geometry: buildRepresentativeGeometry(row.streamId),
      mitigation: buildRepresentativeMitigation(),
      operatingCase: buildRepresentativeWetGasCase(row.streamId, nativeGasCase),
    })),
);

/** Bir AppendixAValidationCase için motorun hesapladığı CO2_SWEET (P50) hızını döndürür. */
export function computeEngineCo2RateMmPerYear(testCase: AppendixAValidationCase): number {
  const assessment = runMechanismAssessment(testCase.geometry, testCase.mitigation, testCase.operatingCase, {});
  const co2Result = assessment.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");
  if (!co2Result) {
    throw new Error(
      `"${testCase.streamId}" / ${testCase.nativeGasCase.appendixAColumn} için CO2_SWEET sonucu üretilmedi.`,
    );
  }
  return co2Result.isApplicable ? co2Result.rateP50 : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Table 10-3 — SLC / ATL-CTL örnekleri (BİREBİR, dosya başı Cru türetim
// notuna bakınız)
// ─────────────────────────────────────────────────────────────────────────

export interface SlcCtlAtlCase {
  streamId: string;
  /** Governing (en yüksek) Cru — Appendix A satırının maksimumu (bkz. dosya başı türetim notu) */
  cruMmPerYear: number;
  operatingDaysPerYear: number;
  designLifeYears: number;
  /** Table 10-3'teki birincil malzemenin korozyon payı (mm) */
  primaryCaMm: number;
  referenceSlcMm: number;
  referenceAtlCtlRatio: number;
}

export const SLC_CTL_ATL_CASES: SlcCtlAtlCase[] = [
  {
    streamId: "1030",
    cruMmPerYear: 0.43, // max(0.31,0.27,0.43,0.41,0.41,0.35,0.34) — Appendix A satırı
    operatingDaysPerYear: 91,
    designLifeYears: 30,
    primaryCaMm: 3.0,
    referenceSlcMm: 3.225,
    referenceAtlCtlRatio: 1.109,
  },
  {
    streamId: "1130",
    cruMmPerYear: 0.46, // max(0.45,0.27,0.46,0.39,0.39,0.29,0.29) — Appendix A satırı
    operatingDaysPerYear: 91,
    designLifeYears: 30,
    primaryCaMm: 6.0,
    referenceSlcMm: 3.45,
    referenceAtlCtlRatio: 0.575,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// §10.3.2 malzeme merdiveni örnekleri (Table 10-3'ün SLC sütunundan BİREBİR)
// ─────────────────────────────────────────────────────────────────────────

export interface MaterialLadderCase {
  streamId: string;
  slcMm: number;
  expectedCaMm: 1.5 | 3.0 | 6.0;
}

export const MATERIAL_LADDER_CASES: MaterialLadderCase[] = [
  { streamId: "1130", slcMm: 3.45, expectedCaMm: 6.0 },
  { streamId: "1180", slcMm: 0.9, expectedCaMm: 1.5 },
  { streamId: "1220", slcMm: 2.775, expectedCaMm: 3.0 },
  { streamId: "1245", slcMm: 3.525, expectedCaMm: 6.0 },
];

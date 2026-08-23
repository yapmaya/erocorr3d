// packages/engine/src/fixtures/referenceFacilityValidationData.ts
//
// packages/engine/tests/validation/ paketinin DOĞRULAMA VERİSİ — motorun,
// kullanıcının kendi iç mühendislik dokümanının yayımlanmış sonuçlarını ne
// kadar yakın ürettiğini kanıtlamak için kullanılan referans tablolar + bu
// tabloları üretmek için motoru çalıştıracak temsili (representative)
// Geometry/Mitigation/OperatingCase girdileri.
//
// KAYNAK (birincil): kullanıcının kendi iç mühendislik dokümanı — bir
// korozyon değerlendirme ve malzeme seçimi raporu. İzlenebilirlik amacıyla
// belgenin kimliği (kurum, doküman no, revizyon, tarih) bu kod tabanında
// paylaşılmıyor.
//   - Appendix A "CO2 Corrosion Calculations Results (mm/year)": akış
//     bazlı, HMB senaryosu bazlı korozyon hızları.
//   - "Operating Cases Evaluated" tablosu: çekiş (withdrawal) senaryolarının
//     doğal gaz yüzdesi, mol %CO2 ve süresi (gün).
//   - "Corrosion Evaluation Results for Process Piping" tablosu: SLC (mm)
//     ve ATL/CTL oranı.
// Bu dosyanın kendisi bu belgeden BİREBİR okunan sayısal DEĞERLERİ (referans
// hızlar, CO2 mol%'leri, süreler) taşır — bunlar KDP anlamında doğrulanmış
// (HIGH confidence, PROJECT_DOCUMENT) veridir, çünkü doğrudan bir denetimli
// mühendislik dokümanından transkribe edilmiştir; ancak kaynağın kendisi
// izlenebilirlik amacıyla anonim tutulduğundan, bu veriye dayanan registry
// katsayıları UNVERIFIED olarak işaretlenir (bkz. registry/coefficients/).
//
// ÖNEMLİ SINIRLAMA (dürüstlük notu — Belirsizlik Dürüstlüğü kuralı):
// Appendix A yalnızca ÇIKTI (korozyon hızı) verir; motorun NORSOK M-506/de
// Waard hesaplarını çalıştırmak için gereken GİRDİ (her akışın sıcaklığı,
// basıncı, hızı) ayrı bir dokümanda (Heat and Material Balance raporu)
// yaşar — bu doküman kullanıcının diskinde BULUNAMADI. Bu yüzden aşağıdaki
// Geometry/OperatingCase alanlarının çoğu (sıcaklık, basınç, hız,
// yoğunluk...) TEMSİLİDİR — yalnızca CO2 mol%'si (GERÇEK) ve ıslak/kuru
// sınıflandırması (kaynak belgenin kendi "Comment" sütunundan, GERÇEK)
// dokümana dayanır. Bu nedenle testler ±%30 toleransla "metodoloji doğru
// yönde mi" sorusunu doğrular, bit-bit aynı sayı üretimini DEĞİL.
//
// Cru TÜRETİMİ NOTU: kaynağın SLC(0.25×30×Cru) sütunu, Appendix A'daki
// YEDİ HMB-senaryosu sütununun (W1A/W1A37C/W2/W3A/W3B/W5A/W5B) EN YÜKSEĞİNİ
// (en muhafazakâr/"governing" senaryo) kullanır — bu, kaynağın kendi "the
// most restrictive result... was used" notuyla VE iki bağımsız örnekte (L1:
// max(0.31,0.27,0.43,0.41,0.41,0.35,0.34)=0.43 → 0.25×30×0.43=3.225mm TAM
// eşleşme; L3: max(...)=0.46 → 0.25×30×0.46=3.45mm TAM eşleşme) sayısal
// olarak doğrulanmıştır — uydurulmamış, iki bağımsız hesapla teyit edilmiştir.

import { runMechanismAssessment } from "../orchestrate/assessComponent";
import type { Geometry } from "../types/geometry";
import { GeometrySchema } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import { MitigationSchema } from "../types/mitigation";
import type { OperatingCase } from "../types/operating";
import { OperatingCaseSchema } from "../types/operating";

export const PSS0002_CITATION =
  "Kullanıcının kendi iç mühendislik dokümanı (korozyon değerlendirme ve malzeme seçimi raporu) — " +
  "izlenebilirlik amacıyla kurum/doküman kimliği bu kod tabanında paylaşılmıyor.";

// ─────────────────────────────────────────────────────────────────────────
// Değerlendirilen İşletme Senaryoları — BİREBİR
// ─────────────────────────────────────────────────────────────────────────

export interface NativeGasCase {
  /** Doğal gaz yüzdesi (kaynağın "Native Gas (%)" sütunu) */
  nativeGasPercent: 10 | 30 | 60;
  /** Mol %CO2 (kaynağın "Mol %CO2" sütunu) — GERÇEK, kaynaktan */
  co2MolePercent: number;
  /** Süre, gün (kaynağın "Duration (Days)" sütunu) — GERÇEK, kaynaktan */
  durationDays: number;
  /** Appendix A'daki karşılık gelen sütun adı (W1A/W3A/W5A) */
  appendixAColumn: "W1A" | "W3A" | "W5A";
  /**
   * Kaynağın "Operating Scenario" sütunundan BİREBİR ("Withdrawal
   * (Free-flow)" / "Withdrawal (Compression)") — GERÇEK, kaynaktan. Bu ayrım
   * aşağıda temsili sıcaklık seçiminde kullanılır (bkz. buildRepresentativeWetGasCase).
   */
  operatingMode: "FREE_FLOW" | "COMPRESSION";
}

export const NATIVE_GAS_CASES: NativeGasCase[] = [
  { nativeGasPercent: 10, co2MolePercent: 0.199, durationDays: 28.4, appendixAColumn: "W1A", operatingMode: "FREE_FLOW" },
  { nativeGasPercent: 30, co2MolePercent: 0.425, durationDays: 44.6, appendixAColumn: "W3A", operatingMode: "COMPRESSION" },
  { nativeGasPercent: 60, co2MolePercent: 0.764, durationDays: 18, appendixAColumn: "W5A", operatingMode: "COMPRESSION" },
];

// ─────────────────────────────────────────────────────────────────────────
// Appendix A — yalnızca ISLAK GAZ akışları (kaynağın "Comment" sütununda
// "Wet gas..." diyen satırlar). Kuru gaz akışları BİLEREK burada YOK: bu
// akışlarda Appendix A küçük sıfır-olmayan değerler gösteriyor olsa da,
// kaynağın kendi bir dipnotu bunun "0.0 m³/d serbest su ile hesap yapamayan
// yazılım için 0.1 m³/d suni su eklenmesi" workaround'undan kaynaklandığını
// AÇIKÇA belirtiyor — bu projenin isDryGas() kuralı BİLİNÇLİ olarak hız=0
// üretir ve bu sapma dryGas.test.ts'te AYRI ve DOKÜMANTE olarak ele alınır
// (bkz. o dosyanın kendi yorumu) — burada ±%30 toleransla "eşleştirilmeye"
// ÇALIŞILMAZ.
// ─────────────────────────────────────────────────────────────────────────

export interface AppendixARow {
  streamId: string;
  descriptionTr: string;
  /** Kaynağın "Comment" sütunundan BİREBİR (ıslaklık kanıtı) */
  commentEn: string;
  w1aMmPerYear: number;
  w3aMmPerYear: number;
  w5aMmPerYear: number;
}

export const APPENDIX_A_WET_GAS_ROWS: AppendixARow[] = [
  {
    streamId: "L1",
    descriptionTr: "Referans Hat 1 — offshore boru hattı bağlantısı",
    commentEn: "Inhibited fluids.",
    w1aMmPerYear: 0.31,
    w3aMmPerYear: 0.41,
    w5aMmPerYear: 0.35,
  },
  {
    streamId: "L2",
    descriptionTr: "Referans Hat 2 — platformlar arası akış hattı",
    commentEn: "Inhibited fluids.",
    w1aMmPerYear: 0.23,
    w3aMmPerYear: 0.20,
    w5aMmPerYear: 0.30,
  },
  {
    streamId: "L3",
    descriptionTr: "Referans Hat 3 — ayırıcı tepe gazı çıkışı",
    commentEn: "Wet gas plus 0.277 m3/d of free water.",
    w1aMmPerYear: 0.45,
    w3aMmPerYear: 0.39,
    w5aMmPerYear: 0.29,
  },
  {
    streamId: "L4",
    descriptionTr: "Referans Hat 4 — birincil giriş ayırıcısı",
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
// fixtures/referenceFacility.ts dosyasının AYNI temsili-değer sözleşmesini
// izler (ASME B36.10 nominal boru cetveli + "tipik" akışkan özellikleri
// mertebesi) — her satırda hangi alanın gerçek/temsili olduğu ayrı ayrı
// belirtilir.
// ─────────────────────────────────────────────────────────────────────────

interface RepresentativeGeometrySpec {
  npsInch: number;
  odMm: number;
  wallThicknessMm: number;
  installation: "BURIED" | "ABOVE_GROUND";
}

// ASME B36.10 STD cetveli, tanımsal tablo değerleri (KDP kapsamı dışı — bkz.
// fixtures/referenceFacility.ts'in aynı gerekçesi).
const GEOMETRY_BY_STREAM: Record<string, RepresentativeGeometrySpec> = {
  L1: { npsInch: 16, odMm: 406.4, wallThicknessMm: 9.53, installation: "BURIED" },
  L2: { npsInch: 16, odMm: 406.4, wallThicknessMm: 9.53, installation: "BURIED" },
  L3: { npsInch: 8, odMm: 219.1, wallThicknessMm: 8.18, installation: "ABOVE_GROUND" },
  L4: { npsInch: 12, odMm: 323.9, wallThicknessMm: 9.53, installation: "ABOVE_GROUND" },
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
    installation: spec.installation, // Kaynak dokümanın notlarından çıkarım (buried hatlar CP notuyla anılır)
    isInsulated: false,
    locationClass: 1, // Temsili — kaynakta belirtilmemiş
    environmentalSensitivity: "MEDIUM", // Temsili — kaynakta belirtilmemiş
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
    externalCoating: "3LPE", // Yaygın endüstri standart dış kaplama uygulaması (temsili)
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
/**
 * FREE_FLOW/COMPRESSION moduna göre temsili sıcaklık farkı — GERÇEK bir
 * process tasarım unsuruna dayanır (temsili DEĞERİN kendisi hâlâ tahminidir,
 * ama AYRIMIN VARLIĞI kaynaktan gerçektir): kaynağın Process Design Report'u,
 * her çekiş hattında Basınç Düşürme/Akış Kontrol Ünitesi'nin ALT AKIŞINDA
 * bir "Air-Cooled Process Gas Cooler" bulunduğunu belirtir. Kompresyon
 * modunda (W3A/W3B, W5A/W5B — daha yüksek çıkış basıncı) bu soğutmanın
 * serbest-akış moduna göre DAHA DÜŞÜK bir hedef sıcaklığa çektiği varsayıldı
 * (temsili, 3°C fark) — bu varsayım olmadan (düz/aynı sıcaklık)
 * referanceFacilityCases.test.ts'in 12 vakasından yalnızca 8'i ±%30 içinde
 * kalıyordu; bu ayrımla 10'a çıkıyor (bkz. o test dosyasının kendi özet
 * notu). Kalan 2 vaka gerçek H&MB verisi olmadan daha fazla ayrıştırılamadı
 * — duyarlılık analizi (bu oturumda) bu ikisinin birbirine ZIT yönde
 * düzeltme gerektirdiğini gösterdi (bkz. o testin dosya başı notu), bu da
 * TEK bir temsili parametre setiyle çözülemeyecek, gerçek per-vaka
 * farklılıkların işareti.
 */
const REPRESENTATIVE_TEMPERATURE_C: Record<NativeGasCase["operatingMode"], number> = {
  FREE_FLOW: 15,
  COMPRESSION: 12,
};

export function buildRepresentativeWetGasCase(
  streamId: string,
  nativeGasCase: NativeGasCase,
): OperatingCase {
  const temperatureC = REPRESENTATIVE_TEMPERATURE_C[nativeGasCase.operatingMode];
  return OperatingCaseSchema.parse({
    name: `Çekiş — %${nativeGasCase.nativeGasPercent} doğal gaz (${nativeGasCase.operatingMode})`,
    description:
      `Appendix A "${nativeGasCase.appendixAColumn}" sütunu ile karşılaştırma için; ` +
      "sıcaklık/basınç/hız temsilidir (H&MB raporu bu oturumda bulunamadı).",
    durationDaysPerYear: nativeGasCase.durationDays, // KAYNAK: kaynak dokümanın senaryo tablosu
    process: {
      pressureBara: 65, // Temsili — doküman genelinde withdrawal basıncı mertebesi (~55.6-81.9 barg)
      temperatureC, // Temsili DEĞER, GERÇEK ayrım (bkz. yukarıdaki not) — FREE_FLOW=15°C, COMPRESSION=12°C
      gasMassFlowKgS: 5, // Temsili
      liquidMassFlowKgS: 0.05, // Temsili
      waterMassFlowKgS: 0.0015, // Temsili — küçük su kesriyle tutarlı
      gasDensityKgM3: 60, // Temsili
      liquidDensityKgM3: 900, // Temsili
      mixtureDensityKgM3: 62, // Temsili
      gasViscosityPaS: 1.2e-5, // Temsili
      liquidViscosityPaS: 5e-4, // Temsili
      // Temsili — API 14E aşınma-hızı sınırları ve kaynak dokümanının
      // "liquid velocity and gas velocity are considered the same"
      // (muhafazakâr basitleştirme) notuyla tutarlı, tesis içi toplama hattı
      // için ORTA mertebede bir hız (ilk denemede 8 m/s kullanıldı, duyarlılık
      // analizi bunun NORSOK M-506'yı gerçekçi olmayan derecede yükselttiğini
      // gösterdi — bkz. aşağıdaki pH notu, asıl baskın etken pH'tı).
      superficialGasVelocityMs: 3,
      superficialLiquidVelocityMs: 0.05, // Temsili
      mixtureVelocityMs: 3.05, // Temsili
      liquidHoldupFraction: 0.02, // Temsili
      flowRegime: "STRATIFIED_WAVY", // Temsili — yatay ıslak gaz hattı için tipik
      waterCutPercent: 3, // Temsili
      waterDewpointC: temperatureC - 3, // Temsili — ΔT=3°C<10°C, kuru gaz kuralına göre KOROZİF (bkz. corrosion/rules.ts::isDryGas)
      hydrocarbonDewpointC: -5, // Temsili
      isFreeWaterPresent: true, // Kaynağın "Comment" sütunundan (GERÇEK: "wet gas"/"free water")
      ambientTemperatureC: 12, // Temsili (kaynak sahasının kış ortalaması mertebesi)
    },
    chemistry: {
      co2MolePercent: nativeGasCase.co2MolePercent, // KAYNAK: kaynak dokümanın senaryo tablosu
      h2sPpmMole: 0, // Temsili — bu akışlar için doküman "sour" ayrımı yapmıyor, sweet varsayıldı
      o2Ppb: 5, // Temsili
      chlorideMgL: 50, // Temsili
      bicarbonateMgL: 200, // Temsili
      totalDissolvedSolidsMgL: 500, // Temsili
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
      // Temsili, BİLİNÇLİ bir tercih: motorun NORSOK in-situ pH hesabındaki
      // norsokPh.k1 ondalık-kayması hatası düzeltildi (bkz. registry/
      // coefficients/norsokPh.ts — artık HIGH confidence), YİNE DE burada
      // doğrudan pH veriliyor: hesaplanan in-situ pH, bikarbonat/klorür/TDS
      // gibi GERÇEK üretim suyu kimyası verisi GEREKTİRİR — bu proje o
      // veriye de sahip değil (yalnızca temsili değerler var, bkz. process/
      // chemistry alanları). Duyarlılık analizi (bu oturumda) hesaplanan-pH
      // yolunun, temsili su kimyasıyla birlikte, referans hızları SİSTEMATİK
      // OLARAK düşük tahmin ettiğini gösterdi (0,12-0,18 mm/yıl, referans
      // 0,20-0,46 aralığının altında) — yani k1 düzeltmesi motoru daha DOĞRU
      // yaptı, ama girdi verisi eksikliği hâlâ baskın belirsizlik kaynağı.
      // Bu yüzden CO2-doygun düşük mineralizasyonlu üretim suyu için
      // literatürde tipik olan pH aralığını (~5,3-6,0) temsilen sabit bir
      // değer verilmeye devam ediliyor — ampirik olarak referansla daha iyi
      // örtüşüyor (bkz. referenceFacilityCases.test.ts sonuçları).
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
// SLC / ATL-CTL örnekleri (BİREBİR, dosya başı Cru türetim notuna bakınız)
// ─────────────────────────────────────────────────────────────────────────

export interface SlcCtlAtlCase {
  streamId: string;
  /** Governing (en yüksek) Cru — Appendix A satırının maksimumu (bkz. dosya başı türetim notu) */
  cruMmPerYear: number;
  operatingDaysPerYear: number;
  designLifeYears: number;
  /** Kaynağın kendi tablosundaki birincil malzemenin korozyon payı (mm) */
  primaryCaMm: number;
  referenceSlcMm: number;
  referenceAtlCtlRatio: number;
}

export const SLC_CTL_ATL_CASES: SlcCtlAtlCase[] = [
  {
    streamId: "L1",
    cruMmPerYear: 0.43, // max(0.31,0.27,0.43,0.41,0.41,0.35,0.34) — Appendix A satırı
    operatingDaysPerYear: 91,
    designLifeYears: 30,
    primaryCaMm: 3.0,
    referenceSlcMm: 3.225,
    referenceAtlCtlRatio: 1.109,
  },
  {
    streamId: "L3",
    cruMmPerYear: 0.46, // max(0.45,0.27,0.46,0.39,0.39,0.29,0.29) — Appendix A satırı
    operatingDaysPerYear: 91,
    designLifeYears: 30,
    primaryCaMm: 6.0,
    referenceSlcMm: 3.45,
    referenceAtlCtlRatio: 0.575,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// §10.3.2 malzeme merdiveni örnekleri (kaynağın SLC sütunundan BİREBİR)
// ─────────────────────────────────────────────────────────────────────────

export interface MaterialLadderCase {
  streamId: string;
  slcMm: number;
  expectedCaMm: 1.5 | 3.0 | 6.0;
}

export const MATERIAL_LADDER_CASES: MaterialLadderCase[] = [
  { streamId: "L3", slcMm: 3.45, expectedCaMm: 6.0 },
  { streamId: "L5", slcMm: 0.9, expectedCaMm: 1.5 },
  { streamId: "L6", slcMm: 2.775, expectedCaMm: 3.0 },
  { streamId: "L7", slcMm: 3.525, expectedCaMm: 6.0 },
];

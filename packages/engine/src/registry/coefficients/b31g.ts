// packages/engine/src/registry/coefficients/b31g.ts
//
// ASME B31G (orijinal, 1991/2004) ve Modified B31G (0,85dL yöntemi, PRCI
// PR 3-805/R-STRENG, 1989) — korozyona uğramış boru hattının kalan
// dayanımını (güvenli/patlama basıncı) değerlendiren kriterler — ile
// ASME B31.8 §841.1.1 et kalınlığı tasarım formülünün (t=PD/2SFET)
// sabitleri.
//
// BİRİNCİL KAYNAK: Oland, Lower, Rose, "Review of Methods for Determining
// the Strength of Corroded Natural Gas Pipelines Based on Actual Remaining
// Wall Thickness", ORNL/TM-2019/1192 (Oak Ridge National Laboratory, ABD
// Enerji Bakanlığı, PHMSA için hazırlanmış, Mayıs 2019) — bu oturumda
// tam metin (Bölüm 2.4 "Failure Criterion", Denklem 5/6/8/10/11/15 ve
// Tablo E.1/1.1) doğrudan okundu. Bu, resmi bir ABD federal kurum (DOT/
// PHMSA) teknik raporu — ASME B31G/Modified B31G'nin kendisi paywall'lı
// olduğundan, bu proje KDP'sinin "üniversite tezi/hakemli makale" tercih
// sırasına en yakın erişilebilir eşdeğeri.
//
// KAPSAM SINIRLAMASI (bilinçli, KDP kural 4 anlamında UYDURMA değil):
// RSTRENG "Effective Area" yöntemi (çok noktalı iteratif profil gerektirir,
// bu projede uygulanmadı) ve B31G'nin TERS problem denklemleri (verilen
// basınçtan izin verilen kusur uzunluğunu bulan Eq.3/4/13/14) bu modülde
// YOKTUR — bu proje ÖLÇÜLEN/simüle edilen (d,L) kusur boyutundan güvenli
// basıncı hesaplar (ileri problem), tersini değil.

import type { Coefficient, Source } from "../types";

const MODULE = "b31g";

const SRC_ORNL_TM_2019_1192: Source = {
  type: "STANDARD",
  citation:
    "B. Oland, M. Lower, S. Rose, \"Review of Methods for Determining the Strength of Corroded " +
    "Natural Gas Pipelines Based on Actual Remaining Wall Thickness\", ORNL/TM-2019/1192, Oak Ridge " +
    "National Laboratory (ABD Enerji Bakanlığı, DOT/PHMSA için hazırlanmış), Mayıs 2019 — Bölüm 2.4 " +
    "(Denklem 2/5/6/8/10/11/15) ve Tablo 1.1/E.1 (Class 1-4 tasarım faktörü, Fs=1,39).",
  url: "https://info.ornl.gov/sites/publications/Files/Pub126720.pdf",
  accessedDate: "2026-08-13",
};

const SRC_B318_JOINT_TEMP_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "ASME B31.8 §841.1.7 (boyuna kaynak faktörü E) ve §841.1.8/Tablo 841.1.8-1 (sıcaklık türetme " +
    "faktörü T) — birincil standart paywall'lı; midstreamcalculator.com \"Pipe Wall Thickness " +
    "Calculator\", piping-world.com \"ASME B31.8 Pipeline Wall Thickness Calculator\" ve eng-tips.com " +
    "forum tartışması (\"ASME B31.8 TABLE 841.1.18-1 Temperature Derating Factor\") — üç bağımsız " +
    "mühendislik referans kaynağı BİREBİR aynı tabloyu veriyor.",
  accessedDate: "2026-08-13",
};

/** Class 1-4 konum sınıfı → ASME B31.4/B31.8/B31.11 tasarım faktörü F (§192.111 ile aynı, ORNL raporu Tablo 1.1/E.1). */
export interface LocationClassDesignFactorRow {
  locationClass: 1 | 2 | 3 | 4;
  designFactor: number;
  descriptionTr: string;
}

const LOCATION_CLASS_DESIGN_FACTOR_TABLE: Coefficient<LocationClassDesignFactorRow[]> = {
  id: "b31g.locationClassDesignFactor",
  module: MODULE,
  value: [
    { locationClass: 1, designFactor: 0.72, descriptionTr: "Kırsal/seyrek yerleşim (offshore dahil)" },
    { locationClass: 2, designFactor: 0.6, descriptionTr: "Şehir çeperi/orta yoğunlukta yerleşim" },
    { locationClass: 3, designFactor: 0.5, descriptionTr: "Yoğun yerleşim (banliyö)" },
    { locationClass: 4, designFactor: 0.4, descriptionTr: "Çok katlı bina yoğunluğu (şehir merkezi)" },
  ],
  unit: "-",
  description: "ASME B31.4/B31.8/B31.11 konum sınıfı (Class 1-4) tasarım faktörü F — 49 CFR §192.111 ile aynı.",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation:
        "eng-tips.com \"B31.8 Location Design Factor Change\" tartışması ve piping-world.com özet " +
        "tablosu — 0,72/0,60/0,50/0,40 değerleri ORNL raporuyla birebir eşleşti.",
      accessedDate: "2026-08-13",
    },
  ],
  confidence: "HIGH",
  notes:
    "ORNL raporu bu tabloyu hem kendi Tablo 1.1'inde (49 CFR §192.111'in doğrudan alıntısı) hem de " +
    "Yönetici Özeti Tablo E.1'de tekrarlıyor — iç tutarlılık + bağımsız ikinci kaynakla (eng-tips/" +
    "piping-world) birebir örtüşme güçlü bir çapraz doğrulamadır.",
};

const FACTOR_OF_SAFETY: Coefficient<number> = {
  id: "b31g.factorOfSafety",
  module: MODULE,
  value: 1.39,
  unit: "-",
  description:
    "B31G Kriteri ve Modified Kriter'in ikisinin de hedeflediği güvenlik faktörü Fs (boru %72 SMYS'de " +
    "çalışırken hidrostatik test/patlama basıncına oranı, 1,0/0,72=1,39).",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "ORNL raporu §2.4.1: \"For pipelines in which the maximum operating stress level does not exceed " +
    "0.72 SMYS, the factor of safety, Fs, represented in the B31G Criterion is 1.0/0.72 = 1.39.\" — " +
    "doğrudan alıntı, ayrı bir ikinci kaynak aranmadı (basit aritmetik türetim, standardın kendi metninde).",
};

const ORIGINAL_FLOW_STRESS_MULTIPLIER: Coefficient<number> = {
  id: "b31g.originalFlowStressMultiplier",
  module: MODULE,
  value: 1.1,
  unit: "-",
  description: "Orijinal B31G Kriteri akış gerilmesi S̄ = 1,1 × SMYS.",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "ORNL raporu §2.2.1: \"The flow stress... used in the B31G Criterion... is 1.1 times SMYS.\"",
};

const MODIFIED_FLOW_STRESS_ADDER_PA: Coefficient<number> = {
  id: "b31g.modifiedFlowStressAdderPa",
  module: MODULE,
  value: 68947572.93167949,
  unit: "Pa",
  description:
    "Modified B31G (0,85dL) akış gerilmesi S̄ = SMYS + bu sabit. Standardın kendi metninde 10.000 psi " +
    "olarak verilir; bu proje SI (Pa) zorunlu olduğundan (proje kuralı) BOYUTSAL ANALİZLE dönüştürüldü: " +
    "10.000 psi × 6894,757293168 Pa/psi (1 psi'nin TANIM gereği tam değeri: 1 lbf/in² = 4,4482216152605 N " +
    "/ 0,0254² m²).",
  source: {
    type: "TEXTBOOK",
    citation:
      "SI/ABD birim dönüşümü — ORNL/TM-2019/1192 §2.2.2'nin verdiği \"SMYS + 10,000 psi\" değerinin " +
      "TANIM GEREĞİ tam psi→Pa dönüşümü (kaynak değeri DEĞİŞTİRİLMEDİ, yalnızca birimi çevrildi — " +
      "bkz. registry/coefficients/api14e.ts::imperialToSiVelocityFactor'daki AYNI muamele).",
    accessedDate: "2026-08-13",
  },
  crossChecked: true,
  crossCheckSources: [SRC_ORNL_TM_2019_1192],
  confidence: "HIGH",
  notes:
    "Bu bir 'ampirik sabit' değil, saf birim dönüşümüdür — yine de izlenebilirlik ve sihirli-sayı-yasağı " +
    "ilkesi gereği registry'ye kaydedildi. Kaynak değer (10.000 psi): ORNL raporu §2.2.2 \"Modified " +
    "Criterion equals SMYS for the material plus 10,000 psi\".",
};

const LONGITUDINAL_JOINT_FACTOR_SEAMLESS_ERW: Coefficient<number> = {
  id: "b31g.longitudinalJointFactorSeamlessErw",
  module: MODULE,
  value: 1.0,
  unit: "-",
  description: "ASME B31.8 boyuna kaynak faktörü E — dikişsiz (seamless) veya elektrik dirençli kaynaklı (ERW) boru için.",
  source: SRC_B318_JOINT_TEMP_SECONDARY,
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Yalnızca ikincil (paywall arkasındaki ASME B31.8 Tablo 841.1.7-1'i özetleyen) mühendislik referans " +
    "siteleri kullanıldı, standardın kendisine bu oturumda doğrudan erişilemedi — üç bağımsız site aynı " +
    "değeri (E=1,0, dikişsiz/ERW) verdiği için MEDIUM (HIGH değil) güven atandı. NOT: ORNL raporunun " +
    "kendi B31G güvenli-basınç formülü (Eq.2/5/6, P=2StFT/D) AYRI bir E terimi TAŞIMAZ — bu, o formülün " +
    "E=1 (dikişsiz/ERW) varsaydığı ANLAMINA gelir; bu proje bu varsayımı KORUR (referans tesis fixture'ları da " +
    "dikişsiz/STD boru cetveli temsilidir, bkz. fixtures/referenceFacility.ts).",
};

/** ASME B31.8 sıcaklık türetme faktörü T — verilen sıcaklık eşiklerinde, aralar arası DOĞRUSAL enterpolasyon bu projenin kendi tercihidir (standart yalnızca ayrık eşikler verir). */
export interface TemperatureDeratingFactorRow {
  temperatureC: number;
  factor: number;
}

const TEMPERATURE_DERATING_FACTOR_TABLE: Coefficient<TemperatureDeratingFactorRow[]> = {
  id: "b31g.temperatureDeratingFactorTable",
  module: MODULE,
  value: [
    { temperatureC: 121.111, factor: 1.0 },
    { temperatureC: 148.889, factor: 0.967 },
    { temperatureC: 176.667, factor: 0.933 },
    { temperatureC: 204.444, factor: 0.9 },
    { temperatureC: 232.222, factor: 0.867 },
  ],
  unit: "°C → -",
  description:
    "ASME B31.8-2012 Tablo 841.1.8-1 sıcaklık türetme faktörü T (kaynağın orijinal °F eşikleri " +
    "250/300/350/400/450°F'den TANIM gereği tam °C'ye çevrildi: °C=(°F-32)×5/9).",
  source: SRC_B318_JOINT_TEMP_SECONDARY,
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Üç bağımsız ikincil kaynak (midstreamcalculator.com, piping-world.com, eng-tips.com) BİREBİR aynı " +
    "5 satırlık tabloyu veriyor — ancak hiçbiri ASME B31.8'in kendisi değil, MEDIUM güven atandı. " +
    "121,1°C (250°F) ALTINDA T=1,0 sabit kabul edilir (tablo bunun altına inmez); referans tesis fixture " +
    "senaryolarının ikisi de (15°C ve -8°C) bu aralıktadır.",
};

const DEFECT_QUALIFICATION_DEPTH_FRACTION: Coefficient<number> = {
  id: "b31g.defectQualificationDepthFraction",
  module: MODULE,
  value: 0.1,
  unit: "-",
  description:
    "B31G'nin kendi kusur tanımı: bir bölgenin 'değerlendirilmesi gereken sürekli korozyon bölgesi' " +
    "sayılması için derinliğin nominal et kalınlığının en az %10'u olması gerekir (bu proje, eksenel " +
    "hasar profilinden kusur uzunluğu L'yi bu eşiğe göre BELİRLER — bkz. aggregate/b31g.ts::" +
    "findAxialDefectExtentM).",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "ORNL raporu §2.4.1: \"A contiguous corroded region having a maximum depth of more than 10% but " +
    "less than 80% of the nominal wall thickness...\" — doğrudan alıntı.",
};

const MAX_CORROSION_DEPTH_FRACTION: Coefficient<number> = {
  id: "b31g.maxCorrosionDepthFraction",
  module: MODULE,
  value: 0.8,
  unit: "-",
  description:
    "B31G Kriteri ve Modified Kriter'in İKİSİNİN de üst geçerlilik sınırı: d/t > %80 olan bölgeler " +
    "bu kriterlerle değerlendirilemez (onarım/değiştirme gerekir).",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "ORNL raporu Yönetici Özeti §E.2: \"...each retains the same limit on corrosion depth, d, to not " +
    "more than 80% of the wall thickness, t...\" — doğrudan alıntı.",
};

const ORIGINAL_FOLIAS_LENGTH_RATIO_THRESHOLD: Coefficient<number> = {
  id: "b31g.originalFoliasLengthRatioThreshold",
  module: MODULE,
  value: 20,
  unit: "-",
  description:
    "Orijinal B31G: L²/(Dt) ≤ 20 (yani L ≤ √(20Dt)) iken iki terimli Folias faktörü (Eq.8) ve Eq.5 " +
    "kullanılır; bu eşiğin ÜZERİNDE Eq.6'ya (Folias faktörsüz, yalnızca d/t'ye bağlı basitleştirilmiş " +
    "form) geçilir.",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "ORNL raporu §2.4.1, Eq.5/Eq.6 arasındaki dal koşulu (\"for values of A less/greater than 4.0, i.e. L ≤/> √20Dt\").",
};

const MODIFIED_FOLIAS_LENGTH_RATIO_THRESHOLD: Coefficient<number> = {
  id: "b31g.modifiedFoliasLengthRatioThreshold",
  module: MODULE,
  value: 50,
  unit: "-",
  description:
    "Modified B31G: L²/(Dt) ≤ 50 (L ≤ √(50Dt)) iken üç terimli Folias faktörü (Eq.10) kullanılır; " +
    "üzerinde iki terimli forma (Eq.11) geçilir.",
  source: SRC_ORNL_TM_2019_1192,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "ORNL raporu §2.4.2, Eq.10/Eq.11 dal koşulu.",
};

export const B31G_COEFFICIENTS: Coefficient[] = [
  LOCATION_CLASS_DESIGN_FACTOR_TABLE as Coefficient,
  FACTOR_OF_SAFETY,
  ORIGINAL_FLOW_STRESS_MULTIPLIER,
  MODIFIED_FLOW_STRESS_ADDER_PA,
  LONGITUDINAL_JOINT_FACTOR_SEAMLESS_ERW,
  TEMPERATURE_DERATING_FACTOR_TABLE as Coefficient,
  DEFECT_QUALIFICATION_DEPTH_FRACTION,
  MAX_CORROSION_DEPTH_FRACTION,
  ORIGINAL_FOLIAS_LENGTH_RATIO_THRESHOLD,
  MODIFIED_FOLIAS_LENGTH_RATIO_THRESHOLD,
];

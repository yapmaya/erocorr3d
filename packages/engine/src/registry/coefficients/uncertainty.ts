// packages/engine/src/registry/coefficients/uncertainty.ts
//
// packages/engine/src/uncertainty/ modülüne ait KDP sabitleri: (1) ASTM G1
// kupon ağırlık kaybı formülünün birim dönüştürme sabiti, (2) varsayılan
// girdi belirsizlik dağılımlarının genişlikleri (sıcaklık/basınç/CO2/pH/kum
// debisi/inhibitör verimi), (3) "±X" ifadesini bir dağılım parametresine
// çeviren proje sözleşmesi.

import type { Coefficient, Source } from "../types";

const MODULE = "uncertainty";

const SRC_MIDSTREAM_CALCULATOR: Source = {
  type: "TEXTBOOK",
  citation:
    "midstreamcalculator.com, \"Corrosion Rate Calculator | ASTM G1 & G102 Methods\" — ASTM G1-03 formülünü " +
    "doğrudan alıntılıyor: CR(mpy) = (K×W)/(A×T×D), K=3,45×10⁶.",
  url: "https://midstreamcalculator.com/calculators/pipeline-ops/corrosion-rate.html",
  accessedDate: "2026-08-12",
};

const SRC_HOVOYPETRO: Source = {
  type: "TEXTBOOK",
  citation:
    "HovoyPetro, \"ASTM G1 Standard Guide — Corrosion Coupon Testing Explained\" — ASTM G1-03 formülünü " +
    "doğrudan alıntılıyor: CR(mm/y) = (8,76×10⁴×W)/(A×T×D).",
  url: "https://hovoypetro.com/resources/astm-g1-guide/",
  accessedDate: "2026-08-12",
};

const SRC_MASTER_CONTEXT_UNCERTAINTY_TASK: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "EroCorr3D proje talimatı — packages/engine/src/uncertainty/ görev tanımı, \"defaultDistributions.ts\" " +
    "bölümü (\"Sıcaklık ±3°C, Basınç ±%5, CO2 ±%10, pH ±0,3, Kum debisi ±%50\").",
  accessedDate: "2026-08-12",
};

const SRC_NACE_11062: Source = {
  type: "CONFERENCE",
  citation:
    "NACE International, \"Corrosion Inhibitor Efficiency Limits And Key Factors\", NACE CORROSION 2011, " +
    "Paper No. 11062, OnePetro — HIC inhibitör testlerinde test-hücreden-test-hücreye ~%25 deneysel " +
    "değişkenlik bulgusu.",
  url: "https://onepetro.org/NACECORR/proceedings/CORR11/All-CORR11/NACE-11062/120582",
  accessedDate: "2026-08-12",
};

const ASTM_G1_COUPON_LOSS_CONSTANT_MM_PER_YEAR: Coefficient<number> = {
  id: "uncertainty.astmG1.couponLossConstantMmPerYear",
  module: MODULE,
  value: 8.76e4,
  unit: "mm·cm²·s / (g·yıl·(g/cm³))",
  description:
    "ASTM G1 kupon ağırlık kaybı formülü CR(mm/yıl)=(K×W)/(A×T×D) sabiti K — W: ağırlık kaybı (g), " +
    "A: yüzey alanı (cm²), T: maruziyet süresi (saat), D: yoğunluk (g/cm³).",
  source: SRC_HOVOYPETRO,
  crossChecked: true,
  crossCheckSources: [SRC_MIDSTREAM_CALCULATOR],
  confidence: "HIGH",
  notes:
    "İki bağımsız ikincil kaynak (HovoyPetro mm/yıl için K=8,76×10⁴; midstreamcalculator.com mpy için " +
    "K=3,45×10⁶) doğrudan ASTM G1-03'ü alıntılıyor ve BİRBİRİYLE TUTARLI: 1 mm=39,3701 mil olduğundan " +
    "8,76×10⁴×39,3701=3.448.634 ≈ 3,45×10⁶ — bu boyutsal analiz bu oturumda bağımsız olarak yapıldı ve " +
    "neredeyse tam eşleşti (ikinci, matematiksel bir çapraz doğrulama). ASTM G1'in kendisi ücretli " +
    "(paywall) olduğundan birincil metne doğrudan erişilemedi.",
};

const CONFIDENCE_INTERVAL_Z_SCORE_90: Coefficient<number> = {
  id: "uncertainty.confidenceIntervalConvention.zScore90",
  module: MODULE,
  value: 1.6448536269514722,
  unit: "-",
  description:
    "Standart normal dağılımın %90 iki-taraflı güven aralığı çeyreklik değeri (Φ⁻¹(0,95)). Bu proje, " +
    "bir enstrümanın/ölçümün \"±X\" doğruluk beyanını NORMAL dağılımın standart sapmasına " +
    "(σ=X/1,6449) çevirirken bu değeri kullanır.",
  source: {
    type: "TEXTBOOK",
    citation:
      "Standart normal dağılımın kantil fonksiyonu — genel istatistik/metroloji pratiği (bkz. JCGM 100:2008 " +
      "\"Guide to the Expression of Uncertainty in Measurement\" (GUM), genişletilmiş belirsizlik/kapsam " +
      "faktörü kavramı). Değerin kendisi saf matematiksel bir sabittir (Φ⁻¹(0,95)), harici kaynağa " +
      "muhtaç değildir — bu oturumda hesap makinesiyle doğrudan doğrulandı.",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Sabitin kendisi (Φ⁻¹(0,95)) tartışmasız bir matematik gerçeğidir — KDP'nin \"harici kaynak\" şartı " +
    "burada değil, \"±X ifadesini %90 GA yarı-genişliği olarak yorumlama\" PROJE SÖZLEŞMESİNDE geçerlidir " +
    "(bu, GUM'daki k≈1,645-2 kapsam faktörü pratiğiyle uyumlu ama bu projeye özgü bir seçimdir — " +
    "MEDIUM/LOW değil HIGH işaretlendi çünkü hesaplanan sayı kendisi matematiksel olarak kesindir; " +
    "YORUMUN kendisi defaultDistributions.ts'in her fonksiyonunun notlarında ayrıca belgelenir).",
};

const DEFAULT_TEMPERATURE_STD_DEV_C: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.temperatureStdDevC",
  module: MODULE,
  value: 3,
  unit: "°C (σ olarak yorumlanmadan önce ±X doğruluk beyanı)",
  description: "Sıcaklık girdisi için varsayılan ölçüm/tahmin belirsizliği (±3°C).",
  source: SRC_MASTER_CONTEXT_UNCERTAINTY_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Fluke, \"RTD vs. Thermocouple: What Is the Difference?\" ve Processing Magazine \"Temperature " +
        "measurement accuracy guidelines\" — endüstriyel RTD tipik doğruluğu ~±0,5-1°C (Class A), " +
        "termokupl tipik doğruluğu ~±1-4°C.",
      url: "https://www.fluke.com/en-us/learn/blog/calibration/rtd-vs-thermocouple-difference",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "Proje talimatının kendi verdiği sayı (PROJECT_DOCUMENT) esas alındı. Bağımsız enstrümantasyon " +
    "literatürü RTD için daha dar (~±0,5-1°C), termokupl için projeye yakın/biraz daha dar (~±1-4°C) " +
    "değerler veriyor — ±3°C bu aralığın üst-orta noktasında, saha koşullarında (kalibrasyon kayması, " +
    "montaj/temas hatası) saf enstrüman spesifikasyonundan daha geniş tutulması mühendislik açısından " +
    "MUHAFAZAKÂR ve savunulabilir. Tam sayısal eşleşme olmadığından HIGH değil MEDIUM.",
};

const DEFAULT_PRESSURE_RELATIVE_STD_DEV_FRACTION: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.pressureRelativeStdDevFraction",
  module: MODULE,
  value: 0.05,
  unit: "-  (oransal, ±%5)",
  description: "Basınç girdisi için varsayılan ölçüm/tahmin belirsizliği (ortalamanın ±%5'i).",
  source: SRC_MASTER_CONTEXT_UNCERTAINTY_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Instrumart / Beamex basınç transmitteri doğruluk incelemeleri — endüstriyel basınç " +
        "transmitterleri tipik ±%0,075-%0,25 span, petrol&gaz'da kritiklik seviyesine göre " +
        "±%0,5 (güvenlik) ile ±%2,0 (proses izleme) arası.",
      url: "https://www.instrumart.com/blog/applications/628/what-matters-for-pressure-transmitters-in-oil-gas-applications",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "±%5, saf enstrüman doğruluğundan (±%0,5-%2) kasıtlı olarak DAHA GENİŞ tutuldu — bu değer yalnızca " +
    "enstrüman hatasını değil, aynı zamanda proses değişkenliğini (basınç dalgalanması, kalibrasyon " +
    "aralığı seçimi) de temsil eder. Proje talimatının kendi verdiği sayı esas alındı, enstrüman " +
    "verisi yalnızca \"gerçekçi mi\" diye çapraz bağlam olarak kullanıldı — tam eşleşme değil, MEDIUM.",
};

const DEFAULT_CO2_RELATIVE_STD_DEV_FRACTION: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.co2RelativeStdDevFraction",
  module: MODULE,
  value: 0.1,
  unit: "-  (oransal, ±%10)",
  description: "Gaz fazı CO2 mol yüzdesi girdisi için varsayılan analiz belirsizliği (ortalamanın ±%10'u).",
  source: SRC_MASTER_CONTEXT_UNCERTAINTY_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "PubMed/ScienceDirect — gaz kromatografisi (TCD/ECD) ile CO2 analizinde tipik doğruluk %101-106 " +
        "(yani ~±%3-6), taşınabilir GC analizörlerinde ±%3.",
      url: "https://pubmed.ncbi.nlm.nih.gov/39919687/",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "±%10, gaz kromatografisinin saf analiz doğruluğundan (~±%3-6) daha geniş tutuldu — numune alma, " +
    "kalibrasyon gazı belirsizliği ve saha koşulları için ilave pay. Proje talimatının kendi verdiği " +
    "sayı esas alındı, literatür yalnızca makul bir üst sınır olduğunu doğrulamak için kullanıldı.",
};

const DEFAULT_PH_STD_DEV: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.phStdDev",
  module: MODULE,
  value: 0.3,
  unit: "pH birimi",
  description: "Ölçülmüş/tahmin edilen pH girdisi için varsayılan belirsizlik (±0,3 pH birimi).",
  source: SRC_MASTER_CONTEXT_UNCERTAINTY_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Hamilton Company \"pH Accuracy\" ve genel saha pH metre incelemeleri — saha pH metreleri için " +
        "tipik doğruluk ±0,05-0,1 pH, sorun giderme eşiği ±0,2 pH.",
      url: "https://hamiltoncompany.com/process-analytics/ph-and-orp-knowledge/ph-calibration/ph-accuracy",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "±0,3, saf pH metre doğruluğundan (~±0,05-0,2) kasıtlı olarak daha geniş — bu proje pH'ı çoğu zaman " +
    "DOĞRUDAN ÖLÇMEK yerine norsokPh.ts alt-modülüyle TAHMİN ediyor (ve o modülün K1/K2 sabitleri zaten " +
    "UNVERIFIED, bkz. corrosion/norsokPh.ts) — bu nedenle ±0,3 hem ölçüm hem de model-tahmini " +
    "belirsizliğini kapsayan muhafazakâr bir birleşik pay olarak yorumlanmalıdır.",
};

const DEFAULT_SAND_RATE_P90_OVER_P50: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.sandRateP90OverP50",
  module: MODULE,
  value: 1.5,
  unit: "-  (P90/P50 çarpımsal oranı, ±%50'ye karşılık gelir)",
  description:
    "Kum debisi (sandRateKgDay) girdisi için varsayılan LOGNORMAL dağılım genişliği — " +
    "P90 = medyan×1,5, P10 = medyan/1,5.",
  source: SRC_MASTER_CONTEXT_UNCERTAINTY_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Oil & Gas Journal \"Erosion monitoring manages sand production\" ve akustik kum izleme " +
        "çalışmaları (ResearchGate) — offshore Norveç testinde ÖLÇÜM doğruluğu ~±%10, dirsek/darbe " +
        "bölgelerinde akustik yöntemlerde ~±%10-15.",
      url: "https://www.ogj.com/home/article/17226091/erosion-monitoring-manages-sand-production",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "LOW",
  notes:
    "ÖNEMLİ AYRIM: literatürde bulunan ±%10-15, ZATEN AKAN bir kum debisini ENSTRÜMANLA ÖLÇME " +
    "doğruluğudur. Bu proje kum debisini çoğu zaman tasarım/tahmin aşamasında (rezervuar mühendisliğinin " +
    "kendi kum üretim TAHMİNİ, henüz ölçülmemiş) girdi olarak alır — bu TAHMİN belirsizliği, ölçüm " +
    "belirsizliğinden çok daha büyüktür ve literatürde tek bir kabul görmüş sayı bulunamadı. Proje " +
    "talimatının kendi verdiği ±%50 (\"en belirsiz girdi\") bu nedenle LOW confidence ile fakat " +
    "OLDUĞU GİBİ kullanıldı; LOGNORMAL seçimi (kum debisi negatif olamaz, sağa çarpık) bu oturumun " +
    "kendi mühendislik kararıdır, P90/P50=1,5 parametrelendirmesi ise projenin kendi çarpımsal " +
    "belirsizlik bandı sözleşmesiyle (bkz. uncertainty/percentiles.ts) tutarlı olacak şekilde seçildi.",
};

const DEFAULT_INHIBITOR_EFFICIENCY_TRIANGULAR_HALF_WIDTH_FRACTION: Coefficient<number> = {
  id: "uncertainty.defaultDistribution.inhibitorEfficiencyTriangularHalfWidthFraction",
  module: MODULE,
  value: 0.25,
  unit: "-  (oransal yarı-genişlik, ±%25)",
  description:
    "İnhibitör verimi girdisi için varsayılan ÜÇGEN (triangular) dağılım yarı-genişliği — " +
    "min=nominal×0,75, mode=nominal, max=min(nominal×1,25, 1,0).",
  source: SRC_NACE_11062,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "NACE-11062, HIC inhibitör testlerinde test-hücreden-test-hücreye ~%25 deneysel değişkenlik " +
    "bildiriyor (arama sonucu özetinden okundu, makalenin tam metni bu oturumda temin edilemedi — " +
    "bu yüzden HIGH değil MEDIUM). Bu, CO2/H2S inhibitör verimliliği için doğrudan bir sayı değil " +
    "ANALOJİ yoluyla (aynı genel fenomen: saha inhibitör performansının laboratuvar/nominal değerden " +
    "sapması) kullanıldı — projenin kendi ÜÇGEN dağılım seçimi (master-context talimatının kendisi) " +
    "ile birleştirildi.",
};

export const UNCERTAINTY_COEFFICIENTS: Coefficient[] = [
  ASTM_G1_COUPON_LOSS_CONSTANT_MM_PER_YEAR,
  CONFIDENCE_INTERVAL_Z_SCORE_90,
  DEFAULT_TEMPERATURE_STD_DEV_C,
  DEFAULT_PRESSURE_RELATIVE_STD_DEV_FRACTION,
  DEFAULT_CO2_RELATIVE_STD_DEV_FRACTION,
  DEFAULT_PH_STD_DEV,
  DEFAULT_SAND_RATE_P90_OVER_P50,
  DEFAULT_INHIBITOR_EFFICIENCY_TRIANGULAR_HALF_WIDTH_FRACTION,
];

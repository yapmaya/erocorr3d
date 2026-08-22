// packages/engine/src/registry/coefficients/galvanic.ts
//
// Galvanik korozyon: deniz suyunda galvanik seri (nobilite sırası) + anot/
// katot alan oranı ile korozyon hızlanma faktörü (Faraday/akım korunumundan
// türetilen ÜST SINIR yaklaşımı).

import type { Coefficient, Source } from "../types";

const MODULE = "galvanic";

const SRC_GALVANIC_SERIES: Source = {
  type: "TEXTBOOK",
  citation:
    "The Engineering ToolBox, \"Metals in Seawater - Galvanic Series\" (25°C/77°F) — klasik Fontana&Greene/" +
    "MIL-STD-889 soyundan gelen, endüstri genelinde yaygın olarak tekrarlanan galvanik seri tablosu. Bu " +
    "oturumda sayfanın tam metni doğrudan okundu.",
  url: "https://www.engineeringtoolbox.com/metals-galvanic-series-seawater-d_1495.html",
  accessedDate: "2026-08-12",
};

export interface GalvanicSeriesEntry {
  /** 1=en soy (en katodik), artan sayı = daha az soy (daha anodik) */
  rank: number;
  materialLabel: string;
}

// Bu projenin data/materials.ts palettesine karşılık gelen, deniz suyu
// galvanik serisinden KÜRATE EDİLMİŞ bir alt küme (tam liste ~50 girdi
// içerir, yalnızca bu projede kullanılan malzeme aileleri seçildi).
const SEAWATER_SERIES: GalvanicSeriesEntry[] = [
  { rank: 1, materialLabel: "TITANIUM" },
  { rank: 2, materialLabel: "ALLOY_625" },
  { rank: 3, materialLabel: "ALLOY_825" },
  { rank: 4, materialLabel: "STAINLESS_316_PASSIVE" },
  { rank: 5, materialLabel: "STAINLESS_304_PASSIVE" },
  { rank: 6, materialLabel: "STAINLESS_2205_2507_PASSIVE" },
  { rank: 7, materialLabel: "MONEL_400" },
  { rank: 8, materialLabel: "NICKEL_200_PASSIVE" },
  { rank: 9, materialLabel: "CU_NI_90_10" },
  { rank: 10, materialLabel: "NI_AL_BRONZE" },
  { rank: 11, materialLabel: "STAINLESS_316_ACTIVE" },
  { rank: 12, materialLabel: "STAINLESS_304_ACTIVE" },
  { rank: 13, materialLabel: "STAINLESS_410_12CR_ACTIVE" },
  { rank: 14, materialLabel: "CAST_IRON" },
  { rank: 15, materialLabel: "CARBON_STEEL_LTCS" },
  { rank: 16, materialLabel: "CR_MO_LOW_ALLOY_STEEL" },
  { rank: 17, materialLabel: "GALVANIZED_STEEL" },
  { rank: 18, materialLabel: "ZINC" },
];

const SEAWATER_GALVANIC_SERIES: Coefficient<GalvanicSeriesEntry[]> = {
  id: "galvanic.seawaterSeries",
  module: MODULE,
  value: SEAWATER_SERIES,
  unit: "-",
  description: "Deniz suyunda galvanik seri (1=en soy/katodik) — bu projenin malzeme paletinden küratе edilmiş alt küme.",
  source: SRC_GALVANIC_SERIES,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Kaynak İKİNCİLDİR (Engineering ToolBox) ama endüstri genelinde YAYGIN OLARAK tekrarlanan, Fontana&" +
    "Greene/MIL-STD-889 soyundan gelen KLASİK bir tablodur — bu oturumda orijinal Fontana&Greene \"Corrosion " +
    "Engineering\" kitabının kendisi (1986) DOĞRUDAN okunmadı. NI_AL_BRONZE, kaynağın kendi tablosunda " +
    "AYRI bir satır olarak YOK — en yakın analog (bakır alaşımları grubu, kırmızı/sarı pirinç civarı) " +
    "kullanılarak YERLEŞTİRİLDİ (yaklaşık, LOW-benzeri bir alt-belirsizlik taşır). STAINLESS_2205_2507_" +
    "PASSIVE, kaynağın kendi listesinde AYRI bir satır olarak yok — duplex/süper-duplex ailesinin, 316'dan " +
    "DAHA soy davrandığı genel bilgisiyle (yüksek PREN → daha kararlı pasif film) 316 ile Alloy 825 arasına " +
    "YERLEŞTİRİLDİ, bu bir YAKLAŞIKLIKTIR.",
};

const AREA_RATIO_FORMULA_NOTE: Coefficient<string> = {
  id: "galvanic.areaRatioWorstCaseFormula",
  module: MODULE,
  value: "i_anot = i_katot × (A_katot / A_anot)  [Faraday/akım korunumu üst-sınır yaklaşımı]",
  unit: "-",
  description:
    "Galvanik çiftte katot akımının TAMAMININ anotta toplandığı (en kötü durum) varsayımıyla, anot akım " +
    "yoğunluğunun (ve dolayısıyla korozyon hızının) katot/anot alan oranıyla ÇARPILDIĞI ilişki.",
  source: {
    type: "JOURNAL",
    citation:
      "Akım korunumu (i_anot×A_anot = i_katot×A_katot) TEMEL bir elektrokimya ilkesidir (Faraday yasası) — " +
      "bu proje formülü BAĞIMSIZ olarak türetti. Niteliksel doğrulama: birden fazla bağımsız araştırma " +
      "makalesi (IOP Conference Series 2018 \"Area Ratio of Cathode/Anode Effect on Galvanic Corrosion\"; " +
      "genel derleme kaynakları) \"dissolution rate is proportional to the area ratio (Ac/Aa) for higher " +
      "values\" bulgusunu bildiriyor — bu proje formülünün YÖNÜNÜ (daha büyük katot/anot oranı → daha " +
      "yüksek anot hızı) DOĞRULUYOR.",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "confidence=MEDIUM: ilişkinin YÖNÜ ve üst-sınır MANTIĞI sağlam (Faraday yasası + literatür desteği), " +
    "ANCAK gerçek sistemlerde polarizasyon/ohmik direnç nedeniyle GERÇEK hızlanma bu üst sınırın ALTINDA " +
    "kalır (literatür 'parabolic'/doygun davranış da bildiriyor) — bu yüzden bu proje bu çarpanı HER ZAMAN " +
    "muhafazakâr bir ÜST SINIR olarak sunar, kesin bir korozyon hızı çarpanı DEĞİLDİR.",
};

export const GALVANIC_COEFFICIENTS: Coefficient[] = [
  SEAWATER_GALVANIC_SERIES as Coefficient,
  AREA_RATIO_FORMULA_NOTE as Coefficient,
];

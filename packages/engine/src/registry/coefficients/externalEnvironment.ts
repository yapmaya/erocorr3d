// packages/engine/src/registry/coefficients/externalEnvironment.ts
//
// Dış ortam korozivitesi: ISO 9223:2012 atmosferik korozivite kategorileri
// (C1-CX, Tablo 2 — karbon çeliği ilk yıl korozyon hızı) + toprak direnci
// korozivite sınıflandırması (gömülü hatlar için).

import type { Coefficient, Source } from "../types";

const MODULE = "externalEnvironment";

const SRC_ISO9223: Source = {
  type: "STANDARD",
  citation:
    "ISO 9223:2012(E), \"Corrosion of metals and alloys — Corrosivity of atmospheres — Classification, " +
    "determination and estimation\" — Tablo 2 \"Corrosion rates, rcorr, for the first year of exposure for " +
    "the different corrosivity categories\" (karbon çeliği sütunu, μm/a), ve Ek C Tablo C.1 (\"Description " +
    "of typical atmospheric environments\", C3-C5 için kıyı/klorür NİTELİKSEL tanımları). Bu oturumda " +
    "dosyanın TAM METNİ (13 sayfa, gerçek standart kopyası) doğrudan indirilip pdftotext ile okundu.",
  url: "https://www.eskom.co.za/wp-content/uploads/2024/04/Appendix_5.8.E_SO_9223_2012en.pdf",
  accessedDate: "2026-08-12",
};

const SRC_COASTAL_DISTANCE_PRACTICAL: Source = {
  type: "TEXTBOOK",
  citation:
    "ISO 9223'ün KENDİSİ mesafe-bazlı bir tablo VERMEZ (yalnızca 'distance of the site from the sea' gibi " +
    "niteliksel bir faktör listeler, Ek C NOT 1) — bu proje, birden fazla bağımsız kaplama/korozyon " +
    "mühendisliği pratiği kaynağının yakınsadığı KABA bir pratik kural kullanır: C5 kategorisi neredeyse " +
    "yalnızca kıyıya <2 km mesafede (çoğunlukla <0,5-1 km) görülür, >2 km'de tipik olarak C3/C4'e düşer.",
  accessedDate: "2026-08-12",
};

const SRC_SOIL_RESISTIVITY: Source = {
  type: "TEXTBOOK",
  citation:
    "Gömülü boru hattı korozyon mühendisliği pratiğinde yaygın olarak kullanılan toprak direnci sınıflandırma " +
    "tablosu (birden fazla bağımsız kaynakta AYNI sınır değerleriyle tekrarlanıyor: Pipeline & Gas Journal, " +
    "Corroconsult, ve genel ANSI/AWWA C105 pratiği): <500 ohm-cm ÇOK KOROZİF, 500-1000 KOROZİF, 1000-2000 " +
    "ORTA KOROZİF, 2000-10000 HAFİF KOROZİF, >10000 ÖNEMSİZ.",
  accessedDate: "2026-08-12",
};

export type Iso9223Category = "C1" | "C2" | "C3" | "C4" | "C5" | "CX";

const CARBON_STEEL_RATE_RANGES: Coefficient<Record<Iso9223Category, [number, number]>> = {
  id: "externalEnvironment.iso9223.carbonSteelRateRangeUmPerYear",
  module: MODULE,
  value: { C1: [0, 1.3], C2: [1.3, 25], C3: [25, 50], C4: [50, 80], C5: [80, 200], CX: [200, 700] },
  unit: "μm/yıl",
  description: "ISO 9223:2012 Tablo 2 — karbon çeliği için kategoriye göre ilk yıl korozyon hızı aralığı.",
  source: SRC_ISO9223,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation: "galvanizeit.org \"HDG Corrosion Rates for ISO Categories C1-C5/X\" — aynı aralıkları bağımsız olarak tekrarlıyor.",
      url: "https://galvanizeit.org/knowledgebase/article/hdg-corrosion-rates-for-iso-categories-c1-c5-x",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "HIGH",
  notes: "Standardın kendi Tablo 2'sinden BİREBİR okundu (μm/a satırı), ikinci bağımsız kaynakla tutarlı.",
};

const COASTAL_DISTANCE_HEURISTIC: Coefficient<{ maxDistanceKm: number; category: Iso9223Category }[]> = {
  id: "externalEnvironment.coastalDistanceHeuristicKm",
  module: MODULE,
  value: [
    { maxDistanceKm: 1, category: "C5" },
    { maxDistanceKm: 5, category: "C4" },
    { maxDistanceKm: 15, category: "C3" },
    { maxDistanceKm: 50, category: "C2" },
    { maxDistanceKm: Infinity, category: "C1" },
  ],
  unit: "km",
  description: "Kıyıya mesafeye göre KABA bir ISO 9223 kategorisi tahmini — ISO 9223'ün kendisinin VERMEDİĞİ, pratik bir yaklaşımdır.",
  source: SRC_COASTAL_DISTANCE_PRACTICAL,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "LOW",
  notes:
    "ISO 9223 §Ek C NOT 1 kendisi bu yaklaşımı SINIRLAR: klorür birikimi rüzgar yönü/hızı, topografya, " +
    "siper adaları, mesafe gibi ÇOK SAYIDA faktöre bağlıdır — TEK bir mesafe tablosu bunları YANSITAMAZ. Bu " +
    "banding yalnızca gerçek ölçüm/dose-response verisi YOKSA kaba bir başlangıç tahmini olarak kullanılmalı, " +
    "confidence=LOW ile UI'da her zaman sarı rozetle gösterilmelidir.",
};

const SOIL_RESISTIVITY_BANDS: Coefficient<{ maxOhmCm: number; label: string }[]> = {
  id: "externalEnvironment.soilResistivityBandsOhmCm",
  module: MODULE,
  value: [
    { maxOhmCm: 500, label: "ÇOK_KOROZİF" },
    { maxOhmCm: 1000, label: "KOROZİF" },
    { maxOhmCm: 2000, label: "ORTA_KOROZİF" },
    { maxOhmCm: 10000, label: "HAFİF_KOROZİF" },
    { maxOhmCm: Infinity, label: "ÖNEMSİZ" },
  ],
  unit: "ohm-cm",
  description: "Toprak direncine göre korozivite sınıflandırması (gömülü hatlar için).",
  source: SRC_SOIL_RESISTIVITY,
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Birden fazla bağımsız ikincil kaynak AYNI sınır değerlerinde (500/1000/2000/10000) örtüşüyor, ancak " +
    "hiçbir BİRİNCİL standart (ör. ANSI/AWWA C105'in kendisi) bu oturumda doğrudan okunmadı — MEDIUM.",
};

export const EXTERNAL_ENVIRONMENT_COEFFICIENTS: Coefficient[] = [
  CARBON_STEEL_RATE_RANGES as Coefficient,
  COASTAL_DISTANCE_HEURISTIC as Coefficient,
  SOIL_RESISTIVITY_BANDS as Coefficient,
];

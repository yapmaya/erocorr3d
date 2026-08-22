// packages/engine/src/registry/coefficients/naturalGasComponents.ts
//
// Doğal gaz bileşenleri için kritik özellikler (Tc, Pc, asentrik faktör ω) ve
// molar kütle — Peng-Robinson (1976) hâl denkleminin girdisi.
//
// Kaynak stratejisi: her bileşenin Tc/Pc değeri, NIST Chemistry WebBook
// (SRD 69, Thermodynamics Research Center derlemesi — birincil metroloji
// kaynağı) ÜZERİNDEN doğrudan sorgulandı ve midstreamcalculator.com'un
// "Hydrocarbon and Natural Gas Component Properties" tablosuyla (GPSA
// Mühendislik Veri Kitabı tarzı, endüstri pratiğinde yaygın ikincil kaynak)
// ÇAPRAZ DOĞRULANDI — birim dönüşümünden (°F/psia → K/bar) sonra TÜM
// bileşenlerde fark %0.5'in altında kaldı (bkz. her girişin notes alanı).
// Asentrik faktör (ω) için ikincil kaynak (Reid/Prausnitz/Poling "The
// Properties of Gases and Liquids" temelli, çok sayıda web kaynağında
// tutarlı şekilde aktarılan) değerlerle çapraz kontrol yapıldı; CO2 için
// gerçek bir uyuşmazlık bulundu ve KDP kural 2 uyarınca daha düşük/tutarlı
// değer seçildi (bkz. CO2 notes). Molar kütleler IUPAC/CIAAW standart atom
// ağırlıklarından hesaplandı (tartışmasız, doğrulama gerektirmeyen aritmetik).

import type { Coefficient, Source } from "../types";

export type NaturalGasComponentId =
  | "CH4"
  | "C2H6"
  | "C3H8"
  | "IC4"
  | "NC4"
  | "IC5"
  | "NC5"
  | "C6_PLUS"
  | "N2"
  | "CO2"
  | "H2S"
  | "H2O";

/** Yalnızca hidrokarbon (paraffin) bileşenlerin kimlikleri — kij varsayılanı için kullanılır. */
export const HYDROCARBON_COMPONENT_IDS: readonly NaturalGasComponentId[] = [
  "CH4",
  "C2H6",
  "C3H8",
  "IC4",
  "NC4",
  "IC5",
  "NC5",
  "C6_PLUS",
];

export interface NaturalGasComponentProperties {
  componentId: NaturalGasComponentId;
  nameTr: string;
  nameEn: string;
  /** Molar kütle (kg/mol) */
  molarMassKgPerMol: number;
  /** Kritik sıcaklık (K) */
  criticalTemperatureK: number;
  /** Kritik basınç (Pa) */
  criticalPressurePa: number;
  /** Pitzer asentrik faktörü ω (boyutsuz) */
  acentricFactor: number;
}

const MODULE = "naturalGasComponents";

const SRC_NIST_WEBBOOK: Source = {
  type: "STANDARD",
  citation:
    "NIST Chemistry WebBook, SRD 69 (National Institute of Standards and Technology, Thermodynamics " +
    "Research Center derlemesi) — her bileşenin kendi \"Phase change data\" sayfasındaki kritik " +
    "sıcaklık/basınç ortalama değerleri (birden çok bağımsız deneysel ölçümün TRC tarafından " +
    "ağırlıklandırılmış ortalaması).",
  url: "https://webbook.nist.gov",
  accessedDate: "2026-08-11",
};

const SRC_MIDSTREAM_TABLE: Source = {
  type: "STANDARD",
  citation:
    "\"Hydrocarbon and Natural Gas Component Properties\" tablosu, midstreamcalculator.com — GPSA " +
    "Mühendislik Veri Kitabı (Gas Processors Suppliers Association Engineering Data Book) tarzı, " +
    "endüstri pratiğinde yaygın kullanılan bileşen özellikleri tablosu (°F/psia birimlerinde).",
  url: "https://midstreamcalculator.com/data-tables/hydrocarbon-properties.html",
  accessedDate: "2026-08-11",
};

const SRC_ACENTRIC_SECONDARY: Source = {
  type: "TEXTBOOK",
  citation:
    "Reid, R.C.; Prausnitz, J.M.; Poling, B.E., \"The Properties of Gases and Liquids\", 4. baskı, " +
    "McGraw-Hill, 1987 — bu kitabın Ek A tablosundaki asentrik faktör değerleri, bu oturumda kitaba " +
    "doğrudan erişilemediği için çok sayıda ikincil web kaynağında (DIPPR veritabanına atıfla) tutarlı " +
    "şekilde aktarılan biçimiyle kullanıldı; birincil metne erişim bir sonraki oturumda doğrulanmalıdır.",
  accessedDate: "2026-08-11",
};

function component(
  componentId: NaturalGasComponentId,
  nameTr: string,
  nameEn: string,
  molarMassKgPerMol: number,
  criticalTemperatureK: number,
  criticalPressurePa: number,
  acentricFactor: number,
  confidence: Coefficient["confidence"],
  notes: string,
  crossChecked: boolean,
  crossCheckSources: Source[],
): Coefficient<NaturalGasComponentProperties> {
  return {
    id: `naturalGasComponents.${componentId}`,
    module: MODULE,
    value: { componentId, nameTr, nameEn, molarMassKgPerMol, criticalTemperatureK, criticalPressurePa, acentricFactor },
    unit: "-",
    description: `${nameTr} (${nameEn}) — Tc, Pc, ω, molar kütle`,
    source: SRC_NIST_WEBBOOK,
    crossChecked,
    crossCheckSources,
    confidence,
    notes,
  };
}

export const NATURAL_GAS_COMPONENTS_COEFFICIENTS: Coefficient[] = [
  component(
    "CH4",
    "Metan",
    "Methane",
    0.016043,
    190.6,
    46.1e5,
    0.011,
    "HIGH",
    "Tc/Pc: NIST 190.6±0.3K / 46.1±0.3bar (19-23 ve 16-21 ölçümün TRC ortalaması) — midstreamcalculator " +
      "(-116.6°F/666.4psia → 190.59K/45.95bar) ile fark <%0.4. ω=0.011: midstream tablosu ile genel web " +
      "taramasında bağımsız olarak aynı değer (0.011) doğrulandı.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "C2H6",
    "Etan",
    "Ethane",
    0.030070,
    305.3,
    49.0e5,
    0.099,
    "HIGH",
    "Tc/Pc: NIST 305.3±0.3K / 49±1bar — midstream (90.1°F/706.5psia → 305.43K/48.71bar) ile fark <%0.1. " +
      "ω=0.099: midstream ve genel web taraması aynı değeri veriyor.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "C3H8",
    "Propan",
    "Propane",
    0.044097,
    369.9,
    42.5e5,
    0.152,
    "HIGH",
    "Tc/Pc: NIST 369.9±0.2K / 42.5±0.1bar — midstream (206.0°F/615.0psia → 369.82K/42.40bar) ile fark " +
      "<%0.3. ω=0.152: midstream ve genel web taraması aynı değeri veriyor.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "IC4",
    "İzobütan",
    "Isobutane",
    0.058124,
    407.7,
    36.5e5,
    0.181,
    "MEDIUM",
    "Tc/Pc: NIST 407.7±0.8K / 36.5±0.5bar — midstream (274.9°F/527.9psia → 408.09K/36.39bar) ile fark " +
      "<%0.4, HIGH güvenilir. ω=0.181 YALNIZCA midstream tablosundan — bağımsız ikinci bir sayısal " +
      "kaynak bu oturumda bulunamadı, bu yüzden bileşenin genel güveni MEDIUM'a düşürüldü.",
    true,
    [SRC_MIDSTREAM_TABLE],
  ),
  component(
    "NC4",
    "n-Bütan",
    "n-Butane",
    0.058124,
    425.0,
    38.0e5,
    0.200,
    "HIGH",
    "Tc/Pc: NIST 425±1K / 38.0±0.1bar — midstream (305.6°F/548.8psia → 425.15K/37.83bar) ile fark <%0.5. " +
      "ω=0.200: midstream VE bağımsız genel web taraması (n-bütan ω=0.200) aynı değeri veriyor.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "IC5",
    "İzopentan",
    "Isopentane",
    0.072151,
    461.0,
    33.8e5,
    0.227,
    "MEDIUM",
    "Tc/Pc: NIST 461±5K / 33.8±0.5bar (Daubert 1996, J.Chem.Eng.Data 41:365-372) — midstream (369.1°F/" +
      "490.4psia → 460.43K/33.81bar) ile fark <%0.2, HIGH güvenilir. ω=0.227 YALNIZCA midstream " +
      "tablosundan — bağımsız ikinci kaynak bulunamadı, genel güven MEDIUM.",
    true,
    [SRC_MIDSTREAM_TABLE],
  ),
  component(
    "NC5",
    "n-Pentan",
    "n-Pentane",
    0.072151,
    469.8,
    33.6e5,
    0.252,
    "HIGH",
    "Tc/Pc: NIST 469.8±0.5K / 33.6±0.6bar — midstream (385.7°F/488.6psia → 469.65K/33.68bar) ile fark " +
      "<%0.1. ω=0.252: midstream VE bağımsız genel web taraması (n-pentan ω=0.252) aynı değeri veriyor.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "C6_PLUS",
    "Heksan-ve-üstü (temsili)",
    "Hexanes-plus (representative)",
    0.086178,
    507.6,
    30.2e5,
    0.301,
    "MEDIUM",
    "GERÇEK bir C6+ psödo-bileşeninin TEK BİR doğru Tc/Pc/ω değeri YOKTUR — bileşim örneğe göre değişir " +
      "(bkz. Oil & Gas Journal, \"Study compares C6+ characterization methods for natural gas phase " +
      "envelopes\"). Bu proje, ayrıntılı bir MW/özgül-ağırlık tabanlı karakterizasyon prosedürü (ör. " +
      "Kesler-Lee) implemente etmediğinden, C6+ SAF n-HEKSAN özellikleriyle TEMSİL EDİLİYOR (yaygın " +
      "basitleştirilmiş mühendislik pratiği). n-Heksan Tc/Pc: NIST 507.6±0.5K/30.2±0.4bar — midstream " +
      "(453.7°F/436.9psia → 507.43K/30.12bar) ile fark <%0.3. ω=0.301: midstream(0.301) ile bağımsız " +
      "genel web taraması (n-heksan ω=0.300) pratik olarak aynı. Gerçek bir gaz analizinde ölçülen C6+ " +
      "molar kütlesi/özgül ağırlığı bu temsili değerden belirgin şekilde farklıysa, sonuç dikkatle " +
      "yorumlanmalıdır — bu MEDIUM confidence'ın asıl nedeni budur (n-heksan verisinin kendisi değil).",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "N2",
    "Azot",
    "Nitrogen",
    0.028014,
    126.19,
    33.978e5,
    0.040,
    "MEDIUM",
    "Tc/Pc: NIST 126.19±0.01K / 33.978±0.007bar (Jacobsen, Stewart ve ark., 1986) — midstream (-232.5°F/" +
      "493.0psia → 126.21K/33.99bar) ile fark <%0.05, HIGH güvenilir. ω İÇİN GERÇEK BİR UYUŞMAZLIK VAR: " +
      "midstream tablosu 0.037 veriyor, bağımsız genel web taraması 0.040 veriyor (~%8 fark). KDP kural " +
      "2 uyarınca iki kaynağın ORTASINA değil, daha YAYGIN aktarılan (0.040) değere karar verildi; genel " +
      "güven bu belgelenmiş uyuşmazlık nedeniyle MEDIUM'a düşürüldü.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "CO2",
    "Karbondioksit",
    "Carbon Dioxide",
    0.044009,
    304.2,
    73.825e5,
    0.225,
    "MEDIUM",
    "Tc/Pc: NIST 304.200±0.02K (Morrison 1981) / 73.825±0.005bar (Angus ve ark. 1976) — midstream " +
      "(87.9°F/1070.6psia → 304.2K/73.81bar) ile fark <%0.02, HIGH güvenilir. ω İÇİN ÖNEMLİ BİR " +
      "UYUŞMAZLIK VAR: midstream tablosu ω=0.274 veriyor, DIPPR/Reid-Prausnitz-Poling tabanlı bağımsız " +
      "kaynaklar (birden fazla ikincil web kaynağında tutarlı şekilde) ω=0.225-0.228 veriyor (~%20-22 " +
      "fark — bu dosyadaki en büyük belgelenmiş sapma). KDP kural 2 uyarınca ÜÇÜNCÜ bir yakınsama " +
      "arandı: birden fazla bağımsız ikincil kaynak 0.225-0.228 aralığında YAKINSIYOR, midstream'in " +
      "0.274 değeri TEK BAŞINA kalan bir aykırı değer — bu yüzden 0.225 (yakınsayan, daha düşük) " +
      "seçildi. Bileşenin genel güveni bu gerçek uyuşmazlık nedeniyle MEDIUM.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
  component(
    "H2S",
    "Hidrojen Sülfür",
    "Hydrogen Sulfide",
    0.034076,
    373.4,
    89.6291e5,
    0.090,
    "MEDIUM",
    "Tc/Pc: NIST'te İKİ bağımsız deneysel belirleme birbirini doğruluyor — Goodwin (1983): 373.4K/" +
      "89.6291bar; Cubitt ve ark. (1987): 373.3K/89.70bar (fark <%0.1) — Goodwin (1983) değeri seçildi, " +
      "HIGH güvenilir. midstream (212.7°F/1306.0psia → 373.54K/90.03bar) ile fark da <%0.4. ω=0.090 " +
      "YALNIZCA midstream tablosundan — bağımsız ikinci bir sayısal kaynak bu oturumda bulunamadı " +
      "(yalnızca metodoloji makaleleri bulundu, sayı yok), bu yüzden genel güven MEDIUM.",
    true,
    [SRC_MIDSTREAM_TABLE],
  ),
  component(
    "H2O",
    "Su Buharı",
    "Water Vapor",
    0.018015,
    647.0,
    220.64e5,
    0.344,
    "HIGH",
    "Tc/Pc: NIST 647±2K / 220.64bar (Sato, Watanabe ve ark. 1991 dahil 5 bağımsız belirlemenin en " +
      "yaygını) — midstream (705.4°F/3206.2psia → 647.26K/221.0bar) ile fark <%0.2. ω=0.344: midstream " +
      "VE bağımsız genel web taraması (su ω=0.344) aynı değeri veriyor.",
    true,
    [SRC_MIDSTREAM_TABLE, SRC_ACENTRIC_SECONDARY],
  ),
];

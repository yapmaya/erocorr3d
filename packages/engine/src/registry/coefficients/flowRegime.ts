// packages/engine/src/registry/coefficients/flowRegime.ts
//
// Beggs-Brill (1973) çok-fazlı akış rejimi haritası ve sıvı tutulumu
// (holdup) korelasyonu sabitleri.
//
// ⚠ KAPSAM NOTU (KDP kural 4 — bulunamayan kaynak dürüstlüğü): Bu modül
// başlangıçta hem Taitel-Dukler (1976) hem Beggs-Brill (1973) modellerini
// kapsayacak şekilde planlandı. Taitel-Dukler'in (1976) TAM mekanistik
// denklemleri (dengedeki tabakalı akış sıvı seviyesi momentum dengesi +
// X/F/T/K boyutsuz geçiş kriterleri) için bu oturumda YOĞUN bir arama
// yapıldı: orijinal AIChE Journal makalesi Wiley üzerinden ücretli
// (erişilemedi), en az 6 farklı ikincil kaynak/PDF denendi (Chen & Spedding
// 1980 Stanford PDF, çeşitli Scribd/Studocu/academia.edu kopyaları,
// Thermopedia) — hepsi ya erişim engeli (403/bot koruması/ücretli) verdi
// ya da denklemler PDF içinde görüntü/formül nesnesi olarak gömülüydü ve
// metne dönüştürülemedi. KDP kural 4 gereği bu denklemler UYDURULMADI.
// Bunun yerine, AYNI mühendislik amacına (yatay/eğimli boru akış rejimi
// sınıflandırması + sıvı tutulumu) hizmet eden, TAM olarak ve güvenilir
// şekilde kaynaklanabilen Beggs-Brill (1973) modeli uygulandı — bu, aynı
// dönemin ve literatürün, sahada en az Taitel-Dukler kadar (hatta boru
// hattı basınç düşümü hesaplarında ondan daha yaygın) kullanılan, kabul
// görmüş bir alternatifidir. Taitel-Dukler'in tam implementasyonu, birincil
// metne erişim sağlanabilirse gelecek bir oturumun konusu olmalıdır.
//
// Kaynak: Beggs, H.D.; Brill, J.P., "A Study of Two-Phase Flow in Inclined
// Pipes", JPT, Mayıs 1973, s.607-617. Bu oturumda ÜÇ bağımsız ikincil kaynak
// (Whitson wiki, midstreamcalculator.com, Pengtools wiki) TÜM sabitlerde
// (eğim düzeltmesi dahil) BİREBİR aynı değerleri verdi — bu, bu dosyadaki
// en yüksek çapraz-doğrulama derecesine sahip katsayı grubudur.

import type { Coefficient, Source } from "../types";

const MODULE = "flowRegime";

const SRC_WHITSON_BEGGS_BRILL: Source = {
  type: "THESIS",
  citation:
    "Whitson, C.H. (ve ekibi), \"Beggs and Brill\", Whitson PVT/akış korelasyonları wiki'si — " +
    "yatay tutulum denklemi H_L(0)=A×λL^α/NFR^β tablosu ve eğim düzeltmesi D/δ/ε/ζ sabitleri.",
  url: "https://wiki.whitson.com/pipeflow/correlations/beggs_brill/",
  accessedDate: "2026-08-11",
};

const SRC_MIDSTREAM_BEGGS_BRILL: Source = {
  type: "STANDARD",
  citation:
    "\"Beggs-Brill Fundamentals\" mühendislik rehberi, midstreamcalculator.com — akış rejimi sınır " +
    "çizgileri L1-L4, sınıflandırma kuralları, yatay tutulum a/b/c tablosu, eğim düzeltmesi C formülü " +
    "ve d/e/f/g tablosu, geçiş bölgesi (transition) enterpolasyon formülü.",
  url: "https://midstreamcalculator.com/engineering/multiphase-flow/beggs-brill-fundamentals.html",
  accessedDate: "2026-08-11",
};

const SRC_PENGTOOLS_BEGGS_BRILL: Source = {
  type: "THESIS",
  citation:
    "\"Beggs and Brill correlation\", Pengtools wiki — eğim düzeltmesi C formülü ve d/e/f/g tablosu " +
    "(N_LV/λL/N_FR üslerinin ATANMASI midstreamcalculator ile BİREBİR çapraz doğrulandı; bu, üç " +
    "kaynaklı bir doğrulamadır).",
  url: "https://wiki.pengtools.com/index.php?title=Beggs_and_Brill_correlation",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Akış rejimi sınır çizgileri (L1-L4)
// ─────────────────────────────────────────────────────────────────────────

export interface BeggsBrillBoundaryConstants {
  l1Coefficient: number;
  l1Exponent: number;
  l2Coefficient: number;
  l2Exponent: number;
  l3Coefficient: number;
  l3Exponent: number;
  l4Coefficient: number;
  l4Exponent: number;
}

const BEGGS_BRILL_BOUNDARY_CONSTANTS: Coefficient<BeggsBrillBoundaryConstants> = {
  id: "flowRegime.beggsBrillBoundaryConstants",
  module: MODULE,
  value: {
    l1Coefficient: 316,
    l1Exponent: 0.302,
    l2Coefficient: 0.0009252,
    l2Exponent: -2.4684,
    l3Coefficient: 0.10,
    l3Exponent: -1.4516,
    l4Coefficient: 0.5,
    l4Exponent: -6.738,
  },
  unit: "-",
  description:
    "Beggs-Brill akış rejimi sınır çizgileri: L1=316λL^0.302, L2=0.0009252λL^-2.4684, " +
    "L3=0.10λL^-1.4516, L4=0.5λL^-6.738 (λL: no-slip sıvı tutulumu)",
  source: SRC_MIDSTREAM_BEGGS_BRILL,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation:
        "Genel web taraması sentezi (birden fazla bağımsız mühendislik referansı, PDFCOFFEE \"Metode " +
        "Beggs & Brill\" dahil) BİREBİR aynı dört sabiti doğruladı.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes: "İki bağımsız kaynak grubu birebir aynı sekiz sabiti veriyor.",
};

// ─────────────────────────────────────────────────────────────────────────
// Yatay sıvı tutulumu H_L(0) = a·λL^b / NFR^c
// ─────────────────────────────────────────────────────────────────────────

export type BeggsBrillPattern = "SEGREGATED" | "INTERMITTENT" | "DISTRIBUTED";

export interface BeggsBrillHorizontalHoldupRow {
  pattern: BeggsBrillPattern;
  a: number;
  b: number;
  c: number;
}

const BEGGS_BRILL_HORIZONTAL_HOLDUP: Coefficient<BeggsBrillHorizontalHoldupRow[]> = {
  id: "flowRegime.beggsBrillHorizontalHoldup",
  module: MODULE,
  value: [
    { pattern: "SEGREGATED", a: 0.98, b: 0.4846, c: 0.0868 },
    { pattern: "INTERMITTENT", a: 0.845, b: 0.5351, c: 0.0173 },
    { pattern: "DISTRIBUTED", a: 1.065, b: 0.5824, c: 0.0609 },
  ],
  unit: "-",
  description: "Yatay (θ=0) sıvı tutulumu H_L(0)=a×λL^b/NFR^c katsayıları, akış rejimine göre",
  source: SRC_WHITSON_BEGGS_BRILL,
  crossChecked: true,
  crossCheckSources: [SRC_MIDSTREAM_BEGGS_BRILL, SRC_PENGTOOLS_BEGGS_BRILL],
  confidence: "HIGH",
  notes: "Üç bağımsız kaynakta birebir aynı dokuz sabit doğrulandı.",
};

// ─────────────────────────────────────────────────────────────────────────
// Eğim düzeltmesi ψ(θ) — C = (1-λL)·ln(d·λL^e·NLV^f·NFR^g)
// ─────────────────────────────────────────────────────────────────────────

export interface BeggsBrillInclinationRow {
  pattern: BeggsBrillPattern;
  d: number;
  e: number;
  f: number;
  g: number;
}

const BEGGS_BRILL_INCLINATION_UPHILL: Coefficient<BeggsBrillInclinationRow[]> = {
  id: "flowRegime.beggsBrillInclinationUphill",
  module: MODULE,
  value: [
    { pattern: "SEGREGATED", d: 0.011, e: -3.768, f: 3.539, g: -1.614 },
    { pattern: "INTERMITTENT", d: 2.96, e: 0.305, f: -0.4473, g: 0.0978 },
    { pattern: "DISTRIBUTED", d: 1, e: 0, f: 0, g: 0 },
  ],
  unit: "-",
  description:
    "Yokuş yukarı (θ>0) eğim düzeltmesi C=(1-λL)·ln(d·λL^e·NLV^f·NFR^g) katsayıları — DISTRIBUTED " +
    "için düzeltme yoktur (C=0, d=1/e=f=g=0 ile ln(1)=0 sağlanır).",
  source: SRC_MIDSTREAM_BEGGS_BRILL,
  crossChecked: true,
  crossCheckSources: [SRC_PENGTOOLS_BEGGS_BRILL, SRC_WHITSON_BEGGS_BRILL],
  confidence: "HIGH",
  notes:
    "ÖNEMLİ ÇAPRAZ DOĞRULAMA NOTU: Whitson kaynağının ilk okunuşunda (D,δ,ε,ζ) sütun sırası " +
    "midstreamcalculator/pengtools'un (d,e,f,g) sırasıyla YÜZEYSEL OLARAK uyuşmuyor gibi göründü " +
    "(SEGREGATED için Whitson ε,ζ=-1.614,3.539 iken diğerleri f,g=3.539,-1.614 veriyordu) — bu oturumda " +
    "pengtools'un AÇIK formülüyle (hangi sabitin NLV, hangisinin NFR üssü olduğu net belirtilmiş) " +
    "midstreamcalculator BİREBİR eşleşti, bu yüzden Whitson'ın sütun sırasının farklı bir kongvansiyon " +
    "(λL,NFR,NLV) izlediği sonucuna varıldı — üç kaynak da AYNI sayıları veriyor, yalnızca sunum " +
    "sırası farklıydı. Nihai değerler iki kaynağın AÇIK formülüyle doğrulandı.",
};

const BEGGS_BRILL_INCLINATION_DOWNHILL: Coefficient<BeggsBrillInclinationRow> = {
  id: "flowRegime.beggsBrillInclinationDownhill",
  module: MODULE,
  value: { pattern: "SEGREGATED", d: 4.7, e: -0.3692, f: 0.1244, g: -0.5056 },
  unit: "-",
  description:
    "Yokuş aşağı (θ<0) eğim düzeltmesi C=(1-λL)·ln(d·λL^e·NLV^f·NFR^g) katsayıları — TÜM akış " +
    "rejimleri için TEK bir katsayı seti kullanılır (pattern alanı yalnızca tip uyumluluğu içindir).",
  source: SRC_MIDSTREAM_BEGGS_BRILL,
  crossChecked: true,
  crossCheckSources: [SRC_PENGTOOLS_BEGGS_BRILL],
  confidence: "HIGH",
  notes: "İki bağımsız kaynak birebir aynı dört sabiti veriyor.",
};

// ─────────────────────────────────────────────────────────────────────────
// ψ(θ) eğim düzeltme fonksiyonunun kendi sabitleri
// ─────────────────────────────────────────────────────────────────────────

export interface PsiFormulaConstants {
  angleMultiplier: number;
  cubicTermCoefficient: number;
}

const PSI_FORMULA_CONSTANTS: Coefficient<PsiFormulaConstants> = {
  id: "flowRegime.psiFormulaConstants",
  module: MODULE,
  value: { angleMultiplier: 1.8, cubicTermCoefficient: 0.333 },
  unit: "-",
  description: "ψ=1+C[sin(1.8θ)-0.333sin³(1.8θ)] formülünün kendi sabitleri",
  source: SRC_MIDSTREAM_BEGGS_BRILL,
  crossChecked: true,
  crossCheckSources: [
    SRC_PENGTOOLS_BEGGS_BRILL,
    {
      type: "OPEN_SOURCE_CODE",
      citation:
        "PressureDrop.jl (jnoynaert), src/pressurecorrelations.jl — açık kaynaklı çalışan bir Julia " +
        "implementasyonu. Bu kaynak, formüldeki açı biriminin (derece→radyan dönüşümünün 1.8 çarpanından " +
        "ÖNCE mi SONRA mı yapılması gerektiği) belirsizliğini ÇÖZMEK için kullanıldı: kod açıkça açıyı " +
        "önce radyana çevirip SONRA 1.8 ile çarpıyor (`sin(1.8*α)`, α zaten radyan) — bu, bu oturumda " +
        "yapılan bağımsız bir matematiksel analizle (θ=50°'de tepe noktası) TUTARLI bulundu.",
      url: "https://raw.githubusercontent.com/jnoynaert/PressureDrop.jl/master/src/pressurecorrelations.jl",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes:
    "Sayısal sabitler (1.8, 0.333) iki bağımsız kaynakta birebir aynı; açı birimi belirsizliği çalışan " +
    "açık kaynak koduyla çözüldü (bkz. fluids/flowRegime.ts dosya başı yorumu).",
};

export const FLOW_REGIME_COEFFICIENTS: Coefficient[] = [
  BEGGS_BRILL_BOUNDARY_CONSTANTS as Coefficient,
  BEGGS_BRILL_HORIZONTAL_HOLDUP as Coefficient,
  BEGGS_BRILL_INCLINATION_UPHILL as Coefficient,
  BEGGS_BRILL_INCLINATION_DOWNHILL as Coefficient,
  PSI_FORMULA_CONSTANTS as Coefficient,
];

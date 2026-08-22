// packages/engine/src/registry/coefficients/friction.ts
//
// Boru içi akış sürtünme faktörü hesapları için sabitler: Reynolds sayısı
// rejim eşikleri, Churchill (1977) korelasyon sabitleri ve (yalnızca
// bilgi/varsayılan öneri amaçlı) malzeme tipine göre tipik mutlak
// pürüzlülük tablosu.
//
// NOT: Colebrook-White denkleminin kendisi (1/√f = -2log10(ε/3.7D+2.51/
// (Re√f))) sabit içermeyen bir formüldür — bu yüzden burada ayrı bir
// katsayı YOKTUR, doğrudan fluids/friction.ts içinde uygulanır.

import type { Coefficient, Source } from "../types";

const MODULE = "friction";

const SRC_WIKIPEDIA_DARCY: Source = {
  type: "TEXTBOOK",
  citation:
    "\"Darcy friction factor formulae\" (Wikipedia, genel referans derlemesi) — Churchill (1977) " +
    "denklemi ve Colebrook-White denklemi standart biçimleriyle.",
  url: "https://en.wikipedia.org/wiki/Darcy_friction_factor_formulae",
  accessedDate: "2026-08-11",
};

const SRC_WHITE_FLUID_MECHANICS: Source = {
  type: "TEXTBOOK",
  citation:
    "White, F.M., \"Fluid Mechanics\", 7. baskı, McGraw-Hill, 2010 — Churchill (1977) denklemi " +
    "(problem 8.49 formülasyonu, Numerade/Chegg üzerinden ikincil olarak doğrulandı) ve Reynolds " +
    "sayısı laminer/geçiş/türbülans eşikleri (Re<2300 laminer, 2300-4000 geçiş, Re>4000 türbülans).",
  accessedDate: "2026-08-11",
};

const SRC_ROUGHNESS_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "Moody, L.F., \"Friction Factors for Pipe Flow\", Transactions of the ASME, 66(8), 1944 — orijinal " +
    "makaleye bu oturumda doğrudan erişilemedi; değerler bu makaleye atıfta bulunan çok sayıda ikincil " +
    "mühendislik referans tablosu (industrialmonitordirect.com, moodychartcalc.com, enggcyclopedia.com) " +
    "üzerinden ÇAPRAZ DOĞRULANARAK derlendi.",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Reynolds sayısı rejim eşikleri
// ─────────────────────────────────────────────────────────────────────────

export interface ReynoldsThresholds {
  laminarMax: number;
  turbulentMin: number;
}

const REYNOLDS_THRESHOLDS: Coefficient<ReynoldsThresholds> = {
  id: "friction.reynoldsThresholds",
  module: MODULE,
  value: { laminarMax: 2300, turbulentMin: 4000 },
  unit: "-",
  description: "Boru içi akışta laminer (Re<2300) / geçiş (2300-4000) / türbülans (Re>4000) eşikleri",
  source: SRC_WHITE_FLUID_MECHANICS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Genel web taraması sentezi (nuclear-power.com ve türevleri) — aynı 2300/4000 eşiklerini " +
        "bağımsız olarak doğruluyor; bazı kaynaklar 2000/3500 gibi hafifçe farklı yuvarlamalar " +
        "kullanıyor ancak 2300/4000 en yaygın/standart (White ders kitabı) çift olarak kabul edildi.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes:
    "Bu eşikler kesin fiziksel sabitler değil, mühendislik pratiğinde yaygın kabul gören yuvarlak " +
    "sayılardır (gerçek geçiş, boru pürüzlülüğü/titreşim/giriş koşullarına bağlı olarak 2000-4000 " +
    "arasında herhangi bir yerde olabilir) — bu proje endüstri standardı 2300/4000 çiftini kullanır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Churchill (1977) korelasyon sabitleri
// ─────────────────────────────────────────────────────────────────────────

export interface ChurchillConstants {
  theta1LnConstant: number;
  theta1RoughnessCoefficient: number;
  theta1ReynoldsExponent: number;
  theta1OuterExponent: number;
  theta2ReynoldsConstant: number;
  theta2OuterExponent: number;
  sumExponent: number;
  reynoldsLaminarExponent: number;
  outerExponent: number;
}

const CHURCHILL_CONSTANTS: Coefficient<ChurchillConstants> = {
  id: "friction.churchillConstants",
  module: MODULE,
  value: {
    theta1LnConstant: 2.457,
    theta1RoughnessCoefficient: 0.27,
    theta1ReynoldsExponent: 0.9,
    theta1OuterExponent: 16,
    theta2ReynoldsConstant: 37530,
    theta2OuterExponent: 16,
    sumExponent: 1.5,
    reynoldsLaminarExponent: 12,
    outerExponent: 1 / 12,
  },
  unit: "-",
  description:
    "Churchill (1977) tüm rejimler (laminer-geçiş-türbülans) için tek denklem sürtünme faktörü " +
    "korelasyonunun sabitleri: f=8[(8/Re)^12+1/(Θ1+Θ2)^1.5]^(1/12), Θ1={-2.457·ln[(7/Re)^0.9+0.27ε/D]}^16, " +
    "Θ2=(37530/Re)^16.",
  source: SRC_WIKIPEDIA_DARCY,
  crossChecked: true,
  crossCheckSources: [SRC_WHITE_FLUID_MECHANICS],
  confidence: "HIGH",
  notes:
    "İki bağımsız kaynak (Wikipedia genel referans derlemesi ve White \"Fluid Mechanics\" ders " +
    "kitabından bir problem — Numerade/Chegg üzerinden ikincil doğrulama) BİREBİR aynı sabitleri " +
    "veriyor. Bu, DARCY sürtünme faktörünü döndürür (Fanning DEĞİL) — bkz. fluids/friction.ts başlık " +
    "yorumu, duvar kayma gerilmesi formülünde bu ayrım kritik önemdedir.",
};

// ─────────────────────────────────────────────────────────────────────────
// Tipik mutlak pürüzlülük tablosu (yalnızca bilgi/varsayılan öneri amaçlı —
// gerçek hesap her zaman types/geometry.ts::roughnessMm kullanıcı girdisini
// kullanır, bu tablo yalnızca UI'da "tipik değer öner" özelliği içindir)
// ─────────────────────────────────────────────────────────────────────────

export type PipeRoughnessMaterial =
  | "COMMERCIAL_STEEL_NEW"
  | "COMMERCIAL_STEEL_CORRODED"
  | "STAINLESS_STEEL"
  | "CAST_IRON"
  | "GALVANIZED_STEEL"
  | "DRAWN_TUBING"
  | "THERMOPLASTIC"
  | "GRE"
  | "CONCRETE";

export interface PipeRoughnessRow {
  material: PipeRoughnessMaterial;
  /** Tipik/temsili mutlak pürüzlülük (mm) — tekil değer veya [min,max] aralık ortası kullanılabilir */
  typicalRoughnessMm: number;
  /** Bilinen aralık (mm), kaynaklarda gözlemlenen yayılım */
  rangeMm: [number, number];
}

const PIPE_ROUGHNESS_TABLE: Coefficient<PipeRoughnessRow[]> = {
  id: "friction.pipeRoughnessTable",
  module: MODULE,
  value: [
    { material: "COMMERCIAL_STEEL_NEW", typicalRoughnessMm: 0.045, rangeMm: [0.045, 0.09] },
    { material: "COMMERCIAL_STEEL_CORRODED", typicalRoughnessMm: 0.5, rangeMm: [0.15, 3.0] },
    { material: "STAINLESS_STEEL", typicalRoughnessMm: 0.015, rangeMm: [0.015, 0.046] },
    { material: "CAST_IRON", typicalRoughnessMm: 0.26, rangeMm: [0.25, 0.85] },
    { material: "GALVANIZED_STEEL", typicalRoughnessMm: 0.15, rangeMm: [0.15, 0.15] },
    { material: "DRAWN_TUBING", typicalRoughnessMm: 0.0015, rangeMm: [0.0015, 0.0015] },
    { material: "THERMOPLASTIC", typicalRoughnessMm: 0.0015, rangeMm: [0.0015, 0.007] },
    { material: "GRE", typicalRoughnessMm: 0.0015, rangeMm: [0.0015, 0.0015] },
    { material: "CONCRETE", typicalRoughnessMm: 1.0, rangeMm: [0.3, 3.0] },
  ],
  unit: "mm",
  description:
    "Malzeme tipine göre TİPİK mutlak pürüzlülük — yalnızca UI'da \"varsayılan değer öner\" özelliği " +
    "içindir; gerçek hesap her zaman kullanıcının types/geometry.ts::roughnessMm alanına girdiği " +
    "GERÇEK ölçülen/varsayılan değeri kullanır, bu tablodan OTOMATİK ÇEKİLMEZ.",
  source: SRC_ROUGHNESS_SECONDARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation:
        "enggcyclopedia.com \"Absolute Pipe Roughness\" tablosu — bağımsız üçüncü kaynak olarak " +
        "kullanıldı (özellikle CAST_IRON aralığının doğrulanmasında: 0.25-0.8mm, diğer iki kaynağın " +
        "0.26mm ve 0.85mm uç değerlerini içeren bir aralık — üç kaynak birlikte TUTARLI).",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "GALVANIZED_STEEL için gerçek bir kaynak uyuşmazlığı bulundu: iki kaynak 0.15mm'de birleşiyor, " +
    "enggcyclopedia.com 0.015mm veriyor (~10× fark — muhtemelen bir yazım/ondalık hatası, birden fazla " +
    "bağımsız kaynağın birleştiği 0.15mm değeri KDP kural 2 uyarınca seçildi). STAINLESS_STEEL için " +
    "kaynaklar 0.015mm (parlatılmış/çekilmiş) ile 0.046mm (kaynaklı/haddelenmiş, CS ile aynı) arasında " +
    "değişiyor — düşük uç temsili değer olarak seçildi, notlarda üst sınır belirtildi. GRE için bu " +
    "oturumda ÖZEL bir kaynak bulunamadı; çok pürüzsüz termoplastik/kompozit iç yüzey MANTIKSAL " +
    "VARSAYIMIYLA drawn tubing değeriyle eşleştirildi — bu satır tek başına ele alınırsa UNVERIFIED " +
    "sayılmalıdır (tablo geneli MEDIUM, ama GRE satırı için kullanıcı ek doğrulama yapmalıdır). Hiçbir " +
    "orijinal Moody (1944) makale metnine bu oturumda doğrudan erişilemedi (paywall/tarama) — bu " +
    "yüzden tablo geneli HIGH değil MEDIUM işaretlendi.",
};

export const FRICTION_COEFFICIENTS: Coefficient[] = [
  REYNOLDS_THRESHOLDS as Coefficient,
  CHURCHILL_CONSTANTS as Coefficient,
  PIPE_ROUGHNESS_TABLE as Coefficient,
];

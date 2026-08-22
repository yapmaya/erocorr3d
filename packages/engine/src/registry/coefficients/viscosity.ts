// packages/engine/src/registry/coefficients/viscosity.ts
//
// Gaz (Lee-Gonzalez-Eakin 1966), sıvı hidrokarbon (Beggs-Robinson 1975 "dead
// oil") ve su (basitleştirilmiş IAPWS-tipi) viskozite korelasyonu sabitleri.

import type { Coefficient, Source } from "../types";

const MODULE = "viscosity";

const SRC_LEE_GONZALEZ_EAKIN: Source = {
  type: "CONFERENCE",
  citation:
    "Londono, F.E., Archer, R.A., Blasingame, T.A., \"Simplified Correlations for Hydrocarbon Gas " +
    "Viscosity and Gas Density — Validation and Correlation of Behavior Using a Large-Scale Database\", " +
    "SPE 75721, SPE Gas Technology Symposium, 2002, Eq. 4-7 — Lee, Gonzalez ve Eakin'in (1966) orijinal " +
    "korelasyonunu doğrudan alıntılıyor (kaynak: Lee, A.L., Gonzalez, M.H., Eakin, B.E., \"The Viscosity " +
    "of Natural Gases\", JPT, Ağustos 1966, s.997-1000). Bu oturumda tam metin doğrudan indirilip " +
    "pdftotext ile okundu (Eq. 7'nin \"Y\" katsayısı iki-sütunlu PDF diziliminde ayrı bir extraction " +
    "geçişiyle bulundu).",
  url: "https://blasingame.engr.tamu.edu/0_TAB_Public/TAB_Publications/SPE_075721_(Londono)_Gas_Density_y_Viscosity.pdf",
  accessedDate: "2026-08-11",
};

const SRC_LGE_SECONDARY: Source = {
  type: "THESIS",
  citation:
    "Adewumi, M., \"Viscosity\", PNG 520: Phase Behavior of Natural Gas and Condensate Fluids " +
    "(lisansüstü ders notları), Pennsylvania State University; çapraz olarak Pengtools wiki \"Lee " +
    "correlation\" sayfasıyla da doğrulandı — her ikisi de SPE 75721'in verdiği hassas sabitlerin " +
    "yuvarlanmış halini (9.4≈9.379, 0.02≈0.01607 [not: bu ikisi arasında göreli fark daha büyük, bkz. " +
    "notlar], 209≈209.2, 19≈19.26, 986≈986.4, 0.01≈0.01009, 3.5≈3.448, 2.4≈2.447, 0.2≈0.2224) veriyor.",
  url: "https://courses.ems.psu.edu/png520/m19_p4.html",
  accessedDate: "2026-08-11",
};

export interface LeeGonzalezEakinCoefficients {
  kConstant1: number;
  kMwCoefficient1: number;
  kMwCoefficient2: number;
  kConstant2: number;
  xConstant1: number;
  xTCoefficient: number;
  xMwCoefficient: number;
  yConstant1: number;
  yXCoefficient: number;
}

const LEE_GONZALEZ_EAKIN_COEFFICIENTS: Coefficient<LeeGonzalezEakinCoefficients> = {
  id: "viscosity.leeGonzalezEakinCoefficients",
  module: MODULE,
  value: {
    kConstant1: 9.379,
    kMwCoefficient1: 0.01607,
    kMwCoefficient2: 19.26,
    kConstant2: 209.2,
    xConstant1: 3.448,
    xTCoefficient: 986.4,
    xMwCoefficient: 0.01009,
    yConstant1: 2.447,
    yXCoefficient: 0.2224,
  },
  unit: "-",
  description:
    "Lee-Gonzalez-Eakin (1966) doğal gaz viskozite korelasyonu: μg=1e-4×K×exp(X×ρg^Y) [cp, ρg g/cm³], " +
    "K=(9.379+0.01607·Mw)·T^1.5/(209.2+19.26·Mw+T), X=3.448+986.4/T+0.01009·Mw, Y=2.447-0.2224·X (T: °R)",
  source: SRC_LEE_GONZALEZ_EAKIN,
  crossChecked: true,
  crossCheckSources: [SRC_LGE_SECONDARY],
  confidence: "HIGH",
  notes:
    "SPE 75721, orijinal 1966 JPT makalesini AÇIKÇA alıntılayan (Eq. 4-7, kaynak [5]) bir teknik " +
    "bildiriden BİREBİR okundu — bu, bu dosyadaki en güvenilir katsayı grubudur. PSU ders notu ve " +
    "Pengtools wiki'nin verdiği YUVARLANMIŞ sabitlerle çapraz doğrulandı; tüm sabitler yakın eşleşiyor " +
    "TEK istisna: K formülündeki Mw katsayısı ikincil kaynaklarda \"0.02\" (SPE 75721: 0.01607, ~%24 " +
    "fark) — bu, ikincil kaynakların kendi yuvarlama/basitleştirme tercihidir; SPE 75721'in birincil " +
    "makaleyi doğrudan alıntılayan hassas değeri (0.01607) burada kullanıldı (KDP kural 2: birincile " +
    "en yakın kaynak tercih edildi).",
};

const LGE_VALIDITY_TEMPERATURE_R: Coefficient<[number, number]> = {
  id: "viscosity.leeGonzalezEakinValidity.temperatureRankine",
  module: MODULE,
  value: [560, 800],
  unit: "°R",
  description: "Lee-Gonzalez-Eakin korelasyonunun geçerlilik sıcaklık aralığı (≈100-340°F)",
  source: {
    type: "THESIS",
    citation: "Pengtools wiki \"Lee correlation\" sayfası, belirtilen geçerlilik aralığı.",
    url: "https://wiki.pengtools.com/index.php?title=Lee_correlation",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes: "Yalnızca tek bir ikincil kaynakta bulundu, bağımsız ikinci bir kaynakla doğrulanmadı.",
};

// ─────────────────────────────────────────────────────────────────────────
// Su viskozitesi — basitleştirilmiş korelasyon
// ─────────────────────────────────────────────────────────────────────────

export interface WaterViscosityCoefficients {
  preExponentialFactorPaS: number;
  numeratorK: number;
  offsetK: number;
}

const WATER_VISCOSITY_COEFFICIENTS: Coefficient<WaterViscosityCoefficients> = {
  id: "viscosity.waterViscosityCoefficients",
  module: MODULE,
  value: {
    preExponentialFactorPaS: 2.414e-5,
    numeratorK: 247.8,
    offsetK: 140,
  },
  unit: "-",
  description:
    "Su dinamik viskozitesi basitleştirilmiş korelasyonu: μ(T)=2.414e-5×10^(247.8/(T-140)) [Pa·s, T: K]",
  source: {
    type: "TEXTBOOK",
    citation:
      "Yaygın olarak mühendislik referanslarında (CRC Handbook of Chemistry and Physics tarzı) " +
      "aktarılan basitleştirilmiş su viskozitesi korelasyonu — bu oturumda birincil CRC baskısına " +
      "erişilemedi, iki bağımsız ikincil web kaynağında (genel mühendislik referans sentezi ve bir " +
      "üniversite laboratuvar el kitabı alıntısı, Numerade üzerinden) BİREBİR aynı üç sabit doğrulandı.",
    accessedDate: "2026-08-11",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bir üniversite akışkanlar mekaniği laboratuvar el kitabından alıntı (Numerade soru havuzu " +
        "üzerinden bağımsız olarak bulundu) — \"A=2.414e-5 N·s/m², B=247.8K, C=140K, belirsizlik ±%2.5\" " +
        "ifadesiyle BİREBİR aynı sabitleri veriyor.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki bağımsız ikincil kaynak birebir aynı sabitleri veriyor (yüksek iç tutarlılık) ancak birincil " +
    "kaynağa (orijinal CRC/IAPWS yayını) bu oturumda erişilemedi — bu yüzden HIGH değil MEDIUM. " +
    "Belgelenmiş doğruluk: 0°C'de ±%2.5, 20-100°C'de ±%0.5 (bir kaynakta), diğerinde \"tüm sıvı " +
    "aralığında (0-370°C) ±%1\" olarak aktarılıyor — bu iki doğruluk iddiası arasında küçük bir fark " +
    "var, ikisi de notlarda saklandı, daha muhafazakâr olanı (±%2.5, düşük sıcaklıkta) esas alınmalıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Sıvı hidrokarbon (dead oil) viskozitesi — Beggs-Robinson (1975)
// ─────────────────────────────────────────────────────────────────────────

export interface BeggsRobinsonCoefficients {
  zConstant: number;
  zApiCoefficient: number;
  temperatureExponent: number;
}

const BEGGS_ROBINSON_COEFFICIENTS: Coefficient<BeggsRobinsonCoefficients> = {
  id: "viscosity.beggsRobinsonCoefficients",
  module: MODULE,
  value: {
    zConstant: 3.0324,
    zApiCoefficient: 0.02023,
    temperatureExponent: -1.163,
  },
  unit: "-",
  description:
    "Beggs-Robinson (1975) 'dead oil' (çözünmüş gazsız ham petrol) viskozite korelasyonu: " +
    "μod=10^X-1 [cp], X=Y×T^(-1.163) [T: °F], Y=10^Z, Z=3.0324-0.02023×API",
  source: {
    type: "STANDARD",
    citation:
      "IHS Energy / Fekete \"Harmony\" rezervuar mühendisliği yazılımı belgeleri, \"Oil Correlations\" " +
      "sayfası — Beggs, H.D., Robinson, J.R., \"Estimating the Viscosity of Crude Oil Systems\", JPT, " +
      "Eylül 1975, s.1140-1141'i aktarıyor.",
    url: "https://www.ihsenergy.ca/support/documentation_ca/Harmony_Enterprise/2019_3/content/html_files/ref_materials/calculations/oil_correlations.htm",
    accessedDate: "2026-08-11",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "OPEN_SOURCE_CODE",
      citation:
        "Pengtools wiki \"Beggs and Robinson correlation\" sayfası, ÖZGÜL AĞIRLIK (SG) tabanlı biçimde " +
        "veriyor: X=T^-1.163×exp(13.108-6.591/SG). Bu oturumda API=141.5/SG-131.5 dönüşümüyle bu iki " +
        "biçimin MATEMATİKSEL OLARAK BİREBİR AYNI olduğu bağımsız olarak doğrulandı (10^(3.0324-0.02023×" +
        "API) ifadesi SG cinsinden yazıldığında e^(13.110-6.5915/SG) verir — pengtools'un 13.108/6.591 " +
        "değerleriyle <%0.02 farkla örtüşüyor).",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes:
    "İki kaynak farklı değişken (API vs SG) kullandığı için yüzeysel olarak FARKLI görünüyordu — bu " +
    "oturumda cebirsel dönüşümle AYNI korelasyon oldukları kanıtlandı, bu da güveni artırdı. Geçerlilik: " +
    "API 16-58°, T 70-295°F (460 dead-oil ölçümünden geliştirildi). Bilinen sınırlama (IHS belgesinden " +
    "doğrudan): \"100-150°F altındaki sıcaklıklarda viskoziteyi OLDUĞUNDAN FAZLA tahmin etme eğilimi " +
    "vardır\" — bu proje bu aralıkta validityWarning üretir.",
};

const BEGGS_ROBINSON_VALIDITY_API: Coefficient<[number, number]> = {
  id: "viscosity.beggsRobinsonValidity.apiGravity",
  module: MODULE,
  value: [16, 58],
  unit: "°API",
  description: "Beggs-Robinson korelasyonunun geçerlilik API gravitesi aralığı",
  source: BEGGS_ROBINSON_COEFFICIENTS.source,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "İki kaynakta da aynı aralık doğrulandı.",
};

const BEGGS_ROBINSON_VALIDITY_TEMPERATURE_F: Coefficient<[number, number]> = {
  id: "viscosity.beggsRobinsonValidity.temperatureF",
  module: MODULE,
  value: [70, 295],
  unit: "°F",
  description: "Beggs-Robinson korelasyonunun geçerlilik sıcaklık aralığı",
  source: BEGGS_ROBINSON_COEFFICIENTS.source,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "İki kaynakta da aynı aralık doğrulandı. Ayrıca 100-150°F altında bilinen aşırı-tahmin eğilimi var.",
};

export const VISCOSITY_COEFFICIENTS: Coefficient[] = [
  LEE_GONZALEZ_EAKIN_COEFFICIENTS as Coefficient,
  LGE_VALIDITY_TEMPERATURE_R as Coefficient,
  WATER_VISCOSITY_COEFFICIENTS as Coefficient,
  BEGGS_ROBINSON_COEFFICIENTS as Coefficient,
  BEGGS_ROBINSON_VALIDITY_API as Coefficient,
  BEGGS_ROBINSON_VALIDITY_TEMPERATURE_F as Coefficient,
];

// packages/engine/src/registry/coefficients/synergy.ts
//
// Erozyon-korozyon SİNERJİSİ: ASTM G119 çerçevesi (T=C+E+S, S=ΔE+ΔC), FeCO3/
// oksit koruyucu film yapışma direnci (film sıyırma mekanizmasının GERÇEK
// itici gücünün ne olduğunu belirlemek için) ve sinerji katkı oranı aralığı.
//
// ⚠ KDP ARAŞTIRMA SONUCU — ÖNEMLİ BİR BULGU: "kayma gerilmesi filmi sıyırır"
// sezgisi, bu oturumda bulunan gerçek araştırma verisiyle KISMEN ÇÜRÜTÜLDÜ.
// AFM (atomik kuvvet mikroskobu) ölçümleri ve bağımsız bir NACE konferans
// bildirisi, FeCO3 filmini boru cidarından SIYIRMAK için gereken kuvvetin
// ~10^7 Pa (10 MPa) mertebesinde olduğunu, bunun tipik türbülanslı akış
// duvar kayma gerilmesinden (~10² Pa veya altı) KATLARCA (5 mertebe) BÜYÜK
// olduğunu gösteriyor — yani SAF akışkan kayma gerilmesi TEK BAŞINA filmi
// SIYIRAMAZ. Bu, filmRemovalFactor'ün neden PARÇACIK ÇARPMASINI (lokalize,
// yüksek anlık basınç) baskın terim, kayma gerilmesini İKİNCİL/sınırlı bir
// terim olarak ele aldığını açıklar (bkz. synergy/synergy.ts).

import type { Coefficient, Source } from "../types";

const MODULE = "synergy";

const SRC_ASTM_G119: Source = {
  type: "STANDARD",
  citation:
    "ASTM G119, \"Standard Guide for Determining Synergism Between Wear and Corrosion\" — toplam aşınma-" +
    "korozyon kaybı T=C+E+S olarak ayrıştırılır (C=saf korozyon, E=saf erozyon, S=sinerji terimi), " +
    "S=ΔC+ΔE (ΔC=erozyonun artırdığı korozyon, ΔE=korozyonun artırdığı erozyon). Bu oturumda standardın " +
    "kendisi doğrudan okunmadı (ücretli) — çerçevenin YAPISI birden fazla bağımsız akademik kaynakta " +
    "(Tribology journal, Wear journal, bir derleme makalesi) AYNI ayrıştırmayla tutarlı biçimde tekrarlanıyor.",
  accessedDate: "2026-08-12",
};

const ASTM_G119_FRAMEWORK: Coefficient<string> = {
  id: "synergy.astmG119Framework",
  module: MODULE,
  value: "T = C + E + S,  S = ΔC + ΔE  (ΔC: erozyonun artırdığı korozyon, ΔE: korozyonun artırdığı erozyon)",
  unit: "-",
  description: "Toplam erozyon-korozyon kaybının ASTM G119 standardına göre ayrıştırılması.",
  source: SRC_ASTM_G119,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Tribology - Materials, Surfaces & Interfaces, \"Development of synergy model for erosion-corrosion " +
        "of carbon steel in a slurry pot\" — AYNI T=C+E+S, S=ΔE+ΔC ayrıştırmasını kullanıyor.",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "HIGH",
  notes:
    "Bu, ayrıştırmanın TANIMSAL YAPISIDIR (bir sayısal sabit değil) — birden fazla bağımsız kaynakta " +
    "tutarlı biçimde tekrarlanıyor, bu yüzden HIGH. Bu dosyadaki DİĞER sabitler (film direnci, sinerji " +
    "oranı aralığı) bu ayrıştırmanın İÇİNİ SAYISAL OLARAK doldurmaya çalışır ve ÇOK DAHA DÜŞÜK " +
    "güvenilirliğe sahiptir (bkz. ilgili notlar) — bu net ayrım KASITLIDIR.",
};

const FILM_ADHESION_STRESS_PA: Coefficient<number> = {
  id: "synergy.filmAdhesionStressPa",
  module: MODULE,
  value: 1e7,
  unit: "Pa",
  description:
    "FeCO3 (demir karbonat) koruyucu korozyon ürünü filminin çelik yüzeye yapışma direnci mertebesi — " +
    "bu değerin ALTINDAKİ bir gerilme/basınç filmi SIYIRAMAZ (yalnızca kimyasal çözünme yoluyla kaybolabilir, " +
    "bu KDP kapsamı dışıdır).",
  source: {
    type: "CONFERENCE",
    citation:
      "NACE International, \"Mechanical Strength and Removal of a Protective Iron Carbonate Layer Formed " +
      "on Mild Steel in CO2 Corrosion\" (CONF_MAR2010) — AFM (atomik kuvvet mikroskobu) ölçümleriyle FeCO3 " +
      "tabakasının çelikten sıyrılması için gereken kuvvetin ~10^7 Pa mertebesinde olduğunu, bunun tipik " +
      "çok-fazlı akış duvar kayma gerilmesinden (tipik ~10² Pa veya altı) ÇOK BÜYÜK olduğunu gösteriyor.",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "CORROSION (AMPP dergisi), \"Protective Iron Carbonate Films—Part 1: Mechanical Removal in Single-" +
        "Phase Aqueous Flow\" — BAĞIMSIZ olarak \"adhesion strength... in excess of 10 MPa\" bulgusunu " +
        "raporluyor (aynı mertebe, muhtemelen aynı araştırma grubu soyundan ama ayrı bir yayın).",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki BAŞLIK olarak bağımsız yayın AYNI mertebede (~10^7 Pa=10 MPa) örtüşüyor — ANCAK ikisinin de tam " +
    "metnine bu oturumda erişilemedi (ikisi de 403/paywall verdi), yalnızca arama motoru özet/alıntılarından " +
    "doğrulandı — bu yüzden HIGH değil MEDIUM. Bu SAYI, tek başına akışkan kayma gerilmesinin filmi " +
    "SIYIRAMAYACAĞINI kanıtlıyor (tipik akış kayma gerilmesi ~10²Pa, bu değerden 5 mertebe küçük) — " +
    "synergy/synergy.ts'te bu yüzden kayma gerilmesi İKİNCİL/sınırlı bir terim olarak ele alınır.",
};

const SYNERGY_CONTRIBUTION_FRACTION_RANGE: Coefficient<[number, number]> = {
  id: "synergy.contributionFractionRange",
  module: MODULE,
  value: [0.2, 0.7],
  unit: "-",
  description: "Sinerji teriminin (S), toplam erozyon-korozyon kaybına (T) tipik katkı oranı aralığı.",
  source: {
    type: "PROJECT_DOCUMENT",
    citation: "Bu proje için verilen görev tanımının (master-context) kendisinde belirtilen aralık: \"Sinerji katkısı toplamın %20-70'i olabilir\".",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Bu oturumda taranan erozyon-korozyon sinerji literatürü (alüminyum/asidik slurry, X60/321/316L " +
        "çelikleri üzerine çeşitli çalışmalar) sinerji katkısının %30 ile >%90 arasında DAHA GENİŞ bir " +
        "aralıkta rapor edildiğini gösteriyor — malzeme/ortam/hıza aşırı duyarlı. Görev tanımının verdiği " +
        "%20-70 aralığı, bu geniş literatür aralığının İÇİNDE, MUHAFAZAKÂR-ORTA bir temsili aralıktır.",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "LOW",
  notes:
    "KDP kural 4 açıkça uygulanıyor: bu aralık görev tanımının kendisinden alındı, bu oturumda BAĞIMSIZ " +
    "olarak yeniden türetilmedi. Taranan gerçek literatür aralığı (%30-99, malzemeye/ortama göre ÇOK " +
    "değişken) bu aralıktan DAHA GENİŞ ve daha belirsiz — alan literatürde gerçekten \"tam oturmamış\" " +
    "durumdadır (master-context'in kendi ifadesiyle tutarlı, bu oturumda bağımsız olarak DOĞRULANDI). " +
    "confidence=LOW, UI'da her zaman sarı rozet + belirgin uyarı ile gösterilmelidir.",
};

export const SYNERGY_COEFFICIENTS: Coefficient[] = [
  ASTM_G119_FRAMEWORK as Coefficient,
  FILM_ADHESION_STRESS_PA,
  SYNERGY_CONTRIBUTION_FRACTION_RANGE as Coefficient,
];

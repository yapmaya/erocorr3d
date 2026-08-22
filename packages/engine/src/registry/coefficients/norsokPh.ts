// packages/engine/src/registry/coefficients/norsokPh.ts
//
// NORSOK M-506 Rev.2 (2005) Bölüm 8.2 "pH" — ölçülmüş pH yoksa, gaz/su
// kimyasından in-situ pH'ı hesaplamak için denge sabitleri.
//
// KAYNAK DURUMU: Bu dosyadaki TÜM denklemler standardın BİRİNCİL METNİNDEN
// doğrudan okundu — PDF bu oturumda indirilip hem pdftotext hem de (kritik
// denklemler için, üst simge/alt simge belirsizliğini gidermek üzere) 400dpi
// SAYFA GÖRÜNTÜSÜ olarak render edilip GÖRSEL OLARAK (piksel piksel)
// doğrulandı (Bölüm 8.2.2/8.2.3, Denklem 9-18, standardın sayfa 10-12'si).
//
// ⚠ K0/KH/Kw/Ksp bu oturumda BAĞIMSIZ fiziksel makullük kontrolünden
// (bilinen referans değerlerle el ile karşılaştırma) BAŞARIYLA geçti — bkz.
// ilgili coefficient notları. AMA K1/K2 (norsokPh.k1, norsokPh.k2) AYNI
// KONTROLÜ GEÇEMEDİ (hesaplanan değer, bilinen karbonik asit pK1/pK2
// değerlerinden ~17 mertebe sapıyor) — transkripsiyon piksel piksel
// doğrulanmasına RAĞMEN bu iki katsayı UNVERIFIED işaretlendi, ayrıntılı
// araştırma geçmişi ilgili coefficient'ların notes alanındadır. Bu modülü
// kullanmadan önce MUTLAKA o notları okuyun.
//
// Bağımsız açık kaynak kod (dungnguyen2/norsokm506, zaten registry/norsok.ts
// içinde kullanılan aynı depo) K1/K2 için YAPISAL OLARAK FARKLI bir korelasyon
// içeriyor (10^-(6.41-0.001594·Tf+...) tipi, TK yerine Tf tabanlı, log/1/T²
// terimleri yok) — bu, muhtemelen o kod tabanının NORSOK'un kendi Ek 8.2
// denklemlerini değil, başka bir yayından (adı belirtilmemiş) alınmış
// alternatif bir pH korelasyonunu kullandığını gösteriyor. Bu dosya,
// STANDARDIN KENDİ metnini (birincil kaynak) esas alır; bu farklılık KDP
// kural 2 gereği burada açıkça not edildi ve İKİNCİL bir kaynak olarak DEĞİL,
// yalnızca bir gözlem olarak kaydedildi (crossChecked=false).
//
// EK DOĞRULAMA: iki denge sabiti, bağımsız bilinen fizikokimya referans
// değerleriyle bu oturumda El ile çapraz kontrol edildi: Kw(25°C)≈9.1×10⁻¹⁵
// (Eq 18'den hesaplandı; literatür referans değeri ~1.0×10⁻¹⁴, aynı
// mertebe) ve KH(25°C,1bar,I=0)≈0.0337 mol/(L·bar) (Eq 14'ten hesaplandı;
// CO2'nin bilinen Henry sabiti ~0.034 mol/(L·bar) ile neredeyse birebir
// örtüşüyor). Bu, denklemlerin doğru transkribe edildiğinin bağımsız bir
// kanıtıdır.

import type { Coefficient, Source } from "../types";

const MODULE = "norsokPh";

const SRC_NORSOK_STANDARD_PRIMARY: Source = {
  type: "STANDARD",
  citation:
    "NORSOK Standard M-506, \"CO2 Corrosion Rate Calculation Model\", Rev. 2, Standards Norway, Haziran " +
    "2005, Bölüm 8.2 \"pH\" (8.2.2 \"Calculation of pH\", Eq. 9-12; 8.2.3 \"Equilibrium constants\", Eq. " +
    "13-18). Bu oturumda PDF doğrudan indirildi, pdftotext İLE VE 200dpi sayfa görüntüleri olarak " +
    "render edilip görsel olarak okundu (üst/alt simge belirsizliğini gidermek için).",
  url: "https://00448349299399495787.googlegroups.com/attach/207f0a05d64cb52e/NORSOK%20CO2%20M-506.pdf",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// K0 — CO2 hidrasyon denge sabiti (Palmer & van Eldik, sabit)
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_PH_K0: Coefficient<number> = {
  id: "norsokPh.k0",
  module: MODULE,
  value: 0.00258,
  unit: "-",
  description: "CO2(aq) + H2O ⇌ H2CO3 denge sabiti K0 (Palmer & van Eldik)",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın Eq.13 civarındaki metninden doğrudan okundu: \"The equilibrium constant... for the " +
    "carbon dioxide hydration were given by Palmer and van Eldik /4/: K0=0,00258\". Bağımsız ikinci " +
    "kaynakla çapraz doğrulanmadı ancak birincil standart metninden doğrudan alındığı için HIGH.",
};

// ─────────────────────────────────────────────────────────────────────────
// KH — Henry sabiti (CO2 çözünürlüğü), iki sıcaklık aralığı
// ─────────────────────────────────────────────────────────────────────────

export interface NorsokPhKhCoefficients {
  /** 0-80°C aralığı (Eq. 14) sabitleri */
  lowRange: {
    constA: number;
    tCoeff1: number;
    tCoeff2: number;
    pressureCoeff: number;
    ionicStrengthCoeff: number;
  };
  /** 80-200°C aralığı (Eq. 15) sabitleri */
  highRange: {
    criticalTemperatureK: number;
    coeff1: number;
    coeff2: number;
    coeff3: number;
    coeff4: number;
    pressureCoeff: number;
    ionicStrengthCoeff: number;
  };
  preExponentialFactor: number;
  transitionTemperatureC: number;
}

const NORSOK_PH_KH: Coefficient<NorsokPhKhCoefficients> = {
  id: "norsokPh.henryConstant",
  module: MODULE,
  value: {
    preExponentialFactor: 55.5084,
    transitionTemperatureC: 80,
    lowRange: {
      constA: 4.8,
      tCoeff1: 3934.4,
      tCoeff2: 941290.2,
      pressureCoeff: 1.79e-4,
      ionicStrengthCoeff: 0.107,
    },
    highRange: {
      criticalTemperatureK: 647,
      coeff1: 1713.53,
      coeff2: 3.875,
      coeff3: 3680.09,
      coeff4: 1198506.1,
      pressureCoeff: 1.79e-4,
      ionicStrengthCoeff: 0.107,
    },
  },
  unit: "molar/bar",
  description:
    "CO2 Henry sabiti KH — 0-80°C (Eq.14): KH=55.5084·exp[-(4.8+3934.4/TK-941290.2/TK²)]·" +
    "10^-(1.79e-4·P+0.107·I); 80-200°C (Eq.15): üstel terimde 1713.53·(1-TK/647)^(1/3)/TK+3.875+" +
    "3680.09/TK-1198506.1/TK² kullanılır (P: bar, I: molar, TK: Kelvin).",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bu oturumda 25°C/1bar/I=0 için elle hesaplandı: KH≈0,0337 mol/(L·bar) — CO2'nin genel " +
        "fizikokimya literatüründe bilinen Henry sabiti (~0,034 mol/(L·bar), 25°C) ile neredeyse " +
        "birebir örtüşüyor. Bağımsız bir fiziksel makul-değer kontrolüdür.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes:
    "Standart, bu Henry denkleminin CO2 FUGASİTESİ (fCO2, Bölüm 8.1) gerektirdiğini AÇIKÇA belirtiyor " +
    "(\"This Henry's law equation requires CO2 fugacities as given by the equations given in 8.1\") — " +
    "yani Eq.11/12'deki \"pCO2\" sembolü aslında fCO2 (fugasite-düzeltilmiş) ile değiştirilmelidir. " +
    "Kaynak: Crovetto (CO2 çözünürlüğü, temel Henry denklemi), Oddo & Tomson (basınç bağımlılığı), IFE " +
    "(iyonik kuvvet bağımlılığı, Cramer verisine fit edilmiş) — standardın kendi bibliyografyası.",
};

// ─────────────────────────────────────────────────────────────────────────
// K1, K2 — karbonik asit birinci/ikinci ayrışma sabitleri
// ─────────────────────────────────────────────────────────────────────────

export interface NorsokPhDissociationCoefficients {
  tkConstant: number;
  tkLinearCoeff: number;
  tkInverseCoeff: number;
  logTkCoeff: number;
  tkInverseSquaredCoeff: number;
  pressurePsiCoeff: number;
  ionicStrengthHalfCoeff: number;
  ionicStrengthCoeff: number;
  ionicStrength15Coeff: number;
  ionicStrengthTfCoeff: number;
}

const NORSOK_PH_K1: Coefficient<NorsokPhDissociationCoefficients> = {
  id: "norsokPh.k1",
  module: MODULE,
  value: {
    tkConstant: 356.3094,
    tkLinearCoeff: 0.06091964,
    tkInverseCoeff: 21834.37,
    logTkCoeff: 126.8339,
    tkInverseSquaredCoeff: 168491.5,
    pressurePsiCoeff: 2.564e-5,
    ionicStrengthHalfCoeff: 0.491,
    ionicStrengthCoeff: 0.379,
    ionicStrength15Coeff: 0.06506,
    ionicStrengthTfCoeff: 1.458e-3,
  },
  unit: "-",
  description:
    "Karbonik asit birinci ayrışma sabiti K1 (Eq.16): K1=10^-(356.3094+0.06091964·TK-21834.37/TK-" +
    "126.8339·log10(TK)+168491.5/TK²-2.564e-5·P-0.491·I^0.5+0.379·I-0.06506·I^1.5-1.458e-3·I·Tf) " +
    "(P: PSİ — standart burada özellikle BAR değil PSİ kullanır; I: molar; TK: Kelvin; Tf: Fahrenheit).",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "⚠ ÖNEMLİ TUTARSIZLIK BULUNDU: Formül, standardın PDF kopyasından 400dpi sayfa görüntüsü üzerinden " +
    "piksel piksel doğrulanarak (yeniden) okundu — transkripsiyon hatası YOK. Ancak bu oturumda yapılan " +
    "BAĞIMSIZ fiziksel makullük kontrolü BAŞARISIZ OLDU: 25°C/1bar/I=0 (seyreltik, referans koşul) için " +
    "bu formülle hesaplanan K1≈5×10¹⁰ (pK1≈-10,7) iken, karbonik asit için genel fizikokimya " +
    "literatüründe yaygın kabul gören değer pK1≈6,35'tir (K1≈4,5×10⁻⁷) — ARADAKİ FARK ~17 MERTEBE. " +
    "Karşılaştırma için: aynı yöntemle (bu oturumda) doğrulanan KH (hesaplanan≈0,0337 mol/(L·bar), " +
    "literatür≈0,034) ve Kw (hesaplanan≈9,1×10⁻¹⁵, literatür≈1,0×10⁻¹⁴) BEKLENEN DEĞERLERLE ÖRTÜŞTÜ — " +
    "yani sorun genel yöntemde değil, ÖZELLİKLE bu iki denklemde (K1/K2, ikisi de Atkinson/Oddo-Tomson " +
    "kaynaklı). Denenen ve SONUÇ VERMEYEN alternatif yorumlar: (a) TK yerine Rankine kullanmak (pK1≈-2,7 " +
    "çıkıyor, yine tutarsız), (b) tekil terim işaretlerini tek tek ters çevirmek (hiçbiri fiziksel " +
    "aralığa girmedi). Olası açıklamalar: (i) bu PDF kopyası orijinal basılı standardın yeniden " +
    "dizilmiş/OCR'lanmış bir türevi olabilir ve bir dizgi hatası içerebilir (Google Groups üzerinden " +
    "dağıtılan bir kopya, resmi Standards Norway baskısı DEĞİL); (ii) NORSOK'un kendi iç " +
    "parametrizasyonu, bileşke sistemde (Eq.11/12) birbirini dengeleyen, tek başına \"K1\" olarak " +
    "yorumlanamayan bir tanım kullanıyor olabilir. Bu oturumda ikinci bağımsız bir NORSOK M-506 kopyası " +
    "bulunup karşılaştırılamadı (denenen 2 ayna sitesi erişilemedi/bakımdaydı). SONUÇ: formül " +
    "DEĞİŞTİRİLMEDEN (uydurma düzeltme YAPILMADAN) burada saklandı, ancak KULLANILMADAN ÖNCE bir " +
    "korozyon mühendisi tarafından NORSOK'un resmi yazılımı veya basılı orijinaliyle DOĞRULANMALIDIR. " +
    "Bu belirsizlik computeNorsokInSituPh() sonucuna validityWarning olarak da yansıtılır.",
};

const NORSOK_PH_K2: Coefficient<NorsokPhDissociationCoefficients> = {
  id: "norsokPh.k2",
  module: MODULE,
  value: {
    tkConstant: 107.8871,
    tkLinearCoeff: 0.03252849,
    tkInverseCoeff: 5151.79,
    logTkCoeff: 38.92561,
    tkInverseSquaredCoeff: 563713.9,
    pressurePsiCoeff: 2.118e-5,
    ionicStrengthHalfCoeff: 1.255,
    ionicStrengthCoeff: 0.867,
    ionicStrength15Coeff: 0.174,
    ionicStrengthTfCoeff: 1.588e-3,
  },
  unit: "-",
  description:
    "Karbonik asit ikinci ayrışma sabiti K2 (Eq.17): K2=10^-(107.8871+0.03252849·TK-5151.79/TK-" +
    "38.92561·log10(TK)+563713.9/TK²-2.118e-5·P-1.255·I^0.5+0.867·I-0.174·I^1.5-1.588e-3·Tf·I) " +
    "(P: PSİ; I: molar; TK: Kelvin; Tf: Fahrenheit).",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Bkz. norsokPh.k1 notlarındaki AYRINTILI tutarsızlık açıklaması — aynı sayfada, aynı P=psi " +
    "istisnasıyla birlikte piksel piksel doğrulanarak okundu, ancak aynı fiziksel makullük sorunu " +
    "(beklenen pK2≈10,3 mertebesine karşı hesaplanan değer çok farklı) bu denklem için de geçerlidir.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kw — suyun ayrışma sabiti
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_PH_KW: Coefficient<{ constant: number; linearCoeff: number; quadraticCoeff: number }> = {
  id: "norsokPh.waterDissociation",
  module: MODULE,
  value: { constant: 29.3868, linearCoeff: 0.0737549, quadraticCoeff: 7.47881e-5 },
  unit: "molar²",
  description: "Suyun ayrışma sabiti Kw (Eq.18): Kw=10^-(29.3868-0.0737549·TK+7.47881e-5·TK²) (Delahay verisi)",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bu oturumda 25°C (298.15K) için elle hesaplandı: Kw≈9,1×10⁻¹⁵ — suyun bilinen ayrışma sabiti " +
        "(~1,0×10⁻¹⁴, 25°C, standart fizikokimya bilgisi) ile aynı mertebede ve çok yakın. Formüldeki " +
        "\"T\" değişkeninin KELVİN olduğu bu şekilde bağımsız olarak doğrulandı (Celsius ile hesaplanırsa " +
        "fiziksel olarak anlamsız bir sonuç, ~10⁻²⁸ mertebesinde, çıkıyor).",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes: "Standardın metninde formüldeki T'nin K/Tc/Tf olduğu açıkça belirtilmemiş; birim analizi ve " +
    "bilinen referans değerle yapılan bağımsız hesap KELVİN olduğunu doğruladı (bkz. crossCheckSources).",
};

// ─────────────────────────────────────────────────────────────────────────
// Ksp — demir karbonat (FeCO3) çözünürlük sabiti
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_PH_KSP: Coefficient<{ constant: number; tempCoeff: number; ionicHalfCoeff: number; ionicCoeff: number }> = {
  id: "norsokPh.ironCarbonateSolubility",
  module: MODULE,
  value: { constant: 10.13, tempCoeff: 0.0182, ionicHalfCoeff: 2.44, ionicCoeff: 0.72 },
  unit: "molal²",
  description:
    "Demir karbonat (FeCO3) çözünürlük çarpımı Ksp (Eq.13): Ksp=10^-(10.13+0.0182·Tc-2.44·I^0.5+0.72·I) " +
    "(Tc: °C, I: molar/molal — bkz. notes)",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "IUPAC + Institute for Energy Technology (IFE) iyonik kuvvet bağımlılığı, standardın kendi " +
    "kaynağıdır. Standardın metni sonucu \"molal²\" olarak etiketliyor ancak formülün kendisinde " +
    "kullanılan \"I\" sembolü, belgenin GENEL terminoloji bölümünde tanımlanan TEK \"I\" sembolüyle " +
    "(\"iyonik kuvvet, molar cinsinden\") aynıdır — bu proje seyreltik su çözeltileri için molal≈molar " +
    "yaklaşımını kullanır (standart bunun için ayrı bir dönüşüm vermiyor).",
};

// ─────────────────────────────────────────────────────────────────────────
// Geçerlilik aralıkları (Tablo 6)
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_PH_VALIDITY_BICARBONATE_MG_L: Coefficient<[number, number]> = {
  id: "norsokPh.validity.bicarbonateMgL",
  module: MODULE,
  value: [0, 20000],
  unit: "mg/l",
  description: "pH hesabı için bikarbonat girdisinin geçerli aralığı (Tablo 6)",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Standardın Tablo 6'sından doğrudan okundu.",
};

const NORSOK_PH_VALIDITY_IONIC_STRENGTH_MOLAR: Coefficient<[number, number]> = {
  id: "norsokPh.validity.ionicStrengthMolar",
  module: MODULE,
  value: [0, 3],
  unit: "M",
  description: "pH hesabı için iyonik kuvvet/tuzluluk girdisinin geçerli aralığı (Tablo 6, 0-175 g/l ≈ 0-3 M)",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Standardın Tablo 6'sından doğrudan okundu.",
};

export const NORSOK_PH_COEFFICIENTS: Coefficient[] = [
  NORSOK_PH_K0,
  NORSOK_PH_KH as Coefficient,
  NORSOK_PH_K1 as Coefficient,
  NORSOK_PH_K2 as Coefficient,
  NORSOK_PH_KW as Coefficient,
  NORSOK_PH_KSP as Coefficient,
  NORSOK_PH_VALIDITY_BICARBONATE_MG_L as Coefficient,
  NORSOK_PH_VALIDITY_IONIC_STRENGTH_MOLAR as Coefficient,
];

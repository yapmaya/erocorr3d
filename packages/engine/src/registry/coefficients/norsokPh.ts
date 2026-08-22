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
// ⚠ [2026-08-12'den 2026-08-22'ye GÜNCELLENDİ] K0/KH/Kw/Ksp/K2 bu modülün
// önceki halinde de BAĞIMSIZ fiziksel makullük kontrolünden BAŞARIYLA geçmişti.
// K1 ise (~17 mertebe sapma nedeniyle) UNVERIFIED işaretlenmişti — bu oturumda
// kök neden BULUNDU ve DÜZELTİLDİ: tkInverseSquaredCoeff (T⁻² terim katsayısı)
// 1.684.915 olması gerekirken 168.491,5 olarak (ondalık ayracı bir hane kaymış)
// kaydedilmişti. Ayrıca bu oturumda K1'in NORSOK'un birincil kaynağı Plummer &
// Busenberg (1982)'den BİREBİR alındığı bağımsız olarak keşfedildi ve bu ikinci
// kaynağa karşı çapraz doğrulandı (crossChecked=true). K2'nin ise hiçbir zaman
// gerçek bir sorunu yoktu — önceki oturumun "K2 de aynı sorunu taşıyor" notu
// YANLIŞTI, bu oturumda düzeltildi. Artık K0/K1/K2/KH/Kw/Ksp'nin TAMAMI
// confidence=HIGH. Ayrıntılar ilgili coefficient'ların notes alanındadır.
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
    tkInverseSquaredCoeff: 1684915, // DÜZELTİLDİ (bkz. notes) — önceki değer 168491.5 idi (10 kat küçük, ondalık kayması)
    pressurePsiCoeff: 2.564e-5,
    ionicStrengthHalfCoeff: 0.491,
    ionicStrengthCoeff: 0.379,
    ionicStrength15Coeff: 0.06506,
    ionicStrengthTfCoeff: 1.458e-3,
  },
  unit: "-",
  description:
    "Karbonik asit birinci ayrışma sabiti K1 (Eq.16): K1=10^-(356.3094+0.06091964·TK-21834.37/TK-" +
    "126.8339·log10(TK)+1684915/TK²-2.564e-5·P-0.491·I^0.5+0.379·I-0.06506·I^1.5-1.458e-3·I·Tf) " +
    "(P: PSİ — standart burada özellikle BAR değil PSİ kullanır; I: molar; TK: Kelvin; Tf: Fahrenheit).",
  source: SRC_NORSOK_STANDARD_PRIMARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Plummer, L.N. ve Busenberg, E. (1982), \"The solubilities of calcite, aragonite and vaterite in " +
        "CO2-H2O solutions between 0 and 90°C, and an evaluation of the aqueous model for the system " +
        "CaCO3-CO2-H2O\", Geochimica et Cosmochimica Acta, 46(6), 1011-1040 — NORSOK'un K1 denklemiyle " +
        "AYNI 5 terimli formu ve AYNI katsayıları (356.3094, 0.06091964, 21834.37, 126.8339) taşır: " +
        "log K1 = -356.3094 - 0.06091964·T + 21834.37/T + 126.8339·log(T) - 1684915/T². Tek fark: bu " +
        "birincil kaynakta T⁻² teriminin katsayısı 1.684.915'tir — NORSOK transkripsiyonunda (önceki " +
        "oturum) 168.491,5 olarak, ondalık ayracı bir hane kaymış şekilde kaydedilmişti.",
      accessedDate: "2026-08-22",
    },
  ],
  confidence: "HIGH",
  notes:
    "ÇÖZÜLDÜ (önceki UNVERIFIED işaretine bakınız, artık geçersiz): kök neden bir ONDALIK KAYMASI " +
    "transkripsiyon hatasıydı — tkInverseSquaredCoeff (T⁻² terimi katsayısı) 1.684.915 olması gerekirken " +
    "168.491,5 olarak (tam 10 kat küçük) kaydedilmişti. Bu tek hane, pK1 sonucunda ~17 birimlik bir " +
    "kaymaya yol açıyordu (168491.5/TK² ile 1684915/TK² arasındaki fark, TK≈298K'de ~17,05 — önceki " +
    "oturumun bildirdiği '~17 mertebe' sapmasıyla BİREBİR örtüşüyor, bu da kök nedenin doğru " +
    "teşhis edildiğinin ayrı bir kanıtıdır). Düzeltilmiş katsayıyla: pK1(25°C,I=0)=6,352 — genel " +
    "fizikokimya literatüründeki kabul gören değerle (~6,35-6,38) birebir örtüşüyor; ayrıca 0-90°C " +
    "aralığında (0°C: 6,58; 25°C: 6,35; 60°C: 6,29; 90°C: 6,38) fiziksel olarak makul, bilinen U-şekilli " +
    "sıcaklık eğilimini izliyor. Formülün kendisinin (5 terimli yapı, tüm diğer katsayılar) doğru " +
    "transkribe edildiği, NORSOK'un bu K1 denklemini Plummer & Busenberg (1982)'den BİREBİR aldığının " +
    "bu oturumda bağımsız olarak bulunmasıyla (bkz. crossCheckSources) ayrıca doğrulanmıştır — yani bu " +
    "artık YALNIZCA standardın kendi metnine değil, standardın kendisinin de dayandığı birincil " +
    "jeokimya kaynağına karşı çapraz doğrulanmıştır (crossChecked=true).",
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
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bu oturumda 25°C (298,15K), I=0 (seyreltik referans) için elle hesaplandı: pK2≈10,329 — " +
        "karbonik asidin ikinci ayrışma sabiti için genel fizikokimya literatüründe kabul gören değerle " +
        "(~10,33, 25°C) neredeyse birebir örtüşüyor. norsokPh.k1'DEN FARKLI OLARAK, bu denklemin " +
        "T⁻² katsayısında (563713.9) herhangi bir ondalık kayması YOKTUR — formül olduğu gibi doğrudur.",
      accessedDate: "2026-08-22",
    },
  ],
  confidence: "HIGH",
  notes:
    "DÜZELTME (önceki not YANLIŞTI, bkz. norsokPh.k1'in kendi düzeltme notu): önceki oturum bu " +
    "denklemin de K1 ile AYNI ~17 mertebelik sapmayı taşıdığını iddia etmişti — bu oturumda yapılan " +
    "bağımsız hesap bunun DOĞRU OLMADIĞINI gösterdi: K1'deki sorun tek bir katsayıya (tkInverseSquaredCoeff) " +
    "özgü bir ondalık kayması transkripsiyon hatasıydı, K2'nin kendi katsayıları BAŞTAN BERİ doğruydu. " +
    "pK2(25°C,I=0)=10,329 hesaplanıyor, literatür ~10,33 ile örtüşüyor (bkz. crossCheckSources).",
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

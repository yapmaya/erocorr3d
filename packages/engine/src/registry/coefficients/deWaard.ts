// packages/engine/src/registry/coefficients/deWaard.ts
//
// de Waard-Milliams(-Lotz-Dugstad) CO2 korozyon modeli sabitleri.
//
// KAYNAK DURUMU: Temel nomogram denklemi İKİ bağımsız kaynaktan (Aalborg
// Üniversitesi yüksek lisans tezi + genel mühendislik referans sentezi)
// aynı sayısal değerlerle doğrulandı. Fscale ve Vm (kütle transferi)
// sabitleri için GERÇEK kaynak çatışmaları bulundu ve kullanıcı onayıyla
// tez kaynaklı versiyon esas alındı — çatışan alternatif değerler her
// coefficient'ın notes alanında saklandı (KDP kural 2).

import type { Coefficient, Source } from "../types";

const MODULE = "deWaard";

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_AAU_THESIS: Source = {
  type: "THESIS",
  citation:
    "Aalborg University öğrenci raporu, \"Modeling of Corrosion Rate Inside a Pressure Vessel\" " +
    "(PECT10-4-F19), Bölüm 3 \"De Waard Model\", Eq. 3.1-3.6 — orijinal 1975 formu (Eq.3.1), " +
    "revize nomogram (Eq.3.2), direnç modeli (Eq.3.4-3.6). Bu oturumda tam metin doğrudan " +
    "indirilip pdftotext ile okundu.",
  url: "https://projekter.aau.dk/projekter/files/306571025/PECT10_4_F19.pdf",
  accessedDate: "2026-08-11",
};

const SRC_NQ_THESIS: Source = {
  type: "THESIS",
  citation:
    "Canada National Library tez arşivi, \"Modelling of Aqueous Carbon Dioxide Corrosion in " +
    "Turbulent Pipe Flow\" (NQ43521), Bölüm 2.3.2.1 \"De Waard and Lotz Model\", Eq. 2.34-2.35 " +
    "(Fscale, direnç modeli) — Ikeda ve ark. (1984) verisine multi-dimensional regresyon, Lotz " +
    "(1990). Bu oturumda tam metin (taranmış tez, 400dpi sayfa görüntüsü) görsel olarak okundu.",
  url: "https://www.collectionscanada.gc.ca/obj/s4/f2/dsk1/tape8/PQDD_0016/NQ43521.pdf",
  accessedDate: "2026-08-11",
};

const SRC_JASIM_2026: Source = {
  type: "JOURNAL",
  citation:
    "Jasim, H.H., \"Development of De Waard-Lotz Model of CO2/H2S Corrosion Rate\", African " +
    "Journal of Management, Engineering and Technology, 2026, 4(1), s.99-112 — Eq.5-7 (Vr, Vm, " +
    "fugasite), De Waard ve ark. (1991) alıntılıyor.",
  url: "https://revues.imist.ma/index.php/AJMET/en/article/download/61281/32193/181178",
  accessedDate: "2026-08-11",
};

const SRC_GENERAL_LIT_SYNTHESIS: Source = {
  type: "TEXTBOOK",
  citation:
    "Genel mühendislik referans sentezi (midstreamcalculator.com \"CO2 Corrosion Fundamentals — " +
    "de Waard-Milliams Model\" ve çok sayıda bağımsız arama sonucu) — FpH formu " +
    "(10^(0,32×(pHsat-pHactual))) ve Fcond eşiği/varsayılanı (0,25mL/m²/s, Fc=0,1) için.",
  url: "https://midstreamcalculator.com/engineering/pipeline-ops/co2-corrosion-fundamentals.html",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Temel nomogram denklemi: log10(Vcor) = A - B/(T+273) + C×log10(pCO2)
// ─────────────────────────────────────────────────────────────────────────

export interface DeWaardNomogramConstants {
  constantA: number;
  temperatureCoefficientB: number;
  pressureExponentC: number;
  /** Formülün kendi "+273" yaklaşıklığı (273,15 DEĞİL) — kaynakların orijinal biçimi korunur */
  celsiusToKelvinOffset: number;
}

const DEWAARD_NOMOGRAM: Coefficient<DeWaardNomogramConstants> = {
  id: "deWaard.nomogram",
  module: MODULE,
  value: { constantA: 5.8, temperatureCoefficientB: 1710, pressureExponentC: 0.67, celsiusToKelvinOffset: 273 },
  unit: "-",
  description:
    "de Waard-Milliams (revize, 1991) temel nomogram denklemi: log10(Vcor)=5,8-1710/(T+273)+" +
    "0,67×log10(pCO2) [Vcor: mm/yıl, T: °C, pCO2: bar]",
  source: SRC_AAU_THESIS,
  crossChecked: true,
  crossCheckSources: [SRC_GENERAL_LIT_SYNTHESIS],
  confidence: "HIGH",
  notes:
    "Aalborg Üniversitesi tezi (Eq.3.2) ve genel mühendislik literatürü (midstreamcalculator) İKİSİ " +
    "DE aynı üç sabiti (5,8 / 1710 / 0,67) veriyor — güçlü bir çapraz doğrulama. Aalborg tezi ayrıca " +
    "ORİJİNAL 1975 formunu da veriyor (Eq.3.1: log(Vcor)=7,96-2320/(T+273)-5,55e-3×T+0,67×log(pCO2), " +
    "pCO2 MPa) — bu proje kasıtlı olarak REVİZE (1991) formunu kullanır, orijinal 1975 formu değil.",
};

// ─────────────────────────────────────────────────────────────────────────
// Fscale — koruyucu FeCO3 filmi (yüksek sıcaklık)
// ─────────────────────────────────────────────────────────────────────────

export interface DeWaardFscaleConstants {
  temperatureCoefficient: number;
  fugacityExponent: number;
  constant: number;
  maxValue: number;
}

const DEWAARD_FSCALE: Coefficient<DeWaardFscaleConstants> = {
  id: "deWaard.fscale",
  module: MODULE,
  value: { temperatureCoefficient: 2400, fugacityExponent: 0.6, constant: 6.7, maxValue: 1 },
  unit: "-",
  description:
    "Koruyucu ölçek (scale) faktörü Fscale: log10(Fscale)=2400/T-0,6×log10(fCO2)-6,7 [T: KELVİN, " +
    "fCO2: bar], Fscale ÜST SINIRI 1 (bu proje >1 çıkan değerleri 1'e sınırlar).",
  source: SRC_NQ_THESIS,
  crossChecked: false,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "G.A. Aaker Jr., PE, mühendislik danışmanlık notu (Kingwood, TX) — YAPISAL OLARAK FARKLI bir " +
        "Fscale formülü veriyor: log10(Fs)=2500/(T+273)-7,5 [T: °C], fCO2 BAĞIMSIZ, yalnızca T≥60°C " +
        "üzerinde uygulanır (altında Fs=1 sabit). Bu ikinci kaynak DOĞRULAYICI değil, GERÇEK BİR " +
        "UYUŞMAZLIK olarak kaydedildi (KDP kural 2).",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki bağımsız kaynak (üniversite tezi vs. bir PE mühendisinin danışmanlık notu) YAPISAL OLARAK " +
    "FARKLI formüller veriyor (biri fCO2 bağımlı+sürekli, diğeri T-eşikli+fCO2'den bağımsız). " +
    "Kullanıcı onayıyla TEZ kaynaklı (Ikeda ve ark. 1984 deneysel verisine regresyon) versiyon esas " +
    "alındı — daha fazla parametre (fCO2) içerdiği ve doğrudan deneysel veri regresyonuna dayandığı " +
    "için tercih edildi. Bu yüzden HIGH değil MEDIUM işaretlendi.",
};

// ─────────────────────────────────────────────────────────────────────────
// FpH — pH düzeltme faktörü
// ─────────────────────────────────────────────────────────────────────────

const DEWAARD_FPH_EXPONENT: Coefficient<number> = {
  id: "deWaard.fphExponentCoefficient",
  module: MODULE,
  value: 0.32,
  unit: "-",
  description: "FpH=10^(k×(pHsat-pHactual)) formülündeki k sabiti",
  source: SRC_GENERAL_LIT_SYNTHESIS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Jasim (2026) Eq.5'te AYNI FONKSİYONEL BİÇİMİ (10^(k×(pHref-pHactual))) k=0,34 ile veriyor " +
        "(Vr'nin log ifadesi içine gömülü: \"-0,34×(pHactual-pHCO2)\" terimi). Yapı BİREBİR aynı, " +
        "sabit ~%6 farklı (0,32 vs 0,34) — muhtemelen 1991 vs 1993 revizyonu farkı.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki bağımsız kaynak AYNI fonksiyonel biçimi doğruluyor, sabit ~%6 farklı — daha yaygın " +
    "aktarılan 0,32 değeri seçildi, 0,34 (Jasim/de Waard ve ark. 1991) alternatif olarak not edildi.",
};

// ─────────────────────────────────────────────────────────────────────────
// Vm — kütle transferi sınırlı hız (akış hızı etkisi)
// ─────────────────────────────────────────────────────────────────────────

export interface DeWaardMassTransferConstants {
  leadingConstant: number;
  velocityExponent: number;
  diameterExponent: number;
}

const DEWAARD_MASS_TRANSFER: Coefficient<DeWaardMassTransferConstants> = {
  id: "deWaard.massTransfer",
  module: MODULE,
  value: { leadingConstant: 2.45, velocityExponent: 0.8, diameterExponent: 0.8 },
  unit: "-",
  description:
    "Kütle transferi sınırlı hız Vm=2,45×(Usıvı/d)^0,8×pCO2 [Usıvı: m/s, d: m, pCO2: MPa, Vm: mm/yıl]",
  source: SRC_AAU_THESIS,
  crossChecked: false,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Jasim (2026) Eq.6, YAPISAL OLARAK FARKLI: Vm=2,8×U^0,8/d^0,2×fCO2 (d üssü 0,2, AAU " +
        "tezinin 0,8'i DEĞİL; katsayı 2,8, AAU'nun 2,45'i DEĞİL). GERÇEK bir uyuşmazlıktır.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki bağımsız kaynak farklı d-üssü (0,8 vs 0,2) ve farklı katsayı (2,45 vs 2,8) veriyor — " +
    "kullanıcı onayıyla üniversite tezi kaynaklı versiyon esas alındı. pCO2 birimi tezde Eq.3.1 " +
    "(orijinal form) için AÇIKÇA MPa olarak belirtiliyor; Eq.3.6 için birim tekrar YAZILMAMIŞ, bu " +
    "yüzden aynı bölümün devamı olarak MPa varsayıldı — bu bir yorumlama kararıdır, notta belirtilir.",
};

const DEWAARD_RESISTANCE_MODEL_NOTE: Coefficient<string> = {
  id: "deWaard.resistanceModelFormula",
  module: MODULE,
  value: "1/Vcor = 1/Vr + 1/Vm",
  unit: "-",
  description: "Akış hızı etkisini modelleyen direnç (resistance) modeli — Lotz (1990)",
  source: SRC_NQ_THESIS,
  crossChecked: true,
  crossCheckSources: [SRC_AAU_THESIS, SRC_JASIM_2026],
  confidence: "HIGH",
  notes:
    "ÜÇ bağımsız kaynak (2 üniversite tezi + 1 hakemli dergi makalesi) BİREBİR AYNI direnç " +
    "denklemini veriyor — bu dosyadaki en güçlü çapraz doğrulama. Sayısal bir katsayı değil bir " +
    "MODEL YAPISI olduğu için registry'ye yalnızca izlenebilirlik amacıyla kaydedildi.",
};

// ─────────────────────────────────────────────────────────────────────────
// Fcond — yoğuşma faktörü (ıslak gaz, serbest su yok)
// ─────────────────────────────────────────────────────────────────────────

export interface DeWaardFcondConstants {
  defaultValue: number;
  minValue: number;
  maxValue: number;
  criticalConfensationRateGM2S: number;
}

const DEWAARD_FCOND: Coefficient<DeWaardFcondConstants> = {
  id: "deWaard.fcond",
  module: MODULE,
  value: { defaultValue: 0.1, minValue: 0.1, maxValue: 0.33, criticalConfensationRateGM2S: 0.25 },
  unit: "-",
  description:
    "Yoğuşma faktörü Fcond: yoğuşma hızı <0,25g/(m²·s) iken varsayılan 0,1 (nomogram tahmininin " +
    "1/10'u); kullanıcı 0,1-0,33 (≈1/3) arasında elle ayarlayabilir.",
  source: SRC_GENERAL_LIT_SYNTHESIS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "PROJECT_DOCUMENT",
      citation:
        "Görev talimatının kendisi: \"buhardan yoğuşan su ile oluşan korozyon, nomogram tahmininin " +
        "1/3 ile 1/10'u kadardır. Varsayılan 0.1; kullanıcı 0.1-0.33 arasında ayarlayabilsin.\" — " +
        "bağımsız literatür taramasıyla (de Waard&Lotz 1993, 0,25mL/m²/s eşiği ve Fc=0,1 varsayılanı) " +
        "TUTARLI bulundu.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "Bu oturumda kullanıcının kendi iç proje dokümanlarında bu SAYISAL değer (1/3-1/10, 0,25mL/m²/s) " +
    "birebir bulunamadı (yalnızca temel nomogram denklemi bulundu, bkz. deWaard.nomogram) — ancak " +
    "görev talimatının kendisi bu değerleri doğrudan veriyor VE bağımsız genel literatür taraması " +
    "(de Waard & Lotz 1993'e atıfla, birden fazla arama sonucunda tutarlı şekilde tekrarlanan " +
    "\"Fc=0,1 yoğuşma hızı<0,25mL/m²/s iken\" ifadesi) bunu DOĞRULUYOR. Birincil de Waard & Lotz " +
    "(1993) makalesine bu oturumda doğrudan erişilemedi (paywall) — bu yüzden HIGH değil MEDIUM.",
};

export const DEWAARD_COEFFICIENTS: Coefficient[] = [
  DEWAARD_NOMOGRAM as Coefficient,
  DEWAARD_FSCALE as Coefficient,
  DEWAARD_FPH_EXPONENT,
  DEWAARD_MASS_TRANSFER as Coefficient,
  DEWAARD_RESISTANCE_MODEL_NOTE as Coefficient,
  DEWAARD_FCOND as Coefficient,
];

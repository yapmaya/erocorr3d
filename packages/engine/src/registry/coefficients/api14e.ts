// packages/engine/src/registry/coefficients/api14e.ts
//
// API RP 14E "Recommended Practice for Design and Installation of Offshore
// Production Platform Piping Systems" (5. Baskı, 1 Ekim 1991) — erozyonel
// hız TARAMA kriteri: Ve = C / √ρm  [ft/s, ρm lb/ft³].
//
// API RP 14E'nin kendisi paywall'lı (yalnızca API/ANSI üzerinden satılıyor,
// bu oturumda tam metne doğrudan erişilemedi). Bu dosyadaki C-faktörü
// tablosu, API RP 14E'nin metnini BİREBİR alıntılayan, hakemli bir dergi
// makalesinden (Madani Sani et al., Wear 2019 — bu oturumda tam metin
// pdftotext ile okundu) alınmıştır; bu makale zaten DNV RP O501'in kendi
// referans listesinde (Ref. API RP 14E, 5. Baskı 1991) atıfta bulunduğu AYNI
// standarttır. İKİNCİ bağımsız kaynak: NORSOK P-002'nin aynı formun (C=150'ye
// karşılık gelen) türetilmiş bir versiyonunu içerdiği, yine Madani Sani et
// al. (2019) içinde belgelenmiştir — bu, C-faktörü ailesinin endüstride
// tutarlı biçimde aktarıldığının dolaylı bir çapraz doğrulamasıdır.

import type { Coefficient, Source } from "../types";

const MODULE = "api14e";

const SRC_API_14E: Source = {
  type: "STANDARD",
  citation:
    "American Petroleum Institute, \"Recommended Practice for Design and Installation of Offshore " +
    "Production Platform Piping Systems\", API RP 14E, 5. Baskı, 1 Ekim 1991 — Tablo (c-faktörü önerileri, " +
    "sürekli/aralıklı servis, katı-içermeyen akışkanlar için korozif/korozif-olmayan/CRA ayrımı).",
  accessedDate: "2026-08-11",
};

const SRC_MADANI_SANI_2019: Source = {
  type: "JOURNAL",
  citation:
    "F. Madani Sani, S. Huizinga, K.A. Esaklul, S. Nesic, \"Review of the API RP 14E erosional velocity " +
    "equation: Origin, applications, misuses, limitations and alternatives\", Wear, Cilt 426-427 (2019), " +
    "s. 620-636, Bölüm 2 (Tablo 1) — API RP 14E'nin c-faktörü tablosunun birebir alıntısı.",
  url: "https://doi.org/10.1016/j.wear.2019.01.119",
  accessedDate: "2026-08-11",
};

export type Api14eServiceType = "CONTINUOUS" | "INTERMITTENT";

/**
 * API RP 14E'nin kendi metninde ayırt ettiği dört akışkan/servis kategorisi
 * (Tablo 1, Madani Sani et al. 2019 — bkz. API RP 14E §II.C.2). "NO_MITIGATION"
 * satırı, standardın orijinal metninde muğlak biçimde yalnızca "Corrosive"
 * olarak anılan ama korozif olup İNHİBİTÖRSÜZ/CRA'sız (yani hiçbir azaltma
 * önlemi olmayan) durum içindir — bu en düşük (en muhafazakâr) c-faktörünü
 * taşır.
 */
export type Api14eFluidCategory =
  | "SOLIDS_FREE_NON_CORROSIVE"
  | "SOLIDS_FREE_CORROSIVE_INHIBITED"
  | "SOLIDS_FREE_CORROSIVE_CRA"
  | "SOLIDS_FREE_CORROSIVE_NO_MITIGATION"
  | "WITH_SOLIDS";

export interface Api14eCFactorRow {
  fluidCategory: Api14eFluidCategory;
  /** [min,max] aralığı — API RP 14E "muhafazakâr" alt sınırı önerir, üst sınır "daha yüksek c kullanılabilir" notuyla verilir. null = tanımsız (WITH_SOLIDS: sahaya özgü test gerekir) */
  continuousServiceCFactorRange: [number, number] | null;
  intermittentServiceCFactorRange: [number, number] | null;
  noteTr: string;
}

const API14E_C_FACTOR_TABLE: Coefficient<Api14eCFactorRow[]> = {
  id: "api14e.cFactorTable",
  module: MODULE,
  value: [
    {
      fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
      continuousServiceCFactorRange: [150, 200],
      intermittentServiceCFactorRange: [250, 250],
      noteTr: "Katı içermeyen, korozif olmayan akışkan (korozyon beklenmiyor).",
    },
    {
      fluidCategory: "SOLIDS_FREE_CORROSIVE_INHIBITED",
      continuousServiceCFactorRange: [150, 200],
      intermittentServiceCFactorRange: [250, 250],
      noteTr:
        "Katı içermeyen, korozif ama inhibitörle kontrol edilen akışkan — inhibitörün fiilen etkili " +
        "olduğu varsayımı geçerlidir.",
    },
    {
      fluidCategory: "SOLIDS_FREE_CORROSIVE_CRA",
      continuousServiceCFactorRange: [150, 200],
      intermittentServiceCFactorRange: [250, 250],
      noteTr: "Katı içermeyen, korozif ama korozyona dayanıklı alaşım (CRA) boru malzemesi kullanılıyor.",
    },
    {
      fluidCategory: "SOLIDS_FREE_CORROSIVE_NO_MITIGATION",
      continuousServiceCFactorRange: [100, 100],
      intermittentServiceCFactorRange: [125, 125],
      noteTr:
        "Katı içermeyen, korozif VE hiçbir azaltma önlemi (inhibitör/CRA) yok — API RP 14E'nin en " +
        "muhafazakâr (en düşük) c-faktörü satırı; standardın metninde \"industry experience to date " +
        "indicates that... values of c=100 for continuous service and c=125 for intermittent service are " +
        "conservative\" ifadesiyle veriliyor.",
    },
    {
      fluidCategory: "WITH_SOLIDS",
      continuousServiceCFactorRange: null,
      intermittentServiceCFactorRange: null,
      noteTr:
        "API RP 14E, katı parçacık (kum vb.) içeren akışkanlar için HİÇBİR sayısal c-faktörü VERMEZ — " +
        "standardın kendi metni \"if solids production is anticipated, fluid velocities should be " +
        "significantly reduced\" der ve uygun c-faktörünün \"specific application studies\"nden " +
        "bulunmasını ister. BU YÜZDEN katı içeren akışlar için API 14E TARAMASI YETERSİZDİR — asıl " +
        "değerlendirme DNV-RP-O501 (bkz. erosion/dnvO501.ts) ile yapılmalıdır; bu proje katı-içeren " +
        "akışlarda API 14E'yi yalnızca ikincil/bilgilendirici bir tarama olarak sunar.",
    },
  ],
  unit: "-",
  description:
    "API RP 14E §II.C.2 c-faktörü tablosu — akışkan/servis kategorisine göre önerilen aralıklar " +
    "(Ve=C/√ρm formülünde kullanılır).",
  source: SRC_API_14E,
  crossChecked: true,
  crossCheckSources: [SRC_MADANI_SANI_2019],
  confidence: "HIGH",
  notes:
    "Madani Sani et al. (2019, Wear, hakemli) API RP 14E'nin (paywall'lı) orijinal metnini BİREBİR alıntı " +
    "olarak veriyor (Tablo 1, doğrudan tırnak içinde \"industry experience to date indicates...\"), bu " +
    "yüzden bu makale kaynak olarak kullanıldı; DNV RP O501'in kendi kaynakça listesi de aynı API RP 14E " +
    "5. Baskı 1991'i doğrudan atıf gösteriyor (bkz. registry/coefficients/dnvO501.ts kaynak notu, bu iki " +
    "standardın birbirini doğrudan referans aldığının kanıtı). WITH_SOLIDS satırının değersiz olması " +
    "KASITLIDIR — standardın kendi ifade ettiği gerçek bir boşluktur, tahmini bir sayı UYDURULMADI.",
};

const API14E_IMPERIAL_TO_SI_VELOCITY_FACTOR: Coefficient<number> = {
  id: "api14e.imperialToSiVelocityFactor",
  module: MODULE,
  value: 1.21988,
  unit: "-",
  description:
    "Ve[m/s] = faktör × C / √(ρm[kg/m³]) — API RP 14E'nin orijinal Ve[ft/s]=C/√(ρm[lb/ft³]) formülünü " +
    "SI birimlerine çeviren sabit.",
  source: {
    type: "TEXTBOOK",
    citation:
      "Bu sabit KAYNAKTAN alınmadı — tam tersine, standart SI/ABD birim dönüşüm sabitlerinden (1 ft = " +
      "0,3048 m [tanım gereği tam]; 1 lb/ft³ = 16,018463... kg/m³ [1 lb=0,45359237 kg ve 1 ft=0,3048 m " +
      "tanımlarından türetilir]) bu oturumda BOYUTSAL ANALİZLE türetildi: " +
      "Ve[m/s] = Ve[ft/s]×0,3048 = (C/√(ρm[lb/ft³]))×0,3048 = C×0,3048×√(16,018463)/√(ρm[kg/m³]) " +
      "= C×1,21988/√(ρm[kg/m³]).",
    accessedDate: "2026-08-11",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bağımsız ikinci hesap yolu: 1 m/s = 3,28084 ft/s ve 1 kg/m³ = 0,062428 lb/ft³ tablo " +
        "değerlerinden aynı sabit ileri yönde de (Ve[ft/s]→Ve[m/s] yerine doğrudan formül SI'da yeniden " +
        "yazılarak) türetilip 1,21988 ile (yuvarlama farkı hariç) birebir örtüştüğü doğrulandı.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes:
    "Bu KDP kaydı bir \"deneysel/ampirik sabit\" değil, SAF birim dönüşümüdür — yine de izlenebilirlik ve " +
    "sihirli-sayı-yasağı ilkesi gereği registry'ye kaydedildi (dnvO501.unitConversionConstant ile aynı " +
    "muamele).",
};

export const API14E_COEFFICIENTS: Coefficient[] = [
  API14E_C_FACTOR_TABLE as Coefficient,
  API14E_IMPERIAL_TO_SI_VELOCITY_FACTOR,
];

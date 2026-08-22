// packages/engine/src/registry/coefficients/dnvO501.ts
//
// DNV RP O501 "Erosive Wear in Piping Systems" (Rev. 4.2, 2005) — katı
// parçacık (kum) erozyonu temel model sabitleri.
//
// Temel denklem (Eq. 8.1, Bölüm 8.1):
//   E&_L = [ṁp × K × Up^n × F(α)] / (ρt × At) × Cunit   [mm/yıl]
// burada F(α) (Eq. 7.2/7.3, Tablo 6-1) parçacık çarpma açısına bağlı bir
// 8. dereceden polinomdur, K/n (Tablo 6-2) hedef malzemeye özgü aşınma
// sabitleridir.
//
// Bu dosyadaki HER sabit araştırılmış ve kaynağı belgelenmiştir. Standardın
// tam metni bu oturumda doğrudan indirilip (pdftotext ile) okundu — hiçbir
// sayı hafızadan yazılmadı.

import type { Coefficient, Source } from "../types";

export interface DnvImpactAngleConstants {
  a1: number;
  a2: number;
  a3: number;
  a4: number;
  a5: number;
  a6: number;
  a7: number;
  a8: number;
}

export type DnvMaterialClass =
  | "STEEL"
  | "TITANIUM"
  | "GRP_EPOXY"
  | "GRP_VINYL_ESTER"
  // Aşağıdaki 6 sınıf, standardın Tablo 6-2'sinde AYRI satır olarak yer
  // ALMAZ — bkz. DNV_MATERIAL_CONSTANTS notes alanı: CS/DSS/SDSS/NI_ALLOY
  // standardın kendi metnindeki "tüm çelik türleri ve Ni bazlı alaşımlar"
  // eşdeğerlik ifadesiyle STEEL satırına eşlenir (HIGH); TUNGSTEN_CARBIDE ve
  // CERAMIC_COATING için standart yalnızca NİTEL "gevrek malzeme" sınıflaması
  // verir, SAYISAL K/n VERMEZ — bu iki satır UNVERIFIED kaba tahmindir.
  | "CS"
  | "DSS"
  | "SDSS"
  | "NI_ALLOY"
  | "TUNGSTEN_CARBIDE"
  | "CERAMIC_COATING";

export interface DnvMaterialConstantRow {
  materialClass: DnvMaterialClass;
  /** Erozyon sabiti K, (m/s)^-n biriminde */
  k: number;
  /** Hız üsteli n (boyutsuz) */
  n: number;
  /** Referans yoğunluk (kg/m³) — bilgi amaçlı, gerçek hesapta çağıranın verdiği hedef yoğunluk kullanılmalıdır */
  referenceDensityKgM3: number;
}

const MODULE = "dnvO501";

// ─────────────────────────────────────────────────────────────────────────
// Kaynak
// ─────────────────────────────────────────────────────────────────────────

const SRC_DNV_O501: Source = {
  type: "STANDARD",
  citation:
    "Det Norske Veritas, \"Recommended Practice DNV-RP-O501: Erosive Wear in Piping Systems\", Rev. 4.2 " +
    "(2005) — Bölüm 6 (Tablo 6-1 F(α) polinom sabitleri, Tablo 6-2 malzeme sabitleri K/n/yoğunluk) ve Bölüm " +
    "8.1 (temel erozyon hızı denklemi Eq. 8.1, birim dönüşüm sabiti Cunit=3.15×10¹⁰). Bu oturumda dosyanın " +
    "tam metni doğrudan indirilip pdftotext ile okundu.",
  url: "https://rules.dnv.com/docs/pdf/dnvpm/codes/docs/2005-01/RP-O501.pdf",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// F(α) polinom sabitleri (Tablo 6-1)
// ─────────────────────────────────────────────────────────────────────────

const DNV_IMPACT_ANGLE_CONSTANTS: Coefficient<DnvImpactAngleConstants> = {
  id: "dnvO501.impactAngleConstants",
  module: MODULE,
  value: {
    a1: 9.37,
    a2: 42.295,
    a3: 110.864,
    a4: 175.804,
    a5: 170.137,
    a6: 98.398,
    a7: 31.211,
    a8: 4.17,
  },
  unit: "-",
  description:
    "F(α) fonksiyonu (çelik türleri için, Eq. 7.2/7.3) 8. dereceden polinom katsayıları A1-A8 — çarpma " +
    "açısı α (derece) için F(α)=Σ(-1)^(i+1)·Ai·(α·π/180)^i.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Tablo 6-1'den DOĞRUDAN okundu. Standart bu polinomun yalnızca ÇELİK türleri için geçerli olduğunu " +
    "belirtiyor (sünek malzeme davranışı, maksimum erozyon 15-30° çarpma açısında); gevrek malzemeler " +
    "(seramik, sert metal karbür) için farklı bir F(α) eğrisi gerekir ve bu standart onu sayısal olarak " +
    "vermiyor (yalnızca grafik/Şekil 6-2 referansı var) — bu proje kapsamında yalnızca çelik/sünek malzeme " +
    "varsayımıyla kullanılmalıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Malzeme sabitleri K/n/yoğunluk (Tablo 6-2)
// ─────────────────────────────────────────────────────────────────────────

const DNV_MATERIAL_CONSTANTS: Coefficient<DnvMaterialConstantRow[]> = {
  id: "dnvO501.materialConstants",
  module: MODULE,
  value: [
    { materialClass: "STEEL", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 7800 },
    { materialClass: "TITANIUM", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 4500 },
    { materialClass: "GRP_EPOXY", k: 0.3e-9, n: 3.6, referenceDensityKgM3: 1800 },
    { materialClass: "GRP_VINYL_ESTER", k: 0.6e-9, n: 3.6, referenceDensityKgM3: 1800 },
    // CS/DSS/SDSS/NI_ALLOY: standardın kendi STEEL satırıyla eşdeğer kabul
    // edilir (bkz. notes) — yalnızca referenceDensityKgM3 malzemeye özgüdür
    // (tipik literatür yoğunlukları, K/n ile aynı kaynaktan DEĞİL).
    { materialClass: "CS", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 7850 },
    { materialClass: "DSS", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 7800 },
    { materialClass: "SDSS", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 7800 },
    { materialClass: "NI_ALLOY", k: 2.0e-9, n: 2.6, referenceDensityKgM3: 8440 },
  ],
  unit: "-",
  description: "Tablo 6-2 — malzeme erozyon sabitleri K ((m/s)^-n), hız üsteli n ve referans yoğunluk (kg/m³).",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Tablo 6-2'den DOĞRUDAN okundu. Standart, 100 m/s altındaki hızlarda tüm çelik türleri (ve Ni bazlı " +
    "alaşımlar) arasındaki erozyon direnci farkının genellikle %10-20 içinde kaldığını belirtiyor — yani " +
    "TÜM çelik/paslanmaz/duplex/Ni-alaşım malzemeleri için AYNI K/n kullanılması standardın kendi " +
    "gerekçesiyle tutarlıdır (tek bir \"STEEL\" satırı, alt tür ayrımı yapılmıyor); bu proje bu eşdeğerliği " +
    "CS/DSS/SDSS/NI_ALLOY satırlarına AÇIKÇA genişletti — bu 4 satırın K/n'i confidence:HIGH'tır (standardın " +
    "kendi ifadesinin doğrudan uygulanmasıdır), ama bu eşdeğerlik varsayımının KENDİSİ (\"tüm çelik/Ni " +
    "alaşımları aynı davranır\") standardın 100 m/s ve altı için verdiği bir genelleme olduğu unutulmamalı. " +
    "Titanyum ve GRP (cam elyaf takviyeli epoksi/vinil ester) için \"literatürde sınırlı veri mevcuttur\" " +
    "notu var — bu iki satır standardın kendi ifadesiyle daha az kesindir ama yine de standardın resmi " +
    "tablosundan geldiğinden HIGH confidence korundu. TUNGSTEN_CARBIDE ve CERAMIC_COATING BU TABLODA YOK " +
    "— bkz. AYRI kayıt dnvO501.materialConstantsUnverified (KASITLI olarak ayrı bir Coefficient, bu " +
    "listenin HIGH güvenini seyreltmemesi için — bkz. o kaydın notes alanı).",
};

// TUNGSTEN_CARBIDE ve CERAMIC_COATING BİLEREK ayrı, UNVERIFIED bir
// Coefficient olarak tutulur (valveCatalog.ts'teki hydraulics/erosionZones
// ayrımıyla AYNI gerekçe: tek bir paylaşılan confidence etiketi gerçek
// farkı gizlerdi) — getCoefficient() bu kayıt her okunduğunda konsola KDP
// uyarısı basar ve UI sarı rozet gösterir (yukarıdaki HIGH tablo için
// GÖSTERMEZ).
const DNV_MATERIAL_CONSTANTS_UNVERIFIED: Coefficient<DnvMaterialConstantRow[]> = {
  id: "dnvO501.materialConstantsUnverified",
  module: MODULE,
  value: [
    { materialClass: "TUNGSTEN_CARBIDE", k: 2.0e-10, n: 2.6, referenceDensityKgM3: 14500 },
    { materialClass: "CERAMIC_COATING", k: 2.0e-10, n: 2.6, referenceDensityKgM3: 3900 },
  ],
  unit: "-",
  description:
    "Standardın Tablo 6-2'sinde YER ALMAYAN, gevrek (brittle) malzemeler için bu oturumda tahmin edilen " +
    "kaba K/n değerleri.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Standart, tungsten karbür ve seramik kaplamaları yalnızca NİTEL olarak \"gevrek malzeme\" (F(α) eğrisi " +
    "farklı, tepe 90°'de, sayısal olarak verilmiyor, yalnızca Şekil 6-2 grafik referansı) olarak tanımlıyor " +
    "— Tablo 6-2'de SAYISAL bir satırları YOK. Bu oturumda Haugen/Kvernvold/Ronold/Sandberg (Wear 186-187, " +
    "1995, \"Sand Erosion of Wear-Resistant Materials: Erosion in Choke Valves\" — DNV'nin kendi Ref./8/'i, " +
    "28 malzeme test etmiş: standart çelikler, tungsten karbür, kaplamalar, seramikler) BULUNDU ve doğru " +
    "kaynak olduğu doğrulandı, ANCAK makalenin tam metnine (ScienceDirect ödeme duvarı) bu oturumda " +
    "erişilemedi — yalnızca ikincil/dolaylı kaynaklarda tekrarlanan NİTEL \"WC, çelikten onlarca-yüzlerce " +
    "kat daha dayanıklı\" ifadeleri bulundu, SAYISAL bir K değeri hiçbir kaynakta doğrulanamadı. Buradaki " +
    "K=2,0×10⁻¹⁰ (çelik K'sinin 1/10'u) KDP kural 4 gereğince açıkça UYDURULMAMIŞ bir \"en makul tahmin\"dir: " +
    "bulunan nitel ifadelerin EN MUHAFAZAKÂR ucu (10 kat, 100 kat değil) seçildi. Kullanılmadan önce " +
    "MUTLAKA doğrulanmalı, ayrıca F(α) polinomunun (dnvO501.impactAngleConstants) bu iki malzeme için " +
    "GEÇERSİZ olduğu (yalnızca sünek malzeme davranışı için türetildi) ayrı bir validityWarning ile HER " +
    "ZAMAN bildirilir (bkz. erosion/dnvO501.ts getMaterialConstants).",
};

// ─────────────────────────────────────────────────────────────────────────
// Birim dönüşüm sabiti (Eq. 8.1)
// ─────────────────────────────────────────────────────────────────────────

const DNV_UNIT_CONVERSION_CONSTANT: Coefficient<number> = {
  id: "dnvO501.unitConversionConstant",
  module: MODULE,
  value: 3.15e10,
  unit: "-",
  description:
    "Eq. 8.1'deki Cunit sabiti — [kg/s / (kg/m³ × m²)] = [m/s] biriminde çıkan ara sonucu [mm/yıl]'a " +
    "dönüştürür.",
  source: SRC_DNV_O501,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Bu sabit bu oturumda BOYUTSAL ANALİZ ile bağımsız olarak yeniden türetildi: 1 m/s = 1000 mm/s, " +
        "1 yıl = 31.536.000 s (365 gün) ⇒ 1 m/s = 1000×31.536.000 = 3,1536×10¹⁰ mm/yıl — standardın " +
        "verdiği 3,15×10¹⁰ değeriyle (yuvarlama farkı hariç) BİREBİR örtüşüyor.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes: "Standarttan okunan değer, bağımsız boyutsal analizle doğrulandı (bkz. crossCheckSources).",
};

// ─────────────────────────────────────────────────────────────────────────
// İkinci kaynak: geometri denklemleri Madani Sani et al. (2019, Wear,
// hakemli) tarafından da özetlenip DNV RP O501 ile birebir örtüşecek
// şekilde yeniden üretildi (kritik parçacık çapı formülü γc dahil) — bu
// dosyadaki geometri-özel sabitlerin bazıları için ikinci bağımsız kaynak
// olarak kullanılmıştır (bkz. ilgili notes alanları).
// ─────────────────────────────────────────────────────────────────────────

const SRC_MADANI_SANI_2019: Source = {
  type: "JOURNAL",
  citation:
    "F. Madani Sani, S. Huizinga, K.A. Esaklul, S. Nesic, \"Review of the API RP 14E erosional velocity " +
    "equation: Origin, applications, misuses, limitations and alternatives\", Wear, Cilt 426-427 (2019), " +
    "s. 620-636, Bölüm 7.4 (DNV GL-RP-O501 özeti, Eq. 15-27).",
  url: "https://doi.org/10.1016/j.wear.2019.01.119",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Düz boru (Bölüm 8.2, Eq. 8.9) — DİKKAT: bu, Eq. 8.1 temel denkleminden
// TÜRETİLMİŞ bir formül DEĞİLDİR; K/n/F(α)/At kavramları YOKTUR, tamamen
// ayrı, kapalı biçimli ampirik bir korelasyondur (yalnızca DÜŞEY çelik
// borular için, standart "erosion in smooth pipes is generally small and
// negligible" diyor).
// ─────────────────────────────────────────────────────────────────────────

const DNV_STRAIGHT_PIPE_CONSTANT: Coefficient<number> = {
  id: "dnvO501.straightPipe.constant",
  module: MODULE,
  value: 2.5e-5,
  unit: "-",
  description:
    "Eq. 8.9 — düşey düz çelik boru erozyon hızı: E_L=2,5×10⁻⁵×U^2,6×ṁp×D⁻² [mm/yıl] (SI girdiler).",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Tablo/denklem doğrudan sayfa görüntüsünden (Bölüm 8.2) okundu. Standart bu değeri Ref./11/ " +
    "(Kvernvold ve Sandberg, DNV Report 93-3252, 1993) olarak atıflandırıyor — bu iç DNV raporuna bu " +
    "oturumda ayrıca erişilemedi, birincil kaynak DNV RP O501'in kendisi olarak bırakıldı.",
};

// ─────────────────────────────────────────────────────────────────────────
// Parçacık boyutu/yoğunluk düzeltme faktörü C2 (Eq. 8.12/8.33/8.37) — kaynak
// dikişi, redüksiyon VE sıyırma probu alt-prosedürlerinde AYNEN tekrarlanan
// tek bir formül: (10⁶·dp)/(30·√ρm) < 1 ise C2=bu oran, değilse C2=1.
// ─────────────────────────────────────────────────────────────────────────

const DNV_PARTICLE_SIZE_DENSITY_CORRECTION_DENOMINATOR: Coefficient<number> = {
  id: "dnvO501.particleSizeDensityCorrection.denominatorConstant",
  module: MODULE,
  value: 30,
  unit: "-",
  description:
    "C2 formülündeki payda sabiti: C2=min(1, 10⁶·dp[m]/(30·√(ρm[kg/m³]))). dp=parçacık çapı, ρm=karışım " +
    "yoğunluğu.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın 3 AYRI yerinde (Eq. 8.12 kaynak dikişi, Eq. 8.33 redüksiyon, Eq. 8.37 sıyırma probu) " +
    "BİREBİR aynı formülle tekrarlandığı doğrulandı — standardın kendi iç tutarlılığı bir tür kendiliğinden " +
    "çapraz doğrulamadır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kaynak dikişi / redüksiyon ortak: bilinmeyen çarpma açısı için muhafazakâr
// varsayılan (Bölüm 8.3.1 adım 1 ve Bölüm 8.6 adım 1'de AYNI ifadeyle
// tekrarlanıyor: "α=60° kullanılmalı, F(α)·sin(α)=0,78 verir").
// ─────────────────────────────────────────────────────────────────────────

const DNV_CONSERVATIVE_DEFAULT_IMPACT_ANGLE_DEG: Coefficient<number> = {
  id: "dnvO501.conservativeDefaultImpactAngleDeg",
  module: MODULE,
  value: 60,
  unit: "derece",
  description:
    "Çarpma açısı bilinmiyorsa kullanılacak muhafazakâr varsayılan (kaynak dikişi ve redüksiyon alt-" +
    "prosedürleri için standardın kendi önerisi); F(60°)·sin(60°)≈0,78.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Standardın 2 ayrı bölümünde (8.3.1 adım 1, 8.6 adım 1) birebir aynı ifadeyle verilmiştir.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kaynak dikişi — akışa bakan yüz (Bölüm 8.3.1, Eq. 8.10-8.13): At=Apipe/sin(α)
// geometrik alan ölçeklemesi dışında ek bir sabit gerekmiyor (temel Eq. 8.1
// çekirdeği + C2 + sin(α) çarpanı yeterli — bkz. erosion/dnvO501.ts).
//
// Kaynak dikişi — aşağı akış (Bölüm 8.3.2, Eq. 8.14): AYRI, kapalı biçimli
// ampirik korelasyon (çelik, kaynak yüksekliği h girdili).
// ─────────────────────────────────────────────────────────────────────────

const DNV_DOWNSTREAM_WELD_CONSTANTS: Coefficient<{ leadingCoefficient: number; heightOffsetM: number }> = {
  id: "dnvO501.downstreamWeld.constants",
  module: MODULE,
  value: { leadingCoefficient: 0.33e-2, heightOffsetM: 7.5e-4 },
  unit: "-",
  description:
    "Eq. 8.14 — aşağı akış kaynak dikişi erozyonu (çelik): E_L=0,33×10⁻²×(7,5×10⁻⁴+h)×Up^2,6×D⁻²×ṁp " +
    "[mm/yıl], h=kaynak yüksekliği (m), SI girdiler.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standart bu formülü de Ref./11/ (Kvernvold ve Sandberg, DNV Report 93-3252, 1993) olarak " +
    "atıflandırıyor; K/n/F(α)/At çerçevesine UYMAYAN, tamamen ayrı kapalı biçimli bir korelasyondur.",
};

// ─────────────────────────────────────────────────────────────────────────
// Dirsek (Bölüm 8.4, Eq. 8.15-8.21) — en kritik alt-model: kritik parçacık
// çapı γc, R/D'ye VE parçacık boyutuna göre tepe konumunu kaydırır.
// ─────────────────────────────────────────────────────────────────────────

const DNV_BEND_GEOMETRY_FACTOR_C1: Coefficient<number> = {
  id: "dnvO501.bend.geometryFactorC1",
  module: MODULE,
  value: 2.5,
  unit: "-",
  description:
    "Dirsek model/geometri faktörü C1 — çoklu parçacık çarpması, dirseğin dış kısmında parçacık " +
    "yoğunlaşması ve model belirsizliğini hesaba katar.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Rev 4.2'de 2,5'e DÜŞÜRÜLDÜ (önceki Rev 4.1'de C1=5 idi — standardın kendi metninde açıkça belirtiliyor, " +
    "\"reduced from C1=5 in ver.4.1\"). Bu proje YALNIZCA Rev 4.2 değerini (2,5) kullanır.",
};

const DNV_BEND_CRITICAL_DIAMETER_CONSTANTS: Coefficient<{ lnCoefficient: number; offset: number }> = {
  id: "dnvO501.bend.criticalDiameterConstants",
  module: MODULE,
  value: { lnCoefficient: 1.88, offset: 6.04 },
  unit: "-",
  description:
    "Eq. 8.17 — kritik parçacık çapı oranı γc=dp,c/D=1/(β·[1,88·ln(A)−6,04]), A=Eq.8.16 boyutsuz grup, " +
    "β=ρp/ρm.",
  source: SRC_DNV_O501,
  crossChecked: true,
  crossCheckSources: [SRC_MADANI_SANI_2019],
  confidence: "HIGH",
  notes:
    "Sayfa görüntüsünden piksel piksel doğrulandı VE Madani Sani et al. (2019) Eq. 21'de BİREBİR aynı " +
    "sabitlerle (1,88 ve 6,04) bağımsız olarak yeniden üretilmiş halde bulundu — bu dosyadaki en yüksek " +
    "çapraz doğrulama güvenine sahip dirsek sabiti.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kör Te / Blinded Tee (Bölüm 8.5, Eq. 8.22-8.29) — β=ρp/ρm eşiğine (40) göre
// İKİ AYRI dal: γc, c ve C1 formülleri β<40 / β≥40 için farklıdır.
// ─────────────────────────────────────────────────────────────────────────

export interface DnvBlindTeeConstants {
  betaThreshold: number;
  /** β < eşik dalı: γc = numerator/β */
  lowBeta: { criticalDiameterNumerator: number; cReCoefficient: number; geometryFactorC1Numerator: number };
  /** β ≥ eşik dalı */
  highBeta: {
    criticalDiameterCoefficient: number;
    /** b üsteli formülündeki Reynolds ölçek sabiti (Eq. 8.24 b formülü) */
    bReynoldsScale: number;
    bOffset: number;
    bExponent: number;
    cReCoefficient: number;
    cLeadingCoefficient: number;
    cDecayBase: number;
    geometryFactorC1: number;
  };
}

const DNV_BLIND_TEE_CONSTANTS: Coefficient<DnvBlindTeeConstants> = {
  id: "dnvO501.blindTee.constants",
  module: MODULE,
  value: {
    betaThreshold: 40,
    lowBeta: { criticalDiameterNumerator: 0.14, cReCoefficient: 19, geometryFactorC1Numerator: 3 },
    highBeta: {
      criticalDiameterCoefficient: 0.0035,
      bReynoldsScale: 10000,
      bOffset: -1.2,
      bExponent: -0.6,
      cReCoefficient: 19,
      cLeadingCoefficient: -0.3,
      cDecayBase: 1.01,
      geometryFactorC1: 1.0,
    },
  },
  unit: "-",
  description:
    "Eq. 8.22-8.26 — kör Te γc/c/C1 sabitleri, β=ρp/ρm eşiğine (40) göre iki ayrı formül dalı. β<40: " +
    "γc=0,14/β, c=19/ln(Re) (γ<γc) veya 0 (γ≥γc), C1=3/β^0,3. β≥40: γc=0,0035·(β/40)^b (b=Eq.8.24), " +
    "c=19/ln(Re) (γ<γc) veya −0,3·(1−1,01^−(β−40)) (γ≥γc), C1=1,0.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Bu denklem grubu, 200-250dpi sayfa görüntüsünden (Bölüm 8.5, Sayfa 21) PİKSEL PİKSEL okundu — " +
    "pdftotext çıktısı bu tabloyu ciddi biçimde karıştırmıştı (iki dal yan yana basılmış OCR'da iç içe " +
    "geçmişti), bu yüzden görsel doğrulama ZORUNLUYDU. C1 üsteli (0,3) ve b üsteli (−0,6) dahil tüm " +
    "sabitler görüntüden teyit edildi.",
};

// ─────────────────────────────────────────────────────────────────────────
// Redüksiyon (Bölüm 8.6, Eq. 8.30-8.35) — RESTRICTION_ORIFICE için de
// (bir kısıtlama orifisi, geometrik olarak D2«D1 olan dejenere bir
// redüksiyon örneğidir) bu proje kapsamında YENİDEN KULLANILIR — bkz.
// erosion/dnvO501.ts başlık yorumu.
// ─────────────────────────────────────────────────────────────────────────
// (Ek sabit gerekmiyor: At/Aratio/Up formülleri saf geometriden gelir, C2 ve
// varsayılan açı yukarıda paylaşılan sabitlerle karşılanıyor.)

// ─────────────────────────────────────────────────────────────────────────
// Geçerlilik aralıkları (Bölüm 8.1)
// ─────────────────────────────────────────────────────────────────────────

const DNV_VALIDITY_SAND_CONTENT_PPMW: Coefficient<[number, number]> = {
  id: "dnvO501.validity.sandContentPpmW",
  module: MODULE,
  value: [1, 50],
  unit: "ppmW",
  description: "Kum içeriği tipik/beklenen aralık (kütlece ppm), ilk kademe ayırıcı öncesi kuyu akışı.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Bölüm 8.1'den DOĞRUDAN okundu. Bu, modelin GEÇERLİLİK sınırı değil, TİPİK gözlemlenen aralıktır.",
};

const DNV_VALIDITY_PARTICLE_DIAMETER_MICRON: Coefficient<[number, number]> = {
  id: "dnvO501.validity.particleDiameterMicron",
  module: MODULE,
  value: [250, 500],
  unit: "µm",
  description: "Tipik kum parçacığı boyutu aralığı (kum tutucu/çakıl filtre uygulanmamışsa).",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Bölüm 8.1'den DOĞRUDAN okundu (\"If gravel is used, sand particles less than 100 µm are to be " +
    "expected\" notu ile birlikte). Eq. 8.1'in K/n sabitleri parçacık boyutunu DOĞRUDAN bir girdi olarak " +
    "almaz (tipik boyut aralığı için kalibre edilmiştir) — bu yüzden particleDiameterMicron hesap " +
    "fonksiyonunda yalnızca bir geçerlilik uyarısı üretmek için kullanılır, ana denklemde YOKTUR.",
};

const DNV_VALIDITY_MAX_CHARACTERIZED_VELOCITY_MS: Coefficient<number> = {
  id: "dnvO501.validity.maxCharacterizedVelocityMs",
  module: MODULE,
  value: 100,
  unit: "m/s",
  description: "Malzeme erozyon direnci farklarının (%10-20 içinde) iyi karakterize edildiği üst hız sınırı.",
  source: SRC_DNV_O501,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Bölüm 6'dan DOĞRUDAN okundu (\"For velocities smaller than 100m/s, the difference in erosion " +
    "resistance for relevant steel grades is generally within 10-20%\"). Bu, K/n sabitlerinin GEÇERSİZ " +
    "olduğu kesin bir sınır DEĞİLDİR, yalnızca malzeme-farkı belirsizliğinin arttığı bir eşiktir — bu " +
    "nedenle MEDIUM (kesin bir geçerlilik sınırı değil, yorumlanması gereken bir eşik).",
};

// ─────────────────────────────────────────────────────────────────────────
// Dışa aktarım
// ─────────────────────────────────────────────────────────────────────────

export const DNV_O501_COEFFICIENTS: Coefficient[] = [
  DNV_IMPACT_ANGLE_CONSTANTS as Coefficient,
  DNV_MATERIAL_CONSTANTS as Coefficient,
  DNV_MATERIAL_CONSTANTS_UNVERIFIED as Coefficient,
  DNV_UNIT_CONVERSION_CONSTANT,
  DNV_VALIDITY_SAND_CONTENT_PPMW as Coefficient,
  DNV_VALIDITY_PARTICLE_DIAMETER_MICRON as Coefficient,
  DNV_VALIDITY_MAX_CHARACTERIZED_VELOCITY_MS,
  DNV_STRAIGHT_PIPE_CONSTANT,
  DNV_PARTICLE_SIZE_DENSITY_CORRECTION_DENOMINATOR,
  DNV_CONSERVATIVE_DEFAULT_IMPACT_ANGLE_DEG,
  DNV_DOWNSTREAM_WELD_CONSTANTS as Coefficient,
  DNV_BEND_GEOMETRY_FACTOR_C1,
  DNV_BEND_CRITICAL_DIAMETER_CONSTANTS as Coefficient,
  DNV_BLIND_TEE_CONSTANTS as Coefficient,
];

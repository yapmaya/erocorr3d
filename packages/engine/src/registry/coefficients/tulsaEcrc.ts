// packages/engine/src/registry/coefficients/tulsaEcrc.ts
//
// University of Tulsa Erosion/Corrosion Research Center (E/CRC) — "Tulsa
// modeli" erken sürümü (McLaury/Shirazi, 1993-1996'dan itibaren): CHOKE
// VANASI ve DALLANMA/GEÇİŞ Te'si (branch/sweeping tee) için kullanılır —
// bu iki geometri DNV-RP-O501'in KENDİ KAPSAMI DIŞINDADIR: DNV RP O501
// Bölüm 2 (Scope/Limitations) AÇIKÇA "the recommended calculation procedure
// is not applicable to certain components with highly complicated flow
// geometry; including manifolds and chokes" der, ve DNV'nin "Blinded Tee"
// modeli (dnvO501.ts) yalnızca KÖR (dead-end) Te'yi kapsar, akışın devam
// ettiği dallanma/geçiş Te'sini KAPSAMAZ.
//
// Bu dosyadaki TÜM sabitler, University of Tulsa E/CRC'nin orijinal
// makalelerinden (Jordan 1998 el kitabı, McLaury 1996 vb. — bu oturumda
// bunlara DOĞRUDAN erişilemedi, çoğu SPE/proprietary) DEĞİL, bu tabloları
// BİREBİR alıntılayan hakemli bir ikincil kaynaktan (Madani Sani et al.,
// Wear 2019) alınmıştır. Bu yüzden confidence hiçbir zaman HIGH değildir
// (ikincil kaynak — bkz. her girdinin notes alanı).
//
// ⚠ KULLANIM DURUMU (bu oturum): bu sabitler registry'ye kaydedildi ama
// erosion/dnvO501.ts içinde MUTLAK bir mm/yıl hızı üretmek için HENÜZ
// KULLANILMIYOR. Sebep: Eq. 28'in FM (Tablo 3) ve FP (Tablo 5) terimlerinin
// birlikte nasıl ölçeklendiği (VL^1,73 üstelinin FM'nin gizli birimleriyle
// nasıl iptal olduğu, W'nin kg/s mi yoksa farklı bir zaman tabanı mı olduğu)
// ikincil kaynakta YETERİNCE AÇIK DEĞİL — bu oturumda C'nin "VL m/s" ve
// "VL ft/s" sütunları karşılaştırılarak FM'nin gizli hız-üsteli birimi
// taşıdığı doğrulandı, ama bu, mutlak çıktı biriminin (m/s mi, m/yıl mı)
// KESİN olarak hangisi olduğunu çözmedi — deneme hesapları, birim varsayımına
// göre 3+ mertebe farklı sonuçlar verdi. KDP kural 4 gereği ("bulamadıysan
// UYDURMA"), bu belirsizlik ÇÖZÜLENE kadar bu tablo yalnızca NİTEL/bilgi
// amaçlı tutuluyor; choke/dallanma-Te için MUTLAK hız DNV-RP-O501'in kendi
// (birincil kaynaklı, tam doğrulanmış) redüksiyon/dirsek modelleri ANALOJİ
// yoluyla kullanılarak üretiliyor (bkz. erosion/dnvO501.ts
// computeChokeValveErosionRate/computeTeeBranchErosionRate başlık yorumları).
//
// Model (Eq. 28, erken Tulsa formu):
//   h = FM · FS · FP · Fr/D · W · VL^1.73 / (D/Do)²
// FM = C·B^0,59 (B=Brinell sertliği, malzemeye özgü C — Tablo 3)
// FS = parçacık şekli faktörü (Tablo 4)
// FP = geometriye özgü nüfuziyet faktörü (Tablo 5) — YALNIZCA çelik (CS)
//      için choke/tee/direkt-çarpma satırları mevcut
// Fr/D = dirsek yarıçapı düzeltmesi — YALNIZCA dirsek için (bu proje
//        dirsek için DNV'nin kendi modelini kullanır, bu yüzden Fr/D=1
//        sabitlenir, standardın kendi ifadesiyle: "for pipe geometries
//        other than the elbow, Fr/D was presumably considered to be 1")

import type { Coefficient, Source } from "../types";

const MODULE = "tulsaEcrc";

const SRC_MADANI_SANI_2019: Source = {
  type: "JOURNAL",
  citation:
    "F. Madani Sani, S. Huizinga, K.A. Esaklul, S. Nesic, \"Review of the API RP 14E erosional velocity " +
    "equation: Origin, applications, misuses, limitations and alternatives\", Wear, Cilt 426-427 (2019), " +
    "s. 620-636, Bölüm 7.5 (Tulsa modeli, Tablo 3/4/5, Eq. 28-29).",
  url: "https://doi.org/10.1016/j.wear.2019.01.119",
  accessedDate: "2026-08-11",
};

export interface TulsaMaterialHardnessRow {
  material: string;
  brinellHardness: number;
  /** C sabiti — VL m/s biriminde iken kullanılan sütun (Tablo 3'ün "for VL in m/s" sütunu) */
  cConstantSiUnits: number;
}

const TULSA_MATERIAL_HARDNESS_TABLE: Coefficient<TulsaMaterialHardnessRow[]> = {
  id: "tulsaEcrc.materialHardnessTable",
  module: MODULE,
  value: [
    { material: "AISI 1018 (CS)", brinellHardness: 210, cConstantSiUnits: 1.95e-5 },
    { material: "AISI 1020 (CS)", brinellHardness: 150, cConstantSiUnits: 1.94e-5 },
    { material: "13Cr (tavlanmış)", brinellHardness: 190, cConstantSiUnits: 2.8e-5 },
    { material: "13Cr (ısıl işlemli)", brinellHardness: 180, cConstantSiUnits: 2.33e-5 },
    { material: "2205 Duplex (DSS)", brinellHardness: 217, cConstantSiUnits: 1.88e-5 },
    { material: "316 SS", brinellHardness: 183, cConstantSiUnits: 1.98e-5 },
    { material: "API Q125", brinellHardness: 290, cConstantSiUnits: 1.95e-5 },
    { material: "Incoloy 825 (Ni alaşımı)", brinellHardness: 160, cConstantSiUnits: 1.75e-5 },
  ],
  unit: "-",
  description:
    "FM=C·B^0,59 formülünde kullanılan malzeme sertliği (Brinell, B) ve deneysel sabit (C, VL m/s " +
    "biriminde) — Tablo 3 (Madani Sani et al. 2019, Ref. [59,79] E/CRC orijinal çalışmalarına atıfla).",
  source: SRC_MADANI_SANI_2019,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "İKİNCİL kaynak — E/CRC'nin orijinal yayınlarına (Jordan 1998 el kitabı, McLaury/Shirazi 1996 ve " +
    "sonrası, çoğu SPE-proprietary) bu oturumda doğrudan erişilemedi. Bu tablo, bu ikincil kaynağın " +
    "BİREBİR alıntısıdır (yorumlanmadı/dönüştürülmedi). SDSS (süper duplex) ve tungsten karbür/seramik " +
    "kaplama TABLODA YOK — bu proje SDSS için 2205 Duplex satırına en yakın malzeme olarak İNTERPOLASYON " +
    "YAPMADAN, açıkça \"en yakın vekil (proxy), doğrulanmamış\" notuyla 2205 satırını kullanır (bkz. " +
    "erosion/dnvO501.ts computeChokeValveErosionRate/computeTeeBranchErosionRate).",
};

export interface TulsaParticleShapeRow {
  shape: "ANGULAR" | "SEMI_ROUNDED" | "FULLY_ROUNDED";
  factorFs: number;
}

const TULSA_PARTICLE_SHAPE_TABLE: Coefficient<TulsaParticleShapeRow[]> = {
  id: "tulsaEcrc.particleShapeTable",
  module: MODULE,
  value: [
    { shape: "ANGULAR", factorFs: 1.0 },
    { shape: "SEMI_ROUNDED", factorFs: 0.53 },
    { shape: "FULLY_ROUNDED", factorFs: 0.2 },
  ],
  unit: "-",
  description: "Parçacık şekli faktörü FS (Tablo 4) — köşeli/açılı kum en aşındırıcı (FS=1), yuvarlak en az.",
  source: SRC_MADANI_SANI_2019,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes: "İkincil kaynak — bkz. tulsaEcrc.materialHardnessTable notes. Varsayılan (bilinmiyorsa) ANGULAR (FS=1, en muhafazakâr) kullanılmalıdır.",
};

export type TulsaGeometryType = "ELBOW_90" | "TEE" | "CHOKE" | "DIRECT_IMPINGEMENT";

export interface TulsaPenetrationFactorRow {
  geometry: TulsaGeometryType;
  /** FP, çelik (CS) için — m/kg biriminde */
  factorFpCsMPerKg: number;
}

const TULSA_PENETRATION_FACTOR_TABLE: Coefficient<TulsaPenetrationFactorRow[]> = {
  id: "tulsaEcrc.penetrationFactorTable",
  module: MODULE,
  value: [
    { geometry: "ELBOW_90", factorFpCsMPerKg: 0.206 },
    { geometry: "TEE", factorFpCsMPerKg: 0.206 },
    { geometry: "CHOKE", factorFpCsMPerKg: 0.055 },
    { geometry: "DIRECT_IMPINGEMENT", factorFpCsMPerKg: 0.224 },
  ],
  unit: "m/kg",
  description:
    "Geometriye özgü nüfuziyet faktörü FP (Tablo 5), YALNIZCA çelik (CS) referans malzemesi için — " +
    "Do=1 inç referans boruya göre kalibre edilmiştir ((D/Do)² terimiyle gerçek çapa ölçeklenir).",
  source: SRC_MADANI_SANI_2019,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Bu tablo bu projede YALNIZCA CHOKE (choke vana trimi) ve TEE (dallanma/geçiş Te — DNV'nin kör Te " +
    "modeli kapsamadığı için) geometrileri için kullanılır. ELBOW_90 ve DIRECT_IMPINGEMENT satırları " +
    "bilgi/gelecek-genişletme amaçlı tutuldu, bu oturumda dirsek için DNV'nin kendi modeli (daha yüksek " +
    "güvenilirlikte, R/D'ye duyarlı) tercih edildiği için ELBOW_90 KULLANILMIYOR. Kaynak makale, CS " +
    "DIŞINDAKİ malzemeler için (ör. SS316) yalnızca ELBOW_90'da bir FP değeri veriyor, CHOKE/TEE için " +
    "vermiyor ('n/a') — bu proje, CS-dışı malzemeler için FP'yi SABİT tutup malzeme etkisini AYRICA " +
    "FM oranı (tulsaEcrc.materialHardnessTable) üzerinden uygular; bu, kaynak makalenin doğrudan " +
    "vermediği bir MÜHENDİSLİK UZANTISIDIR (FP ve FM'nin çakışan/tekrar eden malzeme etkisi taşıyıp " +
    "taşımadığı kaynakta netleştirilmemiştir) — bkz. erosion/dnvO501.ts ilgili fonksiyon başlığı, " +
    "confidence bu nedenle CS için MEDIUM, diğer malzemeler için LOW olarak ayrıca düşürülür.",
};

const TULSA_VELOCITY_EXPONENT: Coefficient<number> = {
  id: "tulsaEcrc.velocityExponent",
  module: MODULE,
  value: 1.73,
  unit: "-",
  description: "Eq. 28 (erken Tulsa modeli) parçacık çarpma hızı üsteli VL^1,73.",
  source: SRC_MADANI_SANI_2019,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Aynı makale, Zhang et al. (2007)'nin bu üsteli 2,41'e güncellediğini VE bazı durumlarda 1,73'ün " +
        "hâlâ kabul edilebilir sonuç verdiğini belirtiyor (Bölüm 7.5, \"in certain cases acceptable results " +
        "have been obtained by using 1.73\") — bu proje daha eski ama Tablo 5 FP değerleriyle TUTARLI " +
        "(aynı kaynak çiftinden gelen) 1,73 üstelini kullanır; 2,41 kullanmak için Zhang'ın kendi FP " +
        "yeniden-kalibrasyonu gerekirdi, bu proje kapsamında yapılmadı.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İkincil kaynak. Not: makale ayrıca farklı test koşullarında 2,39-2,93 arası deneysel üsteller de " +
    "rapor ediyor (Vieira/Mansouri) — 1,73 tek bir \"doğru\" değer değil, FP Tablo 5 ile birlikte " +
    "kalibre edilmiş bir PAKETTİR, bu yüzden 1,73 DIŞINDA bir üstel kullanmak Tablo 5'in FP değerleriyle " +
    "tutarsız olurdu.",
};

const TULSA_UNCERTAINTY_BAND_FACTOR: Coefficient<number> = {
  id: "tulsaEcrc.uncertaintyBandFactor",
  module: MODULE,
  value: 4,
  unit: "-",
  description:
    "Tulsa/E/CRC tabanlı (choke, dallanma Te) sonuçlar için çarpımsal belirsizlik bandı genişliği " +
    "(P90=P50×faktör, P10=P50/faktör).",
  source: {
    type: "STANDARD",
    citation:
      "Projenin kendi mühendislik kabulü — dnvO501'in kendi 2,5 katsayısından (shared.ts " +
      "uncertainty.defaultMultiplicativeBandFactor) DAHA GENİŞ tutuldu çünkü bu model (1) ikincil " +
      "kaynaklı, (2) VL için stagnation-length hesabı yerine basitleştirilmiş bir yaklaşım kullanıyor, " +
      "(3) FP/FM birleşimi kaynağın doğrudan vermediği bir uzantı içeriyor — bkz. " +
      "tulsaEcrc.penetrationFactorTable notes.",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Yayımlanmış bir Tulsa-modeli-özgü P10/P90 bandı bulunamadı — bu genişlik, DNV'nin kendi 2,5 " +
    "katsayısına göre PROJENİN kendi muhafazakâr genişletmesidir, kullanılmadan önce doğrulanmalıdır.",
};

export const TULSA_ECRC_COEFFICIENTS: Coefficient[] = [
  TULSA_MATERIAL_HARDNESS_TABLE as Coefficient,
  TULSA_PARTICLE_SHAPE_TABLE as Coefficient,
  TULSA_PENETRATION_FACTOR_TABLE as Coefficient,
  TULSA_VELOCITY_EXPONENT,
  TULSA_UNCERTAINTY_BAND_FACTOR,
];

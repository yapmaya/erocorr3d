// packages/engine/src/registry/coefficients/spatial.ts
//
// packages/engine/src/spatial/ modülünün KDP sabitleri: her hasar imzasının
// (pipeFittings.ts) yayılma genişlikleri (sigma) ve flowFieldLite.ts'in
// yerel hız çarpanları.
//
// KDP DÜRÜSTLÜK NOTU: bu dosyadaki değerlerin BÜYÜK ÇOĞUNLUĞU "confidence:
// UNVERIFIED"dır — çünkü bunlar bir hasar dağılımının TAM ŞEKLİNİ (Gauss
// yayılım genişliği, leke sayısı, bant genişliği) tanımlar ve literatürde
// boru/vana hasar haritaları için böyle sayısal "şekil sabitleri"
// YAYIMLANMAZ (data/valveCatalog.ts'in erosionZones grubu için zaten
// belgelenen aynı gerçek — bkz. o dosyanın EROSION_ZONE_CAVEAT'ı). Bu proje,
// bu sabitleri UYDURMAK yerine AÇIKÇA UNVERIFIED işaretleyerek, gerçek
// fiziksel MEKANİZMANIN VARLIĞINI/YÖNÜNÜ literatürle çapraz doğruladığı
// (bulabildiği yerlerde) ama TAM SAYISAL DEĞERİ kendi mühendislik yargısıyla
// seçtiği durumları ayrı ayrı belgeler.

import type { Coefficient, Source } from "../types";

const MODULE = "spatial";

const SRC_MASTER_CONTEXT_SPATIAL_TASK: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "EroCorr3D proje talimatı — packages/engine/src/spatial/ görev tanımı (\"pipeFittings.ts\" ve " +
    "\"flowFieldLite.ts\" bölümleri).",
  accessedDate: "2026-08-12",
};

const CIRCUMFERENTIAL_NARROW_BAND_SIGMA: Coefficient<number> = {
  id: "spatial.circumferential.narrowBandSigma",
  module: MODULE,
  value: 0.035,
  unit: "- (v-birimi, tam turun kesri)",
  description:
    "Çevresel olarak DAR bir bant/halka oluşturan hasar imzaları (dirsek extrados, kaynak dikişi, " +
    "orifis/redüksiyon mansabı, te dal ağzı) için varsayılan dairesel Gauss σ'sı — ~%±10 (3σ) genişlikte bir bant.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Literatürde boru bileşenleri için sayısal bir 'hasar bandı genişliği' yayımlanmış değildir " +
    "(data/valveCatalog.ts'teki EROSION_ZONE_CAVEAT ile aynı durum). Bu TEK sayı, 14 imzanın çoğunda " +
    "TUTARLI biçimde yeniden kullanılır (her imza için ayrı ayrı uydurulmuş 10+ farklı sayı yerine) — " +
    "bu, dürüstlük açısından TEK bir varsayımı gözden geçirmeyi/kalibre etmeyi kolaylaştırır.",
};

const CIRCUMFERENTIAL_WIDE_BAND_SIGMA: Coefficient<number> = {
  id: "spatial.circumferential.wideBandSigma",
  module: MODULE,
  value: 0.12,
  unit: "- (v-birimi, tam turun kesri)",
  description:
    "Çevresel olarak GENİŞ bir bölge (MIC leke zemini, ölü bacak) için varsayılan dairesel Gauss σ'sı.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes: "Bkz. spatial.circumferential.narrowBandSigma notu — aynı gerekçe, daha geniş bir varsayılan.",
};

const AXIAL_DEFAULT_RING_SIGMA: Coefficient<number> = {
  id: "spatial.axial.defaultRingSigma",
  module: MODULE,
  value: 0.05,
  unit: "- (u-birimi, bileşen uzunluğunun kesri)",
  description: "Eksenel halka şekilli (axialRingShape) imzalar için varsayılan eksenel Gauss σ'sı.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes: "Bkz. spatial.circumferential.narrowBandSigma notu — aynı gerekçe, eksenel eksen için.",
};

const ARC_HALF_WIDTH_SIGMA_DIVISOR: Coefficient<number> = {
  id: "spatial.gaussianEnvelope.arcHalfWidthSigmaDivisor",
  module: MODULE,
  value: 3,
  unit: "-",
  description:
    "Bir yayın (arc) yarı-genişliğini bir Gauss σ'sına çeviren '3-sigma kuralı' — σ=yarıGenişlik/3, yani " +
    "yayın kenarı ~3σ'da (Gauss kütlesinin ~%99,7'si yay içinde) yer alır.",
  source: {
    type: "TEXTBOOK",
    citation:
      "Standart normal dağılımın '3-sigma kuralı' — genel istatistik ders kitabı bilgisi (bkz. " +
      "uncertainty/registry notundaki Z90 sabitiyle AYNI 'matematiksel kesinlik, YORUM proje sözleşmesi' " +
      "durumu).",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "3-sigma kuralının kendisi kesin matematiktir (HIGH); yayın kenarını '3σ noktası' olarak TANIMLAMA " +
    "kararı bu projenin kendi seçimidir (ör. BLC_STRATIFIED'in ıslak-yay genişliğini bir Gauss'a çevirirken " +
    "kullanılır — bkz. pipeFittings.ts::buildBlcStratifiedShape).",
};

const TLC_CONDENSATION_AXIAL_PROFILE: Coefficient<{ peakAxialFraction: number; sigmaFraction: number }> = {
  id: "spatial.tlcCondensation.axialProfile",
  module: MODULE,
  value: { peakAxialFraction: 0.35, sigmaFraction: 0.2 },
  unit: "- (u-birimi)",
  description:
    "TLC'nin eksenel 'çan eğrisi' profili — tepe konumu (girişten sonra soğuma ile yoğuşmanın başladığı " +
    "yaklaşık nokta) ve yayılım genişliği.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Gerçek TLC eksenel profili, akışkanın yerel soğuma hızına (dış ortam ΔT, yalıtım, akış hızı) bağlı " +
    "TAM bir termal/hidrolik profil gerektirir (bu projenin corrosion/tlc.ts'i BİLEREK bunu kapsam dışı " +
    "bırakır — bkz. o dosyanın 'genel ısı transfer katsayısı ÇAĞIRAN TARAF tarafından sağlanmalıdır' notu). " +
    "Burada kullanılan tepe=0,35/σ=0,2 varsayılan değerleri, çağıran taraf gerçek bir termal profil " +
    "sağlayamadığında kullanılan, bu oturumun kendi makul-tahmin varsayılan değerleridir.",
};

const ELBOW_INERTIA_SHIFT_PARAMETERS: Coefficient<{ maxShiftFraction: number; referenceRelativeDiameter: number }> =
  {
    id: "spatial.elbowInertiaShift.parameters",
    module: MODULE,
    value: { maxShiftFraction: 0.3, referenceRelativeDiameter: 0.05 },
    unit: "-",
    description:
      "Dirsek erozyon tepe konumunun, göreli parçacık çapına (dp/D) bağlı olarak girişe doğru kayma " +
      "miktarı — maxShiftFraction: dp/D=referenceRelativeDiameter'da (veya üstünde) DNV taban açısının " +
      "(α=atan(1/(2R/D))) en fazla ne kadarının 'kaybedileceği'.",
    source: {
      type: "JOURNAL",
      citation:
        "Nature Scientific Reports, \"Impact of solid particle geometry, size, and intensity, coupled " +
        "with fluid velocity, on erosion dynamics in elbow conduits\" (2025) — 25 mikron parçacıklar için " +
        "tepe erozyonunun daha büyük parçacıklara göre DAHA YÜKSEK dirsek açısında (girişten daha uzakta) " +
        "gözlendiğini bildiriyor (yani büyük parçacık → tepe GİRİŞE yaklaşır); ayrıca genel Dean-vorteksi/" +
        "Stokes sayısı literatürü aynı yönü destekliyor.",
      url: "https://www.nature.com/articles/s41598-025-16720-z",
      accessedDate: "2026-08-12",
    },
    crossChecked: true,
    crossCheckSources: [
      {
        type: "JOURNAL",
        citation:
          "ResearchGate, \"Effects of Pipe Diameter and Stokes Number on Erosion in Elbows\" — Stokes " +
          "sayısının tepe konumu üzerinde 'kesin olmayan ama var olan' bir etkisi olduğunu, yüksek Stokes " +
          "sayısında (büyük/ağır parçacık) tepenin dış duvara/girişe kaydığını bildiriyor.",
        url: "https://www.researchgate.net/publication/346193206_Effects_of_Pipe_Diameter_and_Stokes_Number_on_Erosion_in_Elbows",
        accessedDate: "2026-08-12",
      },
    ],
    confidence: "LOW",
    notes:
      "YÖN (büyük parçacık → tepe girişe kayar) İKİ bağımsız kaynakla doğrulandı — ama HİÇBİR kaynak tam " +
      "bir FORMÜL/BÜYÜKLÜK vermiyor (yalnızca nitel/karşılaştırmalı CFD sonuçları). maxShiftFraction=0,3 ve " +
      "referenceRelativeDiameter=0,05 bu oturumun kendi, KASITLI OLARAK MÜTEVAZİ (taban DNV açısını asla " +
      "%30'dan fazla değiştirmeyen) mühendislik seçimidir — DNV'nin kendi α=atan(1/(2R/D)) formülünün YERİNİ " +
      "ALMAZ, yalnızca görev talimatının açıkça istediği 'sabit değil' davranışını fiziksel olarak " +
      "doğru YÖNDE sağlar. confidence=LOW (yön HIGH-seviye kanıtlı, büyüklük UNVERIFIED-seviye tahmini — " +
      "ikisinin bileşimi LOW).",
  };

const BEND_INTRADOS_SECONDARY_RELATIVE_SEVERITY: Coefficient<number> = {
  id: "spatial.bendIntradosSecondary.relativeSeverityFraction",
  module: MODULE,
  value: 0.15,
  unit: "- (extrados tepe değerine oran)",
  description: "Dean vorteksi kaynaklı iç yarıçap (intrados) ikincil erozyon bölgesinin, ana extrados tepesine göre göreli şiddeti.",
  source: {
    type: "JOURNAL",
    citation:
      "MDPI, \"Analysis of Erosive Wear in Pipe Elbows and Biomimetic Protection Strategies\" (2026) — " +
      "Dean vorteksleri nedeniyle dış duvardaki (nokta A, ana bölge) erozyona ek olarak iç duvarda " +
      "(nokta B, ikincil bölge) bir erozyon bölgesi oluştuğunu doğrudan belgeliyor.",
      url: "https://www.mdpi.com/2313-7673/11/5/336",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "MDPI/MDPI JMSE madencilik boru hattı çalışması — parçacıkların Dean-vorteksi kalıntı ikincil " +
        "akışlar ve yerçekimi ile intrados'a doğru göç ederek burada sürekli erozyon riski oluşturduğunu " +
        "bildiriyor.",
      url: "https://doi.org/10.3390/jmse13081599",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "LOW",
  notes:
    "İkincil bölgenin VARLIĞI iki bağımsız kaynakla doğrulandı (HIGH-seviye kanıt) ama HİÇBİR kaynak "+
    "extrados'a göre SAYISAL bir şiddet oranı vermiyor — literatür yalnızca 'zayıf/ikincil' (nitel) diyor. " +
    "%15 bu oturumun kendi, muhafazakâr-düşük tahminidir (ana bölgeyi asla gölgelemeyecek kadar küçük).",
};

const DEADLEG_AXIAL_DECAY_LENGTH_FRACTION: Coefficient<number> = {
  id: "spatial.deadleg.axialDecayLengthFraction",
  module: MODULE,
  value: 0.3,
  unit: "- (u-birimi)",
  description:
    "Ölü bacakta (dead leg) çökelme/MIC birikiminin, kapalı uca (u=1) doğru üstel artışının karakteristik " +
    "uzunluğu — küçük değer daha keskin/uca-yığılmış bir profil verir.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Ölü bacaklarda durgun bölgede çökelme/MIC riskinin arttığı NİTEL olarak iyi belgelenmiştir (API RP 571 " +
    "— bkz. data/mechanisms.ts::MIC/UDC, bu projenin ÖNCEKİ bir oturumunda zaten okundu) ama eksenel " +
    "birikim PROFİLİNİN (üstel/doğrusal/basamak) tam şekli hiçbir kaynakta sayısal olarak verilmiyor. " +
    "Üstel-artış-verilen-uca-doğru şekli, fiziksel olarak makul (akışa en uzak nokta en durgun) ama " +
    "UNVERIFIED bir bu-oturum seçimidir.",
};

const MIC_BOTTOM_PATCHY_PARAMETERS: Coefficient<{ patchCount: number; patchSigmaV: number; patchSigmaU: number }> =
  {
    id: "spatial.micBottomPatchy.parameters",
    module: MODULE,
    value: { patchCount: 6, patchSigmaV: 0.05, patchSigmaU: 0.08 },
    unit: "-",
    description:
      "MIC (mikrobiyolojik kaynaklı korozyon) alt-hat leke deseni için: tohumlu-rastgele leke sayısı ve " +
      "her lekenin eksenel/çevresel Gauss σ'sı.",
    source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "MIC'in DÜZENSİZ/lokalize (\"patchy\") doğası API RP 571'in kendi metninde nitel olarak belgelenmiştir " +
      "(bu proje daha önceki bir oturumda okudu — bkz. data/mechanisms.ts::MIC) ama 'kaç leke, ne büyüklükte' " +
      "sorusuna sayısal bir cevap yoktur; bu değerler yalnızca GÖRSEL OLARAK gerçekçi bir desen üretmek için " +
      "seçilmiş, kalibre edilmemiş varsayılan değerlerdir.",
  };

const CUI_EXTERNAL_BANDS_PARAMETERS: Coefficient<{ bandCount: number; bandSigmaFraction: number }> = {
  id: "spatial.cuiExternalBands.parameters",
  module: MODULE,
  value: { bandCount: 4, bandSigmaFraction: 0.04 },
  unit: "-",
  description: "İzolasyon altı korozyonun (CUI) dış yüzeyde destek/askı noktalarında oluşturduğu bantların sayısı ve genişliği.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "CUI'nin destek noktalarında yoğunlaştığı NİTEL olarak API RP 571'de belgelidir (bu proje önceki bir " +
    "oturumda okudu — bkz. data/mechanisms.ts::CUI) ama bant SAYISI/genişliği tesise özgüdür (destek " +
    "aralığına bağlı) — burada dört eşit-aralıklı bant varsayılan bir başlangıç noktasıdır, GERÇEK destek " +
    "konumları bilindiğinde çağıran taraf bunları geçersiz kılmalıdır (bkz. pipeFittings.ts parametresi).",
};

const FLOW_FIELD_BEND_WALL_MULTIPLIERS: Coefficient<{ outer: number; inner: number }> = {
  id: "spatial.flowFieldLite.bendWallMultipliers",
  module: MODULE,
  value: { outer: 1.45, inner: 0.7 },
  unit: "- (yerel hız / ortalama karışım hızı)",
  description: "Dirsek dış (extrados) ve iç (intrados) duvarında, potansiyel-akış-sonrası ikincil akışla oluşan tipik yerel hız çarpanı.",
  source: SRC_MASTER_CONTEXT_SPATIAL_TASK,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "Genel dirsek ikincil akış literatürü (potansiyel/serbest-vorteks akış BAŞLANGIÇTA iç duvarda " +
        "daha yüksek hız verir, ancak ikincil akış/Dean vorteksleri bunu TERSİNE çevirip tepe hızını dış " +
        "duvara kaydırır — bkz. arama sonucu sentezi, birden fazla CFD/deneysel çalışma bu yönü doğruluyor).",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "LOW",
  notes:
    "YÖN (dış duvar > ortalama > iç duvar, ikincil akış rejiminde) literatürle doğrulandı. Görev " +
    "talimatının verdiği 1,3-1,6× / 0,6-0,8× aralıklarının ORTA noktaları (1,45/0,70) kullanıldı — tam " +
    "sayısal değerler PROJECT_DOCUMENT kaynaklıdır, ikinci bağımsız sayısal kaynak bulunamadı (yalnızca yön).",
};

const VENA_CONTRACTA_CONTRACTION_COEFFICIENT: Coefficient<number> = {
  id: "spatial.flowFieldLite.venaContractaContractionCoefficient",
  module: MODULE,
  value: 0.61,
  unit: "-",
  description: "Keskin kenarlı bir daralmada (vana/orifis) vena contracta alan daralma katsayısı Cc — klasik teorik değer.",
  source: {
    type: "TEXTBOOK",
    citation:
      "HandWiki, \"Physics:Vena contracta\" — keskin kenarlı, eksenel simetrik bir orifis için teorik Cc " +
      "değerinin 0,611 (von Mises) olduğunu belirtiyor.",
    url: "https://handwiki.org/wiki/Physics:Vena_contracta",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Genel akışkanlar mekaniği ders kitabı sentezi — keskin kenarlı orifisler için Cc'nin 0,61-0,69 " +
        "arasında (ortalama ~0,64) değiştiğini belirtiyor.",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki kaynak birbirine yakın (0,611 teorik vs 0,61-0,69/~0,64 pratik aralık) — 0,61 (teorik/muhafazakâr " +
    "uç) seçildi. Bu, GENEL bir orifis sabitidir; vana geometrisine özgü GERÇEK Cc değeri üretici test " +
    "verisi gerektirir (aynı 'kcTypical' kaynak boşluğu — bkz. data/valveCatalog.ts).",
};

export const SPATIAL_COEFFICIENTS: Coefficient[] = [
  CIRCUMFERENTIAL_NARROW_BAND_SIGMA,
  CIRCUMFERENTIAL_WIDE_BAND_SIGMA,
  AXIAL_DEFAULT_RING_SIGMA,
  ARC_HALF_WIDTH_SIGMA_DIVISOR,
  TLC_CONDENSATION_AXIAL_PROFILE,
  ELBOW_INERTIA_SHIFT_PARAMETERS,
  BEND_INTRADOS_SECONDARY_RELATIVE_SEVERITY,
  DEADLEG_AXIAL_DECAY_LENGTH_FRACTION,
  MIC_BOTTOM_PATCHY_PARAMETERS,
  CUI_EXTERNAL_BANDS_PARAMETERS,
  FLOW_FIELD_BEND_WALL_MULTIPLIERS,
  VENA_CONTRACTA_CONTRACTION_COEFFICIENT,
];

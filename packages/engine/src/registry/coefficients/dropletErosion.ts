// packages/engine/src/registry/coefficients/dropletErosion.ts
//
// Sıvı damlacık erozyonu (yüksek hızlı ıslak/kondensat gaz sistemlerinde
// gaz akışı içinde sürüklenen sıvı damlacıklarının boru/bileşen yüzeyine
// çarpmasıyla oluşan aşınma).
//
// ⚠ ÖNEMLİ KAPSAM NOTU: bulunan HİÇBİR kaynak (DNV RP O501 dahil) bu
// mekanizma için SAYISAL bir aşınma HIZI (mm/yıl) denklemi VERMİYOR — hepsi
// yalnızca bir "bu hızın altında kal" TARAMA eşiği veriyor (DNV'nin kendi
// metni: "Droplet erosion is briefly addressed... appropriate velocity
// limits are given" — bir hız modeli DEĞİL). Bu yüzden
// erosion/dropletErosion.ts, api14e.ts ile AYNI FELSEFEYİ paylaşan bir
// TARAMA modülüdür; eşik üzerindeki durumlar için sunulan "gösterge" hız
// yalnızca KABA BİR ÖLÇEKLEME olup UNVERIFIED işaretlenir (bkz. ilgili
// sabitin notes alanı) — KDP kural 4.

import type { Coefficient, Source } from "../types";

const MODULE = "dropletErosion";

const SRC_DNV_O501: Source = {
  type: "STANDARD",
  citation:
    "Det Norske Veritas, \"Recommended Practice DNV-RP-O501: Erosive Wear in Piping Systems\", Rev. 4.2 " +
    "(2005), Bölüm 6 ve Bölüm 9.2/9.3 — \"velocities should in all cases be kept below 70-80 m/s to avoid " +
    "droplet erosion\" (gaz-kondensat sistemleri).",
  url: "https://rules.dnv.com/docs/pdf/dnvpm/codes/docs/2005-01/RP-O501.pdf",
  accessedDate: "2026-08-11",
};

const SRC_MADANI_SANI_2019: Source = {
  type: "JOURNAL",
  citation:
    "F. Madani Sani, S. Huizinga, K.A. Esaklul, S. Nesic, \"Review of the API RP 14E erosional velocity " +
    "equation: Origin, applications, misuses, limitations and alternatives\", Wear, Cilt 426-427 (2019), " +
    "s. 620-636, Bölüm 3 (\"the DNV GL recommended practice O501 suggests a threshold velocity of 230-262 " +
    "ft/s to avoid droplet impingement erosion\" [=70,1-79,9 m/s, DNV ile birebir örtüşüyor] ve Svedeman & " +
    "Arnold'ın \"no erosion occurs up to at least 100 ft/s (possibly even up to 300 ft/s)\" [=30,5-91,4 " +
    "m/s] bulgusu, Bölüm 7.2).",
  url: "https://doi.org/10.1016/j.wear.2019.01.119",
  accessedDate: "2026-08-11",
};

const DROPLET_EROSION_VELOCITY_LIMIT_RANGE_MS: Coefficient<[number, number]> = {
  id: "dropletErosion.velocityLimitRangeMs",
  module: MODULE,
  value: [70, 80],
  unit: "m/s",
  description:
    "Gaz-kondensat sistemlerinde damlacık erozyonundan kaçınmak için gaz hızının altında tutulması " +
    "gereken eşik aralığı (alt sınır=muhafazakâr).",
  source: SRC_DNV_O501,
  crossChecked: true,
  crossCheckSources: [SRC_MADANI_SANI_2019],
  confidence: "HIGH",
  notes:
    "İKİ BAĞIMSIZ kaynak neredeyse birebir örtüşüyor: DNV RP O501'in kendi metni (70-80 m/s) ve Madani " +
    "Sani et al. (2019)'in bağımsız olarak aktardığı DNV eşiği (230-262 ft/s = 70,1-79,9 m/s). ÜÇÜNCÜ, " +
    "daha DAR bir referans noktası da bulundu: Svedeman & Arnold (aynı makale içinde özetlenmiş, orijinal " +
    "makaleye bu oturumda erişilemedi) \"temiz servis\" (yalnızca damlacık çarpması, katı/korozyon yok) " +
    "için 100-300 ft/s (30,5-91,4 m/s) aralığında erozyon GÖZLENMEDİĞİNİ raporluyor — DNV'nin 70-80 m/s'i " +
    "bu daha geniş \"güvenli\" aralığın İÇİNDE ve MUHAFAZAKÂR ucunda kalıyor, bu yüzden DNV değeri " +
    "kullanılmaya devam edildi (KDP kural 2: iki kaynakörtüşüyor, üçüncü kaynak farklı ama daha az " +
    "muhafazakâr olduğu için orijinal seçim korundu). DÖRDÜNCÜ bir nokta değer de bulundu ama " +
    "KULLANILMADI: Deffenbaugh et al.'ın \"yaklaşık 400 ft/s (122 m/s)\" tahmini — bu, DNV/Svedeman-Arnold " +
    "aralığının belirgin biçimde ÜZERİNDE olduğu için (muhafazakâr olmadığı için) bu projede bir eşik " +
    "olarak kullanılmadı, yalnızca bilgi amaçlı burada belgelendi.",
};

const DROPLET_EROSION_ABOVE_THRESHOLD_VELOCITY_EXPONENT_RANGE: Coefficient<[number, number]> = {
  id: "dropletErosion.aboveThresholdVelocityExponentRange",
  module: MODULE,
  value: [4, 5],
  unit: "-",
  description:
    "Eşik hızının ÜZERİNDE, aşınma hızının yaklaşık olarak (V/Veşik)^n ile ölçeklendiği, sünek malzemeler " +
    "için gözlenen üstel (n) aralığı — steam türbini kanadı sıvı damlacık erozyonu literatüründen (Heymann " +
    "ailesi modeller).",
  source: {
    type: "CONFERENCE",
    citation:
      "T. Selvam vd. (derleyen bölüm), \"An Overview of Droplet Impact Erosion, Related Theory and " +
      "Protection Measures in Steam Turbines\", IntechOpen, 2018 — \"Erosion~V^n where n is found to be in " +
      "the range of 4-5 [sünek malzemeler]. For brittle materials, exponents as high as 6-9 have been " +
      "reported.\"",
    url: "https://www.intechopen.com/chapters/64028",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "LOW",
  notes:
    "Bu üstel, BORU HATTI sıvı damlacık erozyonu için DEĞİL, buhar TÜRBİNİ kanadı erozyonu (farklı " +
    "geometri, farklı damlacık boyutu/hızı rejimi) literatüründen alındı — aynı FİZİKSEL mekanizma " +
    "(sünek metalde tekrarlı sıvı darbesiyle yorulma/çukurlaşma) olduğu için ANALOJİ YOLUYLA kullanıldı, " +
    "boru hattı geometrisi için doğrudan doğrulanmış DEĞİL. confidence=LOW. Bu proje MUHAFAZAKÂR ucu " +
    "(n=5, aralığın alt-sünek ucu) kullanır — daha yüksek n, eşik üstü hız artışına karşı daha hızlı " +
    "(daha \"iyimser\" görünen ama aslında daha az muhafazakâr düşük-aşım bölgesinde) bir tırmanma verir; " +
    "n=5 seçimi, düşük aşım oranlarında erozyonu ABARTMAMAK için seçildi (bkz. erosion/dropletErosion.ts).",
};

const DROPLET_EROSION_INDICATIVE_RATE_AT_THRESHOLD_MM_PER_YEAR: Coefficient<number> = {
  id: "dropletErosion.indicativeRateAtThresholdMmPerYear",
  module: MODULE,
  value: 0.1,
  unit: "mm/yıl",
  description:
    "Eşik hızında (V=Veşik) varsayılan GÖSTERGE aşınma hızı — mutlak büyüklüğü SOURCE'DAN GELMEZ, yalnızca " +
    "UI'da sıfır-olmayan bir başlangıç noktası vermek için projenin kendi \"asgari anlamlı aşınma hızı\" " +
    "kabulünü (bkz. shared.ts corrosion.inhibitedResidualRateFloorMmPerYear, aynı 0,1 mm/yıl değeri) yeniden " +
    "kullanır.",
  source: {
    type: "STANDARD",
    citation: "Bu projenin kendi mühendislik kabulü — bkz. registry/coefficients/shared.ts, aynı 0,1 mm/yıl değeri.",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "BU DEĞER MUTLAK BİR AŞINMA HIZI ÖLÇÜMÜ DEĞİLDİR — hiçbir kaynak, damlacık erozyonu için eşik " +
    "hızındaki mutlak mm/yıl büyüklüğünü vermiyor (yalnızca 'bu hızın altında erozyon önemsizdir' " +
    "denilmiş, 'eşikte tam olarak X mm/yıl olur' denmemiş). Bu proje, UI'ın eşik-üstü durumlarda tamamen " +
    "boş/0 bir sayı göstermek yerine bir BAŞLANGIÇ MERTEBESİ göstermesi için projenin KENDİ 0,1 mm/yıl " +
    "asgari-anlamlı-aşınma kabulünü ödünç aldı — bu KESİNLİKLE doğrulanmalı, sonuçta HER ZAMAN " +
    "confidence=UNVERIFIED + belirgin bir validityWarning taşır.",
};

const DROPLET_EROSION_UNCERTAINTY_BAND_FACTOR: Coefficient<number> = {
  id: "dropletErosion.uncertaintyBandFactor",
  module: MODULE,
  value: 5,
  unit: "-",
  description:
    "Eşik-üstü gösterge hız için çarpımsal belirsizlik bandı genişliği (P90=P50×faktör, P10=P50/faktör).",
  source: {
    type: "STANDARD",
    citation:
      "Projenin kendi mühendislik kabulü — bu modülün hem eşik ÜSTÜ ölçekleme üsteli (n=4-5, analoji " +
      "yoluyla) hem de mutlak referans hızı (0,1mm/yıl, ödünç alınmış) UNVERIFIED olduğu için DNV'nin " +
      "kendi 2,5 katsayısından daha geniş tutuldu.",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes: "Yayımlanmış bir damlacık-erozyonu-özgü P10/P90 bandı bulunamadı.",
};

export const DROPLET_EROSION_COEFFICIENTS: Coefficient[] = [
  DROPLET_EROSION_VELOCITY_LIMIT_RANGE_MS as Coefficient,
  DROPLET_EROSION_ABOVE_THRESHOLD_VELOCITY_EXPONENT_RANGE as Coefficient,
  DROPLET_EROSION_INDICATIVE_RATE_AT_THRESHOLD_MM_PER_YEAR,
  DROPLET_EROSION_UNCERTAINTY_BAND_FACTOR,
];

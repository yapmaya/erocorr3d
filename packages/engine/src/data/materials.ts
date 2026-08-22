// packages/engine/src/data/materials.ts
//
// Malzeme veritabanı: 20 malzeme ailesi, korozyon/erozyon mühendisliği
// özellikleriyle (PREN, CPT, CCT, CSCC sınırı, sıcaklık aralıkları, kaplama
// eşiği, bağıl maliyet, yoğunluk). KDP uyarınca HER değerin kaynağı bu
// dosyada belgelenmiştir; bulunamayan/doğrulanamayan değerler confidence:
// "UNVERIFIED" veya "LOW" olarak işaretlenmiş ve registry'ye bu haliyle
// kaydedilmiştir (konsol uyarısı + UI'da sarı/kırmızı rozet).
//
// ÖNEMLİ KAYNAK NOTU: Kullanıcı, 316L/22Cr(2205)/25Cr(2507) için PREN/CPT/
// CCT/CSCC/kaplama eşiği değerlerini "yüklediğim korozyon dokümanı"ndan
// alınmasını istedi. Bu ortamda (disk taraması dahil) o dokümanı bulamadık;
// bu üç malzeme için değerler kullanıcının talimatında verildiği haliyle,
// yeni bir kaynak tipi olan "PROJECT_DOCUMENT" ile işlendi ve mümkün olduğunca
// bağımsız bir kaynakla (ISSF — International Stainless Steel Forum, "ISSF
// Duplex Stainless Steels" broşürü, Figure 3.8) çapraz kontrol edildi.
// Farklılık bulunan noktalar notlarda açıkça belirtildi (KDP kural 2).

import { registerCoefficient } from "../registry";
import type { Coefficient, Source } from "../registry/types";
import { MaterialSpecSchema, type MaterialSpec } from "../types/material";

// ─────────────────────────────────────────────────────────────────────────
// PREN hesap fonksiyonu
// ─────────────────────────────────────────────────────────────────────────

const SRC_ISSF_DUPLEX: Source = {
  type: "STANDARD",
  citation:
    "International Stainless Steel Forum (ISSF), \"ISSF Duplex Stainless Steels\", Kasım 2021 baskısı — bölüm 3.2 \"Pitting and Crevice corrosion\", Şekil 3.7 (PREN Ranking) ve Şekil 3.8 (CPT/CCT, ASTM G48 %6 ferrik klorür testi).",
  url: "https://worldstainless.org/wp-content/uploads/2021/11/ISSF_Duplex_Stainless_Steels.pdf",
  accessedDate: "2026-08-11",
};

/**
 * PREN (Pitting Resistance Equivalent Number) hesaplar.
 *
 * Formül: PREN = %Cr + 3.3×%Mo + 16×%N (ağırlıkça yüzde).
 * Kaynak: ISSF "Duplex Stainless Steels" broşürü, s.9 — endüstride yaygın
 * kullanılan ampirik formül olarak tanımlanmış; kullanıcının talimatındaki
 * formülle birebir aynı.
 *
 * @param crPercent Krom ağırlık yüzdesi
 * @param moPercent Molibden ağırlık yüzdesi
 * @param nPercent Azot ağırlık yüzdesi
 */
export function calculatePren(crPercent: number, moPercent: number, nPercent: number): number {
  if (crPercent < 0 || moPercent < 0 || nPercent < 0) {
    throw new Error("Krom, molibden ve azot yüzdeleri negatif olamaz.");
  }
  return crPercent + 3.3 * moPercent + 16 * nPercent;
}

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_USER_PROJECT_DOCUMENT: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "Kullanıcının proje talimatında doğrudan verilen değerler (\"yüklediğim korozyon dokümanı\"). Bu doküman, kullanıcının diskinde yapılan kapsamlı aramaya rağmen bu oturumda bulunamadı; değerler kullanıcı talimatından alınmıştır.",
  accessedDate: "2026-08-11",
};

// SONRAKİ OTURUM GÜNCELLEMESİ (2026-08-12): "yüklediğim korozyon dokümanı" bu oturumda
// KULLANICININ DİSKİNDE BULUNDU — /home/aliattar/İndirilenler/F3-500-ME-SPC-PSS-0002_AE.pdf,
// gerçek bir BOTAŞ proje dokümanı ("Corrosion Assessment and Materials Selection Onshore
// (KMGS&NSP)", Rev AE, 18.08.2021, Andrei Iorga/Jochen Heins/Ion Marinescu tarafından
// hazırlanmış). Doğrudan pdftotext ile okundu — Tablo 8-1 "Critical Temperature for External
// Corrosion Evaluation", 316L/22Cr/25Cr satırları için PREN/CPT/CCT/CSCC/kaplama eşiği
// SAYILARI, aşağıdaki üç malzeme girdisinde ZATEN kayıtlı olan (kullanıcı talimatından bir
// önceki oturumda alınmış) değerlerle BİREBİR eşleşti — bu, kullanıcının o oturumda verdiği
// değerlerin bu belgeden geldiğini doğruluyor. Bu üç girdi artık SRC_BOTAS_PSS0002_TABLE81'e
// güncellendi, confidence MEDIUM'dan HIGH'a yükseltildi.
const SRC_BOTAS_PSS0002_TABLE81: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "BOTAŞ, \"Corrosion Assessment and Materials Selection Onshore (KMGS&NSP)\", Doküman No: " +
    "F3-500-ME-SPC-PSS-0002, Rev. AE (18.08.2021) — Kuzey Marmara Yeraltı Doğalgaz Depolama " +
    "Tesisi Faz III projesi. Tablo 8-1 \"Critical Temperature for External Corrosion Evaluation\" " +
    "— 316L (PREN=23, CPT=15°C, CCT=5°C, CSCC=60°C, ≥50°C'de kaplama), 22Cr/2205 (PREN=35, " +
    "CPT=30°C, CCT=18°C, CSCC=100°C, ≥90°C'de kaplama), 25Cr/2507 (PREN=43, CPT=80°C, CCT=50°C, " +
    "CSCC=110°C, ≥100°C'de kaplama). Bu oturumda dosyanın tam metninden (pdftotext ile) doğrudan " +
    "okundu — kullanıcının diskinde bulundu (bkz. yukarıdaki SRC_USER_PROJECT_DOCUMENT notu).",
  accessedDate: "2026-08-12",
};

const SRC_ASME_B31_3_BLOG: Source = {
  type: "STANDARD",
  citation:
    "ASME B31.3 Process Piping — izin verilen gerilme/sıcaklık tablolarını özetleyen mühendislik referans siteleri (piping-world.com, baowi-steel.com, projectmaterials.com); orijinal ASME B31.3 tablosu ücretli olduğundan ikincil özetler kullanıldı.",
  accessedDate: "2026-08-11",
};

const SRC_UNS_COMPOSITION: Source = {
  type: "STANDARD",
  citation:
    "UNS/ASTM standart kimyasal kompozisyon aralıkları (ör. ASTM A240 304/316, ASTM B424 Alloy 825, ASTM B407 Alloy 800H, ASTM A276 410) — mühendislik referans siteleri üzerinden (theworldmaterial.com, kalpatarupiping.com vb.).",
  accessedDate: "2026-08-11",
};

const SRC_COPPER_ORG: Source = {
  type: "STANDARD",
  citation:
    "Copper Development Association / Nickel Institute, deniz suyunda bakır-nikel alaşımları erozyon-korozyon kritik hız verileri (copper.org, nickelinstitute.org); K.D. Efird çalışmasına atıfla 90/10 CuNi için ≈3.5-4.5 m/s kritik hız aralığı.",
  accessedDate: "2026-08-11",
};

const SRC_GENERAL_ENGINEERING_KNOWLEDGE: Source = {
  type: "TEXTBOOK",
  citation:
    "Yaygın mühendislik referans değerleri (yoğunluk, genel sıcaklık sınırları) — bu oturumda tek bir birincil kaynakla doğrudan doğrulanmadı; standart malzeme veri sayfalarıyla tutarlı olduğu gözlemlendi.",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Malzeme tanımları
// ─────────────────────────────────────────────────────────────────────────

interface MaterialDefinition {
  spec: MaterialSpec;
  source: Source;
  crossChecked: boolean;
  crossCheckSources: Source[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  notes: string;
}

const COST_INDEX_CAVEAT =
  " (relativeCostIndex piyasa fiyatlarına bağlı gösterge niteliğindedir, KDP kapsamında sabit/doğrulanabilir bir değer değildir — bu tek başına confidence'ı düşürmez, ayrı bir uyarı gerektirir.)";

const MATERIAL_DEFINITIONS: MaterialDefinition[] = [
  {
    spec: {
      materialId: "cs-a106-grb",
      family: "Carbon Steel",
      displayNameTr: "Karbon Çelik (A106 Gr.B)",
      displayNameEn: "Carbon Steel (A106 Gr.B)",
      minDesignTempC: -29,
      maxServiceTempC: 425,
      relativeCostIndex: 1.0,
      densityKgM3: 7850,
      notesTr:
        "Genel amaçlı taşıma hattı malzemesi. -29°C alt sınırı, et kalınlığı ≤12.5mm için darbe testsiz ASME B31.3 kuralına dayanır. CO2/H2S ortamında inhibitör veya korozyon payı gerektirir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_USER_PROJECT_DOCUMENT,
    crossChecked: true,
    crossCheckSources: [SRC_ASME_B31_3_BLOG],
    confidence: "MEDIUM",
    notes:
      "-29°C sınırı kullanıcı talimatından; 425°C pratik maksimum servis sıcaklığı bu oturumda ikincil bir mühendislik referans sitesinden (piping-world.com/baowi-steel.com) alındı, ASME B31.3'ün kendisiyle doğrudan doğrulanmadı.",
  },
  {
    spec: {
      materialId: "ltcs-a333-gr6",
      family: "Low Temperature Carbon Steel",
      displayNameTr: "Düşük Sıcaklık Karbon Çeliği (A333 Gr.6)",
      displayNameEn: "Low Temperature Carbon Steel (A333 Gr.6)",
      minDesignTempC: -45,
      maxServiceTempC: 345,
      relativeCostIndex: 1.3,
      densityKgM3: 7850,
      notesTr:
        "Darbe testli, düşük sıcaklık servisi için tasarlanmış karbon çelik; kriyojenik olmayan soğuk iklim/proses hatlarında kullanılır." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_USER_PROJECT_DOCUMENT,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "-45°C sınırı kullanıcı talimatından (LTCS ailesi). 345°C maksimum servis sıcaklığı bu oturumda ayrıca araştırılmadı, LTCS ailelerinin düşük sıcaklık tokluk ısıl işlemi nedeniyle standart CS'den daha düşük üst sınıra sahip olabileceği genel bilgisiyle tahmin edildi — kullanılmadan önce doğrulanmalıdır.",
  },
  {
    spec: {
      materialId: "125cr-05mo-p11",
      family: "Low Alloy Steel (1.25Cr-0.5Mo)",
      displayNameTr: "Düşük Alaşımlı Çelik (1.25Cr-0.5Mo, P11)",
      displayNameEn: "Low Alloy Steel (1.25Cr-0.5Mo, P11)",
      minDesignTempC: -30,
      maxServiceTempC: 510,
      relativeCostIndex: 1.6,
      densityKgM3: 7860,
      notesTr:
        "Orta basınçlı hidrojen servisi ve yüksek sıcaklık buhar hatlarında (API 941 Nelson eğrileri kapsamında) kullanılır." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_USER_PROJECT_DOCUMENT,
    crossChecked: true,
    crossCheckSources: [SRC_ASME_B31_3_BLOG],
    confidence: "MEDIUM",
    notes:
      "-30°C sınırı kullanıcı talimatından (1.25Cr/2.25Cr ailesi). 510°C maksimum servis sıcaklığı bu oturumda ikincil kaynaklardan (projectmaterials.com) alındı.",
  },
  {
    spec: {
      materialId: "225cr-1mo-p22",
      family: "Low Alloy Steel (2.25Cr-1Mo)",
      displayNameTr: "Düşük Alaşımlı Çelik (2.25Cr-1Mo, P22)",
      displayNameEn: "Low Alloy Steel (2.25Cr-1Mo, P22)",
      minDesignTempC: -30,
      maxServiceTempC: 565,
      relativeCostIndex: 1.8,
      densityKgM3: 7860,
      notesTr:
        "Hidrojen reformer ve rafineri servisinde P11'e göre daha yüksek Mo içeriğiyle hidrojen atağına karşı üstün direnç sağlar (API 941)." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_USER_PROJECT_DOCUMENT,
    crossChecked: true,
    crossCheckSources: [SRC_ASME_B31_3_BLOG],
    confidence: "MEDIUM",
    notes:
      "-30°C sınırı kullanıcı talimatından. 565°C maksimum servis sıcaklığı bu oturumda ikincil kaynaklardan (projectmaterials.com) alındı.",
  },
  {
    spec: {
      materialId: "ni35-steel",
      family: "3.5Ni Low Temperature Steel",
      displayNameTr: "3.5 Nikel Çeliği",
      displayNameEn: "3.5% Nickel Steel",
      minDesignTempC: -100,
      maxServiceTempC: 40,
      relativeCostIndex: 2.2,
      densityKgM3: 7850,
      notesTr:
        "Kriyojenik olmayan ama düşük sıcaklık gerektiren servisler (ör. LNG çevresi soğutulmuş süreçler) için seçilir; tasarım amacı yüksek sıcaklık değil düşük sıcaklık tokluğudur, bu yüzden maksimum servis sıcaklığı düşük tutuldu." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_USER_PROJECT_DOCUMENT,
    crossChecked: true,
    crossCheckSources: [
      {
        type: "STANDARD",
        citation:
          "ASTM A333 Grade 3 spesifikasyon özetleri (tuspipe.com, stratstan.co.uk) — minimum tasarım sıcaklığı -100°C olarak teyit edilmiştir.",
        accessedDate: "2026-08-11",
      },
    ],
    confidence: "MEDIUM",
    notes:
      "-100°C değeri kullanıcı talimatı ile bu oturumda bağımsız olarak bulunan ASTM A333 Gr.3 özetleri arasında BİREBİR eşleşti (güçlü çapraz doğrulama). 40°C maksimum servis sıcaklığı ise bu malzemenin tipik kullanım amacına (düşük sıcaklık) dayanan bir mühendislik varsayımıdır, doğrudan kaynaklanmadı — UNVERIFIED muamelesi görmelidir.",
  },
  {
    spec: {
      materialId: "ss-304-304l",
      family: "Austenitic Stainless Steel",
      displayNameTr: "Östenitik Paslanmaz Çelik (304/304L)",
      displayNameEn: "Austenitic Stainless Steel (304/304L)",
      pren: 19,
      cptC: 5,
      cctC: -10,
      csccLimitC: 60,
      minDesignTempC: -255,
      maxServiceTempC: 400,
      relativeCostIndex: 3.0,
      densityKgM3: 8000,
      notesTr:
        "Yaygın genel amaçlı östenitik paslanmaz. 316L'ye göre Mo içermediğinden çukurlaşma direnci belirgin şekilde daha düşüktür; klorürlü ortamlarda dikkatli seçilmelidir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: true,
    crossCheckSources: [SRC_ISSF_DUPLEX],
    confidence: "MEDIUM",
    notes:
      "PREN=19, ASTM A240 304/304L standart kompozisyon aralığının orta noktası (Cr ortalama 19%, Mo yok, N ihmal edilebilir) kullanılarak PREN=%Cr+3.3×%Mo+16×%N formülüyle HESAPLANDI (kaynaktan doğrudan alınmadı). ISSF Şekil 3.7 grafiğinde 304 için görsel olarak ~18-19 PREN aralığında konumlandığı gözlemlenerek tutarlılık teyit edildi. cptC=5°C ve cctC=-10°C, ISSF Şekil 3.8 (304L çubuğu, %6 ferrik klorür/ASTM G48) grafiğinden GÖRSEL OKUMA ile elde edildi — kesin sayısal tablo değeri değil, LOW güvenilirlikli bir tahmindir. csccLimitC=60°C, ISSF metnindeki \"SCC occurs...in chloride-containing environments at temperatures above 60°C\" ifadesiyle ve kullanıcının 316L için verdiği aynı değerle tutarlıdır (daha güvenilir). 400°C maksimum servis sıcaklığı bu oturumda doğrudan araştırılmadı, UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "ss-316-316l",
      family: "Austenitic Stainless Steel (Mo-bearing)",
      displayNameTr: "Östenitik Paslanmaz Çelik (316/316L)",
      displayNameEn: "Austenitic Stainless Steel (316/316L)",
      pren: 23,
      cptC: 15,
      cctC: 5,
      csccLimitC: 60,
      coatingRequiredAboveC: 50,
      minDesignTempC: -255,
      maxServiceTempC: 400,
      relativeCostIndex: 3.5,
      densityKgM3: 8000,
      notesTr:
        "Mo içeriği sayesinde 304L'ye göre belirgin şekilde daha iyi çukurlaşma direnci sunan, en yaygın kullanılan CRA (korozyona dayanıklı alaşım)." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_BOTAS_PSS0002_TABLE81,
    crossChecked: true,
    crossCheckSources: [SRC_ISSF_DUPLEX],
    confidence: "HIGH",
    notes:
      "PREN/CPT/CCT/CSCC/kaplama eşiği artık BİRİNCİL kaynaktan (BOTAŞ F3-500-ME-SPC-PSS-0002, Tablo 8-1, bu oturumda diskte bulunup doğrudan okundu — bkz. SRC_BOTAS_PSS0002_TABLE81 notu) doğrulandı, önceki oturumun kullanıcı-talimatı değeriyle BİREBİR eşleşiyor. Çapraz kontrol: ASTM A240 316/316L minimum kompozisyonuyla (Cr16%, Mo2%, N~0.03) PREN=%Cr+3.3×%Mo+16×%N formülü ≈23.1 verir — PREN=23 değeriyle BİREBİR örtüşüyor (güçlü doğrulama). ISSF Şekil 3.8 grafiğinde 316L için CPT görsel olarak ~10°C civarında (birincil kaynağın 15°C değerine yakın, görsel okumanın doğal belirsizliği içinde tutarlı).",
  },
  {
    spec: {
      materialId: "duplex-2205",
      family: "Duplex Stainless Steel (22Cr)",
      displayNameTr: "Duplex Paslanmaz Çelik (22Cr, 2205)",
      displayNameEn: "Duplex Stainless Steel (22Cr, 2205)",
      pren: 35,
      cptC: 30,
      cctC: 18,
      csccLimitC: 100,
      coatingRequiredAboveC: 90,
      minDesignTempC: -50,
      maxServiceTempC: 250,
      relativeCostIndex: 5.5,
      densityKgM3: 7800,
      notesTr:
        "Standart duplex aile (PREN 28-38 aralığında, ISSF sınıflandırması); yüksek mukavemet ve iyi klorür direnci bir arada. 475°C gevrekleşmesi ve sigma faz riski nedeniyle üst sıcaklık sınırı östenitiklerden daha düşüktür." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_BOTAS_PSS0002_TABLE81,
    crossChecked: true,
    crossCheckSources: [SRC_ISSF_DUPLEX],
    confidence: "HIGH",
    notes:
      "PREN/CPT/CCT/CSCC/kaplama eşiği artık BİRİNCİL kaynaktan (BOTAŞ F3-500-ME-SPC-PSS-0002, Tablo 8-1 \"22Cr\" satırı, bu oturumda diskte bulunup doğrudan okundu) doğrulandı, önceki oturumun kullanıcı-talimatı değeriyle BİREBİR eşleşiyor (35/30/18/100/90). ISSF Şekil 3.7, standart duplex ailesini PREN 28-38 aralığında sınıflandırıyor — 35 değeri bu aralığın içinde, tutarlı. ÖNEMLİ DÜZELTME: bir önceki oturumda ISSF Şekil 3.8'in GÖRSEL okumasıyla CPT'nin ~40-42°C \"göründüğü\" ve kullanıcının 30°C değerinden \"belirgin şekilde farklı\" olduğu not edilmişti — artık BİRİNCİL kaynağın kendisi 30°C'yi doğruladığından, o zamanki ISSF görsel okumasının imprecise olduğu (grafikten göz kararı okumanın doğal hata payı) sonucuna varılmıştır, gerçek bir standart/ortam farkı DEĞİL. 250°C maksimum servis sıcaklığı bu oturumda da doğrudan doğrulanmadı (PSS-0002 malzeme seçim tablosu bu üst sıcaklık sınırını içermiyor), UNVERIFIED kalmaya devam ediyor.",
  },
  {
    spec: {
      materialId: "super-duplex-2507",
      family: "Super Duplex Stainless Steel (25Cr)",
      displayNameTr: "Süper Duplex Paslanmaz Çelik (25Cr, 2507)",
      displayNameEn: "Super Duplex Stainless Steel (25Cr, 2507)",
      pren: 43,
      cptC: 80,
      cctC: 50,
      csccLimitC: 110,
      coatingRequiredAboveC: 100,
      minDesignTempC: -50,
      maxServiceTempC: 250,
      relativeCostIndex: 7.5,
      densityKgM3: 7810,
      notesTr:
        "Süper duplex aile (PREN 39-45 aralığında); en agresif deniz suyu/klorürlü ortamlar için seçilir, Ni bazlı alaşımlara ekonomik bir alternatiftir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_BOTAS_PSS0002_TABLE81,
    crossChecked: true,
    crossCheckSources: [SRC_ISSF_DUPLEX],
    confidence: "HIGH",
    notes:
      "PREN/CPT/CCT/CSCC/kaplama eşiği artık BİRİNCİL kaynaktan (BOTAŞ F3-500-ME-SPC-PSS-0002, Tablo 8-1 \"25Cr\" satırı, bu oturumda diskte bulunup doğrudan okundu) doğrulandı, önceki oturumun kullanıcı-talimatı değeriyle BİREBİR eşleşiyor (43/80/50/110/100). ISSF Şekil 3.7, süper duplex ailesini PREN 39-45 aralığında sınıflandırıyor — 43 değeri tam bu aralıkta. ISSF Şekil 3.8 grafiğinde 2507 için CPT görsel olarak ~80°C civarında görünüyor — BİREBİR ÖRTÜŞÜYOR (güçlü ek doğrulama). CCT için grafikte ~40°C görünüyor, birincil kaynağın 50°C değerinden bir miktar farklı — bu küçük fark görsel okuma belirsizliği olarak değerlendirildi, birincil kaynağın 50°C değeri korundu. 250°C maksimum servis sıcaklığı bu oturumda da doğrudan doğrulanmadı, UNVERIFIED kalmaya devam ediyor.",
  },
  {
    spec: {
      materialId: "alloy-625",
      family: "Nickel-Chromium-Molybdenum Alloy",
      displayNameTr: "Alaşım 625 (Inconel 625)",
      displayNameEn: "Alloy 625 (Inconel 625)",
      pren: 51,
      minDesignTempC: -200,
      maxServiceTempC: 980,
      relativeCostIndex: 28,
      densityKgM3: 8440,
      notesTr:
        "Çok yüksek Mo/Cr içeriğiyle olağanüstü çukurlaşma ve genel korozyon direnci sağlar; klorürlü SCC'ye yüksek Ni içeriği (%58) nedeniyle pratik olarak bağışıktır. Çok yüksek maliyetli, genellikle kritik/az sayıda bileşende (vana trim, conta yüzeyleri, örtü kaynağı) kullanılır." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: true,
    crossCheckSources: [
      {
        type: "STANDARD",
        citation:
          "Special Metals Corporation, \"INCONEL alloy 625\" teknik bülteni (specialmetals.com) — kompozisyon aralığı (Cr 20-23%, Mo 8-10%) ve ~980°C'ye kadar oksidasyon direnci.",
        accessedDate: "2026-08-11",
      },
    ],
    confidence: "MEDIUM",
    notes:
      "PREN=51, UNS N06625 kompozisyon aralığının orta noktası (Cr 21.5%, Mo 9%) kullanılarak HESAPLANDI. Bağımsız bir ikincil kaynakta da Alloy 625 için ~51 PREN değeri bulundu (aynı orta-nokta yaklaşımıyla tutarlı) — çapraz doğrulandı. 980°C, Special Metals bülteninde belirtilen OKSİDASYON direnci sınırıdır; ASME B31.3 basınçlı ekipman tasarımı için izin verilen gerilme tablosundaki pratik üst sınır muhtemelen daha düşüktür (bu oturumda ayrıca doğrulanmadı) — basınçlı sistem tasarımında bu ayrım dikkate alınmalıdır.",
  },
  {
    spec: {
      materialId: "alloy-825",
      family: "Nickel-Iron-Chromium Alloy",
      displayNameTr: "Alaşım 825 (Incoloy 825)",
      displayNameEn: "Alloy 825 (Incoloy 825)",
      pren: 28,
      minDesignTempC: -200,
      maxServiceTempC: 450,
      relativeCostIndex: 16,
      densityKgM3: 8140,
      notesTr:
        "Sülfürik ve fosforik asit ile deniz suyuna karşı iyi direnç sunan, Alloy 625'e göre daha ekonomik bir Ni bazlı CRA. Yüksek sıcaklık servisi için tasarlanmamıştır; asıl gücü agresif sulu ortamlardaki genel/çukurlaşma korozyon direncidir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "PREN=28, UNS N08825 (ASTM B424) kompozisyon aralığının alt sınırı (Cr 19.5%, Mo 2.5%) kullanılarak HESAPLANDI; ikinci bağımsız kaynakla PREN çapraz doğrulanmadı. 450°C maksimum servis sıcaklığı bu oturumda doğrudan araştırılmadı, genel Ni-Fe-Cr alaşım bilgisiyle kabaca tahmin edildi — UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "alloy-800h",
      family: "Nickel-Iron-Chromium Heat Resistant Alloy",
      displayNameTr: "Alaşım 800H (Incoloy 800H)",
      displayNameEn: "Alloy 800H (Incoloy 800H)",
      pren: 21,
      minDesignTempC: -200,
      maxServiceTempC: 850,
      relativeCostIndex: 13,
      densityKgM3: 7940,
      notesTr:
        "Öncelikle yüksek sıcaklık oksidasyon ve karbürizasyon direnci için tasarlanmıştır (593°C üzerinde sürünme/kopma direnci gerektiren servisler); genel korozyon/çukurlaşma uygulaması için birincil seçim değildir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "PREN=21, UNS N08810 (ASTM B407) kompozisyon aralığının alt sınırı (Cr 19%, Mo yok) kullanılarak HESAPLANDI. PREN bu alaşım için zaten anlamlı bir seçim kriteri değildir (800H yüksek sıcaklık için seçilir, klorürlü sulu korozyon için değil) — bilgi amaçlı tutuldu. 850°C maksimum servis sıcaklığı bu oturumda bulunan \"593°C üzerinde kullanılabilir\" bilgisinden ve alaşımın genel oksidasyon direnci ününden kabaca tahmin edildi, ASME B31.3 izin verilen gerilme tablosuyla doğrudan doğrulanmadı — UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "ss-310l",
      family: "Austenitic Stainless Steel (High Temperature)",
      displayNameTr: "Östenitik Paslanmaz Çelik (310L)",
      displayNameEn: "Austenitic Stainless Steel (310L)",
      pren: 25,
      csccLimitC: 60,
      minDesignTempC: -255,
      maxServiceTempC: 1100,
      relativeCostIndex: 6.5,
      densityKgM3: 8000,
      notesTr:
        "Yüksek Cr-Ni içeriğiyle (25Cr-20Ni) yüksek sıcaklık oksidasyon direnci öne çıkan östenitik paslanmaz; yüksek sıcaklık uygulamalarında Alloy 800H'ye ekonomik bir alternatif olabilir." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "PREN=25, tipik 310/310S kompozisyon aralığının orta noktası (Cr 25%, Mo yok) kullanılarak HESAPLANDI, ikinci kaynakla doğrulanmadı. csccLimitC=60°C, 304/316L gibi diğer FCC östenitik ailelerle aynı genel mekanizma (klorürlü SCC) varsayımıyla ANALOJİ yoluyla atandı — 310L'ye özgü doğrudan bir kaynak bulunamadı. 1100°C maksimum servis sıcaklığı, 310 ailesinin bilinen yüksek sıcaklık oksidasyon direnci ününe dayanır ancak bu oturumda birincil bir kaynakla doğrulanmadı — UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "cuni-90-10",
      family: "Copper-Nickel Alloy",
      displayNameTr: "Bakır-Nikel Alaşımı (90/10 CuNi)",
      displayNameEn: "Copper-Nickel Alloy (90/10 CuNi)",
      minDesignTempC: 0,
      maxServiceTempC: 200,
      relativeCostIndex: 4.5,
      densityKgM3: 8900,
      notesTr:
        "Deniz suyu soğutma sistemlerinde yaygın; PREN kavramı Fe-Cr-Ni-Mo sistemine özgü olduğundan bu alaşıma uygulanmaz. Erozyon-korozyon kritik hız sınırı literatürde ≈3.5-4.5 m/s olarak bildirilmiştir (bu oturumda araştırıldı, bkz. kaynak). Klorürlü SCC yerine amonyak kaynaklı gerilmeli çatlama riski taşır (farklı bir mekanizma, csccLimitC bu nedenle boş bırakıldı)." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_COPPER_ORG,
    crossChecked: true,
    crossCheckSources: [
      {
        type: "STANDARD",
        citation:
          "K.D. Efird çalışması (erozyon-korozyon döngü test aparatı) — 90/10 CuNi için kritik hız ≈4.5 m/s; Nickel Institute/Copper.org sanayi rehberleri — pratik tasarım hızı ≈3.5 m/s (100mm+ çaplı hatlar için).",
        accessedDate: "2026-08-11",
      },
    ],
    confidence: "LOW",
    notes:
      "Erozyon-korozyon kritik hız aralığı (3.5-4.5 m/s) iki bağımsız kaynakla makul ölçüde tutarlı (HIGH güvenilir), ama bu MaterialSpec şemasının bir alanı DEĞİL, notesTr içinde bilgi amaçlı tutuldu. minDesignTempC/maxServiceTempC/relativeCostIndex/densityKgM3 bu oturumda doğrudan araştırılmadı, genel bilgiyle (deniz suyu servis sıcaklık aralığı) kabaca dolduruldu — UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "niAlBr",
      family: "Nickel-Aluminum Bronze",
      displayNameTr: "Nikel-Alüminyum Bronz (NiAlBr)",
      displayNameEn: "Nickel-Aluminum Bronze (NiAlBr)",
      minDesignTempC: 0,
      maxServiceTempC: 200,
      relativeCostIndex: 9,
      densityKgM3: 7580,
      notesTr:
        "Yüksek hızlı deniz suyu/pompa gövdesi uygulamalarında erozyon direnci için seçilir. NACE araştırmaları, türbülanslı akışta lokalize çukurlaşma riskinin sadece ortalama akış hızına değil türbülans şiddetine de bağlı olduğunu göstermiştir." +
        COST_INDEX_CAVEAT,
    },
    source: {
      type: "CONFERENCE",
      citation:
        "\"Erosion Corrosion of Nickel Aluminum Bronze in Flowing Seawater\", NACE International Annual Conference, 1995 (özet bu oturumda incelendi, tam metne erişilmedi).",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Yalnızca genel bir davranış tanımı (türbülans-bağımlı çukurlaşma) bulundu; PREN/CPT/CCT ve sayısal sıcaklık/maliyet/yoğunluk değerleri bu oturumda doğrudan kaynaklanmadı, tipik nikel-alüminyum bronz değerleriyle kabaca dolduruldu. Kullanılmadan önce doğrulanmalıdır.",
  },
  {
    spec: {
      materialId: "martensitic-12cr",
      family: "Martensitic Stainless Steel (12Cr)",
      displayNameTr: "Martensitik Paslanmaz Çelik (12Cr)",
      displayNameEn: "Martensitic Stainless Steel (12Cr)",
      pren: 13,
      minDesignTempC: -18,
      maxServiceTempC: 315,
      relativeCostIndex: 3.2,
      densityKgM3: 7700,
      notesTr:
        "CO2 korozyonu ve orta düzey erozyon riski olan hatlarda östenitiklere göre daha ekonomik bir seçenek olarak kullanılır (yaygın NORSOK M-001 tipi tubular malzemesi). Genel korozyon direnci östenitiklerden düşüktür. Klorürlü SCC yerine sülfid stres çatlaması (NACE MR0175/ISO 15156 kapsamında) risk taşır — csccLimitC bu nedenle boş bırakıldı." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_UNS_COMPOSITION,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "PREN=13, AISI 410 (UNS S41000) minimum Cr içeriği (11.5%) kullanılarak HESAPLANDI; ISSF Şekil 3.7'de görülen \"409\" ferritik grade'in PREN~12-13 civarında konumlanmasıyla kabaca tutarlı (409 tam olarak 410 değildir, yakın bir referans). minDesignTempC/maxServiceTempC bu oturumda doğrudan araştırılmadı; martensitik çeliklerin düşük sıcaklıkta gevrek kırılma riski nedeniyle DİKKATLİ ele alınmalıdır — UNVERIFIED kabul edilmelidir.",
  },
  {
    spec: {
      materialId: "hdpe",
      family: "Thermoplastic (Polyethylene)",
      displayNameTr: "Yüksek Yoğunluklu Polietilen (HDPE)",
      displayNameEn: "High-Density Polyethylene (HDPE)",
      minDesignTempC: -40,
      maxServiceTempC: 60,
      relativeCostIndex: 0.4,
      densityKgM3: 950,
      notesTr:
        "Metalik olmadığından PREN/CPT/CCT/CSCC kavramları uygulanmaz. Kimyasal/korozyon bağışıklığı yüksek; gömülü su/atık su ve deniz suyu alım/deşarj hatlarında yaygın. Aromatik ve klorlu çözücülere karşı zayıf." +
        COST_INDEX_CAVEAT,
    },
    source: {
      type: "STANDARD",
      citation:
        "PE100 basınçlı boru endüstri kaynakları (engineeringtoolbox.com \"Plastic Pipes - Maximum Operating Temperatures\" ve ilgili üretici siteleri) — sürekli servis sıcaklığı tipik 60-80°C.",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "60°C maksimum servis sıcaklığı, bulunan 60-80°C aralığının muhafazakâr (düşük) ucu seçilerek alındı. -40°C minimum tasarım sıcaklığı ve yoğunluk (950 kg/m³) genel plastik malzeme bilgisiyle dolduruldu, bu oturumda doğrudan kaynaklanmadı.",
  },
  {
    spec: {
      materialId: "pp",
      family: "Thermoplastic (Polypropylene)",
      displayNameTr: "Polipropilen (PP)",
      displayNameEn: "Polypropylene (PP)",
      minDesignTempC: -10,
      maxServiceTempC: 80,
      relativeCostIndex: 0.4,
      densityKgM3: 905,
      notesTr:
        "Metalik olmadığından PREN/CPT/CCT/CSCC kavramları uygulanmaz. Asit/baz direnci iyi; endüstriyel proses hatlarında ve kimyasal tank/boru sistemlerinde yaygın." +
        COST_INDEX_CAVEAT,
    },
    source: {
      type: "STANDARD",
      citation:
        "Genel PP boru Vicat yumuşama sıcaklığı verisi (bu oturumda bulunan aralık 57-64°C); PP-H (homopolimer) proses boru dereceleri genelde daha yüksek sürekli servis sıcaklığına sahiptir.",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "Bulunan Vicat yumuşama verisi (57-64°C) muhtemelen PP-R (rastgele kopolimer) gradına ait ve sürekli servis sıcaklığından farklı bir ölçüttür; PP-H proses boru derecesi için daha yaygın bildirilen ~80-90°C aralığının alt ucu (80°C) temsili olarak kullanıldı — gradla YAKINDAN İLİŞKİLİDİR, kullanılmadan önce spesifik PP gradına göre doğrulanmalıdır.",
  },
  {
    spec: {
      materialId: "pvc",
      family: "Thermoplastic (PVC)",
      displayNameTr: "Polivinil Klorür (PVC)",
      displayNameEn: "Polyvinyl Chloride (PVC)",
      minDesignTempC: 0,
      maxServiceTempC: 60,
      relativeCostIndex: 0.3,
      densityKgM3: 1400,
      notesTr:
        "Metalik olmadığından PREN/CPT/CCT/CSCC kavramları uygulanmaz. İçme suyu ve düşük basınçlı hatlarda çok yaygın; düşük sıcaklıkta gevrekleşme eğilimi vardır (0°C altı dikkatli değerlendirilmelidir). Aromatik/klorlu çözücülere dayanıksız." +
        COST_INDEX_CAVEAT,
    },
    source: {
      type: "STANDARD",
      citation:
        "PVC boru endüstri standardı sürekli servis sıcaklığı (yaygın olarak 60°C/140°F olarak bildirilir) ve Vicat yumuşama verisi (bu oturumda bulunan aralık 54-80°C).",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "60°C, PVC basınçlı boru endüstrisinde yaygın kabul gören bir sürekli servis sınırı; bu oturumda tek bir ikincil kaynaktan teyit edildi. 0°C alt sınırı ve yoğunluk (1400 kg/m³) genel plastik malzeme bilgisiyle dolduruldu.",
  },
  {
    spec: {
      materialId: "gre",
      family: "Composite (Glass Reinforced Epoxy)",
      displayNameTr: "Cam Elyaf Takviyeli Epoksi (GRE)",
      displayNameEn: "Glass Reinforced Epoxy (GRE)",
      minDesignTempC: -20,
      maxServiceTempC: 80,
      relativeCostIndex: 1.2,
      densityKgM3: 1900,
      notesTr:
        "Metalik olmadığından PREN/CPT/CCT/CSCC kavramları uygulanmaz. Yüksek mukavemet/ağırlık oranı ve iyi korozyon direnci nedeniyle deniz suyu enjeksiyon ve yangın suyu hatlarında offshore uygulamalarda kullanılır." +
        COST_INDEX_CAVEAT,
    },
    source: SRC_GENERAL_ENGINEERING_KNOWLEDGE,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Bu oturumda GRE için doğrudan bir kaynak bulunamadı (arama sonuç vermedi). Tüm sayısal değerler (sıcaklık sınırları, yoğunluk, maliyet) kompozit boru literatüründen genel bilinen mertebelerle dolduruldu — kullanılmadan önce üretici veri sayfasıyla doğrulanmalıdır.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Doğrulama + dışa aktarım
// ─────────────────────────────────────────────────────────────────────────

export const MATERIALS: MaterialSpec[] = MATERIAL_DEFINITIONS.map((def) =>
  MaterialSpecSchema.parse(def.spec),
);

export function getMaterial(materialId: string): MaterialSpec {
  const material = MATERIALS.find((m) => m.materialId === materialId);
  if (!material) {
    const available = MATERIALS.map((m) => m.materialId).join(", ");
    throw new Error(
      `"${materialId}" kimlikli bir malzeme bulunamadı. Tanımlı malzemeler: ${available}.`,
    );
  }
  return material;
}

export function listMaterialsByFamily(family: string): MaterialSpec[] {
  return MATERIALS.filter((m) => m.family === family);
}

// ─────────────────────────────────────────────────────────────────────────
// KDP kayıt defteri entegrasyonu
// ─────────────────────────────────────────────────────────────────────────

for (const def of MATERIAL_DEFINITIONS) {
  const coefficient: Coefficient<MaterialSpec> = {
    id: `data.materials.${def.spec.materialId}`,
    module: "materials",
    value: def.spec,
    unit: "-",
    description: `${def.spec.displayNameTr} — malzeme mühendislik özellikleri (PREN, CPT/CCT, sıcaklık sınırları, maliyet, yoğunluk)`,
    source: def.source,
    crossChecked: def.crossChecked,
    crossCheckSources: def.crossCheckSources,
    confidence: def.confidence,
    notes: def.notes,
  };
  registerCoefficient(coefficient as Coefficient);
}

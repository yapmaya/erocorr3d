// packages/engine/src/data/valveCatalog.ts
//
// Vana kataloğu: ComponentTypeEnum'daki 15 vana tipi için (1) tipik hidrolik
// boyutlandırma katsayıları (FL, xT, FD, Cv/d², Cd/Kd) ve (2) erozyon riski
// değerlendirmesi için kritik bölge (erosion zone) listesi.
//
// KDP uyarınca bu dosyada İKİ AYRI veri kategorisi vardır ve BİLEREK iki
// ayrı kayıt defteri girdisi (Coefficient) grubuna ayrılmıştır:
//   - "hydraulics" grubu: gerçek üretici/endüstri kaynaklarından okunan
//     sayısal tablolar (bazıları HIGH güvenilirlikli — bkz. aşağıda).
//   - "erosionZones" grubu: bölge/ağırlık/çarpan verisi — bu oturumda HİÇBİR
//     vana tipi için "0-1 arası şiddet ağırlığı" veya "kısmi açıklık çarpan
//     eğrisi" için doğrudan yayınlanmış bir sayı BULUNAMADI; bu grup KASITLI
//     olarak tamamen "UNVERIFIED" işaretlenmiştir (bkz. EROSION_ZONE_CAVEAT).
// Bu iki grubu TEK bir Coefficient içinde birleştirmek, güçlü kaynaklı
// hidrolik verileri zayıf kaynaklı erozyon verisiyle aynı confidence
// etiketine mahkûm ederdi — bu KDP'nin dürüstlük ilkesine aykırı olurdu.
//
// ÖNEMLİ KAYNAK NOTU — Kc (kavitasyon başlangıç katsayısı): Bu oturumda HİÇBİR
// vana tipi için genel/literatür kaynaklı bir Kc değeri bulunamadı. Fisher
// Control Valve Handbook'un ilgili boyutlandırma tablosu (5.10.1/5.10.2) Cv,
// FL, xT, FD sütunlarını içerir ama Kc içermez — bu, ValveGeometrySchema'nın
// kendi açıklamasıyla da tutarlıdır ("Kc... vana üreticisi test verisinden
// gelir"). Bu nedenle katalogda hiçbir kcTypical değeri VERİLMEDİ (uydurma
// yapılmadı); şema alanı yine de tanımlıdır, gelecekte üretici-özel test
// verisiyle doldurulabilir.

import { z } from "zod";
import { registerCoefficient } from "../registry";
import type { Coefficient, Source } from "../registry/types";
import { ComponentTypeEnum, type ComponentType } from "../types/enums";

// ─────────────────────────────────────────────────────────────────────────
// Şema
// ─────────────────────────────────────────────────────────────────────────

const RangeTupleSchema = z
  .tuple([z.number(), z.number()])
  .refine(([min, max]) => min <= max, {
    message: "Aralığın ilk değeri (min) ikinci değerden (max) büyük olamaz.",
  });

export const ValveHydraulicProfileSchema = z.object({
  componentType: ComponentTypeEnum,
  displayNameTr: z.string().min(1).describe("Türkçe görünen ad"),
  applicabilityTr: z
    .string()
    .min(1)
    .describe("Bu tipik değerlerin hangi kullanım biçimine ait olduğu (kısma/kontrol vs. tam açık/kapalı izolasyon)"),
  flRange: RangeTupleSchema.optional().describe(
    "Sıvı basınç geri kazanım faktörü FL tipik aralığı (boyutsuz, 0-1)",
  ),
  xtRange: RangeTupleSchema.optional().describe(
    "Kritik basınç düşümü oranı xT tipik aralığı (boyutsuz, 0-1)",
  ),
  fdRange: RangeTupleSchema.optional().describe(
    "Vana stili düzeltme faktörü FD tipik aralığı (boyutsuz, 0-1)",
  ),
  cvOverD2Typical: z
    .number()
    .positive()
    .optional()
    .describe("Tam açık tipik Cv/d² oranı (d: nominal boru çapı, inç cinsinden) — yalnızca on/off tipi vanalar için anlamlıdır"),
  dischargeCoefficientRange: RangeTupleSchema.optional().describe(
    "Deşarj katsayısı Cd/Kd tipik aralığı (choke, kısıcı orifis, emniyet vanası gibi elemanlar için)",
  ),
  kcTypical: z
    .number()
    .positive()
    .optional()
    .describe("Kavitasyon başlangıç katsayısı Kc — bu oturumda genel bir kaynak bulunamadı, üretici test verisi gerektirir"),
});
export type ValveHydraulicProfile = z.infer<typeof ValveHydraulicProfileSchema>;

const ErosionZoneMultiplierPointSchema = z.object({
  openingPercent: z.number().min(0).max(100).describe("Açıklık/akış oranı yüzdesi"),
  multiplier: z.number().min(0).describe("Bu açıklıkta, tam açığa göre göreli erozyon şiddet çarpanı"),
});

export const ErosionZoneSchema = z.object({
  id: z.string().min(1),
  descriptionTr: z.string().min(1),
  defaultSeverityWeight: z
    .number()
    .min(0)
    .max(1)
    .describe("0-1 arası göreli erozyon riski ağırlığı (fiziksel bir oran DEĞİL, sıralama amaçlı mühendislik yargısı)"),
  partialOpeningMultiplierCurve: z
    .array(ErosionZoneMultiplierPointSchema)
    .min(2)
    .describe("Açıklık yüzdesine göre göreli şiddet çarpanı kontrol noktaları (aradaki değerler enterpolasyonla kullanılmalıdır)"),
});
export type ErosionZone = z.infer<typeof ErosionZoneSchema>;

export const ValveErosionProfileSchema = z.object({
  componentType: ComponentTypeEnum,
  zones: z.array(ErosionZoneSchema).min(1),
});
export type ValveErosionProfile = z.infer<typeof ValveErosionProfileSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_FISHER_HANDBOOK: Source = {
  type: "TEXTBOOK",
  citation:
    "Emerson/Fisher, \"Control Valve Handbook\", 5. baskı, Bölüm 5 \"Control Valve Sizing\" — Tablo 5.10.1 " +
    "\"Representative Sizing Coefficients for Single-Ported, Globe-Style Valve Bodies\" ve Tablo 5.10.2 " +
    "\"Representative Sizing Coefficients for Rotary Valves\". Değerler bu oturumda dosyanın tam metninden " +
    "(pdftotext ile) doğrudan okundu, ikincil bir özetten alınmadı.",
  url: "https://uploads-ssl.webflow.com/5ac7cf1999758e25761dac7f/5afc83913a6585f1d67cad74_Emerson-Fisher-Control-Valve-handbook-fifth-edition.pdf",
  accessedDate: "2026-08-11",
};

const SRC_CRANE_TP410_SECONDARY: Source = {
  type: "TEXTBOOK",
  citation:
    "Crane Co., \"Flow of Fluids Through Valves, Fittings, and Pipe\", Technical Paper No. 410 — K = n·f_T " +
    "yöntemiyle vana/bağlantı parçası direnç katsayıları tablosu. Orijinal TP-410 ücretli olduğundan bu " +
    "oturumda ikincil bir özet (simupipe.com K-Factor Table) kullanıldı; gate valve K≈0.15 ve globe valve " +
    "K≈6 (2\" boru) değerleri ayrıca bağımsız bir arama sonucu sentezinde de doğrulandı.",
  url: "https://simupipe.com/resources/k-factor-table",
  accessedDate: "2026-08-11",
};

const SRC_BOYUN_GUO_CHOKE: Source = {
  type: "TEXTBOOK",
  citation:
    "Boyun Guo ve ark., \"Petroleum Production Engineering\" ders kitabı, Bölüm 5 \"Choke Performance\" — " +
    "Sachdeva (1986) çok-fazlı choke akış modeli ve deşarj katsayısı CD aralığı (0.62-0.90), örnek " +
    "hesaplarda CD=0.62 (gaz, NRe>10⁶, Şekil 5.2) ve CD=0.99 (özel örnek). Bu oturumda dosyanın tam " +
    "metninden (pdftotext ile) doğrudan okundu.",
  url: "https://www.petroleumengineers.ru/sites/default/files/choke.pdf",
  accessedDate: "2026-08-11",
};

const SRC_API_520_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "API Standard 520/526, basınç emniyet vanası boyutlandırma — sertifikalı buhar/gaz servisi için etkin " +
    "deşarj katsayısı Kd=0.975, kapasite sertifikasyonu olmayan ön-boyutlandırma/muhafazakâr sıvı servisi " +
    "için Kd=0.62. Orijinal API 520 ücretli olduğundan bu oturumda birden fazla bağımsız endüstri özet " +
    "kaynağı (technicaltoolboxes.com, flowmachinery.com, midstreamcalculator.com) kullanıldı; tüm kaynaklar " +
    "aynı iki değerde (0.975 / 0.62) örtüştü.",
  accessedDate: "2026-08-11",
};

const SRC_ISO_5167_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "ISO 5167 (keskin kenarlı/ince plakalı orifis) — Reader-Harris/Gallagher korelasyonuna göre deşarj " +
    "katsayısı Cd tipik aralığı 0.59-0.65, yüksek Reynolds sayısında (Re>10⁶) daralarak Cd≈0.61-0.63. " +
    "Orijinal ISO 5167 ücretli olduğundan bu oturumda birden fazla bağımsız endüstri özet kaynağı " +
    "(brighthubengineering.com, simupipe.com orifis hesaplayıcısı) kullanıldı; değerler örtüştü.",
  accessedDate: "2026-08-11",
};

const SRC_DNV_O501: Source = {
  type: "STANDARD",
  citation:
    "Det Norske Veritas, \"Recommended Practice DNV-RP-O501: Erosive Wear in Piping Systems\", Rev. 4.2 " +
    "(2005) — §9.4: \"Pipe bends, blinded tees and restrictions like reducers, control chokes and valves " +
    "will generally be the most critical components with respect to erosive wear.\"; §8.6 Reducers, Şekil " +
    "8-2 \"Area of erosion\" (bir daralmada parçacık çarpma bölgesi geometrisi); §10.1: choke'larda " +
    "kavitasyonun \"yüksek basınç düşürme/kısmi kapalı koşullarda\" görüldüğü belirtiliyor. Bu oturumda " +
    "dosyanın tam metninden (pdftotext ile) doğrudan okundu.",
  url: "https://rules.dnv.com/docs/pdf/dnvpm/codes/docs/2005-01/RP-O501.pdf",
  accessedDate: "2026-08-11",
};

const EROSION_ZONE_CAVEAT =
  "UYARI: Bölge KONUMLARI genel vana mühendisliği bilgisi ve DNV-RP-O501'in \"daralma/kısma noktaları " +
  "en kritik bileşenlerdir\" ilkesine (bkz. SRC_DNV_O501) dayanır, ancak defaultSeverityWeight (0-1) ve " +
  "partialOpeningMultiplierCurve sayıları için bu oturumda HİÇBİR doğrudan yayınlanmış kaynak bulunamadı. " +
  "Bu sayılar sıralama amaçlı mühendislik tahminleridir, ölçülmüş bir erozyon oranı DEĞİLDİR ve kullanılmadan " +
  "önce bir korozyon/erozyon mühendisi tarafından gözden geçirilmelidir.";

// ─────────────────────────────────────────────────────────────────────────
// Hidrolik profil tanımları
// ─────────────────────────────────────────────────────────────────────────

interface HydraulicDefinition {
  profile: ValveHydraulicProfile;
  source: Source;
  crossChecked: boolean;
  crossCheckSources: Source[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  notes: string;
}

const HYDRAULIC_DEFINITIONS: HydraulicDefinition[] = [
  {
    profile: {
      componentType: "GATE_VALVE",
      displayNameTr: "Sürgülü Vana",
      applicabilityTr: "Tam açık/tam kapalı izolasyon servisi (kısma için tasarlanmamıştır)",
      cvOverD2Typical: 77.2,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=77.2, Crane TP-410'un K≈0.15 (tam açık, 2\" boru, n=8×f_T) değerinden Cv=29.9·d²/√K " +
      "standart bağıntısıyla HESAPLANDI (bağıntının kendisi de arama sonucunda doğrulandı). K, f_T'nin boru " +
      "çapıyla değiştiği bir katsayı olduğundan bu oran büyük çaplarda hafifçe artabilir — yalnızca yaklaşık " +
      "NPS2 civarı için doğrudan geçerlidir. Sürgülü vanalar kısma servisinde şiddetli erozyon/\"wire " +
      "drawing\" riski taşıdığından FL/xT değeri yaygın mühendislik pratiğinde tanımlanmaz — bu alanlar " +
      "kasıtlı olarak boş bırakıldı.",
  },
  {
    profile: {
      componentType: "GLOBE_VALVE",
      displayNameTr: "Glob Vana (klasik, elle kumandalı)",
      applicabilityTr: "Genel kısma/izolasyon servisi (klasik Z-gövde, kontrol vanası trim'i değil)",
      cvOverD2Typical: 11.76,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=11.76, Crane TP-410'un K≈6.46 (tam açık, 2\" boru, n=340×f_T) değerinden HESAPLANDI. " +
      "Bu değer KLASİK/elle kumandalı Z-gövde glob vanaya aittir; kafesli (cage-guided) modern kontrol " +
      "vanası trim'i çok daha düşük K/yüksek Cv taşır — bkz. ayrı CONTROL_VALVE_GLOBE/CONTROL_VALVE_CAGE " +
      "girdileri (Fisher El Kitabı'ndan doğrudan okunan gerçek FL/xT/FD verisiyle).",
  },
  {
    profile: {
      componentType: "BALL_VALVE_FULL",
      displayNameTr: "Tam Geçişli Küresel Vana",
      applicabilityTr: "Tam açık/tam kapalı izolasyon servisi (kısma için tasarlanmamıştır)",
      cvOverD2Typical: 122.1,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=122.1, Crane TP-410'un K≈0.06 (tam açık, tam geçişli, 2\" boru, n=3×f_T) değerinden " +
      "HESAPLANDI. Tam geçişli küresel vanalar normal serviste tam açık çalışır; kısma amacıyla kullanılması " +
      "üretici literatüründe genel olarak önerilmez (oturak erozyonu riski) — bkz. BALL_VALVE_REDUCED " +
      "(V-çentikli, kısma için tasarlanmış tip).",
  },
  {
    profile: {
      componentType: "BALL_VALVE_REDUCED",
      displayNameTr: "Daraltılmış Geçişli Küresel Vana (V-Çentikli / Segment)",
      applicabilityTr: "Kısma/kontrol servisi (V-çentikli/segment tip küresel kontrol vanası)",
      flRange: [0.37, 0.86],
      xtRange: [0.13, 0.54],
    },
    source: SRC_FISHER_HANDBOOK,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "FL/xT aralığı, Fisher El Kitabı Tablo 5.10.2'deki \"V-Notch Ball Valve\" satırlarından (NPS 1-16, " +
      "60° ve 90° açıklık) DOĞRUDAN okundu — tahmin/hesaplama içermez. FD sütunu bu vana tipi için tabloda " +
      "\"---\" (tanımsız) olarak verilmiş, dolayısıyla fdRange boş bırakıldı. Cv değeri NPS ve açıklık " +
      "açısına göre çok geniş bir aralıkta değiştiğinden (15.6-8270) tek bir Cv/d² oranı anlamlı olmaz, " +
      "verilmedi — spesifik boyutlandırma için Fisher tablosunun ilgili satırına bakılmalıdır.",
  },
  {
    profile: {
      componentType: "BUTTERFLY_VALVE",
      displayNameTr: "Kelebek Vana",
      applicabilityTr: "Hem tam açık/kapalı izolasyon (Crane K bazlı Cv/d²) hem kısma/kontrol servisi (Fisher yüksek performanslı kelebek vana verisi)",
      flRange: [0.48, 0.81],
      xtRange: [0.17, 0.5],
      fdRange: [0.49, 0.7],
      cvOverD2Typical: 32.2,
    },
    source: SRC_FISHER_HANDBOOK,
    crossChecked: true,
    crossCheckSources: [SRC_CRANE_TP410_SECONDARY],
    confidence: "HIGH",
    notes:
      "flRange/xtRange/fdRange, Fisher El Kitabı Tablo 5.10.2'deki \"High-Performance Butterfly Valve\" " +
      "satırlarından (NPS 2-16, 60°/90° açıklık) DOĞRUDAN okundu. fdRange, tabloda açıklık başına sabit " +
      "görünen iki değere (60°→0.49, 90°→0.70) karşılık gelir. cvOverD2Typical=32.2 AYRI bir kaynaktan " +
      "(Crane TP-410, K≈0.86 @2\", tam açık on/off kullanım) HESAPLANDI — kısma/kontrol Cv'siyle " +
      "KARIŞTIRILMAMALIDIR, bu yüzden iki veri kümesi applicabilityTr'de ayrıca açıklandı.",
  },
  {
    profile: {
      componentType: "CHECK_VALVE_SWING",
      displayNameTr: "Çırpma Tip Çekvalf",
      applicabilityTr: "Tek yönlü akışa izin veren pasif/otomatik kapanan eleman (elle kısma yoktur)",
      cvOverD2Typical: 21.7,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=21.7, Crane TP-410'un K≈1.90 (tam açık, 2\" boru, n=100×f_T) değerinden HESAPLANDI.",
  },
  {
    profile: {
      componentType: "CHECK_VALVE_LIFT",
      displayNameTr: "Kaldırmalı Çekvalf",
      applicabilityTr: "Tek yönlü akışa izin veren pasif/otomatik kapanan eleman (elle kısma yoktur)",
      cvOverD2Typical: 8.86,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=8.86, Crane TP-410'un K≈11.4 (tam açık, 2\" boru, n=600×f_T) değerinden HESAPLANDI. " +
      "Kaldırmalı çekvalfler, glob vanaya benzer dahili akış yolu nedeniyle çekvalf tipleri arasında en " +
      "yüksek basınç düşümüne sahiptir (n=600, swing tipin 6 katı) — bu, Crane'in kendi tablosunda tutarlı " +
      "bir şekilde yansıtılıyor.",
  },
  {
    profile: {
      componentType: "CHECK_VALVE_DUAL_PLATE",
      displayNameTr: "Çift Plakalı Çekvalf",
      applicabilityTr: "Tek yönlü akışa izin veren pasif/otomatik kapanan eleman (elle kısma yoktur)",
    },
    source: {
      type: "STANDARD",
      citation:
        "Çift plakalı/wafer tip çekvalfler modern ve büyük ölçüde üretici-özel tasarımlar olduğundan, " +
        "klasik Crane TP-410 tablosunda doğrudan bir karşılığı yoktur (bkz. eng-tips.com forum tartışması " +
        "\"Wafer Check Valves K-Value Match in Crane TP-410\" — mühendisler bu tip için en yakın swing/lift " +
        "değerini yaklaşık olarak kullanmayı tartışıyor, kesin bir sayı vermiyor).",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Bu oturumda çift plakalı çekvalf için doğrudan bir Cv/d²/K kaynağı BULUNAMADI. Genel olarak swing " +
      "(K≈1.9@2\") ile lift (K≈11.4@2\") çekvalf arasında, muhtemelen swing'e daha yakın bir dirence sahip " +
      "olduğu bilinir (kompakt disk tasarımı) ama sayısal bir değer UYDURULMADI — kullanılmadan önce " +
      "üretici Cv verisiyle doğrulanmalıdır.",
  },
  {
    profile: {
      componentType: "PLUG_VALVE",
      displayNameTr: "Tapa Vana",
      applicabilityTr: "Tam açık/tam kapalı izolasyon servisi (bazı düz-yollu tipler sınırlı kısmaya uygundur)",
      cvOverD2Typical: 51.3,
    },
    source: SRC_CRANE_TP410_SECONDARY,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "cvOverD2Typical=51.3, Crane TP-410'un K≈0.34 (tam açık, düz-yollu \"straightway\" tip, 2\" boru, " +
      "n=18×f_T) değerinden HESAPLANDI. Sadece düz-yollu (straightway) tip için veri bulundu; 3-yollu " +
      "(3-way) tapa vana Crane tablosunda ayrıca listelenmemiş.",
  },
  {
    profile: {
      componentType: "NEEDLE_VALVE",
      displayNameTr: "İğne Vana",
      applicabilityTr: "Hassas kısma/ölçüm servisi (genellikle üretici-özel Cv eğrisiyle boyutlandırılır)",
    },
    source: {
      type: "TEXTBOOK",
      citation:
        "İğne vanalar için ne Fisher El Kitabı'nın kontrol vanası tablosunda ne de Crane TP-410'un K-faktör " +
        "özetinde genel bir FL/xT/K değeri bulunamadı; bu tip genellikle üretici-özel (ör. Swagelok, Hoke) " +
        "Cv eğrileriyle boyutlandırılır, bu oturumda böyle bir üretici kataloğuna erişilmedi.",
      accessedDate: "2026-08-11",
    },
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Bu oturumda iğne vana için hiçbir sayısal FL/xT/Cv-d² değeri BULUNAMADI — hiçbir alan UYDURULMADI, " +
      "hepsi boş bırakıldı. İğne vanaların uzun/dar akış yolu geometrisi nedeniyle yüksek FL (~0.9+, iyi " +
      "basınç geri kazanımı) taşıması BEKLENİR ama bu bir tahmindir, doğrulanmadan kullanılmamalıdır.",
  },
  {
    profile: {
      componentType: "CHOKE_VALVE",
      displayNameTr: "Choke (Kısma) Vana",
      applicabilityTr: "Üretim choke servisi (sabit veya ayarlanabilir choke bean), kritik/kritik-altı akış",
      dischargeCoefficientRange: [0.62, 0.9],
    },
    source: SRC_BOYUN_GUO_CHOKE,
    crossChecked: true,
    crossCheckSources: [
      {
        type: "TEXTBOOK",
        citation:
          "Genel petrol mühendisliği choke boyutlandırma referansları, tek nokta yaklaşımı olarak Cd≈0.78 " +
          "kullanır — Boyun Guo'nun Sachdeva modelindeki 0.62-0.90 aralığının içinde, tutarlı.",
        accessedDate: "2026-08-11",
      },
    ],
    confidence: "HIGH",
    notes:
      "dischargeCoefficientRange=[0.62,0.90], Boyun Guo \"Petroleum Production Engineering\" ders kitabının " +
      "choke performansı bölümünden DOĞRUDAN okundu (Sachdeva'nın (1986) çok-fazlı choke akış modeli, " +
      "Ashford-Pierce (1975) çalışmasının genişletilmesi). Kitapta ayrıca CD=0.62 (gaz, NRe>10⁶, kritik akış) " +
      "ve CD=0.99 (özel bir örnek) sayısal örnekleri de verilmiştir. Choke, üretim hatlarında EN yüksek " +
      "erozyon riskine sahip bileşen olarak kabul edilir (bkz. erosionZones — DNV-RP-O501 §9.4/§10.1).",
  },
  {
    profile: {
      componentType: "CONTROL_VALVE_GLOBE",
      displayNameTr: "Glob Tip Kontrol Vanası",
      applicabilityTr: "Kısma/kontrol servisi (tekli oturaklı glob gövde, post-guided veya cage-guided trim)",
      flRange: [0.77, 0.97],
      xtRange: [0.54, 0.92],
      fdRange: [0.26, 0.72],
    },
    source: SRC_FISHER_HANDBOOK,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "flRange/xtRange/fdRange, Fisher El Kitabı Tablo 5.10.1'deki TÜM tekli oturaklı glob gövde satırlarından " +
      "(NPS 1/2-8, post-guided ve cage-guided trim, linear ve equal-percentage karakteristik) DOĞRUDAN " +
      "okundu — tahmin/hesaplama içermez. Cv, trim/port tipine göre çok geniş bir aralıkta (2.41-846) " +
      "değiştiğinden tek bir Cv/d² oranı verilmedi; spesifik boyutlandırma için üretici kataloğuna " +
      "bakılmalıdır. Daha dar bir alt küme için bkz. CONTROL_VALVE_CAGE (yalnızca cage-guided trim).",
  },
  {
    profile: {
      componentType: "CONTROL_VALVE_CAGE",
      displayNameTr: "Kafesli (Cage) Kontrol Vanası",
      applicabilityTr: "Kısma/kontrol servisi (kafesli/cage-guided trim, NPS 1-8 aralığında tablo verisi)",
      flRange: [0.77, 0.87],
      xtRange: [0.62, 0.81],
      fdRange: [0.26, 0.38],
    },
    source: SRC_FISHER_HANDBOOK,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "flRange/xtRange/fdRange, Fisher El Kitabı Tablo 5.10.1'deki YALNIZCA \"Cage-Guided\" satırlarından " +
      "(NPS 1-8, linear ve equal-percentage karakteristik) DOĞRUDAN okundu — CONTROL_VALVE_GLOBE'un post-" +
      "guided küçük boy satırlarını (NPS 1/2-3/4) İÇERMEZ, bu yüzden aralık daha dardır.",
  },
  {
    profile: {
      componentType: "PRESSURE_SAFETY_VALVE",
      displayNameTr: "Basınç Emniyet Vanası",
      applicabilityTr: "Basınç tahliye/emniyet servisi (kısa süreli, tam kalkış olayı — normal serviste modüle edilmez)",
      dischargeCoefficientRange: [0.62, 0.975],
    },
    source: SRC_API_520_SECONDARY,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "dischargeCoefficientRange=[0.62,0.975] iki farklı senaryoyu birlikte temsil eder: 0.975 sertifikalı " +
      "buhar/gaz servisi için API'nin standart etkin Kd'si; 0.62 kapasite sertifikasyonu olmayan/muhafazakâr " +
      "sıvı servisi ön-boyutlandırması için kullanılır. Bu, orijinal API 520/526 standardından değil, birden " +
      "fazla bağımsız ikincil endüstri kaynağından alındı (hepsi aynı iki sayıda örtüştü) — MEDIUM olarak " +
      "işaretlendi.",
  },
  {
    profile: {
      componentType: "RESTRICTION_ORIFICE",
      displayNameTr: "Kısıcı Orifis",
      applicabilityTr: "Sabit geometrili akış kısıtlaması (ayarlanamaz, tek bir plaka deliği)",
      dischargeCoefficientRange: [0.59, 0.65],
    },
    source: SRC_ISO_5167_SECONDARY,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "dischargeCoefficientRange=[0.59,0.65], ISO 5167 ince-plakalı keskin kenarlı orifis standardının " +
      "Reader-Harris/Gallagher korelasyonuna dayanır; yüksek Reynolds sayısında (Re>10⁶) aralık ≈0.61-0.63'e " +
      "daralır. Orijinal ISO 5167 standardından değil, birden fazla bağımsız ikincil endüstri kaynağından " +
      "alındı (hepsi örtüştü) — MEDIUM olarak işaretlendi.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Erozyon bölgesi profil tanımları
// ─────────────────────────────────────────────────────────────────────────

interface ErosionDefinition {
  profile: ValveErosionProfile;
  source: Source;
  crossChecked: boolean;
  crossCheckSources: Source[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  notes: string;
}

const EROSION_DEFINITIONS: ErosionDefinition[] = [
  {
    profile: {
      componentType: "GATE_VALVE",
      zones: [
        {
          id: "gate.seat_cavity",
          descriptionTr: "Oturma yüzeyi ve gövde iç boşluğu — kısmi açıklıkta oluşan yüksek hızlı jet",
          defaultSeverityWeight: 0.7,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 3 },
            { openingPercent: 25, multiplier: 8 },
            { openingPercent: 10, multiplier: 20 },
          ],
        },
        {
          id: "gate.downstream_seat",
          descriptionTr: "Oturaktan hemen sonraki boru cidarı — daralma sonrası hızlanmış akışın çarptığı bölge",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2.5 },
            { openingPercent: 25, multiplier: 6 },
            { openingPercent: 10, multiplier: 15 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Sürgülü vanaların kısmi açıklıkta ciddi şekilde \"wire drawing\"/erozyon riski taşıması ve bu " +
      "nedenle kısma servisinde KULLANILMAMASI gerektiği yaygın ve iyi bilinen bir mühendislik pratiğidir " +
      "(çoğu üretici kataloğu ve API 600/RP 14E türevi rehberler bunu açıkça belirtir); çarpan eğrisinin " +
      "keskinliği bu genel pratikle TUTARLI seçildi. " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "GLOBE_VALVE",
      zones: [
        {
          id: "globe.plug_seat_contact",
          descriptionTr: "Plug-oturak temas bölgesi ve hemen altındaki gövde boşluğu",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2 },
            { openingPercent: 25, multiplier: 4 },
            { openingPercent: 10, multiplier: 8 },
          ],
        },
        {
          id: "globe.downstream_seat",
          descriptionTr: "Oturaktan hemen sonraki gövde/çıkış bölgesi",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 1.8 },
            { openingPercent: 25, multiplier: 3.5 },
            { openingPercent: 10, multiplier: 7 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Glob vanalar kısma için tasarlandığından (aksine bkz. GATE_VALVE) çarpan eğrisi daha ILIMLI seçildi. " +
      EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "BALL_VALVE_FULL",
      zones: [
        {
          id: "ballFull.seat_ring",
          descriptionTr: "Oturak halkası — normalde tam açık çalışır, düşük risk",
          defaultSeverityWeight: 0.3,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 6 },
            { openingPercent: 25, multiplier: 18 },
            { openingPercent: 10, multiplier: 35 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Tam geçişli küresel vanalar kısma servisi için TASARLANMAMIŞTIR; çarpan eğrisi bu tipin yanlışlıkla " +
      "kısılması durumundaki ÇOK YÜKSEK riski yansıtacak şekilde kasıtlı olarak dik seçildi (kısma için " +
      "tasarlanmış BALL_VALVE_REDUCED ile karşılaştırınız). " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "BALL_VALVE_REDUCED",
      zones: [
        {
          id: "ballReduced.v_notch_edge",
          descriptionTr: "V-çentik/segment oturağının kenarları — yüksek hız gradyanı bölgesi",
          defaultSeverityWeight: 0.7,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2.5 },
            { openingPercent: 25, multiplier: 5 },
            { openingPercent: 10, multiplier: 10 },
          ],
        },
        {
          id: "ballReduced.downstream_cavity",
          descriptionTr: "Küre arkası gövde boşluğu ve çıkış bölgesi",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2 },
            { openingPercent: 25, multiplier: 4 },
            { openingPercent: 10, multiplier: 8 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "BUTTERFLY_VALVE",
      zones: [
        {
          id: "butterfly.disc_edge_seat",
          descriptionTr: "Disk kenarı ve oturak temas hattı",
          defaultSeverityWeight: 0.7,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 3 },
            { openingPercent: 25, multiplier: 7 },
            { openingPercent: 10, multiplier: 15 },
          ],
        },
        {
          id: "butterfly.downstream_disc",
          descriptionTr: "Disk arkası — özellikle kısmi açıklıkta oluşan ayrılmış akış (flow separation) bölgesi",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2.5 },
            { openingPercent: 25, multiplier: 6 },
            { openingPercent: 10, multiplier: 12 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CHECK_VALVE_SWING",
      zones: [
        {
          id: "checkSwing.disc_seat_edge",
          descriptionTr: "Disk-oturak temas kenarı",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 6 },
          ],
        },
        {
          id: "checkSwing.hinge_pin_area",
          descriptionTr: "Menteşe pimi ve çevresi — kısmi kalkışta (chattering) oluşan türbülanslı ikincil akış",
          defaultSeverityWeight: 0.4,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 5 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Çekvalflerde \"openingPercent\" kavramı elle ayarlanan bir açıklığı değil, DİSKİN akış hızına bağlı " +
      "göreli kalkış oranını temsil eder (100=tam kalkış/anma akış, düşük değer=düşük akışta kısmi kalkış). " +
      "Kısmi kalkışta oluşan \"chattering\" (çırpma) fenomeninin disk/oturak/menteşe aşınmasını hızlandırdığı " +
      "genel bir mühendislik bilgisidir, bu oturumda sayısal bir kaynakla doğrulanmadı. " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CHECK_VALVE_LIFT",
      zones: [
        {
          id: "checkLift.disc_seat_edge",
          descriptionTr: "Disk-oturak temas kenarı",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 5 },
          ],
        },
        {
          id: "checkLift.guide_bore",
          descriptionTr: "Disk kılavuz deliği (guide bore) — dahili akış yolu daralması nedeniyle yüksek yerel hız",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 4 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: "\"openingPercent\" burada da göreli akış/kalkış oranını temsil eder. " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CHECK_VALVE_DUAL_PLATE",
      zones: [
        {
          id: "checkDualPlate.plate_hinge_area",
          descriptionTr: "Çift plaka menteşe/mil bölgesi",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 4 },
          ],
        },
        {
          id: "checkDualPlate.seat_area",
          descriptionTr: "Oturak bölgesi",
          defaultSeverityWeight: 0.4,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 3.5 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "PLUG_VALVE",
      zones: [
        {
          id: "plug.port_edge",
          descriptionTr: "Tapa port kenarları (dikdörtgen/yuvarlak geçiş ağzı)",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 3 },
            { openingPercent: 25, multiplier: 7 },
            { openingPercent: 10, multiplier: 15 },
          ],
        },
        {
          id: "plug.body_cavity_below_plug",
          descriptionTr: "Tapa altı gövde boşluğu",
          defaultSeverityWeight: 0.4,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2 },
            { openingPercent: 25, multiplier: 4 },
            { openingPercent: 10, multiplier: 8 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "NEEDLE_VALVE",
      zones: [
        {
          id: "needle.tip_seat",
          descriptionTr: "İğne ucu-oturak bölgesi — çok küçük akış alanı nedeniyle geometrik olarak yoğunlaşmış yüksek yerel hız",
          defaultSeverityWeight: 0.8,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 25, multiplier: 10 },
            { openingPercent: 5, multiplier: 30 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "İğne vanaların doğası gereği (çok küçük, hassas ayarlı akış kesiti) erozyon riskinin geometrik olarak " +
      "yüksek olduğu mantıksal bir çıkarımdır, ancak bu oturumda sayısal bir kaynakla desteklenmedi. " +
      EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CHOKE_VALVE",
      zones: [
        {
          id: "choke.bean_orifice",
          descriptionTr: "Choke bean/trim deliği — üretim hatlarında birincil ve en kritik erozyon konumu",
          defaultSeverityWeight: 1.0,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 4 },
            { openingPercent: 25, multiplier: 12 },
            { openingPercent: 10, multiplier: 30 },
          ],
        },
        {
          id: "choke.downstream_expansion",
          descriptionTr: "Choke çıkışı genişleme bölgesi — yüksek hızlı jetin boru cidarına çarptığı alan",
          defaultSeverityWeight: 0.8,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 3 },
            { openingPercent: 25, multiplier: 8 },
            { openingPercent: 10, multiplier: 18 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "defaultSeverityWeight=1.0, choke'un DNV-RP-O501 §9.4'te açıkça \"en kritik bileşenler\" arasında " +
      "sayılması ve bu katalogdaki DİĞER tüm vana tiplerine göre referans/karşılaştırma noktası olması " +
      "amacıyla seçildi. DNV-RP-O501 §10.1 ayrıca choke'larda kavitasyonun \"yüksek basınç düşürme/kısmi " +
      "kapalı koşullarda\" görüldüğünü belirtir — bu, çarpan eğrisinin düşük açıklıkta en dik olan eğri " +
      "olmasının niteliksel gerekçesidir. Sayısal ağırlık/çarpan değerlerinin kendisi yine de " +
      "UYDURULMAMIŞ ama DOĞRUDAN kaynaklanmamış tahminlerdir. " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CONTROL_VALVE_GLOBE",
      zones: [
        {
          id: "controlGlobe.trim_seat_region",
          descriptionTr: "Trim/oturak bölgesi — kısma sırasında en yüksek hız gradyanının oluştuğu nokta",
          defaultSeverityWeight: 0.7,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2.5 },
            { openingPercent: 25, multiplier: 5 },
            { openingPercent: 10, multiplier: 10 },
          ],
        },
        {
          id: "controlGlobe.downstream_seat",
          descriptionTr: "Oturaktan hemen sonraki gövde bölgesi",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2 },
            { openingPercent: 25, multiplier: 4 },
            { openingPercent: 10, multiplier: 8 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes: EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "CONTROL_VALVE_CAGE",
      zones: [
        {
          id: "controlCage.cage_window_edges",
          descriptionTr: "Kafes penceresi kenarları — çok kademeli trim'de yüksek türbülans ve yerel hız artışı",
          defaultSeverityWeight: 0.7,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2.5 },
            { openingPercent: 25, multiplier: 5 },
            { openingPercent: 10, multiplier: 10 },
          ],
        },
        {
          id: "controlCage.downstream_cage",
          descriptionTr: "Kafes çıkışı gövde bölgesi",
          defaultSeverityWeight: 0.5,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 50, multiplier: 2 },
            { openingPercent: 25, multiplier: 4 },
            { openingPercent: 10, multiplier: 8 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Kafesli trim, çok kademeli basınç düşümü ile kavitasyon/erozyonu AZALTMAK üzere tasarlanır; bu " +
      "nedenle çarpan eğrisi CONTROL_VALVE_GLOBE ile aynı tutuldu (karşılaştırmalı bir azaltma faktörü bu " +
      "oturumda sayısal olarak kaynaklanamadı, iyimser bir varsayım yapmaktan kaçınıldı). " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "PRESSURE_SAFETY_VALVE",
      zones: [
        {
          id: "psv.nozzle_seat_disc",
          descriptionTr: "Nozul-oturak-disk bölgesi — kısa süreli tahliye olayında veya \"simmering\"/kısmi kalkışta yüksek hız/iki-fazlı akış",
          defaultSeverityWeight: 0.6,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 10, multiplier: 5 },
          ],
        },
        {
          id: "psv.downstream_outlet_elbow",
          descriptionTr: "Tahliye çıkışı dirseği/hattı — yüksek hızlı tahliye akımının değiştirdiği yön",
          defaultSeverityWeight: 0.4,
          partialOpeningMultiplierCurve: [
            { openingPercent: 100, multiplier: 1 },
            { openingPercent: 10, multiplier: 3 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "UNVERIFIED",
    notes:
      "Emniyet vanaları normal serviste modüle edilmez (ya tam kapalı ya tam kalkış); \"openingPercent\" " +
      "burada kaba bir \"kalkış/set basıncı üstü oran\" yaklaşımıdır. Kısmi kalkış (\"simmering\"/\"chatter\") " +
      "durumunun nozul/disk aşınmasını hızlandırdığı API 520/526 çevresinde iyi bilinen bir konudur ama bu " +
      "oturumda sayısal bir kaynakla doğrulanmadı. " + EROSION_ZONE_CAVEAT,
  },
  {
    profile: {
      componentType: "RESTRICTION_ORIFICE",
      zones: [
        {
          id: "ro.bore_edge",
          descriptionTr: "Orifis plakası delik kenarı — akış kesitinin en dar noktası, en yüksek hız",
          defaultSeverityWeight: 0.8,
          partialOpeningMultiplierCurve: [
            { openingPercent: 0, multiplier: 1 },
            { openingPercent: 100, multiplier: 1 },
          ],
        },
        {
          id: "ro.immediate_downstream_wall",
          descriptionTr: "Plakadan hemen sonraki boru cidarı — daralma sonrası jetin çarpma (impingement) bölgesi",
          defaultSeverityWeight: 0.9,
          partialOpeningMultiplierCurve: [
            { openingPercent: 0, multiplier: 1 },
            { openingPercent: 100, multiplier: 1 },
          ],
        },
      ],
    },
    source: SRC_DNV_O501,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "LOW",
    notes:
      "Kısıcı orifis, geometrik olarak DNV-RP-O501 §8.6'nın \"flow reducer/contraction\" modelinin (Şekil " +
      "8-2 \"Area of erosion\") TAM OLARAK tarif ettiği bileşendir — bu iki bölgenin KONUMU (delik kenarı, " +
      "hemen sonraki cidar) doğrudan bu şekle dayanır, bu yüzden confidence diğer UNVERIFIED girdilerden " +
      "farklı olarak LOW'a çıkarıldı. Ancak defaultSeverityWeight sayıları ve orifis SABİT geometrili " +
      "olduğundan \"partialOpeningMultiplierCurve\" burada anlamsızdır (düz çizgi olarak bırakıldı) — " +
      "gerçek şiddet, akış HIZINA bağlıdır, bu da ayrı bir erozyon oranı hesap modülünün (erosion/dnvO501.ts, " +
      "henüz implemente edilmedi) kapsamındadır. " + EROSION_ZONE_CAVEAT,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Doğrulama + dışa aktarım
// ─────────────────────────────────────────────────────────────────────────

export const VALVE_HYDRAULIC_PROFILES: ValveHydraulicProfile[] = HYDRAULIC_DEFINITIONS.map((def) =>
  ValveHydraulicProfileSchema.parse(def.profile),
);

export const VALVE_EROSION_PROFILES: ValveErosionProfile[] = EROSION_DEFINITIONS.map((def) =>
  ValveErosionProfileSchema.parse(def.profile),
);

export function getValveHydraulicProfile(componentType: ComponentType): ValveHydraulicProfile {
  const profile = VALVE_HYDRAULIC_PROFILES.find((p) => p.componentType === componentType);
  if (!profile) {
    throw new Error(`"${componentType}" için hidrolik profil bulunamadı.`);
  }
  return profile;
}

export function getValveErosionProfile(componentType: ComponentType): ValveErosionProfile {
  const profile = VALVE_EROSION_PROFILES.find((p) => p.componentType === componentType);
  if (!profile) {
    throw new Error(`"${componentType}" için erozyon bölge profili bulunamadı.`);
  }
  return profile;
}

// ─────────────────────────────────────────────────────────────────────────
// KDP kayıt defteri entegrasyonu
// ─────────────────────────────────────────────────────────────────────────

for (const def of HYDRAULIC_DEFINITIONS) {
  const coefficient: Coefficient<ValveHydraulicProfile> = {
    id: `data.valveCatalog.hydraulics.${def.profile.componentType}`,
    module: "valveCatalog",
    value: def.profile,
    unit: "-",
    description: `${def.profile.displayNameTr} — tipik hidrolik boyutlandırma katsayıları (FL, xT, FD, Cv/d², Cd/Kd)`,
    source: def.source,
    crossChecked: def.crossChecked,
    crossCheckSources: def.crossCheckSources,
    confidence: def.confidence,
    notes: def.notes,
  };
  registerCoefficient(coefficient as Coefficient);
}

for (const def of EROSION_DEFINITIONS) {
  const coefficient: Coefficient<ValveErosionProfile> = {
    id: `data.valveCatalog.erosionZones.${def.profile.componentType}`,
    module: "valveCatalog",
    value: def.profile,
    unit: "-",
    description: `${def.profile.componentType} — erozyon riski kritik bölgeleri (ağırlık + kısmi açıklık çarpan eğrisi)`,
    source: def.source,
    crossChecked: def.crossChecked,
    crossCheckSources: def.crossCheckSources,
    confidence: def.confidence,
    notes: def.notes,
  };
  registerCoefficient(coefficient as Coefficient);
}

// packages/engine/src/registry/coefficients/h2s.ts
//
// H2S (ekşi/sour) servis — ISO 15156-2:2003(E) (=NACE MR0175 Bölüm 2) SSC
// (sulfide stress cracking) çevresel şiddet bölgeleri (Region 0-3), karbon/
// düşük alaşımlı çelik sertlik sınırı, ve CO2/H2S oranına göre baskın
// korozyon rejimi (Pots ve ark. sınıflandırması).

import type { Coefficient, Source } from "../types";

const MODULE = "h2s";

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_ISO15156_2: Source = {
  type: "STANDARD",
  citation:
    "NACE MR0175/ISO 15156-2:2003(E), \"Petroleum and natural gas industries — Materials for use in H2S-" +
    "containing environments in oil and gas production — Part 2: Cracking-resistant carbon and low alloy " +
    "steels, and the use of cast irons\" — §7.1.1/7.1.2 (Region 0 eşiği, pH2S<0,3 kPa), §7.2.1.2/Şekil 1 " +
    "(\"SSC Regions of environmental severity\", X=H2S kısmi basıncı kPa log ölçek, Y=in situ pH), §7.3 ve " +
    "Tablo 3 (sertlik sınırı, 250 HV / 22 HRC / 237 HBW). Bu oturumda dosyanın tam metninden (pdftotext) VE " +
    "Şekil 1'in kendisinden (250dpi sayfa görüntüsü, sayfa 30) DOĞRUDAN okundu.",
  url: "https://www.octalsteel.com/wp-content/uploads/2017/10/NACE-MR0175-ISO15156-specification.pdf",
  accessedDate: "2026-08-12",
};

const SRC_POTS_CO2_H2S_RATIO: Source = {
  type: "JOURNAL",
  citation:
    "Pots ve ark.'nın CO2/H2S kısmi basınç oranı sınıflandırması (Pcо2/Pн2ѕ>500: sweet/CO2-baskın; 20-500: " +
    "sweet-sour geçiş; <20: sour/H2S-baskın) — bu oturumda orijinal Pots makalesine doğrudan erişilmedi, " +
    "birden fazla bağımsız ikincil/akademik kaynak (MDPI Sustainability 2024 \"Addressing Hydrogen Sulfide " +
    "Corrosion...\", ScienceDirect \"Key parameters affecting sweet and sour corrosion\" derleme makalesi) " +
    "AYNI 500/20 sınır değerlerini Pots ve ark.'a atfen bağımsız olarak yayımlıyor.",
  accessedDate: "2026-08-12",
};

// ─────────────────────────────────────────────────────────────────────────
// Region 0 eşiği + sertlik sınırı
// ─────────────────────────────────────────────────────────────────────────

const REGION_0_THRESHOLD_KPA: Coefficient<number> = {
  id: "h2s.region0ThresholdKpa",
  module: MODULE,
  value: 0.3,
  unit: "kPa",
  description:
    "H2S kısmi basıncı bu değerin ALTINDAysa Region 0 kabul edilir (normalde özel SSC önlemi gerekmez) — " +
    "ISO 15156-2 §7.1.1/§7.2.1.3.",
  source: SRC_ISO15156_2,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Standardın kendi metninden birebir okundu (\"0,3 kPa (0,05 psi)\"), tahmin/hesaplama içermez.",
};

const HARDNESS_LIMIT_HRC: Coefficient<{ hrc: number; hv: number; hbw: number }> = {
  id: "h2s.hardnessLimit.csLowAlloySteel",
  module: MODULE,
  value: { hrc: 22, hv: 250, hbw: 237 },
  unit: "-",
  description:
    "Karbon/düşük alaşımlı çelik için SSC direnci amacıyla azami sertlik sınırı (temel metal, kaynak " +
    "metali VE ITAB/HAZ dahil) — ISO 15156-2 Tablo 3 / §7.3.",
  source: SRC_ISO15156_2,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın kendi metninden birebir okundu (\"250 HV... 22 HRC\", satır 1774/1805). Bu sınır Region 0 " +
    "DIŞINDAKİ (yani Region 1/2/3) tüm sour servis için geçerlidir — Region 0'da normalde uygulanmaz.",
};

// ─────────────────────────────────────────────────────────────────────────
// SSC Region 0-3 sınır eğrileri — ISO 15156-2 Şekil 1'in DİJİTİZASYONU
// ─────────────────────────────────────────────────────────────────────────

export interface SscRegionBoundaryCurves {
  /** Region 0/1 sınırı: (pH2sKpa, pH) iki uç nokta — aralarında log(pH2S) ekseninde DOĞRUSAL */
  boundary01: { startKpa: number; startPh: number; endKpa: number; endPh: number };
  /** Region 1/2 sınırı */
  boundary12: { startKpa: number; startPh: number; endKpa: number; endPh: number };
  /** Bu pH2S değerinin ÜZERİNDE (ve pH, ilgili sınırın altında), Region 3 zorunlu kabul edilir */
  region3ThresholdKpa: number;
}

const REGION_BOUNDARY_CURVES: Coefficient<SscRegionBoundaryCurves> = {
  id: "h2s.sscRegionBoundaryCurves",
  module: MODULE,
  value: {
    boundary01: { startKpa: 0.3, startPh: 3.5, endKpa: 100, endPh: 6.5 },
    boundary12: { startKpa: 1, startPh: 3.5, endKpa: 100, endPh: 5.5 },
    region3ThresholdKpa: 100,
  },
  unit: "-",
  description:
    "ISO 15156-2 Şekil 1'in ('SSC Regions of environmental severity', X=H2S kısmi basıncı kPa [log], " +
    "Y=in situ pH [doğrusal]) DÖRT köşe/uç noktasının dijitizasyonu — standardın kendisi bir DENKLEM değil " +
    "GRAFİK verir, bu yüzden köşe koordinatları eksen ızgara çizgileriyle (0,1/0,3/1/10/100/1000 kPa; " +
    "2,5/3,5/4,5/5,5/6,5 pH) hizalanarak okundu.",
  source: SRC_ISO15156_2,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "confidence=HIGH çünkü Şekil 1 doğrudan standardın kendi sayfa görüntüsünden (250dpi) okundu (bkz. " +
    "SRC_ISO15156_2), ANCAK bu bir GRAFİK DİJİTİZASYONUDUR — el ile piksel/ızgara hizalamasına dayanır, " +
    "orijinal standardın kendi sayısal bir denklemi/tablosu YOKTUR (yalnızca çizim). ÖNEMLİ YORUMLAMA NOTU: " +
    "standardın metni (§7.2.1.3) Region 0'ı KESİN OLARAK YALNIZCA pH2S<0,3kPa (pH'DAN BAĞIMSIZ) olarak " +
    "tanımlar — bu yüzden boundary01 (sol diyagonal, (0,3kPa,pH3,5)→(100kPa,pH6,5)) corrosion/h2s.ts::" +
    "determineSscRegion() içinde BİR SINIFLANDIRMA SINIRI OLARAK KULLANILMAZ (yalnızca Şekil 1'in kendi " +
    "çiziminin dijitizasyonu olarak, belgeleme amaçlı burada tutulur) — pH2S≥0,3kPa için sınıflandırma " +
    "YALNIZCA boundary12 (sağ diyagonal, 1/2 sınırı, (1kPa,pH3,5)→(100kPa,pH5,5)) ve region3ThresholdKpa " +
    "(100kPa dikey sınır, 2/3 arası) kullanılarak yapılır: pH2S<1kPa veya pH≥boundary12(pH2S) → Region 1; " +
    "aksi halde (ve pH2S<100kPa) → Region 2; pH2S≥100kPa ise pH>5,5 → Region 1 (yatay tavan), pH≤5,5 → " +
    "Region 3 (standardın NOT 1'i, >1MPa/150psi üzerinde 'belirsizlik' olduğunu, dolayısıyla en şiddetli " +
    "bölgenin varsayıldığını destekler). Kritik/sınır durumlarda bir korozyon mühendisi tarafından " +
    "standardın kendi orijinal Şekil 1'iyle TEYİT EDİLMELİDİR.",
};

// ─────────────────────────────────────────────────────────────────────────
// CO2/H2S oranı — baskın korozyon rejimi (FeS film davranışı)
// ─────────────────────────────────────────────────────────────────────────

const CO2_H2S_RATIO_THRESHOLDS: Coefficient<{ sweetDominantAboveRatio: number; sourDominantBelowRatio: number }> = {
  id: "h2s.co2H2sRatioThresholds",
  module: MODULE,
  value: { sweetDominantAboveRatio: 500, sourDominantBelowRatio: 20 },
  unit: "-",
  description:
    "PCO2/PH2S (kısmi basınç oranı) sınıflandırması: oran>500 → CO2-baskın ('sweet', ince/koruyucu olmayan " +
    "FeCO3 filmi, de Waard-tipi model geçerli), 20-500 → geçiş (karışık FeCO3/FeS film, artan belirsizlik), " +
    "oran<20 → H2S-baskın ('sour', FeS/makinawit film oluşumu baskın — bu film KORUYUCU olabilir AMA yeterli " +
    "H2S mevcut değilse veya akış/türbülans filmi bozarsa LOKALİZE çukurlaşmayı da teşvik edebilir).",
  source: SRC_POTS_CO2_H2S_RATIO,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "JOURNAL",
      citation:
        "MDPI Sustainability, \"Addressing Hydrogen Sulfide Corrosion in Oil and Gas Industries: A " +
        "Sustainable Perspective\" (2024) — aynı 500/20 sınırlarını Pots ve ark.'a atfen bağımsız olarak " +
        "raporluyor.",
      url: "https://www.mdpi.com/2071-1050/16/4/1661",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İKİ bağımsız ikincil/akademik kaynak AYNI sınırları (500/20) veriyor, ancak ikisi de aynı orijinal " +
    "kaynağa (Pots ve ark.) atıfta bulunuyor ve orijinal makalenin kendisi bu oturumda DOĞRUDAN OKUNMADI — " +
    "bu yüzden HIGH değil MEDIUM. Ayrıca bir kaynak, bu 500 sınırının \"yüksek sıcaklıkta muhtemelen daha " +
    "az geçerli\" olduğunu da NOT ediyor — bu proje bu uyarıyı validityWarning olarak taşımaz (sıcaklık " +
    "düzeltmesi için sayısal bir kaynak bulunamadı) ama burada belgelenir.",
};

export const H2S_COEFFICIENTS: Coefficient[] = [
  REGION_0_THRESHOLD_KPA,
  HARDNESS_LIMIT_HRC as Coefficient,
  REGION_BOUNDARY_CURVES as Coefficient,
  CO2_H2S_RATIO_THRESHOLDS as Coefficient,
];

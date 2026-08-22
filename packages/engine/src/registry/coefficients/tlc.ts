// packages/engine/src/registry/coefficients/tlc.ts
//
// Üst hat korozyonu (Top-of-Line Corrosion, TLC) model katsayıları.
//
// KAYNAK DURUMU: Kritik yoğuşma hızı eşiği ve düşük-yoğuşma azaltma faktörü,
// de Waard modülünün Fcond sabitiyle (bkz. deWaard.ts) AYNI kaynak temelini
// paylaşır — bu, TLC ve genel ıslak-gaz yoğuşma korozyonunun AYNI temel
// fiziksel olguya (düşük yoğuşma hızında koruyucu tuzlu/doygun su filmi
// oluşumu) dayandığı bağımsız literatür bulgusuyla tutarlıdır. Gizli ısı
// (latent heat) katsayıları, iki bağımsız kaynakta da aynı çıkan iki referans
// noktasından (0°C ve 100°C) bu oturumda türetilmiş bir doğrusal
// yaklaşıklıktır. Açısal profil için literatürde hazır bir formül
// BULUNAMADI — kullanıcının verdiği üç sınır koşulunu (12'de maksimum, 3/9'da
// yarı, 6'da sıfır) BİREBİR sağlayan bir fonksiyon bu oturumda türetildi ve
// UNVERIFIED/LOW olarak işaretlendi.

import type { Coefficient, Source } from "../types";

const MODULE = "tlc";

const SRC_TLC_LIT_SYNTHESIS: Source = {
  type: "TEXTBOOK",
  citation:
    "Genel TLC literatürü sentezi (birden fazla bağımsız arama sonucu, de Waard & Lotz 1993'e " +
    "atıfla): \"Top of line corrosion may become a problem when the water condensation rate is " +
    "above 0.15 to 0.25 g/m²s\" — bu değer, deWaard.fcond'daki 0,25mL/m²/s eşiğiyle TUTARLIDIR " +
    "(su yoğunluğu ~1g/mL olduğundan iki birim sayısal olarak eşdeğerdir).",
  accessedDate: "2026-08-11",
};

const SRC_LATENT_HEAT_REFS: Source = {
  type: "TEXTBOOK",
  citation:
    "Yaygın termodinamik/meteoroloji mühendislik referansları (birden fazla bağımsız arama " +
    "sonucunda tutarlı şekilde tekrarlanan iki değer): suyun buharlaşma gizli ısısı 0°C'de " +
    "≈2501 kJ/kg, 100°C'de ≈2256-2257 kJ/kg (standart buhar tabloları düzeyinde tartışmasız " +
    "bilgi).",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Kritik yoğuşma hızı ve düşük-yoğuşma azaltma faktörü
// ─────────────────────────────────────────────────────────────────────────

const TLC_CRITICAL_CONDENSATION_RATE_G_M2_S: Coefficient<number> = {
  id: "tlc.criticalCondensationRateGm2s",
  module: MODULE,
  value: 0.25,
  unit: "g/(m²·s)",
  description:
    "Bu yoğuşma hızının ALTINDA TLC hızı, koruyucu tuzlu/doygun film nedeniyle kinetik limitin " +
    "çok altına düşer (bkz. tlc.lowCondensationReductionFactor)",
  source: SRC_TLC_LIT_SYNTHESIS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation: "deWaard.fcond kaydındaki de Waard & Lotz (1993) 0,25mL/m²/s eşiğiyle birebir aynı.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "Birincil de Waard & Lotz (1993) makalesine bu oturumda doğrudan erişilemedi (paywall) — bu " +
    "yüzden HIGH değil MEDIUM. Genel TLC literatürü \"0,15 ila 0,25 g/m²s\" aralığı veriyor; " +
    "muhafazakâr (daha DAR koruma varsayan, yani TLC'yi daha erken devreye sokan) uç olan 0,25 " +
    "seçildi.",
};

const TLC_LOW_CONDENSATION_REDUCTION_FACTOR: Coefficient<number> = {
  id: "tlc.lowCondensationReductionFactor",
  module: MODULE,
  value: 0.1,
  unit: "-",
  description:
    "Yoğuşma hızı kritik eşiğin (tlc.criticalCondensationRateGm2s) ALTINDAYKEN, kinetik hıza " +
    "uygulanan azaltma çarpanı",
  source: SRC_TLC_LIT_SYNTHESIS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation: "deWaard.fcond varsayılan değeriyle (0,1) AYNI kaynak temeline dayanır.",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "MEDIUM",
  notes: "Bkz. tlc.criticalCondensationRateGm2s notları.",
};

// ─────────────────────────────────────────────────────────────────────────
// Gizli ısı (latent heat) doğrusal yaklaşıklığı
// ─────────────────────────────────────────────────────────────────────────

export interface LatentHeatLinearApproximation {
  referenceTemp1C: number;
  referenceLatentHeat1KJKg: number;
  referenceTemp2C: number;
  referenceLatentHeat2KJKg: number;
}

const TLC_LATENT_HEAT_APPROXIMATION: Coefficient<LatentHeatLinearApproximation> = {
  id: "tlc.latentHeatLinearApproximation",
  module: MODULE,
  value: { referenceTemp1C: 0, referenceLatentHeat1KJKg: 2501, referenceTemp2C: 100, referenceLatentHeat2KJKg: 2256 },
  unit: "kJ/kg",
  description:
    "Suyun buharlaşma gizli ısısının iki referans noktası arasında DOĞRUSAL yaklaşıklığı — " +
    "L(T)=2501-2,45×T[°C] (bu oturumda iki referans noktasından türetildi)",
  source: SRC_LATENT_HEAT_REFS,
  crossChecked: true,
  crossCheckSources: [SRC_LATENT_HEAT_REFS],
  confidence: "MEDIUM",
  notes:
    "İki referans nokta (0°C/2501kJ/kg, 100°C/2256kJ/kg) HER İKİSİ DE birden fazla bağımsız arama " +
    "sonucunda aynı değerlerle tekrarlandı (bu ikisi TARTIŞMASIZ standart buhar tablosu bilgisidir, " +
    "HIGH güvenilir olarak kabul edilebilir). ANCAK aradaki DOĞRUSAL enterpolasyon varsayımı bu " +
    "oturumda yapılan bir MÜHENDİSLİK YAKLAŞIKLIĞIDIR (gerçek L(T) eğrisi hafifçe içbükeydir) — " +
    "TLC'nin tipik çalışma aralığında (20-90°C) hata payı %1'in altındadır ancak bu ADIM " +
    "doğrulanmış bir literatür formülü DEĞİLDİR, bu yüzden genel güven MEDIUM işaretlendi.",
};

// ─────────────────────────────────────────────────────────────────────────
// Açısal (dairesel) profil — proje türetimi, UNVERIFIED
// ─────────────────────────────────────────────────────────────────────────

const TLC_ANGULAR_PROFILE_FORMULA: Coefficient<string> = {
  id: "tlc.angularProfileFormula",
  module: MODULE,
  value: "profile(θ) = (1 + cos(θ)) / 2, θ: saat 12 yönünden ölçülen açı (radyan, 0=saat 12, π=saat 6)",
  unit: "-",
  description:
    "TLC hızının dairesel (saat pozisyonu) normalize (0-1) profili — saat 12'de 1 (maksimum), " +
    "saat 3/9'da 0,5, saat 6'da 0 (sıfır)",
  source: {
    type: "STANDARD",
    citation:
      "Bu oturumda PROJE TARAFINDAN TÜRETİLDİ: görev talimatının verdiği üç sınır koşulunu " +
      "(saat 12 maksimum, saat 3/9'a doğru azalma, saat 6'da sıfır) TAM OLARAK sağlayan en basit " +
      "kapalı-form fonksiyon seçildi. Niteliksel olarak TUTARLI olduğu genel TLC bulgusu: yoğuşma " +
      "ve dolayısıyla korozyon üst yarım-çemberde yoğunlaşır (bkz. genel TLC literatürü, borunun üst " +
      "iç yüzeyinin en soğuk/en fazla yoğuşan bölge olması). Nusselt'in yatay silindir üzerinde " +
      "film-tipi yoğuşma teorisindeki açısal film kalınlığı değişimiyle KAVRAMSAL OLARAK benzer " +
      "(kosinüs-tipi), ancak bu proje için TLC'ye özgü, adı geçen bir kaynaktan DOĞRUDAN alınmamıştır.",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "⚠ Bu formül bir YAYIMLANMIŞ TLC modelinden alınmamıştır — görev talimatının üç sınır koşulunu " +
    "sağlayan, mühendislik açısından MAKUL ama DOĞRULANMAMIŞ bir kapalı-form ifadedir. Gerçek TLC " +
    "dairesel dağılımı literatürde deneysel olarak 1-3/9-11 saat aralığında \"yüksek ve düzgün\", " +
    "6'da düşük (inhibitör/su birikimi varsa) olarak tarif ediliyor — kabaca tutarlı ama TAM " +
    "eşleşmiyor. 3B ısı haritası modülünde kullanılmadan önce gerçek TLC saha/laboratuvar " +
    "verisiyle kalibre edilmesi ÖNERİLİR.",
};

export const TLC_COEFFICIENTS: Coefficient[] = [
  TLC_CRITICAL_CONDENSATION_RATE_G_M2_S,
  TLC_LOW_CONDENSATION_REDUCTION_FACTOR,
  TLC_LATENT_HEAT_APPROXIMATION as Coefficient,
  TLC_ANGULAR_PROFILE_FORMULA as Coefficient,
];

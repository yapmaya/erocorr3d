// packages/engine/src/registry/coefficients/oxygen.ts
//
// Çözünmüş oksijen korozyonu — risk bantları (ppb). NOT: bu mekanizma için
// bulunan HİÇBİR kaynak (bu proje kapsamında data/mechanisms.ts::OXYGEN
// girdisi dahil, API RP 571 §4.3.5 zaten okundu) sayısal bir "tipik mm/yıl"
// hızı vermiyor — yalnızca eşik/bant düzeyinde pratik kontrol limitleri
// bulunabildi (kazan besisuyu/kondensat bağlamından, ANALOJİ yoluyla).

import type { Coefficient, Source } from "../types";

const MODULE = "oxygen";

const SRC_VEOLIA_HANDBOOK: Source = {
  type: "TEXTBOOK",
  citation:
    "Veolia Water Technologies, \"Water Handbook — Chapter 10: Boiler Feedwater Deaeration\" — mekanik " +
    "deaerasyonun çözünmüş oksijeni tipik olarak 7 ppb (0,007 mg/L) veya altına indirdiğini, yüksek basınçlı " +
    "kazanlar için 5 ppb altının gerektiğini belirtiyor.",
  url: "https://www.watertechnologies.com/handbook/chapter-10-boiler-feedwater-deaeration",
  accessedDate: "2026-08-12",
};

const SRC_O2_HIGH_CONCENTRATION_DAMAGE: Source = {
  type: "JOURNAL",
  citation:
    "Çözünmüş oksijenin karbon çeliği üzerindeki etkisini inceleyen akademik/endüstriyel kaynaklar " +
    "(ResearchGate üzerinden bulunan \"Effect of Dissolved Oxygen on Carbon Steel Corrosion and Particulate " +
    "Formation\" makalesi ve ilişkili endüstri özetleri), 500 ppb üzerinde \"ciddi lokalize korozyon\" " +
    "gözlendiğini bildiriyor.",
  accessedDate: "2026-08-12",
};

const RISK_BANDS_PPB: Coefficient<{ lowMaxPpb: number; moderateMaxPpb: number; highMaxPpb: number }> = {
  id: "oxygen.riskBandsPpb",
  module: MODULE,
  value: { lowMaxPpb: 10, moderateMaxPpb: 100, highMaxPpb: 500 },
  unit: "ppb",
  description:
    "Çözünmüş oksijen konsantrasyonu risk bantları: <10 ppb DÜŞÜK (tipik deaerasyon hedefinin ~1,5 katı, " +
    "muhafazakâr), 10-100 ppb ORTA, 100-500 ppb YÜKSEK, >500 ppb ÇOK YÜKSEK (bildirilen ciddi lokalize " +
    "korozyon eşiği).",
  source: SRC_VEOLIA_HANDBOOK,
  crossChecked: true,
  crossCheckSources: [SRC_O2_HIGH_CONCENTRATION_DAMAGE],
  confidence: "MEDIUM",
  notes:
    "ÖNEMLİ KAPSAM UYARISI: Veolia kaynağı KAZAN BESİSUYU/kondensat bağlamındadır, üretim/taşıma boru hattı " +
    "bağlamı DEĞİLDİR — temel elektrokimya aynı olsa da bu bantlar ANALOJİ yoluyla taşındı (data/mechanisms.ts " +
    "OXYGEN girdisinin kendisi de aynı gerekçeyle confidence:MEDIUM işaretlenmişti). Ara bantlar (10/100 ppb) " +
    "bu iki uç nokta (7ppb hedef, 500ppb ciddi hasar) arasında bu PROJENİN KENDİ enterpolasyonudur — " +
    "yayımlanmış ayrı bir 10/100 ppb kaynağı YOKTUR.",
};

export const OXYGEN_COEFFICIENTS: Coefficient[] = [RISK_BANDS_PPB as Coefficient];

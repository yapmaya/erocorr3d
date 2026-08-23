// packages/engine/src/registry/coefficients/inspectionPlan.ts
//
// Muayene Planı — API 570 "kalan ömrün yarısı" kuralı ve API 570'in KENDİ
// (Sonuç/Consequence-of-Failure bazlı) Piping Class 1/2/3 sınıflandırmasına
// göre azami kalınlık-ölçümü aralığı (Tablo 6-1). API 570'in birincil
// metni paywall'lı (bu proje daha önce b31g.ts'te AYNI durumla karşılaştı,
// bkz. SRC_B318_JOINT_TEMP_SECONDARY) — bu yüzden burada da yalnızca
// bağımsız İKİNCİL mühendislik referans kaynakları kullanıldı ve
// confidence=MEDIUM atandı (b31g.ts'teki AYNI dürüstlük deseni).
//
// ÖNEMLİ KAVRAM AYRIMI (bu dosyanın İLK taslağındaki bir hatanın DÜZELTİLMİŞ
// hâli — coefficient-auditor ajanının bu oturumda tespit ettiği bir
// karışıklık): API 570'in "Class 1/2/3 piping" sınıflandırması, ASME
// B31.4/B31.8'in NÜFUS YOĞUNLUĞU bazlı "Location Class 1-4"ünden (bkz.
// types/enums.ts::LocationClassEnum, b31g.ts::locationClassDesignFactor)
// TAMAMEN FARKLI bir kavramdır — API 570 (tesis-içi proses borusu kodu)
// sınıfını AKIŞKAN TEHLİKESİ/SONUÇ ağırlığına (Consequence of Failure:
// yanıcı/toksik/kritik servis = Class 1 ... düşük riskli yardımcı servis =
// Class 3) göre atar, coğrafi nüfus yoğunluğuna göre DEĞİL. Bu iki "Class N"
// etiketi aynı sayıyı taşısa da AYNI ŞEY DEĞİLDİR — bu dosya SADECE API
// 570'in kendi 3 seviyeli (1/2/3) Consequence-of-Failure sınıfını temsil
// eder (`Api570PipingClass`), `LocationClassEnum`'u KULLANMAZ. Bu projede
// API 570 Class'ı, RBI-lite sonuç skorlamasından (aggregate/riskMatrix.ts::
// ConsequenceLevel) türetilir (bkz. o dosyadaki mapConsequenceLevelToApi570PipingClass) —
// bu TÜRETME kuralının kendisi bu projenin kendi kabulüdür (KDP kapsamı
// dışı), ama BU dosyadaki 5/10/10 yıl SAYILARI ve "Class 1/2/3" ETİKETLERİ
// gerçek (ikincil kaynaklı) API 570 verisidir.
//
// KDP NOTU: RBI-lite risk matrisinin "sonuç" (consequence) ekseni skorlaması,
// muayene aralığının risk-kategorisi çarpanı ve yaşam döngüsü maliyeti
// varsayılanları BU DOSYADA YOKTUR — bunlar yayımlanmış bir standardın
// sabiti DEĞİL, bu projenin kendi raporlama/mühendislik kabulüdür
// (corrosion/types.ts::RISK_LEVEL_THRESHOLDS ile AYNI gerekçeyle, registry
// dışında, ilgili aggregate/*.ts dosyasında açık bir yorumla tutulur —
// registry'ye kaydetmek bunlara sahte bir "dış kaynak" görünümü verirdi).

import type { Coefficient, Source } from "../types";

const MODULE = "inspectionPlan";

const SRC_API570_TABLE_6_1_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "API 570 (Piping Inspection Code) §6 / Tablo 6-1 — kalınlık ölçüm aralığı, hesaplanan kalan ömrün " +
    "yarısını AŞMAYACAK ŞEKİLDE veya Tablo 6-1'in azami aralığında (hangisi KISA ise) planlanır; " +
    "\"Class 1/2/3 piping\" API 570'in KENDİ Consequence-of-Failure (akışkan tehlikesi/kritiklik) bazlı " +
    "sınıflandırmasıdır (Class 1 = yanıcı/toksik/kritik servis, Class 3 = düşük riskli yardımcı servis, ör. " +
    "su/düşük basınçlı buhar) — ASME B31.8 nüfus yoğunluğu \"Location Class\"ıyla KARIŞTIRILMAMALIDIR. " +
    "Birincil standart metni paywall'lı, bu oturumda İKİ bağımsız ikincil mühendislik referans kaynağı " +
    "kullanıldı: reliamag.com \"API 510, 570, and 653 Inspection Intervals\" ve genesisenviro.com " +
    "\"Understanding API 570 Piping Inspections\" — ikisi de Class 1 için azami 5 yıl, Class 2/3 için azami " +
    "10 yıl (veya kalan ömrün yarısı, hangisi kısaysa) değerini BİREBİR veriyor; ayrıca ndttanknicians.com " +
    "\"API 570 Process Piping Inspection: Classes, Methods, CMLs\" Class 1/2/3'ün Consequence-of-Failure " +
    "(personel güvenliği/çevre/mali etki) bazlı tanımını doğruluyor.",
  url: "https://reliamag.com/guides/api-510-570-653-inspection-intervals/",
  accessedDate: "2026-08-23",
};

/** API 570'in KENDİ Consequence-of-Failure bazlı Class 1/2/3 sınıflandırması → Tablo 6-1 azami kalınlık ölçüm aralığı (yıl). */
export interface Api570PipingClassMaxUtIntervalRow {
  api570PipingClass: 1 | 2 | 3;
  maxIntervalYears: number;
  descriptionTr: string;
}

const API570_PIPING_CLASS_MAX_UT_INTERVAL_TABLE: Coefficient<Api570PipingClassMaxUtIntervalRow[]> = {
  id: "inspectionPlan.api570PipingClassMaxUtIntervalYears",
  module: MODULE,
  value: [
    {
      api570PipingClass: 1,
      maxIntervalYears: 5,
      descriptionTr: "Class 1 (yüksek sonuç — yanıcı/toksik/kritik servis) — API 570 Tablo 6-1 azami 5 yıl",
    },
    {
      api570PipingClass: 2,
      maxIntervalYears: 10,
      descriptionTr: "Class 2 (orta sonuç) — API 570 Tablo 6-1 azami 10 yıl",
    },
    {
      api570PipingClass: 3,
      maxIntervalYears: 10,
      descriptionTr: "Class 3 (düşük sonuç — ör. yardımcı su/düşük basınçlı buhar) — API 570 Tablo 6-1 azami 10 yıl",
    },
  ],
  unit: "yıl",
  description: "API 570 Tablo 6-1 — Consequence-of-Failure bazlı Piping Class'a (1-3) göre azami kalınlık ölçüm (UT) aralığı.",
  source: SRC_API570_TABLE_6_1_SECONDARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation: "genesisenviro.com \"Understanding API 570 Piping Inspections\" — Class 1=5 yıl, Class 2/3=10 yıl, reliamag.com ile BİREBİR eşleşti.",
      accessedDate: "2026-08-23",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "Yalnızca ikincil (API 570'i özetleyen) mühendislik referans siteleri kullanıldı, standardın kendisine " +
    "bu oturumda doğrudan erişilemedi (paywall) — iki bağımsız site aynı değerleri verdiği için MEDIUM " +
    "(HIGH değil) güven atandı, b31g.ts::SRC_B318_JOINT_TEMP_SECONDARY ile AYNI gerekçe. Bu dosyanın İLK " +
    "taslağı bu tabloyu YANLIŞLIKLA ASME B31.8 nüfus yoğunluğu Location Class'ına (1-4) anahtarlamıştı — " +
    "coefficient-auditor ajanının bu oturumda tespit ettiği bir karışıklıktı, DÜZELTİLDİ (bkz. dosya başı notu).",
};

const HALF_REMAINING_LIFE_FRACTION: Coefficient<number> = {
  id: "inspectionPlan.halfRemainingLifeFraction",
  module: MODULE,
  value: 0.5,
  unit: "-",
  description: "API 570 \"yarım-ömür kuralı\" — bir sonraki muayene, kalan ömrün yarısından GEÇ olamaz.",
  source: SRC_API570_TABLE_6_1_SECONDARY,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation: "genesisenviro.com, falconinspec.com (\"API 510 remaining life: Half-Life...\") ve wilkinsoncoutts.com — hepsi AYNI 0,5 (yarı ömür) oranını veriyor.",
      accessedDate: "2026-08-23",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "Bu oran (0,5) taranan TÜM ikincil kaynaklarda (5+ bağımsız site) tutarlı biçimde tekrarlanıyor, ama " +
    "birincil API 570 metni bu oturumda doğrudan incelenmediği için MEDIUM (HIGH değil) güven atandı. Bu " +
    "kural Piping Class'tan BAĞIMSIZDIR (her üç sınıfa da aynı şekilde uygulanır).",
};

export const INSPECTION_PLAN_COEFFICIENTS: Coefficient[] = [
  API570_PIPING_CLASS_MAX_UT_INTERVAL_TABLE as Coefficient,
  HALF_REMAINING_LIFE_FRACTION as Coefficient,
];

// packages/engine/src/registry/coefficients/mic.ts
//
// Mikrobiyolojik kaynaklı korozyon (MIC) — organizma hayatta kalma
// penceresi (sıcaklık/pH). API RP 571 §4.3.8'den (data/mechanisms.ts::MIC
// girdisinin AYNI kaynağı — bu dosyada sadece SAYISAL/yapılandırılmış forma
// getirildi, mechanisms.ts'teki triggerConditionsTr serbest metindir).

import type { Coefficient, Source } from "../types";

const MODULE = "mic";

const SRC_API571: Source = {
  type: "STANDARD",
  citation:
    "API Recommended Practice 571, \"Damage Mechanisms Affecting Fixed Equipment in the Refining and " +
    "Petrochemical Industries\", 1. baskı (Nisan 2011), §4.3.8 \"Microbiologically Induced Corrosion " +
    "(MIC)\" — \"Organisms can survive at pH range of 0 to 12 and temperatures of 10°F (–17°C) to 235°F " +
    "(113°C)\". Bu proje daha önce (data/mechanisms.ts::MIC) bu belgenin tam metnini doğrudan okumuştu; bu " +
    "dosyada AYNI kaynaktan sayısal pencere değerleri yapılandırılmış (structured) forma getirildi.",
  url: "https://usercontent.one/wp/www.ing-hti.no/wp-content/uploads/2023/08/API-RP-571-Damage-Mechanisms-Affecting-Refining-Industry_april-2011.pdf",
  accessedDate: "2026-08-11",
};

const SURVIVAL_WINDOW: Coefficient<{ minTempC: number; maxTempC: number; minPh: number; maxPh: number }> = {
  id: "mic.organismSurvivalWindow",
  module: MODULE,
  value: { minTempC: -17, maxTempC: 113, minPh: 0, maxPh: 12 },
  unit: "-",
  description: "MIC organizmalarının hayatta kalabildiği sıcaklık (°C) ve pH aralığı.",
  source: SRC_API571,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "API 571 §4.3.8'den DOĞRUDAN okundu (\"10°F to 235°F\" = -17°C ile 113°C, birebir dönüştürüldü). Bu " +
    "geniş bir HAYATTA KALMA penceresidir — organizmaların AKTİF/hızlı büyüme gösterdiği optimum aralık " +
    "(tipik olarak mezofilik SRB için ~20-40°C) çok daha dardır ama bu oturumda ayrı bir sayısal kaynak " +
    "bulunamadı; bu proje kabulüyle assessMicRisk() sıcaklık faktörünü bu geniş pencerenin İÇİNDE olup " +
    "olmadığına göre (kaba bir kapı/gate) değerlendirir, optimum aralığa göre DEĞİL.",
};

export const MIC_COEFFICIENTS: Coefficient[] = [SURVIVAL_WINDOW as Coefficient];

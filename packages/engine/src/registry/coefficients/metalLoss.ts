// packages/engine/src/registry/coefficients/metalLoss.ts
//
// Toplam metal kaybı (SLC — Service Life Corrosion) hesabı: senaryo başına
// kısmi-çalışma düzeltmesi (bkz. corrosion/rules.ts::applyPartialOperationFactor
// — burada TEKRAR EDİLMEZ) + tasarım ömrü çarpanı. BİREBİR bir iç proje
// dokümanından (kullanıcının kendi dokümanı) doğrudan okundu.
//
// KDP NOTU: bu dokümanın kimliği izlenebilirlik amacıyla bu kod tabanında
// paylaşılmıyor — bu yüzden dış kaynakla çapraz doğrulanamıyor ve
// confidence=UNVERIFIED işaretlidir (bkz. aşağıdaki notes).

import type { Coefficient, Source } from "../types";

const MODULE = "metalLoss";

const SRC_ANONYMIZED_PROJECT_DOC: Source = {
  type: "PROJECT_DOCUMENT",
  citation: "Kullanıcının kendi iç proje dokümanı — dış kaynakla çapraz doğrulanmamış, izlenebilirlik amacıyla kimliği paylaşılmıyor.",
  accessedDate: "2026-08-12",
};

const SLC_FORMULA: Coefficient<string> = {
  id: "metalLoss.slcFormula",
  module: MODULE,
  value: "SLC [mm] = (işletme günü/365) × tasarım ömrü [yıl] × korozyon hızı [mm/yıl]",
  unit: "-",
  description: "Servis ömrü boyunca beklenen toplam metal kaybı (SLC) hesap formülü — tek bir senaryo için.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Bu formül, bu projenin kendi bağımsız kuralı olan corrosion/rules.ts::applyPartialOperationFactor " +
    "(işletme günü/365 çarpanı) ile AYNIDIR — o kural KENDİ BAŞINA bu koddan bağımsız olarak geçerlidir. " +
    "Ancak formülün kaynağı gösterilen iç proje dokümanının kimliği izlenebilirlik amacıyla anonim " +
    "tutulduğundan dış kaynakla çapraz doğrulanamadı — kullanılmadan önce bağımsız bir kaynakla veya " +
    "yetkin bir mühendisle doğrulanmalıdır.",
};

export const METAL_LOSS_COEFFICIENTS: Coefficient[] = [SLC_FORMULA as Coefficient];

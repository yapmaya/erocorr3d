// packages/engine/src/registry/coefficients/ctlAtl.ts
//
// CTL/ATL oranı (Corroded Total Loss / Allowance Total Loss — "korozyon
// olasılığı" göstergesi) kategori sınırları — kullanıcının kendi iç proje
// dokümanının bir tablosundan BİREBİR okundu.
//
// KDP NOTU: bu dokümanın kimliği (kurum, doküman no, revizyon) izlenebilirlik
// amacıyla bu kod tabanında paylaşılmıyor — bu yüzden dış kaynakla çapraz
// doğrulanamıyor ve confidence=UNVERIFIED işaretlidir (bkz. aşağıdaki notes).

import type { Coefficient, Source } from "../types";

const MODULE = "ctlAtl";

const SRC_ANONYMIZED_PROJECT_DOC_TABLE104: Source = {
  type: "PROJECT_DOCUMENT",
  citation: "Kullanıcının kendi iç proje dokümanı — dış kaynakla çapraz doğrulanmamış, izlenebilirlik amacıyla kimliği paylaşılmıyor.",
  accessedDate: "2026-08-12",
};

export interface CtlAtlCategoryThresholds {
  negligibleMax: number;
  lowMax: number;
  mediumMax: number;
}

const CATEGORY_THRESHOLDS: Coefficient<CtlAtlCategoryThresholds> = {
  id: "ctlAtl.categoryThresholds",
  module: MODULE,
  value: { negligibleMax: 0.5, lowMax: 1.0, mediumMax: 4.0 },
  unit: "-",
  description: "CTL/ATL oranı kategori sınırları — kullanıcının kendi iç proje dokümanının bir tablosundan.",
  source: SRC_ANONYMIZED_PROJECT_DOC_TABLE104,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Kaynak dokümanın kimliği izlenebilirlik amacıyla anonim tutulduğundan dış kaynakla çapraz " +
    "doğrulanamadı — kullanılmadan önce bağımsız bir kaynakla veya yetkin bir mühendisle doğrulanmalıdır.",
};

export const CTL_ATL_COEFFICIENTS: Coefficient[] = [CATEGORY_THRESHOLDS as Coefficient];

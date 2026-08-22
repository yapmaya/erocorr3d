// packages/engine/src/registry/coefficients/ctlAtl.ts
//
// CTL/ATL oranı (Corroded Total Loss / Allowance Total Loss — "korozyon
// olasılığı" göstergesi) kategori sınırları — BOTAŞ F3-500-ME-SPC-PSS-0002
// Tablo 10-4'ten BİREBİR okundu (kullanıcının diskinde bulunan birincil
// proje dokümanı).

import type { Coefficient, Source } from "../types";

const MODULE = "ctlAtl";

const SRC_BOTAS_PSS0002_TABLE104: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "BOTAŞ, \"Corrosion Assessment and Materials Selection Onshore (KMGS&NSP)\", Doküman No: " +
    "F3-500-ME-SPC-PSS-0002, Rev. AE (18.08.2021) — Tablo 10-4 \"Evaluation of the Likelihood of " +
    "Corrosion Categories\": CTL/ATL≤0,5→Negligible (\"System will last longer than required with no " +
    "failures\"), 0,5<r≤1,0→Low (\"System will reach its design life without a failure\"), " +
    "1,0<r≤4,0→Medium (\"System will only reach 25% of its design life before a failure occurs\"), " +
    "r>4,0→High (\"A failure will occur before the system reaches 25% of its design life\"). CTL/ATL'in " +
    "kendisi §Kısaltmalar bölümünde \"the likelihood of corrosion, based on the predicted corrosion " +
    "divided by the proposed corrosion allowance\" olarak tanımlanır. Bu oturumda dosyanın tam metninden " +
    "(pdftotext ile) doğrudan okundu.",
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
  description: "CTL/ATL oranı kategori sınırları — bkz. Tablo 10-4.",
  source: SRC_BOTAS_PSS0002_TABLE104,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Standardın kendi Tablo 10-4'ünden BİREBİR okundu — dört kategori sınırı ve etki açıklamaları da dahil.",
};

export const CTL_ATL_COEFFICIENTS: Coefficient[] = [CATEGORY_THRESHOLDS as Coefficient];

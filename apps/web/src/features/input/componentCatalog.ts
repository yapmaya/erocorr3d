// apps/web/src/features/input/componentCatalog.ts
//
// Adım 1 (Bileşen Seçimi) kart kataloğu: kategori sekmesi + ikon + arama
// anahtar kelimeleri. `ComponentTypeEnum`/`COMPONENT_TYPE_LABELS` üzerine
// ince bir katmandır (bkz. @erocorr3d/engine types/enums.ts) — yeni bir
// bileşen tipi İCAT ETMEZ, yalnızca var olan 27 tipi UI'da gruplar.
//
// RESTRICTION_ORIFICE notu: `data/valveCatalog.ts` bu tipi (hidrolik/erozyon
// bölgesi kataloğu amacıyla) "15 vana tipi" listesine dahil eder, ama
// `orchestrate/assessComponent.ts`'in ÇALIŞMA ZAMANI vana ayrım kümesi bu
// tipi İÇERMEZ (bkz. o dosyanın kendi VALVE_COMPONENT_TYPES kümesi) — yani
// motor bunu FİİLEN bir boru/fitting bileşeni gibi değerlendirir. Bu
// katalog, gerçek çalışma zamanı davranışını (assessComponent.ts) esas
// alır: RESTRICTION_ORIFICE burada PIPE_FITTING kategorisindedir.

import { COMPONENT_TYPE_LABELS, type ComponentType } from "@erocorr3d/engine";
import type { ComponentCategory } from "./schema";

export type ComponentIconKind =
  | "STRAIGHT"
  | "ELBOW"
  | "MITER"
  | "TEE"
  | "REDUCER"
  | "WELDOLET"
  | "WELD"
  | "FLANGE"
  | "ORIFICE"
  | "VALVE_GATE"
  | "VALVE_GLOBE"
  | "VALVE_BALL"
  | "VALVE_BUTTERFLY"
  | "VALVE_CHECK"
  | "VALVE_PLUG"
  | "VALVE_NEEDLE"
  | "VALVE_CHOKE"
  | "VALVE_CONTROL"
  | "VALVE_PSV";

export interface ComponentCatalogEntry {
  componentType: ComponentType;
  category: ComponentCategory;
  labelTr: string;
  groupTr: string;
  iconKind: ComponentIconKind;
  keywordsTr: string[];
}

const COMPONENT_CATALOG_BASE: Omit<ComponentCatalogEntry, "labelTr">[] = [
  // ── Boru & Fitting ──────────────────────────────────────────────────
  { componentType: "STRAIGHT_PIPE", category: "PIPE_FITTING", groupTr: "Düz Boru", iconKind: "STRAIGHT", keywordsTr: ["boru", "hat", "spool"] },
  { componentType: "ELBOW_90", category: "PIPE_FITTING", groupTr: "Dirsek / Bükme", iconKind: "ELBOW", keywordsTr: ["dirsek", "90", "bükme"] },
  { componentType: "ELBOW_45", category: "PIPE_FITTING", groupTr: "Dirsek / Bükme", iconKind: "ELBOW", keywordsTr: ["dirsek", "45", "bükme"] },
  { componentType: "BEND_LONG_RADIUS", category: "PIPE_FITTING", groupTr: "Dirsek / Bükme", iconKind: "ELBOW", keywordsTr: ["bükme", "uzun radyus"] },
  { componentType: "BEND_SHORT_RADIUS", category: "PIPE_FITTING", groupTr: "Dirsek / Bükme", iconKind: "ELBOW", keywordsTr: ["bükme", "kısa radyus"] },
  { componentType: "MITER_BEND", category: "PIPE_FITTING", groupTr: "Dirsek / Bükme", iconKind: "MITER", keywordsTr: ["gönye", "miter", "bükme"] },
  { componentType: "TEE_BLIND", category: "PIPE_FITTING", groupTr: "Te", iconKind: "TEE", keywordsTr: ["te", "kör"] },
  { componentType: "TEE_SWEEPING", category: "PIPE_FITTING", groupTr: "Te", iconKind: "TEE", keywordsTr: ["te", "yumuşak geçiş"] },
  { componentType: "TEE_BRANCH", category: "PIPE_FITTING", groupTr: "Te", iconKind: "TEE", keywordsTr: ["te", "dallanma", "branch"] },
  { componentType: "REDUCER_CONCENTRIC", category: "PIPE_FITTING", groupTr: "Redüksiyon", iconKind: "REDUCER", keywordsTr: ["redüksiyon", "eş merkezli"] },
  { componentType: "REDUCER_ECCENTRIC", category: "PIPE_FITTING", groupTr: "Redüksiyon", iconKind: "REDUCER", keywordsTr: ["redüksiyon", "dış merkezli"] },
  { componentType: "WELDOLET", category: "PIPE_FITTING", groupTr: "Bağlantı", iconKind: "WELDOLET", keywordsTr: ["weldolet", "dallanma"] },
  { componentType: "WELD_JOINT", category: "PIPE_FITTING", groupTr: "Bağlantı", iconKind: "WELD", keywordsTr: ["kaynak", "dikiş", "joint"] },
  { componentType: "FLANGE_WELD_NECK", category: "PIPE_FITTING", groupTr: "Bağlantı", iconKind: "FLANGE", keywordsTr: ["flanş", "flange"] },
  { componentType: "RESTRICTION_ORIFICE", category: "PIPE_FITTING", groupTr: "Kısıcı", iconKind: "ORIFICE", keywordsTr: ["orifis", "kısıcı", "orifice"] },

  // ── Vana ─────────────────────────────────────────────────────────────
  { componentType: "GATE_VALVE", category: "VALVE", groupTr: "Sürgülü / Glob", iconKind: "VALVE_GATE", keywordsTr: ["vana", "sürgülü", "gate"] },
  { componentType: "GLOBE_VALVE", category: "VALVE", groupTr: "Sürgülü / Glob", iconKind: "VALVE_GLOBE", keywordsTr: ["vana", "glob", "globe"] },
  { componentType: "BALL_VALVE_FULL", category: "VALVE", groupTr: "Küresel", iconKind: "VALVE_BALL", keywordsTr: ["vana", "küresel", "ball", "tam geçişli"] },
  { componentType: "BALL_VALVE_REDUCED", category: "VALVE", groupTr: "Küresel", iconKind: "VALVE_BALL", keywordsTr: ["vana", "küresel", "ball", "daraltılmış"] },
  { componentType: "BUTTERFLY_VALVE", category: "VALVE", groupTr: "Kelebek", iconKind: "VALVE_BUTTERFLY", keywordsTr: ["vana", "kelebek", "butterfly"] },
  { componentType: "CHECK_VALVE_SWING", category: "VALVE", groupTr: "Çekvalf", iconKind: "VALVE_CHECK", keywordsTr: ["vana", "çekvalf", "swing"] },
  { componentType: "CHECK_VALVE_LIFT", category: "VALVE", groupTr: "Çekvalf", iconKind: "VALVE_CHECK", keywordsTr: ["vana", "çekvalf", "lift"] },
  { componentType: "CHECK_VALVE_DUAL_PLATE", category: "VALVE", groupTr: "Çekvalf", iconKind: "VALVE_CHECK", keywordsTr: ["vana", "çekvalf", "çift plakalı"] },
  { componentType: "PLUG_VALVE", category: "VALVE", groupTr: "Tapa", iconKind: "VALVE_PLUG", keywordsTr: ["vana", "tapa", "plug"] },
  { componentType: "NEEDLE_VALVE", category: "VALVE", groupTr: "İğne", iconKind: "VALVE_NEEDLE", keywordsTr: ["vana", "iğne", "needle"] },
  { componentType: "CHOKE_VALVE", category: "VALVE", groupTr: "Choke", iconKind: "VALVE_CHOKE", keywordsTr: ["vana", "choke", "kısma"] },
  { componentType: "CONTROL_VALVE_GLOBE", category: "VALVE", groupTr: "Kontrol", iconKind: "VALVE_CONTROL", keywordsTr: ["vana", "kontrol", "control"] },
  { componentType: "CONTROL_VALVE_CAGE", category: "VALVE", groupTr: "Kontrol", iconKind: "VALVE_CONTROL", keywordsTr: ["vana", "kontrol", "kafesli", "cage"] },
  { componentType: "PRESSURE_SAFETY_VALVE", category: "VALVE", groupTr: "Emniyet", iconKind: "VALVE_PSV", keywordsTr: ["vana", "emniyet", "psv", "safety"] },
];

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = COMPONENT_CATALOG_BASE.map((entry) => ({
  ...entry,
  labelTr: COMPONENT_TYPE_LABELS[entry.componentType].tr,
}));

export function filterCatalog(category: ComponentCategory, query: string): ComponentCatalogEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("tr");
  return COMPONENT_CATALOG.filter((entry) => entry.category === category).filter((entry) => {
    if (!normalizedQuery) return true;
    const haystack = [entry.labelTr, entry.groupTr, ...entry.keywordsTr].join(" ").toLocaleLowerCase("tr");
    return haystack.includes(normalizedQuery);
  });
}

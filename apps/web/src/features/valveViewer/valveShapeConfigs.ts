// apps/web/src/features/valveViewer/valveShapeConfigs.ts
//
// GeometryLab.tsx'in mevcut FITTING modundaki `SHAPE_CONFIGS` deseninin
// VANA karşılığı — config-driven, 10 üreticiye özel form YAZMAK yerine tek
// bir tablo. Üç alan (npsIn, pressureClass, openingPercent) TÜM vanalarda
// ORTAK olduğu için ayrı, sabit kontroller olarak render edilir (bkz.
// ValveTab.tsx); `enumField`/`extraFields` yalnızca vana-tipine ÖZGÜ
// parametreleri (wedgeType, trimType, bore, discType, type, cageWindows)
// taşır.

import type { PressureClass } from "@erocorr3d/engine";
import {
  createBallValve,
  createButterflyValve,
  createChokeValve,
  createCheckValve,
  createControlValveCage,
  createGateValve,
  createGlobeValve,
  createNeedleValve,
  createPSV,
  createPlugValve,
  type LodLevel,
  type ValveAssembly,
} from "../../geometry";

export type ValveKind =
  | "GATE"
  | "GLOBE"
  | "BALL"
  | "BUTTERFLY"
  | "CHECK"
  | "CHOKE"
  | "CONTROL_CAGE"
  | "PLUG"
  | "NEEDLE"
  | "PSV";

export interface ValveExtraFieldDef {
  key: string;
  labelTr: string;
  min: number;
  max: number;
  step: number;
}

export interface ValveEnumOption {
  value: string;
  labelTr: string;
}

export interface ValveShapeConfig {
  kind: ValveKind;
  labelTr: string;
  /** openingPercent bu vana için anlamlı bir "operatör ayarı" mı (gate/globe/ball/...) yoksa yalnızca GÖSTERİM kolaylığı mı (check/PSV — bkz. o dosyaların kendi JSDoc'u). */
  openingIsOperatorSetting: boolean;
  openingDefault: number;
  enumField?: { key: string; labelTr: string; options: ValveEnumOption[] };
  extraField?: ValveExtraFieldDef;
  extraDefault?: number;
  build: (npsIn: number, pressureClass: PressureClass, openingPercent: number, enumValue: string | undefined, extraValue: number | undefined, lod: LodLevel) => ValveAssembly;
}

export const NPS_FIELD = { min: 0.5, max: 24, step: 0.5, default: 4 };
export const PRESSURE_CLASS_OPTIONS: PressureClass[] = [150, 300, 600, 900, 1500, 2500];

export const VALVE_SHAPE_CONFIGS: ValveShapeConfig[] = [
  {
    kind: "GATE",
    labelTr: "Sürgülü Vana (Gate)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    enumField: {
      key: "wedgeType",
      labelTr: "Sürgü Tipi",
      options: [
        { value: "SOLID", labelTr: "Tam (Solid)" },
        { value: "FLEXIBLE", labelTr: "Esnek (Flexible)" },
        { value: "SPLIT", labelTr: "Bölünmüş (Split)" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createGateValve({ npsIn, pressureClass, openingPercent, wedgeType: (enumValue as "SOLID" | "FLEXIBLE" | "SPLIT") ?? "SOLID", lod }),
  },
  {
    kind: "GLOBE",
    labelTr: "Glob Vana (Globe)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    enumField: {
      key: "trimType",
      labelTr: "Trim Tipi",
      options: [
        { value: "PLUG", labelTr: "Tapa (Plug)" },
        { value: "NEEDLE", labelTr: "İğne (Needle)" },
        { value: "CAGE", labelTr: "Kafes (Cage)" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createGlobeValve({ npsIn, pressureClass, openingPercent, trimType: (enumValue as "PLUG" | "NEEDLE" | "CAGE") ?? "PLUG", lod }),
  },
  {
    kind: "BALL",
    labelTr: "Küresel Vana (Ball)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    enumField: {
      key: "bore",
      labelTr: "Geçiş",
      options: [
        { value: "FULL", labelTr: "Tam Geçişli (Full Bore)" },
        { value: "REDUCED", labelTr: "Daraltılmış (Reduced Bore)" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createBallValve({ npsIn, pressureClass, openingPercent, bore: (enumValue as "FULL" | "REDUCED") ?? "FULL", lod }),
  },
  {
    kind: "BUTTERFLY",
    labelTr: "Kelebek Vana (Butterfly)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    enumField: {
      key: "discType",
      labelTr: "Disk Tipi",
      options: [
        { value: "CONCENTRIC", labelTr: "Eş Merkezli" },
        { value: "ECCENTRIC", labelTr: "Dış Merkezli" },
        { value: "TRIPLE_OFFSET", labelTr: "Üçlü Ofset" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createButterflyValve({ npsIn, pressureClass, openingPercent, discType: (enumValue as "CONCENTRIC" | "ECCENTRIC" | "TRIPLE_OFFSET") ?? "CONCENTRIC", lod }),
  },
  {
    kind: "CHECK",
    labelTr: "Çekvalf (Check)",
    openingIsOperatorSetting: false,
    openingDefault: 60,
    enumField: {
      key: "type",
      labelTr: "Tip",
      options: [
        { value: "SWING", labelTr: "Çırpma (Swing)" },
        { value: "LIFT", labelTr: "Kaldırmalı (Lift)" },
        { value: "DUAL_PLATE", labelTr: "Çift Plakalı (Dual Plate)" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createCheckValve({ npsIn, pressureClass, type: (enumValue as "SWING" | "LIFT" | "DUAL_PLATE") ?? "SWING", openingPercent, lod }),
  },
  {
    kind: "CHOKE",
    labelTr: "Kısıcı Vana (Choke)",
    openingIsOperatorSetting: true,
    openingDefault: 30,
    enumField: {
      key: "trimType",
      labelTr: "Trim Tipi",
      options: [
        { value: "POSITIVE", labelTr: "Sabit (Positive)" },
        { value: "ADJUSTABLE", labelTr: "Ayarlanabilir" },
        { value: "MULTI_STAGE", labelTr: "Çok Kademeli" },
      ],
    },
    build: (npsIn, pressureClass, openingPercent, enumValue, _extra, lod) =>
      createChokeValve({ npsIn, pressureClass, openingPercent, trimType: (enumValue as "POSITIVE" | "ADJUSTABLE" | "MULTI_STAGE") ?? "ADJUSTABLE", lod }),
  },
  {
    kind: "CONTROL_CAGE",
    labelTr: "Kontrol Vanası (Kafesli Trim)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    extraField: { key: "cageWindows", labelTr: "Kafes Pencere Sayısı", min: 2, max: 8, step: 1 },
    extraDefault: 4,
    build: (npsIn, pressureClass, openingPercent, _enumValue, extraValue, lod) =>
      createControlValveCage({ npsIn, pressureClass, openingPercent, cageWindows: Math.round(extraValue ?? 4), lod }),
  },
  {
    kind: "PLUG",
    labelTr: "Tapa Vana (Plug)",
    openingIsOperatorSetting: true,
    openingDefault: 50,
    build: (npsIn, pressureClass, openingPercent, _enumValue, _extra, lod) => createPlugValve({ npsIn, pressureClass, openingPercent, lod }),
  },
  {
    kind: "NEEDLE",
    labelTr: "İğne Vana (Needle)",
    openingIsOperatorSetting: true,
    openingDefault: 40,
    build: (npsIn, pressureClass, openingPercent, _enumValue, _extra, lod) => createNeedleValve({ npsIn, pressureClass, openingPercent, lod }),
  },
  {
    kind: "PSV",
    labelTr: "Basınç Emniyet Vanası (PSV)",
    openingIsOperatorSetting: false,
    openingDefault: 0,
    build: (npsIn, pressureClass, openingPercent, _enumValue, _extra, lod) => createPSV({ npsIn, pressureClass, openingPercent, lod }),
  },
];

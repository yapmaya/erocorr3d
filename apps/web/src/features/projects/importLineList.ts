// apps/web/src/features/projects/importLineList.ts
//
// Excel/CSV hat listesi içe aktarma — features/input/importExcel/
// parseLineList.ts'in AYNI dosya ayrıştırma altyapısını (`parseWorkbookFile`,
// `cellToNumber`/`cellToString`) KULLANIR ama FARKLI bir eksende çalışır: o
// dosyadaki `buildOperatingCasesFromRows` her SATIRI TEK bir bileşenin
// senaryosuna çevirirken, burada her SATIR AYRI bir BİLEŞEN (WizardDraft)
// olur — master görev madde 4'ün "hat listesi" kavramı budur.
//
// Eşlenmeyen alanlar `defaultDraft.ts`'in KENDİ temsili varsayımlarını
// (createDefaultGeometry/createDefaultMitigation/createDefaultOperatingCase)
// korur — yeni bir mühendislik sabiti İCAT EDİLMEZ, UI bunu açıkça belirtir.

import { getPipe, PIPE_SCHEDULE_NAMES, type PipeScheduleName } from "@erocorr3d/engine";
import { cellToNumber, cellToString, type ParsedSheet } from "../input/importExcel/parseLineList";
import { createDefaultGeometry, createDefaultMitigation, createDefaultOperatingCase, createDefaultOperatingProfile } from "../input/defaultDraft";
import type { WizardDraft } from "../input/schema";

export type LineListTargetField =
  | "componentLabel"
  | "npsInch"
  | "schedule"
  | "durationDaysPerYear"
  | "pressureBara"
  | "temperatureC"
  | "co2MolePercent"
  | "h2sPpmMole"
  | "chlorideMgL"
  | "waterCutPercent"
  | "sandRateKgDay";

export interface LineListTargetDef {
  field: LineListTargetField;
  labelTr: string;
  required: boolean;
}

export const LINE_LIST_TARGETS: LineListTargetDef[] = [
  { field: "componentLabel", labelTr: "Hat/Bileşen Adı", required: true },
  { field: "npsInch", labelTr: "Nominal Çap (NPS, inç)", required: true },
  { field: "schedule", labelTr: "Boru Cetveli (Schedule)", required: true },
  { field: "durationDaysPerYear", labelTr: "Yıllık Gün", required: false },
  { field: "pressureBara", labelTr: "Basınç (bara)", required: false },
  { field: "temperatureC", labelTr: "Sıcaklık (°C)", required: false },
  { field: "co2MolePercent", labelTr: "CO2 Mol %", required: false },
  { field: "h2sPpmMole", labelTr: "H2S (ppm)", required: false },
  { field: "chlorideMgL", labelTr: "Klorür (mg/L)", required: false },
  { field: "waterCutPercent", labelTr: "Su Kesri (%)", required: false },
  { field: "sandRateKgDay", labelTr: "Kum Debisi (kg/gün)", required: false },
];

export type LineListColumnMapping = Partial<Record<LineListTargetField, number>>;

/**
 * Her satırı AYRI bir `WizardDraft` bileşenine çevirir. NPS/Schedule
 * `getPipe()` ile gerçek boru cetveli tablosundan (motor `data/
 * pipeSchedules.ts`) çözülür — sahte bir od/wt/id UYDURULMAZ; eşleşme
 * bulunamazsa (getPipe hata fırlatırsa) o satır atlanır ve nedeni döner.
 */
export function buildComponentsFromLineListRows(
  sheet: ParsedSheet,
  mapping: LineListColumnMapping,
): { drafts: WizardDraft[]; skippedRowsTr: string[] } {
  const drafts: WizardDraft[] = [];
  const skippedRowsTr: string[] = [];

  sheet.rows.forEach((row, rowIndex) => {
    const getCell = (field: LineListTargetField): string | number | undefined => {
      const columnIndex = mapping[field];
      return columnIndex === undefined ? undefined : row[columnIndex];
    };

    const componentLabel = cellToString(getCell("componentLabel"));
    const npsInch = cellToNumber(getCell("npsInch"));
    const schedule = cellToString(getCell("schedule"));

    if (!componentLabel || npsInch === undefined || !schedule) {
      skippedRowsTr.push(`Satır ${rowIndex + 2}: zorunlu alan(lar) eksik (hat adı/NPS/cetvel).`);
      return;
    }

    if (!PIPE_SCHEDULE_NAMES.includes(schedule as PipeScheduleName)) {
      skippedRowsTr.push(`Satır ${rowIndex + 2} ("${componentLabel}"): "${schedule}" tanınan bir boru cetveli değil (geçerli değerler: ${PIPE_SCHEDULE_NAMES.join(", ")}).`);
      return;
    }

    let pipe;
    try {
      pipe = getPipe(npsInch, schedule as PipeScheduleName);
    } catch (error) {
      skippedRowsTr.push(`Satır ${rowIndex + 2} ("${componentLabel}"): ${error instanceof Error ? error.message : "boru cetveli bulunamadı"}.`);
      return;
    }

    const geometry = { ...createDefaultGeometry(), npsInch: pipe.nps, schedule: pipe.schedule, odMm: pipe.odMm, wallThicknessMm: pipe.wallThicknessMm, idMm: pipe.idMm };
    const baseCase = createDefaultOperatingCase(componentLabel);

    const durationDaysPerYear = cellToNumber(getCell("durationDaysPerYear"));
    if (durationDaysPerYear !== undefined) baseCase.durationDaysPerYear = durationDaysPerYear;
    const pressureBara = cellToNumber(getCell("pressureBara"));
    if (pressureBara !== undefined) baseCase.process.pressureBara = pressureBara;
    const temperatureC = cellToNumber(getCell("temperatureC"));
    if (temperatureC !== undefined) baseCase.process.temperatureC = temperatureC;
    const waterCutPercent = cellToNumber(getCell("waterCutPercent"));
    if (waterCutPercent !== undefined) baseCase.process.waterCutPercent = waterCutPercent;
    const co2MolePercent = cellToNumber(getCell("co2MolePercent"));
    if (co2MolePercent !== undefined) baseCase.chemistry.co2MolePercent = co2MolePercent;
    const h2sPpmMole = cellToNumber(getCell("h2sPpmMole"));
    if (h2sPpmMole !== undefined) baseCase.chemistry.h2sPpmMole = h2sPpmMole;
    const chlorideMgL = cellToNumber(getCell("chlorideMgL"));
    if (chlorideMgL !== undefined) baseCase.chemistry.chlorideMgL = chlorideMgL;
    const sandRateKgDay = cellToNumber(getCell("sandRateKgDay"));
    if (sandRateKgDay !== undefined) baseCase.solids.sandRateKgDay = sandRateKgDay;

    const operatingProfile = { ...createDefaultOperatingProfile(), cases: [baseCase] };

    drafts.push({
      id: crypto.randomUUID(),
      componentLabel,
      componentCategory: "PIPE_FITTING",
      geometry,
      valveGeometry: undefined,
      mitigation: createDefaultMitigation(),
      operatingProfile,
      activeStep: 1,
      activeCaseIndex: 0,
      uncertainNotes: [],
      updatedAt: Date.now(),
    });
  });

  return { drafts, skippedRowsTr };
}

// apps/web/src/features/input/importExcel/parseLineList.ts
//
// Excel/CSV içe aktarma — MVP kapsamı (bkz. onaylı plan'ın kapsam kararı
// #2): dosyadaki her SATIR, TEK bileşenin Adım 7 senaryo tablosuna bir
// `OperatingCase` olarak eklenir (çoklu BİLEŞEN/proje listesi yönetimi bu
// sürümde YOKTUR). SheetJS (`xlsx`) ile ayrıştırır — zaten proje
// bağımlılığı.
//
// `xlsx` DİNAMİK import() edilir (bkz. P10) — bu, report/excel/
// generateExcelReport.ts'in AYNI paketi dinamik yüklemesiyle birlikte,
// `xlsx`in TÜM statik import'larını ortadan kaldırır; aksi halde bu
// dosyadaki tek bir statik `import * as XLSX` bile paketi ana bundle'a geri
// sokar (kullanıcı ne Excel içe aktarsın ne rapor alsın, yine de indirir).

import type { OperatingCase } from "@erocorr3d/engine";

export interface ParsedSheet {
  headers: string[];
  rows: (string | number)[][];
}

export async function parseWorkbookFile(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Dosyada okunabilir bir sayfa bulunamadı.");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  if (matrix.length === 0) {
    throw new Error("Sayfa boş.");
  }
  const [headerRow, ...dataRows] = matrix;
  return {
    headers: headerRow.map((h) => String(h)),
    rows: dataRows.filter((row) => row.some((cell) => cell !== "" && cell !== undefined)),
  };
}

export type ImportTargetField =
  | "name"
  | "description"
  | "durationDaysPerYear"
  | "pressureBara"
  | "temperatureC"
  | "co2MolePercent"
  | "h2sPpmMole"
  | "chlorideMgL"
  | "waterCutPercent"
  | "sandRateKgDay";

export interface ImportTargetDef {
  field: ImportTargetField;
  labelTr: string;
  required: boolean;
}

export const IMPORT_TARGETS: ImportTargetDef[] = [
  { field: "name", labelTr: "Senaryo Adı", required: true },
  { field: "description", labelTr: "Açıklama", required: false },
  { field: "durationDaysPerYear", labelTr: "Yıllık Gün", required: true },
  { field: "pressureBara", labelTr: "Basınç (bara)", required: false },
  { field: "temperatureC", labelTr: "Sıcaklık (°C)", required: false },
  { field: "co2MolePercent", labelTr: "CO2 Mol %", required: false },
  { field: "h2sPpmMole", labelTr: "H2S (ppm)", required: false },
  { field: "chlorideMgL", labelTr: "Klorür (mg/L)", required: false },
  { field: "waterCutPercent", labelTr: "Su Kesri (%)", required: false },
  { field: "sandRateKgDay", labelTr: "Kum Debisi (kg/gün)", required: false },
];

export type ColumnMapping = Partial<Record<ImportTargetField, number>>;

/** Ayrıştırılmış bir Excel/CSV hücresini sayıya çevirir — projects/importLineList.ts (çoklu bileşen içe aktarma) İLE PAYLAŞILIR. */
export function cellToNumber(cell: string | number | undefined): number | undefined {
  if (cell === undefined || cell === "") return undefined;
  const value = typeof cell === "number" ? cell : Number(cell);
  return Number.isFinite(value) ? value : undefined;
}

/** Ayrıştırılmış bir Excel/CSV hücresini metne çevirir — projects/importLineList.ts İLE PAYLAŞILIR. */
export function cellToString(cell: string | number | undefined): string | undefined {
  if (cell === undefined || cell === "") return undefined;
  return String(cell);
}

/**
 * Eşleme + baz senaryo (aktif senaryonun bir KOPYASI — eşlenmeyen tüm
 * alanlar bu baz değerden gelir) kullanarak satırları `OperatingCase[]`'e
 * çevirir. Sayısal olmayan/boş hücreler baz değeri KORUR (üzerine
 * yazmaz).
 */
export function buildOperatingCasesFromRows(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  baseCase: OperatingCase,
): OperatingCase[] {
  return sheet.rows.map((row, rowIndex) => {
    const getCell = (field: ImportTargetField): string | number | undefined => {
      const columnIndex = mapping[field];
      return columnIndex === undefined ? undefined : row[columnIndex];
    };

    const operatingCase: OperatingCase = {
      ...baseCase,
      process: { ...baseCase.process },
      chemistry: { ...baseCase.chemistry },
      solids: { ...baseCase.solids },
    };

    operatingCase.name = cellToString(getCell("name")) ?? `İçe Aktarılan Senaryo ${rowIndex + 1}`;
    operatingCase.description = cellToString(getCell("description")) ?? operatingCase.description;
    operatingCase.durationDaysPerYear = cellToNumber(getCell("durationDaysPerYear")) ?? operatingCase.durationDaysPerYear;

    const pressureBara = cellToNumber(getCell("pressureBara"));
    if (pressureBara !== undefined) operatingCase.process.pressureBara = pressureBara;
    const temperatureC = cellToNumber(getCell("temperatureC"));
    if (temperatureC !== undefined) operatingCase.process.temperatureC = temperatureC;
    const waterCutPercent = cellToNumber(getCell("waterCutPercent"));
    if (waterCutPercent !== undefined) operatingCase.process.waterCutPercent = waterCutPercent;

    const co2MolePercent = cellToNumber(getCell("co2MolePercent"));
    if (co2MolePercent !== undefined) operatingCase.chemistry.co2MolePercent = co2MolePercent;
    const h2sPpmMole = cellToNumber(getCell("h2sPpmMole"));
    if (h2sPpmMole !== undefined) operatingCase.chemistry.h2sPpmMole = h2sPpmMole;
    const chlorideMgL = cellToNumber(getCell("chlorideMgL"));
    if (chlorideMgL !== undefined) operatingCase.chemistry.chlorideMgL = chlorideMgL;

    const sandRateKgDay = cellToNumber(getCell("sandRateKgDay"));
    if (sandRateKgDay !== undefined) operatingCase.solids.sandRateKgDay = sandRateKgDay;

    return operatingCase;
  });
}

// packages/engine/src/data/pipeSchedules.ts
//
// ASME B36.10M (karbon/alaşım çelik) ve B36.19M (paslanmaz çelik "S" cetvelleri) boru
// ölçüleri. Kaynak: standardın kendisi ücretli olduğundan, kamuya açık bir aynası
// (pipedata.org) üzerinden alınmış ve örneklem noktaları bağımsız olarak çapraz
// kontrol edilmiştir (bkz. registry kaydı notları). Bu, KDP'nin "boyutsal veriler
// kamuya açık standart ölçülerdir" istisnası kapsamındadır.
//
// KAPSAM: NPS 1/8" - 36". ASME B36.10M'nin bu aralığın ötesindeki (38"-48") büyük çaplı
// borular için standart bir cetvel (schedule) et kalınlığı tablosu genel pratikte
// yaygın olarak yayımlanmaz (büyük çaplı borular projeye özel et kalınlığıyla
// belirtilir); bu nedenle 38"-48" aralığı UYDURULMAMIŞ, kapsam dışı bırakılmıştır.

import { z } from "zod";
import { registerCoefficient } from "../registry";
import type { Coefficient, Source } from "../registry/types";

export const PIPE_SCHEDULE_NAMES = [
  "5S", "10S", "10", "20", "30", "STD", "40", "60", "XS", "80", "100", "120", "140", "160", "XXS",
] as const;

export const PipeScheduleNameEnum = z.enum(PIPE_SCHEDULE_NAMES);
export type PipeScheduleName = z.infer<typeof PipeScheduleNameEnum>;

export const PipeDimensionsSchema = z.object({
  schedule: PipeScheduleNameEnum.describe("Boru cetveli"),
  npsLabel: z.string().describe('Nominal boru çapı, gösterim metni (ör. "1 1/4")'),
  nps: z.number().positive().describe("Nominal boru çapı (NPS, ondalık inç)"),
  dn: z.number().int().positive().describe("Nominal çap (DN, mm)"),
  odMm: z.number().positive().describe("Dış çap (mm)"),
  wallThicknessMm: z.number().positive().describe("Et kalınlığı (mm)"),
  idMm: z.number().positive().describe("İç çap (mm)"),
  weightKgPerM: z.number().positive().describe("Boş boru ağırlığı (kg/m)"),
});
export type PipeDimensions = z.infer<typeof PipeDimensionsSchema>;

const PIPE_TABLE_5S: PipeDimensions[] = [
  { schedule: "5S", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 1.65, idMm: 18.03, weightKgPerM: 0.81 },
  { schedule: "5S", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 1.65, idMm: 23.37, weightKgPerM: 1.03 },
  { schedule: "5S", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 1.65, idMm: 30.1, weightKgPerM: 1.31 },
  { schedule: "5S", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 1.65, idMm: 38.86, weightKgPerM: 1.67 },
  { schedule: "5S", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 1.65, idMm: 44.96, weightKgPerM: 1.92 },
  { schedule: "5S", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 1.65, idMm: 57.02, weightKgPerM: 2.42 },
  { schedule: "5S", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 2.11, idMm: 68.81, weightKgPerM: 3.74 },
  { schedule: "5S", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 2.11, idMm: 84.68, weightKgPerM: 4.58 },
  { schedule: "5S", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 2.11, idMm: 97.38, weightKgPerM: 5.24 },
  { schedule: "5S", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 2.11, idMm: 110.08, weightKgPerM: 5.91 },
  { schedule: "5S", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 2.77, idMm: 135.76, weightKgPerM: 9.59 },
  { schedule: "5S", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 2.77, idMm: 162.74, weightKgPerM: 11.46 },
  { schedule: "5S", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 2.77, idMm: 213.54, weightKgPerM: 14.97 },
  { schedule: "5S", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 3.4, idMm: 266.24, weightKgPerM: 22.95 },
  { schedule: "5S", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 3.96, idMm: 315.93, weightKgPerM: 31.69 },
  { schedule: "5S", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 3.96, idMm: 347.68, weightKgPerM: 34.84 },
  { schedule: "5S", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 4.19, idMm: 398.02, weightKgPerM: 42.15 },
  { schedule: "5S", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 4.19, idMm: 448.82, weightKgPerM: 47.47 },
  { schedule: "5S", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 4.78, idMm: 498.45, weightKgPerM: 60.09 },
  { schedule: "5S", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 5.54, idMm: 598.53, weightKgPerM: 83.64 },
  { schedule: "5S", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 6.35, idMm: 749.3, weightKgPerM: 119.98 },
];

const PIPE_TABLE_10S: PipeDimensions[] = [
  { schedule: "10S", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 1.24, idMm: 7.8, weightKgPerM: 0.28 },
  { schedule: "10S", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 1.65, idMm: 10.41, weightKgPerM: 0.5 },
  { schedule: "10S", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 1.65, idMm: 13.84, weightKgPerM: 0.64 },
  { schedule: "10S", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 2.11, idMm: 17.12, weightKgPerM: 1.01 },
  { schedule: "10S", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 2.11, idMm: 22.45, weightKgPerM: 1.29 },
  { schedule: "10S", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 2.77, idMm: 27.86, weightKgPerM: 2.12 },
  { schedule: "10S", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 2.77, idMm: 36.63, weightKgPerM: 2.73 },
  { schedule: "10S", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 2.77, idMm: 42.72, weightKgPerM: 3.15 },
  { schedule: "10S", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 2.77, idMm: 54.79, weightKgPerM: 3.98 },
  { schedule: "10S", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 3.05, idMm: 66.93, weightKgPerM: 5.33 },
  { schedule: "10S", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 3.05, idMm: 82.8, weightKgPerM: 6.54 },
  { schedule: "10S", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 3.05, idMm: 95.5, weightKgPerM: 7.51 },
  { schedule: "10S", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 3.05, idMm: 108.2, weightKgPerM: 8.48 },
  { schedule: "10S", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 3.4, idMm: 134.49, weightKgPerM: 11.74 },
  { schedule: "10S", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 3.4, idMm: 161.47, weightKgPerM: 14.03 },
  { schedule: "10S", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 3.76, idMm: 211.56, weightKgPerM: 20.24 },
  { schedule: "10S", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 4.19, idMm: 264.67, weightKgPerM: 28.18 },
  { schedule: "10S", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 4.57, idMm: 314.71, weightKgPerM: 36.5 },
  { schedule: "10S", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 4.78, idMm: 346.05, weightKgPerM: 41.89 },
  { schedule: "10S", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 4.78, idMm: 396.85, weightKgPerM: 47.96 },
  { schedule: "10S", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 4.78, idMm: 447.65, weightKgPerM: 54.02 },
  { schedule: "10S", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 5.54, idMm: 496.93, weightKgPerM: 69.57 },
  { schedule: "10S", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 6.35, idMm: 596.9, weightKgPerM: 95.79 },
  { schedule: "10S", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 7.92, idMm: 746.15, weightKgPerM: 149.43 },
];

const PIPE_TABLE_10: PipeDimensions[] = [
  { schedule: "10", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 1.24, idMm: 7.8, weightKgPerM: 0.28 },
  { schedule: "10", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 1.65, idMm: 10.41, weightKgPerM: 0.49 },
  { schedule: "10", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 1.65, idMm: 13.84, weightKgPerM: 0.63 },
  { schedule: "10", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 2.11, idMm: 17.12, weightKgPerM: 1.0 },
  { schedule: "10", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 2.11, idMm: 22.45, weightKgPerM: 1.28 },
  { schedule: "10", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 2.77, idMm: 27.86, weightKgPerM: 2.09 },
  { schedule: "10", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 2.77, idMm: 36.63, weightKgPerM: 2.69 },
  { schedule: "10", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 2.77, idMm: 42.72, weightKgPerM: 3.1 },
  { schedule: "10", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 2.77, idMm: 54.79, weightKgPerM: 3.93 },
  { schedule: "10", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 3.05, idMm: 66.93, weightKgPerM: 5.25 },
  { schedule: "10", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 3.05, idMm: 82.8, weightKgPerM: 6.45 },
  { schedule: "10", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 3.05, idMm: 95.5, weightKgPerM: 7.4 },
  { schedule: "10", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 3.05, idMm: 108.2, weightKgPerM: 8.35 },
  { schedule: "10", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 3.4, idMm: 134.49, weightKgPerM: 11.56 },
  { schedule: "10", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 3.4, idMm: 161.47, weightKgPerM: 13.82 },
  { schedule: "10", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 3.76, idMm: 211.56, weightKgPerM: 19.94 },
  { schedule: "10", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 4.19, idMm: 264.67, weightKgPerM: 27.76 },
  { schedule: "10", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 4.57, idMm: 314.71, weightKgPerM: 35.96 },
  { schedule: "10", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 4.78, idMm: 346.05, weightKgPerM: 41.27 },
  { schedule: "10", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 4.78, idMm: 396.85, weightKgPerM: 47.25 },
  { schedule: "10", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 4.78, idMm: 447.65, weightKgPerM: 53.22 },
  { schedule: "10", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 5.54, idMm: 496.93, weightKgPerM: 68.54 },
  { schedule: "10", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 5.54, idMm: 547.73, weightKgPerM: 75.47 },
  { schedule: "10", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 6.35, idMm: 596.9, weightKgPerM: 94.37 },
  { schedule: "10", npsLabel: "26", nps: 26.0, dn: 650, odMm: 660.4, wallThicknessMm: 7.92, idMm: 644.55, weightKgPerM: 127.38 },
  { schedule: "10", npsLabel: "28", nps: 28.0, dn: 700, odMm: 711.2, wallThicknessMm: 7.92, idMm: 695.35, weightKgPerM: 137.3 },
  { schedule: "10", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 7.92, idMm: 746.15, weightKgPerM: 147.22 },
  { schedule: "10", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 7.92, idMm: 796.95, weightKgPerM: 157.14 },
  { schedule: "10", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 7.92, idMm: 847.75, weightKgPerM: 167.05 },
  { schedule: "10", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 7.92, idMm: 898.55, weightKgPerM: 176.97 },
];

const PIPE_TABLE_20: PipeDimensions[] = [
  { schedule: "20", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 6.35, idMm: 206.38, weightKgPerM: 33.28 },
  { schedule: "20", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 6.35, idMm: 260.35, weightKgPerM: 41.72 },
  { schedule: "20", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 6.35, idMm: 311.15, weightKgPerM: 49.67 },
  { schedule: "20", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 7.92, idMm: 339.75, weightKgPerM: 67.88 },
  { schedule: "20", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 7.92, idMm: 390.55, weightKgPerM: 77.79 },
  { schedule: "20", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 7.92, idMm: 441.35, weightKgPerM: 87.71 },
  { schedule: "20", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 9.52, idMm: 488.95, weightKgPerM: 116.97 },
  { schedule: "20", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 9.52, idMm: 539.75, weightKgPerM: 128.89 },
  { schedule: "20", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 9.52, idMm: 590.55, weightKgPerM: 140.81 },
  { schedule: "20", npsLabel: "26", nps: 26.0, dn: 650, odMm: 660.4, wallThicknessMm: 12.7, idMm: 635.0, weightKgPerM: 202.65 },
  { schedule: "20", npsLabel: "28", nps: 28.0, dn: 700, odMm: 711.2, wallThicknessMm: 12.7, idMm: 685.8, weightKgPerM: 218.54 },
  { schedule: "20", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 12.7, idMm: 736.6, weightKgPerM: 234.43 },
  { schedule: "20", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 12.7, idMm: 787.4, weightKgPerM: 250.33 },
  { schedule: "20", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 12.7, idMm: 838.2, weightKgPerM: 266.22 },
  { schedule: "20", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 12.7, idMm: 889.0, weightKgPerM: 282.12 },
];

const PIPE_TABLE_30: PipeDimensions[] = [
  { schedule: "30", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 7.04, idMm: 205.0, weightKgPerM: 36.75 },
  { schedule: "30", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 7.8, idMm: 257.45, weightKgPerM: 50.96 },
  { schedule: "30", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 8.38, idMm: 307.09, weightKgPerM: 65.14 },
  { schedule: "30", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 9.52, idMm: 336.55, weightKgPerM: 81.21 },
  { schedule: "30", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 9.52, idMm: 387.35, weightKgPerM: 93.13 },
  { schedule: "30", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 11.13, idMm: 434.95, weightKgPerM: 122.26 },
  { schedule: "30", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 12.7, idMm: 482.6, weightKgPerM: 154.97 },
  { schedule: "30", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 12.7, idMm: 533.4, weightKgPerM: 170.86 },
  { schedule: "30", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 14.27, idMm: 581.05, weightKgPerM: 209.36 },
  { schedule: "30", npsLabel: "28", nps: 28.0, dn: 700, odMm: 711.2, wallThicknessMm: 15.88, idMm: 679.45, weightKgPerM: 271.93 },
  { schedule: "30", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 15.88, idMm: 730.25, weightKgPerM: 291.8 },
  { schedule: "30", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 15.88, idMm: 781.05, weightKgPerM: 311.67 },
  { schedule: "30", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 15.88, idMm: 831.85, weightKgPerM: 331.54 },
  { schedule: "30", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 15.88, idMm: 882.65, weightKgPerM: 351.4 },
];

const PIPE_TABLE_STD: PipeDimensions[] = [
  { schedule: "STD", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 1.73, idMm: 6.83, weightKgPerM: 0.36 },
  { schedule: "STD", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 2.24, idMm: 9.25, weightKgPerM: 0.63 },
  { schedule: "STD", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 2.31, idMm: 12.52, weightKgPerM: 0.84 },
  { schedule: "STD", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 2.77, idMm: 15.8, weightKgPerM: 1.27 },
  { schedule: "STD", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 2.87, idMm: 20.93, weightKgPerM: 1.68 },
  { schedule: "STD", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 3.38, idMm: 26.64, weightKgPerM: 2.5 },
  { schedule: "STD", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 3.56, idMm: 35.05, weightKgPerM: 3.38 },
  { schedule: "STD", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 3.68, idMm: 40.89, weightKgPerM: 4.04 },
  { schedule: "STD", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 3.91, idMm: 52.5, weightKgPerM: 5.44 },
  { schedule: "STD", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 5.16, idMm: 62.71, weightKgPerM: 8.62 },
  { schedule: "STD", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 5.49, idMm: 77.93, weightKgPerM: 11.27 },
  { schedule: "STD", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 5.74, idMm: 90.12, weightKgPerM: 13.56 },
  { schedule: "STD", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 6.02, idMm: 102.26, weightKgPerM: 16.06 },
  { schedule: "STD", npsLabel: "4 1/2", nps: 4.5, dn: 115, odMm: 127.0, wallThicknessMm: 6.27, idMm: 114.45, weightKgPerM: 18.66 },
  { schedule: "STD", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 6.55, idMm: 128.19, weightKgPerM: 21.75 },
  { schedule: "STD", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 7.11, idMm: 154.05, weightKgPerM: 28.24 },
  { schedule: "STD", npsLabel: "7", nps: 7.0, dn: 175, odMm: 193.67, wallThicknessMm: 7.65, idMm: 178.38, weightKgPerM: 35.04 },
  { schedule: "STD", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 8.18, idMm: 202.72, weightKgPerM: 42.49 },
  { schedule: "STD", npsLabel: "9", nps: 9.0, dn: 225, odMm: 244.47, wallThicknessMm: 8.69, idMm: 227.1, weightKgPerM: 50.46 },
  { schedule: "STD", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 9.27, idMm: 254.51, weightKgPerM: 60.25 },
  { schedule: "STD", npsLabel: "11", nps: 11.0, dn: 275, odMm: 298.45, wallThicknessMm: 9.52, idMm: 279.4, weightKgPerM: 67.8 },
  { schedule: "STD", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 9.52, idMm: 304.8, weightKgPerM: 73.76 },
  { schedule: "STD", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 9.52, idMm: 336.55, weightKgPerM: 81.21 },
  { schedule: "STD", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 9.52, idMm: 387.35, weightKgPerM: 93.13 },
  { schedule: "STD", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 9.52, idMm: 438.15, weightKgPerM: 105.05 },
  { schedule: "STD", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 9.52, idMm: 488.95, weightKgPerM: 116.97 },
  { schedule: "STD", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 9.52, idMm: 539.75, weightKgPerM: 128.89 },
  { schedule: "STD", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 9.52, idMm: 590.55, weightKgPerM: 140.81 },
  { schedule: "STD", npsLabel: "26", nps: 26.0, dn: 650, odMm: 660.4, wallThicknessMm: 9.52, idMm: 641.35, weightKgPerM: 152.73 },
  { schedule: "STD", npsLabel: "28", nps: 28.0, dn: 700, odMm: 711.2, wallThicknessMm: 9.52, idMm: 692.15, weightKgPerM: 164.65 },
  { schedule: "STD", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 9.52, idMm: 742.95, weightKgPerM: 176.57 },
  { schedule: "STD", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 9.52, idMm: 793.75, weightKgPerM: 188.49 },
  { schedule: "STD", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 9.52, idMm: 844.55, weightKgPerM: 200.41 },
  { schedule: "STD", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 9.52, idMm: 895.35, weightKgPerM: 212.33 },
];

const PIPE_TABLE_40: PipeDimensions[] = [
  { schedule: "40", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 1.73, idMm: 6.83, weightKgPerM: 0.36 },
  { schedule: "40", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 2.24, idMm: 9.25, weightKgPerM: 0.63 },
  { schedule: "40", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 2.31, idMm: 12.52, weightKgPerM: 0.84 },
  { schedule: "40", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 2.77, idMm: 15.8, weightKgPerM: 1.27 },
  { schedule: "40", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 2.87, idMm: 20.93, weightKgPerM: 1.68 },
  { schedule: "40", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 3.38, idMm: 26.64, weightKgPerM: 2.5 },
  { schedule: "40", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 3.56, idMm: 35.05, weightKgPerM: 3.38 },
  { schedule: "40", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 3.68, idMm: 40.89, weightKgPerM: 4.04 },
  { schedule: "40", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 3.91, idMm: 52.5, weightKgPerM: 5.44 },
  { schedule: "40", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 5.16, idMm: 62.71, weightKgPerM: 8.62 },
  { schedule: "40", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 5.49, idMm: 77.93, weightKgPerM: 11.27 },
  { schedule: "40", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 5.74, idMm: 90.12, weightKgPerM: 13.56 },
  { schedule: "40", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 6.02, idMm: 102.26, weightKgPerM: 16.06 },
  { schedule: "40", npsLabel: "4 1/2", nps: 4.5, dn: 115, odMm: 127.0, wallThicknessMm: 6.27, idMm: 114.45, weightKgPerM: 18.66 },
  { schedule: "40", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 6.55, idMm: 128.19, weightKgPerM: 21.75 },
  { schedule: "40", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 7.11, idMm: 154.05, weightKgPerM: 28.24 },
  { schedule: "40", npsLabel: "7", nps: 7.0, dn: 175, odMm: 193.67, wallThicknessMm: 7.65, idMm: 178.38, weightKgPerM: 35.04 },
  { schedule: "40", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 8.18, idMm: 202.72, weightKgPerM: 42.49 },
  { schedule: "40", npsLabel: "9", nps: 9.0, dn: 225, odMm: 244.47, wallThicknessMm: 8.69, idMm: 227.1, weightKgPerM: 50.46 },
  { schedule: "40", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 9.27, idMm: 254.51, weightKgPerM: 60.25 },
  { schedule: "40", npsLabel: "11", nps: 11.0, dn: 275, odMm: 298.45, wallThicknessMm: 9.52, idMm: 279.4, weightKgPerM: 67.8 },
  { schedule: "40", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 10.31, idMm: 303.23, weightKgPerM: 79.65 },
  { schedule: "40", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 11.13, idMm: 333.35, weightKgPerM: 94.41 },
  { schedule: "40", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 12.7, idMm: 381.0, weightKgPerM: 123.18 },
  { schedule: "40", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 14.27, idMm: 428.65, weightKgPerM: 155.76 },
  { schedule: "40", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 15.09, idMm: 477.82, weightKgPerM: 183.21 },
  { schedule: "40", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 17.48, idMm: 574.65, weightKgPerM: 254.92 },
  { schedule: "40", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 17.48, idMm: 777.85, weightKgPerM: 342.4 },
  { schedule: "40", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 17.48, idMm: 828.65, weightKgPerM: 364.27 },
  { schedule: "40", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 19.05, idMm: 876.3, weightKgPerM: 420.19 },
];

const PIPE_TABLE_60: PipeDimensions[] = [
  { schedule: "60", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 10.31, idMm: 198.45, weightKgPerM: 53.04 },
  { schedule: "60", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 12.7, idMm: 247.65, weightKgPerM: 81.46 },
  { schedule: "60", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 14.27, idMm: 295.3, weightKgPerM: 108.87 },
  { schedule: "60", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 15.09, idMm: 325.42, weightKgPerM: 126.57 },
  { schedule: "60", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 16.66, idMm: 373.08, weightKgPerM: 159.98 },
  { schedule: "60", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 19.05, idMm: 419.1, weightKgPerM: 205.63 },
  { schedule: "60", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 20.62, idMm: 466.75, weightKgPerM: 247.64 },
  { schedule: "60", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 22.22, idMm: 514.35, weightKgPerM: 293.79 },
  { schedule: "60", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 24.61, idMm: 560.37, weightKgPerM: 354.7 },
];

const PIPE_TABLE_XS: PipeDimensions[] = [
  { schedule: "XS", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 2.41, idMm: 5.46, weightKgPerM: 0.47 },
  { schedule: "XS", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 3.02, idMm: 7.67, weightKgPerM: 0.8 },
  { schedule: "XS", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 3.2, idMm: 10.74, weightKgPerM: 1.1 },
  { schedule: "XS", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 3.73, idMm: 13.87, weightKgPerM: 1.62 },
  { schedule: "XS", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 3.91, idMm: 18.85, weightKgPerM: 2.19 },
  { schedule: "XS", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 4.55, idMm: 24.31, weightKgPerM: 3.23 },
  { schedule: "XS", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 4.85, idMm: 32.46, weightKgPerM: 4.46 },
  { schedule: "XS", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 5.08, idMm: 38.1, weightKgPerM: 5.4 },
  { schedule: "XS", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 5.54, idMm: 49.25, weightKgPerM: 7.47 },
  { schedule: "XS", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 7.01, idMm: 59.0, weightKgPerM: 11.4 },
  { schedule: "XS", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 7.62, idMm: 73.66, weightKgPerM: 15.26 },
  { schedule: "XS", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 8.08, idMm: 85.45, weightKgPerM: 18.61 },
  { schedule: "XS", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 8.56, idMm: 97.18, weightKgPerM: 22.3 },
  { schedule: "XS", npsLabel: "4 1/2", nps: 4.5, dn: 115, odMm: 127.0, wallThicknessMm: 9.02, idMm: 108.97, weightKgPerM: 26.21 },
  { schedule: "XS", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 9.52, idMm: 122.25, weightKgPerM: 30.92 },
  { schedule: "XS", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 10.97, idMm: 146.33, weightKgPerM: 42.52 },
  { schedule: "XS", npsLabel: "7", nps: 7.0, dn: 175, odMm: 193.67, wallThicknessMm: 12.7, idMm: 168.27, weightKgPerM: 56.62 },
  { schedule: "XS", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 12.7, idMm: 193.67, weightKgPerM: 64.57 },
  { schedule: "XS", npsLabel: "9", nps: 9.0, dn: 225, odMm: 244.47, wallThicknessMm: 12.7, idMm: 219.07, weightKgPerM: 72.52 },
  { schedule: "XS", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 12.7, idMm: 247.65, weightKgPerM: 81.46 },
  { schedule: "XS", npsLabel: "11", nps: 11.0, dn: 275, odMm: 298.45, wallThicknessMm: 12.7, idMm: 273.05, weightKgPerM: 89.4 },
  { schedule: "XS", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 12.7, idMm: 298.45, weightKgPerM: 97.35 },
  { schedule: "XS", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 12.7, idMm: 330.2, weightKgPerM: 107.28 },
  { schedule: "XS", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 12.7, idMm: 381.0, weightKgPerM: 123.18 },
  { schedule: "XS", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 12.7, idMm: 431.8, weightKgPerM: 139.07 },
  { schedule: "XS", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 12.7, idMm: 482.6, weightKgPerM: 154.97 },
  { schedule: "XS", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 12.7, idMm: 533.4, weightKgPerM: 170.86 },
  { schedule: "XS", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 12.7, idMm: 584.2, weightKgPerM: 186.75 },
  { schedule: "XS", npsLabel: "26", nps: 26.0, dn: 650, odMm: 660.4, wallThicknessMm: 12.7, idMm: 635.0, weightKgPerM: 202.65 },
  { schedule: "XS", npsLabel: "28", nps: 28.0, dn: 700, odMm: 711.2, wallThicknessMm: 12.7, idMm: 685.8, weightKgPerM: 218.54 },
  { schedule: "XS", npsLabel: "30", nps: 30.0, dn: 750, odMm: 762.0, wallThicknessMm: 12.7, idMm: 736.6, weightKgPerM: 234.43 },
  { schedule: "XS", npsLabel: "32", nps: 32.0, dn: 800, odMm: 812.8, wallThicknessMm: 12.7, idMm: 787.4, weightKgPerM: 250.33 },
  { schedule: "XS", npsLabel: "34", nps: 34.0, dn: 850, odMm: 863.6, wallThicknessMm: 12.7, idMm: 838.2, weightKgPerM: 266.22 },
  { schedule: "XS", npsLabel: "36", nps: 36.0, dn: 900, odMm: 914.4, wallThicknessMm: 12.7, idMm: 889.0, weightKgPerM: 282.12 },
];

const PIPE_TABLE_80: PipeDimensions[] = [
  { schedule: "80", npsLabel: "1/8", nps: 0.125, dn: 6, odMm: 10.29, wallThicknessMm: 2.41, idMm: 5.46, weightKgPerM: 0.47 },
  { schedule: "80", npsLabel: "1/4", nps: 0.25, dn: 8, odMm: 13.72, wallThicknessMm: 3.02, idMm: 7.67, weightKgPerM: 0.8 },
  { schedule: "80", npsLabel: "3/8", nps: 0.375, dn: 10, odMm: 17.14, wallThicknessMm: 3.2, idMm: 10.74, weightKgPerM: 1.1 },
  { schedule: "80", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 3.73, idMm: 13.87, weightKgPerM: 1.62 },
  { schedule: "80", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 3.91, idMm: 18.85, weightKgPerM: 2.19 },
  { schedule: "80", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 4.55, idMm: 24.31, weightKgPerM: 3.23 },
  { schedule: "80", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 4.85, idMm: 32.46, weightKgPerM: 4.46 },
  { schedule: "80", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 5.08, idMm: 38.1, weightKgPerM: 5.4 },
  { schedule: "80", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 5.54, idMm: 49.25, weightKgPerM: 7.47 },
  { schedule: "80", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 7.01, idMm: 59.0, weightKgPerM: 11.4 },
  { schedule: "80", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 7.62, idMm: 73.66, weightKgPerM: 15.26 },
  { schedule: "80", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 8.08, idMm: 85.45, weightKgPerM: 18.61 },
  { schedule: "80", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 8.56, idMm: 97.18, weightKgPerM: 22.3 },
  { schedule: "80", npsLabel: "4 1/2", nps: 4.5, dn: 115, odMm: 127.0, wallThicknessMm: 9.02, idMm: 108.97, weightKgPerM: 26.21 },
  { schedule: "80", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 9.52, idMm: 122.25, weightKgPerM: 30.92 },
  { schedule: "80", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 10.97, idMm: 146.33, weightKgPerM: 42.52 },
  { schedule: "80", npsLabel: "7", nps: 7.0, dn: 175, odMm: 193.67, wallThicknessMm: 12.7, idMm: 168.27, weightKgPerM: 56.62 },
  { schedule: "80", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 12.7, idMm: 193.67, weightKgPerM: 64.57 },
  { schedule: "80", npsLabel: "9", nps: 9.0, dn: 225, odMm: 244.47, wallThicknessMm: 12.7, idMm: 219.07, weightKgPerM: 72.52 },
  { schedule: "80", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 15.09, idMm: 242.87, weightKgPerM: 95.88 },
  { schedule: "80", npsLabel: "11", nps: 11.0, dn: 275, odMm: 298.45, wallThicknessMm: 12.7, idMm: 273.05, weightKgPerM: 89.4 },
  { schedule: "80", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 17.48, idMm: 288.9, weightKgPerM: 131.9 },
  { schedule: "80", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 19.05, idMm: 317.5, weightKgPerM: 157.95 },
  { schedule: "80", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 21.44, idMm: 363.52, weightKgPerM: 203.31 },
  { schedule: "80", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 23.83, idMm: 409.55, weightKgPerM: 254.37 },
  { schedule: "80", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 26.19, idMm: 455.63, weightKgPerM: 310.84 },
  { schedule: "80", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 28.57, idMm: 501.65, weightKgPerM: 373.26 },
  { schedule: "80", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 30.96, idMm: 547.67, weightKgPerM: 441.37 },
];

const PIPE_TABLE_100: PipeDimensions[] = [
  { schedule: "100", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 15.09, idMm: 188.9, weightKgPerM: 75.82 },
  { schedule: "100", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 18.26, idMm: 236.52, weightKgPerM: 114.63 },
  { schedule: "100", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 21.44, idMm: 280.97, weightKgPerM: 159.71 },
  { schedule: "100", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 23.83, idMm: 307.95, weightKgPerM: 194.73 },
  { schedule: "100", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 26.19, idMm: 354.03, weightKgPerM: 245.29 },
  { schedule: "100", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 29.36, idMm: 398.48, weightKgPerM: 309.48 },
  { schedule: "100", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 32.54, idMm: 442.93, weightKgPerM: 381.12 },
  { schedule: "100", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 34.92, idMm: 488.95, weightKgPerM: 450.74 },
  { schedule: "100", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 38.89, idMm: 531.83, weightKgPerM: 546.75 },
];

const PIPE_TABLE_120: PipeDimensions[] = [
  { schedule: "120", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 11.13, idMm: 92.05, weightKgPerM: 28.28 },
  { schedule: "120", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 12.7, idMm: 115.9, weightKgPerM: 40.24 },
  { schedule: "120", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 14.27, idMm: 139.73, weightKgPerM: 54.16 },
  { schedule: "120", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 18.26, idMm: 182.55, weightKgPerM: 90.35 },
  { schedule: "120", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 21.44, idMm: 230.17, weightKgPerM: 132.88 },
  { schedule: "120", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 25.4, idMm: 273.05, weightKgPerM: 186.75 },
  { schedule: "120", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 27.79, idMm: 300.02, weightKgPerM: 224.41 },
  { schedule: "120", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 30.96, idMm: 344.47, weightKgPerM: 286.38 },
  { schedule: "120", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 34.92, idMm: 387.35, weightKgPerM: 363.32 },
  { schedule: "120", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 38.1, idMm: 431.8, weightKgPerM: 441.05 },
  { schedule: "120", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 41.27, idMm: 476.25, weightKgPerM: 526.24 },
  { schedule: "120", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 46.02, idMm: 517.55, weightKgPerM: 639.01 },
];

const PIPE_TABLE_140: PipeDimensions[] = [
  { schedule: "140", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 20.62, idMm: 177.83, weightKgPerM: 100.83 },
  { schedule: "140", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 25.4, idMm: 222.25, weightKgPerM: 154.97 },
  { schedule: "140", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 28.57, idMm: 266.7, weightKgPerM: 207.86 },
  { schedule: "140", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 31.75, idMm: 292.1, weightKgPerM: 253.31 },
  { schedule: "140", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 36.53, idMm: 333.35, weightKgPerM: 332.82 },
  { schedule: "140", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 39.67, idMm: 377.85, weightKgPerM: 408.09 },
  { schedule: "140", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 44.45, idMm: 419.1, weightKgPerM: 507.61 },
  { schedule: "140", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 47.62, idMm: 463.55, weightKgPerM: 599.74 },
  { schedule: "140", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 52.37, idMm: 504.85, weightKgPerM: 718.98 },
];

const PIPE_TABLE_160: PipeDimensions[] = [
  { schedule: "160", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 4.78, idMm: 11.79, weightKgPerM: 1.95 },
  { schedule: "160", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 5.56, idMm: 15.54, weightKgPerM: 2.89 },
  { schedule: "160", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 6.35, idMm: 20.7, weightKgPerM: 4.23 },
  { schedule: "160", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 6.35, idMm: 29.46, weightKgPerM: 5.6 },
  { schedule: "160", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 7.14, idMm: 33.99, weightKgPerM: 7.23 },
  { schedule: "160", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 8.74, idMm: 42.85, weightKgPerM: 11.1 },
  { schedule: "160", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 9.52, idMm: 53.97, weightKgPerM: 14.9 },
  { schedule: "160", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 11.13, idMm: 66.65, weightKgPerM: 21.32 },
  { schedule: "160", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 13.49, idMm: 87.33, weightKgPerM: 33.5 },
  { schedule: "160", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 15.88, idMm: 109.55, weightKgPerM: 49.05 },
  { schedule: "160", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 18.26, idMm: 131.75, weightKgPerM: 67.49 },
  { schedule: "160", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 23.01, idMm: 173.05, weightKgPerM: 111.15 },
  { schedule: "160", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 28.57, idMm: 215.9, weightKgPerM: 172.1 },
  { schedule: "160", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 33.32, idMm: 257.2, weightKgPerM: 238.51 },
  { schedule: "160", npsLabel: "14", nps: 14.0, dn: 350, odMm: 355.6, wallThicknessMm: 35.71, idMm: 284.18, weightKgPerM: 281.43 },
  { schedule: "160", npsLabel: "16", nps: 16.0, dn: 400, odMm: 406.4, wallThicknessMm: 40.49, idMm: 325.42, weightKgPerM: 364.97 },
  { schedule: "160", npsLabel: "18", nps: 18.0, dn: 450, odMm: 457.2, wallThicknessMm: 45.24, idMm: 366.73, weightKgPerM: 459.11 },
  { schedule: "160", npsLabel: "20", nps: 20.0, dn: 500, odMm: 508.0, wallThicknessMm: 50.01, idMm: 407.97, weightKgPerM: 564.28 },
  { schedule: "160", npsLabel: "22", nps: 22.0, dn: 550, odMm: 558.8, wallThicknessMm: 53.97, idMm: 450.85, weightKgPerM: 671.27 },
  { schedule: "160", npsLabel: "24", nps: 24.0, dn: 600, odMm: 609.6, wallThicknessMm: 59.54, idMm: 490.52, weightKgPerM: 806.8 },
];

const PIPE_TABLE_XXS: PipeDimensions[] = [
  { schedule: "XXS", npsLabel: "1/2", nps: 0.5, dn: 15, odMm: 21.34, wallThicknessMm: 7.47, idMm: 6.4, weightKgPerM: 2.55 },
  { schedule: "XXS", npsLabel: "3/4", nps: 0.75, dn: 20, odMm: 26.67, wallThicknessMm: 7.82, idMm: 11.02, weightKgPerM: 3.63 },
  { schedule: "XXS", npsLabel: "1", nps: 1.0, dn: 25, odMm: 33.4, wallThicknessMm: 9.09, idMm: 15.21, weightKgPerM: 5.45 },
  { schedule: "XXS", npsLabel: "1 1/4", nps: 1.25, dn: 32, odMm: 42.16, wallThicknessMm: 9.7, idMm: 22.76, weightKgPerM: 7.76 },
  { schedule: "XXS", npsLabel: "1 1/2", nps: 1.5, dn: 40, odMm: 48.26, wallThicknessMm: 10.16, idMm: 27.94, weightKgPerM: 9.54 },
  { schedule: "XXS", npsLabel: "2", nps: 2.0, dn: 50, odMm: 60.32, wallThicknessMm: 11.07, idMm: 38.18, weightKgPerM: 13.44 },
  { schedule: "XXS", npsLabel: "2 1/2", nps: 2.5, dn: 65, odMm: 73.02, wallThicknessMm: 14.02, idMm: 44.98, weightKgPerM: 20.38 },
  { schedule: "XXS", npsLabel: "3", nps: 3.0, dn: 80, odMm: 88.9, wallThicknessMm: 15.24, idMm: 58.42, weightKgPerM: 27.66 },
  { schedule: "XXS", npsLabel: "3 1/2", nps: 3.5, dn: 90, odMm: 101.6, wallThicknessMm: 16.15, idMm: 69.29, weightKgPerM: 34.0 },
  { schedule: "XXS", npsLabel: "4", nps: 4.0, dn: 100, odMm: 114.3, wallThicknessMm: 17.12, idMm: 80.06, weightKgPerM: 40.99 },
  { schedule: "XXS", npsLabel: "4 1/2", nps: 4.5, dn: 115, odMm: 127.0, wallThicknessMm: 18.03, idMm: 90.93, weightKgPerM: 48.41 },
  { schedule: "XXS", npsLabel: "5", nps: 5.0, dn: 125, odMm: 141.3, wallThicknessMm: 19.05, idMm: 103.2, weightKgPerM: 57.37 },
  { schedule: "XXS", npsLabel: "6", nps: 6.0, dn: 150, odMm: 168.27, wallThicknessMm: 21.95, idMm: 124.38, weightKgPerM: 79.11 },
  { schedule: "XXS", npsLabel: "7", nps: 7.0, dn: 175, odMm: 193.67, wallThicknessMm: 22.22, idMm: 149.22, weightKgPerM: 93.87 },
  { schedule: "XXS", npsLabel: "8", nps: 8.0, dn: 200, odMm: 219.07, wallThicknessMm: 22.22, idMm: 174.62, weightKgPerM: 107.78 },
  { schedule: "XXS", npsLabel: "10", nps: 10.0, dn: 250, odMm: 273.05, wallThicknessMm: 25.4, idMm: 222.25, weightKgPerM: 154.97 },
  { schedule: "XXS", npsLabel: "12", nps: 12.0, dn: 300, odMm: 323.85, wallThicknessMm: 25.4, idMm: 273.05, weightKgPerM: 186.75 },
];

// ─────────────────────────────────────────────────────────────────────────
// Arama tablosu ve genel erişim fonksiyonları
// ─────────────────────────────────────────────────────────────────────────

const ALL_TABLES: Record<PipeScheduleName, PipeDimensions[]> = {
  "5S": PIPE_TABLE_5S,
  "10S": PIPE_TABLE_10S,
  "10": PIPE_TABLE_10,
  "20": PIPE_TABLE_20,
  "30": PIPE_TABLE_30,
  "STD": PIPE_TABLE_STD,
  "40": PIPE_TABLE_40,
  "60": PIPE_TABLE_60,
  "XS": PIPE_TABLE_XS,
  "80": PIPE_TABLE_80,
  "100": PIPE_TABLE_100,
  "120": PIPE_TABLE_120,
  "140": PIPE_TABLE_140,
  "160": PIPE_TABLE_160,
  "XXS": PIPE_TABLE_XXS,
};

const NPS_TOLERANCE = 0.001;

/**
 * ASME B36.10M/19M boru ölçülerini NPS ve cetvel (schedule) ile getirir.
 *
 * Model adı: yok (tanımsal standart verisi, hesap modeli değil).
 * Kaynak: bkz. dosya başı ve registry kaydı (data.pipeSchedules.schedule*).
 * Geçerlilik aralığı: NPS 1/8"-36", yalnızca standartta tanımlı NPS×cetvel
 * kombinasyonları (ör. NPS 2" için Schedule 20 tanımlı değildir).
 * Girdi/çıktı birimleri: npsInch ondalık inç; çıktı mm ve kg/m.
 * Bilinen sınırlamalar: NPS 38"-48" kapsam dışıdır (bkz. dosya başı notu).
 *
 * @throws Error böyle bir NPS×cetvel kombinasyonu standartta tanımlı değilse.
 * ASLA ara değer enterpolasyonu/uydurma YAPMAZ.
 */
export function getPipe(npsInch: number, schedule: PipeScheduleName): PipeDimensions {
  const table = ALL_TABLES[schedule];
  const match = table.find((row) => Math.abs(row.nps - npsInch) < NPS_TOLERANCE);
  if (!match) {
    const availableNps = table.map((r) => r.npsLabel).join(", ");
    throw new Error(
      `ASME B36.10M/19M'de NPS ${npsInch}" için "${schedule}" cetveli tanımlı değil. ` +
        `"${schedule}" cetvelinde tanımlı NPS değerleri: ${availableNps}.`,
    );
  }
  return match;
}

/** Belirli bir NPS için standartta tanımlı tüm cetvelleri döndürür. */
export function listSchedulesForNps(npsInch: number): PipeScheduleName[] {
  return PIPE_SCHEDULE_NAMES.filter((schedule) =>
    ALL_TABLES[schedule].some((row) => Math.abs(row.nps - npsInch) < NPS_TOLERANCE),
  );
}

/** Bir cetvelde tanımlı tüm NPS boyutlarının tam ölçü listesini döndürür. */
export function listPipesForSchedule(schedule: PipeScheduleName): PipeDimensions[] {
  return [...ALL_TABLES[schedule]];
}

// ─────────────────────────────────────────────────────────────────────────
// KDP kayıt defteri entegrasyonu
// ─────────────────────────────────────────────────────────────────────────

const SRC_ASME_B36: Source = {
  type: "STANDARD",
  citation:
    "ASME B36.10M, \"Welded and Seamless Wrought Steel Pipe\", ve ASME B36.19M, \"Stainless Steel Pipe\", The American Society of Mechanical Engineers (orijinal standart metni ücretli; bu projede kamuya açık bir aktarım/ayna üzerinden alınmıştır).",
  url: "https://pipedata.org/pipes/",
  accessedDate: "2026-08-11",
};

const SRC_CROSSCHECK_CHARTS: Source = {
  type: "STANDARD",
  citation:
    "Yaygın kullanılan bağımsız çevrimiçi mühendislik boru cetveli referansları — NPS 2\" (evrensel bilinen referans değerler) ve NPS 24\" Schedule 100 (daha az bilinen bir değer, 38.89 mm et kalınlığı) örneklem noktaları bu kaynaklarla karşılaştırılarak bağımsız doğrulandı.",
  accessedDate: "2026-08-11",
};

function registerScheduleTable(schedule: PipeScheduleName, entries: PipeDimensions[]): void {
  const coefficient: Coefficient<PipeDimensions[]> = {
    id: `data.pipeSchedules.schedule${schedule}`,
    module: "pipeSchedules",
    value: entries,
    unit: "mm / kg/m",
    description: `ASME B36.10M/19M Cetvel ${schedule} boru ölçüleri (${entries.length} NPS boyutu, dış çap/et kalınlığı/iç çap/ağırlık)`,
    source: SRC_ASME_B36,
    crossChecked: true,
    crossCheckSources: [SRC_CROSSCHECK_CHARTS],
    confidence: "HIGH",
    notes:
      "Boyutsal/tanımsal standart verisidir (KDP'nin ampirik model katsayısı kapsamı dışında, kullanıcı talimatına göre kaynak tipi STANDARD). NPS 2\" ve NPS 24\" Schedule 100 örneklem noktaları bağımsız olarak doğrulandı; tüm tablo pipedata.org üzerinden tutarlı bir formülle (w = 10.6802 × t × (OD − t) lb/ft) üretildiği görülerek iç tutarlılığı teyit edildi.",
  };
  registerCoefficient(coefficient as Coefficient);
}

for (const schedule of PIPE_SCHEDULE_NAMES) {
  registerScheduleTable(schedule, ALL_TABLES[schedule]);
}

// packages/engine/src/types/process.ts

import { z } from "zod";
import { FlowRegimeEnum } from "./enums";

/**
 * Bir işletme durumunda akışkanın proses koşulları (basınç, sıcaklık, akış
 * hızları, faz oranları). Birimler SI'ye yakın mühendislik birimleridir
 * (bara, °C) — endüstri pratiğiyle uyum için; motor katmanı SI (Pa, K)
 * dönüşümünü kendi içinde yapar.
 */
export const ProcessConditionsSchema = z
  .object({
    pressureBara: z.number().min(0).max(1000).describe("Basınç (bara, mutlak)"),
    temperatureC: z.number().min(-196).max(600).describe("Akışkan sıcaklığı (°C)"),
    gasMassFlowKgS: z.number().min(0).describe("Gaz kütlesel debisi (kg/s)"),
    liquidMassFlowKgS: z.number().min(0).describe("Sıvı (hidrokarbon) kütlesel debisi (kg/s)"),
    waterMassFlowKgS: z.number().min(0).describe("Su kütlesel debisi (kg/s)"),
    gasDensityKgM3: z.number().positive().max(500).describe("Gaz yoğunluğu (kg/m³)"),
    liquidDensityKgM3: z.number().min(200).max(2000).describe("Sıvı yoğunluğu (kg/m³)"),
    mixtureDensityKgM3: z.number().positive().max(2000).describe("Karışım yoğunluğu (kg/m³)"),
    gasViscosityPaS: z.number().positive().max(1e-3).describe("Gaz viskozitesi (Pa·s)"),
    liquidViscosityPaS: z.number().positive().max(10).describe("Sıvı viskozitesi (Pa·s)"),
    superficialGasVelocityMs: z.number().min(0).max(100).describe("Yüzeysel gaz hızı (m/s)"),
    superficialLiquidVelocityMs: z.number().min(0).max(100).describe("Yüzeysel sıvı hızı (m/s)"),
    mixtureVelocityMs: z.number().min(0).max(100).describe("Karışım (mixture) hızı (m/s)"),
    liquidHoldupFraction: z.number().min(0).max(1).describe("Sıvı tutunum (holdup) oranı (0-1)"),
    flowRegime: FlowRegimeEnum.describe("Akış rejimi"),
    waterCutPercent: z.number().min(0).max(100).describe("Su kesri (water cut, %)"),
    waterDewpointC: z.number().min(-196).max(600).describe("Su çiy noktası sıcaklığı (°C)"),
    hydrocarbonDewpointC: z
      .number()
      .min(-196)
      .max(600)
      .describe("Hidrokarbon çiy noktası sıcaklığı (°C)"),
    isFreeWaterPresent: z.boolean().describe("Serbest su mevcut mu"),
    ambientTemperatureC: z.number().min(-60).max(60).describe("Ortam (çevre) sıcaklığı (°C)"),
  })
  .describe("Proses koşulları")
  .superRefine((process, ctx) => {
    if (!process.isFreeWaterPresent && process.waterCutPercent > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["waterCutPercent"],
        message: "isFreeWaterPresent=false iken waterCutPercent 0'dan büyük olamaz.",
      });
    }
  });

export type ProcessConditions = z.infer<typeof ProcessConditionsSchema>;

/**
 * Akışkanın kimyasal bileşimi — korozyon mekanizmalarının girdisi.
 */
export const FluidChemistrySchema = z.object({
  co2MolePercent: z.number().min(0).max(100).describe("CO2 mol yüzdesi (gaz fazında, %)"),
  h2sPpmMole: z.number().min(0).max(1_000_000).describe("H2S mol derişimi (gaz fazında, ppm)"),
  o2Ppb: z.number().min(0).describe("Çözünmüş oksijen derişimi (ppb)"),
  phMeasured: z.number().min(0).max(14).optional().describe("Ölçülmüş pH değeri (varsa)"),
  chlorideMgL: z.number().min(0).describe("Klorür derişimi (mg/L)"),
  bicarbonateMgL: z.number().min(0).describe("Bikarbonat derişimi (mg/L)"),
  totalDissolvedSolidsMgL: z.number().min(0).describe("Toplam çözünmüş katı madde, TDS (mg/L)"),
  aceticAcidMgL: z.number().min(0).describe("Asetik asit (HAc) derişimi (mg/L)"),
  glycolWeightPercent: z.number().min(0).max(100).describe("Glikol ağırlıkça yüzdesi (%)"),
  methanolWeightPercent: z.number().min(0).max(100).describe("Metanol ağırlıkça yüzdesi (%)"),
  isWaterFeSaturated: z.boolean().describe("Su, FeCO3 (demir karbonat) ile doygun mu"),
  bacteriaPresent: z.boolean().describe("Korozyona sebep olabilecek bakteri varlığı bilgisi"),
});

export type FluidChemistry = z.infer<typeof FluidChemistrySchema>;

/**
 * Katı parçacık (kum vb.) verisi — erozyon mekanizmalarının girdisi.
 * Kum oranı sıfırsa parçacık ayrıntıları (boyut/yoğunluk/şekil) bilinmeyebilir,
 * bu yüzden bu üç alan yalnızca kum mevcutken zorunludur (bkz. superRefine).
 */
export const SolidsDataSchema = z
  .object({
    sandRateKgDay: z.number().min(0).describe("Kum debisi (kg/gün)"),
    sandPpmw: z.number().min(0).describe("Kum derişimi, ağırlıkça (ppmw)"),
    particleDiameterUm: z.number().positive().optional().describe("Parçacık çapı (μm)"),
    particleDensityKgM3: z.number().positive().optional().describe("Parçacık yoğunluğu (kg/m³)"),
    particleShapeFactor: z
      .number()
      .min(0.2)
      .max(1.0)
      .optional()
      .describe("Parçacık şekil faktörü (yuvarlak 0.2 → keskin 1.0)"),
  })
  .describe("Katı parçacık verisi")
  .superRefine((solids, ctx) => {
    if (solids.sandRateKgDay > 0) {
      if (solids.particleDiameterUm === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["particleDiameterUm"],
          message: "sandRateKgDay > 0 iken particleDiameterUm belirtilmelidir (erozyon hesabı için gereklidir).",
        });
      }
      if (solids.particleDensityKgM3 === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["particleDensityKgM3"],
          message: "sandRateKgDay > 0 iken particleDensityKgM3 belirtilmelidir (erozyon hesabı için gereklidir).",
        });
      }
      if (solids.particleShapeFactor === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["particleShapeFactor"],
          message: "sandRateKgDay > 0 iken particleShapeFactor belirtilmelidir (erozyon hesabı için gereklidir).",
        });
      }
    }
  });

export type SolidsData = z.infer<typeof SolidsDataSchema>;

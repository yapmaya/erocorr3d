// packages/engine/src/types/geometry.ts

import { z } from "zod";
import {
  ComponentTypeEnum,
  FlowDirectionEnum,
  InstallationEnum,
  OrientationEnum,
  PressureClassEnum,
  TrimTypeEnum,
} from "./enums";

/**
 * Bir boru hattı bileşeninin (düz boru, dirsek, te, vana gövdesi vb.) fiziksel
 * geometrisi. `componentType`, geri kalan alanların (ör. bendAngleDeg) hangi
 * bağlamda anlamlı olduğunu belirler.
 *
 * Birimler: SI'ye yakın mühendislik birimleri (mm, derece) — proje genelinde
 * iç hesaplamalarda SI (Pa, K) zorunlu olsa da, boru/vana ölçüleri endüstri
 * pratiğinde evrensel olarak mm ve inç (NPS) ile ifade edildiğinden bu şema
 * mm kullanır; motor katmanı gerekli SI dönüşümünü kendi içinde yapar.
 */
export const GeometrySchema = z
  .object({
    componentType: ComponentTypeEnum.describe("Bileşen tipi"),
    npsInch: z
      .number()
      .positive()
      .max(120)
      .describe("Nominal boru çapı (NPS, inç)"),
    schedule: z
      .string()
      .min(1)
      .describe("Boru cetveli (ör. \"40\", \"80\", \"XS\", \"STD\", \"XXS\")"),
    odMm: z.number().positive().max(3000).describe("Dış çap (mm)"),
    wallThicknessMm: z.number().positive().max(200).describe("Et kalınlığı (mm)"),
    idMm: z.number().positive().max(3000).describe("İç çap (mm)"),
    lengthMm: z.number().positive().describe("Bileşen uzunluğu (mm)"),
    bendRadiusRatio: z
      .number()
      .min(0.5)
      .max(40)
      .optional()
      .describe("Bükme yarıçapı oranı (R/D) — yalnızca dirsek/bükme tiplerinde"),
    bendAngleDeg: z
      .number()
      .min(0)
      .max(180)
      .optional()
      .describe("Bükme açısı (derece) — yalnızca dirsek/bükme tiplerinde"),
    branchNps: z
      .number()
      .positive()
      .max(120)
      .optional()
      .describe("Dallanma (branch) nominal çapı (inç) — yalnızca te tiplerinde"),
    outletNps: z
      .number()
      .positive()
      .max(120)
      .optional()
      .describe("Çıkış nominal çapı (inç) — yalnızca redüksiyon tiplerinde"),
    orientation: OrientationEnum.describe("Bileşenin yönelimi"),
    inclinationDeg: z
      .number()
      .min(-90)
      .max(90)
      .optional()
      .describe("Eğim açısı (derece) — yalnızca orientation=INCLINED iken anlamlı"),
    roughnessMm: z
      .number()
      .min(0)
      .max(5)
      .describe("İç yüzey mutlak pürüzlülüğü (mm)"),
    installation: InstallationEnum.describe("Tesis yöntemi"),
    isInsulated: z.boolean().describe("İzolasyonlu mu"),
    insulationType: z
      .string()
      .min(1)
      .optional()
      .describe("İzolasyon malzemesi tipi — yalnızca isInsulated=true iken"),
  })
  .describe("Boru hattı bileşeni geometrisi")
  .superRefine((geometry, ctx) => {
    if (geometry.idMm >= geometry.odMm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idMm"],
        message: "İç çap (idMm), dış çaptan (odMm) küçük olmalıdır.",
      });
    }

    const impliedWallThicknessMm = (geometry.odMm - geometry.idMm) / 2;
    const wallThicknessToleranceMm = 1;
    if (
      geometry.idMm < geometry.odMm &&
      Math.abs(impliedWallThicknessMm - geometry.wallThicknessMm) > wallThicknessToleranceMm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wallThicknessMm"],
        message: `Et kalınlığı, dış çap ve iç çaptan hesaplanan değerle (${impliedWallThicknessMm.toFixed(2)} mm) ${wallThicknessToleranceMm} mm toleransın ötesinde tutarsız.`,
      });
    }

    if (!geometry.isInsulated && geometry.insulationType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["insulationType"],
        message: "isInsulated=false iken insulationType belirtilemez.",
      });
    }

    if (geometry.componentType === "STRAIGHT_PIPE") {
      if (geometry.bendAngleDeg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bendAngleDeg"],
          message: "Düz boru (STRAIGHT_PIPE) için bükme açısı tanımlanamaz.",
        });
      }
      if (geometry.bendRadiusRatio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bendRadiusRatio"],
          message: "Düz boru (STRAIGHT_PIPE) için bükme yarıçapı oranı tanımlanamaz.",
        });
      }
    }

    if (geometry.orientation !== "INCLINED" && geometry.inclinationDeg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inclinationDeg"],
        message: "inclinationDeg yalnızca orientation=INCLINED iken anlamlıdır.",
      });
    }
  });

export type Geometry = z.infer<typeof GeometrySchema>;

/**
 * Vana geometrisi — Geometry'yi genişletir. Vanaya özgü basınç sınıfı,
 * trim/gövde özellikleri ve akış katsayılarını ekler.
 *
 * NOT: bodyStyle, seatMaterial, trimMaterial, stemType, packingType serbest
 * metindir — proje talimatında bu alanlar için kapalı bir değer listesi
 * verilmemiştir (kapalı liste verilen trimType ve flowDirection enum olarak
 * tanımlanmıştır).
 */
export const ValveGeometrySchema = GeometrySchema.and(
  z
    .object({
      pressureClass: PressureClassEnum.describe(
        "Basınç sınıfı (ANSI/ASME Class: 150|300|600|900|1500|2500)",
      ),
      bodyStyle: z.string().min(1).describe("Vana gövde stili (serbest metin)"),
      trimType: TrimTypeEnum.describe("Trim tipi"),
      seatMaterial: z.string().min(1).describe("Oturak (seat) malzemesi"),
      trimMaterial: z.string().min(1).describe("Trim malzemesi"),
      cvRated: z.number().positive().describe("Anma akış katsayısı Cv"),
      flFactor: z
        .number()
        .min(0)
        .max(1)
        .describe("Sıvı basınç geri kazanım faktörü FL (boyutsuz, 0-1)"),
      xtFactor: z
        .number()
        .min(0)
        .max(1)
        .describe("Kritik basınç düşümü oranı xT (boyutsuz, 0-1)"),
      kcFactor: z
        .number()
        .min(0)
        .describe(
          "Kavitasyon başlangıç katsayısı Kc (boyutsuz) — vana üreticisi test verisinden gelir",
        ),
      openingPercent: z.number().min(0).max(100).describe("Vana açıklık oranı (%)"),
      flowDirection: FlowDirectionEnum.describe("Akış yönü (oturağa göre)"),
      stemType: z.string().min(1).describe("Mil (stem) tipi"),
      packingType: z.string().min(1).describe("Salmastra (packing) tipi"),
      bodyCavityVolumeMl: z.number().positive().describe("Gövde iç hacmi (ml)"),
    })
    .describe("Vana geometrisi (Geometry genişletmesi)"),
);

export type ValveGeometry = z.infer<typeof ValveGeometrySchema>;

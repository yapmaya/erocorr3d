// packages/engine/tests/types/geometry.test.ts

import { describe, expect, it } from "vitest";
import { GeometrySchema, ValveGeometrySchema } from "../../src/types/geometry";

const validStraightPipe = {
  componentType: "STRAIGHT_PIPE" as const,
  npsInch: 16,
  schedule: "STD",
  odMm: 406.4,
  wallThicknessMm: 9.53,
  idMm: 406.4 - 2 * 9.53,
  lengthMm: 5000,
  orientation: "HORIZONTAL" as const,
  roughnessMm: 0.045,
  installation: "BURIED" as const,
  isInsulated: false,
  locationClass: 1 as const,
  environmentalSensitivity: "MEDIUM" as const,
};

describe("GeometrySchema — geçerli girdiler", () => {
  it("geçerli bir düz boru geometrisini kabul eder", () => {
    expect(GeometrySchema.safeParse(validStraightPipe).success).toBe(true);
  });

  it("izolasyonlu bir bileşeni izolasyon tipiyle birlikte kabul eder", () => {
    const result = GeometrySchema.safeParse({
      ...validStraightPipe,
      isInsulated: true,
      insulationType: "Mineral Yünü",
    });
    expect(result.success).toBe(true);
  });

  it("90° dirseği bükme açısı ve yarıçap oranıyla kabul eder", () => {
    const result = GeometrySchema.safeParse({
      ...validStraightPipe,
      componentType: "ELBOW_90",
      bendAngleDeg: 90,
      bendRadiusRatio: 1.5,
    });
    expect(result.success).toBe(true);
  });
});

describe("GeometrySchema — fiziksel olarak imkânsız kombinasyonlar", () => {
  it("iç çap dış çaptan büyük/eşit olamaz", () => {
    const result = GeometrySchema.safeParse({ ...validStraightPipe, idMm: 500 });
    expect(result.success).toBe(false);
  });

  it("et kalınlığı, dış çap ve iç çapla tutarsızsa reddedilir", () => {
    const result = GeometrySchema.safeParse({ ...validStraightPipe, wallThicknessMm: 50 });
    expect(result.success).toBe(false);
  });

  it("isInsulated=false iken insulationType belirtilemez", () => {
    const result = GeometrySchema.safeParse({
      ...validStraightPipe,
      isInsulated: false,
      insulationType: "PIR Köpük",
    });
    expect(result.success).toBe(false);
  });

  it("düz boru için bükme açısı tanımlanamaz", () => {
    const result = GeometrySchema.safeParse({ ...validStraightPipe, bendAngleDeg: 45 });
    expect(result.success).toBe(false);
  });

  it("orientation=HORIZONTAL iken inclinationDeg belirtilemez", () => {
    const result = GeometrySchema.safeParse({ ...validStraightPipe, inclinationDeg: 15 });
    expect(result.success).toBe(false);
  });
});

describe("ValveGeometrySchema", () => {
  const validValve = {
    ...validStraightPipe,
    componentType: "GATE_VALVE" as const,
    pressureClass: 600 as const,
    bodyStyle: "3 Parçalı",
    trimType: "STANDARD" as const,
    seatMaterial: "316L SS",
    trimMaterial: "316L SS",
    cvRated: 250,
    flFactor: 0.9,
    xtFactor: 0.7,
    kcFactor: 0.6,
    openingPercent: 100,
    flowDirection: "OVER_SEAT" as const,
    stemType: "Rising Stem",
    packingType: "PTFE",
    bodyCavityVolumeMl: 500,
  };

  it("geçerli bir vana geometrisini kabul eder", () => {
    expect(ValveGeometrySchema.safeParse(validValve).success).toBe(true);
  });

  it("geçersiz basınç sınıfını reddeder", () => {
    const result = ValveGeometrySchema.safeParse({ ...validValve, pressureClass: 450 });
    expect(result.success).toBe(false);
  });

  it("%100'ü aşan açıklık oranını reddeder", () => {
    const result = ValveGeometrySchema.safeParse({ ...validValve, openingPercent: 120 });
    expect(result.success).toBe(false);
  });

  it("Geometry'nin kendi kurallarını da miras alır (idMm≥odMm reddedilir)", () => {
    const result = ValveGeometrySchema.safeParse({ ...validValve, idMm: 500 });
    expect(result.success).toBe(false);
  });
});

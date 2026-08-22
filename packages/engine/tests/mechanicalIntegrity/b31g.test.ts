// packages/engine/tests/mechanicalIntegrity/b31g.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  computeAsmeB318DesignWallThickness,
  computeCodeBasisPressurePa,
  computeModifiedB31gSafePressurePa,
  computeModifiedFoliasFactor,
  computeOriginalB31gSafePressurePa,
  computeOriginalFoliasFactor,
  findAxialDefectExtentM,
  lookupTemperatureDeratingFactor,
} from "../../src/mechanicalIntegrity/b31g";
import type { SpatialDamageField } from "../../src/types/results";

// NPS16 STD boru (referans tesis fixture geometrisiyle aynı mertebe) — bkz. fixtures/referenceFacility.ts
const OD_M = 0.4064;
const WT_M = 0.00953;
const SMYS_PA = 360e6; // API 5L X52

describe("computeOriginalFoliasFactor — Eq.8", () => {
  it("L=0 iken M=1 (kusursuz boru)", () => {
    expect(computeOriginalFoliasFactor(0, OD_M, WT_M)).toBeCloseTo(1, 10);
  });

  it("formülü birebir yeniden üretir: M=√(1+0,8L²/Dt)", () => {
    const L = 0.3;
    const expected = Math.sqrt(1 + (0.8 * L ** 2) / (OD_M * WT_M));
    expect(computeOriginalFoliasFactor(L, OD_M, WT_M)).toBeCloseTo(expected, 12);
  });

  it("negatif uzunluk için hata fırlatır", () => {
    expect(() => computeOriginalFoliasFactor(-1, OD_M, WT_M)).toThrowError();
  });
});

describe("computeModifiedFoliasFactor — Eq.10/Eq.11 dalı", () => {
  it("L²/Dt ≤ 50 iken üç-terimli formülü kullanır", () => {
    const L = 0.05; // L²/Dt küçük → kesin ≤50
    const lengthRatio = L ** 2 / (OD_M * WT_M);
    expect(lengthRatio).toBeLessThan(50);
    const expected = Math.sqrt(1 + 0.6275 * lengthRatio - 0.003375 * lengthRatio ** 2);
    expect(computeModifiedFoliasFactor(L, OD_M, WT_M)).toBeCloseTo(expected, 10);
  });

  it("L²/Dt > 50 iken iki-terimli formülü kullanır", () => {
    const L = 1.0; // L²/Dt kesin >50
    const lengthRatio = L ** 2 / (OD_M * WT_M);
    expect(lengthRatio).toBeGreaterThan(50);
    const expected = 0.032 * lengthRatio + 3.3;
    expect(computeModifiedFoliasFactor(L, OD_M, WT_M)).toBeCloseTo(expected, 10);
  });
});

describe("lookupTemperatureDeratingFactor — ASME B31.8 Tablo 841.1.8-1", () => {
  it("121,111°C (250°F) ve altında T=1,0", () => {
    expect(lookupTemperatureDeratingFactor(15).factor).toBe(1.0);
    expect(lookupTemperatureDeratingFactor(121.111).factor).toBeCloseTo(1.0, 6);
  });

  it("148,889°C (300°F) tam nokta → T=0,967", () => {
    expect(lookupTemperatureDeratingFactor(148.889).factor).toBeCloseTo(0.967, 3);
  });

  it("iki tablo noktası arasında doğrusal enterpolasyon yapar", () => {
    const midpoint = (121.111 + 148.889) / 2;
    const expected = (1.0 + 0.967) / 2;
    expect(lookupTemperatureDeratingFactor(midpoint).factor).toBeCloseTo(expected, 6);
  });

  it("üst sınırın (232,222°C) üzerinde en düşük faktörü kullanır VE uyarı üretir", () => {
    const result = lookupTemperatureDeratingFactor(300);
    expect(result.factor).toBeCloseTo(0.867, 3);
    expect(result.validityWarnings.length).toBe(1);
  });
});

describe("computeAsmeB318DesignWallThickness — t=PD/2SFET", () => {
  it("hesaplanan t, çözüldüğü P=2StFET/D formülünü TAM olarak geri üretir (yuvarlanmamış round-trip)", () => {
    const designPressurePa = 10e6; // 10 MPa
    const locationClass = 1;
    const temperatureC = 20;
    const result = computeAsmeB318DesignWallThickness(designPressurePa, OD_M, SMYS_PA, locationClass, temperatureC);
    const reproducedPressurePa = computeCodeBasisPressurePa(
      OD_M,
      result.designWallThicknessM,
      SMYS_PA,
      locationClass,
      temperatureC,
    );
    expect(reproducedPressurePa).toBeCloseTo(designPressurePa, 6);
  });

  it("korozyon payı eklenince requiredWithAllowanceM artar", () => {
    const withoutCa = computeAsmeB318DesignWallThickness(10e6, OD_M, SMYS_PA, 1, 20, 0);
    const withCa = computeAsmeB318DesignWallThickness(10e6, OD_M, SMYS_PA, 1, 20, 0.003);
    expect(withCa.requiredWithAllowanceM).toBeCloseTo(withoutCa.designWallThicknessM + 0.003, 9);
  });

  it("daha kısıtlayıcı konum sınıfı (Class 4, F=0,40) daha kalın et kalınlığı gerektirir", () => {
    const class1 = computeAsmeB318DesignWallThickness(10e6, OD_M, SMYS_PA, 1, 20);
    const class4 = computeAsmeB318DesignWallThickness(10e6, OD_M, SMYS_PA, 4, 20);
    expect(class4.designWallThicknessM).toBeGreaterThan(class1.designWallThicknessM);
  });
});

describe("computeOriginalB31gSafePressurePa — Eq.5/Eq.6", () => {
  const baseInput = { odM: OD_M, wallThicknessM: WT_M, smysPa: SMYS_PA, locationClass: 1 as const, temperatureC: 20 };

  it("kusur derinliği sıfırken P' = 1,1×P (governing basıncın tam %110'u)", () => {
    const result = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0, defectLengthM: 0.05 });
    expect(result.safePressurePa).toBeCloseTo(1.1 * result.governingPressurePa, 6);
  });

  it("derinlik arttıkça güvenli basınç MONOTON azalır (sabit uzunluk)", () => {
    const shallow = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.001, defectLengthM: 0.05 });
    const deep = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.005, defectLengthM: 0.05 });
    expect(deep.safePressurePa).toBeLessThan(shallow.safePressurePa);
  });

  it("d/t > %80 iken geçerlilik uyarısı üretir", () => {
    const result = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.9 * WT_M, defectLengthM: 0.05 });
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("d/t = %80 sınırında uyarı üretmez", () => {
    const result = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.8 * WT_M, defectLengthM: 0.05 });
    expect(result.validityWarnings.length).toBe(0);
  });

  it("uzun kusur dalında (Eq.6) güvenli basınç, governing basıncı AŞMAZ", () => {
    const result = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.001, defectLengthM: 5 });
    expect(result.branch).toContain("Eq.6");
    expect(result.safePressurePa).toBeLessThanOrEqual(result.governingPressurePa + 1e-6);
  });

  it("her sonuç mühendislik belirsizlik uyarısını döndürür", () => {
    const result = computeOriginalB31gSafePressurePa({ ...baseInput, defectDepthM: 0.002, defectLengthM: 0.05 });
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("computeModifiedB31gSafePressurePa — Eq.15 (0,85dL)", () => {
  const baseInput = { odM: OD_M, wallThicknessM: WT_M, smysPa: SMYS_PA, locationClass: 1 as const, temperatureC: 20 };

  it("kusur derinliği sıfırken kapalı-form (numerator=denominator=1) ile birebir eşleşir", () => {
    const defectLengthM = 0.05;
    const result = computeModifiedB31gSafePressurePa({ ...baseInput, defectDepthM: 0, defectLengthM });
    const F = 0.72; // Class 1
    const adderPa = 68947572.93167949; // b31g.modifiedFlowStressAdderPa
    const factorOfSafety = 1.39;
    const bracket = (result.governingPressurePa * OD_M) / (2 * WT_M * F) + adderPa;
    const expected = (2 * WT_M * bracket) / (OD_M * factorOfSafety);
    expect(result.safePressurePa).toBeCloseTo(expected, 2);
  });

  it("derinlik arttıkça güvenli basınç MONOTON azalır (sabit uzunluk)", () => {
    const shallow = computeModifiedB31gSafePressurePa({ ...baseInput, defectDepthM: 0.001, defectLengthM: 0.05 });
    const deep = computeModifiedB31gSafePressurePa({ ...baseInput, defectDepthM: 0.005, defectLengthM: 0.05 });
    expect(deep.safePressurePa).toBeLessThan(shallow.safePressurePa);
  });

  it("orijinal B31G'ye göre farklı (ama aynı mertebede) bir sonuç üretir — iki kriter aynı formül DEĞİLDİR", () => {
    const input = { ...baseInput, defectDepthM: 0.003, defectLengthM: 0.05 };
    const original = computeOriginalB31gSafePressurePa(input);
    const modified = computeModifiedB31gSafePressurePa(input);
    expect(modified.safePressurePa).not.toBeCloseTo(original.safePressurePa, 3);
    const ratio = modified.safePressurePa / original.safePressurePa;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });
});

describe("findAxialDefectExtentM", () => {
  function buildField(valuesRow: number[], resolutionV: number, peakIu: number): SpatialDamageField {
    const resolutionU = valuesRow.length;
    const valuesMm = new Float32Array(resolutionU * resolutionV);
    for (let iu = 0; iu < resolutionU; iu++) {
      valuesMm[0 * resolutionU + iu] = valuesRow[iu]; // yalnızca iv=0 satırı dolu
    }
    const maxValueMm = Math.max(...valuesRow);
    return {
      parameterization: "CYLINDRICAL_UV",
      resolutionU,
      resolutionV,
      valuesMm,
      maxValueMm,
      maxLocation: {
        u: (peakIu + 0.5) / resolutionU,
        v: 0.5 / resolutionV,
        descriptionTr: "test",
        clockPosition: 12,
      },
      hotspots: [],
    };
  }

  it("eşiği (d/t≥%10) aşan sürekli aralığı doğru bulur", () => {
    const field = buildField([0, 0, 2, 5, 5, 5, 2, 0, 0, 0], 8, 4);
    const result = findAxialDefectExtentM(field, 10, 10 /* wallThicknessMm */);
    expect(result).not.toBeNull();
    // iu=2..6 (5 hücre) eşiği (1mm) aşıyor → 5/10 × 10m = 5m
    expect(result!.lengthM).toBeCloseTo(5, 6);
    expect(result!.maxDepthMm).toBe(5);
  });

  it("tepe değeri kalifikasyon eşiğinin altındaysa null döner", () => {
    const field = buildField([0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0], 8, 3);
    const result = findAxialDefectExtentM(field, 10, 10);
    expect(result).toBeNull();
  });

  it("eksenel çizgi (u periyodik değil) sınırda kesilir, tüm ızgarayı taşmaz", () => {
    const field = buildField([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 8, 0);
    const result = findAxialDefectExtentM(field, 10, 10);
    expect(result!.lengthM).toBeCloseTo(10, 6);
  });
});

describe("b31g — KDP kayıt defteri entegrasyonu", () => {
  it("tüm b31g sabitleri kayıtlıdır ve HIGH/MEDIUM güven taşır (UNVERIFIED yok)", () => {
    const entries = listCoefficients().filter((c) => c.module === "b31g");
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const entry of entries) {
      expect(["HIGH", "MEDIUM"]).toContain(entry.confidence);
    }
  });
});

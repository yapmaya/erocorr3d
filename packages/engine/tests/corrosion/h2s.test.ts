// packages/engine/tests/corrosion/h2s.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  assessH2sSourRisk,
  assessHardnessCompliance,
  classifyCo2H2sRegime,
  computeH2sPartialPressureKpa,
  determineSscRegion,
} from "../../src/corrosion/h2s";

describe("computeH2sPartialPressureKpa", () => {
  it("Dalton yasasıyla doğru hesaplar", () => {
    expect(computeH2sPartialPressureKpa(1000, 0.01)).toBeCloseTo(10, 5);
  });

  it("geçersiz girdi için hata fırlatır", () => {
    expect(() => computeH2sPartialPressureKpa(0, 0.01)).toThrowError();
    expect(() => computeH2sPartialPressureKpa(1000, 1.5)).toThrowError();
  });
});

describe("determineSscRegion (ISO 15156-2 Şekil 1)", () => {
  it("pH2S < 0,3 kPa → Region 0", () => {
    expect(determineSscRegion(0.1, 5)).toBe("REGION_0");
  });

  it("pH2S=0,3kPa (tam sınırda, standardın metni '<0,3kPa' dediği için artık Region 0 DEĞİL) → Region 1", () => {
    expect(determineSscRegion(0.3, 3.5)).toBe("SSC_REGION_1");
  });

  it("yüksek pH2S + düşük pH → Region 3 (en şiddetli)", () => {
    expect(determineSscRegion(500, 3.5)).toBe("SSC_REGION_3");
  });

  it("orta pH2S + orta-düşük pH → Region 2", () => {
    expect(determineSscRegion(10, 3.6)).toBe("SSC_REGION_2");
  });

  it("düşük pH2S (Region 0 üstü) + yüksek pH → Region 1", () => {
    expect(determineSscRegion(0.5, 4)).toBe("SSC_REGION_1");
  });
});

describe("assessHardnessCompliance", () => {
  it("Region 0'da sertlik sınırı normalde uygulanmaz", () => {
    expect(assessHardnessCompliance(35, "REGION_0").isCompliant).toBe(true);
  });

  it("Region 1+'da 22 HRC üzeri UYGUN DEĞİL", () => {
    const result = assessHardnessCompliance(28, "SSC_REGION_1");
    expect(result.isCompliant).toBe(false);
    expect(result.limitHrc).toBe(22);
  });

  it("Region 1+'da 22 HRC altı UYGUN", () => {
    expect(assessHardnessCompliance(18, "SSC_REGION_1").isCompliant).toBe(true);
  });
});

describe("classifyCo2H2sRegime", () => {
  it("oran>500 → SWEET_DOMINANT", () => {
    expect(classifyCo2H2sRegime(600, 1)).toBe("SWEET_DOMINANT");
  });

  it("oran<20 → SOUR_DOMINANT", () => {
    expect(classifyCo2H2sRegime(10, 1)).toBe("SOUR_DOMINANT");
  });

  it("20-500 arası → MIXED_TRANSITION", () => {
    expect(classifyCo2H2sRegime(100, 1)).toBe("MIXED_TRANSITION");
  });
});

describe("assessH2sSourRisk", () => {
  const baseInput = {
    totalPressureKpa: 5000,
    h2sMoleFraction: 0.001, // pH2S = 5 kPa
    co2MoleFraction: 0.02,
    inSituPh: 5,
    freeWaterPresent: true,
  };

  it("serbest su yoksa mekanizma tetiklenmez", () => {
    const result = assessH2sSourRisk({ ...baseInput, freeWaterPresent: false });
    expect(result.isMechanismActive).toBe(false);
    expect(result.riskScore).toBe(0);
  });

  it("H2S çok düşükse (Region 0) mekanizma tetiklenmez", () => {
    const result = assessH2sSourRisk({ ...baseInput, h2sMoleFraction: 0.00001 });
    expect(result.isMechanismActive).toBe(false);
  });

  it("belirgin H2S + orta pH → mekanizma tetiklenir, risk skoru > 0", () => {
    const result = assessH2sSourRisk(baseInput);
    expect(result.isMechanismActive).toBe(true);
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("uygun olmayan sertlik ek risk puanı ve uyarı ekler", () => {
    const compliant = assessH2sSourRisk({ ...baseInput, materialHardnessHrc: 18 });
    const nonCompliant = assessH2sSourRisk({ ...baseInput, materialHardnessHrc: 30 });
    expect(nonCompliant.riskScore).toBeGreaterThan(compliant.riskScore);
    expect(nonCompliant.validityWarnings.some((w) => w.parameter === "Malzeme sertliği")).toBe(true);
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    expect(assessH2sSourRisk(baseInput).disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("h2s — KDP kayıt defteri entegrasyonu", () => {
  it("ISO 15156-2 sabitleri kayıtlıdır ve region0Threshold HIGH confidence taşır", () => {
    const ids = listCoefficients()
      .filter((c) => c.module === "h2s")
      .map((c) => c.id);
    expect(ids).toContain("h2s.region0ThresholdKpa");
    expect(ids).toContain("h2s.sscRegionBoundaryCurves");
    expect(ids).toContain("h2s.hardnessLimit.csLowAlloySteel");
    const entry = listCoefficients().find((c) => c.id === "h2s.region0ThresholdKpa");
    expect(entry?.confidence).toBe("HIGH");
  });
});

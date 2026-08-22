// packages/engine/tests/corrosion/pittingCreviceCscc.test.ts

import { describe, expect, it } from "vitest";
import { getMaterial } from "../../src/data/materials";
import { assessPittingCreviceCsccRisk } from "../../src/corrosion/pittingCreviceCscc";

describe("assessPittingCreviceCsccRisk", () => {
  const ss316 = getMaterial("ss-316-316l"); // cptC=15, csccLimitC=60 (kullanıcı verisi, materials.ts)
  const cs = getMaterial("cs-a106-grb"); // PREN tanımsız (metalik ama paslanmaz değil)

  it("klorür yoksa hiçbir risk tetiklenmez", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 80,
      environment: "INTERNAL",
      chloridePresent: false,
      creviceGeometryPresent: true,
    });
    expect(result.isPittingRisk).toBe(false);
    expect(result.isCreviceRisk).toBe(false);
    expect(result.isCsccRisk).toBe(false);
  });

  it("servis sıcaklığı CPT altındaysa çukurlaşma riski YOK", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 10,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
    });
    expect(result.isPittingRisk).toBe(false);
  });

  it("servis sıcaklığı CPT üstündeyse çukurlaşma riski VAR", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 20,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
    });
    expect(result.isPittingRisk).toBe(true);
    expect(result.recommendationTr).toContain("çukurlaşma");
  });

  it("aralık geometrisi yoksa crevice riski, sıcaklık CCT üstünde olsa bile tetiklenmez", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 20,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
    });
    expect(result.isCreviceRisk).toBe(false);
  });

  it("servis sıcaklığı CSCC sınırının üstündeyse (klorür + gerilme ile) CSCC riski VAR", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 70,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
      tensileStressPresent: true,
    });
    expect(result.isCsccRisk).toBe(true);
  });

  it("gerilme yoksa CSCC riski tetiklenmez (sıcaklık/klorür koşulu sağlansa bile)", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 70,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
      tensileStressPresent: false,
    });
    expect(result.isCsccRisk).toBe(false);
  });

  it("PREN tanımsız malzeme (CS) için çukurlaşma değerlendirilemez ve uyarı verir", () => {
    const result = assessPittingCreviceCsccRisk({
      material: cs,
      serviceTemperatureC: 80,
      environment: "INTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: true,
    });
    expect(result.isPittingRisk).toBe(false);
    expect(result.validityWarnings.some((w) => w.parameter === "PREN")).toBe(true);
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    const result = assessPittingCreviceCsccRisk({
      material: ss316,
      serviceTemperatureC: 20,
      environment: "EXTERNAL",
      chloridePresent: true,
      creviceGeometryPresent: false,
    });
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

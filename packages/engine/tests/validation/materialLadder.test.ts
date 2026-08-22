// packages/engine/tests/validation/materialLadder.test.ts
//
// selectPipingMaterial() §10.3.2 karar merdiveninin, hem BOTAŞ
// F3-500-ME-SPC-PSS-0002 Tablo 10-3'ün kendi gerçek akış örnekleriyle hem de
// merdivenin kendi katsayı kaydının (registry/coefficients/materialSelection.ts,
// "CA=1.49/1.50/2.99/3.00/5.99/6.00/6.01 sınır testleri bu tabloyu hedefler"
// notu) işaret ettiği sınır değerleriyle doğru çalıştığını kanıtlar.

import { describe, expect, it } from "vitest";
import { selectPipingMaterial } from "../../src/aggregate/materialSelection";
import { MATERIAL_LADDER_CASES } from "../../src/fixtures/botasPss0002ValidationData";

/** Merdivenin kendi etiketleri Türkçe ondalık virgül kullanır (ör. "3,0mm") — bkz. registry/coefficients/materialSelection.ts. */
function turkishMmLabel(caMm: number): string {
  return `${caMm.toFixed(1).replace(".", ",")}mm`;
}

describe("selectPipingMaterial — Tablo 10-3'ün gerçek akış örnekleri", () => {
  for (const testCase of MATERIAL_LADDER_CASES) {
    it(`Akış ${testCase.streamId}: SLC=${testCase.slcMm}mm → CS + ${testCase.expectedCaMm}mm CA`, () => {
      const result = selectPipingMaterial({
        requiredCorrosionAllowanceMm: testCase.slcMm,
        inServiceInspectionPossible: false,
      });
      expect(result.primaryMaterialTr).toContain(turkishMmLabel(testCase.expectedCaMm));
    });
  }
});

describe("selectPipingMaterial — merdiven sınır değerleri (registry'nin kendi test hedefi)", () => {
  const boundaryCases: Array<{ ca: number; expectedCaMm: number }> = [
    { ca: 1.49, expectedCaMm: 1.5 },
    { ca: 1.5, expectedCaMm: 1.5 },
    { ca: 2.99, expectedCaMm: 3.0 },
    { ca: 3.0, expectedCaMm: 3.0 },
    { ca: 5.99, expectedCaMm: 6.0 },
    { ca: 6.0, expectedCaMm: 6.0 },
  ];

  for (const { ca, expectedCaMm } of boundaryCases) {
    it(`gerekli CA=${ca}mm → ${expectedCaMm}mm basamağı`, () => {
      const result = selectPipingMaterial({
        requiredCorrosionAllowanceMm: ca,
        inServiceInspectionPossible: false,
      });
      expect(result.primaryMaterialTr).toContain(turkishMmLabel(expectedCaMm));
    });
  }

  it("gerekli CA=6.01mm → merdivenin en üst basamağı (CRA gerektirir, sabit mm etiketi YOK)", () => {
    const result = selectPipingMaterial({
      requiredCorrosionAllowanceMm: 6.01,
      inServiceInspectionPossible: false,
    });
    expect(result.primaryMaterialTr).not.toContain("Karbon Çelik");
  });
});

describe("selectPipingMaterial — servis içi muayene istisnası (3-6mm bandı)", () => {
  it("inServiceInspectionPossible=true iken 3-6mm bandında 3.0mm CA yeterli görülür", () => {
    const result = selectPipingMaterial({
      requiredCorrosionAllowanceMm: 3.45, // Akış 1130 ile aynı SLC
      inServiceInspectionPossible: true,
    });
    expect(result.primaryMaterialTr).toContain("3,0mm");
    expect(result.alternativeMaterialsTr.join(" ")).toContain("6,0mm");
  });
});

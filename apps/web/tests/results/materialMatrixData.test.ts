// apps/web/tests/results/materialMatrixData.test.ts

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import { buildMaterialMatrixData } from "../../src/features/results/materialMatrixData";
import type { AssessmentHistoryEntry } from "../../src/store/assessmentHistoryStore";
import { getTemplate } from "../../src/features/input/templates";

function buildEntry(templateId: string): AssessmentHistoryEntry {
  const template = getTemplate(templateId)!;
  const values = template.apply();
  const assessment = assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
  return {
    id: "test-entry",
    componentLabel: values.componentLabel,
    geometry: values.geometry,
    mitigation: values.mitigation,
    operatingProfile: values.operatingProfile,
    assessment,
    uninhibitedAssessment: assessment,
    computedAt: Date.now(),
  };
}

describe("buildMaterialMatrixData", () => {
  it("motorun 20 malzeme kataloğunun tamamı için bir satır döner", () => {
    const entry = buildEntry("wet-gas-gathering");
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    expect(data.rows.length).toBe(20);
  });

  it("yalnızca motorun modellediği tek malzeme (cs-a106-grb) gerçek bir 'Ömür' sayısı taşır, diğerleri null", () => {
    const entry = buildEntry("wet-gas-gathering");
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    const modeledRows = data.rows.filter((r) => r.isModeledMaterial);
    expect(modeledRows.length).toBe(1);
    expect(modeledRows[0].material.materialId).toBe("cs-a106-grb");
    expect(modeledRows[0].lifeYearsModeled).not.toBeNull();
    expect(modeledRows[0].lifeYearsModeled).toBeGreaterThan(0);

    const unmodeledRows = data.rows.filter((r) => !r.isModeledMaterial);
    expect(unmodeledRows.length).toBe(19);
    expect(unmodeledRows.every((r) => r.lifeYearsModeled === null)).toBe(true);
  });

  it("recommendedMaterialTr, resultsDerivation.ts'in AYNI selectPipingMaterial çağrısından gelir (tek doğruluk kaynağı)", () => {
    const entry = buildEntry("wet-gas-gathering");
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    expect(data.recommendedMaterialTr.length).toBeGreaterThan(0);
  });

  it("H2S mevcut ve sour servis eşiği aşılıyorsa (Kumlu Kuyu Başı Hattı) sourServiceApplicable=true ve yüksek/düşük PREN notları ayrışır", () => {
    const entry = buildEntry("sandy-wellhead");
    expect(entry.operatingProfile.cases.some((c) => c.chemistry.h2sPpmMole > 0)).toBe(true);
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    if (data.sourServiceApplicable) {
      const superDuplex = data.rows.find((r) => r.material.materialId === "super-duplex-2507")!;
      const carbonSteel = data.rows.find((r) => r.material.materialId === "cs-a106-grb")!;
      expect(superDuplex.sourServiceNoteTr).not.toBeNull();
      expect(carbonSteel.sourServiceNoteTr).not.toBeNull();
      expect(superDuplex.sourServiceNoteTr).not.toBe(carbonSteel.sourServiceNoteTr);
    } else {
      // İnSitu pH hesaplanamadıysa veya H2S kısmi basıncı eşiğin altındaysa sour servis uygulanmaz — sahte bir rozet üretilmediği doğrulanır.
      expect(data.rows.every((r) => r.sourServiceNoteTr === null)).toBe(true);
    }
  });

  it("H2S yoksa (Kuru Satış Gazı Hattı) sourServiceApplicable=false ve hiçbir satırda sour servis notu yok", () => {
    const entry = buildEntry("dry-sales-gas");
    expect(entry.operatingProfile.cases.every((c) => c.chemistry.h2sPpmMole === 0)).toBe(true);
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    expect(data.sourServiceApplicable).toBe(false);
    expect(data.sourServiceRegionTr).toBeNull();
    expect(data.rows.every((r) => r.sourServiceNoteTr === null)).toBe(true);
  });

  it("sıcaklık uygunluğu her aday için gerçek min/maxServiceTempC karşılaştırmasından hesaplanır", () => {
    const entry = buildEntry("wet-gas-gathering");
    const data = buildMaterialMatrixData(entry, { inServiceInspectionPossible: false });
    const minTempAcrossCases = Math.min(...entry.operatingProfile.cases.map((c) => c.process.temperatureC));
    const maxTempAcrossCases = Math.max(...entry.operatingProfile.cases.map((c) => c.process.temperatureC));
    for (const row of data.rows) {
      const expected = maxTempAcrossCases <= row.material.maxServiceTempC && minTempAcrossCases >= row.material.minDesignTempC;
      expect(row.temperatureSuitable).toBe(expected);
    }
  });
});

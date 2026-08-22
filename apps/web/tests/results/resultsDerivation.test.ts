// apps/web/tests/results/resultsDerivation.test.ts

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import {
  collectCoefficientIdsFromAssessment,
  deriveCtlAtl,
  deriveMaterialRecommendation,
  deriveTableRow,
  deriveUnverifiedCoefficients,
} from "../../src/features/results/resultsDerivation";
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

describe("collectCoefficientIdsFromAssessment / deriveUnverifiedCoefficients", () => {
  it("Islak Gaz Toplama Hattı şablonu (CO2 var, pH hesaplanır) — en az bir katsayı kimliği toplar", () => {
    const entry = buildEntry("wet-gas-gathering");
    const ids = collectCoefficientIdsFromAssessment(entry.assessment);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("Islak Gaz Toplama Hattı şablonu — pH ölçülmemiş, kimyadan hesaplanıyor → NORSOK pH K1/K2 UNVERIFIED yakalanır", () => {
    const entry = buildEntry("wet-gas-gathering");
    const unverified = deriveUnverifiedCoefficients(entry.assessment);
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.every((c) => c.confidence === "UNVERIFIED")).toBe(true);
  });

  it("Kuru Satış Gazı şablonu (kuru gaz, korozyon hızı 0) — hiç katsayı toplanmaz (uygulanmayan mekanizma sahte iz taşımaz)", () => {
    const entry = buildEntry("dry-sales-gas");
    const co2 = entry.assessment.perCase[0].mechanismResults.find((m) => m.mechanismId === "CO2_SWEET")!;
    expect(co2.isApplicable).toBe(false);
    expect(co2.calculationTrace).toEqual([]);
  });
});

describe("deriveCtlAtl", () => {
  it("korozyon payı > 0 iken gerçek bir oran döner", () => {
    const entry = buildEntry("wet-gas-gathering");
    const ctlAtl = deriveCtlAtl(entry);
    expect(ctlAtl).not.toBeNull();
    expect(ctlAtl!.ratio).toBeCloseTo(
      entry.assessment.metalLoss.totalServiceLifeCorrosionMm.p50 / entry.operatingProfile.corrosionAllowanceMm,
      9,
    );
  });

  it("korozyon payı 0 iken null döner (sahte oran UYDURULMAZ)", () => {
    const entry = buildEntry("wet-gas-gathering");
    entry.operatingProfile = { ...entry.operatingProfile, corrosionAllowanceMm: 0 };
    expect(deriveCtlAtl(entry)).toBeNull();
  });
});

describe("deriveMaterialRecommendation", () => {
  it("gerçek bir birincil malzeme önerisi döner", () => {
    const entry = buildEntry("wet-gas-gathering");
    const material = deriveMaterialRecommendation(entry, false);
    expect(material.primaryMaterialTr.length).toBeGreaterThan(0);
  });

  it("inServiceInspectionPossible bayrağı öneriyi etkileyebilir (3mm/6mm CA bandı)", () => {
    const entry = buildEntry("wet-gas-gathering");
    const withInspection = deriveMaterialRecommendation(entry, true);
    const withoutInspection = deriveMaterialRecommendation(entry, false);
    // İkisi de geçerli sonuçlar üretmeli — bayrağın etkisi CA bandına göre değişir, burada yalnızca çökmediğini doğruluyoruz.
    expect(withInspection.primaryMaterialTr.length).toBeGreaterThan(0);
    expect(withoutInspection.primaryMaterialTr.length).toBeGreaterThan(0);
  });
});

describe("deriveTableRow", () => {
  it("inhibitör yapılandırılmışsa İnhibitörlü kolonu dolar (Islak Gaz Toplama Hattı şablonu inhibitörlüdür)", () => {
    const entry = buildEntry("wet-gas-gathering");
    expect(entry.mitigation.inhibitorUsed).toBe(true);
    const row = deriveTableRow(entry, { inServiceInspectionPossible: false });
    expect(row.slcInhibitedMm).not.toBeNull();
    expect(row.slcUninhibitedMm).toBeGreaterThan(0);
  });

  it("inhibitör yapılandırılmamışsa İnhibitörlü kolonu null (Girilmedi) olur", () => {
    const entry = buildEntry("wet-gas-gathering");
    entry.mitigation = { ...entry.mitigation, inhibitorUsed: false };
    const row = deriveTableRow(entry, { inServiceInspectionPossible: false });
    expect(row.slcInhibitedMm).toBeNull();
    expect(row.slcUninhibitedMm).toBeGreaterThan(0);
  });

  it("alternatif malzemenin CTL/ATL'i her zaman uygulanamaz olarak işaretlenir (motor CRA modellemiyor)", () => {
    const entry = buildEntry("wet-gas-gathering");
    const row = deriveTableRow(entry, { inServiceInspectionPossible: false });
    expect(row.ctlAtlAlternativeApplicable).toBe(false);
  });

  it("componentLabel ve computedAt taslaktan doğru taşınır", () => {
    const entry = buildEntry("sandy-wellhead");
    const row = deriveTableRow(entry, { inServiceInspectionPossible: false });
    expect(row.componentLabel).toBe(entry.componentLabel);
    expect(row.computedAt).toBe(entry.computedAt);
  });
});

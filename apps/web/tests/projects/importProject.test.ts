// apps/web/tests/projects/importProject.test.ts

import { describe, expect, it } from "vitest";
import { buildEc3dFile } from "../../src/features/projects/exportProject";
import { parseEc3dFile } from "../../src/features/projects/importProject";
import { ec3dJsonReplacer } from "../../src/features/projects/ec3dSerialization";
import { buildTestAssessmentHistoryEntry } from "../report/testFixtures";
import type { AssessmentRunRecord, ProjectComponentRecord, ProjectRecord } from "../../src/features/projects/types";

function buildFixturePackage() {
  const entry = buildTestAssessmentHistoryEntry();
  const project: ProjectRecord = {
    id: "proj-1",
    name: "Test Projesi",
    client: "Test Müşteri",
    facility: "Test Tesis",
    createdBy: "Test Kullanıcı",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: "0",
  };
  const component: ProjectComponentRecord = {
    id: "comp-1",
    projectId: project.id,
    componentLabel: entry.componentLabel,
    componentCategory: "PIPE_FITTING",
    geometry: entry.geometry,
    valveGeometry: undefined,
    mitigation: entry.mitigation,
    operatingProfile: entry.operatingProfile,
    activeStep: 1,
    activeCaseIndex: 0,
    uncertainNotes: [],
    updatedAt: Date.now(),
  };
  const run: AssessmentRunRecord = {
    id: "run-1",
    projectId: project.id,
    componentId: component.id,
    componentLabel: entry.componentLabel,
    computedAt: Date.now(),
    engineVersion: "0.1.0",
    geometry: entry.geometry,
    mitigation: entry.mitigation,
    operatingProfile: entry.operatingProfile,
    assessment: entry.assessment,
    uninhibitedAssessment: entry.uninhibitedAssessment,
  };
  return { project, component, run };
}

describe("parseEc3dFile", () => {
  it("geçerli bir dosyayı ayrıştırır ve YENİ id'ler atar", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.id).not.toBe(project.id);
    expect(result.data.project.name).toBe(project.name);
    expect(result.data.components).toHaveLength(1);
    expect(result.data.components[0]!.id).not.toBe(component.id);
    expect(result.data.components[0]!.projectId).toBe(result.data.project.id);
    expect(result.data.assessmentRuns).toHaveLength(1);
    expect(result.data.assessmentRuns[0]!.componentId).toBe(result.data.components[0]!.id);
  });

  it("Float32Array KAYIPSIZ round-trip eder (JSON serileştirme sorunu YOK)", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const originalField = run.assessment.perCase[0]!.spatialDamageFieldFullLife;
    const roundTrippedField = result.data.assessmentRuns[0]!.assessment.perCase[0]!.spatialDamageFieldFullLife;
    expect(roundTrippedField.valuesMm).toBeInstanceOf(Float32Array);
    expect(roundTrippedField.valuesMm.length).toBe(originalField.valuesMm.length);
    expect(Array.from(roundTrippedField.valuesMm)).toEqual(Array.from(originalField.valuesMm));
  });

  it("hesap izindeki gerçek NaN değerleri (ör. glikol adımı) KAYIPSIZ round-trip eder", () => {
    const { project, component, run } = buildFixturePackage();
    // Gerçek veride NaN üreten mekanizma/adımı BULMAYA çalışmak yerine (kırılgan),
    // JSON'ın NaN'ı taşıyamadığı GERÇEĞİNİ doğrudan test eder: mevcut bir hesap
    // izi adımının çıktısını NaN'a ÇEVİRİP round-trip'in onu KORUDUĞUNU doğrular.
    const stepWithNan = run.assessment.perCase[0]!.mechanismResults[0]!.calculationTrace[0];
    if (stepWithNan) {
      stepWithNan.output = Number.NaN;
      stepWithNan.inputs["testNan"] = Number.NaN;
    }
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (stepWithNan) {
      const roundTrippedStep = result.data.assessmentRuns[0]!.assessment.perCase[0]!.mechanismResults[0]!.calculationTrace[0]!;
      expect(Number.isNaN(roundTrippedStep.output)).toBe(true);
      expect(Number.isNaN(roundTrippedStep.inputs["testNan"])).toBe(true);
    }
  });

  it("bozuk JSON için Türkçe hata döner", () => {
    const result = parseEc3dFile("{ bu geçerli json değil");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain("JSON");
  });

  it("beklenen biçime uymayan (ama geçerli) JSON için Türkçe hata döner", () => {
    const result = parseEc3dFile(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain(".ec3d");
  });
});

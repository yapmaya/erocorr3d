// apps/web/tests/projects/compareRuns.test.ts

import { describe, expect, it } from "vitest";
import { REFERENCE_FACILITY_FIXTURES, assessComponentScenario, ENGINE_VERSION } from "@erocorr3d/engine";
import { compareAssessmentRuns } from "../../src/features/projects/compareRuns";
import type { AssessmentRunRecord } from "../../src/features/projects/types";

function buildRun(fixtureIndex: number, overrides: Partial<AssessmentRunRecord> = {}): AssessmentRunRecord {
  const fixture = REFERENCE_FACILITY_FIXTURES[fixtureIndex]!;
  const assessment = assessComponentScenario(fixture.geometry, fixture.mitigation, fixture.operatingProfile, {}, fixture.streamId, {
    resolutionU: 8,
    resolutionV: 8,
  });
  return {
    id: `run-${fixtureIndex}`,
    projectId: "p1",
    componentId: `c-${fixtureIndex}`,
    componentLabel: fixture.streamId,
    computedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
    geometry: fixture.geometry,
    mitigation: fixture.mitigation,
    operatingProfile: fixture.operatingProfile,
    assessment,
    uninhibitedAssessment: assessment,
    ...overrides,
  };
}

describe("compareAssessmentRuns", () => {
  it("AYNI çalıştırma kendisiyle karşılaştırılınca hiçbir alan DEĞİŞMEZ", () => {
    const run = buildRun(0);
    const comparison = compareAssessmentRuns(run, { ...run });
    expect(comparison.inputDeltas.every((d) => !d.changed)).toBe(true);
    expect(comparison.resultDeltas.every((d) => !d.changed)).toBe(true);
    expect(comparison.summaryTr).toEqual([]);
    expect(comparison.engineVersionChanged).toBe(false);
  });

  it("engineVersion farklıysa engineVersionChanged=true ve özet metne yansır", () => {
    const runA = buildRun(0);
    const runB = buildRun(0, { engineVersion: "9.9.9" });
    const comparison = compareAssessmentRuns(runA, runB);
    expect(comparison.engineVersionChanged).toBe(true);
    expect(comparison.summaryTr.some((s) => s.includes("Motor Sürümü"))).toBe(true);
  });

  it("farklı bileşenler (farklı geometri/assessment) karşılaştırıldığında girdi VE sonuç delta'ları yakalanır", () => {
    const runA = buildRun(0);
    const runB = buildRun(1);
    const comparison = compareAssessmentRuns(runA, runB);
    expect(comparison.inputDeltas.some((d) => d.changed)).toBe(true);
    expect(comparison.resultDeltas.some((d) => d.changed)).toBe(true);
    expect(comparison.summaryTr.length).toBeGreaterThan(0);
  });

  it("mechanismDeltas her iki çalıştırmanın belirleyici senaryosundaki mekanizmaları eşler", () => {
    const runA = buildRun(0);
    const runB = buildRun(1);
    const comparison = compareAssessmentRuns(runA, runB);
    expect(comparison.mechanismDeltas.length).toBeGreaterThan(0);
    for (const m of comparison.mechanismDeltas) {
      expect(m.mechanismId.length).toBeGreaterThan(0);
    }
  });
});

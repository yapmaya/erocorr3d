// apps/web/tests/store/traceabilityStore.test.ts

import { describe, expect, it } from "vitest";
import { useTraceabilityStore } from "../../src/store/traceabilityStore";
import { buildTestAssessmentHistoryEntry } from "../report/testFixtures";

describe("traceabilityStore", () => {
  it("başlangıçta kapalıdır", () => {
    expect(useTraceabilityStore.getState().openMechanism).toBeNull();
  });

  it("open() bir mekanizmayı ayarlar, close() sıfırlar", () => {
    const entry = buildTestAssessmentHistoryEntry();
    const mechanism = entry.assessment.perCase[0]!.mechanismResults[0]!;

    useTraceabilityStore.getState().open(mechanism);
    expect(useTraceabilityStore.getState().openMechanism).toBe(mechanism);

    useTraceabilityStore.getState().close();
    expect(useTraceabilityStore.getState().openMechanism).toBeNull();
  });
});

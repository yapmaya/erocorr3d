// apps/web/tests/lib/perfMetrics.test.ts

import { describe, expect, it } from "vitest";
import { isWithinBudget, PERF_BUDGETS } from "../../src/lib/perfMetrics";

describe("isWithinBudget", () => {
  it("loadMs/calcMs: bütçenin altında/eşit -> true, üstünde -> false", () => {
    expect(isWithinBudget("loadMs", PERF_BUDGETS.loadMs)).toBe(true);
    expect(isWithinBudget("loadMs", PERF_BUDGETS.loadMs - 1)).toBe(true);
    expect(isWithinBudget("loadMs", PERF_BUDGETS.loadMs + 1)).toBe(false);
    expect(isWithinBudget("calcMs", PERF_BUDGETS.calcMs + 1)).toBe(false);
  });

  it("fps: bütçenin üstünde/eşit -> true, altında -> false", () => {
    expect(isWithinBudget("fps", PERF_BUDGETS.fps)).toBe(true);
    expect(isWithinBudget("fps", PERF_BUDGETS.fps + 5)).toBe(true);
    expect(isWithinBudget("fps", PERF_BUDGETS.fps - 1)).toBe(false);
  });
});

// apps/web/tests/projects/rankRiskiestComponents.test.ts

import { describe, expect, it } from "vitest";
import { computeCtlAtl } from "@erocorr3d/engine";
import { rankRiskiestComponents, type ComponentRiskInput } from "../../src/features/projects/rankRiskiestComponents";

function makeInput(componentId: string, ratio: number | null, slcP50Mm: number): ComponentRiskInput {
  return {
    componentId,
    componentLabel: componentId,
    ctlAtl: ratio === null ? null : computeCtlAtl({ predictedTotalCorrosionMm: ratio * 10, selectedCorrosionAllowanceMm: 10 }),
    slcP50Mm,
  };
}

describe("rankRiskiestComponents", () => {
  it("CTL/ATL oranına göre BÜYÜKTEN KÜÇÜĞE sıralar", () => {
    const inputs = [makeInput("a", 0.2, 2), makeInput("b", 0.9, 9), makeInput("c", 0.5, 5)];
    const ranked = rankRiskiestComponents(inputs);
    expect(ranked.map((r) => r.componentId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("ctlAtl=null olan bileşenler EN SONA düşer, aralarında SLC P50'ye göre sıralanır", () => {
    const inputs = [makeInput("no-ca-low", null, 1), makeInput("has-ca", 0.3, 3), makeInput("no-ca-high", null, 8)];
    const ranked = rankRiskiestComponents(inputs);
    expect(ranked.map((r) => r.componentId)).toEqual(["has-ca", "no-ca-high", "no-ca-low"]);
  });

  it("topN'i doğru şekilde sınırlar", () => {
    const inputs = Array.from({ length: 15 }, (_, i) => makeInput(`c${i}`, i / 15, i));
    const ranked = rankRiskiestComponents(inputs, 10);
    expect(ranked).toHaveLength(10);
    expect(ranked[0]!.componentId).toBe("c14");
  });

  it("boş girdi için boş dizi döner", () => {
    expect(rankRiskiestComponents([])).toEqual([]);
  });
});

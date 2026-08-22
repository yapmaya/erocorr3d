// packages/engine/tests/erosion/index.test.ts

import { describe, expect, it } from "vitest";
import { runCombinedErosionScreening, selectDnvErosionModel } from "../../src/erosion/index";

describe("selectDnvErosionModel", () => {
  it("dirsek tiplerini BEND modeline yönlendirir", () => {
    expect(selectDnvErosionModel("ELBOW_90").modelId).toBe("BEND");
    expect(selectDnvErosionModel("BEND_LONG_RADIUS").modelId).toBe("BEND");
  });

  it("kör Te'yi BLIND_TEE, dallanma Te'yi TEE_BRANCH modeline yönlendirir", () => {
    expect(selectDnvErosionModel("TEE_BLIND").modelId).toBe("BLIND_TEE");
    expect(selectDnvErosionModel("TEE_BRANCH").modelId).toBe("TEE_BRANCH");
    expect(selectDnvErosionModel("TEE_SWEEPING").modelId).toBe("TEE_BRANCH");
  });

  it("choke ve kontrol vanalarını CHOKE_VALVE modeline yönlendirir", () => {
    expect(selectDnvErosionModel("CHOKE_VALVE").modelId).toBe("CHOKE_VALVE");
    expect(selectDnvErosionModel("CONTROL_VALVE_GLOBE").modelId).toBe("CHOKE_VALVE");
  });

  it("redüksiyon ve kısıtlama orifisini ayrı ayrı yönlendirir", () => {
    expect(selectDnvErosionModel("REDUCER_CONCENTRIC").modelId).toBe("REDUCER");
    expect(selectDnvErosionModel("RESTRICTION_ORIFICE").modelId).toBe("RESTRICTION_ORIFICE");
  });

  it("kapsanmayan vana tiplerinde GENERIC_KERNEL_ONLY döner", () => {
    expect(selectDnvErosionModel("GATE_VALVE").modelId).toBe("GENERIC_KERNEL_ONLY");
  });

  it("her seçim Türkçe bir gerekçe döndürür", () => {
    const result = selectDnvErosionModel("MITER_BEND");
    expect(result.rationaleTr.length).toBeGreaterThan(0);
  });
});

describe("runCombinedErosionScreening", () => {
  it("her iki tarama da güvenliyse anyScreeningExceeded=false döner", () => {
    const result = runCombinedErosionScreening({
      api14e: {
        mixtureDensityKgM3: 100,
        actualVelocityMs: 1,
        fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
        serviceType: "CONTINUOUS",
      },
      droplet: { actualGasVelocityMs: 10, entrainedLiquidPresent: false },
    });
    expect(result.anyScreeningExceeded).toBe(false);
  });

  it("herhangi biri aşarsa anyScreeningExceeded=true döner", () => {
    const result = runCombinedErosionScreening({
      api14e: {
        mixtureDensityKgM3: 100,
        actualVelocityMs: 1,
        fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
        serviceType: "CONTINUOUS",
      },
      droplet: { actualGasVelocityMs: 120, entrainedLiquidPresent: true },
    });
    expect(result.anyScreeningExceeded).toBe(true);
  });
});

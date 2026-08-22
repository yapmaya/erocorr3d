// apps/web/tests/input/componentPreview.test.ts

import { describe, expect, it } from "vitest";
import type { ComponentType } from "@erocorr3d/engine";
import { buildComponentPreviewGeometry } from "../../src/features/input/componentPreview";
import { createDefaultGeometry } from "../../src/features/input/defaultDraft";

const PIPE_FITTING_TYPES: ComponentType[] = [
  "STRAIGHT_PIPE",
  "ELBOW_90",
  "ELBOW_45",
  "BEND_LONG_RADIUS",
  "BEND_SHORT_RADIUS",
  "MITER_BEND",
  "TEE_BLIND",
  "TEE_SWEEPING",
  "TEE_BRANCH",
  "REDUCER_CONCENTRIC",
  "REDUCER_ECCENTRIC",
  "WELDOLET",
  "WELD_JOINT",
  "FLANGE_WELD_NECK",
  "RESTRICTION_ORIFICE",
];

describe("buildComponentPreviewGeometry", () => {
  it.each(PIPE_FITTING_TYPES)("%s için geçerli bir BufferGeometry üretir", (componentType) => {
    const geometry = createDefaultGeometry();
    const result = buildComponentPreviewGeometry(componentType, geometry, "low");
    expect(result.geometry.attributes.position.count).toBeGreaterThan(0);
    result.geometry.dispose();
  });

  it("branchNps/outletNps verilmediğinde de (yaklaşık varsayılanla) çökmez", () => {
    const geometry = createDefaultGeometry();
    const result = buildComponentPreviewGeometry("TEE_BRANCH", geometry, "low");
    expect(result.geometry.attributes.position.count).toBeGreaterThan(0);
    result.geometry.dispose();
  });
});

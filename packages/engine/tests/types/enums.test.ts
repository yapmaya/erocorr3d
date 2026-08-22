// packages/engine/tests/types/enums.test.ts

import { describe, expect, it } from "vitest";
import {
  ComponentTypeEnum,
  COMPONENT_TYPE_LABELS,
  FlowDirectionEnum,
  FLOW_DIRECTION_LABELS,
  FlowRegimeEnum,
  FLOW_REGIME_LABELS,
  InstallationEnum,
  INSTALLATION_LABELS,
  InternalLiningEnum,
  INTERNAL_LINING_LABELS,
  LikelihoodCategoryEnum,
  LIKELIHOOD_CATEGORY_LABELS,
  MechanismConfidenceEnum,
  MECHANISM_CONFIDENCE_LABELS,
  OrientationEnum,
  ORIENTATION_LABELS,
  PressureClassEnum,
  SpatialParameterizationEnum,
  SPATIAL_PARAMETERIZATION_LABELS,
  TrimTypeEnum,
  TRIM_TYPE_LABELS,
} from "../../src/types/enums";

describe("enum + etiket sözlüğü tutarlılığı", () => {
  const cases: Array<[typeof ComponentTypeEnum, Record<string, { tr: string; en: string }>, string]> = [
    [ComponentTypeEnum, COMPONENT_TYPE_LABELS, "ComponentType"],
    [OrientationEnum, ORIENTATION_LABELS, "Orientation"],
    [InstallationEnum, INSTALLATION_LABELS, "Installation"],
    [FlowRegimeEnum, FLOW_REGIME_LABELS, "FlowRegime"],
    [InternalLiningEnum, INTERNAL_LINING_LABELS, "InternalLining"],
    [TrimTypeEnum, TRIM_TYPE_LABELS, "TrimType"],
    [FlowDirectionEnum, FLOW_DIRECTION_LABELS, "FlowDirection"],
    [LikelihoodCategoryEnum, LIKELIHOOD_CATEGORY_LABELS, "LikelihoodCategory"],
    [MechanismConfidenceEnum, MECHANISM_CONFIDENCE_LABELS, "MechanismConfidence"],
    [SpatialParameterizationEnum, SPATIAL_PARAMETERIZATION_LABELS, "SpatialParameterization"],
  ];

  for (const [zodEnum, labels, name] of cases) {
    it(`${name}: her enum değerinin TR ve EN etiketi vardır`, () => {
      for (const value of zodEnum.options) {
        const label = labels[value as string];
        expect(label, `${name}.${value} için etiket eksik`).toBeDefined();
        expect(label.tr.length).toBeGreaterThan(0);
        expect(label.en.length).toBeGreaterThan(0);
      }
    });

    it(`${name}: etiket sözlüğünde fazladan/hayalet anahtar yok`, () => {
      const enumValues = new Set(zodEnum.options as string[]);
      for (const key of Object.keys(labels)) {
        expect(enumValues.has(key), `${name} etiket sözlüğünde geçersiz anahtar: ${key}`).toBe(true);
      }
    });
  }

  it("geçersiz bir ComponentType değerini reddeder", () => {
    expect(ComponentTypeEnum.safeParse("NOT_A_REAL_TYPE").success).toBe(false);
  });

  it("PressureClassEnum yalnızca ANSI sınıflarını kabul eder", () => {
    expect(PressureClassEnum.safeParse(600).success).toBe(true);
    expect(PressureClassEnum.safeParse(400).success).toBe(false);
  });
});

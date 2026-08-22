// apps/web/tests/input/computeAssessment.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import { computeAssessment, VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR } from "../../src/features/input/computeAssessment";
import { createBlankDraft, createDefaultValveGeometry } from "../../src/features/input/defaultDraft";
import { useAssessmentStore } from "../../src/store/assessmentStore";

describe("computeAssessment", () => {
  beforeEach(() => {
    useAssessmentStore.getState().clear();
  });

  it("geçerli bir PIPE_FITTING taslağı için başarıyla hesaplar ve store'a yazar", () => {
    const draft = createBlankDraft();
    const result = computeAssessment(draft);
    expect(result.ok).toBe(true);
    const state = useAssessmentStore.getState();
    expect(state.status).toBe("COMPUTED");
    expect(state.assessment).not.toBeNull();
    expect(state.assessment?.perCase.length).toBe(draft.operatingProfile.cases.length);
  });

  it("VALVE kategorisi için sonuç UYDURMAZ — açık, motorun kendi kısıtını yansıtan bir hata döner", () => {
    const draft = createBlankDraft();
    draft.componentCategory = "VALVE";
    draft.valveGeometry = createDefaultValveGeometry();
    const result = computeAssessment(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.messageTr).toBe(VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR);
    }
    expect(useAssessmentStore.getState().status).toBe("ERROR");
  });

  it("geçersiz geometri (idMm >= odMm) için hata döner, sessizce yutmaz", () => {
    const draft = createBlankDraft();
    draft.geometry.idMm = draft.geometry.odMm + 10;
    const result = computeAssessment(draft);
    expect(result.ok).toBe(false);
    expect(useAssessmentStore.getState().status).toBe("ERROR");
  });
});

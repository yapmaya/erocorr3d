// apps/web/tests/store/assessmentHistoryStore.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import { useAssessmentHistoryStore } from "../../src/store/assessmentHistoryStore";
import { useAssessmentStore } from "../../src/store/assessmentStore";
import {
  createDefaultGeometry,
  createDefaultMitigation,
  createDefaultOperatingProfile,
} from "../../src/features/input/defaultDraft";

function buildRealAssessment(componentLabel: string) {
  const geometry = createDefaultGeometry();
  const mitigation = createDefaultMitigation();
  const operatingProfile = createDefaultOperatingProfile();
  const assessment = assessComponentScenario(geometry, mitigation, operatingProfile, {}, componentLabel);
  return { geometry, mitigation, operatingProfile, assessment };
}

describe("useAssessmentHistoryStore", () => {
  beforeEach(() => {
    useAssessmentHistoryStore.getState().clear();
    useAssessmentStore.getState().clear();
  });

  it("addEntry yeni bir girdi ekler, otomatik seçer VE useAssessmentStore'u günceller", () => {
    const { geometry, mitigation, operatingProfile, assessment } = buildRealAssessment("Bileşen A");
    const id = useAssessmentHistoryStore.getState().addEntry({
      componentLabel: "Bileşen A",
      geometry,
      mitigation,
      operatingProfile,
      assessment,
      uninhibitedAssessment: assessment,
    });

    const state = useAssessmentHistoryStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe(id);
    expect(state.selectedEntryId).toBe(id);

    const assessmentState = useAssessmentStore.getState();
    expect(assessmentState.status).toBe("COMPUTED");
    expect(assessmentState.componentLabel).toBe("Bileşen A");
  });

  it("iki bileşen eklenince geçmiş her ikisini de tutar (çoklu bileşen tablosu)", () => {
    const a = buildRealAssessment("Bileşen A");
    const b = buildRealAssessment("Bileşen B");
    useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen A", ...a, uninhibitedAssessment: a.assessment });
    useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen B", ...b, uninhibitedAssessment: b.assessment });

    expect(useAssessmentHistoryStore.getState().entries).toHaveLength(2);
    // son eklenen otomatik seçili olmalı
    expect(useAssessmentStore.getState().componentLabel).toBe("Bileşen B");
  });

  it("selectEntry farklı bir satıra geçince useAssessmentStore o satırın verisini yansıtır", () => {
    const a = buildRealAssessment("Bileşen A");
    const b = buildRealAssessment("Bileşen B");
    const idA = useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen A", ...a, uninhibitedAssessment: a.assessment });
    useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen B", ...b, uninhibitedAssessment: b.assessment });

    useAssessmentHistoryStore.getState().selectEntry(idA);
    expect(useAssessmentHistoryStore.getState().selectedEntryId).toBe(idA);
    expect(useAssessmentStore.getState().componentLabel).toBe("Bileşen A");
  });

  it("removeEntry silinen girdi seçiliyse seçimi temizler, değilse dokunmaz", () => {
    const a = buildRealAssessment("Bileşen A");
    const b = buildRealAssessment("Bileşen B");
    const idA = useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen A", ...a, uninhibitedAssessment: a.assessment });
    const idB = useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen B", ...b, uninhibitedAssessment: b.assessment });

    useAssessmentHistoryStore.getState().removeEntry(idA);
    expect(useAssessmentHistoryStore.getState().entries.map((e) => e.id)).toEqual([idB]);
    expect(useAssessmentHistoryStore.getState().selectedEntryId).toBe(idB); // idB seçiliydi, dokunulmadı

    useAssessmentHistoryStore.getState().removeEntry(idB);
    expect(useAssessmentHistoryStore.getState().selectedEntryId).toBeNull();
  });

  it("clear geçmişi ve seçimi tamamen boşaltır", () => {
    const a = buildRealAssessment("Bileşen A");
    useAssessmentHistoryStore.getState().addEntry({ componentLabel: "Bileşen A", ...a, uninhibitedAssessment: a.assessment });
    useAssessmentHistoryStore.getState().clear();
    expect(useAssessmentHistoryStore.getState().entries).toEqual([]);
    expect(useAssessmentHistoryStore.getState().selectedEntryId).toBeNull();
  });
});

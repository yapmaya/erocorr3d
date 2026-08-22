// apps/web/src/features/projects/persistAssessmentRun.ts
//
// Proje bağlamında "Hesapla"nın kalıcı yarısı — `features/input/
// computeAssessment.ts`'in AYNI motor çağrı desenini (gerçek + inhibitörsüz
// "ne olurdu" çalıştırması) izler ama sonucu `useAssessmentStore`/
// `assessmentHistoryStore`'a DEĞİL, `AssessmentRunRecord` olarak Dexie'ye
// yazar (bkz. onaylı plan: "proje dışı akış DEĞİŞMEZ", bu AYRI bir yoldur).
//
// SAF DEĞİL (Dexie yan etkisi) — test edilmez (bkz. db.ts'in AYNI notu).

import { assessComponentScenario, ENGINE_VERSION, GeometrySchema, MitigationSchema, OperatingProfileSchema } from "@erocorr3d/engine";
import { VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR } from "../input/computeAssessment";
import type { WizardDraft } from "../input/schema";
import { useProjectsStore } from "../../store/projectsStore";
import type { AssessmentRunRecord } from "./types";

export type PersistAssessmentRunResult = { ok: true } | { ok: false; errorTr: string };

export async function persistAssessmentRun(projectId: string, componentId: string, draft: WizardDraft): Promise<PersistAssessmentRunResult> {
  if (draft.componentCategory === "VALVE") {
    return { ok: false, errorTr: VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR };
  }

  try {
    const geometry = GeometrySchema.parse(draft.geometry);
    const mitigation = MitigationSchema.parse(draft.mitigation);
    const operatingProfile = OperatingProfileSchema.parse(draft.operatingProfile);
    const assessment = assessComponentScenario(geometry, mitigation, operatingProfile, {}, draft.componentLabel);
    const uninhibitedAssessment = mitigation.inhibitorUsed
      ? assessComponentScenario(geometry, { ...mitigation, inhibitorUsed: false }, operatingProfile, {}, draft.componentLabel)
      : assessment;

    const run: AssessmentRunRecord = {
      id: crypto.randomUUID(),
      projectId,
      componentId,
      componentLabel: draft.componentLabel,
      computedAt: Date.now(),
      engineVersion: ENGINE_VERSION,
      geometry,
      mitigation,
      operatingProfile,
      assessment,
      uninhibitedAssessment,
    };
    await useProjectsStore.getState().addAssessmentRun(run);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorTr: error instanceof Error ? `Hesaplama sırasında hata: ${error.message}` : "Hesaplama sırasında bilinmeyen bir hata oluştu.",
    };
  }
}

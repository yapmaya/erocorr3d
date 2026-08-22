// apps/web/tests/report/testFixtures.ts
//
// Rapor testlerinin ORTAK yardımcıları — GERÇEK BOTAŞ fixture'ından
// (packages/engine/src/fixtures/botas.ts), GERÇEK motor orkestrasyonuyla
// (`assessComponentScenario`) türetilmiş bir `AssessmentHistoryEntry`
// üretir. Sahte/uydurulmuş bir sonuç nesnesi el ile kurulmaz — testler
// motorun GERÇEK çıktısını kullanır (bkz. botasScenarios.ts'in AYNI deseni).

import { BOTAS_FIXTURES, assessComponentScenario } from "@erocorr3d/engine";
import type { AssessmentHistoryEntry } from "../../src/store/assessmentHistoryStore";
import type { ReportSettings } from "../../src/features/report/reportSettingsTypes";

export function buildTestAssessmentHistoryEntry(): AssessmentHistoryEntry {
  const fixture = BOTAS_FIXTURES[0]!;
  const assessment = assessComponentScenario(fixture.geometry, fixture.mitigation, fixture.operatingProfile, {}, fixture.streamId, {
    resolutionU: 16,
    resolutionV: 12,
  });
  return {
    id: "test-entry-1",
    componentLabel: fixture.streamId,
    geometry: fixture.geometry,
    mitigation: fixture.mitigation,
    operatingProfile: fixture.operatingProfile,
    assessment,
    uninhibitedAssessment: assessment,
    computedAt: Date.now(),
  };
}

export function buildTestReportSettings(): ReportSettings {
  return {
    companyName: "Test A.Ş.",
    logoDataUrl: null,
    projectName: "Test Projesi",
    documentNo: "TEST-DOC-001",
    revision: "0",
    revisionHistory: [{ id: "r1", rev: "0", date: "2026-01-01", descriptionTr: "İlk yayın", descriptionEn: "Initial issue", by: "Test" }],
    preparedBy: "A. Test",
    checkedBy: "B. Test",
    approvedBy: "C. Test",
    reportLanguage: "tr",
  };
}

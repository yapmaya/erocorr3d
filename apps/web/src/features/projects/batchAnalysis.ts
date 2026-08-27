// apps/web/src/features/projects/batchAnalysis.ts
//
// Projedeki TÜM bileşenleri Web Worker'da (assessmentWorker.ts) SIRAYLA
// değerlendirir, her sonucu kalıcı bir AssessmentRunRecord olarak yazar
// (bkz. store/projectsStore.ts::addAssessmentRun) ve en riskli 10 bileşen
// sıralamasını üretir (rankRiskiestComponents.ts — SAF kısım). VANA
// kategorisi bileşenler `computeAssessment.ts`'in KENDİ kısıtıyla TUTARLI
// şekilde atlanır (motor vana orkestrasyonu taşımıyor, bkz. o dosyanın
// VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR sabiti).
//
// SAF DEĞİL (Worker/Dexie yan etkisi) — Vitest ile test EDİLMEZ (bkz.
// features/projects/db.ts'in AYNI gerekçeli notu); `rankRiskiestComponents`
// AYRI test edilir.

import { computeCtlAtl, ENGINE_VERSION, GeometrySchema, MitigationSchema, OperatingProfileSchema, type Geometry } from "@erocorr3d/engine";
import { createAssessmentWorkerClient, WorkerFatalError } from "../../workers/assessmentWorkerClient";
import { TimeoutError } from "../../lib/withTimeout";
import { useProjectsStore } from "../../store/projectsStore";
import type { AssessmentRunRecord, ProjectComponentRecord } from "./types";
import { rankRiskiestComponents, type ComponentRiskInput, type ComponentRiskRanking } from "./rankRiskiestComponents";

export interface BatchAnalysisProgress {
  completed: number;
  total: number;
  currentComponentLabel: string | null;
}

export interface BatchAnalysisSummary {
  totalComponents: number;
  computedCount: number;
  skippedCount: number;
  skippedReasonsTr: string[];
  riskRanking: ComponentRiskRanking[];
}

export async function runBatchAnalysis(
  projectId: string,
  components: ProjectComponentRecord[],
  onProgress: (progress: BatchAnalysisProgress) => void,
): Promise<BatchAnalysisSummary> {
  const client = createAssessmentWorkerClient();
  const skippedReasonsTr: string[] = [];
  const riskInputs: ComponentRiskInput[] = [];

  try {
    for (let i = 0; i < components.length; i++) {
      const component = components[i]!;
      onProgress({ completed: i, total: components.length, currentComponentLabel: component.componentLabel });

      if (component.componentCategory === "VALVE") {
        skippedReasonsTr.push(`${component.componentLabel}: vana kategorisi desteklenmiyor (motor vana orkestrasyonu taşımıyor)`);
        continue;
      }

      try {
        // Eski (bu oturumdan önce kaydedilmiş) bir bileşende locationClass/
        // environmentalSensitivity EKSİK olabilir (bkz. defaultDraft.ts::
        // backfillDraftDefaults'ın AYNI gerekçesi — ComponentForm bu yolu
        // KULLANMAZ, kayıtlı bileşen doğrudan Dexie'den okunur) — spread
        // sırası (varsayılanlar ÖNCE) yalnızca EKSİK alanları doldurur.
        // `as Partial<Geometry>`: statik tip bu alanların HER ZAMAN var
        // olduğunu garanti eder, ama Dexie'den gelen ÇALIŞMA-ZAMANI veri
        // eski bir şema sürümüyle kaydedilmiş olabilir — bu cast o gerçek
        // çalışma-zamanı belirsizliğini yansıtır (`any` DEĞİLDİR).
        const geometry = GeometrySchema.parse({
          locationClass: 1,
          environmentalSensitivity: "MEDIUM",
          ...(component.geometry as Partial<Geometry>),
        });
        const mitigation = MitigationSchema.parse(component.mitigation);
        const operatingProfile = OperatingProfileSchema.parse(component.operatingProfile);

        const assessment = await client.assessOne(geometry, mitigation, operatingProfile, component.componentLabel);
        const uninhibitedAssessment = mitigation.inhibitorUsed
          ? await client.assessOne(geometry, { ...mitigation, inhibitorUsed: false }, operatingProfile, component.componentLabel)
          : assessment;

        const run: AssessmentRunRecord = {
          id: crypto.randomUUID(),
          projectId,
          componentId: component.id,
          componentLabel: component.componentLabel,
          computedAt: Date.now(),
          engineVersion: ENGINE_VERSION,
          geometry,
          mitigation,
          operatingProfile,
          assessment,
          uninhibitedAssessment,
        };
        await useProjectsStore.getState().addAssessmentRun(run);

        const ctlAtl =
          operatingProfile.corrosionAllowanceMm > 0
            ? computeCtlAtl({
                predictedTotalCorrosionMm: assessment.metalLoss.totalServiceLifeCorrosionMm.p50,
                selectedCorrosionAllowanceMm: operatingProfile.corrosionAllowanceMm,
              })
            : null;
        riskInputs.push({
          componentId: component.id,
          componentLabel: component.componentLabel,
          ctlAtl,
          slcP50Mm: assessment.metalLoss.totalServiceLifeCorrosionMm.p50,
        });
      } catch (error) {
        // Worker zaman aşımına uğradıysa (yanıt vermiyor) veya tamamen
        // çöktüyse, kalan bileşenler için TEK TEK tekrar 30 sn beklemenin
        // anlamı yok — worker artık ölü sayılır ve döngü burada durdurulur.
        if (error instanceof TimeoutError || error instanceof WorkerFatalError) {
          const remainingCount = components.length - i;
          skippedReasonsTr.push(`Analiz motoru (worker) yanıt vermediği için kalan ${remainingCount} bileşen atlandı: ${error.message}`);
          break;
        }
        skippedReasonsTr.push(`${component.componentLabel}: hesap hatası — ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
      }
    }
  } finally {
    client.terminate();
  }

  onProgress({ completed: components.length, total: components.length, currentComponentLabel: null });

  return {
    totalComponents: components.length,
    computedCount: riskInputs.length,
    skippedCount: skippedReasonsTr.length,
    skippedReasonsTr,
    riskRanking: rankRiskiestComponents(riskInputs),
  };
}

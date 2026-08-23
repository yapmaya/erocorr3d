// apps/web/src/features/inspectionPlan/InspectionPlanTab.tsx
//
// Muayene Planı sekmesi (master görev) — Sonuç Tablosu (A) ve diğer 8 grafik
// gibi `useAssessmentHistoryStore`'un SEÇİLİ girdisini kullanır. Beş bölüm:
// Kritik İzleme Noktaları (CMP), Muayene Aralığı, RBI-lite Risk Matrisi,
// Azaltma Önerileri, Yaşam Döngüsü Maliyeti — hepsi TEK bir türetme
// kaynağından (inspectionPlanDerivation.ts) beslenir.

import { useMemo, useState } from "react";
import { useAssessmentHistoryStore } from "../../store/assessmentHistoryStore";
import { NumberInput } from "./components/NumberInput";
import { deriveInspectionPlanBundle, deriveLifecycleCostComparison } from "./inspectionPlanDerivation";
import { CriticalMonitoringPointsList } from "./CriticalMonitoringPointsList";
import { InspectionIntervalCard } from "./InspectionIntervalCard";
import { RiskMatrixGrid } from "./RiskMatrixGrid";
import { MitigationRecommendationsList } from "./MitigationRecommendationsList";
import { LifecycleCostComparison } from "./LifecycleCostComparison";

export function InspectionPlanTab() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);

  const [yearsInService, setYearsInService] = useState(0);
  const [discountRatePercent, setDiscountRatePercent] = useState<number | undefined>(undefined);
  const [inhibitorAnnualCostFactor, setInhibitorAnnualCostFactor] = useState<number | undefined>(undefined);
  const [monitoringAnnualCostFactor, setMonitoringAnnualCostFactor] = useState<number | undefined>(undefined);

  const asOfDate = useMemo(() => new Date(), []);

  const bundle = useMemo(() => {
    if (!entry) return null;
    return deriveInspectionPlanBundle(entry, asOfDate, yearsInService);
  }, [entry, asOfDate, yearsInService]);

  const lifecycleCost = useMemo(() => {
    if (!bundle) return null;
    return deriveLifecycleCostComparison(bundle.inspectionInterval.recommendedIntervalYears, {
      discountRatePercent,
      inhibitorAnnualCostFactor,
      monitoringAnnualCostFactor,
    });
  }, [bundle, discountRatePercent, inhibitorAnnualCostFactor, monitoringAnnualCostFactor]);

  if (!entry || !bundle || !lifecycleCost) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-neutral-900 dark:text-neutral-100">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold">{entry.componentLabel} — Muayene Planı</h2>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Belirleyici senaryo: {entry.assessment.governingCaseName} · Bugünkü tarih (varsayım): {asOfDate.toISOString().slice(0, 10)}
          </p>
        </div>
        <label className="text-xs">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Bileşenin işletmede olduğu süre (yıl)</span>
          <NumberInput value={yearsInService} onChange={setYearsInService} min={0} step={0.5} className="w-32" />
        </label>
      </div>

      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        Bu sonuçlar mühendislik tahminidir. Model belirsizliği tipik olarak 2-3 kat mertebesindedir. Nihai muayene/malzeme kararı
        yetkin bir korozyon/bütünlük mühendisinin onayını gerektirir.
      </p>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          1. Kritik İzleme Noktaları (CMP)
        </h3>
        <CriticalMonitoringPointsList result={bundle.cmp} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">2. Muayene Aralığı</h3>
        <InspectionIntervalCard result={bundle.inspectionInterval} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          3. RBI-lite Risk Matrisi
        </h3>
        <RiskMatrixGrid result={bundle.riskMatrix} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">4. Azaltma Önerileri</h3>
        <MitigationRecommendationsList result={bundle.mitigations} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          5. Yaşam Döngüsü Maliyet Karşılaştırması
        </h3>
        <LifecycleCostComparison
          result={lifecycleCost}
          discountRatePercent={discountRatePercent}
          inhibitorAnnualCostFactor={inhibitorAnnualCostFactor}
          monitoringAnnualCostFactor={monitoringAnnualCostFactor}
          onDiscountRateChange={setDiscountRatePercent}
          onInhibitorFactorChange={setInhibitorAnnualCostFactor}
          onMonitoringFactorChange={setMonitoringAnnualCostFactor}
        />
      </section>
    </div>
  );
}

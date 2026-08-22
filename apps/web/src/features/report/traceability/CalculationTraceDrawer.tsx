// apps/web/src/features/report/traceability/CalculationTraceDrawer.tsx
//
// "Hesap İzlenebilirliği" paneli (master görev Part C): bir mekanizma
// sonucuna tıklanınca girdi değerleri → kullanılan denklem (metin) → ara
// değerler → sonuç → kullanılan katsayı ID'leri zincirini gösterir. Veri
// KAYNAĞI motorun ZATEN ürettiği `MechanismResult.calculationTrace`'tir
// (bkz. types/results.ts::TraceStep) — burada yeni bir hesap İCAT EDİLMEZ.
//
// Katsayı çiplerine tıklanınca `getCoefficient(id)` ile kaynak atfı/confidence
// YERİNDE (RegistryPage'e navigasyon GEREKMEDEN) açılır — UnverifiedBadge.tsx'in
// "tıkla→popover aç" desenini izler.

import { useState } from "react";
import { getCoefficient } from "@erocorr3d/engine";
import { useTraceabilityStore } from "../../../store/traceabilityStore";
import { useTranslation } from "../../../i18n/translations";
import { CONFIDENCE_BADGE_STYLES } from "../../results/chartPalette";

function CoefficientChip({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false);
  let coefficient: ReturnType<typeof getCoefficient> | null = null;
  let lookupError: string | null = null;
  try {
    coefficient = getCoefficient(id);
  } catch {
    lookupError = "Kayıt defterinde bulunamadı.";
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        {id}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded border border-neutral-200 bg-white p-2 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {coefficient ? (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-100">{coefficient.id}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES[coefficient.confidence] ?? ""}`}>
                  {coefficient.confidence === "UNVERIFIED" ? "DOĞRULANMAMIŞ" : coefficient.confidence}
                </span>
              </div>
              <div className="text-neutral-600 dark:text-neutral-300">{coefficient.description}</div>
              <div className="mt-1 text-neutral-500 dark:text-neutral-400">
                Değer: <span className="font-mono">{JSON.stringify(coefficient.value)}</span> {coefficient.unit}
              </div>
              <div className="mt-1 border-t border-neutral-100 pt-1 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                Kaynak ({coefficient.source.type}): {coefficient.source.citation}
              </div>
              {coefficient.notes && <div className="mt-1 italic text-neutral-400 dark:text-neutral-500">{coefficient.notes}</div>}
            </>
          ) : (
            <span className="text-neutral-400 dark:text-neutral-500">{lookupError}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function CalculationTraceDrawer() {
  const { locale } = useTranslation();
  const mechanism = useTraceabilityStore((s) => s.openMechanism);
  const close = useTraceabilityStore((s) => s.close);

  if (!mechanism) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={close}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-4 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{locale === "tr" ? mechanism.nameTr : mechanism.nameEn}</h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{mechanism.modelUsed}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-3 rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <span>P10: <span className="font-mono">{mechanism.rateP10.toFixed(3)}</span></span>
          <span>P50: <span className="font-mono font-semibold">{mechanism.rateP50.toFixed(3)}</span></span>
          <span>P90: <span className="font-mono">{mechanism.rateP90.toFixed(3)}</span></span>
          <span className="text-neutral-500 dark:text-neutral-400">mm/yıl</span>
        </div>

        {mechanism.calculationTrace.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Bu mekanizma için adım adım hesap izi kaydedilmemiş (motor bu sonucu doğrudan üretti).
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {mechanism.calculationTrace.map((step, i) => (
              <li key={i} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">{step.stepName}</span>
                </div>
                <div className="mb-1 rounded bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {step.formula}
                </div>
                {Object.keys(step.inputs).length > 0 && (
                  <div className="mb-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    Girdiler:{" "}
                    {Object.entries(step.inputs)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}
                  </div>
                )}
                <div className="mb-1 text-[11px]">
                  Çıktı: <span className="font-mono font-semibold">{step.output}</span> {step.unit}
                </div>
                {step.coefficientIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {step.coefficientIds.map((id) => (
                      <CoefficientChip key={id} id={id} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {mechanism.sourceRefs.length > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Kaynaklar: {mechanism.sourceRefs.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

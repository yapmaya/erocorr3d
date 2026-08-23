// apps/web/src/features/inspectionPlan/RiskMatrixGrid.tsx
//
// RBI-lite risk matrisi ızgarası — @erocorr3d/engine'in
// buildRbiLiteRiskMatrix() sonucunun 20 hücresini (4 olasılık × 5 sonuç)
// render eder, bileşenin KENDİ hücresini vurgular. Hücre-bazlı renklendirme
// (hangi olasılık×sonuç kombinasyonunun yeşil/sarı/turuncu/kırmızı olduğu)
// motorun KENDİ dahili bantlamasıdır (aggregate/riskMatrix.ts) ve dışa
// açılmıyor — bu yüzden burada YALNIZCA bileşenin GERÇEK hücresi motorun
// verdiği `colorTr` ile renklendirilir, diğer 19 hücre nötr gösterilir
// (motorun kendi eşik mantığını UI'da TEKRARLAMAMAK için bilinçli bir
// tercih).

import type { RbiLiteRiskMatrixResult } from "@erocorr3d/engine";
import { CTL_ATL_COLOR_STYLES } from "../results/chartPalette";

const LIKELIHOOD_DISPLAY_ORDER = ["HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"] as const;
const CONSEQUENCE_DISPLAY_ORDER = ["A", "B", "C", "D", "E"] as const;

const LIKELIHOOD_LABELS_TR: Record<string, string> = {
  NEGLIGIBLE: "İhmal Edilebilir",
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
};

export function RiskMatrixGrid({ result }: { result: RbiLiteRiskMatrixResult }) {
  const styles = CTL_ATL_COLOR_STYLES[result.colorTr];

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="p-1"></th>
              {CONSEQUENCE_DISPLAY_ORDER.map((consequence) => (
                <th key={consequence} className="p-1 font-medium text-neutral-500 dark:text-neutral-400">
                  {consequence}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIKELIHOOD_DISPLAY_ORDER.map((likelihood) => (
              <tr key={likelihood}>
                <th className="whitespace-nowrap p-1 pr-2 text-right font-medium text-neutral-500 dark:text-neutral-400">
                  {LIKELIHOOD_LABELS_TR[likelihood]}
                </th>
                {CONSEQUENCE_DISPLAY_ORDER.map((consequence) => {
                  const isComponentCell = likelihood === result.likelihoodCategory && consequence === result.consequence.level;
                  return (
                    <td
                      key={consequence}
                      className={`h-9 w-9 border border-neutral-200 dark:border-neutral-800 ${
                        isComponentCell ? `${styles.bgClass} ${styles.textClass} font-bold ring-2 ring-inset ring-current` : "bg-neutral-50 dark:bg-neutral-900"
                      }`}
                      title={`Olasılık: ${LIKELIHOOD_LABELS_TR[likelihood]} · Sonuç: ${consequence}`}
                    >
                      {isComponentCell ? "●" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        Sonuç ({result.consequence.level}) belirleyici faktör: <span className="font-medium text-neutral-700 dark:text-neutral-200">{result.consequence.governingFactorTr}</span>
      </p>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{result.rationaleTr}</p>
    </div>
  );
}

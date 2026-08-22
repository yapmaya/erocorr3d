// apps/web/src/features/projects/rankRiskiestComponents.ts
//
// SAF fonksiyon: toplu analiz sonrası "en riskli 10 bileşen" sıralaması.
// Motorun KENDİ `computeCtlAtl` sonucunu (CtlAtlResult) girdi olarak alır —
// yeni bir risk skoru İCAT ETMEZ, yalnızca ZATEN hesaplanmış CTL/ATL oranına
// göre sıralar (korozyon payı girilmemiş bileşenler — ctlAtl=null — en sona
// düşer, aralarında SLC P50'ye göre sıralanır; bkz. resultsDerivation.ts'in
// AYNI "CA=0 ise sahte oran uydurulmaz" ilkesi).

import type { CtlAtlResult } from "@erocorr3d/engine";

export interface ComponentRiskInput {
  componentId: string;
  componentLabel: string;
  ctlAtl: CtlAtlResult | null;
  slcP50Mm: number;
}

export interface ComponentRiskRanking extends ComponentRiskInput {
  rank: number;
}

export function rankRiskiestComponents(inputs: ComponentRiskInput[], topN = 10): ComponentRiskRanking[] {
  const sorted = [...inputs].sort((a, b) => {
    const aRatio = a.ctlAtl?.ratio ?? -1;
    const bRatio = b.ctlAtl?.ratio ?? -1;
    if (aRatio !== bRatio) return bRatio - aRatio;
    return b.slcP50Mm - a.slcP50Mm;
  });
  return sorted.slice(0, topN).map((item, index) => ({ ...item, rank: index + 1 }));
}

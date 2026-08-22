// apps/web/src/features/results/ResultsPanel.tsx
//
// Sağ panel — girdi sihirbazının "Hesapla" geçmişinden SEÇİLİ bileşenin
// özet kartlarını gösterir (bkz. components/SummaryCards.tsx). Ayrıntılı
// tablo (A) ve 8 grafik (B-H) alt çekmecede (bkz. ResultsBottomPanel.tsx).

import { SummaryCards } from "./components/SummaryCards";

export function ResultsPanel() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto bg-white p-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Sonuçlar</h2>
      <SummaryCards />
    </div>
  );
}

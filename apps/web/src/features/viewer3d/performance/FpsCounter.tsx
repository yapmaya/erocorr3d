// apps/web/src/features/viewer3d/performance/FpsCounter.tsx
//
// Geliştirici modunda FPS sayacı (master görev madde 8). drei `Stats`
// (stats.js sarmalayıcısı) `useThree`/`useFrame` KULLANMAZ — `@react-three/
// fiber`nin GLOBAL `addEffect`/`addAfterEffect` render-döngüsü kancalarına
// abone olur, bu yüzden Canvas'ın İÇİNDE render edilmesi GEREKMEZ (bkz.
// node_modules/@react-three/drei/core/Stats.js). Bu yüzden PipeViewer.tsx'in
// DIŞ (Canvas-dışı) sarmalayıcısına, `Stats`in kendi paneline referans veren
// bir `parent` ref ile yerleştirilir.
//
// `stats.dom`un KENDİ inline stili `position:fixed;top:0;left:0` yazar
// (sayfa geneline sabitler) — bu bileşenin küçük görüntüleyici panelinin
// SOL-ÜST köşesine (başlık çubuğunun HEMEN altına) oturması için `!`
// (important) Tailwind class'larıyla ezilir (inline stil normalde
// class'lardan önceliklidir, `!important` bu önceliği tersine çevirir).
// SOL-ALT köşe KASITLI OLARAK kullanılmadı — tarayıcıda GERÇEK RENDER'da
// yakalanan bir hata: o bölge zaten `TimeSliderPanel`/`MeasurementToolbar`
// tarafından kaplanıyor; bu panel `Html`-portallı canvas-üstü katmanın
// KENDİ (bu bileşenden ayrı) yığılma bağlamında olduğundan, `z-index`
// karşılaştırması iki panel arasında beklendiği gibi ÇALIŞMIYOR (z-index
// SADECE AYNI yığılma bağlamı içinde anlamlıdır) — basit çözüm: TAMAMEN
// boş kalan sol-üst köşeyi kullanmak.

import { Stats } from "@react-three/drei";
import type { RefObject } from "react";

export interface FpsCounterProps {
  parentRef: RefObject<HTMLElement>;
}

export function FpsCounter({ parentRef }: FpsCounterProps) {
  return <Stats parent={parentRef} className="!left-2 !top-9 !bottom-auto !right-auto !absolute !z-20" />;
}

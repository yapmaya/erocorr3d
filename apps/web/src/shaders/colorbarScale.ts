// apps/web/src/shaders/colorbarScale.ts
//
// `Colorbar.tsx`'in "skala modu" (LİNEER/LOGARİTMİK/YÜZDELİK) hesaplama
// mantığı — React'ten bağımsız, saf fonksiyon olarak tutulur ki
// vitest'le doğrudan test edilebilsin (proje bu paketteki React
// bileşenlerini test etmiyor, bkz. tests/shaders/README yerine bu
// dosyanın kendi başlığı — jsdom/testing-library kurulu değil).

export type ColorbarScaleMode = "LINEAR" | "LOG" | "PERCENT";

export const COLORBAR_SCALE_MODES: ColorbarScaleMode[] = ["LINEAR", "LOG", "PERCENT"];

/**
 * Bir değeri, renk çubuğu üzerindeki [0,1] konumuna (0=alt/min, 1=üst/max) çevirir.
 * LİNEER ve YÜZDELİK aynı pozisyonu üretir — aralarındaki fark yalnızca ETİKET
 * biçimindedir (mm vs %), pozisyon hesabında değil. LOGARİTMİK, `minValue`
 * negatif/sıfır olsa da çalışsın diye `(value-minValue+1)` kaydırmalı log
 * kullanır (log(0) tanımsızlığından kaçınmak için — bu proje-içi bir görsel
 * yaklaşımdır, KDP kapsamı dışı).
 */
export function mapValueToBarPosition(value: number, minValue: number, maxValue: number, mode: ColorbarScaleMode): number {
  const range = maxValue - minValue;
  if (range <= 0) return 0;
  const linearT = Math.min(Math.max((value - minValue) / range, 0), 1);
  if (mode === "LOG") {
    const shiftedValue = Math.max(value - minValue, 0) + 1;
    const shiftedMax = range + 1;
    const logT = Math.log10(shiftedValue) / Math.log10(shiftedMax);
    return Math.min(Math.max(logT, 0), 1);
  }
  return linearT;
}

// apps/web/src/features/viewer3d/hotspots/useDemoHotspots.ts
//
// En kritik N noktayı çıkarır — ama SENTETİK şekil verisiyle beslenmiş
// GERÇEK motor kodu (`@erocorr3d/engine`'in `DamageField`/`normalizeShapeFn`/
// `extractHotspots()`) kullanılarak. `packages/engine/src/spatial/index.ts`nin
// kendi `computeDamageField()` orkestratörü BURADA kasıtlı olarak
// KULLANILMADI — o fonksiyon yalnızca sabit, önceden-tanımlı imza şekillerini
// (UNIFORM_FULL_BORE vb.) kabul eder, bu görüntüleyicinin ısı haritasıyla
// GÖRSEL OLARAK tutarlı çok-tepeli demo desenini (`computeDemoDamageIntensity`)
// enjekte edemez. Bunun yerine `DamageField` sınıfı doğrudan, AYNI demo
// yoğunluk fonksiyonuyla besleniyor — böylece hotspot'ların 3B konumu, ısı
// haritasında GÖRÜNEN sıcak bölgelerle TAM örtüşür (aynı temel veri).
//
// Kazanılan şey: hotspot ÇIKARMA algoritmasının kendisi (yerel maksimum
// arama, 8-komşuluk, saat pozisyonu dönüşümü, kütle-korunumlu normalize
// etme) artık BU projenin gerçek, test edilmiş motor koduyla çalışıyor —
// önceki oturumlarda "spatial→UI producer link still missing" olarak
// kayıtlı boşluğun bir KISMI (üretim/orkestrasyon değil ama EN AZINDAN
// tüketim/çıkarım tarafı) bu oturumda kapandı.

import { useMemo } from "react";
import { DamageField, normalizeShapeFn, type Hotspot } from "@erocorr3d/engine";
import { computeDemoDamageIntensity, type DemoScenario } from "../timeSlider/demoTimeDependentField";

export interface UseDemoHotspotsParams {
  scenario: DemoScenario;
  elapsedYears: number;
  maxCount: number;
  resolutionU?: number;
  resolutionV?: number;
}

const DEFAULT_RESOLUTION_U = 64;
const DEFAULT_RESOLUTION_V = 48;
const MIN_VALUE_FRACTION_OF_PEAK = 0.3;

export function useDemoHotspots({
  scenario,
  elapsedYears,
  maxCount,
  resolutionU = DEFAULT_RESOLUTION_U,
  resolutionV = DEFAULT_RESOLUTION_V,
}: UseDemoHotspotsParams): Hotspot[] {
  return useMemo(() => {
    if (elapsedYears <= 0 || maxCount <= 0) return [];
    const field = new DamageField(resolutionU, resolutionV, "CYLINDRICAL_UV");
    const shapeFn = normalizeShapeFn((u, v) => computeDemoDamageIntensity(u, v, scenario.hotspotSeed));
    field.accumulate([{ mechanismId: scenario.id, shapeFn, rateMmPerYear: scenario.peakRateMmPerYear }], elapsedYears);
    return field.extractHotspots(maxCount, MIN_VALUE_FRACTION_OF_PEAK);
  }, [scenario, elapsedYears, maxCount, resolutionU, resolutionV]);
}

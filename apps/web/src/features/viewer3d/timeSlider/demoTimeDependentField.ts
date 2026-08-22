// apps/web/src/features/viewer3d/timeSlider/demoTimeDependentField.ts
//
// ⚠ SENTETİK / DEMO VERİ ÜRETİCİSİ — `shaders/demoScalarField.ts` (bkz.
// proje hafızası) İLE AYNI dürüstlük ilkesiyle: gerçek
// `packages/engine/src/spatial/` (MechanismResult[] → SpatialDamageField)
// üretim zincirine BAĞLI DEĞİLDİR — o zincir henüz kurulmadı. KDP bu
// dosyaya UYGULANMAZ (hesaplanan bir mühendislik sonucu yok).
//
// `shaders/demoScalarField.ts`ten FARKI: o dosya "verilen bir toplam hasar
// tepe değerini (maxDamageMm) sabit bir anda göster" modelidir; BU dosya
// GERÇEKTEN ZAMANLA BÜYÜYEN bir alan üretir — damage(u,v,t) = yoğunluk(u,v) ×
// tepe_hız × t — `spatial/fields.ts::DamageField.addContribution`in
// "hız×süre×şekil" formülüyle AYNI YAPIDA (bkz. o dosyanın KÜTLE KORUNUMU
// açıklaması), sadece burada şekil fonksiyonu sentetik/demo amaçlıdır.

import type { BufferGeometry } from "three";

export interface DemoScenario {
  id: string;
  labelTr: string;
  /** Sentetik tepe hız (en sıcak noktada, yoğunluk→1'e yaklaştıkça) — mm/yıl. */
  peakRateMmPerYear: number;
  /** Sıcak nokta desenini senaryolar arasında farklılaştıran tohum. */
  hotspotSeed: number;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  { id: "W1A", labelTr: "W1A — Temel (inhibitörlü)", peakRateMmPerYear: 0.35, hotspotSeed: 0 },
  { id: "W3A", labelTr: "W3A — İnhibitörsüz", peakRateMmPerYear: 0.9, hotspotSeed: 1 },
  { id: "W5B", labelTr: "W5B — Yüksek kum içeriği", peakRateMmPerYear: 1.4, hotspotSeed: 2 },
  { id: "W7C", labelTr: "W7C — Kısmi çalışma (91/365 gün)", peakRateMmPerYear: 0.55, hotspotSeed: 3 },
];

const HOTSPOT_COUNT = 3;

function circularDelta(v: number, center: number): number {
  const raw = Math.abs(v - center);
  return Math.min(raw, 1 - raw);
}

function gaussian(distance: number, sigma: number): number {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

/** (u,v) üzerinde [0,1] normalize sentetik yoğunluk — senaryo tohumuna göre desen değişir. */
export function computeDemoDamageIntensity(u: number, v: number, hotspotSeed: number): number {
  let acc = 0;
  for (let i = 0; i < HOTSPOT_COUNT; i++) {
    const centerU = ((i + 0.5) / HOTSPOT_COUNT + hotspotSeed * 0.13) % 1;
    const centerV = (i * 0.37 + hotspotSeed * 0.21) % 1;
    const sigma = 0.08 + 0.03 * (i % 2);
    const weight = 1 - i * 0.15;
    const du = u - centerU;
    const dv = circularDelta(v, centerV);
    const distance = Math.sqrt(du * du + dv * dv);
    acc += weight * gaussian(distance, sigma);
  }
  return Math.min(acc, 1);
}

/** damage(u,v,t) = yoğunluk(u,v) × tepe_hız × geçen_yıl (mm). */
export function computeDemoTimeDependentDamageMm(u: number, v: number, elapsedYears: number, scenario: DemoScenario): number {
  if (elapsedYears < 0) throw new Error("elapsedYears negatif olamaz.");
  return computeDemoDamageIntensity(u, v, scenario.hotspotSeed) * scenario.peakRateMmPerYear * elapsedYears;
}

/**
 * "Duvar delinme yılı" — en sıcak noktadaki yoğunluğun 1'e ULAŞTIĞI
 * (senaryonun tepe hızıyla tam hızda aşınan) varsayımsal en kötü durum:
 * breachYears = wtMm / peakRateMmPerYear. Bu bir MÜHENDİSLİK tahmini
 * DEĞİLDİR — sadece sentetik demo alanının kendi tepe hızına göre, zaman
 * kaydırıcısında hangi yılda "GÜVENLİ" bölgeden çıkılacağını göstermek için.
 */
export function computeDemoBreachYear(wtMm: number, scenario: DemoScenario): number {
  if (wtMm <= 0) throw new Error("wtMm pozitif olmalıdır.");
  if (scenario.peakRateMmPerYear <= 0) return Infinity;
  return wtMm / scenario.peakRateMmPerYear;
}

/**
 * Geometrinin `uv` attribute'u üzerinden, verilen anda (elapsedYears) bir
 * skaler hasar dizisi üretir (vertex sayısı kadar, mm) — `shaders/
 * HeatmapMesh.tsx`nin `values` girdisiyle doğrudan uyumludur.
 */
export function computeDemoTimeDependentField(geometry: BufferGeometry, elapsedYears: number, scenario: DemoScenario): Float32Array {
  const uvAttribute = geometry.getAttribute("uv");
  if (!uvAttribute) {
    throw new Error("Geometride 'uv' attribute'u bulunamadı — sentetik zaman-bağımlı hasar alanı üretilemez.");
  }
  const count = uvAttribute.count;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = uvAttribute.getX(i);
    const v = uvAttribute.getY(i);
    out[i] = computeDemoTimeDependentDamageMm(u, v, elapsedYears, scenario);
  }
  return out;
}

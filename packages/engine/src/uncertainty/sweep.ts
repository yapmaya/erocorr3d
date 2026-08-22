// packages/engine/src/uncertainty/sweep.ts
//
// Tek parametre taraması: seçilen bir girdi parametresi [minValue, maxValue]
// aralığında eşit adımlarla taranır, diğer tüm girdiler `baseInputs`'taki
// değerlerinde sabit tutulur, her adımda modelin çıktısı hesaplanır. Sonuç
// bir (parametreDeğeri, çıktı) eğrisi verisidir — ör. "hız 1→20 m/s
// aralığında erozyon hızı nasıl değişiyor" grafiği için doğrudan kullanılır.
//
// KDP notu: bu bir tarama/örnekleme YÖNTEMİDİR, bir mühendislik katsayısı
// değildir — KDP kapsamı dışıdır (bkz. tornado.ts'deki aynı gerekçe).

export interface SweepPoint {
  parameterValue: number;
  outputMmPerYear: number;
}

export interface SweepConfig {
  baseInputs: Record<string, number>;
  /** Taranacak parametrenin adı — baseInputs içinde önceden bulunması ZORUNLU DEĞİLDİR (taramada üzerine yazılır). */
  parameter: string;
  minValue: number;
  maxValue: number;
  /** Her girdi kümesi için çağrılan SAF fonksiyon — çıktı mm/yıl cinsinden bir hız olmalıdır. */
  modelFn: (inputs: Readonly<Record<string, number>>) => number;
  /** Uç noktalar dahil üretilecek nokta sayısı — varsayılan 25. */
  pointCount?: number;
}

const DEFAULT_POINT_COUNT = 25;

/**
 * Tek bir parametreyi verilen aralıkta eşit adımlarla tarar ve her adımda
 * modelin çıktısını hesaplayarak bir eğri üretir.
 */
export function computeParameterSweep(config: SweepConfig): SweepPoint[] {
  const { baseInputs, parameter, minValue, maxValue, modelFn, pointCount = DEFAULT_POINT_COUNT } = config;

  if (minValue >= maxValue) {
    throw new Error("minValue, maxValue'dan küçük olmalıdır.");
  }
  if (pointCount < 2 || !Number.isInteger(pointCount)) {
    throw new Error("pointCount en az 2 olan bir tam sayı olmalıdır.");
  }

  const points: SweepPoint[] = [];
  const step = (maxValue - minValue) / (pointCount - 1);

  for (let i = 0; i < pointCount; i++) {
    const parameterValue = i === pointCount - 1 ? maxValue : minValue + i * step;
    const outputMmPerYear = Math.max(modelFn({ ...baseInputs, [parameter]: parameterValue }), 0);
    points.push({ parameterValue, outputMmPerYear });
  }

  return points;
}

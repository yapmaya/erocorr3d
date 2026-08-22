// packages/engine/src/corrosion/glycolFactor.ts
//
// NORSOK M-506 Bölüm 5.3 glikol azaltma faktörü.
//
// Model: faktör = 10^(1,6×(log10(100-ağırlık%Glikol)-2))  [%95 ağırlık glikolün ALTINDA]
//        faktör = 0,008                                    [%95 ağırlık glikol VE ÜZERİNDE]
//
// Kaynak: NORSOK Standard M-506, Rev. 2 (2005), Bölüm 5.3 "The effect of
// glycol and corrosion inhibitors". Bu oturumda standardın tam metni
// doğrudan indirilip 400dpi sayfa görüntüsü olarak da render edilerek
// piksel piksel doğrulandı. Sabitler
// packages/engine/src/registry/coefficients/norsok.ts::norsok.glycolFactor
// içindedir.
//
// Girdi/çıktı birimleri: glikol ağırlık yüzdesi (0-100) → azaltma faktörü (boyutsuz, 0-1).
//
// Geçerlilik aralığı: standart bu formülün geçerlilik sınırlarını (sıcaklık,
// glikol tipi vb.) ayrıca belirtmiyor; yalnızca %95 eşiğinde bir rejim
// değişikliği tanımlıyor.
//
// Bilinen sınırlamalar: standart, glikol TİPİNE (MEG/DEG/TEG) göre bir ayrım
// yapmıyor — formül tüm glikol tipleri için aynı kabul ediliyor (standardın
// kendi basitleştirmesi).

import { getCoefficient } from "../registry";
import type { NorsokGlycolFactorConstants } from "../registry/coefficients/norsok";

/**
 * NORSOK M-506 glikol azaltma faktörünü hesaplar.
 *
 * Model adı: NORSOK M-506 Rev.2 (2005) Bölüm 5.3.
 * Girdi/çıktı birimleri: glikol ağırlık yüzdesi (%, 0-100) → azaltma faktörü (boyutsuz, 0-1).
 * Geçerlilik aralığı: 0-100 ağırlık% (formülün kendisi %95'te rejim değiştirir).
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 *
 * @param glycolWeightPercent Glikol ağırlık yüzdesi (%0-100)
 */
export function computeGlycolReductionFactor(glycolWeightPercent: number): number {
  if (glycolWeightPercent < 0 || glycolWeightPercent > 100) {
    throw new Error("Glikol ağırlık yüzdesi %0-100 aralığında olmalıdır.");
  }
  const c = getCoefficient<NorsokGlycolFactorConstants>("norsok.glycolFactor").value;
  if (glycolWeightPercent >= c.highConcentrationThresholdWtPercent) {
    return c.highConcentrationFactor;
  }
  const exponent = c.exponentCoefficient * (Math.log10(100 - glycolWeightPercent) - c.offsetConstant);
  return 10 ** exponent;
}

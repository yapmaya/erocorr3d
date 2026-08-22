// packages/engine/src/fluids/mixtureProperties.ts
//
// Gaz-sıvı iki-fazlı karışımın yoğunluğu, viskozitesi ve hızı.
//
// Modeller:
//   Karışım hızı: Vm = Vsg + Vsl (yüzeysel hızların toplamı)
//   Homojen (no-slip) yoğunluk: ρns = λL·ρL + (1-λL)·ρG
//   Kaymalı (slip) yoğunluk: ρm = HL·ρL + (1-HL)·ρG  (HL: gerçek/kaymalı
//     tutulum, ör. fluids/flowRegime.ts::computeBeggsBrillHoldup'tan)
//   Karışım viskozitesi: Dukler ve ark. (1964) modeli, μm = βG·μG + (1-βG)·μL
//     (βG: no-slip gaz tutulumu = 1-λL)
//
// Kaynak: Dukler, A.E.; Moye, W.; Cleveland, R.G., "Frictional Pressure
// Drop in Two-Phase Flow: A Comparison of Existing Correlations for
// Pressure Loss and Holdup", AIChE Journal, 10(1), 1964. Bu oturumda
// birincil makaleye doğrudan erişilemedi; formül, onu doğrudan alıntılayan
// hakemli bir dergi makalesinden (Wongwises tarzı karışım viskozitesi
// karşılaştırma çalışması, ASEAN Journal on Science and Technology for
// Development, 29(2), 2012 — bu oturumda tam metin doğrudan indirilip
// pdftotext ile okundu) VE bağımsız bir genel web taraması sentezinden
// (aynı formülü aynı şekilde aktaran) çapraz doğrulandı. Yoğunluk
// formülleri (ρns, ρm) empirik değil TANIM GEREĞİ ilişkilerdir (hacimce
// ağırlıklı ortalama) — KDP kaynak araştırması gerektirmez, herhangi bir
// çok-fazlı akış ders kitabında aynı şekilde bulunur.
//
// Bilinen sınırlamalar: literatürde karışım viskozitesi için BİRDEN FAZLA
// rakip model vardır (McAdams 1942 — kütle-kalite ağırlıklı harmonik
// ortalama; Cicchitti 1960 — kütle-kalite ağırlıklı aritmetik ortalama;
// Beattie-Whalley 1982 — Dukler'e benzer ama ek düzeltme terimli) ve
// HİÇBİRİ evrensel olarak "doğru" kabul edilmez (karşılaştırma
// çalışmaları modele göre %20-80 arası farklı hata oranları gösteriyor).
// Bu proje, zaten hesaplanan no-slip tutulum (λL) ile doğrudan uyumlu
// olduğu için Dukler (1964) modelini varsayılan olarak kullanır; farklı
// bir model gerekiyorsa çağıran taraf kendi hesabını yapıp
// mixtureDensityKgM3/mixtureViscosityPaS alanlarını ELLE (override)
// doldurabilir (bkz. types/process.ts::ProcessConditionsSchema — bu
// alanlar zaten girdide serbestçe verilebilir).

/**
 * Karışım (mixture) hızını, gaz ve sıvı kütlesel debilerinden hesaplar.
 *
 * @param gasMassFlowRateKgS Gaz fazı kütlesel debisi (kg/s)
 * @param liquidMassFlowRateKgS Sıvı fazı kütlesel debisi (kg/s)
 * @param gasDensityKgM3 Gaz fazı yoğunluğu (kg/m³)
 * @param liquidDensityKgM3 Sıvı fazı yoğunluğu (kg/m³)
 * @param pipeInternalDiameterM Boru iç çapı (m)
 */
export function computeMixtureVelocityMs(
  gasMassFlowRateKgS: number,
  liquidMassFlowRateKgS: number,
  gasDensityKgM3: number,
  liquidDensityKgM3: number,
  pipeInternalDiameterM: number,
): number {
  if (pipeInternalDiameterM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  const areaM2 = (Math.PI / 4) * pipeInternalDiameterM ** 2;
  const superficialGasVelocityMs = gasMassFlowRateKgS / (gasDensityKgM3 * areaM2);
  const superficialLiquidVelocityMs = liquidMassFlowRateKgS / (liquidDensityKgM3 * areaM2);
  return computeMixtureVelocityFromSuperficial(superficialGasVelocityMs, superficialLiquidVelocityMs);
}

/** Karışım hızını, zaten bilinen yüzeysel hızlardan hesaplar: Vm = Vsg + Vsl. */
export function computeMixtureVelocityFromSuperficial(
  superficialGasVelocityMs: number,
  superficialLiquidVelocityMs: number,
): number {
  if (superficialGasVelocityMs < 0 || superficialLiquidVelocityMs < 0) {
    throw new Error("Yüzeysel hızlar negatif olamaz.");
  }
  return superficialGasVelocityMs + superficialLiquidVelocityMs;
}

/**
 * Homojen (no-slip, kaymasız) karışım yoğunluğunu hesaplar: ρns = λL·ρL + (1-λL)·ρG.
 *
 * Model adı: tanım gereği hacimce ağırlıklı ortalama (KDP kaynak araştırması gerektirmez).
 * Girdi/çıktı birimleri: SI (kg/m³) → kg/m³.
 *
 * @param noSlipLiquidHoldup λL — bkz. fluids/flowRegime.ts::computeNoSlipLiquidHoldup
 */
export function computeNoSlipMixtureDensityKgM3(
  noSlipLiquidHoldup: number,
  liquidDensityKgM3: number,
  gasDensityKgM3: number,
): number {
  if (noSlipLiquidHoldup < 0 || noSlipLiquidHoldup > 1) {
    throw new Error("λL (0, 1) aralığında olmalıdır.");
  }
  if (liquidDensityKgM3 <= 0 || gasDensityKgM3 <= 0) {
    throw new Error("Yoğunluklar pozitif olmalıdır.");
  }
  return noSlipLiquidHoldup * liquidDensityKgM3 + (1 - noSlipLiquidHoldup) * gasDensityKgM3;
}

/**
 * Kaymalı (slip) karışım yoğunluğunu hesaplar: ρm = HL·ρL + (1-HL)·ρG.
 *
 * Model adı: tanım gereği hacimce ağırlıklı ortalama, GERÇEK (kaymalı)
 * tutulum HL kullanılarak (bkz. fluids/flowRegime.ts::computeBeggsBrillHoldup).
 * Girdi/çıktı birimleri: SI (kg/m³) → kg/m³.
 * Bilinen sınırlamalar: HL, no-slip λL'den BÜYÜK VEYA EŞİT olmalıdır (sıvı
 * her zaman gazdan daha yavaş hareket eder, bu yüzden birim hacimde daha
 * fazla yer kaplar) — bu fonksiyon bu tutarlılığı DOĞRULAMAZ, çağıran
 * tarafın tutarlı bir HL sağlaması beklenir.
 *
 * @param actualLiquidHoldup HL — gerçek (kaymalı) sıvı tutulumu
 */
export function computeSlipMixtureDensityKgM3(
  actualLiquidHoldup: number,
  liquidDensityKgM3: number,
  gasDensityKgM3: number,
): number {
  if (actualLiquidHoldup < 0 || actualLiquidHoldup > 1) {
    throw new Error("HL (0, 1) aralığında olmalıdır.");
  }
  if (liquidDensityKgM3 <= 0 || gasDensityKgM3 <= 0) {
    throw new Error("Yoğunluklar pozitif olmalıdır.");
  }
  return actualLiquidHoldup * liquidDensityKgM3 + (1 - actualLiquidHoldup) * gasDensityKgM3;
}

/**
 * Karışım viskozitesini Dukler ve ark. (1964) modeliyle hesaplar:
 * μm = (1-λL)·μG + λL·μL (no-slip gaz tutulumu βG=1-λL ile ağırlıklı
 * aritmetik ortalama).
 *
 * Model adı: Dukler, Moye, Cleveland (1964).
 * Girdi/çıktı birimleri: SI (Pa·s) → Pa·s.
 * Geçerlilik aralığı: genel amaçlı bir mühendislik yaklaşımıdır, belirli
 * bir sayısal geçerlilik aralığı literatürde raporlanmamıştır.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu — rakip modeller (McAdams,
 * Cicchitti, Beattie-Whalley) farklı sonuçlar verebilir, hiçbiri evrensel
 * olarak üstün değildir.
 *
 * @param noSlipLiquidHoldup λL
 */
export function computeMixtureViscosityPaS(
  noSlipLiquidHoldup: number,
  liquidViscosityPaS: number,
  gasViscosityPaS: number,
): number {
  if (noSlipLiquidHoldup < 0 || noSlipLiquidHoldup > 1) {
    throw new Error("λL (0, 1) aralığında olmalıdır.");
  }
  if (liquidViscosityPaS <= 0 || gasViscosityPaS <= 0) {
    throw new Error("Viskoziteler pozitif olmalıdır.");
  }
  return (1 - noSlipLiquidHoldup) * gasViscosityPaS + noSlipLiquidHoldup * liquidViscosityPaS;
}

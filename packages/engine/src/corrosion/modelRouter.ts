// packages/engine/src/corrosion/modelRouter.ts
//
// CO2 iç korozyon MODEL SEÇİCİ (router).
//
// Bu dosya bir sayısal hesap DEĞİL, bir KARAR mantığıdır — proje talimatının
// kendi mühendislik kurallarını uygular (bkz. corrosion/rules.ts ile aynı
// gerekçe: bu kurallar yayımlanmış bir sabit değil, tasarım kararlarıdır,
// bu yüzden KDP kayıt defterine değil buraya, saf fonksiyonlar olarak
// yazılmıştır).
//
// Karar tablosu:
//   1) Kuru gaz (T ≥ su çiy noktası + 10°C)        → model YOK, hız 0
//   2) Serbest su VAR (ve dolayısıyla sıvı ıslatıyor) → NORSOK M-506 (dip korozyonu)
//   3) Serbest su YOK ama kuru gaz da DEĞİL (yoğuşma riski) → de Waard + Fcond
//   4) Stratifiye akış + sıcak (T>50°C) + ısı kaybı  → YUKARIDAKİNE EK OLARAK TLC
//
// Kaynak: doğrudan proje talimatından (görev tanımı) alınan mühendislik
// kararlarıdır; corrosion/rules.ts'teki isDryGas/hasFreeWater ve
// corrosion/tlc.ts'teki isTlcTriggered fonksiyonları YENİDEN KULLANILARAK
// tek doğruluk kaynağı korunur.

import { isDryGas } from "./rules";
import { isTlcTriggered } from "./tlc";
import type { FlowRegime } from "../types/enums";

export type Co2ModelSelection = "NORSOK_M506" | "DE_WAARD_FCOND" | "NONE_DRY_GAS";

export interface Co2ModelRouterInput {
  temperatureC: number;
  waterDewpointC: number;
  ambientTemperatureC: number;
  isFreeWaterPresent: boolean;
  waterCutPercent: number;
  flowRegime: FlowRegime;
}

export interface Co2ModelDecision {
  /** Birincil (dip/bulk) korozyon modeli */
  primaryModel: Co2ModelSelection;
  /** Bu senaryoda TLC'nin de EK OLARAK hesaplanması gerekip gerekmediği */
  shouldAlsoComputeTlc: boolean;
  /** Kararın Türkçe gerekçesi — sonuca doğrudan eklenmek üzere */
  rationaleTr: string;
  isDryGasFlow: boolean;
  hasFreeWaterFlow: boolean;
  isStratifiedAndHot: boolean;
}

const STRATIFIED_REGIMES: ReadonlySet<FlowRegime> = new Set(["STRATIFIED_SMOOTH", "STRATIFIED_WAVY"]);

/**
 * CO2 iç korozyon modelini seçer ve seçimin Türkçe gerekçesini üretir.
 *
 * Model adı: proje karar mantığı (bkz. dosya başı yorumu) — bir hesap değil,
 * hangi hesap modülünün (norsokM506/deWaard/hiçbiri, +opsiyonel tlc)
 * çağrılacağına dair bir yönlendiricidir.
 * Girdi/çıktı birimleri: °C (sıcaklıklar), % (su kesri) → model seçimi (metin).
 * Geçerlilik aralığı: yok (bu bir hesap değil, bir karar kuralıdır).
 * Bilinen sınırlamalar: "sıvı ıslatıyor" koşulu bu sürümde isFreeWaterPresent
 * ile eş tutulur (types/process.ts şeması zaten waterCutPercent>0'ı yalnızca
 * isFreeWaterPresent=true iken izin verir) — akış rejimine göre ISLANMA
 * ORANI (f_ww, ör. MIST rejiminde duvarın yalnızca kısmen ıslanması) bu
 * sürümde AYRI bir girdi olarak MODELLENMEMİŞTİR, gelecekteki bir su ıslatma
 * modülüne bırakılmıştır.
 */
export function selectCo2Model(input: Co2ModelRouterInput): Co2ModelDecision {
  const isDryGasFlow = isDryGas(input.temperatureC, input.waterDewpointC);
  // NOT: hasFreeWater() (corrosion/rules.ts) burada BİLEREK kullanılmadı —
  // o fonksiyon "condensationExpected" bilgisini de girdi olarak ister, ama
  // router'ın kendi amacı zaten "yoğuşma mı yoksa serbest su mu" ayrımını
  // YAPMAKTIR. Bunun yerine input.isFreeWaterPresent (types/process.ts
  // şemasının kendi alanı, doğrudan işletme verisi) esas alınır.
  const freeWaterPresent = !isDryGasFlow && input.isFreeWaterPresent;

  const isStratifiedAndHot = isTlcTriggered({
    isStratifiedFlow: STRATIFIED_REGIMES.has(input.flowRegime),
    hasHeatLossToAmbient: input.temperatureC > input.ambientTemperatureC,
    fluidTemperatureK: input.temperatureC + 273.15,
  });

  if (isDryGasFlow) {
    return {
      primaryModel: "NONE_DRY_GAS",
      shouldAlsoComputeTlc: false,
      isDryGasFlow,
      hasFreeWaterFlow: false,
      isStratifiedAndHot: false,
      rationaleTr:
        `Akışkan sıcaklığı (${input.temperatureC.toFixed(1)}°C), su çiy noktasının ` +
        `(${input.waterDewpointC.toFixed(1)}°C) en az 10°C üzerinde — kuru gaz kabul edildi. ` +
        "Serbest su veya yoğuşma olmadığından CO2 korozyonu OLUŞMAZ, hız 0 kabul edildi. " +
        "Hiçbir korozyon modeli çağrılmadı.",
    };
  }

  if (freeWaterPresent) {
    const rationale =
      "Ortamda serbest su mevcut (isFreeWaterPresent=true, su kesri " +
      `${input.waterCutPercent.toFixed(1)}%) — sıvı fazın boru duvarını ıslattığı, DİP (bulk) su ` +
      "fazı korozyonu kabul edildi. Bu senaryo için NORSOK M-506 modeli seçildi (akış destekli, " +
      "duvar kayma gerilmesine dayalı dip korozyonu hesabı için literatürde en yaygın kabul " +
      "gören, akış-döngüsü deneylerine dayalı model).";
    if (isStratifiedAndHot) {
      return {
        primaryModel: "NORSOK_M506",
        shouldAlsoComputeTlc: true,
        isDryGasFlow,
        hasFreeWaterFlow: true,
        isStratifiedAndHot,
        rationaleTr:
          `${rationale} EK OLARAK: akış rejimi stratifiye (${input.flowRegime}), akışkan sıcaklığı ` +
          `(${input.temperatureC.toFixed(1)}°C) 50°C'nin üzerinde VE ortama (${input.ambientTemperatureC.toFixed(1)}°C) ısı kaybı var — ` +
          "üst hat korozyonu (TLC) da ayrıca hesaplanmalıdır, çünkü dip su fazı korozyonundan " +
          "BAĞIMSIZ, farklı bir mekanizmayla (üst duvarda yoğuşma) oluşur.",
      };
    }
    return {
      primaryModel: "NORSOK_M506",
      shouldAlsoComputeTlc: false,
      isDryGasFlow,
      hasFreeWaterFlow: true,
      isStratifiedAndHot,
      rationaleTr: rationale,
    };
  }

  // Kuru gaz değil, serbest su da yok → yoğuşma riski (ıslak gaz).
  const rationale =
    "Ortamda serbest su YOK (isFreeWaterPresent=false) ancak akışkan kuru gaz da DEĞİL " +
    `(sıcaklık, çiy noktasına 10°C'den daha yakın) — bu, ıslak gaz akışında buhar fazından ` +
    "YOĞUŞMA riski olduğu anlamına gelir. NORSOK M-506, serbest su/dip sıvı fazı varsayımıyla " +
    "kalibre edildiğinden bu senaryoda UYGUN DEĞİLDİR; bunun yerine de Waard-Milliams modeli, " +
    "yoğuşma faktörü (Fcond, varsayılan 0,1) ile birlikte MUHAFAZAKÂR bir tarama tahmini olarak " +
    "seçildi.";
  if (isStratifiedAndHot) {
    return {
      primaryModel: "DE_WAARD_FCOND",
      shouldAlsoComputeTlc: true,
      isDryGasFlow,
      hasFreeWaterFlow: false,
      isStratifiedAndHot,
      rationaleTr:
        `${rationale} EK OLARAK: akış rejimi stratifiye (${input.flowRegime}), akışkan sıcaklığı ` +
        `(${input.temperatureC.toFixed(1)}°C) 50°C'nin üzerinde VE ortama (${input.ambientTemperatureC.toFixed(1)}°C) ısı kaybı var — ` +
        "üst hat korozyonu (TLC) da ayrıca hesaplanmalıdır.",
    };
  }
  return {
    primaryModel: "DE_WAARD_FCOND",
    shouldAlsoComputeTlc: false,
    isDryGasFlow,
    hasFreeWaterFlow: false,
    isStratifiedAndHot,
    rationaleTr: rationale,
  };
}

// packages/engine/src/registry/coefficients/shared.ts
//
// Belirli bir modele değil, tüm korozyon mekanizmalarına ortak mühendislik
// kabullerine ait katsayılar.

import type { Coefficient, Source } from "../types";

const SRC_HOSSEINI_2015: Source = {
  type: "CONFERENCE",
  citation:
    "Hosseini, S.M.K., \"Avoiding Common Pitfalls in CO2 Corrosion Rate Assessment for Upstream Hydrocarbon Industries\", Paper No. 24, The 16th Nordic Corrosion Congress, 20-22 Mayıs 2015, Stavanger, Norveç.",
  url: "https://www.corrosionclinic.com/CO2_Corrosion/Avoiding%20Common%20Pitfalls%20in%20CO2%20Corrosion%20Rate%20Assessment%20for%20Upstream%20Hydrocarbon%20Industries.pdf",
  accessedDate: "2026-08-11",
};

const MODULE = "shared";

const INHIBITED_RESIDUAL_RATE_FLOOR_MM_PER_YEAR: Coefficient<number> = {
  id: "corrosion.inhibitedResidualRateFloorMmPerYear",
  module: MODULE,
  value: 0.1,
  unit: "mm/yıl",
  description:
    "İnhibitörlü (kimyasal korozyon önleyicili) hatlarda kabul edilen asgari kalıntı korozyon hızı",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Endüstride yaygın bir mühendislik kabulü olarak Hosseini (2015) tarafından açıkça belgelendi (CR = CRinh×CIA + CRuninh×(1-CIA) formülasyonu ile birlikte); ayrıca bu değer, projenin kendi mühendislik kurallarında da (kullanıcı tarafından) doğrulandı. Literatürde ikinci, tamamen bağımsız sayısal kaynak bulunamadı — MEDIUM işaretlendi. Not: Hosseini (2015) ayrıca bu varsayımın YÜKSEK slug frekansı gibi düşük inhibitör verimliliği beklenen koşullarda GEÇERSİZ olduğunu vurguluyor.",
};

const DEFAULT_UNCERTAINTY_BAND_FACTOR: Coefficient<number> = {
  id: "uncertainty.defaultMultiplicativeBandFactor",
  module: MODULE,
  value: 2.5,
  unit: "-",
  description:
    "CO2 korozyon modelleri için varsayılan çarpımsal belirsizlik bandı genişliği: P90 = P50×faktör, P10 = P50/faktör",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "NORSOK M-506'ya özgü, sayısal olarak yayımlanmış bir P10/P90 bandı literatürde bulunamadı. Hosseini (2015) ve genel CO2 korozyon modelleme literatürü (bkz. Nešić, 2007, Corrosion Science — Hosseini 2015'te [11] no.lu referans olarak dolaylı olarak geçiyor, doğrudan okunmadı) korozyon modellerinde \"çok büyük belirsizlikler\" olduğunu nitel olarak belirtiyor; 2-3 kat mertebesi projenin kendi mühendislik kabulüdür. Bu nedenle 2.5 değeri UNVERIFIED işaretlendi ve kullanılmadan önce bir korozyon mühendisi tarafından doğrulanmalıdır.",
};

export const SHARED_COEFFICIENTS: Coefficient[] = [
  INHIBITED_RESIDUAL_RATE_FLOOR_MM_PER_YEAR,
  DEFAULT_UNCERTAINTY_BAND_FACTOR,
];

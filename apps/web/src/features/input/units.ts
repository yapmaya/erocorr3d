// apps/web/src/features/input/units.ts
//
// SI ⇄ Imperial gösterim dönüşümü — YALNIZCA UI katmanında uygulanır (proje
// talimatı: "SI birimleri iç kullanımda ZORUNLU. Birim dönüşümü sadece UI
// katmanında"). Form state HER ZAMAN motorun kendi mühendislik biriminde
// (bara, °C, mm, m/s, kg/m³, kg/s, Pa·s) saklanır; bu modül yalnızca
// GÖSTERİM için çevirir. Dönüşüm katsayıları TANIMSAL (exact) SI/Imperial
// eşdeğerleridir (1 inç=25.4mm, 1 bar=100000 Pa, 1 psi=6894.757293168 Pa,
// 1 ft=0.3048m, 1 lb=0.45359237kg, 1 cP=1 mPa·s) — KDP kapsamı dışı (bkz.
// proje genelinde aynı gerekçeyle kullanılan PA_PER_BAR örneği,
// viewer2d/dataSource.ts).

export type UnitSystem = "SI" | "IMPERIAL";

export type UnitQuantity =
  | "PRESSURE"
  | "TEMPERATURE"
  | "LENGTH_MM"
  | "SMALL_LENGTH_MM"
  | "VELOCITY"
  | "DENSITY"
  | "MASS_FLOW"
  | "VISCOSITY";

interface UnitDef {
  siUnitLabel: string;
  imperialUnitLabel: string;
  /** SI (motor birimi) değerini Imperial GÖSTERİM değerine çevirir. */
  toImperial: (siValue: number) => number;
  /** Imperial GÖSTERİM değerini SI (motor birimi) değerine geri çevirir. */
  toSi: (imperialValue: number) => number;
  /** Gösterimde kaç ondalık basamak uygun (yalnızca UI yuvarlaması). */
  displayDecimals: number;
}

const PA_PER_BAR = 100_000; // tanımsal
const PA_PER_PSI = 6894.757293168; // tanımsal (1 psi)
const MM_PER_INCH = 25.4; // tanımsal
const M_PER_FT = 0.3048; // tanımsal
const KG_PER_LB = 0.45359237; // tanımsal
const LB_PER_FT3_TO_KG_PER_M3 = KG_PER_LB / M_PER_FT ** 3; // ≈16.0185
const SECONDS_PER_HOUR = 3600;
const LB_PER_KG = 1 / KG_PER_LB;
const CP_PER_PAS = 1000; // 1 Pa·s = 1000 cP (tanımsal, 1 cP = 1 mPa·s)

export const UNIT_DEFS: Record<UnitQuantity, UnitDef> = {
  PRESSURE: {
    siUnitLabel: "bara",
    imperialUnitLabel: "psia",
    toImperial: (bara) => (bara * PA_PER_BAR) / PA_PER_PSI,
    toSi: (psia) => (psia * PA_PER_PSI) / PA_PER_BAR,
    displayDecimals: 1,
  },
  TEMPERATURE: {
    siUnitLabel: "°C",
    imperialUnitLabel: "°F",
    toImperial: (celsius) => (celsius * 9) / 5 + 32,
    toSi: (fahrenheit) => ((fahrenheit - 32) * 5) / 9,
    displayDecimals: 1,
  },
  LENGTH_MM: {
    siUnitLabel: "mm",
    imperialUnitLabel: "inç",
    toImperial: (mm) => mm / MM_PER_INCH,
    toSi: (inch) => inch * MM_PER_INCH,
    displayDecimals: 2,
  },
  SMALL_LENGTH_MM: {
    siUnitLabel: "mm",
    imperialUnitLabel: "mil (0.001 inç)",
    toImperial: (mm) => (mm / MM_PER_INCH) * 1000,
    toSi: (mil) => (mil / 1000) * MM_PER_INCH,
    displayDecimals: 1,
  },
  VELOCITY: {
    siUnitLabel: "m/s",
    imperialUnitLabel: "ft/s",
    toImperial: (mps) => mps / M_PER_FT,
    toSi: (fps) => fps * M_PER_FT,
    displayDecimals: 3,
  },
  DENSITY: {
    siUnitLabel: "kg/m³",
    imperialUnitLabel: "lb/ft³",
    toImperial: (kgm3) => kgm3 / LB_PER_FT3_TO_KG_PER_M3,
    toSi: (lbft3) => lbft3 * LB_PER_FT3_TO_KG_PER_M3,
    displayDecimals: 2,
  },
  MASS_FLOW: {
    siUnitLabel: "kg/s",
    imperialUnitLabel: "lb/sa",
    toImperial: (kgs) => kgs * SECONDS_PER_HOUR * LB_PER_KG,
    toSi: (lbHr) => lbHr / (SECONDS_PER_HOUR * LB_PER_KG),
    displayDecimals: 2,
  },
  VISCOSITY: {
    siUnitLabel: "Pa·s",
    imperialUnitLabel: "cP",
    toImperial: (pas) => pas * CP_PER_PAS,
    toSi: (cp) => cp / CP_PER_PAS,
    displayDecimals: 4,
  },
};

/** SI (motor) değerini, aktif birim sistemine göre GÖSTERİM değerine çevirir. */
export function toDisplayValue(quantity: UnitQuantity, siValue: number, system: UnitSystem): number {
  if (system === "SI") return siValue;
  return UNIT_DEFS[quantity].toImperial(siValue);
}

/** Kullanıcının girdiği GÖSTERİM değerini motorun SI birimine geri çevirir. */
export function fromDisplayValue(quantity: UnitQuantity, displayValue: number, system: UnitSystem): number {
  if (system === "SI") return displayValue;
  return UNIT_DEFS[quantity].toSi(displayValue);
}

export function unitLabel(quantity: UnitQuantity, system: UnitSystem): string {
  return system === "SI" ? UNIT_DEFS[quantity].siUnitLabel : UNIT_DEFS[quantity].imperialUnitLabel;
}

export function displayDecimals(quantity: UnitQuantity): number {
  return UNIT_DEFS[quantity].displayDecimals;
}

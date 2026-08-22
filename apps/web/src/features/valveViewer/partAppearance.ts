// apps/web/src/features/valveViewer/partAppearance.ts
//
// Parça ADINA göre GÖRSEL renk ipucu — mühendislik anlamı YOKTUR, yalnızca
// gövde/hareketli-mekanizma/trim/mil ayrımını göz için okunaklı kılar
// (mevcut FITTING görünümünün tek-renk `#a1a1aa` gri metalinin vana
// montajları için yetersiz kalacağı, çünkü orada TEK mesh vardı — burada
// 4-7 AYRI parça var ve hangisinin ne olduğu görsel olarak ayrışmalı).

const PART_COLOR_RULES: { includes: string[]; color: string }[] = [
  { includes: ["WEDGE", "PLUG", "BALL", "DISC", "NEEDLE", "BEAN", "PISTON", "PLATE_A", "PLATE_B"], color: "#c9a24b" }, // hareketli ana mekanizma — pirinç tonu
  { includes: ["STEM", "SHAFT", "HANDLE"], color: "#b5b5bc" },
  { includes: ["BONNET"], color: "#9a9aa2" },
  { includes: ["SEAT", "CAGE", "LINER", "NOZZLE"], color: "#77777e" },
  { includes: ["PACKING", "HINGE", "GUIDE", "PIN"], color: "#6e6e74" },
  { includes: ["SPRING"], color: "#7a8fa8" },
  { includes: ["BODY"], color: "#8a8a90" },
];

export function colorForPartName(name: string): string {
  const upper = name.toUpperCase();
  for (const rule of PART_COLOR_RULES) {
    if (rule.includes.some((key) => upper.includes(key))) return rule.color;
  }
  return "#a1a1aa";
}

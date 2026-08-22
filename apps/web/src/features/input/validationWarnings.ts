// apps/web/src/features/input/validationWarnings.ts
//
// "Şüpheli değer" (sarı) yumuşak uyarıları — Zod şeması reddetmediği
// (imkânsız DEĞİL) ama saha pratiğinde ALIŞILMADIK olan girdiler için.
// Motorun kendi geçerlilik-aralığı uyarılarından (MechanismResult.
// validityWarnings — bir MODELİN geçerli olduğu aralık) FARKLI bir
// amaçtır: bu dosya yalnızca UI'da erken bir "bu değeri kontrol edin"
// ipucu verir, hiçbir hesaba girmez, KDP kapsamı dışıdır (mühendislik
// sabiti değildir).

export interface SoftWarningRule {
  max?: number;
  min?: number;
  messageTr: (value: number) => string;
}

export const SOFT_WARNING_RULES: Record<string, SoftWarningRule> = {
  "process.pressureBara": {
    max: 200,
    messageTr: (v) => `Basınç (${v} bara) çoğu yüzey hattı için alışılmadık derecede yüksek — değeri doğrulayın.`,
  },
  "process.temperatureC": {
    max: 150,
    messageTr: (v) => `Sıcaklık (${v}°C) tipik proses sıcaklıklarının üzerinde — değeri doğrulayın.`,
  },
  "chemistry.co2MolePercent": {
    max: 15,
    messageTr: (v) => `CO2 mol yüzdesi (%${v}) alışılmadık derecede yüksek — değeri doğrulayın.`,
  },
  "chemistry.h2sPpmMole": {
    max: 100_000,
    messageTr: () => "H2S derişimi çok yüksek (>%10 mol) — akış tamamen H2S ağırlıklı olabilir, değeri doğrulayın.",
  },
  "chemistry.phMeasured": {
    min: 3,
    max: 9,
    messageTr: (v) => `pH (${v}) tipik üretim suyu aralığının (3-9) dışında — değeri doğrulayın.`,
  },
  "chemistry.chlorideMgL": {
    max: 150_000,
    messageTr: (v) => `Klorür derişimi (${v} mg/L) deniz suyunun (~19,000 mg/L) çok üzerinde — değeri doğrulayın.`,
  },
  "process.mixtureVelocityMs": {
    max: 20,
    messageTr: (v) => `Karışım hızı (${v} m/s) erozyon açısından yüksek bir mertebede — erozyon sonuçlarını dikkatle değerlendirin.`,
  },
  "solids.sandRateKgDay": {
    max: 500,
    messageTr: (v) => `Kum debisi (${v} kg/gün) alışılmadık derecede yüksek — değeri doğrulayın.`,
  },
  "mitigation.inhibitorEfficiencyPercent": {
    max: 95,
    messageTr: (v) => `İnhibitör verimliliği (%${v}) sahada nadiren sürekli elde edilir — muhafazakâr bir değer düşünün.`,
  },
  "operatingProfile.corrosionAllowanceMm": {
    max: 10,
    messageTr: (v) => `Korozyon payı (${v} mm) alışılmadık derecede yüksek — değeri doğrulayın.`,
  },
  "operatingProfile.designLifeYears": {
    max: 50,
    messageTr: (v) => `Tasarım ömrü (${v} yıl) alışılmadık derecede uzun — değeri doğrulayın.`,
  },
  "geometry.roughnessMm": {
    max: 1,
    messageTr: (v) => `Yüzey pürüzlülüğü (${v} mm) çok korozyonlu/kabuklu bir iç yüzeyi işaret ediyor olabilir — değeri doğrulayın.`,
  },
  "valveGeometry.openingPercent": {
    max: 100,
    min: 15,
    messageTr: (v) => `Vana açıklığı (%${v}) düşük — kısılmış (throttling) servis erozyon/kavitasyon riskini artırır.`,
  },
};

export function getSoftWarning(fieldKey: string, value: number): string | null {
  const rule = SOFT_WARNING_RULES[fieldKey];
  if (!rule || !Number.isFinite(value)) return null;
  if (rule.max !== undefined && value > rule.max) return rule.messageTr(value);
  if (rule.min !== undefined && value < rule.min) return rule.messageTr(value);
  return null;
}

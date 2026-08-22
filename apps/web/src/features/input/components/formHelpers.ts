// apps/web/src/features/input/components/formHelpers.ts
//
// UnitField/SelectField'ın paylaştığı küçük yardımcılar. `any` kullanılmaz
// (proje kuralı) — react-hook-form'un derinlemesine iç içe geçmiş
// `FieldErrors<WizardDraft>` tipini elle dolaşmak yerine `unknown` tabanlı
// güvenli bir yürüyüş yapılır.

export function getNestedErrorMessage(errors: unknown, dottedPath: string): string | undefined {
  const parts = dottedPath.split(".");
  let current: unknown = errors;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  if (current && typeof current === "object" && "message" in current) {
    const message = (current as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

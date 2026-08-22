// apps/web/src/features/input/steps/caseFieldPath.ts
//
// Adım 3-5, `operatingProfile.cases[activeCaseIndex]` içindeki alanları
// düzenler. react-hook-form'un `FieldPath<T>` tipi dizinler için şablon
// literal türetir (`operatingProfile.cases.${number}.process.xxx`); ama
// `activeCaseIndex` çalışma zamanı bir `number` state'i olduğundan üretilen
// dize TypeScript'te düz `string` olarak çıkarımlanır. Bu YARDIMCI, dönüş
// tipini (çalışma zamanı değeri DEĞİL, yalnızca TİP seviyesinde) `suffix`
// jenerik parametresini KORUYAN bir şablon literal olarak tutar — böylece
// `useWatch`/`setValue`'nin `PathValue<WizardDraft, TName>` çıkarımı
// `suffix`'e göre DOĞRU (ör. `number`) tipe daralır; düz `FieldPath<WizardDraft>`
// döndürseydi çıkarım tüm formun alanlarının birleşimine (dolayısıyla
// kullanışsız, `undefined`/`object` içeren bir tipe) düşerdi.

export type CaseFieldPath<Suffix extends string> = `operatingProfile.cases.${number}.${Suffix}`;

export function caseFieldPath<Suffix extends string>(caseIndex: number, suffix: Suffix): CaseFieldPath<Suffix> {
  return `operatingProfile.cases.${caseIndex}.${suffix}` as CaseFieldPath<Suffix>;
}

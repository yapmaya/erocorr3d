// Korozyon payı (CA) değerlendirmesi — TODO: implement
export interface CorrosionAllowanceInput {
  nominalWallThicknessMm: number;
  minimumRequiredWallThicknessMm: number;
}

export function computeCorrosionAllowance(_input: CorrosionAllowanceInput): number {
  throw new Error("Not implemented");
}

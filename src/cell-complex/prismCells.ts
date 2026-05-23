import type { PrismCellSpec } from "./specs";

export interface CompiledPrismCell {
  readonly id: string;
  readonly heightMeters: number;
  readonly sideCount: number;
}

export function compilePrismCell(spec: PrismCellSpec): CompiledPrismCell {
  return {
    id: spec.id,
    heightMeters: spec.heightMeters,
    sideCount: spec.baseVertices.length,
  };
}

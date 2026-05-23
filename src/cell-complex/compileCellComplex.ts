import { compilePrismCell, type CompiledPrismCell } from "./prismCells";
import type { CellComplexSpec } from "./specs";

export interface CompiledCellComplex {
  readonly cells: readonly CompiledPrismCell[];
}

export function compileCellComplex(spec: CellComplexSpec): CompiledCellComplex {
  return {
    cells: spec.cells.map(compilePrismCell),
  };
}

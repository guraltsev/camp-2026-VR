import { compilePrismCell, type CompiledPrismCell } from "./prismCells";
import type { CellComplexSpec } from "./specs";
import { validateAuthoringSpec } from "../authoring/validateAuthoringSpec";

export interface CompiledCellComplex {
  readonly cells: readonly CompiledPrismCell[];
  readonly cellsById: ReadonlyMap<string, CompiledPrismCell>;
}

export function compileCellComplex(spec: CellComplexSpec): CompiledCellComplex {
  const errors = validateAuthoringSpec(spec);

  if (errors.length > 0) {
    throw new Error(`Invalid cell complex:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const cells = spec.cells.map(compilePrismCell);

  return {
    cells,
    cellsById: new Map(cells.map((cell) => [cell.id, cell])),
  };
}

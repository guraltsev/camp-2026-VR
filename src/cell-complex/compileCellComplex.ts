import { compilePortalTransforms } from "./compilePortalTransforms";
import { compilePrismCellGeometry, linkCompiledPrismCellPortals, type CompiledPrismCell } from "./prismCells";
import type { CellComplexSpec } from "./specs";
import { validateAuthoringSpec } from "../authoring/validateAuthoringSpec";

export interface CompiledCellComplex {
  readonly cells: readonly CompiledPrismCell[];
  readonly cellsById: ReadonlyMap<string, CompiledPrismCell>;
  readonly startingPosition?: CellComplexSpec["startingPosition"];
}

export function compileCellComplex(spec: CellComplexSpec): CompiledCellComplex {
  const errors = validateAuthoringSpec(spec);

  if (errors.length > 0) {
    throw new Error(`Invalid cell complex:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const cellGeometry = spec.cells.map(compilePrismCellGeometry);
  const cellGeometryById = new Map(cellGeometry.map((cell) => [cell.id, cell]));
  const compiledPortalsByCellId = compilePortalTransforms(spec, cellGeometryById);
  const cells = cellGeometry.map((cell) =>
    linkCompiledPrismCellPortals(cell, compiledPortalsByCellId.get(cell.id) ?? []),
  );

  return {
    cells,
    cellsById: new Map(cells.map((cell) => [cell.id, cell])),
    startingPosition: spec.startingPosition,
  };
}

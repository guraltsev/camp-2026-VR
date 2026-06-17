import { compilePortalTransforms } from "./compilePortalTransforms";
import { compilePrismCellGeometry, linkCompiledPrismCellPortals, type CompiledPrismCell } from "./prismCells";
import type { CellComplexSpec } from "./specs";
import { validateAuthoringSpec } from "../authoring/validateAuthoringSpec";
import {
  getCoverCellId,
  oppositeOrientationSheet,
  prepareWorldForCompilation,
  type OrientationDoubleCoverResult,
  type OrientationSheet,
} from "./orientationDoubleCover";

export interface CompiledCellComplex {
  readonly cells: readonly CompiledPrismCell[];
  readonly cellsById: ReadonlyMap<string, CompiledPrismCell>;
  readonly orientationCover?: OrientationDoubleCoverResult;
}

export function compileCellComplex(spec: CellComplexSpec): CompiledCellComplex {
  const errors = validateAuthoringSpec(spec);

  if (errors.length > 0) {
    throw new Error(`Invalid cell complex:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const prepared = prepareWorldForCompilation(spec);
  const preparedErrors = validateAuthoringSpec(prepared.spec, { allowOrientationCoverCellIds: true });

  if (preparedErrors.length > 0) {
    throw new Error(`Invalid prepared cell complex:\n${preparedErrors.map((error) => `- ${error}`).join("\n")}`);
  }

  const cellGeometry = prepared.spec.cells.map(compilePrismCellGeometry);
  const cellGeometryById = new Map(cellGeometry.map((cell) => [cell.id, cell]));
  const compiledPortalsByCellId = compilePortalTransforms(prepared.spec, cellGeometryById);
  const cells = cellGeometry.map((cell) =>
    linkCompiledPrismCellPortals(cell, compiledPortalsByCellId.get(cell.id) ?? []),
  );

  return {
    cells,
    cellsById: new Map(cells.map((cell) => [cell.id, cell])),
    orientationCover: prepared.orientationCover,
  };
}

export function getBaseCellId(world: CompiledCellComplex, coverCellId: string): string {
  return world.orientationCover?.coverCellMetadataById.get(coverCellId)?.baseCellId ?? coverCellId;
}

export function getOrientationSheet(
  world: CompiledCellComplex,
  coverCellId: string,
): OrientationSheet | undefined {
  return world.orientationCover?.coverCellMetadataById.get(coverCellId)?.sheet;
}

export function getOppositeSheetCellId(
  world: CompiledCellComplex,
  coverCellId: string,
): string | undefined {
  const metadata = world.orientationCover?.coverCellMetadataById.get(coverCellId);

  if (!metadata || !world.orientationCover) {
    return undefined;
  }

  return getCoverCellId(
    world.orientationCover,
    metadata.baseCellId,
    oppositeOrientationSheet(metadata.sheet),
  );
}

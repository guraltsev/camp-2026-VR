import type { CellComplexSpec } from "../cell-complex/specs";

export function validateAuthoringSpec(spec: CellComplexSpec): readonly string[] {
  const errors: string[] = [];
  const cellsById = new Map<string, CellComplexSpec["cells"][number]>();

  if (spec.cells.length === 0) {
    errors.push("A world spec must contain at least one cell.");
  }

  for (const cell of spec.cells) {
    if (cellsById.has(cell.id)) {
      errors.push(`Duplicate cell id "${cell.id}".`);
    } else {
      cellsById.set(cell.id, cell);
    }

    if (cell.baseVertices.length < 3) {
      errors.push(`Cell "${cell.id}" must have at least 3 base vertices.`);
    }

    if (cell.baseVertices.length > 8) {
      errors.push(`Cell "${cell.id}" must have at most 8 base vertices.`);
    }

    const baseValidationError = validatePrismBase(cell.baseVertices);

    if (baseValidationError) {
      errors.push(`Cell "${cell.id}" ${baseValidationError}`);
    }

    if (cell.heightMeters <= 0) {
      errors.push(`Cell "${cell.id}" must have a positive height.`);
    }

    const portalIds = new Set<string>();

    for (const portal of cell.portals) {
      if (portalIds.has(portal.id)) {
        errors.push(`Cell "${cell.id}" has duplicate portal id "${portal.id}".`);
      } else {
        portalIds.add(portal.id);
      }

      if (!Number.isInteger(portal.sideIndex) || portal.sideIndex < 0 || portal.sideIndex >= cell.baseVertices.length) {
        errors.push(
          `Portal "${cell.id}:${portal.id}" has sideIndex ${portal.sideIndex}, expected 0-${cell.baseVertices.length - 1}.`,
        );
      }
    }
  }

  for (const cell of spec.cells) {
    for (const portal of cell.portals) {
      const targetCell = cellsById.get(portal.targetCellId);

      if (!targetCell) {
        errors.push(`Portal "${cell.id}:${portal.id}" targets missing cell "${portal.targetCellId}".`);
        continue;
      }

      const targetPortal = targetCell.portals.find((candidate) => candidate.id === portal.targetPortalId);

      if (!targetPortal) {
        errors.push(
          `Portal "${cell.id}:${portal.id}" targets missing portal "${portal.targetCellId}:${portal.targetPortalId}".`,
        );
        continue;
      }

      if (targetPortal.targetCellId !== cell.id || targetPortal.targetPortalId !== portal.id) {
        errors.push(
          `Portal "${cell.id}:${portal.id}" is not reciprocated by "${targetCell.id}:${targetPortal.id}".`,
        );
      }
    }
  }

  if (spec.startingPosition) {
    if (!cellsById.has(spec.startingPosition.cellId)) {
      errors.push(`Starting position targets missing cell "${spec.startingPosition.cellId}".`);
    }

    for (const [axis, value] of Object.entries(spec.startingPosition.position)) {
      if (!Number.isFinite(value)) {
        errors.push(`Starting position ${axis} coordinate must be finite.`);
      }
    }

    if (
      spec.startingPosition.yawRadians !== undefined &&
      !Number.isFinite(spec.startingPosition.yawRadians)
    ) {
      errors.push("Starting position yawRadians must be finite.");
    }

    if (
      spec.startingPosition.pitchRadians !== undefined &&
      !Number.isFinite(spec.startingPosition.pitchRadians)
    ) {
      errors.push("Starting position pitchRadians must be finite.");
    }
  }

  return errors;
}

function validatePrismBase(
  vertices: readonly { readonly x: number; readonly y: number }[],
): string | undefined {
  if (vertices.length < 3) {
    return undefined;
  }

  let signedAreaTwice = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    signedAreaTwice += current.x * next.y - next.x * current.y;
  }

  if (signedAreaTwice <= 0) {
    return "must list baseVertices in counterclockwise order in the x/y plane.";
  }

  let sawPositiveTurn = false;

  for (let index = 0; index < vertices.length; index += 1) {
    const prev = vertices[(index + vertices.length - 1) % vertices.length];
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const edgeAX = current.x - prev.x;
    const edgeAY = current.y - prev.y;
    const edgeBX = next.x - current.x;
    const edgeBY = next.y - current.y;
    const turn = edgeAX * edgeBY - edgeAY * edgeBX;

    if (turn <= 0) {
      return "must be strictly convex; non-convex prism cells are not supported.";
    }

    sawPositiveTurn = true;
  }

  if (!sawPositiveTurn) {
    return "must be strictly convex; non-convex prism cells are not supported.";
  }

  return undefined;
}

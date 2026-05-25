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

  return errors;
}

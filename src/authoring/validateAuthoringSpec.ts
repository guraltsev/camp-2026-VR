import type { CellComplexSpec } from "../cell-complex/specs";

export function validateAuthoringSpec(spec: CellComplexSpec): readonly string[] {
  const errors: string[] = [];

  if (spec.cells.length === 0) {
    errors.push("A world spec must contain at least one cell.");
  }

  return errors;
}

import type { CellObjectSpec, PortalSpec, PrismCellSpec } from "./specs";

export interface CompiledPrismCell {
  readonly id: string;
  readonly heightMeters: number;
  readonly sideCount: number;
  readonly baseVertices: readonly { readonly x: number; readonly z: number }[];
  readonly portals: readonly PortalSpec[];
  readonly floorColor: string;
  readonly objects: readonly CellObjectSpec[];
}

export function compilePrismCell(spec: PrismCellSpec): CompiledPrismCell {
  return {
    id: spec.id,
    heightMeters: spec.heightMeters,
    sideCount: spec.baseVertices.length,
    baseVertices: spec.baseVertices,
    portals: spec.portals,
    floorColor: spec.visuals?.floorColor ?? "#3f6f7a",
    objects: spec.visuals?.objects ?? [],
  };
}

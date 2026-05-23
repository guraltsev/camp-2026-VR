import type { RigidTransform3 } from "../math/rigidTransform3";

export interface CellComplexSpec {
  readonly cells: readonly PrismCellSpec[];
}

export interface PrismCellSpec {
  readonly id: string;
  readonly heightMeters: number;
  readonly baseVertices: readonly { readonly x: number; readonly z: number }[];
  readonly portals: readonly PortalSpec[];
}

export interface PortalSpec {
  readonly id: string;
  readonly sideIndex: number;
  readonly targetCellId: string;
  readonly targetPortalId: string;
  readonly transformToTarget: RigidTransform3;
}

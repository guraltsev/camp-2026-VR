import type { RigidTransform3 } from "../math/rigidTransform3";

export interface CellComplexSpec {
  readonly cells: readonly PrismCellSpec[];
}

export interface PrismCellSpec {
  readonly id: string;
  readonly heightMeters: number;
  readonly baseVertices: readonly { readonly x: number; readonly z: number }[];
  readonly portals: readonly AuthoredPortalSpec[];
  readonly visuals?: PrismCellVisualSpec;
}

export interface AuthoredPortalSpec {
  readonly id: string;
  readonly sideIndex: number;
  readonly targetCellId: string;
  readonly targetPortalId: string;
}

export interface CompiledPortal extends AuthoredPortalSpec {
  readonly transformToTarget: RigidTransform3;
}

export interface PrismCellVisualSpec {
  readonly floorColor?: string;
  readonly objects?: readonly CellObjectSpec[];
}

export interface CellObjectSpec {
  readonly id: string;
  readonly kind: "asset";
  readonly assetPath: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale?: number;
  readonly yawRadians?: number;
}

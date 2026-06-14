import type { RigidTransform3 } from "../math/rigidTransform3";

export interface CellComplexSpec {
  readonly cells: readonly PrismCellSpec[];
}

export interface PrismCellSpec {
  readonly id: string;
  readonly heightMeters: number;
  readonly baseVertices: readonly { readonly x: number; readonly y: number }[];
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
  readonly reciprocalPortalId: string;
}

export interface PrismCellVisualSpec {
  readonly floorColor?: string;
  readonly floorMaterial?: FloorMaterialSpec;
  readonly objects?: readonly CellObjectSpec[];
}

export type FloorMaterialSpec = FloorColorMaterialSpec | FloorTextureMaterialSpec;

export interface FloorColorMaterialSpec {
  readonly kind: "floor-color";
  readonly floorColor: string;
}

export interface FloorTextureMaterialSpec {
  readonly kind: "floor-texture";
  readonly name: string;
  readonly floorColor: string;
  readonly tileSizeMeters: number;
  readonly colorTexturePath?: string;
  readonly normalTexturePath?: string;
  readonly bumpTexturePath?: string;
  readonly roughnessTexturePath?: string;
}

export interface PositionedCellObjectSpec {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale?: number;
  readonly scaleXYZ?: { readonly x: number; readonly y: number; readonly z: number };
  readonly modelOffset?: { readonly x: number; readonly y: number; readonly z: number };
  readonly forwardTiltRadians?: number;
  readonly sideTiltRadians?: number;
  readonly turnRadians?: number;
  readonly yawRadians?: number;
}

export interface AssetObjectSpec extends PositionedCellObjectSpec {
  readonly kind: "asset";
  readonly assetPath: string;
}

export interface SimpleCollisionCylinderSpec {
  readonly radius: number;
  readonly height: number;
  readonly offset?: { readonly x: number; readonly y: number; readonly z: number };
}

export interface GeodesciMarmotObjectSpec extends PositionedCellObjectSpec {
  readonly kind: "geodesci-marmot";
  readonly assetPath: string;
  readonly velocity: { readonly x: number; readonly y: number };
  readonly collision: SimpleCollisionCylinderSpec;
  readonly animationClipName?: string;
}

export interface SimpleGeoCreatureObjectSpec extends PositionedCellObjectSpec {
  readonly kind: "geo-mouse" | "geo-butterfly";
  readonly assetPath: string;
  readonly speedMetersPerSecond: number;
  readonly oscillationRateHz: number;
  readonly oscillationMagnitudeMeters: number;
  readonly collision: SimpleCollisionCylinderSpec;
}

export type CellObjectSpec = AssetObjectSpec | GeodesciMarmotObjectSpec | SimpleGeoCreatureObjectSpec;

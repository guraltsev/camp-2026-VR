import type { AssetObjectSpec } from "../cell-complex/specs";

export interface StaticObjectAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly scale?: number;
  readonly scaleXYZ?: readonly [x: number, y: number, z: number];
  readonly modelOffset?: readonly [x: number, y: number, z: number];
  readonly forwardTilt?: number;
  readonly sideTilt?: number;
  readonly turn?: number;
}

export function createStaticAssetObject(
  id: string,
  assetPath: string,
  params: StaticObjectAuthoringParams,
): AssetObjectSpec {
  return {
    id,
    kind: "asset",
    assetPath,
    position: {
      x: params.position[0],
      y: params.position[2],
      z: params.position[1],
    },
    scale: params.scale,
    scaleXYZ: params.scaleXYZ
      ? {
          x: params.scaleXYZ[0],
          y: params.scaleXYZ[1],
          z: params.scaleXYZ[2],
        }
      : undefined,
    modelOffset: params.modelOffset
      ? {
          x: params.modelOffset[0],
          y: params.modelOffset[2],
          z: params.modelOffset[1],
        }
      : undefined,
    forwardTiltRadians: degreesToRadians(params.forwardTilt ?? 0),
    sideTiltRadians: degreesToRadians(params.sideTilt ?? 0),
    turnRadians: degreesToRadians(params.turn ?? 0),
    yawRadians: degreesToRadians(params.turn ?? 0),
  };
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

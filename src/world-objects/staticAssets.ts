import type { AssetObjectSpec, SimpleCollisionCylinderSpec } from "../cell-complex/specs";

export interface StaticObjectAuthoringParams {
  /**
   * Position in authored [x, z, y] axes. The middle coordinate is height above the floor.
   */
  readonly position: readonly [x: number, y: number, z: number];
  /** Multiplies the library object's base size and collision area. */
  readonly scale?: number;
  /** Advanced override for non-uniform visual scale in authored [x, y, z] axes. */
  readonly scaleXYZ?: readonly [x: number, y: number, z: number];
  /** Advanced override for visual model offset in authored [x, y, z] axes. */
  readonly modelOffset?: readonly [x: number, y: number, z: number];
  /** Advanced override for the library's default collision cylinder. */
  readonly collision?: SimpleCollisionCylinderSpec;
  /** Override the object's collision class, for example "tree" or "sign". */
  readonly class?: string;
  /** Objects in these classes ignore this object's collision, for example ["user"]. */
  readonly do_not_collide_with?: readonly string[];
  /** Camel-case alias accepted for TypeScript callers. Serialized specs use do_not_collide_with. */
  readonly doNotCollideWith?: readonly string[];
  /** Concise object help shown by the help lens when the object is focused. */
  readonly displayHelpMessage?: string;
  /** If set, shows the help lens automatically while the player is within this range. */
  readonly autoDisplayHelpRangeMeters?: number;
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
    collision: params.collision,
    class: params.class,
    do_not_collide_with: params.do_not_collide_with ?? params.doNotCollideWith,
    displayHelpMessage: params.displayHelpMessage,
    autoDisplayHelpRangeMeters: params.autoDisplayHelpRangeMeters,
  };
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

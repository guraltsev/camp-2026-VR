import type { Vec3 } from "../math/vec3";

export interface StraightRayTrace {
  readonly startCellId: string;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly maxDistanceMeters: number;
}

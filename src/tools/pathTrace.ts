import type { Vec3 } from "../math/vec3";

export interface PathTracePoint {
  readonly cellId: string;
  readonly position: Vec3;
}

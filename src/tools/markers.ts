import type { Vec3 } from "../math/vec3";

export interface Marker {
  readonly id: string;
  readonly cellId: string;
  readonly position: Vec3;
}

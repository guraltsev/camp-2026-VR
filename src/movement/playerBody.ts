import type { Vec3 } from "../math/vec3";

export interface PlayerBody {
  readonly cellId: string;
  readonly position: Vec3;
  readonly radiusMeters: number;
  readonly heightMeters: number;
}

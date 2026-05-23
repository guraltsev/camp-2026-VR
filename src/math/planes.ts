import type { Vec3 } from "./vec3";

export interface Plane {
  readonly normal: Vec3;
  readonly offset: number;
}

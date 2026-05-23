import type { Vec3 } from "./vec3";

export interface Polygon2 {
  readonly vertices: readonly Pick<Vec3, "x" | "z">[];
}

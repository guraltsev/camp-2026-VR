import type { RigidTransform3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";

export interface DynamicObjectState {
  readonly cellId: string;
  readonly localPose: RigidTransform3;
  readonly collision?: DynamicObjectCollisionShape;
}

export type DynamicObjectCollisionShape = SimpleCollisionBox;

export interface SimpleCollisionBox {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly offset?: Vec3;
}

export function simpleCollisionBox(dx: number, dy: number, dz: number, offset?: Vec3): SimpleCollisionBox {
  return { dx, dy, dz, offset };
}

import type { RigidTransform3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";

export interface DynamicObjectState {
  readonly cellId: string;
  readonly localPose: RigidTransform3;
  readonly collision?: DynamicObjectCollisionShape;
}

export type DynamicObjectCollisionShape = SimpleCollisionCylinder;

export interface SimpleCollisionCylinder {
  readonly radius: number;
  readonly height: number;
  readonly offset?: Vec3;
}

export function simpleCollisionCylinder(radius: number, height: number, offset?: Vec3): SimpleCollisionCylinder {
  return { radius, height, offset };
}

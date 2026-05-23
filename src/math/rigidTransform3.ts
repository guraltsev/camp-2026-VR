import { addVec3, type Vec3 } from "./vec3";

export interface RigidTransform3 {
  readonly translation: Vec3;
}

export const identityRigidTransform3: RigidTransform3 = {
  translation: { x: 0, y: 0, z: 0 },
};

export function applyRigidTransform3(transform: RigidTransform3, point: Vec3): Vec3 {
  return addVec3(point, transform.translation);
}

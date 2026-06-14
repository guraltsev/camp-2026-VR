import * as THREE from "three";
import type { RigidTransform3 } from "../../math/rigidTransform3";
import type { Vec3 } from "../../math/vec3";

// Map right-handed world coordinates (x right, y forward, z up)
// into Three.js coordinates (x right, y up, -z forward).
const worldToThreeBasis = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);
const threeToWorldBasis = worldToThreeBasis.clone().invert();

export function worldPointToThree(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.z, -point.y);
}

export function threePointToWorld(point: THREE.Vector3): Vec3 {
  return {
    x: point.x,
    y: -point.z,
    z: point.y,
  };
}

export function threeDirectionToWorld(direction: THREE.Vector3): Vec3 {
  return threePointToWorld(direction);
}

export function worldYawRadiansToThree(yawRadians: number): number {
  return yawRadians;
}

export function rigidTransformToThreeMatrix(transform: RigidTransform3): THREE.Matrix4 {
  const worldMatrix = new THREE.Matrix4().set(
    transform.rotation.m00,
    transform.rotation.m01,
    transform.rotation.m02,
    transform.translation.x,
    transform.rotation.m10,
    transform.rotation.m11,
    transform.rotation.m12,
    transform.translation.y,
    transform.rotation.m20,
    transform.rotation.m21,
    transform.rotation.m22,
    transform.translation.z,
    0,
    0,
    0,
    1,
  );

  return new THREE.Matrix4().multiplyMatrices(worldToThreeBasis, worldMatrix).multiply(threeToWorldBasis);
}

export function applyWorldRigidTransform(object: THREE.Object3D, transform: RigidTransform3): void {
  const matrix = rigidTransformToThreeMatrix(transform);
  object.position.setFromMatrixPosition(matrix);
  object.quaternion.setFromRotationMatrix(matrix);
}

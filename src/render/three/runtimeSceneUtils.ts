/** Small scene-graph, geometry, and pose helpers shared by the app shell. */
import * as THREE from "three";
import { type AppState } from "../../appState";
import { type CompiledPrismCell } from "../../cell-complex/prismCells";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import { type Vec3 } from "../../math/vec3";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import { type CellDeformationMap, transformRigidPoseWithMap } from "../../runtime/worldGeometryDeformations";
import { type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { buildForbiddenZoneWireframe } from "./debugCollisionWireframes";

export function isGeodesicRuntimeRenderObject(
  object: RuntimeWorldObject,
): object is Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" | "geodesic-segment" | "geodesic-intersection" }> {
  return object.kind === "geodesic-cannon" ||
    object.kind === "geodesic-segment" ||
    object.kind === "geodesic-intersection";
}

export function disableFrustumCulling(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.frustumCulled = false;
  });
}

export function disableShadows(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

export function createCellWarmupViews(cell: AppState["world"]["cells"][number]) {
  const center = getCellCenter(cell);
  const eyeZ = Math.min(cell.heightMeters - 0.1, DEFAULT_PLAYER_EYE_HEIGHT_METERS);

  return [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((yawRadians) => ({
    position: {
      x: center.x,
      y: center.y,
      z: eyeZ,
    },
    yawRadians,
  }));
}

export function getCellCenter(cell: AppState["world"]["cells"][number]): { readonly x: number; readonly y: number } {
  let x = 0;
  let y = 0;

  for (const vertex of cell.baseVertices) {
    x += vertex.x;
    y += vertex.y;
  }

  const count = Math.max(1, cell.baseVertices.length);
  return {
    x: x / count,
    y: y / count,
  };
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}

export function distanceSquared(left: Vec3, right: Vec3): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

export function yawFromPose(pose: { readonly rotation: { readonly m00: number; readonly m10: number } }): number {
  return Math.atan2(pose.rotation.m10, pose.rotation.m00);
}

export function transformYawWithMap(
  yawRadians: number,
  atPoint: Vec3,
  map: CellDeformationMap,
): number {
  return yawFromPose(transformRigidPoseWithMap(yawRigidTransform3(yawRadians, atPoint), map));
}

export function buildCurrentCellForbiddenZoneWireframes(cell: CompiledPrismCell): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `forbidden-zone-wireframes:${cell.id}`;

  for (const zone of cell.forbiddenZones) {
    group.add(buildForbiddenZoneWireframe(cell.id, zone.collision, cell.heightMeters));
  }

  return group;
}

export function runtimeObjectArchetypeKeyPrefix(object: RuntimeWorldObject): string {
  if (object.kind === "placed-flag") {
    return `placed-flag:${object.flagType}:${object.id}`;
  }

  return `${object.kind}:${object.id}`;
}

export function clampInteger(value: number, min: number, max: number): number {
  return Math.max(Math.ceil(min), Math.min(Math.floor(max), Math.round(value)));
}

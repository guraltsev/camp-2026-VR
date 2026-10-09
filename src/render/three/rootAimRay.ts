/** Aim-ray value type and pure aim helpers shared by desktop and XR interaction code. */
import * as THREE from "three";
import { type Vec3 } from "../../math/vec3";
import { type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { AimTarget } from "./aimTarget";
import { threeDirectionToWorld, threePointToWorld } from "./worldAxes";

export interface RootAimRay {
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

export function intersectRootRayWithFloor(originThree: THREE.Vector3, directionThree: THREE.Vector3): Vec3 | undefined {
  const origin = threePointToWorld(originThree);
  const direction = threeDirectionToWorld(directionThree);
  if (Math.abs(direction.z) <= 1e-6) {
    return undefined;
  }

  const t = -origin.z / direction.z;
  if (!Number.isFinite(t) || t <= 0) {
    return undefined;
  }

  return {
    x: origin.x + direction.x * t,
    y: origin.y + direction.y * t,
    z: 0,
  };
}

export function getAimForwardVector(ray?: RootAimRay): { readonly x: number; readonly y: number; readonly z: number } | undefined {
  return ray ? threeDirectionToWorld(ray.direction) : undefined;
}

export function createAimTargetCycleSignature(targets: readonly AimTarget[]): string {
  return targets.map((target) => [
    target.object?.id ?? "",
    target.geodesicEmitterGeodesicId ?? "",
    target.portalPathId,
  ].join(":")).join("|");
}

export function getRuntimeObjectInteractionRangeMeters(object: RuntimeWorldObject): number {
  return object.tooltip?.rangeMeters ?? object.interactable?.rangeMeters ?? 2.5;
}

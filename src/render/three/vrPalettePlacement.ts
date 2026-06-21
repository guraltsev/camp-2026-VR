import * as THREE from "three";

export type VrPaletteAnchorKind = "head";

export interface VrPoseSample {
  readonly position: THREE.Vector3;
  readonly quaternion?: THREE.Quaternion;
}

export interface ResolveVrPalettePlacementOptions {
  readonly head: VrPoseSample;
  readonly previousPosition?: THREE.Vector3;
  readonly previousQuaternion?: THREE.Quaternion;
  readonly smoothing?: number;
  readonly freeze?: boolean;
}

export interface VrPalettePlacement {
  readonly anchorKind: VrPaletteAnchorKind;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

const upAxis = new THREE.Vector3(0, 1, 0);
const headOffset = new THREE.Vector3(0, -0.12, -0.72);
const lookAtMatrix = new THREE.Matrix4();
const positiveZFacingFlip = new THREE.Quaternion().setFromAxisAngle(upAxis, Math.PI);

export function resolveVrPalettePlacement(options: ResolveVrPalettePlacementOptions): VrPalettePlacement {
  const anchorKind: VrPaletteAnchorKind = "head";
  const targetPosition = options.head.position.clone().add(applyLocalOffset(headOffset, options.head.quaternion));
  const targetQuaternion = resolveFacingQuaternion(targetPosition, options.head.position);

  if (options.freeze && options.previousPosition && options.previousQuaternion) {
    return {
      anchorKind,
      position: options.previousPosition.clone(),
      quaternion: options.previousQuaternion.clone(),
    };
  }

  const smoothing = THREE.MathUtils.clamp(options.smoothing ?? 0.22, 0, 1);
  const position = options.previousPosition
    ? options.previousPosition.clone().lerp(targetPosition, smoothing)
    : targetPosition;
  const quaternion = options.previousQuaternion
    ? options.previousQuaternion.clone().slerp(targetQuaternion, smoothing)
    : targetQuaternion;

  return {
    anchorKind,
    position,
    quaternion,
  };
}

function applyLocalOffset(offset: THREE.Vector3, quaternion?: THREE.Quaternion): THREE.Vector3 {
  return quaternion ? offset.clone().applyQuaternion(quaternion) : offset.clone();
}

export function resolveFacingQuaternion(position: THREE.Vector3, targetPosition: THREE.Vector3): THREE.Quaternion {
  const forward = targetPosition.clone().sub(position).normalize();
  if (forward.lengthSq() <= 1e-6) {
    return new THREE.Quaternion();
  }

  lookAtMatrix.lookAt(position, targetPosition, upAxis);
  return new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
}

export function resolveFrontFacingQuaternion(position: THREE.Vector3, targetPosition: THREE.Vector3): THREE.Quaternion {
  return resolveFacingQuaternion(position, targetPosition).multiply(positiveZFacingFlip);
}

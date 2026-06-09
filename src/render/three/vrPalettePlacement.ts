import * as THREE from "three";

export type VrPaletteAnchorKind = "hand" | "controller" | "head";

export interface VrPoseSample {
  readonly position: THREE.Vector3;
  readonly quaternion?: THREE.Quaternion;
}

export interface ResolveVrPalettePlacementOptions {
  readonly head: VrPoseSample;
  readonly hand?: VrPoseSample;
  readonly controller?: VrPoseSample;
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
const wristOffset = new THREE.Vector3(-0.06, 0.04, 0.02);
const controllerOffset = new THREE.Vector3(-0.05, 0.03, -0.08);
const headOffset = new THREE.Vector3(-0.18, -0.1, -0.6);
const lookAtMatrix = new THREE.Matrix4();

export function resolveVrPalettePlacement(options: ResolveVrPalettePlacementOptions): VrPalettePlacement {
  const anchor = options.hand ?? options.controller ?? options.head;
  const anchorKind: VrPaletteAnchorKind = options.hand ? "hand" : options.controller ? "controller" : "head";
  const localOffset = anchorKind === "hand"
    ? wristOffset
    : anchorKind === "controller"
      ? controllerOffset
      : headOffset;
  const targetPosition = anchor.position.clone().add(applyLocalOffset(localOffset, anchor.quaternion));
  const targetQuaternion = computeFacingQuaternion(targetPosition, options.head.position);

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

function computeFacingQuaternion(position: THREE.Vector3, headPosition: THREE.Vector3): THREE.Quaternion {
  const forward = headPosition.clone().sub(position).normalize();
  if (forward.lengthSq() <= 1e-6) {
    return new THREE.Quaternion();
  }

  lookAtMatrix.lookAt(position, headPosition, upAxis);
  return new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
}

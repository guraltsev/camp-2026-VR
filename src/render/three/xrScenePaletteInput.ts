import * as THREE from "three";
import { xrRigidTransformLocalMatrix } from "./xrPlayerRig";
import type { ScenePaletteInputFrame, ScenePalettePointerSource } from "./scenePaletteInput";

export interface XrScenePaletteInput {
  update(options: {
    readonly deltaSeconds: number;
    readonly inputSources: readonly XRInputSource[];
    readonly xrFrame: XRFrame;
    readonly referenceSpace: XRReferenceSpace;
    readonly referenceSpaceToWorldMatrix: THREE.Matrix4;
  }): ScenePaletteInputFrame;
  reset(): void;
}

const controllerObjects = new Map<string, THREE.Object3D>();

export function createXrScenePaletteInput(): XrScenePaletteInput {
  let previousMenuTogglePressed = false;

  return {
    update(options) {
      const sources = createControllerSources(
        options.inputSources,
        options.xrFrame,
        options.referenceSpace,
        options.referenceSpaceToWorldMatrix,
      );
      const menuTogglePressed = sources.menuTogglePressed && !previousMenuTogglePressed;
      previousMenuTogglePressed = sources.menuTogglePressed;

      return {
        deltaSeconds: options.deltaSeconds,
        menuTogglePressed,
        pointers: sources.pointerSources,
      };
    },
    reset() {
      previousMenuTogglePressed = false;
      controllerObjects.clear();
    },
  };
}

export function createControllerSources(
  inputSources: readonly XRInputSource[],
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  referenceSpaceToWorldMatrix: THREE.Matrix4,
): {
  readonly pointerSources: readonly ScenePalettePointerSource[];
  readonly menuTogglePressed: boolean;
} {
  const pointerSources: ScenePalettePointerSource[] = [];
  let menuTogglePressed = false;

  for (const source of inputSources) {
    const handedness = source.handedness === "left" || source.handedness === "right" ? source.handedness : undefined;
    if (!handedness || source.hand) {
      continue;
    }

    const targetRayPose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!targetRayPose) {
      continue;
    }

    const id = `controller:${handedness}`;
    const object = controllerObjects.get(id) ?? new THREE.Object3D();
    applyXrPoseToObject(object, targetRayPose.transform, referenceSpaceToWorldMatrix);
    object.updateMatrixWorld(true);
    controllerObjects.set(id, object);

    menuTogglePressed ||= isMenuTogglePressed(source.gamepad);

    pointerSources.push({
      id,
      kind: "xr-controller",
      object,
      selectPressed: isSelectPressed(source.gamepad),
      dominant: handedness === "right",
      visibleRay: true,
    });
  }

  return {
    pointerSources,
    menuTogglePressed,
  };
}

function applyXrPoseToObject(
  object: THREE.Object3D,
  transform: Pick<XRRigidTransform, "position" | "orientation">,
  referenceSpaceToWorldMatrix: THREE.Matrix4,
): void {
  const worldMatrix = referenceSpaceToWorldMatrix.clone().multiply(xrRigidTransformLocalMatrix(transform));
  worldMatrix.decompose(object.position, object.quaternion, object.scale);
}

export function isSelectPressed(gamepad: XRInputSource["gamepad"] | undefined): boolean {
  return gamepad?.buttons?.[0]?.pressed === true;
}

export function isMenuTogglePressed(gamepad: XRInputSource["gamepad"] | undefined): boolean {
  return gamepad?.buttons?.[4]?.pressed === true
    || gamepad?.buttons?.[5]?.pressed === true;
}

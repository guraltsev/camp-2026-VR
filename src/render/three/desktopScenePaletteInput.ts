import * as THREE from "three";
import type { DesktopInputFrame } from "./desktopControls";
import type {
  ScenePaletteInputFrame,
  ScenePalettePlacement,
  ScenePalettePointerSource,
} from "./scenePaletteInput";
import {
  clampScenePaletteLocalPoint,
  scenePalettePanelHeightMeters,
  scenePalettePanelWidthMeters,
} from "./scenePaletteLayout";

export interface DesktopScenePaletteInput {
  update(options: {
    readonly desktopFrame: DesktopInputFrame;
    readonly deltaSeconds: number;
    readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    readonly isOpen: boolean;
    readonly placement: ScenePalettePlacement;
  }): ScenePaletteInputFrame;
  dispose(): void;
}

export type DesktopScenePaletteToggleAction = "open" | "right-action" | "close" | "none";

const cursorSpeed = 0.0032;
const cameraPosition = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
const cameraScale = new THREE.Vector3();
const targetLocal = new THREE.Vector3();
const targetWorld = new THREE.Vector3();
const pointerDirection = new THREE.Vector3();
const forwardAxis = new THREE.Vector3(0, 0, -1);

export function createDesktopScenePaletteInput(): DesktopScenePaletteInput {
  const pointerObject = new THREE.Object3D();
  pointerObject.name = "desktop-scene-palette-pointer";
  let cursorLocalX = 0;
  let cursorLocalY = 0;
  let previousMenuTogglePressed = false;

  return {
    update({ desktopFrame, deltaSeconds, camera, isOpen, placement }) {
      if (!isOpen) {
        cursorLocalX = 0;
        cursorLocalY = 0;
      } else {
        const clampedCursor = clampScenePaletteLocalPoint(
          cursorLocalX - desktopFrame.palettePointerDeltaPixels.x * cursorSpeed * scenePalettePanelWidthMeters * 0.5,
          cursorLocalY - desktopFrame.palettePointerDeltaPixels.y * cursorSpeed * scenePalettePanelHeightMeters * 0.5,
        );
        cursorLocalX = clampedCursor.x;
        cursorLocalY = clampedCursor.y;
      }

      camera.updateMatrixWorld(true);
      camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);
      targetLocal.set(
        cursorLocalX,
        cursorLocalY,
        0,
      );
      targetWorld.copy(targetLocal)
        .multiplyScalar(placement.scale ?? 1)
        .applyQuaternion(placement.quaternion)
        .add(placement.position);

      pointerObject.position.copy(cameraPosition);
      pointerDirection.copy(targetWorld).sub(cameraPosition).normalize();
      pointerObject.quaternion.setFromUnitVectors(forwardAxis, pointerDirection);
      pointerObject.updateMatrixWorld(true);

      const rawMenuTogglePressed = false;
      const menuTogglePressed = rawMenuTogglePressed && !previousMenuTogglePressed;
      const pointers: ScenePalettePointerSource[] = isOpen ? [{
        id: "desktop-aimer",
        kind: "desktop-aimer",
        object: pointerObject,
        selectPressed: desktopFrame.paletteSelectPressed,
        dominant: true,
        visibleRay: false,
      }] : [];
      previousMenuTogglePressed = rawMenuTogglePressed;

      return {
        deltaSeconds,
        menuTogglePressed,
        pointers,
      };
    },
    dispose() {
      pointerObject.removeFromParent();
    },
  };
}

export function reduceDesktopScenePaletteToggle(
  isOpen: boolean,
  event: "secondary-click" | "escape-key",
): DesktopScenePaletteToggleAction {
  if (event === "secondary-click") {
    return isOpen ? "right-action" : "open";
  }
  return isOpen ? "close" : "none";
}

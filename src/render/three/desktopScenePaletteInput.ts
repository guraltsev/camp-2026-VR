import * as THREE from "three";
import type { DesktopInputFrame } from "./desktopControls";
import type {
  ScenePaletteInputFrame,
  ScenePalettePlacement,
  ScenePalettePointerSource,
} from "./scenePaletteInput";

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

const cursorClamp = 0.92;
const cursorSpeed = 0.0032;
const panelWidthMeters = 720 * 0.0012;
const panelHeightMeters = 500 * 0.0012;
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
  let cursorX = 0;
  let cursorY = 0;
  let previousMenuTogglePressed = false;

  return {
    update({ desktopFrame, deltaSeconds, camera, isOpen, placement }) {
      if (!isOpen) {
        cursorX = 0;
        cursorY = 0;
      } else {
        cursorX = THREE.MathUtils.clamp(
          cursorX + desktopFrame.palettePointerDeltaPixels.x * cursorSpeed,
          -cursorClamp,
          cursorClamp,
        );
        cursorY = THREE.MathUtils.clamp(
          cursorY + desktopFrame.palettePointerDeltaPixels.y * cursorSpeed,
          -cursorClamp,
          cursorClamp,
        );
      }

      camera.updateMatrixWorld(true);
      camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);
      targetLocal.set(
        -cursorX * panelWidthMeters * 0.5,
        -cursorY * panelHeightMeters * 0.5,
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

export function desktopTooltipHintRequestsAimCycle(text: string | undefined): boolean {
  return text?.toLocaleLowerCase().includes("cycle") ?? false;
}

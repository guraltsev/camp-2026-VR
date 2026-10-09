/** Shows the floating tooltip above the object a VR controller points at. */
import * as THREE from "three";
import { disposeObject3D } from "./runtimeSceneUtils";
import { resolveFrontFacingQuaternion } from "./vrPalettePlacement";
import { worldPointToThree } from "./worldAxes";
import { createXrObjectTooltip, xrObjectTooltipYOffsetMeters } from "./xrObjectTooltipMesh";

export interface XrObjectTooltipControllerDeps {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
}

export function createXrObjectTooltipController(deps: XrObjectTooltipControllerDeps) {
  const { scene, camera } = deps;
  let xrObjectTooltip: { readonly text: string; readonly root: THREE.Object3D } | undefined;

  function updateXrObjectTooltip(options: {
    readonly text: string;
    readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
    readonly headWorldPosition?: THREE.Vector3;
  } | undefined): void {
    if (!options) {
      if (xrObjectTooltip) {
        xrObjectTooltip.root.visible = false;
      }
      return;
    }

    const tooltip = syncXrObjectTooltip(options.text);
    tooltip.root.visible = true;
    tooltip.root.position.copy(worldPointToThree({
      x: options.anchor.x,
      y: options.anchor.y,
      z: options.anchor.z + xrObjectTooltipYOffsetMeters,
    }));
    tooltip.root.quaternion.copy(
      options.headWorldPosition
        ? resolveFrontFacingQuaternion(tooltip.root.position, options.headWorldPosition)
        : camera.quaternion,
    );
    tooltip.root.updateMatrixWorld(true);
  }

  function syncXrObjectTooltip(text: string): { readonly text: string; readonly root: THREE.Object3D } {
    if (xrObjectTooltip?.text === text) {
      return xrObjectTooltip;
    }

    clearXrObjectTooltip();
    const root = createXrObjectTooltip(text);
    root.name = "xr-object-tooltip";
    scene.add(root);
    xrObjectTooltip = { text, root };
    return xrObjectTooltip;
  }

  function clearXrObjectTooltip(): void {
    if (!xrObjectTooltip) {
      return;
    }

    xrObjectTooltip.root.removeFromParent();
    disposeObject3D(xrObjectTooltip.root);
    xrObjectTooltip = undefined;
  }

  return { updateXrObjectTooltip, clearXrObjectTooltip };
}

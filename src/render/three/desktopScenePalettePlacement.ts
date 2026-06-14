import * as THREE from "three";
import type { ScenePalettePlacement } from "./scenePaletteInput";

const forward = new THREE.Vector3(0, 0, -1);
const up = new THREE.Vector3(0, 1, 0);
const cameraPosition = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
const cameraScale = new THREE.Vector3();

export function resolveDesktopScenePalettePlacement(options: {
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly previousPlacement?: ScenePalettePlacement;
  readonly freeze?: boolean;
}): ScenePalettePlacement {
  if (options.freeze && options.previousPlacement) {
    return {
      position: options.previousPlacement.position.clone(),
      quaternion: options.previousPlacement.quaternion.clone(),
      scale: options.previousPlacement.scale,
      freeze: true,
    };
  }

  options.camera.updateMatrixWorld(true);
  options.camera.matrixWorld.decompose(cameraPosition, cameraQuaternion, cameraScale);
  const position = cameraPosition.clone().add(forward.clone().applyQuaternion(cameraQuaternion).multiplyScalar(1.05));
  const panelUp = up.clone().applyQuaternion(cameraQuaternion).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, cameraPosition, panelUp),
  );

  return {
    position,
    quaternion,
    scale: 1,
    freeze: options.freeze,
  };
}

import * as THREE from "three";

export interface StylizedSceneLighting {
  readonly hemisphereLight: THREE.HemisphereLight;
  readonly ambientLight: THREE.AmbientLight;
  readonly lights: readonly [THREE.HemisphereLight, THREE.AmbientLight];
}

export function createStylizedSceneLighting(scene: THREE.Scene): StylizedSceneLighting {
  const hemisphereLight = new THREE.HemisphereLight(0xf6f8ff, 0x304050, 1.85);
  hemisphereLight.castShadow = false;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
  ambientLight.castShadow = false;

  scene.add(hemisphereLight);
  scene.add(ambientLight);

  return {
    hemisphereLight,
    ambientLight,
    lights: [hemisphereLight, ambientLight],
  };
}

export function updateStylizedSceneLighting(
  _lighting: StylizedSceneLighting,
  _camera: THREE.Camera,
): void {
  // The stylized ambient + hemisphere rig is intentionally portal-invariant.
}

export function disposeStylizedSceneLighting(
  lighting: StylizedSceneLighting,
  scene?: THREE.Scene,
): void {
  for (const light of lighting.lights) {
    if (scene) {
      scene.remove(light);
    } else {
      light.removeFromParent();
    }
  }
}

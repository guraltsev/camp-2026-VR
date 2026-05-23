import * as THREE from "three";
import type { AppState } from "../../appState";

export interface ThreeApp {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  dispose(): void;
}

export function createThreeApp(container: HTMLElement, appState: AppState): ThreeApp {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1.6, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.append(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x304050, 2);
  scene.add(light);

  const geometry = new THREE.BoxGeometry(4, 3, 4);
  const material = new THREE.MeshBasicMaterial({ color: 0x5fb3b3, wireframe: true });
  const roomPreview = new THREE.Mesh(geometry, material);
  roomPreview.name = `Preview for ${appState.world.cells.length} prism cells`;
  scene.add(roomPreview);

  renderer.render(scene, camera);

  return {
    scene,
    renderer,
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

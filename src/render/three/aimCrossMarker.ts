import * as THREE from "three";
import type { AimTarget } from "./aimTarget";
import { worldPointToThree } from "./worldAxes";

export interface AimCrossMarker {
  readonly root: THREE.Group;
  update(target: AimTarget | undefined): void;
  dispose(): void;
}

const crossRadiusMeters = 0.16;
const surfaceLiftMeters = 0.01;
const markerNormal = new THREE.Vector3(0, 0, 1);

export function createAimCrossMarker(scene: THREE.Scene): AimCrossMarker {
  const root = new THREE.Group();
  root.name = "aim-cross-marker";
  root.visible = false;
  root.renderOrder = 50;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([
      -crossRadiusMeters, 0, 0,
      crossRadiusMeters, 0, 0,
      0, -crossRadiusMeters, 0,
      0, crossRadiusMeters, 0,
    ]), 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xef1b1b,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = "aim-cross-marker-lines";
  root.add(lines);
  scene.add(root);

  return {
    root,
    update(target) {
      if (!target) {
        root.visible = false;
        return;
      }

      const normal = worldPointToThree(target.rootNormal).normalize();
      const position = worldPointToThree(target.rootPoint).addScaledVector(normal, surfaceLiftMeters);
      root.visible = true;
      root.position.copy(position);
      root.quaternion.setFromUnitVectors(markerNormal, normal);
      root.updateMatrixWorld();
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

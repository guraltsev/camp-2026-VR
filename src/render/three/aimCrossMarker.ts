import * as THREE from "three";
import type { AimTarget } from "./aimTarget";
import { worldPointToThree } from "./worldAxes";

export interface AimCrossMarker {
  readonly root: THREE.Group;
  update(target: AimTarget | undefined, orientation?: AimCrossMarkerOrientation): void;
  dispose(): void;
}

export interface AimCrossMarkerOrientation {
  readonly quaternion: THREE.Quaternion;
}

const crossRadiusMeters = 0.16;
const surfaceLiftMeters = 0.01;
const fallbackMarkerRight = new THREE.Vector3(1, 0, 0);
const fallbackMarkerUp = new THREE.Vector3(0, 1, 0);

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
    update(target, orientation) {
      if (!target) {
        root.visible = false;
        return;
      }

      const normal = worldPointToThree(target.rootNormal).normalize();
      const position = worldPointToThree(target.rootPoint).addScaledVector(normal, surfaceLiftMeters);
      root.visible = true;
      root.position.copy(position);
      root.quaternion.copy(resolveAimCrossMarkerQuaternion(normal, orientation?.quaternion));
      root.updateMatrixWorld();
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

export function resolveAimCrossMarkerQuaternion(
  surfaceNormal: THREE.Vector3,
  sourceQuaternion?: THREE.Quaternion,
): THREE.Quaternion {
  const normal = surfaceNormal.clone().normalize();
  const sourceRight = fallbackMarkerRight.clone();
  const sourceUp = fallbackMarkerUp.clone();
  if (sourceQuaternion) {
    sourceRight.applyQuaternion(sourceQuaternion);
    sourceUp.applyQuaternion(sourceQuaternion);
  }

  const right = projectDirectionOntoPlane(sourceRight, normal)
    ?? projectDirectionOntoPlane(sourceUp.cross(normal), normal)
    ?? projectDirectionOntoPlane(fallbackMarkerRight, normal)
    ?? new THREE.Vector3(1, 0, 0);
  const up = normal.clone().cross(right).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, normal);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function projectDirectionOntoPlane(direction: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 | undefined {
  const projected = direction.clone().addScaledVector(normal, -direction.dot(normal));
  return projected.lengthSq() > 1e-8 ? projected.normalize() : undefined;
}

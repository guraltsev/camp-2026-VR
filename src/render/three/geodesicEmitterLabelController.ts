/** Keeps the floating geodesic-name labels next to nearby emitters in sync with the registry. */
import * as THREE from "three";
import { type PlayerPose } from "../../movement/playerPose";
import { resolveGeodesicNumber } from "../../world-objects/geodesicCannon";
import { type RuntimeObjectRegistry } from "../../world-objects/runtimeObjectRegistry";
import {
  createGeodesicEmitterLabel,
  geodesicEmitterLabelRangeMeters,
  getGeodesicEmitterLabelKey,
  resolveGeodesicEmitterLabelPosition,
} from "./geodesicEmitterLabels";
import { disposeObject3D } from "./runtimeSceneUtils";

export interface GeodesicEmitterLabel {
  readonly text: string;
  readonly root: THREE.Object3D;
}

export interface GeodesicEmitterLabelControllerDeps {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly runtimeObjectRegistry: RuntimeObjectRegistry;
  readonly geodesicEmitterLabelsByKey: Map<string, GeodesicEmitterLabel>;
  getPlayerPose(): PlayerPose;
}

export function createGeodesicEmitterLabelController(deps: GeodesicEmitterLabelControllerDeps) {
  const { scene, camera, runtimeObjectRegistry, geodesicEmitterLabelsByKey } = deps;

  function updateGeodesicEmitterLabels(): void {
    const activeLabelKeys = new Set<string>();
    const cameraQuaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraQuaternion);

    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "geodesic-cannon") {
        continue;
      }

      const inCurrentCell = object.cellId === deps.getPlayerPose().cellId;
      const distanceMeters = Math.hypot(
        deps.getPlayerPose().position.x - object.localPose.translation.x,
        deps.getPlayerPose().position.y - object.localPose.translation.y,
      );
      const visible = inCurrentCell && distanceMeters <= geodesicEmitterLabelRangeMeters;
      object.geodesicIds.forEach((geodesicId) => {
        const key = getGeodesicEmitterLabelKey(object.id, geodesicId);
        activeLabelKeys.add(key);
        const text = getGeodesicDisplayName(geodesicId);
        const label = syncGeodesicEmitterLabelObject(key, text);
        label.root.visible = visible;
        if (!visible) {
          return;
        }

        label.root.position.copy(resolveGeodesicEmitterLabelPosition(object, geodesicId));
        label.root.quaternion.copy(cameraQuaternion);
        label.root.updateMatrixWorld(true);
      });
    }

    for (const [key, label] of [...geodesicEmitterLabelsByKey]) {
      if (activeLabelKeys.has(key)) {
        continue;
      }

      label.root.removeFromParent();
      disposeObject3D(label.root);
      geodesicEmitterLabelsByKey.delete(key);
    }
  }

  function syncGeodesicEmitterLabelObject(key: string, text: string): { readonly text: string; readonly root: THREE.Object3D } {
    const existing = geodesicEmitterLabelsByKey.get(key);
    if (existing?.text === text) {
      return existing;
    }

    if (existing) {
      existing.root.removeFromParent();
      disposeObject3D(existing.root);
    }

    const root = createGeodesicEmitterLabel(text);
    root.name = `geodesic-emitter-label:${key}`;
    scene.add(root);
    const next = { text, root };
    geodesicEmitterLabelsByKey.set(key, next);
    return next;
  }

  function getGeodesicDisplayName(geodesicId: string): string {
    return `G${resolveGeodesicNumber(runtimeObjectRegistry, geodesicId)}`;
  }

  function getGeodesicLabelsById(geodesicIds: readonly string[]): Readonly<Record<string, string>> {
    return Object.fromEntries(geodesicIds.map((geodesicId) => [geodesicId, getGeodesicDisplayName(geodesicId)]));
  }

  return { updateGeodesicEmitterLabels, getGeodesicDisplayName, getGeodesicLabelsById };
}

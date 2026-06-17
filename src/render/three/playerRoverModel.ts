import * as THREE from "three";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import type { PlayerPose } from "../../movement/playerPose";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import {
  collectRuntimeObjectRenderSourceMeshes,
  type RuntimeObjectRenderRecord,
  type RuntimeObjectRenderSourceMesh,
} from "./runtimeObjectRenderRecords";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export const playerRoverAssetPath = "rover/rover.glb";

const playerRoverObjectId = "player-rover";
const playerRoverArchetypePrefix = `player-avatar:${playerRoverObjectId}`;
const playerRoverScale = 0.1925;

export interface PlayerRoverRenderModel {
  readonly root: THREE.Object3D;
  readonly objectId: string;
  collectSources(): readonly RuntimeObjectRenderSourceMesh[];
  collectRecords(
    playerPose: PlayerPose,
    archetypeKeys: Iterable<string>,
  ): readonly RuntimeObjectRenderRecord[];
}

export function createPlayerRoverRenderModel(
  assets: PreparedWorldAssets,
): PlayerRoverRenderModel | undefined {
  const prepared = assets.instantiateGltf(playerRoverAssetPath);

  if (!prepared) {
    return undefined;
  }

  const root = new THREE.Group();
  root.name = "player-rover-render-root";

  prepared.scene.name = "player-rover-model";
  prepared.scene.scale.setScalar(playerRoverScale);
  prepared.scene.rotation.y = Math.PI;
  root.add(prepared.scene);

  return {
    root,
    objectId: playerRoverObjectId,
    collectSources() {
      return collectRuntimeObjectRenderSourceMeshes(
        playerRoverObjectId,
        root,
        playerRoverArchetypePrefix,
      );
    },
    collectRecords(playerPose, archetypeKeys) {
      const localMatrix = rigidTransformToThreeMatrix(
        yawRigidTransform3(playerPose.yawRadians, playerPose.position),
      );

      return [...archetypeKeys]
        .filter((key) => key.startsWith(`${playerRoverArchetypePrefix}:mesh:`))
        .map((archetypeKey) => ({
          objectId: playerRoverObjectId,
          cellId: playerPose.cellId,
          archetypeKey,
          localMatrix,
          omitRootVisiblePath: true,
        }));
    },
  };
}

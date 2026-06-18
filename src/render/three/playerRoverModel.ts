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
import { standardUserRobotObject } from "../../world-objects/library";

export const playerRoverAssetPath = standardUserRobotObject.assetPath;

const playerRoverObjectId = standardUserRobotObject.id;
const playerRoverArchetypePrefix = `player-avatar:${playerRoverObjectId}`;

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
  prepared.scene.scale.setScalar(standardUserRobotObject.scale);
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

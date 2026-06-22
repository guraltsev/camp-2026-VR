import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import type { PlayerPose } from "../../movement/playerPose";
import { playerPoseToDynamicObject } from "../../movement/playerPose";
import type { DynamicObjectState } from "../../movement/dynamicObject";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { collectPortalGhostRuntimeObjectRenderRecords } from "./runtimeObjectGhostRecords";
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
    options?: PlayerRoverRenderRecordOptions,
  ): readonly RuntimeObjectRenderRecord[];
}

export interface PlayerRoverRenderRecordOptions {
  readonly ghostWorld?: CompiledCellComplex;
  readonly collision?: DynamicObjectState["collision"];
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
    collectRecords(playerPose, archetypeKeys, options) {
      const localMatrix = rigidTransformToThreeMatrix(
        yawRigidTransform3(playerPose.yawRadians, playerPose.position),
      );
      const matchingArchetypeKeys = [...archetypeKeys]
        .filter((key) => key.startsWith(`${playerRoverArchetypePrefix}:mesh:`));
      const baseRecords = matchingArchetypeKeys.map((archetypeKey) => ({
        objectId: playerRoverObjectId,
        cellId: playerPose.cellId,
        archetypeKey,
        localMatrix,
        omitRootVisiblePath: true,
      }));
      const ghostRecords = options?.ghostWorld && options.collision
        ? collectPortalGhostRuntimeObjectRenderRecords({
            world: options.ghostWorld,
            object: {
              id: playerRoverObjectId,
              ...playerPoseToDynamicObject(playerPose, options.collision),
            },
            archetypeKeys: matchingArchetypeKeys,
          })
        : [];

      return [...baseRecords, ...ghostRecords];
    },
  };
}

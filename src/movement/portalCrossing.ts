import type { CompiledPortal } from "../cell-complex/specs";
import { composeRigidTransform3 } from "../math/rigidTransform3";
import type { PlayerPose } from "./playerPose";
import type { DynamicObjectState } from "./dynamicObject";
import { playerPoseToDynamicObject, playerPoseFromDynamicObject } from "./playerPose";

export function crossDynamicObjectPortal(object: DynamicObjectState, portal: CompiledPortal): DynamicObjectState {
  return {
    ...object,
    cellId: portal.targetCellId,
    localPose: composeRigidTransform3(portal.transformToTarget, object.localPose),
  };
}

export function crossPortal(pose: PlayerPose, portal: CompiledPortal): PlayerPose {
  return playerPoseFromDynamicObject(
    crossDynamicObjectPortal(playerPoseToDynamicObject(pose), portal),
    pose.pitchRadians,
  );
}

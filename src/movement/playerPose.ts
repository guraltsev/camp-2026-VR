import { yawRigidTransform3 } from "../math/rigidTransform3";
import type { DynamicObjectState } from "./dynamicObject";
import type { Vec3 } from "../math/vec3";

export interface PlayerPose {
  readonly cellId: string;
  readonly position: Vec3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
}

export function createDefaultPlayerPose(cellId: string): PlayerPose {
  return {
    cellId,
    position: { x: 0, y: 0, z: 0 },
    yawRadians: 0,
    pitchRadians: 0,
  };
}

export function playerPoseToDynamicObject(pose: PlayerPose, collision?: DynamicObjectState["collision"]): DynamicObjectState {
  return {
    cellId: pose.cellId,
    localPose: yawRigidTransform3(pose.yawRadians, pose.position),
    collision,
  };
}

export function playerPoseFromDynamicObject(object: DynamicObjectState, pitchRadians: number): PlayerPose {
  return {
    cellId: object.cellId,
    position: object.localPose.translation,
    yawRadians: Math.atan2(-object.localPose.rotation.m20, object.localPose.rotation.m00),
    pitchRadians,
  };
}

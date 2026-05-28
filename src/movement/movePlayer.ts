import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import { addVec3, type Vec3 } from "../math/vec3";
import { DEFAULT_PLAYER_HEIGHT_METERS, DEFAULT_PLAYER_RADIUS_METERS, type PlayerBody } from "./playerBody";
import type { PlayerPose } from "./playerPose";
import { playerPoseFromDynamicObject, playerPoseToDynamicObject } from "./playerPose";
import { simpleCollisionBox } from "./dynamicObject";
import { moveDynamicObject } from "./moveDynamicObject";
import type { BlockingReason } from "./collision";

export type MovementCoordinateFrame = "global" | "current-cell";

export interface MoveRequest {
  readonly world?: CompiledCellComplex;
  readonly pose: PlayerPose;
  readonly body?: PlayerBody;
  readonly localDisplacement: Vec3;
  readonly yawDeltaRadians: number;
  readonly pitchDeltaRadians: number;
  readonly coordinateFrame: MovementCoordinateFrame;
}

export type MoveResult = {
  readonly kind: "moved";
  readonly pose: PlayerPose;
  readonly attemptedDisplacement: Vec3;
  readonly blocked: boolean;
  readonly blockingReason?: BlockingReason;
  readonly crossedPortal: boolean;
  readonly crossedPortalId?: string;
};

export function movePlayer(request: MoveRequest): MoveResult {
  const yawRadians = request.pose.yawRadians + request.yawDeltaRadians;
  const pitchRadians = clampPitch(request.pose.pitchRadians + request.pitchDeltaRadians);
  const displacement = resolveLocalDisplacement(request.localDisplacement, yawRadians, request.coordinateFrame);
  const rotatedPose = {
    ...request.pose,
    yawRadians,
    pitchRadians,
  };

  if (request.world) {
    const body = request.body ?? {
      radiusMeters: DEFAULT_PLAYER_RADIUS_METERS,
      heightMeters: DEFAULT_PLAYER_HEIGHT_METERS,
    };
    const result = moveDynamicObject({
      world: request.world,
      object: playerPoseToDynamicObject(
        rotatedPose,
        simpleCollisionBox(body.radiusMeters * 2, body.heightMeters, body.radiusMeters * 2, {
          x: 0,
          y: 0,
          z: body.heightMeters / 2,
        }),
      ),
      displacement,
      portalCrossingMode: "anchor",
    });

    return {
      kind: "moved",
      pose: playerPoseFromDynamicObject(result.object, pitchRadians),
      attemptedDisplacement: result.attemptedDisplacement,
      blocked: result.blocked,
      blockingReason: result.blockingReason,
      crossedPortal: result.crossedPortal,
      crossedPortalId: result.crossedPortalId,
    };
  }

  return {
    kind: "moved",
    pose: {
      ...request.pose,
      yawRadians,
      pitchRadians,
      position: addVec3(request.pose.position, displacement),
    },
    attemptedDisplacement: displacement,
    blocked: false,
    crossedPortal: false,
  };
}

function clampPitch(pitchRadians: number): number {
  const maxPitchRadians = Math.PI / 2 - 0.01;

  return Math.max(-maxPitchRadians, Math.min(maxPitchRadians, pitchRadians));
}

function resolveLocalDisplacement(
  localDisplacement: Vec3,
  yawRadians: number,
  coordinateFrame: MovementCoordinateFrame,
): Vec3 {
  const sinYaw = Math.sin(yawRadians);
  const cosYaw = Math.cos(yawRadians);
  const displacement = {
    x: cosYaw * localDisplacement.x - sinYaw * localDisplacement.y,
    y: sinYaw * localDisplacement.x + cosYaw * localDisplacement.y,
    z: localDisplacement.z,
  };

  if (coordinateFrame === "current-cell") {
    return displacement;
  }

  return displacement;
}

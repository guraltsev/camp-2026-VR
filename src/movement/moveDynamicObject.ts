import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CompiledPrismSide } from "../cell-complex/prismCells";
import { rigidTransform3 } from "../math/rigidTransform3";
import { addVec3, type Vec3 } from "../math/vec3";
import {
  projectPointAlongSide,
  signedDistanceToSide,
  testCellCollision,
  type BlockingReason,
} from "./collision";
import type { DynamicObjectState } from "./dynamicObject";
import { crossDynamicObjectPortal } from "./portalCrossing";

export interface MoveDynamicObjectRequest {
  readonly world: CompiledCellComplex;
  readonly object: DynamicObjectState;
  readonly displacement: Vec3;
}

export interface MoveDynamicObjectResult {
  readonly object: DynamicObjectState;
  readonly attemptedDisplacement: Vec3;
  readonly blocked: boolean;
  readonly blockingReason?: BlockingReason;
  readonly crossedPortal: boolean;
  readonly crossedPortalId?: string;
}

export function moveDynamicObject(request: MoveDynamicObjectRequest): MoveDynamicObjectResult {
  const startCell = request.world.cellsById.get(request.object.cellId);

  if (!startCell) {
    throw new Error(`Cannot move object in missing cell "${request.object.cellId}".`);
  }

  const candidateObject = translateObject(request.object, request.displacement);
  const crossingSide = findPortalCrossingSide(
    startCell.sides,
    request.object.localPose.translation,
    candidateObject.localPose.translation,
    startCell.heightMeters,
  );

  if (crossingSide?.portal) {
    const sourceCollision = testCellCollision({
      cell: startCell,
      position: candidateObject.localPose.translation,
      collision: candidateObject.collision,
      ignoredPortalSideIndex: crossingSide.sideIndex,
    });

    if (sourceCollision.blocked) {
      return blockedResult(request, sourceCollision.reason);
    }

    const crossedObject = crossDynamicObjectPortal(candidateObject, crossingSide.portal);
    const targetCell = request.world.cellsById.get(crossedObject.cellId);

    if (!targetCell) {
      throw new Error(`Portal "${crossingSide.portal.id}" targets missing cell "${crossedObject.cellId}".`);
    }

    const targetCollision = testCellCollision({
      cell: targetCell,
      position: crossedObject.localPose.translation,
      collision: crossedObject.collision,
      ignoredPortalSideIndex: targetCell.portalsById.get(crossingSide.portal.targetPortalId)?.sideIndex,
    });

    if (targetCollision.blocked) {
      return blockedResult(request, targetCollision.reason);
    }

    return {
      object: crossedObject,
      attemptedDisplacement: request.displacement,
      blocked: false,
      crossedPortal: true,
      crossedPortalId: crossingSide.portal.id,
    };
  }

  const collision = testCellCollision({
    cell: startCell,
    position: candidateObject.localPose.translation,
    collision: candidateObject.collision,
  });

  if (collision.blocked) {
    return blockedResult(request, collision.reason);
  }

  return {
    object: candidateObject,
    attemptedDisplacement: request.displacement,
    blocked: false,
    crossedPortal: false,
  };
}

function blockedResult(
  request: MoveDynamicObjectRequest,
  blockingReason: BlockingReason | undefined,
): MoveDynamicObjectResult {
  return {
    object: request.object,
    attemptedDisplacement: request.displacement,
    blocked: true,
    blockingReason,
    crossedPortal: false,
  };
}

function translateObject(object: DynamicObjectState, displacement: Vec3): DynamicObjectState {
  return {
    ...object,
    localPose: rigidTransform3(
      object.localPose.rotation,
      addVec3(object.localPose.translation, displacement),
    ),
  };
}

function findPortalCrossingSide(
  sides: readonly CompiledPrismSide[],
  start: Vec3,
  end: Vec3,
  heightMeters: number,
): CompiledPrismSide | undefined {
  return sides.find((side) => {
    if (!side.portal) {
      return false;
    }

    const startDistance = signedDistanceToSide(side, start);
    const endDistance = signedDistanceToSide(side, end);
    const sideProjection = projectPointAlongSide(side, end);

    return (
      startDistance >= 0 &&
      endDistance < 0 &&
      sideProjection >= 0 &&
      sideProjection <= side.lengthMeters &&
      end.y >= 0 &&
      end.y <= heightMeters
    );
  });
}

import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { composeRigidTransform3 } from "../../math/rigidTransform3";
import {
  getDynamicObjectCollisionBounds,
  getSideSupport,
  projectPointAlongSide,
  signedDistanceToSide,
} from "../../movement/collision";
import { runtimeObjectToDynamicObjectState, type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { rigidTransformToThreeMatrix } from "./worldAxes";
import type { RuntimeObjectRenderRecord } from "./runtimeObjectRenderRecords";

export const defaultPortalGhostActivationClearanceMeters = 0.02;

export interface PortalGhostRuntimeObjectRenderRecordRequest {
  readonly world: CompiledCellComplex;
  readonly object: RuntimeWorldObject;
  readonly archetypeKeys: Iterable<string>;
  readonly activationClearanceMeters?: number;
}

export function collectPortalGhostRuntimeObjectRenderRecords(
  request: PortalGhostRuntimeObjectRenderRecordRequest,
): readonly RuntimeObjectRenderRecord[] {
  const cell = request.world.cellsById.get(request.object.cellId);

  if (!cell) {
    return [];
  }

  const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(request.object));

  if (!bounds) {
    return [];
  }

  const records: RuntimeObjectRenderRecord[] = [];
  const activationClearanceMeters =
    request.activationClearanceMeters ?? defaultPortalGhostActivationClearanceMeters;
  const archetypeKeys = [...request.archetypeKeys];

  if (archetypeKeys.length === 0) {
    return [];
  }

  for (const side of cell.sides) {
    if (!side.portal) {
      continue;
    }

    const clearance = signedDistanceToSide(side, bounds.center) - getSideSupport(side, bounds);
    if (clearance > activationClearanceMeters) {
      continue;
    }

    const projection = projectPointAlongSide(side, bounds.center);
    if (projection < -bounds.radius || projection > side.lengthMeters + bounds.radius) {
      continue;
    }

    const ghostPose = composeRigidTransform3(side.portal.transformToTarget, request.object.localPose);
    const ghostMatrix = rigidTransformToThreeMatrix(ghostPose);

    for (const archetypeKey of archetypeKeys) {
      records.push({
        objectId: request.object.id,
        cellId: side.portal.targetCellId,
        archetypeKey,
        localMatrix: ghostMatrix,
      });
    }
  }

  return records;
}

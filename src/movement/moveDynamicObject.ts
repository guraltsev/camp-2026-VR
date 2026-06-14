import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CompiledPrismSide } from "../cell-complex/prismCells";
import { rigidTransform3 } from "../math/rigidTransform3";
import { addVec3, type Vec3 } from "../math/vec3";
import {
  getDynamicObjectCollisionBounds,
  projectPointAlongSide,
  getSideSupport,
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
  readonly portalCrossingMode?: PortalCrossingMode;
  readonly ignoreForbiddenZones?: boolean;
}

export interface MoveDynamicObjectResult {
  readonly object: DynamicObjectState;
  readonly attemptedDisplacement: Vec3;
  readonly blocked: boolean;
  readonly blockingReason?: BlockingReason;
  readonly crossedPortal: boolean;
  readonly crossedPortalId?: string;
}

export type PortalCrossingMode = "bounds" | "anchor";
export const AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE: PortalCrossingMode = "anchor";

export function moveDynamicObject(request: MoveDynamicObjectRequest): MoveDynamicObjectResult {
  const startCell = request.world.cellsById.get(request.object.cellId);

  if (!startCell) {
    throw new Error(`Cannot move object in missing cell "${request.object.cellId}".`);
  }

  const candidateObject = translateObject(request.object, request.displacement);
  const crossingSide = findAnchorPortalCrossing(startCell, request.object, candidateObject);

  if (crossingSide?.portal) {
    const crossedObject = crossDynamicObjectPortal(candidateObject, crossingSide.portal);
    const targetCell = request.world.cellsById.get(crossedObject.cellId);

    if (!targetCell) {
      throw new Error(`Portal "${crossingSide.portal.id}" targets missing cell "${crossedObject.cellId}".`);
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
    object: candidateObject,
    previousObject: request.object,
    ignoreForbiddenZones: request.ignoreForbiddenZones,
  });

  if (collision.blocked) {
    const resolvedObject =
      collision.reason === "wall"
        ? resolveBlockedWallPosition(
            candidateObject,
            startCell.sides.find((side) => side.sideIndex === collision.sideIndex),
          )
        : request.object;

    return blockedResult(request, collision.reason, resolvedObject);
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
  object = request.object,
): MoveDynamicObjectResult {
  return {
    object,
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

function findAnchorPortalCrossing(
  cell: { readonly sides: readonly CompiledPrismSide[] },
  startObject: DynamicObjectState,
  endObject: DynamicObjectState,
): CompiledPrismSide | undefined {
  let crossing: CompiledPrismSide | undefined;
  let bestEndClearance = 0;

  for (const side of cell.sides) {
    if (!side.portal) {
      continue;
    }

    const startClearance = signedDistanceToSide(side, startObject.localPose.translation);
    const endClearance = signedDistanceToSide(side, endObject.localPose.translation);
    const endProjection = projectPointAlongSide(side, endObject.localPose.translation);

    if (startClearance >= 0 && endClearance < 0 && endProjection >= 0 && endProjection <= side.lengthMeters) {
      if (!crossing || endClearance < bestEndClearance) {
        crossing = side;
        bestEndClearance = endClearance;
      }
    }
  }

  return crossing;
}

function resolveBlockedWallPosition(
  object: DynamicObjectState,
  side: CompiledPrismSide | undefined,
): DynamicObjectState {
  if (!side) {
    return object;
  }

  const bounds = getDynamicObjectCollisionBounds(object);
  const point = bounds?.center ?? object.localPose.translation;
  const support = bounds ? getSideSupport(side, bounds) : 0;
  const clearance = getSignedClearanceToSide(side, point, support);
  const inwardOffset = clearance < 0 ? -clearance + 1e-6 : 0;

  if (inwardOffset === 0) {
    return object;
  }

  return translateObject(object, {
    x: side.inwardNormal.x * inwardOffset,
    y: side.inwardNormal.y * inwardOffset,
    z: 0,
  });
}

function getSignedClearanceToSide(side: CompiledPrismSide, point: Vec3, support: number): number {
  return (point.x - side.start.x) * side.inwardNormal.x + (point.y - side.start.y) * side.inwardNormal.y - support;
}

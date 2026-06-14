import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CompiledPrismSide } from "../cell-complex/prismCells";
import { rigidTransform3 } from "../math/rigidTransform3";
import { addVec3, type Vec3 } from "../math/vec3";
import {
  findBoundaryCrossing,
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
  const boundaryCrossing = findBoundaryCrossing(startCell, request.object, candidateObject);
  const crossingSide = boundaryCrossing?.side.portal
    ? boundaryCrossing.side
    : (request.portalCrossingMode ?? "bounds") === "anchor"
      ? findReachablePortalSide(startCell, candidateObject)
      : undefined;

  if (crossingSide?.portal && isPortalCrossingReachable(
    candidateObject,
    crossingSide,
    startCell.heightMeters,
  )) {
    if ((request.portalCrossingMode ?? "bounds") === "anchor" && !hasAnchorCrossedSide(candidateObject, crossingSide)) {
      const sourceCollision = testCellCollision({
        cell: startCell,
        object: candidateObject,
        previousObject: request.object,
        ignoredPortalSideIndex: crossingSide.sideIndex,
        ignoreForbiddenZones: request.ignoreForbiddenZones,
      });

      if (sourceCollision.blocked) {
        return blockedResult(request, sourceCollision.reason);
      }

      return {
        object: candidateObject,
        attemptedDisplacement: request.displacement,
        blocked: false,
        crossedPortal: false,
      };
    }

    const sourceCollision = testCellCollision({
      cell: startCell,
      object: candidateObject,
      previousObject: request.object,
      ignoredPortalSideIndex: crossingSide.sideIndex,
      ignoreForbiddenZones: request.ignoreForbiddenZones,
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
      object: crossedObject,
      ignoredPortalSideIndex: targetCell.portalsById.get(crossingSide.portal.targetPortalId)?.sideIndex,
      ignoreForbiddenZones: request.ignoreForbiddenZones,
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
    object: candidateObject,
    previousObject: request.object,
    ignoreForbiddenZones: request.ignoreForbiddenZones,
  });

  if (collision.blocked) {
    const resolvedObject =
      collision.reason === "wall"
        ? resolveBlockedWallPosition(
            candidateObject,
            boundaryCrossing?.side ?? startCell.sides.find((side) => side.sideIndex === collision.sideIndex),
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

function isPortalCrossingReachable(
  object: DynamicObjectState,
  side: CompiledPrismSide,
  heightMeters: number,
): boolean {
  const bounds = getDynamicObjectCollisionBounds(object);
  const point = bounds?.center ?? object.localPose.translation;
  const support = bounds ? getSideSupport(side, bounds) : 0;
  const sideProjection = projectPointAlongSide(side, point);

  return (
    sideProjection >= 0 &&
    sideProjection <= side.lengthMeters &&
    point.z - (bounds?.halfHeight ?? 0) >= 0 &&
    point.z + (bounds?.halfHeight ?? 0) <= heightMeters &&
    getSignedClearanceToSide(side, point, support) < 0
  );
}

function hasAnchorCrossedSide(object: DynamicObjectState, side: CompiledPrismSide): boolean {
  return signedDistanceToSide(side, object.localPose.translation) < 0;
}

function findReachablePortalSide(
  cell: { readonly sides: readonly CompiledPrismSide[]; readonly heightMeters: number },
  object: DynamicObjectState,
): CompiledPrismSide | undefined {
  let bestSide: CompiledPrismSide | undefined;
  let bestClearance = 0;

  for (const side of cell.sides) {
    if (!side.portal || !isPortalCrossingReachable(object, side, cell.heightMeters)) {
      continue;
    }

    const clearance = signedDistanceToSide(side, object.localPose.translation);

    if (!bestSide || clearance < bestClearance) {
      bestSide = side;
      bestClearance = clearance;
    }
  }

  return bestSide;
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

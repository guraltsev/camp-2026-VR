import type { CompiledPrismCell, CompiledPrismSide } from "../cell-complex/prismCells";
import type { SingularityCollisionCylinder } from "../cell-complex/forbiddenZones";
import { transformDirection3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";
import type { DynamicObjectState, SimpleCollisionCylinder } from "./dynamicObject";

export type BlockingReason = "wall" | "floor" | "ceiling" | "forbidden-zone";

export interface CollisionResult {
  readonly blocked: boolean;
  readonly reason?: BlockingReason;
  readonly sideIndex?: number;
}

export interface CollisionCandidate {
  readonly cell: CompiledPrismCell;
  readonly object: DynamicObjectState;
  readonly previousObject?: DynamicObjectState;
  readonly ignoredPortalSideIndex?: number;
}

export interface SimpleCylinderBounds {
  readonly center: Vec3;
  readonly radius: number;
  readonly halfHeight: number;
}

export interface BoundaryCrossing {
  readonly side: CompiledPrismSide;
  readonly startClearance: number;
  readonly endClearance: number;
  readonly endProjection: number;
}

const zeroOffset = { x: 0, y: 0, z: 0 };

export function testCellCollision(candidate: CollisionCandidate): CollisionResult {
  const bounds = getDynamicObjectCollisionBounds(candidate.object);

  if (!bounds) {
    return { blocked: false };
  }

  const { center, halfHeight } = bounds;

  if (center.z - halfHeight < 0) {
    return { blocked: true, reason: "floor" };
  }

  if (center.z + halfHeight > candidate.cell.heightMeters) {
    return { blocked: true, reason: "ceiling" };
  }

  for (const exclusionCylinder of candidate.cell.singularityColumns) {
    if (simpleCylinderIntersectsSingularityCylinder(bounds, exclusionCylinder)) {
      return { blocked: true, reason: "forbidden-zone" };
    }
  }

  const previousBounds = candidate.previousObject
    ? getDynamicObjectCollisionBounds(candidate.previousObject)
    : undefined;

  if (previousBounds) {
    for (const exclusionCylinder of candidate.cell.singularityColumns) {
      if (sweptCylinderIntersectsSingularityCylinder(previousBounds, bounds, exclusionCylinder)) {
        return { blocked: true, reason: "forbidden-zone" };
      }
    }
  }

  for (const side of candidate.cell.sides) {
    if (side.sideIndex === candidate.ignoredPortalSideIndex) {
      continue;
    }

    const distance = signedDistanceToSide(side, center);

    if (distance < bounds.radius) {
      return { blocked: true, reason: "wall", sideIndex: side.sideIndex };
    }
  }

  return { blocked: false };
}

export function getCollisionBounds(
  position: Vec3,
  collision?: SimpleCollisionCylinder,
): SimpleCylinderBounds | undefined {
  if (!collision) {
    return undefined;
  }

  const offset = collision.offset ?? zeroOffset;

  return {
    center: {
      x: position.x + offset.x,
      y: position.y + offset.y,
      z: position.z + offset.z,
    },
    radius: collision.radius,
    halfHeight: collision.height / 2,
  };
}

export function getDynamicObjectCollisionBounds(object: DynamicObjectState): SimpleCylinderBounds | undefined {
  const collision = object.collision;

  if (!collision) {
    return undefined;
  }

  const rotatedOffset = transformDirection3(
    object.localPose,
    collision.offset ?? zeroOffset,
  );

  return {
    center: {
      x: object.localPose.translation.x + rotatedOffset.x,
      y: object.localPose.translation.y + rotatedOffset.y,
      z: object.localPose.translation.z + rotatedOffset.z,
    },
    radius: collision.radius,
    halfHeight: collision.height / 2,
  };
}

export function simpleCylinderIntersectsSimpleCylinder(
  a: SimpleCylinderBounds,
  b: SimpleCylinderBounds,
): boolean {
  const radius = a.radius + b.radius;

  return (
    horizontalDistanceSquared(a.center, b.center) < radius * radius &&
    Math.abs(a.center.z - b.center.z) < a.halfHeight + b.halfHeight
  );
}

function simpleCylinderIntersectsSingularityCylinder(
  cylinder: SimpleCylinderBounds,
  exclusionCylinder: SingularityCollisionCylinder,
): boolean {
  return simpleCylinderIntersectsSimpleCylinder(cylinder, {
    center: exclusionCylinder.center,
    radius: exclusionCylinder.radius,
    halfHeight: exclusionCylinder.height / 2,
  });
}

function sweptCylinderIntersectsSingularityCylinder(
  start: SimpleCylinderBounds,
  end: SimpleCylinderBounds,
  exclusionCylinder: SingularityCollisionCylinder,
): boolean {
  const combinedRadius = Math.max(start.radius, end.radius) + exclusionCylinder.radius;
  const sweptMinZ = Math.min(start.center.z - start.halfHeight, end.center.z - end.halfHeight);
  const sweptMaxZ = Math.max(start.center.z + start.halfHeight, end.center.z + end.halfHeight);
  const exclusionHalfHeight = exclusionCylinder.height / 2;
  const exclusionMinZ = exclusionCylinder.center.z - exclusionHalfHeight;
  const exclusionMaxZ = exclusionCylinder.center.z + exclusionHalfHeight;

  return (
    sweptMinZ < exclusionMaxZ &&
    sweptMaxZ > exclusionMinZ &&
    distanceSquaredPointToSegment2(
      exclusionCylinder.center.x,
      exclusionCylinder.center.y,
      start.center.x,
      start.center.y,
      end.center.x,
      end.center.y,
    ) < combinedRadius * combinedRadius
  );
}

export function signedDistanceToSide(side: CompiledPrismSide, point: Vec3): number {
  return (point.x - side.start.x) * side.inwardNormal.x + (point.y - side.start.y) * side.inwardNormal.y;
}

export function getSideSupport(_side: CompiledPrismSide, bounds: SimpleCylinderBounds): number {
  return bounds.radius;
}

export function projectPointAlongSide(side: CompiledPrismSide, point: Vec3): number {
  const edgeX = side.end.x - side.start.x;
  const edgeY = side.end.y - side.start.y;

  return ((point.x - side.start.x) * edgeX + (point.y - side.start.y) * edgeY) / side.lengthMeters;
}

export function findBoundaryCrossing(
  cell: CompiledPrismCell,
  startObject: DynamicObjectState,
  endObject: DynamicObjectState,
): BoundaryCrossing | undefined {
  const startBounds = getDynamicObjectCollisionBounds(startObject);
  const endBounds = getDynamicObjectCollisionBounds(endObject);
  const startPoint = startBounds?.center ?? startObject.localPose.translation;
  const endPoint = endBounds?.center ?? endObject.localPose.translation;

  let crossing: BoundaryCrossing | undefined;

  for (const side of cell.sides) {
    const startSupport = startBounds ? getSideSupport(side, startBounds) : 0;
    const endSupport = endBounds ? getSideSupport(side, endBounds) : 0;
    const startClearance = signedDistanceToSide(side, startPoint) - startSupport;
    const endClearance = signedDistanceToSide(side, endPoint) - endSupport;

    if (startClearance >= 0 && endClearance < 0) {
      if (!crossing || endClearance < crossing.endClearance) {
        crossing = {
          side,
          startClearance,
          endClearance,
          endProjection: projectPointAlongSide(side, endPoint),
        };
      }
    }
  }

  return crossing;
}

function horizontalDistanceSquared(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
}

function distanceSquaredPointToSegment2(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    const dx = pointX - startX;
    const dy = pointY - startY;

    return dx * dx + dy * dy;
  }

  const t = Math.max(
    0,
    Math.min(1, ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared),
  );
  const closestX = startX + segmentX * t;
  const closestY = startY + segmentY * t;
  const dx = pointX - closestX;
  const dy = pointY - closestY;

  return dx * dx + dy * dy;
}

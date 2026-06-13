import type { CompiledPrismCell, CompiledPrismSide } from "../cell-complex/prismCells";
import type { SingularityCollisionBox } from "../cell-complex/forbiddenZones";
import { transformDirection3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";
import type { DynamicObjectState, SimpleCollisionBox } from "./dynamicObject";

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

export interface SimpleBoxBounds {
  readonly center: Vec3;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
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

  const { center, halfZ } = bounds;

  if (center.z - halfZ < 0) {
    return { blocked: true, reason: "floor" };
  }

  if (center.z + halfZ > candidate.cell.heightMeters) {
    return { blocked: true, reason: "ceiling" };
  }

  for (const exclusionBox of candidate.cell.singularityColumns) {
    if (simpleBoxIntersectsSingularityBox(bounds, exclusionBox)) {
      return { blocked: true, reason: "forbidden-zone" };
    }
  }

  const previousBounds = candidate.previousObject
    ? getDynamicObjectCollisionBounds(candidate.previousObject)
    : undefined;

  if (previousBounds) {
    for (const exclusionBox of candidate.cell.singularityColumns) {
      if (simpleBoxIntersectsSingularityBox(getSweptSimpleBoxBounds(previousBounds, bounds), exclusionBox)) {
        return { blocked: true, reason: "forbidden-zone" };
      }
    }
  }

  for (const side of candidate.cell.sides) {
    if (side.sideIndex === candidate.ignoredPortalSideIndex) {
      continue;
    }

    const distance = signedDistanceToSide(side, center);
    const support = getSideSupport(side, bounds);

    if (distance < support) {
      return { blocked: true, reason: "wall", sideIndex: side.sideIndex };
    }
  }

  return { blocked: false };
}

export function getCollisionBounds(
  position: Vec3,
  collision?: SimpleCollisionBox,
): SimpleBoxBounds | undefined {
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
    halfX: collision.dx / 2,
    halfY: collision.dy / 2,
    halfZ: collision.dz / 2,
  };
}

export function getDynamicObjectCollisionBounds(object: DynamicObjectState): SimpleBoxBounds | undefined {
  const collision = object.collision;

  if (!collision) {
    return undefined;
  }

  const rotation = object.localPose.rotation;
  const rotatedOffset = transformDirection3(
    object.localPose,
    collision.offset ?? zeroOffset,
  );
  const center = {
    x: object.localPose.translation.x + rotatedOffset.x,
    y: object.localPose.translation.y + rotatedOffset.y,
    z: object.localPose.translation.z + rotatedOffset.z,
  };
  const halfDx = collision.dx / 2;
  const halfDy = collision.dy / 2;
  const halfDz = collision.dz / 2;

  return {
    center,
    halfX: Math.abs(rotation.m00) * halfDx + Math.abs(rotation.m01) * halfDy + Math.abs(rotation.m02) * halfDz,
    halfY: Math.abs(rotation.m10) * halfDx + Math.abs(rotation.m11) * halfDy + Math.abs(rotation.m12) * halfDz,
    halfZ: Math.abs(rotation.m20) * halfDx + Math.abs(rotation.m21) * halfDy + Math.abs(rotation.m22) * halfDz,
  };
}

export function simpleBoxIntersectsSimpleBox(a: SimpleBoxBounds, b: SimpleBoxBounds): boolean {
  return (
    Math.abs(a.center.x - b.center.x) < a.halfX + b.halfX &&
    Math.abs(a.center.y - b.center.y) < a.halfY + b.halfY &&
    Math.abs(a.center.z - b.center.z) < a.halfZ + b.halfZ
  );
}

function simpleBoxIntersectsSingularityBox(
  box: SimpleBoxBounds,
  exclusionBox: SingularityCollisionBox,
): boolean {
  return simpleBoxIntersectsSimpleBox(box, {
    center: exclusionBox.center,
    halfX: exclusionBox.halfX,
    halfY: exclusionBox.halfY,
    halfZ: exclusionBox.halfZ,
  });
}

function getSweptSimpleBoxBounds(start: SimpleBoxBounds, end: SimpleBoxBounds): SimpleBoxBounds {
  const minX = Math.min(start.center.x - start.halfX, end.center.x - end.halfX);
  const maxX = Math.max(start.center.x + start.halfX, end.center.x + end.halfX);
  const minY = Math.min(start.center.y - start.halfY, end.center.y - end.halfY);
  const maxY = Math.max(start.center.y + start.halfY, end.center.y + end.halfY);
  const minZ = Math.min(start.center.z - start.halfZ, end.center.z - end.halfZ);
  const maxZ = Math.max(start.center.z + start.halfZ, end.center.z + end.halfZ);

  return {
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
    halfX: (maxX - minX) / 2,
    halfY: (maxY - minY) / 2,
    halfZ: (maxZ - minZ) / 2,
  };
}

export function signedDistanceToSide(side: CompiledPrismSide, point: Vec3): number {
  return (point.x - side.start.x) * side.inwardNormal.x + (point.y - side.start.y) * side.inwardNormal.y;
}

export function getSideSupport(side: CompiledPrismSide, bounds: SimpleBoxBounds): number {
  return Math.abs(side.inwardNormal.x) * bounds.halfX + Math.abs(side.inwardNormal.y) * bounds.halfY;
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

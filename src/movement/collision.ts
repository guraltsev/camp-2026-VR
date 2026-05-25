import type { CompiledPrismCell, CompiledPrismSide } from "../cell-complex/prismCells";
import type { SingularityCollisionColumn } from "../cell-complex/forbiddenZones";
import type { Vec3 } from "../math/vec3";
import type { SimpleCollisionBox } from "./dynamicObject";

export type BlockingReason = "wall" | "floor" | "ceiling" | "forbidden-zone";

export interface CollisionResult {
  readonly blocked: boolean;
  readonly reason?: BlockingReason;
  readonly sideIndex?: number;
}

export interface CollisionCandidate {
  readonly cell: CompiledPrismCell;
  readonly position: Vec3;
  readonly collision?: SimpleCollisionBox;
  readonly ignoredPortalSideIndex?: number;
}

const zeroOffset = { x: 0, y: 0, z: 0 };

export function testCellCollision(candidate: CollisionCandidate): CollisionResult {
  const box = candidate.collision;

  if (!box) {
    return { blocked: false };
  }

  const offset = box.offset ?? zeroOffset;
  const center = {
    x: candidate.position.x + offset.x,
    y: candidate.position.y + offset.y,
    z: candidate.position.z + offset.z,
  };
  const halfX = box.dx / 2;
  const halfY = box.dy / 2;
  const halfZ = box.dz / 2;
  const bounds = { center, halfX, halfY, halfZ };

  if (center.y - halfY < 0) {
    return { blocked: true, reason: "floor" };
  }

  if (center.y + halfY > candidate.cell.heightMeters) {
    return { blocked: true, reason: "ceiling" };
  }

  for (const column of candidate.cell.singularityColumns) {
    if (simpleBoxIntersectsSingularityColumn(bounds, column)) {
      return { blocked: true, reason: "forbidden-zone" };
    }
  }

  for (const side of candidate.cell.sides) {
    if (side.sideIndex === candidate.ignoredPortalSideIndex) {
      continue;
    }

    const distance = signedDistanceToSide(side, center);
    const support = Math.abs(side.inwardNormal.x) * halfX + Math.abs(side.inwardNormal.z) * halfZ;

    if (distance < support) {
      return { blocked: true, reason: "wall", sideIndex: side.sideIndex };
    }
  }

  return { blocked: false };
}

interface SimpleBoxBounds {
  readonly center: Vec3;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
}

function simpleBoxIntersectsSingularityColumn(
  box: SimpleBoxBounds,
  column: SingularityCollisionColumn,
): boolean {
  const columnHalfHeight = column.heightMeters / 2;
  const boxMinY = box.center.y - box.halfY;
  const boxMaxY = box.center.y + box.halfY;
  const columnMinY = column.center.y - columnHalfHeight;
  const columnMaxY = column.center.y + columnHalfHeight;

  if (boxMaxY <= columnMinY || boxMinY >= columnMaxY) {
    return false;
  }

  const closestX = clamp(column.center.x, box.center.x - box.halfX, box.center.x + box.halfX);
  const closestZ = clamp(column.center.z, box.center.z - box.halfZ, box.center.z + box.halfZ);
  const dx = column.center.x - closestX;
  const dz = column.center.z - closestZ;

  return dx * dx + dz * dz < column.radiusMeters * column.radiusMeters;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function signedDistanceToSide(side: CompiledPrismSide, point: Vec3): number {
  return (point.x - side.start.x) * side.inwardNormal.x + (point.z - side.start.z) * side.inwardNormal.z;
}

export function projectPointAlongSide(side: CompiledPrismSide, point: Vec3): number {
  const edgeX = side.end.x - side.start.x;
  const edgeZ = side.end.z - side.start.z;

  return ((point.x - side.start.x) * edgeX + (point.z - side.start.z) * edgeZ) / side.lengthMeters;
}

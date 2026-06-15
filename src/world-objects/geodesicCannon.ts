import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import { getDynamicObjectCollisionBounds, simpleCylinderIntersectsSimpleCylinder, testCellCollision } from "../movement/collision";
import type { SimpleCollisionCylinder } from "../movement/dynamicObject";
import { transformDirection3, transformPoint3, yawRigidTransform3, type RigidTransform3 } from "../math/rigidTransform3";
import { addVec3, normalizeVec3, scaleVec3, type Vec3 } from "../math/vec3";
import type { RuntimeObjectRegistry, RuntimeWorldObjectBase } from "./runtimeObjectRegistry";
import { runtimeObjectToDynamicObjectState } from "./runtimeObjectRegistry";

export interface GeodesicCannonObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-cannon";
  readonly activeGeodesicId?: string;
  readonly geodesicIds: readonly string[];
  readonly geodesicEmitterYawRadiansById?: Readonly<Record<string, number>>;
  readonly aimYawRadians: number;
}

export interface GeodesicSegmentObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-segment";
  readonly geodesicId: string;
  readonly geodesicNumber?: number;
  readonly segmentIndex: number;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly lengthMeters: number;
  readonly terminal: GeodesicSegmentTerminal;
}

export interface GeodesicIntersectionObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-intersection";
  readonly geodesicIds: readonly [string, string];
  readonly segmentIds: readonly [string, string];
}

export type GeodesicSegmentTerminal =
  | { readonly kind: "open" }
  | {
      readonly kind: "portal-hit";
      readonly portalId: string;
      readonly targetCellId: string;
      readonly targetPortalId: string;
      readonly targetStart: Vec3;
      readonly targetDirection: Vec3;
    }
  | { readonly kind: "wall-hit"; readonly sideIndex: number }
  | { readonly kind: "forbidden-zone-hit"; readonly junctionId: string };

export interface CreateGeodesicCannonOptions {
  readonly id: string;
  readonly cellId: string;
  readonly localPose: RigidTransform3;
  readonly activeGeodesicId?: string;
  readonly geodesicIds?: readonly string[];
  readonly geodesicEmitterYawRadiansById?: Readonly<Record<string, number>>;
  readonly aimYawRadians?: number;
  readonly collision?: SimpleCollisionCylinder;
}

export interface TraceGeodesicSegmentInput {
  readonly world: CompiledCellComplex;
  readonly cellId: string;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly maxLengthMeters: number;
}

export interface TraceGeodesicSegmentResult {
  readonly cellId: string;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly lengthMeters: number;
  readonly terminal: GeodesicSegmentTerminal;
}

export interface ShootGeodesicInput {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cannon: GeodesicCannonObject;
  readonly geodesicId: string;
  readonly maxLengthMeters?: number;
}

export interface ExtendGeodesicInput {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly maxLengthMeters?: number;
}

export interface RebuildGeodesicToLengthInput {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cannon: GeodesicCannonObject;
  readonly geodesicId: string;
  readonly totalLengthMeters: number;
}

export interface PlaceGeodesicCannonAtFloorPointRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cellId: string;
  readonly floorPoint: Vec3;
  readonly aimYawRadians: number;
  readonly id: string;
}

export interface PlaceGeodesicCannonResult {
  readonly placed: boolean;
  readonly object?: GeodesicCannonObject;
  readonly reason?: "missing-cell" | "cell-collision" | "runtime-object-collision";
}

const defaultCannonCollision: SimpleCollisionCylinder = {
  radius: 0.3,
  height: 1.25,
  offset: { x: 0, y: 0, z: 0.625 },
};
export const geodesicRayBeamHeightMeters = 1.08;
export const geodesicRayBeamStartOffsetMeters = 0.2;
const defaultTraceLengthMeters = 2;
const portalStartEpsilonMeters = 1e-4;
const intersectionTolerance = 1e-7;
const geodesicIntersectionEmitterExclusionRadiusMeters = 0.55;
const geodesicIntersectionBalloonHeightOffsetMeters = 0.25;

export function createGeodesicCannonObject(options: CreateGeodesicCannonOptions): GeodesicCannonObject {
  const aimYawRadians = sanitizeYaw(options.aimYawRadians ?? yawFromPose(options.localPose));

  return {
    id: options.id,
    kind: "geodesic-cannon",
    cellId: options.cellId,
    localPose: {
      ...options.localPose,
      rotation: yawRigidTransform3(aimYawRadians).rotation,
    },
    collision: options.collision ?? defaultCannonCollision,
    portalRenderable: true,
    tooltip: {
      label: "Geodesic emitter",
      rangeMeters: 2.5,
      desktopPrompt: "Geodesic emitter\nRMouse / F - menu",
      xrPrompt: "Geodesic emitter\nA / X - menu",
    },
    activeGeodesicId: options.activeGeodesicId,
    geodesicIds: options.geodesicIds ?? (options.activeGeodesicId ? [options.activeGeodesicId] : []),
    geodesicEmitterYawRadiansById: options.geodesicEmitterYawRadiansById,
    aimYawRadians,
  };
}

export function placeGeodesicCannonAtFloorPoint(
  request: PlaceGeodesicCannonAtFloorPointRequest,
): PlaceGeodesicCannonResult {
  const cell = request.world.cellsById.get(request.cellId);
  if (!cell) {
    return { placed: false, reason: "missing-cell" };
  }

  const candidate = createGeodesicCannonObject({
    id: request.id,
    cellId: request.cellId,
    localPose: yawRigidTransform3(request.aimYawRadians, {
      x: request.floorPoint.x,
      y: request.floorPoint.y,
      z: 0,
    }),
    aimYawRadians: request.aimYawRadians,
  });
  const candidateState = runtimeObjectToDynamicObjectState(candidate);
  const collision = testCellCollision({ cell, object: candidateState });
  if (collision.blocked) {
    return { placed: false, reason: "cell-collision" };
  }

  const candidateBounds = getDynamicObjectCollisionBounds(candidateState);
  if (candidateBounds) {
    for (const object of request.registry.getCollidableObjectsInCell(request.cellId)) {
      const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
      if (bounds && simpleCylinderIntersectsSimpleCylinder(candidateBounds, bounds)) {
        return { placed: false, reason: "runtime-object-collision" };
      }
    }
  }

  request.registry.add(candidate);
  return { placed: true, object: candidate };
}

export function isGeodesicSegmentObject(object: { readonly kind: string }): object is GeodesicSegmentObject {
  return object.kind === "geodesic-segment";
}

export function isGeodesicIntersectionObject(object: { readonly kind: string }): object is GeodesicIntersectionObject {
  return object.kind === "geodesic-intersection";
}

export function isGeodesicCannonObject(object: { readonly kind: string }): object is GeodesicCannonObject {
  return object.kind === "geodesic-cannon";
}

export function getGeodesicSegments(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): readonly GeodesicSegmentObject[] {
  return registry.getAll()
    .filter((object): object is GeodesicSegmentObject => object.kind === "geodesic-segment")
    .filter((segment) => segment.geodesicId === geodesicId)
    .sort((a, b) => a.segmentIndex - b.segmentIndex);
}

export function getGeodesicTail(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): GeodesicSegmentObject | undefined {
  return getGeodesicSegments(registry, geodesicId).at(-1);
}

export function removeGeodesic(registry: RuntimeObjectRegistry, geodesicId: string): void {
  for (const segment of getGeodesicSegments(registry, geodesicId)) {
    registry.remove(segment.id);
  }
  updateGeodesicIntersectionObjects(registry);
}

export function removeGeodesicCannonAndSegments(registry: RuntimeObjectRegistry, cannonId: string): void {
  const cannon = registry.get(cannonId);
  if (cannon?.kind === "geodesic-cannon") {
    const geodesicIds = new Set(cannon.geodesicIds);
    if (cannon.activeGeodesicId) {
      geodesicIds.add(cannon.activeGeodesicId);
    }
    for (const geodesicId of geodesicIds) {
      removeGeodesic(registry, geodesicId);
    }
  }
  registry.remove(cannonId);
  updateGeodesicIntersectionObjects(registry);
}

export function getGeodesicSegmentEnd(segment: GeodesicSegmentObject): Vec3 {
  return addVec3(segment.start, scaleVec3(segment.direction, segment.lengthMeters));
}

export function canExtendGeodesicSegment(segment: GeodesicSegmentObject): boolean {
  return segment.terminal.kind !== "wall-hit" && segment.terminal.kind !== "forbidden-zone-hit";
}

export function resolveGeodesicCannonAimYawRadians(
  cannon: GeodesicCannonObject,
  targetLocalPoint: Vec3,
): number | undefined {
  const dx = targetLocalPoint.x - cannon.localPose.translation.x;
  const dy = targetLocalPoint.y - cannon.localPose.translation.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) <= intersectionTolerance) {
    return undefined;
  }

  return sanitizeYaw(Math.atan2(dy, dx));
}

export function traceGeodesicSegment(input: TraceGeodesicSegmentInput): TraceGeodesicSegmentResult {
  const cell = input.world.cellsById.get(input.cellId);
  if (!cell) {
    throw new Error(`Cannot trace geodesic segment in missing cell "${input.cellId}".`);
  }
  if (!(input.maxLengthMeters > 0) || !Number.isFinite(input.maxLengthMeters)) {
    throw new Error(`Geodesic trace length must be positive; received ${input.maxLengthMeters}.`);
  }

  const direction = normalizeHorizontalDirection(input.direction);
  let nearest:
    | { readonly kind: "side"; readonly sideIndex: number; readonly t: number; readonly portal?: NonNullable<typeof cell.sides[number]["portal"]> }
    | { readonly kind: "forbidden-zone"; readonly junctionId: string; readonly t: number }
    | undefined;

  for (const side of cell.sides) {
    const edgeX = side.end.x - side.start.x;
    const edgeY = side.end.y - side.start.y;
    const denominator = cross2(direction.x, direction.y, edgeX, edgeY);
    if (Math.abs(denominator) <= intersectionTolerance) {
      continue;
    }

    const startToSideX = side.start.x - input.start.x;
    const startToSideY = side.start.y - input.start.y;
    const t = cross2(startToSideX, startToSideY, edgeX, edgeY) / denominator;
    const sideU = cross2(startToSideX, startToSideY, direction.x, direction.y) / denominator;
    const sideMeters = sideU * side.lengthMeters;

    if (
      t <= intersectionTolerance ||
      t > input.maxLengthMeters + intersectionTolerance ||
      sideMeters < -intersectionTolerance ||
      sideMeters > side.lengthMeters + intersectionTolerance
    ) {
      continue;
    }

    if (!nearest || t < nearest.t) {
      nearest = { kind: "side", sideIndex: side.sideIndex, t: Math.min(t, input.maxLengthMeters), portal: side.portal };
    }
  }

  for (const zone of cell.forbiddenZones) {
    const t = intersectRayWithForbiddenZone(input.start, direction, zone.collision);
    if (t === undefined || t > input.maxLengthMeters + intersectionTolerance) {
      continue;
    }

    if (!nearest || t < nearest.t) {
      nearest = { kind: "forbidden-zone", junctionId: zone.junctionId, t: Math.min(t, input.maxLengthMeters) };
    }
  }

  if (!nearest) {
    return {
      cellId: input.cellId,
      start: input.start,
      direction,
      lengthMeters: input.maxLengthMeters,
      terminal: { kind: "open" },
    };
  }

  if (nearest.kind === "forbidden-zone") {
    return {
      cellId: input.cellId,
      start: input.start,
      direction,
      lengthMeters: nearest.t,
      terminal: { kind: "forbidden-zone-hit", junctionId: nearest.junctionId },
    };
  }

  if (!nearest.portal) {
    return {
      cellId: input.cellId,
      start: input.start,
      direction,
      lengthMeters: nearest.t,
      terminal: { kind: "wall-hit", sideIndex: nearest.sideIndex },
    };
  }

  const hitPoint = addVec3(input.start, scaleVec3(direction, nearest.t));
  const targetDirection = normalizeHorizontalDirection(transformDirection3(nearest.portal.transformToTarget, direction));
  const transformedStart = transformPoint3(nearest.portal.transformToTarget, hitPoint);
  const targetStart = addVec3(transformedStart, scaleVec3(targetDirection, portalStartEpsilonMeters));

  return {
    cellId: input.cellId,
    start: input.start,
    direction,
    lengthMeters: nearest.t,
    terminal: {
      kind: "portal-hit",
      portalId: nearest.portal.id,
      targetCellId: nearest.portal.targetCellId,
      targetPortalId: nearest.portal.targetPortalId,
      targetStart,
      targetDirection,
    },
  };
}

export function shootGeodesic(input: ShootGeodesicInput): GeodesicSegmentObject {
  const direction = directionFromYaw(input.cannon.aimYawRadians);
  const geodesicNumber = getGeodesicNumber(input.cannon.geodesicIds, input.geodesicId);
  const start = addVec3(
    {
      x: input.cannon.localPose.translation.x,
      y: input.cannon.localPose.translation.y,
      z: geodesicRayBeamHeightMeters,
    },
    scaleVec3(direction, geodesicRayBeamStartOffsetMeters),
  );
  const segment = createSegmentFromTrace({
    id: `${input.geodesicId}:segment:0`,
    geodesicId: input.geodesicId,
    geodesicNumber,
    segmentIndex: 0,
    trace: traceGeodesicSegment({
      world: input.world,
      cellId: input.cannon.cellId,
      start,
      direction,
      maxLengthMeters: input.maxLengthMeters ?? defaultTraceLengthMeters,
    }),
  });

  input.registry.add(segment);
  input.registry.update({
    ...input.cannon,
    activeGeodesicId: input.geodesicId,
    geodesicIds: input.cannon.geodesicIds.includes(input.geodesicId)
      ? input.cannon.geodesicIds
      : [...input.cannon.geodesicIds, input.geodesicId],
    geodesicEmitterYawRadiansById: {
      ...input.cannon.geodesicEmitterYawRadiansById,
      [input.geodesicId]: input.cannon.aimYawRadians,
    },
  });
  updateGeodesicIntersectionObjects(input.registry);
  return segment;
}

export function extendGeodesic(input: ExtendGeodesicInput): GeodesicSegmentObject | undefined {
  const tail = getGeodesicTail(input.registry, input.geodesicId);
  if (!tail || !canExtendGeodesicSegment(tail)) {
    return undefined;
  }

  const trace = tail.terminal.kind === "portal-hit"
    ? traceGeodesicSegment({
        world: input.world,
        cellId: tail.terminal.targetCellId,
        start: tail.terminal.targetStart,
        direction: tail.terminal.targetDirection,
        maxLengthMeters: input.maxLengthMeters ?? defaultTraceLengthMeters,
      })
    : traceGeodesicSegment({
        world: input.world,
        cellId: tail.cellId,
        start: getGeodesicSegmentEnd(tail),
        direction: tail.direction,
        maxLengthMeters: input.maxLengthMeters ?? defaultTraceLengthMeters,
      });

  const next = createSegmentFromTrace({
    id: `${input.geodesicId}:segment:${tail.segmentIndex + 1}`,
    geodesicId: input.geodesicId,
    geodesicNumber: tail.geodesicNumber,
    segmentIndex: tail.segmentIndex + 1,
    trace,
  });
  input.registry.add(next);
  updateGeodesicIntersectionObjects(input.registry);
  return next;
}

export function rebuildGeodesicToLength(input: RebuildGeodesicToLengthInput): readonly GeodesicSegmentObject[] {
  if (!(input.totalLengthMeters > 0) || !Number.isFinite(input.totalLengthMeters)) {
    removeGeodesic(input.registry, input.geodesicId);
    return [];
  }

  removeGeodesic(input.registry, input.geodesicId);
  const segments: GeodesicSegmentObject[] = [];
  let remainingLengthMeters = input.totalLengthMeters;
  const first = shootGeodesic({
    world: input.world,
    registry: input.registry,
    cannon: input.cannon,
    geodesicId: input.geodesicId,
    maxLengthMeters: remainingLengthMeters,
  });
  segments.push(first);
  remainingLengthMeters -= first.lengthMeters;

  while (remainingLengthMeters > intersectionTolerance && canExtendGeodesicSegment(segments[segments.length - 1])) {
    const next = extendGeodesic({
      world: input.world,
      registry: input.registry,
      geodesicId: input.geodesicId,
      maxLengthMeters: remainingLengthMeters,
    });
    if (!next) {
      break;
    }

    segments.push(next);
    remainingLengthMeters -= next.lengthMeters;
  }

  updateGeodesicIntersectionObjects(input.registry);
  return segments;
}

export function updateGeodesicIntersectionObjects(registry: RuntimeObjectRegistry): readonly GeodesicIntersectionObject[] {
  for (const object of registry.getAll()) {
    if (object.kind === "geodesic-intersection") {
      registry.remove(object.id);
    }
  }

  const intersections = findGeodesicIntersections(registry);
  for (const intersection of intersections) {
    registry.add(intersection);
  }

  return intersections;
}

function createSegmentFromTrace(options: {
  readonly id: string;
  readonly geodesicId: string;
  readonly geodesicNumber?: number;
  readonly segmentIndex: number;
  readonly trace: TraceGeodesicSegmentResult;
}): GeodesicSegmentObject {
  const yaw = Math.atan2(options.trace.direction.y, options.trace.direction.x);
  const geodesicLabel = options.geodesicNumber === undefined ? undefined : `G${options.geodesicNumber}`;

  return {
    id: options.id,
    kind: "geodesic-segment",
    cellId: options.trace.cellId,
    localPose: yawRigidTransform3(yaw, options.trace.start),
    portalRenderable: true,
    tooltip: {
      label: geodesicLabel ? `Geodesic ${geodesicLabel}` : "Geodesic",
      rangeMeters: 6,
    },
    geodesicId: options.geodesicId,
    geodesicNumber: options.geodesicNumber,
    segmentIndex: options.segmentIndex,
    start: options.trace.start,
    direction: options.trace.direction,
    lengthMeters: options.trace.lengthMeters,
    terminal: options.trace.terminal,
  };
}

function findGeodesicIntersections(registry: RuntimeObjectRegistry): readonly GeodesicIntersectionObject[] {
  const segments = registry.getAll().filter(isGeodesicSegmentObject);
  const intersections: GeodesicIntersectionObject[] = [];
  const seenKeys = new Set<string>();

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      if (left.geodesicId === right.geodesicId || left.cellId !== right.cellId) {
        continue;
      }

      const intersection = intersectHorizontalSegments(left, right);
      if (!intersection || pointIsInsideEmitterExclusion(registry, left.cellId, intersection.point)) {
        continue;
      }

      const pointKey = `${left.cellId}:${intersection.point.x.toFixed(5)}:${intersection.point.y.toFixed(5)}`;
      const sortedGeodesicIds = [left.geodesicId, right.geodesicId].sort();
      const geodesicIds: [string, string] = [sortedGeodesicIds[0], sortedGeodesicIds[1]];
      const key = `${pointKey}:${geodesicIds.join(":")}`;
      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      intersections.push(createGeodesicIntersectionObject({
        id: `geodesic-intersection:${sanitizeIdPart(key)}`,
        cellId: left.cellId,
        balloonPoint: {
          x: intersection.point.x,
          y: intersection.point.y,
          z: geodesicRayBeamHeightMeters + geodesicIntersectionBalloonHeightOffsetMeters,
        },
        targetPoint: intersection.point,
        geodesicIds: [geodesicIds[0], geodesicIds[1]],
        segmentIds: [left.id, right.id],
      }));
    }
  }

  return intersections;
}

function createGeodesicIntersectionObject(options: {
  readonly id: string;
  readonly cellId: string;
  readonly balloonPoint: Vec3;
  readonly targetPoint: Vec3;
  readonly geodesicIds: readonly [string, string];
  readonly segmentIds: readonly [string, string];
}): GeodesicIntersectionObject {
  return {
    id: options.id,
    kind: "geodesic-intersection",
    cellId: options.cellId,
    localPose: yawRigidTransform3(0, options.balloonPoint),
    aimStickyTarget: {
      localPoint: options.targetPoint,
    },
    portalRenderable: true,
    tooltip: {
      label: "vertex",
      rangeMeters: 3,
    },
    geodesicIds: options.geodesicIds,
    segmentIds: options.segmentIds,
  };
}

function intersectHorizontalSegments(
  left: GeodesicSegmentObject,
  right: GeodesicSegmentObject,
): { readonly point: Vec3 } | undefined {
  const leftEnd = getGeodesicSegmentEnd(left);
  const rightEnd = getGeodesicSegmentEnd(right);
  const rx = leftEnd.x - left.start.x;
  const ry = leftEnd.y - left.start.y;
  const sx = rightEnd.x - right.start.x;
  const sy = rightEnd.y - right.start.y;
  const denominator = cross2(rx, ry, sx, sy);

  if (Math.abs(denominator) <= intersectionTolerance) {
    return undefined;
  }

  const dx = right.start.x - left.start.x;
  const dy = right.start.y - left.start.y;
  const leftT = cross2(dx, dy, sx, sy) / denominator;
  const rightT = cross2(dx, dy, rx, ry) / denominator;

  if (
    leftT < -intersectionTolerance ||
    leftT > 1 + intersectionTolerance ||
    rightT < -intersectionTolerance ||
    rightT > 1 + intersectionTolerance
  ) {
    return undefined;
  }

  return {
    point: {
      x: left.start.x + rx * Math.min(1, Math.max(0, leftT)),
      y: left.start.y + ry * Math.min(1, Math.max(0, leftT)),
      z: geodesicRayBeamHeightMeters,
    },
  };
}

function pointIsInsideEmitterExclusion(registry: RuntimeObjectRegistry, cellId: string, point: Vec3): boolean {
  return registry.getObjectsInCell(cellId).some((object) => {
    if (object.kind !== "geodesic-cannon") {
      return false;
    }

    const dx = point.x - object.localPose.translation.x;
    const dy = point.y - object.localPose.translation.y;
    return Math.hypot(dx, dy) <= geodesicIntersectionEmitterExclusionRadiusMeters;
  });
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "_");
}

function getGeodesicNumber(geodesicIds: readonly string[], geodesicId: string): number {
  const existingIndex = geodesicIds.indexOf(geodesicId);
  return existingIndex >= 0 ? existingIndex + 1 : geodesicIds.length + 1;
}

function directionFromYaw(yawRadians: number): Vec3 {
  return normalizeHorizontalDirection({ x: Math.cos(yawRadians), y: Math.sin(yawRadians), z: 0 });
}

function normalizeHorizontalDirection(direction: Vec3): Vec3 {
  const normalized = normalizeVec3({ x: direction.x, y: direction.y, z: 0 });
  return { x: normalized.x, y: normalized.y, z: 0 };
}

function intersectRayWithForbiddenZone(
  start: Vec3,
  direction: Vec3,
  zone: { readonly center: Vec3; readonly radius: number; readonly height: number },
): number | undefined {
  const dz = Math.abs(start.z - zone.center.z);
  if (Number.isFinite(zone.height) && dz > zone.height / 2) {
    return undefined;
  }

  const offsetX = start.x - zone.center.x;
  const offsetY = start.y - zone.center.y;
  const b = 2 * (offsetX * direction.x + offsetY * direction.y);
  const c = offsetX * offsetX + offsetY * offsetY - zone.radius * zone.radius;

  if (c <= 0) {
    return undefined;
  }

  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return undefined;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const first = (-b - sqrtDiscriminant) / 2;
  const second = (-b + sqrtDiscriminant) / 2;
  const t = first > intersectionTolerance ? first : second > intersectionTolerance ? second : undefined;
  return t;
}

function yawFromPose(pose: RigidTransform3): number {
  return Math.atan2(pose.rotation.m10, pose.rotation.m00);
}

function sanitizeYaw(yawRadians: number): number {
  if (!Number.isFinite(yawRadians)) {
    return 0;
  }

  return Math.atan2(Math.sin(yawRadians), Math.cos(yawRadians));
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

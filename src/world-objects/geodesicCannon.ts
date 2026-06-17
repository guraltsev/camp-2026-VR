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
  readonly geodesicConnectionsById?: Readonly<Record<string, GeodesicEmitterConnection>>;
  readonly aimYawRadians: number;
}

export interface GeodesicEmitterConnection {
  readonly outgoingEmitterId: string;
  readonly incomingEmitterId?: string;
  readonly state: "open" | "connected";
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
  readonly connectionState?: "open" | "connected";
}

export interface GeodesicIntersectionObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-intersection";
  readonly geodesicIds: readonly [string, string];
  readonly segmentIds: readonly [string, string];
}

export type GeodesicSegmentTerminal =
  | { readonly kind: "open" }
  | { readonly kind: "emitter-hit"; readonly emitterId: string }
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
  readonly geodesicConnectionsById?: Readonly<Record<string, GeodesicEmitterConnection>>;
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

export interface TraceGeodesicSegmentWithEmittersInput extends TraceGeodesicSegmentInput {
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly sourceEmitterId: string;
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
  readonly connectEmitters?: boolean;
}

export interface ExtendGeodesicInput {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly maxLengthMeters?: number;
  readonly connectEmitters?: boolean;
}

export interface RebuildGeodesicToLengthInput {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cannon: GeodesicCannonObject;
  readonly geodesicId: string;
  readonly totalLengthMeters: number;
  readonly connectEmitters?: boolean;
  readonly snapToEmitter?: boolean;
}

export interface PlaceGeodesicCannonAtFloorPointRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cellId: string;
  readonly floorPoint: Vec3;
  readonly aimYawRadians: number;
  readonly id: string;
}

export interface PlaceGeodesicCannonOnGeodesicRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly segmentId: string;
  readonly distanceAlongSegmentMeters: number;
  readonly aimYawRadians: number;
  readonly id: string;
}

export interface ConnectGeodesicToEmitterRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly incomingEmitterId: string;
  readonly totalLengthMeters: number;
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
const vertexContinuityToleranceMeters = 10;
const emitterConnectionToleranceMeters = 0.3;
const geodesicIntersectionBalloonHeightOffsetMeters = 0.25;
const geodesicIntersectionMemoryByRegistry = new WeakMap<RuntimeObjectRegistry, Map<string, GeodesicIntersectionObject>>();

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
    geodesicConnectionsById: options.geodesicConnectionsById,
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

export function getGeodesicConnection(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): GeodesicEmitterConnection | undefined {
  for (const object of registry.getAll()) {
    if (object.kind !== "geodesic-cannon") {
      continue;
    }

    const connection = object.geodesicConnectionsById?.[geodesicId];
    if (connection) {
      return connection;
    }
  }

  const source = findSourceEmitterForGeodesic(registry, geodesicId);
  return source ? { outgoingEmitterId: source.id, state: "open" } : undefined;
}

export function isGeodesicLocked(registry: RuntimeObjectRegistry, geodesicId: string): boolean {
  if (getGeodesicConnection(registry, geodesicId)?.state === "connected") {
    return true;
  }

  return getGeodesicTail(registry, geodesicId)?.terminal.kind === "emitter-hit";
}

export function resolveGeodesicNumber(registry: RuntimeObjectRegistry, geodesicId: string): number {
  return getGlobalGeodesicNumbers(registry, geodesicId).get(geodesicId) ?? 1;
}

export function removeGeodesic(registry: RuntimeObjectRegistry, geodesicId: string): void {
  removeGeodesicSegments(registry, geodesicId);
  removeGeodesicAssociations(registry, geodesicId);
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
  for (const object of registry.getAll()) {
    if (
      object.kind === "geodesic-cannon" &&
      object.id !== cannonId &&
      object.geodesicIds.some((geodesicId) =>
        getGeodesicConnection(registry, geodesicId)?.incomingEmitterId === cannonId
      )
    ) {
      for (const geodesicId of object.geodesicIds) {
        if (getGeodesicConnection(registry, geodesicId)?.incomingEmitterId === cannonId) {
          removeGeodesic(registry, geodesicId);
        }
      }
    }
  }
  registry.remove(cannonId);
  updateGeodesicIntersectionObjects(registry);
}

export function getGeodesicSegmentEnd(segment: GeodesicSegmentObject): Vec3 {
  return addVec3(segment.start, scaleVec3(segment.direction, segment.lengthMeters));
}

export function canExtendGeodesicSegment(segment: GeodesicSegmentObject): boolean {
  return segment.terminal.kind !== "wall-hit" &&
    segment.terminal.kind !== "forbidden-zone-hit" &&
    segment.terminal.kind !== "emitter-hit";
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

export function traceGeodesicSegmentWithEmitters(
  input: TraceGeodesicSegmentWithEmittersInput,
): TraceGeodesicSegmentResult {
  const traced = traceGeodesicSegment(input);
  const hit = findNearestEmitterHitOnTrace({
    registry: input.registry,
    sourceEmitterId: input.sourceEmitterId,
    geodesicId: input.geodesicId,
    cellId: traced.cellId,
    start: traced.start,
    direction: traced.direction,
    maxLengthMeters: traced.lengthMeters,
  });

  if (!hit) {
    return traced;
  }

  return {
    ...traced,
    lengthMeters: hit.distanceMeters,
    terminal: { kind: "emitter-hit", emitterId: hit.emitter.id },
  };
}

export function findNearestEmitterHitOnTrace(input: {
  readonly registry: RuntimeObjectRegistry;
  readonly sourceEmitterId: string;
  readonly geodesicId?: string;
  readonly cellId: string;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly maxLengthMeters: number;
}): { readonly emitter: GeodesicCannonObject; readonly distanceMeters: number } | undefined {
  const direction = normalizeHorizontalDirection(input.direction);
  let nearest: { readonly emitter: GeodesicCannonObject; readonly distanceMeters: number } | undefined;

  for (const object of input.registry.getObjectsInCell(input.cellId)) {
    if (object.kind !== "geodesic-cannon") {
      continue;
    }
    const isSourceEmitter = object.id === input.sourceEmitterId;
    if (!isSourceEmitter && input.geodesicId && object.geodesicIds.includes(input.geodesicId)) {
      continue;
    }

    const offsetX = object.localPose.translation.x - input.start.x;
    const offsetY = object.localPose.translation.y - input.start.y;
    const projected = offsetX * direction.x + offsetY * direction.y;
    if (
      projected <= intersectionTolerance ||
      projected > input.maxLengthMeters + intersectionTolerance
    ) {
      continue;
    }

    const perpendicularX = offsetX - direction.x * projected;
    const perpendicularY = offsetY - direction.y * projected;
    if (Math.hypot(perpendicularX, perpendicularY) > emitterConnectionToleranceMeters) {
      continue;
    }

    if (!nearest || projected < nearest.distanceMeters) {
      nearest = { emitter: object, distanceMeters: Math.min(projected, input.maxLengthMeters) };
    }
  }

  return nearest;
}

function traceGeodesicSegmentForConnectionMode(
  input: TraceGeodesicSegmentWithEmittersInput & { readonly connectEmitters: boolean },
): TraceGeodesicSegmentResult {
  return input.connectEmitters
    ? traceGeodesicSegmentWithEmitters(input)
    : traceGeodesicSegment(input);
}

function traceGeodesicPathForConnectionMode(
  input: TraceGeodesicSegmentWithEmittersInput & { readonly connectEmitters: boolean },
): readonly TraceGeodesicSegmentResult[] {
  const traces: TraceGeodesicSegmentResult[] = [];
  let remainingLengthMeters = input.maxLengthMeters;
  let currentCellId = input.cellId;
  let currentStart = input.start;
  let currentDirection = input.direction;

  while (remainingLengthMeters > intersectionTolerance) {
    const trace = traceGeodesicSegmentForConnectionMode({
      ...input,
      cellId: currentCellId,
      start: currentStart,
      direction: currentDirection,
      maxLengthMeters: remainingLengthMeters,
    });
    traces.push(trace);
    remainingLengthMeters -= trace.lengthMeters;

    if (trace.terminal.kind !== "portal-hit" || remainingLengthMeters <= intersectionTolerance) {
      break;
    }

    currentCellId = trace.terminal.targetCellId;
    currentStart = trace.terminal.targetStart;
    currentDirection = trace.terminal.targetDirection;
  }

  return traces;
}

export function shootGeodesic(input: ShootGeodesicInput): GeodesicSegmentObject {
  const aimYawRadians = resolveEmitterYawForGeodesic(input.cannon, input.geodesicId);
  const direction = directionFromYaw(aimYawRadians);
  const geodesicNumber = resolveGeodesicNumber(input.registry, input.geodesicId);
  const start = addVec3(
    {
      x: input.cannon.localPose.translation.x,
      y: input.cannon.localPose.translation.y,
      z: geodesicRayBeamHeightMeters,
    },
    scaleVec3(direction, geodesicRayBeamStartOffsetMeters),
  );
  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: input.connectEmitters ?? true,
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceEmitterId: input.cannon.id,
    cellId: input.cannon.cellId,
    start,
    direction,
    maxLengthMeters: input.maxLengthMeters ?? defaultTraceLengthMeters,
  });
  const segment = createSegmentFromTrace({
    id: `${input.geodesicId}:segment:0`,
    geodesicId: input.geodesicId,
    geodesicNumber,
    segmentIndex: 0,
    trace: traces[0],
  });
  input.registry.add(segment);
  let tail = segment;
  for (const trace of traces.slice(1)) {
    tail = createSegmentFromTrace({
      id: `${input.geodesicId}:segment:${tail.segmentIndex + 1}`,
      geodesicId: input.geodesicId,
      geodesicNumber,
      segmentIndex: tail.segmentIndex + 1,
      trace,
    });
    input.registry.add(tail);
  }
  input.registry.update({
    ...input.cannon,
    activeGeodesicId: input.geodesicId,
    geodesicIds: input.cannon.geodesicIds.includes(input.geodesicId)
      ? input.cannon.geodesicIds
      : [...input.cannon.geodesicIds, input.geodesicId],
    geodesicEmitterYawRadiansById: {
      ...input.cannon.geodesicEmitterYawRadiansById,
      [input.geodesicId]: aimYawRadians,
    },
    geodesicConnectionsById: {
      ...input.cannon.geodesicConnectionsById,
      [input.geodesicId]: {
        outgoingEmitterId: input.cannon.id,
        state: tail.terminal.kind === "emitter-hit" ? "connected" : "open",
        incomingEmitterId: tail.terminal.kind === "emitter-hit" ? tail.terminal.emitterId : undefined,
      },
    },
  });
  if ((input.connectEmitters ?? true) && tail.terminal.kind === "emitter-hit") {
    markGeodesicConnected(input.registry, input.geodesicId, input.cannon.id, tail.terminal.emitterId);
  }
  updateGeodesicIntersectionObjects(input.registry);
  return segment;
}

export function extendGeodesic(input: ExtendGeodesicInput): GeodesicSegmentObject | undefined {
  const tail = getGeodesicTail(input.registry, input.geodesicId);
  if (!tail || !canExtendGeodesicSegment(tail) || isGeodesicLocked(input.registry, input.geodesicId)) {
    return undefined;
  }
  const sourceEmitterId = getGeodesicConnection(input.registry, input.geodesicId)?.outgoingEmitterId ??
    findSourceEmitterForGeodesic(input.registry, input.geodesicId)?.id;
  if (!sourceEmitterId) {
    return undefined;
  }

  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: input.connectEmitters ?? true,
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceEmitterId,
    cellId: tail.terminal.kind === "portal-hit" ? tail.terminal.targetCellId : tail.cellId,
    start: tail.terminal.kind === "portal-hit" ? tail.terminal.targetStart : getGeodesicSegmentEnd(tail),
    direction: tail.terminal.kind === "portal-hit" ? tail.terminal.targetDirection : tail.direction,
    maxLengthMeters: input.maxLengthMeters ?? defaultTraceLengthMeters,
  });

  const first = createSegmentFromTrace({
    id: `${input.geodesicId}:segment:${tail.segmentIndex + 1}`,
    geodesicId: input.geodesicId,
    geodesicNumber: tail.geodesicNumber,
    segmentIndex: tail.segmentIndex + 1,
    trace: traces[0],
  });

  let lastAffected: GeodesicSegmentObject;
  let remainingTraces = traces;
  if (canMergeGeodesicSegments(tail, first)) {
    const merged = {
      ...tail,
      lengthMeters: tail.lengthMeters + first.lengthMeters,
      terminal: first.terminal,
      connectionState: first.connectionState,
    };
    input.registry.update(merged);
    lastAffected = merged;
    remainingTraces = traces.slice(1);
  } else {
    input.registry.add(first);
    lastAffected = first;
    remainingTraces = traces.slice(1);
  }

  for (const trace of remainingTraces) {
    const next = createSegmentFromTrace({
      id: `${input.geodesicId}:segment:${lastAffected.segmentIndex + 1}`,
      geodesicId: input.geodesicId,
      geodesicNumber: tail.geodesicNumber,
      segmentIndex: lastAffected.segmentIndex + 1,
      trace,
    });
    input.registry.add(next);
    lastAffected = next;
  }

  if ((input.connectEmitters ?? true) && lastAffected.terminal.kind === "emitter-hit") {
    markGeodesicConnected(input.registry, input.geodesicId, sourceEmitterId, lastAffected.terminal.emitterId);
    const updated = input.registry.get(lastAffected.id);
    if (updated?.kind === "geodesic-segment") {
      lastAffected = updated;
    }
  }
  updateGeodesicIntersectionObjects(input.registry);
  return lastAffected;
}

export function rebuildGeodesicToLength(input: RebuildGeodesicToLengthInput): readonly GeodesicSegmentObject[] {
  if (isGeodesicLocked(input.registry, input.geodesicId)) {
    return getGeodesicSegments(input.registry, input.geodesicId);
  }

  return rebuildUnlockedGeodesicToLength(input);
}

function rebuildUnlockedGeodesicToLength(input: RebuildGeodesicToLengthInput): readonly GeodesicSegmentObject[] {
  if (!(input.totalLengthMeters > 0) || !Number.isFinite(input.totalLengthMeters)) {
    removeGeodesicSegments(input.registry, input.geodesicId);
    return [];
  }

  const yawAdjustedCannon = resolveCannonForGeodesic(input.cannon, input.geodesicId);
  const cannon = input.snapToEmitter
    ? resolveCannonSnappedToEmitter({ ...input, cannon: yawAdjustedCannon }) ?? yawAdjustedCannon
    : yawAdjustedCannon;

  if (cannon !== input.cannon) {
    input.registry.update(cannon);
  }

  removeGeodesicSegments(input.registry, input.geodesicId);
  shootGeodesic({
    world: input.world,
    registry: input.registry,
    cannon,
    geodesicId: input.geodesicId,
    maxLengthMeters: input.totalLengthMeters,
    connectEmitters: input.connectEmitters ?? true,
  });
  updateGeodesicIntersectionObjects(input.registry);
  return getGeodesicSegments(input.registry, input.geodesicId);
}

function resolveCannonSnappedToEmitter(input: RebuildGeodesicToLengthInput): GeodesicCannonObject | undefined {
  if (!(input.totalLengthMeters > 0) || !Number.isFinite(input.totalLengthMeters)) {
    return undefined;
  }

  const direction = directionFromYaw(input.cannon.aimYawRadians);
  const start = addVec3(
    {
      x: input.cannon.localPose.translation.x,
      y: input.cannon.localPose.translation.y,
      z: geodesicRayBeamHeightMeters,
    },
    scaleVec3(direction, geodesicRayBeamStartOffsetMeters),
  );
  const unconnectedTrace = traceGeodesicSegment({
    world: input.world,
    cellId: input.cannon.cellId,
    start,
    direction,
    maxLengthMeters: input.totalLengthMeters,
  });
  const hit = findNearestEmitterHitOnTrace({
    registry: input.registry,
    sourceEmitterId: input.cannon.id,
    geodesicId: input.geodesicId,
    cellId: unconnectedTrace.cellId,
    start: unconnectedTrace.start,
    direction: unconnectedTrace.direction,
    maxLengthMeters: unconnectedTrace.lengthMeters,
  });
  if (!hit) {
    return undefined;
  }

  const nextYaw = sanitizeYaw(Math.atan2(
    hit.emitter.localPose.translation.y - input.cannon.localPose.translation.y,
    hit.emitter.localPose.translation.x - input.cannon.localPose.translation.x,
  ));
  return {
    ...input.cannon,
    aimYawRadians: nextYaw,
    localPose: yawRigidTransform3(nextYaw, input.cannon.localPose.translation),
    activeGeodesicId: input.geodesicId,
    geodesicIds: input.cannon.geodesicIds.includes(input.geodesicId)
      ? input.cannon.geodesicIds
      : [...input.cannon.geodesicIds, input.geodesicId],
    geodesicEmitterYawRadiansById: {
      ...input.cannon.geodesicEmitterYawRadiansById,
      [input.geodesicId]: nextYaw,
    },
  };
}

function resolveEmitterYawForGeodesic(cannon: GeodesicCannonObject, geodesicId: string): number {
  return sanitizeYaw(cannon.geodesicEmitterYawRadiansById?.[geodesicId] ?? cannon.aimYawRadians);
}

function resolveCannonForGeodesic(cannon: GeodesicCannonObject, geodesicId: string): GeodesicCannonObject {
  const aimYawRadians = resolveEmitterYawForGeodesic(cannon, geodesicId);
  if (Math.abs(sanitizeYaw(cannon.aimYawRadians - aimYawRadians)) <= intersectionTolerance) {
    return cannon;
  }

  return {
    ...cannon,
    aimYawRadians,
    localPose: yawRigidTransform3(aimYawRadians, cannon.localPose.translation),
  };
}

export function connectGeodesicToEmitter(
  request: ConnectGeodesicToEmitterRequest,
): readonly GeodesicSegmentObject[] {
  const source = findSourceEmitterForGeodesic(request.registry, request.geodesicId);
  const incoming = request.registry.get(request.incomingEmitterId);
  if (!source || incoming?.kind !== "geodesic-cannon") {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }

  removeGeodesicSegments(request.registry, request.geodesicId);
  const rebuilt = rebuildUnlockedGeodesicToLength({
    world: request.world,
    registry: request.registry,
    cannon: source,
    geodesicId: request.geodesicId,
    totalLengthMeters: request.totalLengthMeters,
  });
  const tail = rebuilt.at(-1);
  if (!tail) {
    return rebuilt;
  }

  request.registry.update({
    ...tail,
    lengthMeters: Math.max(0, request.totalLengthMeters - rebuilt.slice(0, -1).reduce((total, segment) => total + segment.lengthMeters, 0)),
    terminal: { kind: "emitter-hit", emitterId: request.incomingEmitterId },
    connectionState: "connected",
  });
  markGeodesicConnected(request.registry, request.geodesicId, source.id, request.incomingEmitterId);
  updateGeodesicIntersectionObjects(request.registry);
  return getGeodesicSegments(request.registry, request.geodesicId);
}

export function placeGeodesicCannonOnGeodesic(
  request: PlaceGeodesicCannonOnGeodesicRequest,
): PlaceGeodesicCannonResult {
  const segment = request.registry.get(request.segmentId);
  if (segment?.kind !== "geodesic-segment" || segment.geodesicId !== request.geodesicId) {
    return { placed: false, reason: "missing-cell" };
  }

  const clampedDistance = Math.min(segment.lengthMeters, Math.max(0, request.distanceAlongSegmentMeters));
  const floorPoint = {
    x: segment.start.x + segment.direction.x * clampedDistance,
    y: segment.start.y + segment.direction.y * clampedDistance,
    z: 0,
  };
  const result = placeGeodesicCannonAtFloorPoint({
    world: request.world,
    registry: request.registry,
    cellId: segment.cellId,
    floorPoint,
    aimYawRadians: request.aimYawRadians,
    id: request.id,
  });
  if (!result.placed || !result.object) {
    return result;
  }

  const totalLengthMeters = getGeodesicSegments(request.registry, request.geodesicId)
    .filter((entry) => entry.segmentIndex < segment.segmentIndex)
    .reduce((total, entry) => total + entry.lengthMeters, 0) + clampedDistance;
  connectGeodesicToEmitter({
    world: request.world,
    registry: request.registry,
    geodesicId: request.geodesicId,
    incomingEmitterId: result.object.id,
    totalLengthMeters,
  });

  const placed = request.registry.get(result.object.id);
  return placed?.kind === "geodesic-cannon" ? { placed: true, object: placed } : result;
}

export function updateGeodesicIntersectionObjects(registry: RuntimeObjectRegistry): readonly GeodesicIntersectionObject[] {
  const memory = getGeodesicIntersectionMemory(registry);
  const previous = new Map(memory);
  for (const object of registry.getAll()) {
    if (object.kind === "geodesic-intersection") {
      previous.set(object.id, object);
      registry.remove(object.id);
    }
  }

  const intersections = assignGeodesicIntersectionIdentities(findGeodesicIntersections(registry), previous);
  memory.clear();
  for (const intersection of intersections) {
    registry.add(intersection);
    memory.set(intersection.id, intersection);
  }
  for (const [id, intersection] of previous) {
    if (!memory.has(id)) {
      memory.set(id, intersection);
    }
  }

  return intersections;
}

export function getRememberedGeodesicIntersectionObject(
  registry: RuntimeObjectRegistry,
  intersectionId: string,
): GeodesicIntersectionObject | undefined {
  return getGeodesicIntersectionMemory(registry).get(intersectionId);
}

export function pruneMissingGeodesicIntersectionObjects(registry: RuntimeObjectRegistry): readonly string[] {
  const memory = getGeodesicIntersectionMemory(registry);
  const prunedIds: string[] = [];
  for (const [id] of [...memory]) {
    if (registry.get(id)?.kind === "geodesic-intersection") {
      continue;
    }

    memory.delete(id);
    prunedIds.push(id);
  }

  return prunedIds;
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
    connectionState: options.trace.terminal.kind === "emitter-hit" ? "connected" : "open",
  };
}

function canMergeGeodesicSegments(left: GeodesicSegmentObject, right: GeodesicSegmentObject): boolean {
  if (
    left.geodesicId !== right.geodesicId ||
    left.cellId !== right.cellId ||
    left.terminal.kind !== "open" ||
    right.segmentIndex !== left.segmentIndex + 1
  ) {
    return false;
  }

  const leftEnd = getGeodesicSegmentEnd(left);
  return distanceSquared(leftEnd, right.start) <= intersectionTolerance * intersectionTolerance &&
    distanceSquared(left.direction, right.direction) <= intersectionTolerance * intersectionTolerance;
}

function removeGeodesicSegments(registry: RuntimeObjectRegistry, geodesicId: string): void {
  for (const segment of getGeodesicSegments(registry, geodesicId)) {
    registry.remove(segment.id);
  }
  updateGeodesicIntersectionObjects(registry);
}

function removeGeodesicAssociations(registry: RuntimeObjectRegistry, geodesicId: string): void {
  for (const object of registry.getAll()) {
    if (object.kind !== "geodesic-cannon" || !object.geodesicIds.includes(geodesicId)) {
      continue;
    }

    const { [geodesicId]: _removedYaw, ...remainingYaws } = object.geodesicEmitterYawRadiansById ?? {};
    const { [geodesicId]: _removedConnection, ...remainingConnections } = object.geodesicConnectionsById ?? {};
    const geodesicIds = object.geodesicIds.filter((id) => id !== geodesicId);
    registry.update({
      ...object,
      activeGeodesicId: object.activeGeodesicId === geodesicId ? geodesicIds[0] : object.activeGeodesicId,
      geodesicIds,
      geodesicEmitterYawRadiansById: remainingYaws,
      geodesicConnectionsById: remainingConnections,
    });
  }
}

function markGeodesicConnected(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  sourceEmitterId: string,
  incomingEmitterId: string,
): void {
  const source = registry.get(sourceEmitterId);
  const incoming = registry.get(incomingEmitterId);
  const tail = getGeodesicTail(registry, geodesicId);
  const incomingYawRadians = tail
    ? sanitizeYaw(Math.atan2(tail.direction.y, tail.direction.x) + Math.PI)
    : undefined;

  if (source?.kind === "geodesic-cannon" && incoming?.kind === "geodesic-cannon" && source.id === incoming.id) {
    registry.update({
      ...source,
      geodesicIds: source.geodesicIds.includes(geodesicId)
        ? source.geodesicIds
        : [...source.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: {
        ...source.geodesicEmitterYawRadiansById,
        [geodesicId]: source.geodesicEmitterYawRadiansById?.[geodesicId] ?? incomingYawRadians ?? source.aimYawRadians,
      },
      geodesicConnectionsById: {
        ...source.geodesicConnectionsById,
        [geodesicId]: {
          outgoingEmitterId: sourceEmitterId,
          incomingEmitterId,
          state: "connected",
        },
      },
    });
    for (const segment of getGeodesicSegments(registry, geodesicId)) {
      registry.update({
        ...segment,
        connectionState: "connected",
      });
    }
    return;
  }

  if (source?.kind === "geodesic-cannon") {
    registry.update({
      ...source,
      geodesicIds: source.geodesicIds.includes(geodesicId)
        ? source.geodesicIds
        : [...source.geodesicIds, geodesicId],
      geodesicConnectionsById: {
        ...source.geodesicConnectionsById,
        [geodesicId]: {
          outgoingEmitterId: sourceEmitterId,
          incomingEmitterId,
          state: "connected",
        },
      },
    });
  }

  if (incoming?.kind === "geodesic-cannon") {
    registry.update({
      ...incoming,
      geodesicIds: incoming.geodesicIds.includes(geodesicId)
        ? incoming.geodesicIds
        : [...incoming.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: incomingYawRadians === undefined
        ? incoming.geodesicEmitterYawRadiansById
        : {
            ...incoming.geodesicEmitterYawRadiansById,
            [geodesicId]: incomingYawRadians,
          },
    });
  }

  for (const segment of getGeodesicSegments(registry, geodesicId)) {
    registry.update({
      ...segment,
      connectionState: "connected",
    });
  }
}

function findSourceEmitterForGeodesic(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): GeodesicCannonObject | undefined {
  for (const object of registry.getAll()) {
    if (object.kind !== "geodesic-cannon") {
      continue;
    }
    const connection = object.geodesicConnectionsById?.[geodesicId];
    if (connection?.outgoingEmitterId === object.id) {
      return object;
    }
  }

  return registry.getAll().find((object): object is GeodesicCannonObject =>
    object.kind === "geodesic-cannon" &&
    object.geodesicIds.includes(geodesicId) &&
    object.geodesicEmitterYawRadiansById?.[geodesicId] !== undefined
  ) ?? registry.getAll().find((object): object is GeodesicCannonObject =>
    object.kind === "geodesic-cannon" && object.activeGeodesicId === geodesicId
  ) ?? registry.getAll().find((object): object is GeodesicCannonObject =>
    object.kind === "geodesic-cannon" && object.geodesicIds.includes(geodesicId)
  );
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
      if (!intersection) {
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
        id: createGeodesicIntersectionId(left.cellId, geodesicIds, intersection.point),
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

function assignGeodesicIntersectionIdentities(
  intersections: readonly GeodesicIntersectionObject[],
  previousById: ReadonlyMap<string, GeodesicIntersectionObject>,
): readonly GeodesicIntersectionObject[] {
  const usedPreviousIds = new Set<string>();
  return intersections.map((intersection) => {
    const match = findContinuityMatchedIntersection(intersection, previousById, usedPreviousIds);
    if (!match) {
      return intersection;
    }

    usedPreviousIds.add(match.id);
    return {
      ...intersection,
      id: match.id,
    };
  });
}

function findContinuityMatchedIntersection(
  intersection: GeodesicIntersectionObject,
  previousById: ReadonlyMap<string, GeodesicIntersectionObject>,
  usedPreviousIds: ReadonlySet<string>,
): GeodesicIntersectionObject | undefined {
  let best: { readonly object: GeodesicIntersectionObject; readonly distance: number } | undefined;
  for (const previous of previousById.values()) {
    if (
      usedPreviousIds.has(previous.id) ||
      previous.cellId !== intersection.cellId ||
      !sameGeodesicPair(previous.geodesicIds, intersection.geodesicIds)
    ) {
      continue;
    }

    const distance = distanceBetweenIntersectionTargets(previous, intersection);
    if (distance > vertexContinuityToleranceMeters || (best && distance >= best.distance)) {
      continue;
    }

    best = { object: previous, distance };
  }

  return best?.object;
}

function sameGeodesicPair(left: readonly [string, string], right: readonly [string, string]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function distanceBetweenIntersectionTargets(left: GeodesicIntersectionObject, right: GeodesicIntersectionObject): number {
  const leftPoint = left.aimStickyTarget?.localPoint ?? left.localPose.translation;
  const rightPoint = right.aimStickyTarget?.localPoint ?? right.localPose.translation;
  return Math.sqrt(distanceSquared(leftPoint, rightPoint));
}

function createGeodesicIntersectionId(
  cellId: string,
  geodesicIds: readonly [string, string],
  point: Vec3,
): string {
  return `geodesic-intersection:${sanitizeIdPart(
    `${cellId}:${geodesicIds.join(":")}:${point.x.toFixed(5)}:${point.y.toFixed(5)}`,
  )}`;
}

function getGeodesicIntersectionMemory(registry: RuntimeObjectRegistry): Map<string, GeodesicIntersectionObject> {
  let memory = geodesicIntersectionMemoryByRegistry.get(registry);
  if (!memory) {
    memory = new Map();
    geodesicIntersectionMemoryByRegistry.set(registry, memory);
  }

  return memory;
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

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "_");
}

function getGlobalGeodesicNumbers(
  registry: RuntimeObjectRegistry,
  requestedGeodesicId: string,
): ReadonlyMap<string, number> {
  const numbersById = new Map<string, number>();
  const usedNumbers = new Set<number>();
  const ids: string[] = [];
  const seenIds = new Set<string>();
  const numberedSegments = registry.getAll()
    .filter(isGeodesicSegmentObject)
    .filter((segment) => segment.geodesicNumber !== undefined)
    .sort((left, right) => left.geodesicNumber! - right.geodesicNumber!);

  for (const segment of numberedSegments) {
    if (!numbersById.has(segment.geodesicId) && segment.geodesicNumber !== undefined) {
      numbersById.set(segment.geodesicId, segment.geodesicNumber);
      usedNumbers.add(segment.geodesicNumber);
    }
    pushUniqueId(ids, seenIds, segment.geodesicId);
  }

  for (const object of registry.getAll()) {
    if (object.kind === "geodesic-cannon") {
      for (const geodesicId of object.geodesicIds) {
        pushUniqueId(ids, seenIds, geodesicId);
      }
      if (object.activeGeodesicId) {
        pushUniqueId(ids, seenIds, object.activeGeodesicId);
      }
    } else if (object.kind === "geodesic-segment") {
      pushUniqueId(ids, seenIds, object.geodesicId);
    }
  }

  pushUniqueId(ids, seenIds, requestedGeodesicId);
  let nextNumber = 1;
  for (const geodesicId of ids) {
    if (numbersById.has(geodesicId)) {
      continue;
    }

    while (usedNumbers.has(nextNumber)) {
      nextNumber += 1;
    }
    numbersById.set(geodesicId, nextNumber);
    usedNumbers.add(nextNumber);
  }

  return numbersById;
}

function pushUniqueId(ids: string[], seenIds: Set<string>, geodesicId: string): void {
  if (seenIds.has(geodesicId)) {
    return;
  }

  seenIds.add(geodesicId);
  ids.push(geodesicId);
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

function distanceSquared(left: Vec3, right: Vec3): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

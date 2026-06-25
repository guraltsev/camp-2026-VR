import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import { getDynamicObjectCollisionBounds, simpleCylinderIntersectsSimpleCylinder, testCellCollision } from "../movement/collision";
import type { SimpleCollisionCylinder } from "../movement/dynamicObject";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  invertRigidTransform3,
  transformDirection3,
  transformPoint3,
  yawRigidTransform3,
  type RigidTransform3,
} from "../math/rigidTransform3";
import { addVec3, distanceVec3, normalizeVec3, scaleVec3, subVec3, type Vec3 } from "../math/vec3";
import type { RuntimeObjectRegistry, RuntimeWorldObject, RuntimeWorldObjectBase } from "./runtimeObjectRegistry";
import { runtimeObjectToDynamicObjectState } from "./runtimeObjectRegistry";

export interface GeodesicCannonObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-cannon";
  readonly canAttachGeodesics?: true;
  readonly activeGeodesicId?: string;
  readonly geodesicIds: readonly string[];
  readonly geodesicEmitterYawRadiansById?: Readonly<Record<string, number>>;
  readonly geodesicConnectionsById?: Readonly<Record<string, GeodesicEmitterConnection>>;
  readonly aimYawRadians: number;
}

export interface GeodesicEmitterConnection {
  readonly outgoingEmitterId: string;
  readonly incomingEmitterId?: string;
  readonly state: "open" | "connected" | "straightening";
}

export interface GeodesicPortalTraversal {
  readonly sourceCellId: string;
  readonly sourcePortalId: string;
  readonly targetCellId: string;
  readonly targetPortalId: string;
}

export interface GeodesicCarryPortalTransition extends GeodesicPortalTraversal {
  readonly transformToTarget: RigidTransform3;
}

export type GeodesicEndRole = "start" | "end";
export type GeodesicHalfRole = "start" | "end";

export interface GeodesicEndpointAttachment {
  readonly geodesicId: string;
  readonly role: GeodesicEndRole;
  readonly anchorObjectId: string;
}

export interface GeodesicEndpointSelection extends GeodesicEndpointAttachment {}

export interface FreeGeodesicEndObject extends RuntimeWorldObjectBase {
  readonly kind: "free-geodesic-end";
  readonly canAttachGeodesics: true;
  readonly faceId?: string;
}

export interface GeodesicIntervalObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-interval";
  readonly start: GeodesicEndpointAttachment;
  readonly end: GeodesicEndpointAttachment;
  readonly startCellId: string;
  readonly portalWord: readonly GeodesicPortalTraversal[];
  readonly motionState: "stable" | "moving";
}

export interface LiftedGeodesicEndpoint {
  readonly sourceRole: GeodesicEndRole;
  readonly targetRole: GeodesicEndRole;
  readonly sourceAnchorObjectId: string;
  readonly targetAnchorObjectId: string;
  readonly sourceCellId: string;
  readonly sourcePoint: Vec3;
  readonly targetPointInSourceCell: Vec3;
  readonly portalWordFromSourceToTarget: readonly GeodesicPortalTraversal[];
}

export interface GeodesicTraceBuildResult {
  readonly interval: GeodesicIntervalObject;
  readonly segments: readonly GeodesicSegmentObject[];
  readonly terminal:
    | { readonly kind: "free-end"; readonly freeEndObjectId: string }
    | { readonly kind: "emitter-hit"; readonly emitterId: string }
    | { readonly kind: "forbidden-zone-hit"; readonly junctionId: string }
    | { readonly kind: "wall-hit"; readonly sideIndex: number };
}

export interface GeodesicSegmentObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic-segment";
  readonly geodesicId: string;
  readonly geodesicNumber?: number;
  readonly segmentIndex: number;
  readonly halfRole?: GeodesicHalfRole;
  readonly start: Vec3;
  readonly direction: Vec3;
  readonly lengthMeters: number;
  readonly terminal: GeodesicSegmentTerminal;
  readonly connectionState?: "open" | "connected" | "straightening";
  readonly highlightState?: "tie-detach-selected";
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
  readonly breakOnForbiddenZone?: boolean;
  readonly rebuildLocked?: boolean;
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

export interface PlaceGeodesicCannonAtGeodesicVertexRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cellId: string;
  readonly vertexPoint: Vec3;
  readonly aimYawRadians: number;
  readonly id: string;
  readonly createContinuationGeodesicId: (sourceGeodesicId: string, sideIndex: number) => string;
}

export interface ConnectGeodesicToEmitterRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly incomingEmitterId: string;
  readonly totalLengthMeters: number;
}

export interface RebuildConnectedGeodesicBetweenEmittersRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly carriedEmitterId?: string;
  readonly carriedEmitterBeforeMove?: GeodesicCannonObject;
  readonly carriedEmitterPortalTransition?: GeodesicCarryPortalTransition;
  readonly carriedPortalWord?: readonly GeodesicPortalTraversal[];
}

export interface TieAndDetachIncidentGeodesicsRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly emitterId: string;
  readonly geodesicId: string;
  readonly incidentGeodesicIds?: readonly [string, string];
}

export interface AdvanceStraighteningGeodesicsRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly deltaSeconds: number;
  readonly speedMetersPerSecond?: number;
}

export interface PlaceGeodesicCannonResult {
  readonly placed: boolean;
  readonly object?: GeodesicCannonObject;
  readonly reason?: "missing-cell" | "cell-collision" | "runtime-object-collision";
}

const defaultCannonCollision: SimpleCollisionCylinder = {
  radius: 0.3,
  height: 0.75,
  offset: { x: 0, y: 0, z: 0.375 },
};
export const geodesicRayBeamHeightMeters = 1.08;
export const geodesicRayBeamStartOffsetMeters = 0;
export const GEODESIC_MIN_LENGTH_METERS = 0.2;
const defaultTraceLengthMeters = 2;
const portalStartEpsilonMeters = 1e-4;
const intersectionTolerance = 1e-7;
export const minGeodesicSegmentLengthMeters = 0.05;
const vertexContinuityToleranceMeters = 10;
const emitterConnectionToleranceMeters = 0.3;
const geodesicIntersectionBalloonHeightOffsetMeters = 0.25;
export const geodesicStraighteningSpeedMetersPerSecond = 0.4;
const geodesicStraighteningToleranceMeters = 0.01;
const geodesicIntersectionMemoryByRegistry = new WeakMap<RuntimeObjectRegistry, Map<string, GeodesicIntersectionObject>>();

export function createGeodesicCannonObject(options: CreateGeodesicCannonOptions): GeodesicCannonObject {
  const aimYawRadians = sanitizeYaw(options.aimYawRadians ?? yawFromPose(options.localPose));

  return {
    id: options.id,
    kind: "geodesic-cannon",
    canAttachGeodesics: true,
    cellId: options.cellId,
    localPose: {
      ...options.localPose,
      rotation: yawRigidTransform3(aimYawRadians).rotation,
    },
    collision: options.collision ?? defaultCannonCollision,
    portalRenderable: true,
    displayHelpMessage: "Creates and edits geodesic rays. Open its menu to add, carry, rotate, aim, tie, detach, or delete rays.",
    tooltip: {
      label: "Geodesic emitter",
      rangeMeters: 2.5,
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

export function isGeodesicIntervalObject(object: { readonly kind: string }): object is GeodesicIntervalObject {
  return object.kind === "geodesic-interval";
}

export function isFreeGeodesicEndObject(object: { readonly kind: string }): object is FreeGeodesicEndObject {
  return object.kind === "free-geodesic-end";
}

export function createFreeGeodesicEndObject(input: {
  readonly id: string;
  readonly cellId: string;
  readonly point: Vec3;
}): FreeGeodesicEndObject {
  return {
    id: input.id,
    kind: "free-geodesic-end",
    canAttachGeodesics: true,
    cellId: input.cellId,
    localPose: yawRigidTransform3(0, input.point),
    portalRenderable: false,
  };
}

export function createGeodesicIntervalObject(input: {
  readonly id: string;
  readonly startAnchorObjectId: string;
  readonly endAnchorObjectId: string;
  readonly startCellId: string;
  readonly portalWord?: readonly GeodesicPortalTraversal[];
  readonly motionState?: "stable" | "moving";
}): GeodesicIntervalObject {
  return {
    id: input.id,
    kind: "geodesic-interval",
    cellId: input.startCellId,
    localPose: identityRigidTransform3,
    portalRenderable: false,
    startCellId: input.startCellId,
    portalWord: input.portalWord ?? [],
    motionState: input.motionState ?? "stable",
    start: {
      geodesicId: input.id,
      role: "start",
      anchorObjectId: input.startAnchorObjectId,
    },
    end: {
      geodesicId: input.id,
      role: "end",
      anchorObjectId: input.endAnchorObjectId,
    },
  };
}

export function getGeodesicEndpointAttachmentsForAnchor(
  registry: RuntimeObjectRegistry,
  anchorObjectId: string,
): readonly GeodesicEndpointAttachment[] {
  return registry.getAll()
    .filter(isGeodesicIntervalObject)
    .flatMap((interval) => [interval.start, interval.end])
    .filter((attachment) => attachment.anchorObjectId === anchorObjectId);
}

export function getGeodesicEndpoints(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): readonly [GeodesicEndpointAttachment, GeodesicEndpointAttachment] | undefined {
  const interval = registry.get(geodesicId);
  return interval?.kind === "geodesic-interval" ? [interval.start, interval.end] : undefined;
}

export function replaceGeodesicEndpointAttachment(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  endRole: GeodesicEndRole,
  nextAnchorObjectId: string,
): GeodesicIntervalObject | undefined {
  const interval = registry.get(geodesicId);
  if (interval?.kind !== "geodesic-interval" || !canObjectAttachGeodesics(registry.get(nextAnchorObjectId))) {
    return undefined;
  }

  const next: GeodesicIntervalObject = {
    ...interval,
    [endRole]: {
      geodesicId,
      role: endRole,
      anchorObjectId: nextAnchorObjectId,
    },
  };
  registry.update(next);
  removeUnusedFreeGeodesicEnds(registry);
  return next;
}

export function removeGeodesicIntervalAndDerivedObjects(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): void {
  removeGeodesicSegments(registry, geodesicId);
  for (const object of registry.getAll()) {
    if (
      (object.kind === "geodesic-interval" && object.id === geodesicId) ||
      (object.kind === "measured-geodesic-length" && object.geodesicId === geodesicId) ||
      (object.kind === "protractor-angle" &&
        (object.first.geodesicId === geodesicId || object.second.geodesicId === geodesicId)) ||
      (object.kind === "geodesic-intersection" && object.geodesicIds.includes(geodesicId))
    ) {
      registry.remove(object.id);
    }
  }
  removeGeodesicAssociations(registry, geodesicId);
  removeUnusedFreeGeodesicEnds(registry);
  updateGeodesicIntersectionObjects(registry);
}

export function getGeodesicPortalWord(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): readonly GeodesicPortalTraversal[] | undefined {
  const interval = registry.get(geodesicId);
  return interval?.kind === "geodesic-interval" ? interval.portalWord : undefined;
}

export function reverseGeodesicPortalWord(
  word: readonly GeodesicPortalTraversal[],
): readonly GeodesicPortalTraversal[] {
  return word.slice().reverse().map((traversal) => ({
    sourceCellId: traversal.targetCellId,
    sourcePortalId: traversal.targetPortalId,
    targetCellId: traversal.sourceCellId,
    targetPortalId: traversal.sourcePortalId,
  }));
}

export function liftGeodesicEndpoint(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly interval: GeodesicIntervalObject;
  readonly sourceRole: GeodesicEndRole;
}): LiftedGeodesicEndpoint | undefined {
  const sourceAttachment = input.interval[input.sourceRole];
  const targetRole: GeodesicEndRole = input.sourceRole === "start" ? "end" : "start";
  const targetAttachment = input.interval[targetRole];
  const sourceAnchor = input.registry.get(sourceAttachment.anchorObjectId);
  const targetAnchor = input.registry.get(targetAttachment.anchorObjectId);
  if (!canObjectAttachGeodesics(sourceAnchor) || !canObjectAttachGeodesics(targetAnchor)) {
    return undefined;
  }

  const portalWordFromSourceToTarget = input.sourceRole === "start"
    ? input.interval.portalWord
    : reverseGeodesicPortalWord(input.interval.portalWord);
  const sourcePoint = getAnchorBeamPoint(sourceAnchor);
  let targetPointInSourceCell = getAnchorBeamPoint(targetAnchor);
  for (const traversal of portalWordFromSourceToTarget.slice().reverse()) {
    const portal = input.world.cellsById.get(traversal.sourceCellId)?.portalsById.get(traversal.sourcePortalId);
    if (!portal) {
      return undefined;
    }
    targetPointInSourceCell = transformPoint3(invertRigidTransform3(portal.transformToTarget), targetPointInSourceCell);
  }

  return {
    sourceRole: input.sourceRole,
    targetRole,
    sourceAnchorObjectId: sourceAttachment.anchorObjectId,
    targetAnchorObjectId: targetAttachment.anchorObjectId,
    sourceCellId: sourceAnchor.cellId,
    sourcePoint,
    targetPointInSourceCell,
    portalWordFromSourceToTarget,
  };
}

export function geodesicHasNonzeroLiftedDisplacement(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly interval: GeodesicIntervalObject;
}): boolean {
  const lifted = liftGeodesicEndpoint({ ...input, sourceRole: "start" });
  if (!lifted) {
    return false;
  }
  return Math.hypot(
    lifted.targetPointInSourceCell.x - lifted.sourcePoint.x,
    lifted.targetPointInSourceCell.y - lifted.sourcePoint.y,
  ) >= GEODESIC_MIN_LENGTH_METERS - intersectionTolerance;
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
  const interval = registry.get(geodesicId);
  if (interval?.kind === "geodesic-interval") {
    const start = registry.get(interval.start.anchorObjectId);
    const end = registry.get(interval.end.anchorObjectId);
    if (start?.kind === "geodesic-cannon") {
      return {
        outgoingEmitterId: start.id,
        incomingEmitterId: end?.kind === "geodesic-cannon" ? end.id : undefined,
        state: end?.kind === "geodesic-cannon" ? "connected" : "open",
      };
    }
    if (end?.kind === "geodesic-cannon") {
      return {
        outgoingEmitterId: end.id,
        state: "open",
      };
    }
  }

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
  const interval = registry.get(geodesicId);
  if (interval?.kind === "geodesic-interval") {
    return registry.get(interval.start.anchorObjectId)?.kind === "geodesic-cannon" &&
      registry.get(interval.end.anchorObjectId)?.kind === "geodesic-cannon";
  }

  const state = getGeodesicConnection(registry, geodesicId)?.state;
  if (state === "connected" || state === "straightening") {
    return true;
  }

  return getGeodesicTail(registry, geodesicId)?.terminal.kind === "emitter-hit";
}

export function isGeodesicStraightening(registry: RuntimeObjectRegistry, geodesicId: string): boolean {
  if (getGeodesicConnection(registry, geodesicId)?.state === "straightening") {
    return true;
  }

  return getGeodesicSegments(registry, geodesicId).some((segment) => segment.connectionState === "straightening");
}

export function collectLockedIncidentGeodesicIdsForEmitter(
  registry: RuntimeObjectRegistry,
  emitterId: string,
): readonly string[] {
  return collectIncidentGeodesicIdsForEmitter(registry, emitterId)
    .filter((geodesicId) => isGeodesicLocked(registry, geodesicId));
}

export function resolveGeodesicNumber(registry: RuntimeObjectRegistry, geodesicId: string): number {
  return getGlobalGeodesicNumbers(registry, geodesicId).get(geodesicId) ?? 1;
}

export function removeGeodesic(registry: RuntimeObjectRegistry, geodesicId: string): void {
  if (registry.get(geodesicId)?.kind === "geodesic-interval") {
    removeGeodesicIntervalAndDerivedObjects(registry, geodesicId);
    return;
  }
  removeGeodesicSegments(registry, geodesicId);
  removeGeodesicAssociations(registry, geodesicId);
  updateGeodesicIntersectionObjects(registry);
}

export function removeUnlockedGeodesicsFromCannon(
  registry: RuntimeObjectRegistry,
  cannonId: string,
): readonly string[] {
  const cannon = registry.get(cannonId);
  if (cannon?.kind !== "geodesic-cannon") {
    return [];
  }

  const removed: string[] = [];
  for (const geodesicId of cannon.geodesicIds) {
    if (isGeodesicLocked(registry, geodesicId)) {
      continue;
    }

    removeGeodesic(registry, geodesicId);
    removed.push(geodesicId);
  }

  return removed;
}

export function hasStraighteningIncidentGeodesic(registry: RuntimeObjectRegistry, emitterId: string): boolean {
  return collectIncidentGeodesicIdsForEmitter(registry, emitterId)
    .some((geodesicId) => isGeodesicStraightening(registry, geodesicId));
}

export function removeGeodesicCannonAndSegments(registry: RuntimeObjectRegistry, cannonId: string): void {
  const cannon = registry.get(cannonId);
  if (cannon?.kind === "geodesic-cannon") {
    const geodesicIds = new Set(getGeodesicEndpointAttachmentsForAnchor(registry, cannonId).map((attachment) => attachment.geodesicId));
    for (const geodesicId of cannon.geodesicIds) {
      geodesicIds.add(geodesicId);
    }
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

export function traceGeodesicFromLiftedChord(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly sourceCellId: string;
  readonly sourcePoint: Vec3;
  readonly yawRadians: number;
  readonly lengthMeters: number;
  readonly expectedPortalWord?: readonly GeodesicPortalTraversal[];
}): GeodesicTraceBuildResult | undefined {
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval" || input.lengthMeters < minGeodesicSegmentLengthMeters) {
    return undefined;
  }
  const sourceAnchorId = interval.start.anchorObjectId;
  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: true,
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceEmitterId: sourceAnchorId,
    cellId: input.sourceCellId,
    start: input.sourcePoint,
    direction: directionFromYaw(input.yawRadians),
    maxLengthMeters: input.lengthMeters,
  });
  const portalWord = collectPortalWordFromTraces(input.world, traces);
  if (input.expectedPortalWord && !samePortalWord(portalWord, input.expectedPortalWord)) {
    return undefined;
  }

  const segments = replaceDerivedSegmentsFromTraces({
    registry: input.registry,
    geodesicId: input.geodesicId,
    traces,
  });
  return {
    interval,
    segments,
    terminal: traceTerminalToBuildTerminalForInterval(interval, traces.at(-1)),
  };
}

export function aimFreeGeodesicFromEndpoint(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly emitterEndRole: GeodesicEndRole;
  readonly targetPointInEmitterCell: Vec3;
  readonly connectEmitters?: boolean;
}): GeodesicTraceBuildResult | undefined {
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return undefined;
  }
  const emitterAttachment = interval[input.emitterEndRole];
  const freeRole = getOppositeEndRole(input.emitterEndRole);
  const freeAttachment = interval[freeRole];
  const emitter = input.registry.get(emitterAttachment.anchorObjectId);
  const freeEnd = input.registry.get(freeAttachment.anchorObjectId);
  if (emitter?.kind !== "geodesic-cannon" || freeEnd?.kind !== "free-geodesic-end") {
    return undefined;
  }
  if (getGeodesicEndpointAttachmentsForAnchor(input.registry, freeEnd.id).length !== 1) {
    return undefined;
  }

  const emitterPoint = getGeodesicCannonEmitterPoint(emitter);
  const dx = input.targetPointInEmitterCell.x - emitterPoint.x;
  const dy = input.targetPointInEmitterCell.y - emitterPoint.y;
  if (Math.hypot(dx, dy) <= intersectionTolerance) {
    return undefined;
  }
  const lengthMeters = Math.max(Math.hypot(dx, dy), minGeodesicSegmentLengthMeters);
  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: input.connectEmitters ?? true,
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceEmitterId: emitter.id,
    cellId: emitter.cellId,
    start: emitterPoint,
    direction: directionFromYaw(Math.atan2(dy, dx)),
    maxLengthMeters: lengthMeters,
  });
  const tail = traces.at(-1);
  if (!tail) {
    return undefined;
  }

  const portalWord = collectPortalWordFromTraces(input.world, traces);
  const terminalPoint = addVec3(tail.start, scaleVec3(tail.direction, tail.lengthMeters));
  const terminalCellId = tail.cellId;
  const nextFreeEnd = {
    ...freeEnd,
    cellId: terminalCellId,
    localPose: yawRigidTransform3(0, terminalPoint),
  };
  input.registry.update(nextFreeEnd);

  let nextInterval: GeodesicIntervalObject = {
    ...interval,
    startCellId: emitter.cellId,
    cellId: emitter.cellId,
    portalWord,
  };
  input.registry.update(nextInterval);
  if ((input.connectEmitters ?? true) && tail.terminal.kind === "emitter-hit") {
    nextInterval = replaceGeodesicEndpointAttachment(
      input.registry,
      input.geodesicId,
      freeRole,
      tail.terminal.emitterId,
    ) ?? nextInterval;
  }

  const segments = replaceDerivedSegmentsFromTraces({
    registry: input.registry,
    geodesicId: input.geodesicId,
    traces,
  });
  syncLegacyEmitterGeodesicFields(input.registry, input.geodesicId);
  updateGeodesicIntersectionObjects(input.registry);
  return {
    interval: nextInterval,
    segments,
    terminal: (input.connectEmitters ?? true) && tail.terminal.kind === "emitter-hit"
      ? { kind: "emitter-hit", emitterId: tail.terminal.emitterId }
      : { kind: "free-end", freeEndObjectId: freeEnd.id },
  };
}

export function rebuildDerivedGeodesicSegments(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
}): GeodesicTraceBuildResult | undefined {
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return undefined;
  }
  const lifted = liftGeodesicEndpoint({
    world: input.world,
    registry: input.registry,
    interval,
    sourceRole: "start",
  });
  if (!lifted) {
    return undefined;
  }
  const dx = lifted.targetPointInSourceCell.x - lifted.sourcePoint.x;
  const dy = lifted.targetPointInSourceCell.y - lifted.sourcePoint.y;
  const lengthMeters = Math.hypot(dx, dy);
  if (lengthMeters < GEODESIC_MIN_LENGTH_METERS - intersectionTolerance) {
    removeGeodesicIntervalAndDerivedObjects(input.registry, input.geodesicId);
    return undefined;
  }
  return traceGeodesicFromLiftedChord({
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceCellId: lifted.sourceCellId,
    sourcePoint: lifted.sourcePoint,
    yawRadians: Math.atan2(dy, dx),
    lengthMeters,
    expectedPortalWord: lifted.portalWordFromSourceToTarget,
  });
}

export function splitDerivedSegmentsIntoEndpointHalves(
  segments: readonly GeodesicSegmentObject[],
): readonly GeodesicSegmentObject[] {
  const totalLengthMeters = totalGeodesicLengthFromSegments(segments);
  const midpointMeters = totalLengthMeters / 2;
  let beforeMeters = 0;
  const split: GeodesicSegmentObject[] = [];
  let index = 0;
  for (const segment of segments) {
    const segmentStartMeters = beforeMeters;
    const segmentEndMeters = beforeMeters + segment.lengthMeters;
    if (
      midpointMeters > segmentStartMeters + intersectionTolerance &&
      midpointMeters < segmentEndMeters - intersectionTolerance
    ) {
      const firstLength = midpointMeters - segmentStartMeters;
      const secondLength = segment.lengthMeters - firstLength;
      const midpoint = addVec3(segment.start, scaleVec3(segment.direction, firstLength));
      split.push({
        ...segment,
        id: `${segment.geodesicId}:segment:${index++}`,
        segmentIndex: index - 1,
        lengthMeters: firstLength,
        terminal: { kind: "open" },
        halfRole: "start",
      });
      split.push({
        ...segment,
        id: `${segment.geodesicId}:segment:${index++}`,
        segmentIndex: index - 1,
        start: midpoint,
        localPose: yawRigidTransform3(Math.atan2(segment.direction.y, segment.direction.x), midpoint),
        lengthMeters: secondLength,
        halfRole: "end",
      });
    } else {
      const halfRole: GeodesicHalfRole = segmentEndMeters <= midpointMeters + intersectionTolerance ? "start" : "end";
      split.push({
        ...segment,
        id: `${segment.geodesicId}:segment:${index++}`,
        segmentIndex: index - 1,
        halfRole,
      });
    }
    beforeMeters = segmentEndMeters;
  }
  return split;
}

export function resolveGeodesicEndpointSelectionFromSegmentHit(
  registry: RuntimeObjectRegistry,
  segmentId: string,
): GeodesicEndpointSelection | undefined {
  const segment = registry.get(segmentId);
  if (segment?.kind !== "geodesic-segment" || !segment.halfRole) {
    return undefined;
  }
  const interval = registry.get(segment.geodesicId);
  return interval?.kind === "geodesic-interval" ? interval[segment.halfRole] : undefined;
}

export function resolveEndpointTangentAtAnchor(input: {
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly endRole: GeodesicEndRole;
}): { readonly anchorObjectId: string; readonly yawRadians: number } | undefined {
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return undefined;
  }
  const attachment = interval[input.endRole];
  const segment = input.endRole === "start"
    ? getGeodesicSegments(input.registry, input.geodesicId)[0]
    : getGeodesicSegments(input.registry, input.geodesicId).at(-1);
  if (!segment) {
    return undefined;
  }
  const yawRadians = Math.atan2(segment.direction.y, segment.direction.x) + (input.endRole === "start" ? 0 : Math.PI);
  return {
    anchorObjectId: attachment.anchorObjectId,
    yawRadians: sanitizeYaw(yawRadians),
  };
}

export function splitGeodesicIntervalAtSegmentHit(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly segmentId: string;
  readonly distanceAlongSegmentMeters: number;
  readonly placedEmitterId: string;
  readonly createContinuationGeodesicId: (sourceGeodesicId: string, sideIndex: number) => string;
}): readonly GeodesicIntervalObject[] {
  const interval = input.registry.get(input.geodesicId);
  const segment = input.registry.get(input.segmentId);
  const placed = input.registry.get(input.placedEmitterId);
  if (
    interval?.kind !== "geodesic-interval" ||
    segment?.kind !== "geodesic-segment" ||
    segment.geodesicId !== input.geodesicId ||
    placed?.kind !== "geodesic-cannon" ||
    !isAimableFreeGeodesic(input.registry, interval)
  ) {
    return [];
  }
  const clampedDistance = Math.min(segment.lengthMeters, Math.max(0, input.distanceAlongSegmentMeters));
  if (!canConnectGeodesicSegmentAtDistance(clampedDistance)) {
    return [];
  }

  const segments = getGeodesicSegments(input.registry, input.geodesicId);
  const totalLengthMeters = totalGeodesicLengthFromSegments(segments);
  const prefixLengthMeters = totalLengthThroughSegment(segments, segment, clampedDistance);
  const continuationLengthMeters = totalLengthMeters - prefixLengthMeters;
  const freeRole: GeodesicEndRole = input.registry.get(interval.start.anchorObjectId)?.kind === "free-geodesic-end"
    ? "start"
    : "end";
  const sourceRole = getOppositeEndRole(freeRole);
  const sourceAnchor = input.registry.get(interval[sourceRole].anchorObjectId);
  const freeEnd = input.registry.get(interval[freeRole].anchorObjectId);
  if (sourceAnchor?.kind !== "geodesic-cannon" || freeEnd?.kind !== "free-geodesic-end") {
    return [];
  }

  const prefixTraces = segments
    .filter((entry) => entry.segmentIndex < segment.segmentIndex)
    .map(segmentToTrace);
  prefixTraces.push({
    cellId: segment.cellId,
    start: segment.start,
    direction: segment.direction,
    lengthMeters: clampedDistance,
    terminal: { kind: "emitter-hit", emitterId: placed.id },
  });
  const prefixPortalWord = collectPortalWordFromTraces(input.world, prefixTraces);
  const continuationId = continuationLengthMeters >= minGeodesicSegmentLengthMeters - intersectionTolerance
    ? input.createContinuationGeodesicId(input.geodesicId, 0)
    : undefined;
  if (continuationId) {
    input.registry.add(createGeodesicIntervalObject({
      id: continuationId,
      startAnchorObjectId: placed.id,
      endAnchorObjectId: freeEnd.id,
      startCellId: placed.cellId,
      motionState: "stable",
    }));
  }
  input.registry.update({
    ...interval,
    [freeRole]: {
      geodesicId: interval.id,
      role: freeRole,
      anchorObjectId: placed.id,
    },
    startCellId: sourceAnchor.cellId,
    cellId: sourceAnchor.cellId,
    portalWord: prefixPortalWord,
  });
  replaceDerivedSegmentsFromTraces({
    registry: input.registry,
    geodesicId: input.geodesicId,
    traces: prefixTraces,
  });

  if (continuationId) {
    rebuildContinuationFromCut({
      world: input.world,
      registry: input.registry,
      geodesicId: continuationId,
      placed,
      freeEnd,
      yawRadians: Math.atan2(segment.direction.y, segment.direction.x),
      lengthMeters: continuationLengthMeters,
    });
  }
  removeUnusedFreeGeodesicEnds(input.registry);
  syncLegacyEmitterGeodesicFields(input.registry, input.geodesicId);
  if (continuationId) {
    syncLegacyEmitterGeodesicFields(input.registry, continuationId);
  }
  updateGeodesicIntersectionObjects(input.registry);
  return [input.registry.get(input.geodesicId), continuationId ? input.registry.get(continuationId) : undefined]
    .filter((object): object is GeodesicIntervalObject => object?.kind === "geodesic-interval");
}

export function rebuildLockedGeodesicFromEndpointsAndPortalWord(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly carriedAnchorObjectId?: string;
  readonly carriedPortalTransition?: GeodesicCarryPortalTransition;
}): GeodesicTraceBuildResult | undefined {
  return rebuildDerivedGeodesicSegments(input);
}

export function collectGeodesicMenuRowsForEmitter(
  registry: RuntimeObjectRegistry,
  emitterId: string,
): readonly { readonly geodesicId: string; readonly label: string }[] {
  const rows = getGeodesicEndpointAttachmentsForAnchor(registry, emitterId)
    .map((attachment) => attachment.geodesicId)
    .filter((geodesicId, index, ids) => ids.indexOf(geodesicId) === index);
  return rows.map((geodesicId) => ({
    geodesicId,
    label: `G${resolveGeodesicNumber(registry, geodesicId)}`,
  }));
}

function collectPortalWordFromTraces(
  world: CompiledCellComplex,
  traces: readonly TraceGeodesicSegmentResult[],
): readonly GeodesicPortalTraversal[] {
  return traces.flatMap((trace) => {
    if (trace.terminal.kind !== "portal-hit") {
      return [];
    }
    const portal = world.cellsById.get(trace.cellId)?.portalsById.get(trace.terminal.portalId);
    return portal
      ? [{
          sourceCellId: trace.cellId,
          sourcePortalId: portal.id,
          targetCellId: portal.targetCellId,
          targetPortalId: portal.targetPortalId,
        }]
      : [];
  });
}

function samePortalWord(
  left: readonly GeodesicPortalTraversal[],
  right: readonly GeodesicPortalTraversal[],
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const other = right[index];
    return entry.sourceCellId === other.sourceCellId &&
      entry.sourcePortalId === other.sourcePortalId &&
      entry.targetCellId === other.targetCellId &&
      entry.targetPortalId === other.targetPortalId;
  });
}

function traceTerminalToBuildTerminal(
  tail: TraceGeodesicSegmentResult | undefined,
): GeodesicTraceBuildResult["terminal"] {
  if (!tail) {
    return { kind: "wall-hit", sideIndex: -1 };
  }
  if (tail.terminal.kind === "emitter-hit") {
    return { kind: "emitter-hit", emitterId: tail.terminal.emitterId };
  }
  if (tail.terminal.kind === "forbidden-zone-hit") {
    return { kind: "forbidden-zone-hit", junctionId: tail.terminal.junctionId };
  }
  if (tail.terminal.kind === "wall-hit") {
    return { kind: "wall-hit", sideIndex: tail.terminal.sideIndex };
  }
  return { kind: "free-end", freeEndObjectId: "" };
}

function traceTerminalToBuildTerminalForInterval(
  interval: GeodesicIntervalObject,
  tail: TraceGeodesicSegmentResult | undefined,
): GeodesicTraceBuildResult["terminal"] {
  const terminal = traceTerminalToBuildTerminal(tail);
  if (terminal.kind !== "free-end") {
    return terminal;
  }
  return interval.end.anchorObjectId.startsWith(`${interval.id}:free-end`) ||
    interval.end.anchorObjectId.includes("free-end")
    ? { kind: "free-end", freeEndObjectId: interval.end.anchorObjectId }
    : terminal;
}

function replaceDerivedSegmentsFromTraces(input: {
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly traces: readonly TraceGeodesicSegmentResult[];
}): readonly GeodesicSegmentObject[] {
  removeGeodesicSegments(input.registry, input.geodesicId);
  const geodesicNumber = resolveGeodesicNumber(input.registry, input.geodesicId);
  const rawSegments = input.traces.map((trace, index) => createSegmentFromTrace({
    id: `${input.geodesicId}:segment:${index}`,
    geodesicId: input.geodesicId,
    geodesicNumber,
    segmentIndex: index,
    trace,
  }));
  const connectionState = resolveDerivedSegmentConnectionState(input.registry, input.geodesicId);
  const splitSegments = splitDerivedSegmentsIntoEndpointHalves(rawSegments)
    .map((segment) => ({
      ...segment,
      connectionState,
      tooltip: createGeodesicSegmentTooltip(segment.geodesicNumber, connectionState),
    }));
  for (const segment of splitSegments) {
    input.registry.add(segment);
  }
  return splitSegments;
}

function resolveDerivedSegmentConnectionState(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): "open" | "connected" | "straightening" {
  const interval = registry.get(geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return getGeodesicTail(registry, geodesicId)?.terminal.kind === "emitter-hit" ? "connected" : "open";
  }
  if (interval.motionState === "moving") {
    return "straightening";
  }
  const start = registry.get(interval.start.anchorObjectId);
  const end = registry.get(interval.end.anchorObjectId);
  return start?.kind === "geodesic-cannon" && end?.kind === "geodesic-cannon" ? "connected" : "open";
}

function segmentToTrace(segment: GeodesicSegmentObject): TraceGeodesicSegmentResult {
  return {
    cellId: segment.cellId,
    start: segment.start,
    direction: segment.direction,
    lengthMeters: segment.lengthMeters,
    terminal: segment.terminal,
  };
}

function rebuildContinuationFromCut(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly placed: GeodesicCannonObject;
  readonly freeEnd: FreeGeodesicEndObject;
  readonly yawRadians: number;
  readonly lengthMeters: number;
}): void {
  const start = getGeodesicCannonEmitterPoint(input.placed);
  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: true,
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    sourceEmitterId: input.placed.id,
    cellId: input.placed.cellId,
    start,
    direction: directionFromYaw(input.yawRadians),
    maxLengthMeters: input.lengthMeters,
  });
  const tail = traces.at(-1);
  if (!tail) {
    removeGeodesicIntervalAndDerivedObjects(input.registry, input.geodesicId);
    return;
  }
  const terminalPoint = addVec3(tail.start, scaleVec3(tail.direction, tail.lengthMeters));
  input.registry.update({
    ...input.freeEnd,
    cellId: tail.cellId,
    localPose: yawRigidTransform3(0, terminalPoint),
  });
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return;
  }
  input.registry.update({
    ...interval,
    startCellId: input.placed.cellId,
    cellId: input.placed.cellId,
    portalWord: collectPortalWordFromTraces(input.world, traces),
  });
  if (tail.terminal.kind === "emitter-hit") {
    replaceGeodesicEndpointAttachment(input.registry, input.geodesicId, "end", tail.terminal.emitterId);
  }
  replaceDerivedSegmentsFromTraces({
    registry: input.registry,
    geodesicId: input.geodesicId,
    traces,
  });
}

function getGeodesicTotalLengthMeters(registry: RuntimeObjectRegistry, geodesicId: string): number {
  return getGeodesicSegments(registry, geodesicId)
    .reduce((total, segment) => total + segment.lengthMeters, 0);
}

function isAimableFreeGeodesic(registry: RuntimeObjectRegistry, interval: GeodesicIntervalObject): boolean {
  if (interval.motionState !== "stable") {
    return false;
  }
  const start = registry.get(interval.start.anchorObjectId);
  const end = registry.get(interval.end.anchorObjectId);
  const hasOneEmitter = (start?.kind === "geodesic-cannon") !== (end?.kind === "geodesic-cannon");
  const freeEnd = start?.kind === "free-geodesic-end" ? start : end?.kind === "free-geodesic-end" ? end : undefined;
  return hasOneEmitter && freeEnd !== undefined &&
    getGeodesicEndpointAttachmentsForAnchor(registry, freeEnd.id).length === 1;
}

function syncLegacyEmitterGeodesicFields(registry: RuntimeObjectRegistry, geodesicId: string): void {
  const interval = registry.get(geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    return;
  }
  for (const role of ["start", "end"] as const) {
    const anchor = registry.get(interval[role].anchorObjectId);
    if (anchor?.kind !== "geodesic-cannon") {
      continue;
    }
    const tangent = resolveEndpointTangentAtAnchor({ registry, geodesicId, endRole: role });
    registry.update({
      ...anchor,
      activeGeodesicId: geodesicId,
      geodesicIds: anchor.geodesicIds.includes(geodesicId) ? anchor.geodesicIds : [...anchor.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: tangent
        ? {
            ...anchor.geodesicEmitterYawRadiansById,
            [geodesicId]: tangent.yawRadians,
          }
        : anchor.geodesicEmitterYawRadiansById,
    });
  }
}

export function shootGeodesic(input: ShootGeodesicInput): GeodesicSegmentObject {
  const aimYawRadians = sanitizeYaw(input.cannon.aimYawRadians);
  const direction = directionFromYaw(aimYawRadians);
  const start = getGeodesicCannonEmitterPoint(input.cannon);
  const targetPoint = addVec3(start, scaleVec3(direction, input.maxLengthMeters ?? defaultTraceLengthMeters));
  let interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval") {
    const freeEndId = `${input.geodesicId}:free-end`;
    input.registry.add(createFreeGeodesicEndObject({
      id: freeEndId,
      cellId: input.cannon.cellId,
      point: targetPoint,
    }));
    input.registry.add(createGeodesicIntervalObject({
      id: input.geodesicId,
      startAnchorObjectId: input.cannon.id,
      endAnchorObjectId: freeEndId,
      startCellId: input.cannon.cellId,
    }));
  }
  const result = aimFreeGeodesicFromEndpoint({
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    emitterEndRole: "start",
    targetPointInEmitterCell: targetPoint,
    connectEmitters: input.connectEmitters ?? true,
  });
  const segment = result?.segments[0];
  if (!segment) {
    throw new Error(`Failed to shoot geodesic "${input.geodesicId}".`);
  }
  const currentCannon = input.registry.get(input.cannon.id);
  const cannonForUpdate = currentCannon?.kind === "geodesic-cannon"
    ? {
        ...currentCannon,
        cellId: input.cannon.cellId,
        localPose: input.cannon.localPose,
        aimYawRadians: input.cannon.aimYawRadians,
      }
    : input.cannon;
  input.registry.update({
    ...cannonForUpdate,
    activeGeodesicId: input.geodesicId,
    geodesicIds: cannonForUpdate.geodesicIds.includes(input.geodesicId)
      ? cannonForUpdate.geodesicIds
      : [...cannonForUpdate.geodesicIds, input.geodesicId],
    geodesicEmitterYawRadiansById: {
      ...cannonForUpdate.geodesicEmitterYawRadiansById,
      [input.geodesicId]: aimYawRadians,
    },
  });
  syncLegacyEmitterGeodesicFields(input.registry, input.geodesicId);
  updateGeodesicIntersectionObjects(input.registry);
  return segment;
}

export function extendGeodesic(input: ExtendGeodesicInput): GeodesicSegmentObject | undefined {
  const interval = input.registry.get(input.geodesicId);
  if (interval?.kind !== "geodesic-interval" || !isAimableFreeGeodesic(input.registry, interval)) {
    return undefined;
  }
  const emitterRole: GeodesicEndRole = input.registry.get(interval.start.anchorObjectId)?.kind === "geodesic-cannon"
    ? "start"
    : "end";
  const emitter = input.registry.get(interval[emitterRole].anchorObjectId);
  const tail = getGeodesicTail(input.registry, input.geodesicId);
  if (emitter?.kind !== "geodesic-cannon" || !tail || !canExtendGeodesicSegment(tail)) {
    return undefined;
  }
  const tangent = resolveEndpointTangentAtAnchor({
    registry: input.registry,
    geodesicId: input.geodesicId,
    endRole: emitterRole,
  });
  const yaw = tangent?.yawRadians ?? emitter.aimYawRadians;
  const targetPoint = addVec3(
    getGeodesicCannonEmitterPoint(emitter),
    scaleVec3(directionFromYaw(yaw), getGeodesicTotalLengthMeters(input.registry, input.geodesicId) + (input.maxLengthMeters ?? defaultTraceLengthMeters)),
  );
  const result = aimFreeGeodesicFromEndpoint({
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    emitterEndRole: emitterRole,
    targetPointInEmitterCell: targetPoint,
    connectEmitters: input.connectEmitters ?? true,
  });
  return result?.segments.at(-1);
}

export function rebuildGeodesicToLength(input: RebuildGeodesicToLengthInput): readonly GeodesicSegmentObject[] {
  if (!input.rebuildLocked && isGeodesicLocked(input.registry, input.geodesicId)) {
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
  if (input.breakOnForbiddenZone && getGeodesicTail(input.registry, input.geodesicId)?.terminal.kind === "forbidden-zone-hit") {
    removeGeodesic(input.registry, input.geodesicId);
    return [];
  }
  updateGeodesicIntersectionObjects(input.registry);
  return getGeodesicSegments(input.registry, input.geodesicId);
}

function resolveCannonSnappedToEmitter(input: RebuildGeodesicToLengthInput): GeodesicCannonObject | undefined {
  if (!(input.totalLengthMeters > 0) || !Number.isFinite(input.totalLengthMeters)) {
    return undefined;
  }

  const direction = directionFromYaw(input.cannon.aimYawRadians);
  const start = addVec3(
    getGeodesicCannonEmitterPoint(input.cannon),
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

function getGeodesicCannonEmitterPoint(cannon: GeodesicCannonObject): Vec3 {
  return {
    x: cannon.localPose.translation.x,
    y: cannon.localPose.translation.y,
    z: cannon.localPose.translation.z + geodesicRayBeamHeightMeters,
  };
}

function canObjectAttachGeodesics(object: RuntimeWorldObject | undefined): object is RuntimeWorldObject {
  return object !== undefined &&
    (object.kind === "geodesic-cannon" || ("canAttachGeodesics" in object && object.canAttachGeodesics === true));
}

function getAnchorBeamPoint(anchor: RuntimeWorldObject): Vec3 {
  return anchor.kind === "geodesic-cannon"
    ? getGeodesicCannonEmitterPoint(anchor)
    : anchor.localPose.translation;
}

function getOppositeEndRole(role: GeodesicEndRole): GeodesicEndRole {
  return role === "start" ? "end" : "start";
}

function removeUnusedFreeGeodesicEnds(registry: RuntimeObjectRegistry): void {
  for (const object of registry.getAll()) {
    if (object.kind === "free-geodesic-end" && getGeodesicEndpointAttachmentsForAnchor(registry, object.id).length === 0) {
      registry.remove(object.id);
    }
  }
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

  const adjustedTailLengthMeters = request.totalLengthMeters -
    rebuilt.slice(0, -1).reduce((total, segment) => total + segment.lengthMeters, 0);
  if (adjustedTailLengthMeters < minGeodesicSegmentLengthMeters - intersectionTolerance) {
    removeGeodesicSegments(request.registry, request.geodesicId);
    return [];
  }

  request.registry.update({
    ...tail,
    lengthMeters: adjustedTailLengthMeters,
    terminal: { kind: "emitter-hit", emitterId: request.incomingEmitterId },
    connectionState: "connected",
  });
  markGeodesicConnected(request.registry, request.geodesicId, source.id, request.incomingEmitterId);
  updateGeodesicIntersectionObjects(request.registry);
  return getGeodesicSegments(request.registry, request.geodesicId);
}

export function rebuildConnectedGeodesicBetweenEmitters(
  request: RebuildConnectedGeodesicBetweenEmittersRequest,
): readonly GeodesicSegmentObject[] {
  const connection = getGeodesicConnection(request.registry, request.geodesicId);
  if (connection?.state !== "connected" || !connection.incomingEmitterId) {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }

  const source = request.registry.get(connection.outgoingEmitterId);
  const incoming = request.registry.get(connection.incomingEmitterId);
  if (source?.kind !== "geodesic-cannon" || incoming?.kind !== "geodesic-cannon") {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }

  if (source.id === incoming.id) {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }

  const sourcePoint = getGeodesicCannonEmitterPoint(source);
  const carriedPlan = request.carriedEmitterId
    ? resolveCarriedConnectedGeodesicPlan({
        world: request.world,
        registry: request.registry,
        geodesicId: request.geodesicId,
        source,
        incoming,
        carriedEmitterId: request.carriedEmitterId,
        carriedEmitterBeforeMove: request.carriedEmitterBeforeMove,
        carriedEmitterPortalTransition: request.carriedEmitterPortalTransition,
        carriedPortalWord: request.carriedPortalWord,
      })
    : undefined;
  if (request.carriedEmitterId && !carriedPlan) {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }
  const incomingPointInSourceCell = carriedPlan?.incomingPointInSourceCell ?? unfoldIncomingEmitterPointToSourceCell({
    world: request.world,
    registry: request.registry,
    geodesicId: request.geodesicId,
    sourceCellId: source.cellId,
    incoming,
  });
  if (!incomingPointInSourceCell) {
    return getGeodesicSegments(request.registry, request.geodesicId);
  }

  const dx = incomingPointInSourceCell.x - sourcePoint.x;
  const dy = incomingPointInSourceCell.y - sourcePoint.y;
  const centerDistanceMeters = Math.hypot(dx, dy);
  const totalLengthMeters = centerDistanceMeters - geodesicRayBeamStartOffsetMeters;
  if (totalLengthMeters < minGeodesicSegmentLengthMeters - intersectionTolerance) {
    if (request.carriedEmitterId) {
      return getGeodesicSegments(request.registry, request.geodesicId);
    }

    removeGeodesic(request.registry, request.geodesicId);
    return [];
  }

  const nextYaw = sanitizeYaw(Math.atan2(dy, dx));
  const sourceWithYaw = {
    ...source,
    aimYawRadians: nextYaw,
    localPose: yawRigidTransform3(nextYaw, source.localPose.translation),
    activeGeodesicId: request.geodesicId,
    geodesicEmitterYawRadiansById: {
      ...source.geodesicEmitterYawRadiansById,
      [request.geodesicId]: nextYaw,
    },
  };

  const direction = directionFromYaw(nextYaw);
  const traces = traceGeodesicPathForConnectionMode({
    connectEmitters: false,
    world: request.world,
    registry: request.registry,
    geodesicId: request.geodesicId,
    sourceEmitterId: sourceWithYaw.id,
    cellId: sourceWithYaw.cellId,
    start: addVec3(getGeodesicCannonEmitterPoint(sourceWithYaw), scaleVec3(direction, geodesicRayBeamStartOffsetMeters)),
    direction,
    maxLengthMeters: totalLengthMeters,
  });
  if (traces.some((trace) => trace.terminal.kind === "forbidden-zone-hit")) {
    removeGeodesic(request.registry, request.geodesicId);
    return [];
  }

  const rebuilt = replaceConnectedGeodesicSegments({
    registry: request.registry,
    source: sourceWithYaw,
    incomingEmitterId: incoming.id,
    geodesicId: request.geodesicId,
    totalLengthMeters,
    traces,
  });
  return rebuilt ?? getGeodesicSegments(request.registry, request.geodesicId);
}

export function tieAndDetachIncidentGeodesics(
  request: TieAndDetachIncidentGeodesicsRequest,
): readonly GeodesicSegmentObject[] {
  const detached = request.registry.get(request.emitterId);
  if (detached?.kind !== "geodesic-cannon") {
    return [];
  }

  const selectableGeodesicIds = collectLockedIncidentGeodesicIdsForEmitter(request.registry, detached.id)
    .filter((geodesicId) => !isGeodesicStraightening(request.registry, geodesicId));
  const incidentGeodesicIds = request.incidentGeodesicIds ?? (
    selectableGeodesicIds.length === 2 ? [selectableGeodesicIds[0], selectableGeodesicIds[1]] : undefined
  );
  if (
    !incidentGeodesicIds ||
    incidentGeodesicIds[0] === incidentGeodesicIds[1] ||
    !incidentGeodesicIds.every((geodesicId) => selectableGeodesicIds.includes(geodesicId))
  ) {
    return [];
  }

  const endpoints = incidentGeodesicIds
    .map((geodesicId) => resolveDetachedEndpoint(request.registry, geodesicId, detached.id));
  const first = endpoints[0];
  const second = endpoints[1];
  if (!first || !second || first.emitter.cellId !== second.emitter.cellId || first.emitter.cellId !== detached.cellId) {
    return [];
  }

  const vertex = getGeodesicCannonEmitterPoint(detached);
  const firstPoint = getGeodesicCannonEmitterPoint(first.emitter);
  const secondPoint = getGeodesicCannonEmitterPoint(second.emitter);
  if (
    distanceVec3(firstPoint, vertex) <= geodesicRayBeamStartOffsetMeters + minGeodesicSegmentLengthMeters ||
    distanceVec3(secondPoint, vertex) <= geodesicRayBeamStartOffsetMeters + minGeodesicSegmentLengthMeters
  ) {
    return [];
  }

  for (const geodesicId of incidentGeodesicIds) {
    removeGeodesic(request.registry, geodesicId);
  }
  const sourceDirection = normalizeHorizontalDirection(subVec3(vertex, firstPoint));
  const start = addVec3(firstPoint, scaleVec3(sourceDirection, geodesicRayBeamStartOffsetMeters));
  const firstHalf = createStraighteningSegment({
    id: `${request.geodesicId}:segment:0`,
    geodesicId: request.geodesicId,
    geodesicNumber: resolveGeodesicNumber(request.registry, request.geodesicId),
    segmentIndex: 0,
    cellId: first.emitter.cellId,
    start,
    end: vertex,
    terminal: { kind: "open" },
  });
  const secondHalf = createStraighteningSegment({
    id: `${request.geodesicId}:segment:1`,
    geodesicId: request.geodesicId,
    geodesicNumber: firstHalf.geodesicNumber,
    segmentIndex: 1,
    cellId: first.emitter.cellId,
    start: vertex,
    end: addVec3(secondPoint, scaleVec3(normalizeHorizontalDirection(subVec3(vertex, secondPoint)), geodesicRayBeamStartOffsetMeters)),
    terminal: { kind: "emitter-hit", emitterId: second.emitter.id },
  });

  request.registry.add(firstHalf);
  request.registry.add(secondHalf);
  markStraighteningGeodesic(request.registry, request.geodesicId, first.emitter.id, second.emitter.id);
  updateGeodesicIntersectionObjects(request.registry);
  return getGeodesicSegments(request.registry, request.geodesicId);
}

export function advanceStraighteningGeodesics(
  request: AdvanceStraighteningGeodesicsRequest,
): readonly string[] {
  if (!(request.deltaSeconds > 0)) {
    return [];
  }

  const advanced: string[] = [];
  const geodesicIds = new Set(
    request.registry.getAll()
      .filter(isGeodesicSegmentObject)
      .filter((segment) => segment.connectionState === "straightening")
      .map((segment) => segment.geodesicId),
  );

  for (const geodesicId of geodesicIds) {
    const connection = getGeodesicConnection(request.registry, geodesicId);
    if (connection?.state !== "straightening" || !connection.incomingEmitterId) {
      continue;
    }

    const segments = getGeodesicSegments(request.registry, geodesicId);
    const first = segments[0];
    const second = segments[1];
    if (!first || !second || segments.length !== 2 || first.cellId !== second.cellId) {
      removeGeodesic(request.registry, geodesicId);
      advanced.push(geodesicId);
      continue;
    }

    const start = first.start;
    const vertex = getGeodesicSegmentEnd(first);
    const end = getGeodesicSegmentEnd(second);
    const nextVertex = moveStraighteningVertex({
      start,
      vertex,
      end,
      maxStepMeters: (request.speedMetersPerSecond ?? geodesicStraighteningSpeedMetersPerSecond) * request.deltaSeconds,
    });
    if (!nextVertex) {
      if (straightSegmentHitsForbiddenZone(request.world, first.cellId, start, end)) {
        removeGeodesic(request.registry, geodesicId);
        advanced.push(geodesicId);
        continue;
      }
      lockStraightenedGeodesic({
        registry: request.registry,
        geodesicId,
        sourceEmitterId: connection.outgoingEmitterId,
        incomingEmitterId: connection.incomingEmitterId,
        cellId: first.cellId,
        start,
        end,
        geodesicNumber: first.geodesicNumber,
      });
      advanced.push(geodesicId);
      continue;
    }

    const nextFirst = createStraighteningSegment({
      id: first.id,
      geodesicId,
      geodesicNumber: first.geodesicNumber,
      segmentIndex: 0,
      cellId: first.cellId,
      start,
      end: nextVertex,
      terminal: { kind: "open" },
    });
    const nextSecond = createStraighteningSegment({
      id: second.id,
      geodesicId,
      geodesicNumber: second.geodesicNumber,
      segmentIndex: 1,
      cellId: second.cellId,
      start: nextVertex,
      end,
      terminal: second.terminal,
    });
    if (straighteningHalfHitsForbiddenZone(request.world, nextFirst) || straighteningHalfHitsForbiddenZone(request.world, nextSecond)) {
      removeGeodesic(request.registry, geodesicId);
      advanced.push(geodesicId);
      continue;
    }

    request.registry.update(nextFirst);
    request.registry.update(nextSecond);
    advanced.push(geodesicId);
  }

  if (advanced.length > 0) {
    updateGeodesicIntersectionObjects(request.registry);
  }
  return advanced;
}

export function collectGeodesicPortalWord(
  world: CompiledCellComplex,
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): readonly GeodesicPortalTraversal[] {
  const intervalWord = getGeodesicPortalWord(registry, geodesicId);
  if (intervalWord) {
    return intervalWord;
  }

  const word: GeodesicPortalTraversal[] = [];
  for (const segment of getGeodesicSegments(registry, geodesicId)) {
    if (segment.terminal.kind !== "portal-hit") {
      continue;
    }

    const portal = world.cellsById.get(segment.cellId)?.portalsById.get(segment.terminal.portalId);
    if (!portal) {
      continue;
    }

    word.push({
      sourceCellId: segment.cellId,
      sourcePortalId: portal.id,
      targetCellId: portal.targetCellId,
      targetPortalId: portal.targetPortalId,
    });
  }

  return word;
}

function resolveCarriedConnectedGeodesicPlan(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly source: GeodesicCannonObject;
  readonly incoming: GeodesicCannonObject;
  readonly carriedEmitterId: string;
  readonly carriedEmitterBeforeMove?: GeodesicCannonObject;
  readonly carriedEmitterPortalTransition?: GeodesicCarryPortalTransition;
  readonly carriedPortalWord?: readonly GeodesicPortalTraversal[];
}): { readonly incomingPointInSourceCell: Vec3 } | undefined {
  if (input.carriedEmitterId !== input.source.id && input.carriedEmitterId !== input.incoming.id) {
    return undefined;
  }

  const sourcePoint = getGeodesicCannonEmitterPoint(input.source);
  const incomingPoint = getGeodesicCannonEmitterPoint(input.incoming);
  const existingIncomingFromSource = getExistingGeodesicPortalTransform(
    input.world,
    input.registry,
    input.geodesicId,
    input.carriedPortalWord,
  );
  if (!existingIncomingFromSource) {
    return undefined;
  }

  const movedAcrossPortal = input.carriedPortalWord
    ? undefined
    : resolveExplicitCarriedEmitterPortalTransition(input);
  const incomingFromSource = movedAcrossPortal && input.carriedEmitterId === input.incoming.id
    ? composeRigidTransform3(movedAcrossPortal.transformToTarget, existingIncomingFromSource)
    : existingIncomingFromSource;

  if (input.carriedEmitterId === input.incoming.id) {
    const incomingPointInSourceCell = transformPoint3(invertRigidTransform3(incomingFromSource), incomingPoint);
    return isDrawableEndpointPair(sourcePoint, incomingPointInSourceCell)
      ? { incomingPointInSourceCell }
      : undefined;
  }

  const currentSourceFromPreviousSource = movedAcrossPortal && input.carriedEmitterId === input.source.id
    ? movedAcrossPortal.transformToTarget
    : identityRigidTransform3;
  const previousIncomingPointInPreviousSourceCell = transformPoint3(
    invertRigidTransform3(existingIncomingFromSource),
    incomingPoint,
  );
  const incomingPointInSourceCell = transformPoint3(currentSourceFromPreviousSource, previousIncomingPointInPreviousSourceCell);
  return isDrawableEndpointPair(sourcePoint, incomingPointInSourceCell)
    ? { incomingPointInSourceCell }
    : undefined;
}

function getCarriedEmitter(input: {
  readonly source: GeodesicCannonObject;
  readonly incoming: GeodesicCannonObject;
  readonly carriedEmitterId: string;
}): GeodesicCannonObject {
  return input.carriedEmitterId === input.source.id ? input.source : input.incoming;
}

function resolveExplicitCarriedEmitterPortalTransition(input: {
  readonly carriedEmitterBeforeMove?: GeodesicCannonObject;
  readonly carriedEmitterPortalTransition?: GeodesicCarryPortalTransition;
  readonly source: GeodesicCannonObject;
  readonly incoming: GeodesicCannonObject;
  readonly carriedEmitterId: string;
}): GeodesicCarryPortalTransition | undefined {
  const previous = input.carriedEmitterBeforeMove;
  const current = getCarriedEmitter(input);
  const transition = input.carriedEmitterPortalTransition;
  if (!previous || !transition) {
    return undefined;
  }

  if (
    previous.cellId !== transition.sourceCellId ||
    current.cellId !== transition.targetCellId
  ) {
    return undefined;
  }

  return transition;
}

function getExistingGeodesicPortalTransform(
  world: CompiledCellComplex,
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  portalWord: readonly GeodesicPortalTraversal[] = collectGeodesicPortalWord(world, registry, geodesicId),
): RigidTransform3 | undefined {
  let transform = identityRigidTransform3;
  for (const traversal of portalWord) {
    const portal = world.cellsById.get(traversal.sourceCellId)?.portalsById.get(traversal.sourcePortalId);
    if (!portal) {
      continue;
    }

    transform = composeRigidTransform3(portal.transformToTarget, transform);
  }

  return transform;
}

function isDrawableEndpointPair(sourcePoint: Vec3, incomingPointInSourceCell: Vec3): boolean {
  const centerDistanceMeters = Math.hypot(
    incomingPointInSourceCell.x - sourcePoint.x,
    incomingPointInSourceCell.y - sourcePoint.y,
  );
  return centerDistanceMeters - geodesicRayBeamStartOffsetMeters >= minGeodesicSegmentLengthMeters - intersectionTolerance;
}

function replaceConnectedGeodesicSegments(input: {
  readonly registry: RuntimeObjectRegistry;
  readonly source: GeodesicCannonObject;
  readonly incomingEmitterId: string;
  readonly geodesicId: string;
  readonly totalLengthMeters: number;
  readonly traces: readonly TraceGeodesicSegmentResult[];
}): readonly GeodesicSegmentObject[] | undefined {
  if (input.traces.length === 0) {
    return undefined;
  }

  const previousLengthMeters = input.traces
    .slice(0, -1)
    .reduce((total, trace) => total + trace.lengthMeters, 0);
  const adjustedTailLengthMeters = input.totalLengthMeters - previousLengthMeters;
  if (adjustedTailLengthMeters < minGeodesicSegmentLengthMeters - intersectionTolerance) {
    return undefined;
  }

  const tail = input.traces.at(-1);
  if (!tail || tail.terminal.kind !== "open") {
    return undefined;
  }

  input.registry.update(input.source);
  removeGeodesicSegments(input.registry, input.geodesicId);
  const geodesicNumber = resolveGeodesicNumber(input.registry, input.geodesicId);
  for (const [index, trace] of input.traces.entries()) {
    const isTail = index === input.traces.length - 1;
    const segment = createSegmentFromTrace({
      id: `${input.geodesicId}:segment:${index}`,
      geodesicId: input.geodesicId,
      geodesicNumber,
      segmentIndex: index,
      trace: isTail
        ? {
            ...trace,
            lengthMeters: adjustedTailLengthMeters,
            terminal: { kind: "emitter-hit", emitterId: input.incomingEmitterId },
          }
        : trace,
    });
    input.registry.add(segment);
  }

  markGeodesicConnected(input.registry, input.geodesicId, input.source.id, input.incomingEmitterId);
  updateGeodesicIntersectionObjects(input.registry);
  return getGeodesicSegments(input.registry, input.geodesicId);
}

function collectIncidentGeodesicIdsForEmitter(
  registry: RuntimeObjectRegistry,
  emitterId: string,
): readonly string[] {
  const ids = new Set<string>();
  for (const attachment of getGeodesicEndpointAttachmentsForAnchor(registry, emitterId)) {
    ids.add(attachment.geodesicId);
  }
  const emitter = registry.get(emitterId);
  if (emitter?.kind === "geodesic-cannon") {
    for (const geodesicId of emitter.geodesicIds) {
      ids.add(geodesicId);
    }
    if (emitter.activeGeodesicId) {
      ids.add(emitter.activeGeodesicId);
    }
  }

  for (const object of registry.getAll()) {
    if (object.kind !== "geodesic-cannon") {
      continue;
    }
    for (const [geodesicId, connection] of Object.entries(object.geodesicConnectionsById ?? {})) {
      if (connection.outgoingEmitterId === emitterId || connection.incomingEmitterId === emitterId) {
        ids.add(geodesicId);
      }
    }
  }

  return [...ids];
}

function resolveDetachedEndpoint(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  detachedEmitterId: string,
): { readonly emitter: GeodesicCannonObject } | undefined {
  const connection = getGeodesicConnection(registry, geodesicId);
  const otherEmitterId = connection?.outgoingEmitterId === detachedEmitterId
    ? connection.incomingEmitterId
    : connection?.incomingEmitterId === detachedEmitterId
      ? connection.outgoingEmitterId
      : undefined;
  const other = otherEmitterId ? registry.get(otherEmitterId) : undefined;
  return other?.kind === "geodesic-cannon" ? { emitter: other } : undefined;
}

function createStraighteningSegment(options: {
  readonly id: string;
  readonly geodesicId: string;
  readonly geodesicNumber?: number;
  readonly segmentIndex: number;
  readonly cellId: string;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly terminal: GeodesicSegmentTerminal;
}): GeodesicSegmentObject {
  const delta = subVec3(options.end, options.start);
  const lengthMeters = distanceVec3(options.start, options.end);
  const direction = normalizeHorizontalDirection(delta);
  return {
    id: options.id,
    kind: "geodesic-segment",
    cellId: options.cellId,
    localPose: yawRigidTransform3(Math.atan2(direction.y, direction.x), options.start),
    portalRenderable: true,
    displayHelpMessage: "A locally straight geodesic ray segment. Use the active tool to extend, measure, or select it.",
    tooltip: createGeodesicSegmentTooltip(options.geodesicNumber, "straightening"),
    geodesicId: options.geodesicId,
    geodesicNumber: options.geodesicNumber,
    segmentIndex: options.segmentIndex,
    start: options.start,
    direction,
    lengthMeters,
    terminal: options.terminal,
    connectionState: "straightening",
  };
}

function markStraighteningGeodesic(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  sourceEmitterId: string,
  incomingEmitterId: string,
): void {
  const source = registry.get(sourceEmitterId);
  const incoming = registry.get(incomingEmitterId);
  const segments = getGeodesicSegments(registry, geodesicId);
  const sourceYawRadians = segments[0]
    ? sanitizeYaw(Math.atan2(segments[0].direction.y, segments[0].direction.x))
    : undefined;
  const incomingTail = segments.at(-1);
  const incomingYawRadians = incomingTail
    ? sanitizeYaw(Math.atan2(incomingTail.direction.y, incomingTail.direction.x) + Math.PI)
    : undefined;
  if (source?.kind === "geodesic-cannon") {
    const sourcePose = sourceYawRadians === undefined
      ? source.localPose
      : yawRigidTransform3(sourceYawRadians, source.localPose.translation);
    registry.update({
      ...source,
      activeGeodesicId: geodesicId,
      aimYawRadians: sourceYawRadians ?? source.aimYawRadians,
      localPose: sourcePose,
      geodesicIds: source.geodesicIds.includes(geodesicId) ? source.geodesicIds : [...source.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: sourceYawRadians === undefined
        ? source.geodesicEmitterYawRadiansById
        : {
            ...source.geodesicEmitterYawRadiansById,
            [geodesicId]: sourceYawRadians,
          },
      geodesicConnectionsById: {
        ...source.geodesicConnectionsById,
        [geodesicId]: {
          outgoingEmitterId: sourceEmitterId,
          incomingEmitterId,
          state: "straightening",
        },
      },
    });
  }
  if (incoming?.kind === "geodesic-cannon") {
    const incomingPose = incomingYawRadians === undefined
      ? incoming.localPose
      : yawRigidTransform3(incomingYawRadians, incoming.localPose.translation);
    registry.update({
      ...incoming,
      activeGeodesicId: geodesicId,
      aimYawRadians: incomingYawRadians ?? incoming.aimYawRadians,
      localPose: incomingPose,
      geodesicIds: incoming.geodesicIds.includes(geodesicId) ? incoming.geodesicIds : [...incoming.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: incomingYawRadians === undefined
        ? incoming.geodesicEmitterYawRadiansById
        : {
            ...incoming.geodesicEmitterYawRadiansById,
            [geodesicId]: incomingYawRadians,
          },
    });
  }
}

function moveStraighteningVertex(options: {
  readonly start: Vec3;
  readonly vertex: Vec3;
  readonly end: Vec3;
  readonly maxStepMeters: number;
}): Vec3 | undefined {
  const lineDirection = normalizeHorizontalDirection(subVec3(options.end, options.start));
  const startToVertex = subVec3(options.vertex, options.start);
  const projectionMeters = startToVertex.x * lineDirection.x + startToVertex.y * lineDirection.y;
  const closest = addVec3(options.start, scaleVec3(lineDirection, projectionMeters));
  const distanceToLine = distanceVec3(closest, options.vertex);
  if (distanceToLine <= geodesicStraighteningToleranceMeters) {
    return undefined;
  }

  const towardStart = normalizeHorizontalDirection(subVec3(options.start, options.vertex));
  const towardEnd = normalizeHorizontalDirection(subVec3(options.end, options.vertex));
  const motion = normalizeHorizontalDirection(addVec3(towardStart, towardEnd));
  const stepMeters = Math.min(options.maxStepMeters, distanceToLine);
  const next = addVec3(options.vertex, scaleVec3(motion, stepMeters));
  const nextDistance = distanceVec3(closest, next);
  return nextDistance <= geodesicStraighteningToleranceMeters || nextDistance > distanceToLine
    ? undefined
    : next;
}

function straighteningHalfHitsForbiddenZone(world: CompiledCellComplex, segment: GeodesicSegmentObject): boolean {
  return straightSegmentHitsForbiddenZone(
    world,
    segment.cellId,
    segment.start,
    getGeodesicSegmentEnd(segment),
  );
}

function straightSegmentHitsForbiddenZone(
  world: CompiledCellComplex,
  cellId: string,
  start: Vec3,
  end: Vec3,
): boolean {
  const lengthMeters = distanceVec3(start, end);
  if (lengthMeters <= intersectionTolerance) {
    return false;
  }
  const trace = traceGeodesicSegment({
    world,
    cellId,
    start,
    direction: normalizeHorizontalDirection(subVec3(end, start)),
    maxLengthMeters: lengthMeters,
  });
  return trace.terminal.kind === "forbidden-zone-hit" &&
    trace.lengthMeters < lengthMeters - intersectionTolerance;
}

function lockStraightenedGeodesic(input: {
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly sourceEmitterId: string;
  readonly incomingEmitterId: string;
  readonly cellId: string;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly geodesicNumber?: number;
}): void {
  const duplicateGeodesicId = findCoincidentConnectedGeodesic(input.registry, {
    geodesicId: input.geodesicId,
    sourceEmitterId: input.sourceEmitterId,
    incomingEmitterId: input.incomingEmitterId,
    cellId: input.cellId,
    start: input.start,
    end: input.end,
  });
  if (duplicateGeodesicId) {
    removeGeodesic(input.registry, input.geodesicId);
    return;
  }

  removeGeodesicSegments(input.registry, input.geodesicId);
  const direction = normalizeHorizontalDirection(subVec3(input.end, input.start));
  input.registry.add({
    id: `${input.geodesicId}:segment:0`,
    kind: "geodesic-segment",
    cellId: input.cellId,
    localPose: yawRigidTransform3(Math.atan2(direction.y, direction.x), input.start),
    portalRenderable: true,
    tooltip: createGeodesicSegmentTooltip(input.geodesicNumber, "connected"),
    geodesicId: input.geodesicId,
    geodesicNumber: input.geodesicNumber,
    segmentIndex: 0,
    start: input.start,
    direction,
    lengthMeters: distanceVec3(input.start, input.end),
    terminal: { kind: "emitter-hit", emitterId: input.incomingEmitterId },
    connectionState: "connected",
  });
  markGeodesicConnected(input.registry, input.geodesicId, input.sourceEmitterId, input.incomingEmitterId);
}

function findCoincidentConnectedGeodesic(
  registry: RuntimeObjectRegistry,
  input: {
    readonly geodesicId: string;
    readonly sourceEmitterId: string;
    readonly incomingEmitterId: string;
    readonly cellId: string;
    readonly start: Vec3;
    readonly end: Vec3;
  },
): string | undefined {
  const candidateIds = new Set<string>();
  for (const object of registry.getAll()) {
    if (object.kind !== "geodesic-cannon") {
      continue;
    }

    for (const [geodesicId, connection] of Object.entries(object.geodesicConnectionsById ?? {})) {
      if (
        geodesicId !== input.geodesicId &&
        connection.state === "connected" &&
        sameEmitterPair(connection, input.sourceEmitterId, input.incomingEmitterId)
      ) {
        candidateIds.add(geodesicId);
      }
    }
  }

  for (const candidateId of candidateIds) {
    const segments = getGeodesicSegments(registry, candidateId);
    if (segments.length === 1 && segmentConnectsEndpoints(segments[0], input.cellId, input.start, input.end)) {
      return candidateId;
    }
  }

  return undefined;
}

function sameEmitterPair(
  connection: GeodesicEmitterConnection,
  firstEmitterId: string,
  secondEmitterId: string,
): boolean {
  return (
    connection.outgoingEmitterId === firstEmitterId &&
    connection.incomingEmitterId === secondEmitterId
  ) || (
    connection.outgoingEmitterId === secondEmitterId &&
    connection.incomingEmitterId === firstEmitterId
  );
}

function segmentConnectsEndpoints(
  segment: GeodesicSegmentObject,
  cellId: string,
  first: Vec3,
  second: Vec3,
): boolean {
  if (segment.cellId !== cellId) {
    return false;
  }

  const segmentEnd = getGeodesicSegmentEnd(segment);
  const toleranceSquared = geodesicStraighteningToleranceMeters * geodesicStraighteningToleranceMeters;
  return (
    distanceSquared(segment.start, first) <= toleranceSquared &&
    distanceSquared(segmentEnd, second) <= toleranceSquared
  ) || (
    distanceSquared(segment.start, second) <= toleranceSquared &&
    distanceSquared(segmentEnd, first) <= toleranceSquared
  );
}

function unfoldIncomingEmitterPointToSourceCell(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly sourceCellId: string;
  readonly incoming: GeodesicCannonObject;
}): Vec3 | undefined {
  if (input.incoming.cellId === input.sourceCellId) {
    return getGeodesicCannonEmitterPoint(input.incoming);
  }

  const transforms = getExistingPortalTransformsTowardCell({
    world: input.world,
    registry: input.registry,
    geodesicId: input.geodesicId,
    targetCellId: input.incoming.cellId,
  });
  if (!transforms) {
    return undefined;
  }

  let point = getGeodesicCannonEmitterPoint(input.incoming);
  for (const transform of transforms.slice().reverse()) {
    point = transformPoint3(invertRigidTransform3(transform), point);
  }
  return point;
}

function getExistingPortalTransformsTowardCell(input: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly targetCellId: string;
}): readonly RigidTransform3[] | undefined {
  const transforms: RigidTransform3[] = [];

  for (const segment of getGeodesicSegments(input.registry, input.geodesicId)) {
    if (segment.terminal.kind !== "portal-hit") {
      continue;
    }

    const cell = input.world.cellsById.get(segment.cellId);
    const portal = cell?.portalsById.get(segment.terminal.portalId);
    if (!portal) {
      return undefined;
    }

    transforms.push(portal.transformToTarget);
    if (segment.terminal.targetCellId === input.targetCellId) {
      return transforms;
    }
  }

  return undefined;
}

export function placeGeodesicCannonOnGeodesic(
  request: PlaceGeodesicCannonOnGeodesicRequest,
): PlaceGeodesicCannonResult {
  const segment = request.registry.get(request.segmentId);
  if (segment?.kind !== "geodesic-segment" || segment.geodesicId !== request.geodesicId) {
    return { placed: false, reason: "missing-cell" };
  }

  const clampedDistance = Math.min(segment.lengthMeters, Math.max(0, request.distanceAlongSegmentMeters));
  if (!canConnectGeodesicSegmentAtDistance(clampedDistance)) {
    return { placed: false, reason: "cell-collision" };
  }
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

  const split = splitGeodesicIntervalAtSegmentHit({
    world: request.world,
    registry: request.registry,
    geodesicId: request.geodesicId,
    segmentId: request.segmentId,
    distanceAlongSegmentMeters: clampedDistance,
    placedEmitterId: result.object.id,
    createContinuationGeodesicId: (sourceGeodesicId) => `${sourceGeodesicId}:continuation:${result.object?.id ?? request.id}`,
  });
  if (split.length === 0) {
    request.registry.remove(result.object.id);
    return { placed: false, reason: "cell-collision" };
  }

  const placed = request.registry.get(result.object.id);
  return placed?.kind === "geodesic-cannon" ? { placed: true, object: placed } : result;
}

export function placeGeodesicCannonAtGeodesicVertex(
  request: PlaceGeodesicCannonAtGeodesicVertexRequest,
): PlaceGeodesicCannonResult {
  const connectedSegments = findSegmentsPassingThroughVertex(
    request.registry,
    request.cellId,
    request.vertexPoint,
  );
  if (connectedSegments.length === 0) {
    return { placed: false, reason: "missing-cell" };
  }

  const floorPoint = { x: request.vertexPoint.x, y: request.vertexPoint.y, z: 0 };
  const result = placeGeodesicCannonAtFloorPoint({
    world: request.world,
    registry: request.registry,
    cellId: request.cellId,
    floorPoint,
    aimYawRadians: request.aimYawRadians,
    id: request.id,
  });
  if (!result.placed || !result.object) {
    return result;
  }

  const originalSegmentsByGeodesicId = new Map<string, readonly GeodesicSegmentObject[]>();
  for (const match of connectedSegments) {
    if (!originalSegmentsByGeodesicId.has(match.segment.geodesicId)) {
      originalSegmentsByGeodesicId.set(
        match.segment.geodesicId,
        getGeodesicSegments(request.registry, match.segment.geodesicId),
      );
    }
  }

  let continuationSideIndex = 0;
  for (const match of connectedSegments) {
    const originalSegments = originalSegmentsByGeodesicId.get(match.segment.geodesicId) ?? [];
    const totalLengthMeters = totalLengthThroughSegment(originalSegments, match.segment, match.distanceAlongSegmentMeters);
    const continuationLengthMeters = totalGeodesicLengthFromSegments(originalSegments) - totalLengthMeters;
    const continuationTerminal = originalSegments.at(-1)?.terminal;
    const shouldCreateContinuation = continuationLengthMeters >=
      geodesicRayBeamStartOffsetMeters + minGeodesicSegmentLengthMeters - intersectionTolerance;

    connectGeodesicToEmitter({
      world: request.world,
      registry: request.registry,
      geodesicId: match.segment.geodesicId,
      incomingEmitterId: result.object.id,
      totalLengthMeters,
    });

    if (!shouldCreateContinuation) {
      continue;
    }

    const continuationGeodesicId = request.createContinuationGeodesicId(
      match.segment.geodesicId,
      continuationSideIndex++,
    );
    const yaw = Math.atan2(match.segment.direction.y, match.segment.direction.x);
    const placed = request.registry.get(result.object.id);
    if (placed?.kind !== "geodesic-cannon") {
      break;
    }

    const continuationSource = createGeodesicCannonObject({
      ...placed,
      aimYawRadians: yaw,
      geodesicIds: placed.geodesicIds.includes(continuationGeodesicId)
        ? placed.geodesicIds
        : [...placed.geodesicIds, continuationGeodesicId],
      geodesicEmitterYawRadiansById: {
        ...placed.geodesicEmitterYawRadiansById,
        [continuationGeodesicId]: yaw,
      },
    });
    request.registry.update(continuationSource);
    const created = shootGeodesic({
      world: request.world,
      registry: request.registry,
      cannon: continuationSource,
      geodesicId: continuationGeodesicId,
      maxLengthMeters: continuationLengthMeters - geodesicRayBeamStartOffsetMeters,
    });
    if (continuationTerminal?.kind === "emitter-hit") {
      connectGeodesicToEmitter({
        world: request.world,
        registry: request.registry,
        geodesicId: continuationGeodesicId,
        incomingEmitterId: continuationTerminal.emitterId,
        totalLengthMeters: continuationLengthMeters - geodesicRayBeamStartOffsetMeters,
      });
    } else if (created.lengthMeters < minGeodesicSegmentLengthMeters - intersectionTolerance) {
      removeGeodesic(request.registry, continuationGeodesicId);
    }
  }

  updateGeodesicIntersectionObjects(request.registry);
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
  const connectionState = options.trace.terminal.kind === "emitter-hit" ? "connected" : "open";

  return {
    id: options.id,
    kind: "geodesic-segment",
    cellId: options.trace.cellId,
    localPose: yawRigidTransform3(yaw, options.trace.start),
    portalRenderable: true,
    displayHelpMessage: "A locally straight geodesic ray segment. Use the active tool to extend, measure, or select it.",
    tooltip: createGeodesicSegmentTooltip(options.geodesicNumber, connectionState),
    geodesicId: options.geodesicId,
    geodesicNumber: options.geodesicNumber,
    segmentIndex: options.segmentIndex,
    halfRole: "start",
    start: options.trace.start,
    direction: options.trace.direction,
    lengthMeters: options.trace.lengthMeters,
    terminal: options.trace.terminal,
    connectionState,
  };
}

function createGeodesicSegmentTooltip(
  geodesicNumber: number | undefined,
  connectionState: "open" | "connected" | "straightening",
): GeodesicSegmentObject["tooltip"] {
  const label = geodesicNumber === undefined ? "Geodesic" : `Geodesic G${geodesicNumber}`;
  if (connectionState === "connected" || connectionState === "straightening") {
    return {
      label,
      rangeMeters: 6,
    };
  }

  return {
    label,
    rangeMeters: 6,
  };
}

function canSplitGeodesicSegmentAtDistance(
  segment: GeodesicSegmentObject,
  distanceAlongSegmentMeters: number,
): boolean {
  return canConnectGeodesicSegmentAtDistance(distanceAlongSegmentMeters) &&
    segment.lengthMeters - distanceAlongSegmentMeters >= minGeodesicSegmentLengthMeters - intersectionTolerance;
}

function canConnectGeodesicSegmentAtDistance(distanceAlongSegmentMeters: number): boolean {
  return distanceAlongSegmentMeters >= minGeodesicSegmentLengthMeters - intersectionTolerance;
}

function findSegmentsPassingThroughVertex(
  registry: RuntimeObjectRegistry,
  cellId: string,
  vertexPoint: Vec3,
): readonly { readonly segment: GeodesicSegmentObject; readonly distanceAlongSegmentMeters: number }[] {
  return registry.getObjectsInCell(cellId)
    .filter(isGeodesicSegmentObject)
    .map((segment) => ({
      segment,
      distanceAlongSegmentMeters: distanceAlongSegment(segment, vertexPoint),
    }))
    .filter(({ segment, distanceAlongSegmentMeters }) =>
      canSplitGeodesicSegmentAtDistance(segment, distanceAlongSegmentMeters) &&
      distanceSquared(
        addVec3(segment.start, scaleVec3(segment.direction, distanceAlongSegmentMeters)),
        { x: vertexPoint.x, y: vertexPoint.y, z: segment.start.z },
      ) <= emitterConnectionToleranceMeters * emitterConnectionToleranceMeters
    )
    .sort((left, right) => left.segment.geodesicId.localeCompare(right.segment.geodesicId));
}

function distanceAlongSegment(segment: GeodesicSegmentObject, point: Vec3): number {
  const dx = point.x - segment.start.x;
  const dy = point.y - segment.start.y;
  const dz = point.z - segment.start.z;
  return dx * segment.direction.x + dy * segment.direction.y + dz * segment.direction.z;
}

function totalLengthThroughSegment(
  segments: readonly GeodesicSegmentObject[],
  targetSegment: GeodesicSegmentObject,
  distanceAlongSegmentMeters: number,
): number {
  return segments
    .filter((segment) => segment.segmentIndex < targetSegment.segmentIndex)
    .reduce((total, segment) => total + segment.lengthMeters, 0) + distanceAlongSegmentMeters;
}

function totalGeodesicLengthFromSegments(segments: readonly GeodesicSegmentObject[]): number {
  return segments.reduce((total, segment) => total + segment.lengthMeters, 0);
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
  const head = getGeodesicSegments(registry, geodesicId)[0];
  const tail = getGeodesicTail(registry, geodesicId);
  const sourceYawRadians = head
    ? sanitizeYaw(Math.atan2(head.direction.y, head.direction.x))
    : undefined;
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
        tooltip: createGeodesicSegmentTooltip(segment.geodesicNumber, "connected"),
        connectionState: "connected",
      });
    }
    return;
  }

  if (source?.kind === "geodesic-cannon") {
    const sourcePose = sourceYawRadians === undefined
      ? source.localPose
      : yawRigidTransform3(sourceYawRadians, source.localPose.translation);
    registry.update({
      ...source,
      activeGeodesicId: geodesicId,
      aimYawRadians: sourceYawRadians ?? source.aimYawRadians,
      localPose: sourcePose,
      geodesicIds: source.geodesicIds.includes(geodesicId)
        ? source.geodesicIds
        : [...source.geodesicIds, geodesicId],
      geodesicEmitterYawRadiansById: sourceYawRadians === undefined
        ? source.geodesicEmitterYawRadiansById
        : {
            ...source.geodesicEmitterYawRadiansById,
            [geodesicId]: sourceYawRadians,
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
  }

  if (incoming?.kind === "geodesic-cannon") {
    const incomingPose = incomingYawRadians === undefined
      ? incoming.localPose
      : yawRigidTransform3(incomingYawRadians, incoming.localPose.translation);
    registry.update({
      ...incoming,
      activeGeodesicId: geodesicId,
      aimYawRadians: incomingYawRadians ?? incoming.aimYawRadians,
      localPose: incomingPose,
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
      tooltip: createGeodesicSegmentTooltip(segment.geodesicNumber, "connected"),
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
      if (pointCoincidesWithGeodesicEmitter(registry, left.cellId, intersection.point)) {
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

function pointCoincidesWithGeodesicEmitter(registry: RuntimeObjectRegistry, cellId: string, point: Vec3): boolean {
  const toleranceSquared = emitterConnectionToleranceMeters * emitterConnectionToleranceMeters;
  for (const object of registry.getObjectsInCell(cellId)) {
    if (!isGeodesicCannonObject(object)) {
      continue;
    }

    const emitterPoint = {
      x: object.localPose.translation.x,
      y: object.localPose.translation.y,
      z: object.localPose.translation.z + geodesicRayBeamHeightMeters,
    };
    if (distanceSquared(point, emitterPoint) <= toleranceSquared) {
      return true;
    }
  }

  return false;
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
    displayHelpMessage: "A geodesic vertex. Use the protractor tool to select sides incident to this point.",
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
      z: left.start.z,
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
    } else if (object.kind === "geodesic-interval") {
      pushUniqueId(ids, seenIds, object.id);
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

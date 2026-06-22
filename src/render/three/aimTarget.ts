import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import { distanceVec3, dotVec3, normalizeVec3, subVec3, type Vec3 } from "../../math/vec3";
import { getDynamicObjectCollisionBounds, signedDistanceToSide, type SimpleCylinderBounds } from "../../movement/collision";
import { geodesicRayBeamHeightMeters, geodesicRayBeamStartOffsetMeters } from "../../world-objects/geodesicCannon";
import { createProtractorAngleLabelHitbox } from "../../world-objects/protractorTool";
import { runtimeObjectToDynamicObjectState, type RuntimeObjectRegistry, type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import type { VisiblePortalPath } from "./visiblePortalPaths";
import { threeDirectionToWorld, threePointToWorld, worldPointToThree } from "./worldAxes";

export type AimTargetKind = "floor" | "object";

export interface AimTarget {
  readonly kind: AimTargetKind;
  readonly cellId: string;
  readonly localEyePosition: Vec3;
  readonly localPoint: Vec3;
  readonly localNormal: Vec3;
  readonly rootPoint: Vec3;
  readonly rootNormal: Vec3;
  readonly distanceMeters: number;
  readonly portalPathId: number;
  readonly object?: RuntimeWorldObject;
  readonly geodesicSegmentDistanceMeters?: number;
  readonly geodesicEmitterGeodesicId?: string;
}

export interface ResolveAimTargetRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly camera: THREE.Camera;
  readonly visiblePortalPaths: readonly VisiblePortalPath[];
  readonly maxDistanceMeters?: number;
  readonly maxEmitterDistanceMeters?: number;
  readonly ignoredGeodesicIds?: readonly string[];
}

interface CellRay {
  readonly path: VisiblePortalPath;
  readonly origin: Vec3;
  readonly direction: Vec3;
  readonly rootFromCellMatrix: THREE.Matrix4;
}

interface ObjectAimHit {
  readonly distance: number;
  readonly normal: Vec3;
  readonly point?: Vec3;
  readonly targetPoint?: Vec3;
  readonly geodesicSegmentDistanceMeters?: number;
  readonly geodesicEmitterGeodesicId?: string;
}

const centerNdc = { x: 0, y: 0 };
const aimPointToleranceMeters = 1e-5;
const aimTargetPriorityDistanceToleranceMeters = 0.4;
const geodesicSegmentVsEmitterPriorityDistanceToleranceMeters = 3;
const fallbackObjectRadiusMeters = 0.25;
const geodesicEmitterAimCylinderRadiusPaddingMeters = 0.08;
const geodesicEmitterAimCylinderHalfHeightPaddingMeters = 0.1;
const geodesicEmitterAimSphereOffsetMeters = -0.3;
const geodesicEmitterGeodesicHandleLengthMeters = 0.65;
const geodesicEmitterGeodesicHandleRadiusMeters = 0.16 / 2.5;
const defaultMaxEmitterAimDistanceMeters = 200;
export const geodesicSegmentAimRadiusMeters = 0.28 / 1.5;

export function resolveAimTarget(request: ResolveAimTargetRequest): AimTarget | undefined {
  return resolveAimTargets(request)[0];
}

export function resolveAimTargets(request: ResolveAimTargetRequest): readonly AimTarget[] {
  const maxDistanceMeters = request.maxDistanceMeters ?? 24;
  request.camera.updateMatrixWorld(true);
  const originRootThree = new THREE.Vector3().setFromMatrixPosition(request.camera.matrixWorld);
  const directionRootThree = new THREE.Vector3(0, 0, -1);
  const cameraQuaternion = new THREE.Quaternion();
  request.camera.getWorldQuaternion(cameraQuaternion);
  directionRootThree.applyQuaternion(cameraQuaternion).normalize();

  return resolveAimTargetsFromRootThreeRay({
    world: request.world,
    registry: request.registry,
    rootOriginThree: originRootThree,
    rootDirectionThree: directionRootThree,
    ndcPoint: centerNdc,
    visiblePortalPaths: request.visiblePortalPaths,
    maxDistanceMeters,
    maxEmitterDistanceMeters: request.maxEmitterDistanceMeters ?? defaultMaxEmitterAimDistanceMeters,
    ignoredGeodesicIds: new Set(request.ignoredGeodesicIds ?? []),
  });
}

function resolveAimTargetsFromRootThreeRay(request: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly rootOriginThree: THREE.Vector3;
  readonly rootDirectionThree: THREE.Vector3;
  readonly ndcPoint: { readonly x: number; readonly y: number };
  readonly visiblePortalPaths: readonly VisiblePortalPath[];
  readonly maxDistanceMeters: number;
  readonly maxEmitterDistanceMeters: number;
  readonly ignoredGeodesicIds: ReadonlySet<string>;
}): readonly AimTarget[] {
  const rootDirectionThree = request.rootDirectionThree.clone().normalize();

  const candidates: AimTarget[] = [];

  for (const path of request.visiblePortalPaths) {
    if (!pathContainsNdcPoint(path, request.ndcPoint)) {
      continue;
    }

    const cell = request.world.cellsById.get(path.destinationCellId);
    if (!cell) {
      continue;
    }

    const ray = buildCellRayFromRootThreeRay(request.rootOriginThree, rootDirectionThree, path);
    candidates.push(
      ...resolveObjectAimTargets(
        request.registry,
        cell,
        ray,
        request.maxDistanceMeters,
        request.maxEmitterDistanceMeters,
        request.ignoredGeodesicIds,
      ),
      ...resolveFloorAimTarget(cell, ray, request.maxDistanceMeters),
    );
  }

  return candidates.sort(compareAimTargets);
}

function compareAimTargets(left: AimTarget, right: AimTarget): number {
  if (isBetterAimTarget(left, right)) {
    return -1;
  }
  if (isBetterAimTarget(right, left)) {
    return 1;
  }
  return 0;
}

function buildCellRayFromRootThreeRay(
  originRootThree: THREE.Vector3,
  directionRootThree: THREE.Vector3,
  path: VisiblePortalPath,
): CellRay {
  const cellFromRootMatrix = path.rootFromDestinationMatrix.clone().invert();
  const originCellThree = originRootThree.clone().applyMatrix4(cellFromRootMatrix);
  const directionCellThree = directionRootThree.clone().transformDirection(cellFromRootMatrix).normalize();

  return {
    path,
    origin: threePointToWorld(originCellThree),
    direction: threeDirectionToWorld(directionCellThree),
    rootFromCellMatrix: path.rootFromDestinationMatrix,
  };
}

function resolveObjectAimTargets(
  registry: RuntimeObjectRegistry,
  cell: CompiledPrismCell,
  ray: CellRay,
  maxDistanceMeters: number,
  maxEmitterDistanceMeters: number,
  ignoredGeodesicIds: ReadonlySet<string>,
): readonly AimTarget[] {
  const hits: AimTarget[] = [];

  for (const object of registry.getObjectsInCell(cell.id)) {
    if (object.kind === "protractor-angle" && !object.portalRenderable) {
      continue;
    }

    if (object.kind === "geodesic-segment" && ignoredGeodesicIds.has(object.geodesicId)) {
      continue;
    }

    if (object.kind === "geodesic-segment" && object.connectionState === "straightening") {
      continue;
    }

    const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
    const hit = object.kind === "protractor-angle"
      ? intersectRayWithProtractorAngleLabelHitbox(object, ray.origin, ray.direction)
      : object.kind === "geodesic-segment"
      ? intersectRayWithSelectableSegment(object, ray.origin, ray.direction)
      : object.kind === "geodesic-cannon"
        ? intersectRayWithGeodesicEmitterAimCylinder(ray.origin, ray.direction, object, ignoredGeodesicIds)
      : bounds
        ? intersectRayWithVerticalCylinder(ray.origin, ray.direction, bounds)
        : intersectRayWithSphere(ray.origin, ray.direction, object.localPose.translation, fallbackObjectRadiusMeters);

    const targetMaxDistanceMeters = object.kind === "geodesic-cannon" ? maxEmitterDistanceMeters : maxDistanceMeters;
    if (!hit || hit.distance > targetMaxDistanceMeters) {
      continue;
    }

    const localPoint = hit.point ?? pointOnRay(ray.origin, ray.direction, hit.distance);
    const targetLocalPoint = object.kind === "protractor-angle"
      ? hit.targetPoint ?? object.aimStickyTarget?.localPoint ?? localPoint
      : object.aimStickyTarget?.localPoint ?? hit.targetPoint ?? localPoint;
    hits.push({
      kind: "object",
      cellId: cell.id,
      localEyePosition: ray.origin,
      localPoint: targetLocalPoint,
      localNormal: hit.normal,
      rootPoint: transformCellPointToRoot(ray.rootFromCellMatrix, targetLocalPoint),
      rootNormal: transformCellDirectionToRoot(ray.rootFromCellMatrix, hit.normal),
      distanceMeters: rootDistance(ray, localPoint),
      portalPathId: ray.path.pathId,
      object,
      geodesicSegmentDistanceMeters: hit.geodesicSegmentDistanceMeters,
      geodesicEmitterGeodesicId: hit.geodesicEmitterGeodesicId,
    });
  }

  return hits;
}

function isBetterAimTarget(candidate: AimTarget, current: AimTarget): boolean {
  if (isGeodesicVsEmitterChoice(candidate, current)) {
    const distanceDelta = Math.abs(candidate.distanceMeters - current.distanceMeters);
    if (distanceDelta <= geodesicSegmentVsEmitterPriorityDistanceToleranceMeters) {
      return getAimTargetPriority(candidate) > getAimTargetPriority(current);
    }
  }

  if (candidate.distanceMeters < current.distanceMeters - aimPointToleranceMeters) {
    return true;
  }

  if (Math.abs(candidate.distanceMeters - current.distanceMeters) > aimTargetPriorityDistanceToleranceMeters) {
    return false;
  }

  return getAimTargetPriority(candidate) > getAimTargetPriority(current);
}

function isGeodesicVsEmitterChoice(left: AimTarget, right: AimTarget): boolean {
  const leftKind = left.object?.kind;
  const rightKind = right.object?.kind;
  return (isGeodesicAimObjectKind(leftKind) && rightKind === "geodesic-cannon") ||
    (leftKind === "geodesic-cannon" && isGeodesicAimObjectKind(rightKind));
}

function isGeodesicAimObjectKind(kind: RuntimeWorldObject["kind"] | undefined): boolean {
  return kind === "geodesic-segment" || kind === "geodesic-intersection";
}

function getAimTargetPriority(target: AimTarget): number {
  if (target.object?.kind === "protractor-angle") {
    return 5;
  }

  if (target.object?.kind === "geodesic-intersection") {
    return 3;
  }

  if (target.object?.kind === "geodesic-segment") {
    return 1;
  }

  if (target.object?.kind === "geodesic-cannon") {
    return 4;
  }

  return 0;
}

function intersectRayWithSelectableSegment(
  segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
  rayOrigin: Vec3,
  rayDirection: Vec3,
): ObjectAimHit | undefined {
  const hit = intersectRayWithSegmentCapsule(
    rayOrigin,
    rayDirection,
    segment.start,
    segment.direction,
    segment.lengthMeters,
  );
  if (!hit || hit.geodesicSegmentDistanceMeters === undefined) {
    return hit;
  }

  const segmentDistanceMeters = Math.min(
    segment.lengthMeters,
    Math.max(0, hit.geodesicSegmentDistanceMeters),
  );
  return {
    ...hit,
    geodesicSegmentDistanceMeters: segmentDistanceMeters,
    targetPoint: pointOnSegmentCenterline(segment.start, segment.direction, segmentDistanceMeters),
  };
}

function intersectRayWithSegmentCapsule(
  origin: Vec3,
  direction: Vec3,
  segmentStart: Vec3,
  segmentDirection: Vec3,
  segmentLengthMeters: number,
  radiusMeters = geodesicSegmentAimRadiusMeters,
): ObjectAimHit | undefined {
  if (!(segmentLengthMeters > 0)) {
    return undefined;
  }

  const lateral = normalizeVec3OrFallback({
    x: -segmentDirection.y,
    y: segmentDirection.x,
    z: 0,
  });
  const offset = subVec3(origin, segmentStart);
  const localOrigin = {
    x: dotVec3(offset, segmentDirection),
    y: dotVec3(offset, lateral),
    z: offset.z,
  };
  const localDirection = {
    x: dotVec3(direction, segmentDirection),
    y: dotVec3(direction, lateral),
    z: direction.z,
  };
  const hits: ObjectAimHit[] = [];

  pushSegmentCylinderHit(hits, localOrigin, localDirection, origin, direction, segmentStart, segmentDirection, segmentLengthMeters, radiusMeters);
  pushSegmentSphereHit(hits, localOrigin, localDirection, origin, direction, segmentStart, segmentDirection, 0, radiusMeters);
  pushSegmentSphereHit(
    hits,
    localOrigin,
    localDirection,
    origin,
    direction,
    segmentStart,
    segmentDirection,
    segmentLengthMeters,
    radiusMeters,
  );

  if (hits.length === 0) {
    return undefined;
  }

  const best = hits.reduce((currentBest, hit) => hit.distance < currentBest.distance ? hit : currentBest);
  const closestSegmentDistance = resolveClosestSegmentDistanceOnRay(
    localOrigin,
    localDirection,
    segmentLengthMeters,
  );
  const targetDistance = closestSegmentDistance ?? best.geodesicSegmentDistanceMeters;
  return targetDistance === undefined
    ? best
    : {
        ...best,
        geodesicSegmentDistanceMeters: targetDistance,
        targetPoint: pointOnSegmentCenterline(segmentStart, segmentDirection, targetDistance),
      };
}

function resolveClosestSegmentDistanceOnRay(
  localOrigin: Vec3,
  localDirection: Vec3,
  segmentLengthMeters: number,
): number | undefined {
  const lateralMagnitudeSquared = localDirection.y * localDirection.y + localDirection.z * localDirection.z;
  if (lateralMagnitudeSquared <= aimPointToleranceMeters) {
    return Math.min(segmentLengthMeters, Math.max(0, localOrigin.x));
  }

  const rayDistance = -(localOrigin.y * localDirection.y + localOrigin.z * localDirection.z) /
    lateralMagnitudeSquared;
  if (!Number.isFinite(rayDistance) || rayDistance < 0) {
    return undefined;
  }

  return Math.min(segmentLengthMeters, Math.max(0, localOrigin.x + localDirection.x * rayDistance));
}

function pushSegmentCylinderHit(
  hits: ObjectAimHit[],
  localOrigin: Vec3,
  localDirection: Vec3,
  origin: Vec3,
  direction: Vec3,
  segmentStart: Vec3,
  segmentDirection: Vec3,
  segmentLengthMeters: number,
  radiusMeters: number,
): void {
  const a = localDirection.y * localDirection.y + localDirection.z * localDirection.z;
  if (a <= aimPointToleranceMeters) {
    return;
  }

  const b = 2 * (localOrigin.y * localDirection.y + localOrigin.z * localDirection.z);
  const c = localOrigin.y * localOrigin.y + localOrigin.z * localOrigin.z - radiusMeters * radiusMeters;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return;
  }

  const root = Math.sqrt(discriminant);
  pushSegmentCylinderDistance(
    hits,
    (-b - root) / (2 * a),
    localOrigin,
    localDirection,
    origin,
    direction,
    segmentStart,
    segmentDirection,
    segmentLengthMeters,
  );
  pushSegmentCylinderDistance(
    hits,
    (-b + root) / (2 * a),
    localOrigin,
    localDirection,
    origin,
    direction,
    segmentStart,
    segmentDirection,
    segmentLengthMeters,
  );
}

function pushSegmentCylinderDistance(
  hits: ObjectAimHit[],
  distance: number,
  localOrigin: Vec3,
  localDirection: Vec3,
  origin: Vec3,
  direction: Vec3,
  segmentStart: Vec3,
  segmentDirection: Vec3,
  segmentLengthMeters: number,
): void {
  if (distance <= aimPointToleranceMeters) {
    return;
  }

  const segmentDistance = localOrigin.x + localDirection.x * distance;
  if (segmentDistance < -aimPointToleranceMeters || segmentDistance > segmentLengthMeters + aimPointToleranceMeters) {
    return;
  }

  const point = pointOnRay(origin, direction, distance);
  const centerlinePoint = pointOnSegmentCenterline(segmentStart, segmentDirection, segmentDistance);
  hits.push({
    distance,
    normal: normalizeVec3OrFallback(subVec3(point, centerlinePoint)),
    point,
    targetPoint: centerlinePoint,
    geodesicSegmentDistanceMeters: segmentDistance,
  });
}

function pushSegmentSphereHit(
  hits: ObjectAimHit[],
  localOrigin: Vec3,
  localDirection: Vec3,
  origin: Vec3,
  direction: Vec3,
  segmentStart: Vec3,
  segmentDirection: Vec3,
  segmentDistance: number,
  radiusMeters: number,
): void {
  const sphereOrigin = {
    x: localOrigin.x - segmentDistance,
    y: localOrigin.y,
    z: localOrigin.z,
  };
  const b = 2 * dotVec3(sphereOrigin, localDirection);
  const c = dotVec3(sphereOrigin, sphereOrigin) - radiusMeters * radiusMeters;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return;
  }

  const root = Math.sqrt(discriminant);
  const near = (-b - root) / 2;
  const far = (-b + root) / 2;
  const distance = near > aimPointToleranceMeters
    ? near
    : far > aimPointToleranceMeters
      ? far
      : undefined;
  if (distance === undefined) {
    return;
  }

  const point = pointOnRay(origin, direction, distance);
  const center = pointOnSegmentCenterline(segmentStart, segmentDirection, segmentDistance);
  hits.push({
    distance,
    normal: normalizeVec3OrFallback(subVec3(point, center)),
    point,
    targetPoint: center,
    geodesicSegmentDistanceMeters: segmentDistance,
  });
}

function pointOnSegmentCenterline(segmentStart: Vec3, segmentDirection: Vec3, distance: number): Vec3 {
  return {
    x: segmentStart.x + segmentDirection.x * distance,
    y: segmentStart.y + segmentDirection.y * distance,
    z: segmentStart.z + segmentDirection.z * distance,
  };
}

function resolveFloorAimTarget(
  cell: CompiledPrismCell,
  ray: CellRay,
  maxDistanceMeters: number,
): readonly AimTarget[] {
  if (ray.direction.z >= -aimPointToleranceMeters) {
    return [];
  }

  const distance = -ray.origin.z / ray.direction.z;
  if (!Number.isFinite(distance) || distance <= aimPointToleranceMeters || distance > maxDistanceMeters) {
    return [];
  }

  const localPoint = pointOnRay(ray.origin, ray.direction, distance);
  const floorPoint = { ...localPoint, z: 0 };
  if (!cellContainsPoint(cell, floorPoint) || pointIntersectsForbiddenZone(cell, floorPoint)) {
    return [];
  }

  return [{
    kind: "floor",
    cellId: cell.id,
    localEyePosition: ray.origin,
    localPoint: floorPoint,
    localNormal: { x: 0, y: 0, z: 1 },
    rootPoint: transformCellPointToRoot(ray.rootFromCellMatrix, floorPoint),
    rootNormal: transformCellDirectionToRoot(ray.rootFromCellMatrix, { x: 0, y: 0, z: 1 }),
    distanceMeters: rootDistance(ray, floorPoint),
    portalPathId: ray.path.pathId,
  }];
}

export function getGeodesicEmitterAimCylinderBounds(
  emitter: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
): SimpleCylinderBounds | undefined {
  const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(emitter));
  if (!bounds) {
    return undefined;
  }

  return {
    center: bounds.center,
    radius: (bounds.radius + geodesicEmitterAimCylinderRadiusPaddingMeters) / 2,
    halfHeight: bounds.halfHeight + geodesicEmitterAimCylinderHalfHeightPaddingMeters,
  };
}

export function getGeodesicEmitterAimSphereCenter(
  emitter: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
): Vec3 {
  return {
    x: emitter.localPose.translation.x,
    y: emitter.localPose.translation.y,
    z: emitter.localPose.translation.z + geodesicRayBeamHeightMeters + geodesicEmitterAimSphereOffsetMeters,
  };
}

function cellContainsPoint(cell: CompiledPrismCell, point: Vec3): boolean {
  return cell.sides.every((side) => signedDistanceToSide(side, point) >= -aimPointToleranceMeters);
}

function pointIntersectsForbiddenZone(cell: CompiledPrismCell, point: Vec3): boolean {
  return cell.singularityColumns.some((zone) => {
    const dz = Math.abs(point.z - zone.center.z);
    const vertical = !Number.isFinite(zone.height) || dz <= zone.height / 2;
    return vertical && distanceSquared2(point, zone.center) <= zone.radius * zone.radius;
  });
}

function intersectRayWithVerticalCylinder(
  origin: Vec3,
  direction: Vec3,
  bounds: SimpleCylinderBounds,
): ObjectAimHit | undefined {
  const hits: Array<{ readonly distance: number; readonly normal: Vec3 }> = [];
  const dx = origin.x - bounds.center.x;
  const dy = origin.y - bounds.center.y;
  const a = direction.x * direction.x + direction.y * direction.y;
  const b = 2 * (dx * direction.x + dy * direction.y);
  const c = dx * dx + dy * dy - bounds.radius * bounds.radius;

  if (Math.abs(a) > aimPointToleranceMeters) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      pushCylinderSideHit(hits, origin, direction, bounds, (-b - root) / (2 * a));
      pushCylinderSideHit(hits, origin, direction, bounds, (-b + root) / (2 * a));
    }
  }

  pushCylinderCapHit(hits, origin, direction, bounds, bounds.center.z - bounds.halfHeight);
  pushCylinderCapHit(hits, origin, direction, bounds, bounds.center.z + bounds.halfHeight);

  const positiveHits = hits.filter((hit) => hit.distance > aimPointToleranceMeters);
  return positiveHits.length > 0
    ? positiveHits.reduce((best, hit) => hit.distance < best.distance ? hit : best)
    : undefined;
}

function intersectRayWithProtractorAngleLabelHitbox(
  angle: Extract<RuntimeWorldObject, { readonly kind: "protractor-angle" }>,
  origin: Vec3,
  direction: Vec3,
): ObjectAimHit | undefined {
  const hitbox = angle.labelHitbox ?? createProtractorAngleLabelHitbox({
    centerPoint: angle.centerPoint,
    firstYawRadians: angle.first.yawRadians,
    angleRadians: angle.angleRadians,
    radiusMeters: angle.radiusMeters,
  });
  return intersectRayWithOrientedBox(origin, direction, {
    center: hitbox.center,
    yawRadians: hitbox.yawRadians,
    halfExtents: {
      x: hitbox.widthMeters / 2,
      y: hitbox.depthMeters / 2,
      z: hitbox.heightMeters / 2,
    },
  });
}

function intersectRayWithOrientedBox(
  origin: Vec3,
  direction: Vec3,
  box: {
    readonly center: Vec3;
    readonly yawRadians: number;
    readonly halfExtents: Vec3;
  },
): ObjectAimHit | undefined {
  const xAxis = { x: Math.cos(box.yawRadians), y: Math.sin(box.yawRadians), z: 0 };
  const yAxis = { x: -Math.sin(box.yawRadians), y: Math.cos(box.yawRadians), z: 0 };
  const zAxis = { x: 0, y: 0, z: 1 };
  const offset = subVec3(origin, box.center);
  const localOrigin = {
    x: dotVec3(offset, xAxis),
    y: dotVec3(offset, yAxis),
    z: dotVec3(offset, zAxis),
  };
  const localDirection = {
    x: dotVec3(direction, xAxis),
    y: dotVec3(direction, yAxis),
    z: dotVec3(direction, zAxis),
  };
  const hit = intersectLocalRayWithAxisAlignedBox(localOrigin, localDirection, box.halfExtents);
  if (!hit) {
    return undefined;
  }

  return {
    distance: hit.distance,
    normal: normalizeVec3OrFallback({
      x: xAxis.x * hit.localNormal.x + yAxis.x * hit.localNormal.y + zAxis.x * hit.localNormal.z,
      y: xAxis.y * hit.localNormal.x + yAxis.y * hit.localNormal.y + zAxis.y * hit.localNormal.z,
      z: xAxis.z * hit.localNormal.x + yAxis.z * hit.localNormal.y + zAxis.z * hit.localNormal.z,
    }),
    point: pointOnRay(origin, direction, hit.distance),
    targetPoint: box.center,
  };
}

function intersectLocalRayWithAxisAlignedBox(
  origin: Vec3,
  direction: Vec3,
  halfExtents: Vec3,
): { readonly distance: number; readonly localNormal: Vec3 } | undefined {
  let tMin = -Infinity;
  let tMax = Infinity;
  let enterNormal: Vec3 = { x: 0, y: 0, z: 1 };
  let exitNormal: Vec3 = { x: 0, y: 0, z: 1 };

  const x = updateBoxSlabInterval(tMin, tMax, enterNormal, exitNormal, origin.x, direction.x, halfExtents.x, { x: 1, y: 0, z: 0 });
  if (!x) {
    return undefined;
  }
  tMin = x.tMin;
  tMax = x.tMax;
  enterNormal = x.enterNormal;
  exitNormal = x.exitNormal;

  const y = updateBoxSlabInterval(tMin, tMax, enterNormal, exitNormal, origin.y, direction.y, halfExtents.y, { x: 0, y: 1, z: 0 });
  if (!y) {
    return undefined;
  }
  tMin = y.tMin;
  tMax = y.tMax;
  enterNormal = y.enterNormal;
  exitNormal = y.exitNormal;

  const z = updateBoxSlabInterval(tMin, tMax, enterNormal, exitNormal, origin.z, direction.z, halfExtents.z, { x: 0, y: 0, z: 1 });
  if (!z) {
    return undefined;
  }
  tMin = z.tMin;
  tMax = z.tMax;
  enterNormal = z.enterNormal;
  exitNormal = z.exitNormal;

  if (tMax <= aimPointToleranceMeters) {
    return undefined;
  }

  return tMin > aimPointToleranceMeters
    ? { distance: tMin, localNormal: enterNormal }
    : { distance: tMax, localNormal: exitNormal };
}

function updateBoxSlabInterval(
  tMin: number,
  tMax: number,
  enterNormal: Vec3,
  exitNormal: Vec3,
  origin: number,
  direction: number,
  halfExtent: number,
  axis: Vec3,
): {
  readonly tMin: number;
  readonly tMax: number;
  readonly enterNormal: Vec3;
  readonly exitNormal: Vec3;
} | undefined {
  if (Math.abs(direction) <= aimPointToleranceMeters) {
    return Math.abs(origin) <= halfExtent + aimPointToleranceMeters
      ? { tMin, tMax, enterNormal, exitNormal }
      : undefined;
  }

  const nearNormal = scaleVec3Like(axis, direction > 0 ? -1 : 1);
  const farNormal = scaleVec3Like(axis, direction > 0 ? 1 : -1);
  let near = (-halfExtent - origin) / direction;
  let far = (halfExtent - origin) / direction;
  let nextEnterNormal = nearNormal;
  let nextExitNormal = farNormal;
  if (near > far) {
    [near, far] = [far, near];
    nextEnterNormal = farNormal;
    nextExitNormal = nearNormal;
  }

  if (near > tMin) {
    tMin = near;
    enterNormal = nextEnterNormal;
  }
  if (far < tMax) {
    tMax = far;
    exitNormal = nextExitNormal;
  }

  return tMin <= tMax + aimPointToleranceMeters
    ? { tMin, tMax, enterNormal, exitNormal }
    : undefined;
}

function scaleVec3Like(vector: Vec3, scale: number): Vec3 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

function intersectRayWithGeodesicEmitterAimCylinder(
  origin: Vec3,
  direction: Vec3,
  emitter: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ignoredGeodesicIds: ReadonlySet<string>,
): ObjectAimHit | undefined {
  const bounds = getGeodesicEmitterAimCylinderBounds(emitter);
  if (!bounds) {
    return undefined;
  }

  const sphereCenter = getGeodesicEmitterAimSphereCenter(emitter);
  const cylinderHit = intersectRayWithVerticalCylinder(origin, direction, bounds);
  const sphereHit = intersectRayWithSphere(origin, direction, sphereCenter, bounds.radius);
  const emitterHit = chooseNearestHit(cylinderHit, sphereHit);
  const geodesicHit = intersectRayWithEmitterGeodesicHandles(origin, direction, emitter, ignoredGeodesicIds);
  const hit = chooseEmitterAimHit(emitterHit, geodesicHit);
  if (!hit) {
    return undefined;
  }

  return {
    ...hit,
    targetPoint: sphereCenter,
  };
}

function intersectRayWithEmitterGeodesicHandles(
  origin: Vec3,
  direction: Vec3,
  emitter: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ignoredGeodesicIds: ReadonlySet<string>,
): ObjectAimHit | undefined {
  const center = {
    x: emitter.localPose.translation.x,
    y: emitter.localPose.translation.y,
    z: emitter.localPose.translation.z + geodesicRayBeamHeightMeters,
  };
  let best: ObjectAimHit | undefined;

  for (const geodesicId of emitter.geodesicIds) {
    if (ignoredGeodesicIds.has(geodesicId)) {
      continue;
    }

    const yawRadians = emitter.geodesicEmitterYawRadiansById?.[geodesicId] ?? emitter.aimYawRadians;
    const handleStart = {
      x: center.x + Math.cos(yawRadians) * geodesicRayBeamStartOffsetMeters,
      y: center.y + Math.sin(yawRadians) * geodesicRayBeamStartOffsetMeters,
      z: center.z,
    };
    const handleDirection = {
      x: Math.cos(yawRadians),
      y: Math.sin(yawRadians),
      z: 0,
    };
    const hit = intersectRayWithSegmentCapsule(
      origin,
      direction,
      handleStart,
      handleDirection,
      geodesicEmitterGeodesicHandleLengthMeters,
      geodesicEmitterGeodesicHandleRadiusMeters,
    );
    if (!hit) {
      continue;
    }

    const withGeodesicId = {
      ...hit,
      targetPoint: center,
      geodesicEmitterGeodesicId: geodesicId,
    };
    if (!best || withGeodesicId.distance < best.distance) {
      best = withGeodesicId;
    }
  }

  return best;
}

function chooseEmitterAimHit(
  cylinderHit: ObjectAimHit | undefined,
  geodesicHit: ObjectAimHit | undefined,
): ObjectAimHit | undefined {
  if (!geodesicHit) {
    return cylinderHit;
  }

  if (!cylinderHit) {
    return geodesicHit;
  }

  return geodesicHit.distance <= cylinderHit.distance + aimTargetPriorityDistanceToleranceMeters
    ? geodesicHit
    : cylinderHit;
}

function chooseNearestHit(
  left: ObjectAimHit | undefined,
  right: ObjectAimHit | undefined,
): ObjectAimHit | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return left.distance <= right.distance ? left : right;
}

function pushCylinderSideHit(
  hits: Array<{ readonly distance: number; readonly normal: Vec3 }>,
  origin: Vec3,
  direction: Vec3,
  bounds: SimpleCylinderBounds,
  distance: number,
): void {
  if (distance <= aimPointToleranceMeters) {
    return;
  }

  const z = origin.z + direction.z * distance;
  if (Math.abs(z - bounds.center.z) <= bounds.halfHeight + aimPointToleranceMeters) {
    const point = pointOnRay(origin, direction, distance);
    hits.push({
      distance,
      normal: normalizeVec3({ x: point.x - bounds.center.x, y: point.y - bounds.center.y, z: 0 }),
    });
  }
}

function pushCylinderCapHit(
  hits: Array<{ readonly distance: number; readonly normal: Vec3 }>,
  origin: Vec3,
  direction: Vec3,
  bounds: SimpleCylinderBounds,
  capZ: number,
): void {
  if (Math.abs(direction.z) <= aimPointToleranceMeters) {
    return;
  }

  const distance = (capZ - origin.z) / direction.z;
  if (distance <= aimPointToleranceMeters) {
    return;
  }

  const point = pointOnRay(origin, direction, distance);
  if (distanceSquared2(point, bounds.center) <= bounds.radius * bounds.radius) {
    hits.push({
      distance,
      normal: { x: 0, y: 0, z: capZ < bounds.center.z ? -1 : 1 },
    });
  }
}

function intersectRayWithSphere(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  radius: number,
): ObjectAimHit | undefined {
  const offset = {
    x: origin.x - center.x,
    y: origin.y - center.y,
    z: origin.z - center.z,
  };
  const b = 2 * dotVec3(offset, direction);
  const c = dotVec3(offset, offset) - radius * radius;
  const discriminant = b * b - 4 * c;

  if (discriminant < 0) {
    return undefined;
  }

  const root = Math.sqrt(discriminant);
  const near = (-b - root) / 2;
  const far = (-b + root) / 2;

  const distance = near > aimPointToleranceMeters
    ? near
    : far > aimPointToleranceMeters
      ? far
      : undefined;
  if (distance === undefined) {
    return undefined;
  }

  const point = pointOnRay(origin, direction, distance);
  return {
    distance,
    normal: normalizeVec3({
      x: point.x - center.x,
      y: point.y - center.y,
      z: point.z - center.z,
    }),
  };
}

function pointOnRay(origin: Vec3, direction: Vec3, distance: number): Vec3 {
  return {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance,
  };
}

function transformCellPointToRoot(rootFromCellMatrix: THREE.Matrix4, point: Vec3): Vec3 {
  return threePointToWorld(worldPointToThree(point).applyMatrix4(rootFromCellMatrix));
}

function transformCellDirectionToRoot(rootFromCellMatrix: THREE.Matrix4, direction: Vec3): Vec3 {
  return normalizeVec3(threeDirectionToWorld(worldPointToThree(direction).transformDirection(rootFromCellMatrix)));
}

function rootDistance(ray: CellRay, localPoint: Vec3): number {
  const originRoot = transformCellPointToRoot(ray.rootFromCellMatrix, ray.origin);
  const pointRoot = transformCellPointToRoot(ray.rootFromCellMatrix, localPoint);
  return distanceVec3(originRoot, pointRoot);
}

function distanceSquared2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalizeVec3OrFallback(direction: Vec3): Vec3 {
  try {
    return normalizeVec3(direction);
  } catch {
    return { x: 0, y: 0, z: 1 };
  }
}

function pathContainsNdcPoint(path: VisiblePortalPath, point: { readonly x: number; readonly y: number }): boolean {
  if (
    point.x < path.clipRectNdc.minX - aimPointToleranceMeters ||
    point.x > path.clipRectNdc.maxX + aimPointToleranceMeters ||
    point.y < path.clipRectNdc.minY - aimPointToleranceMeters ||
    point.y > path.clipRectNdc.maxY + aimPointToleranceMeters
  ) {
    return false;
  }

  let inside = false;
  const polygon = path.clipPolygonNdc;
  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex++) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    if (
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    ) {
      inside = !inside;
    }
  }

  return inside || polygon.some((vertex) =>
    Math.abs(vertex.x - point.x) <= aimPointToleranceMeters &&
    Math.abs(vertex.y - point.y) <= aimPointToleranceMeters
  );
}

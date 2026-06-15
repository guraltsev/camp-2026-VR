import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import { distanceVec3, dotVec3, normalizeVec3, subVec3, type Vec3 } from "../../math/vec3";
import { getDynamicObjectCollisionBounds, signedDistanceToSide, type SimpleCylinderBounds } from "../../movement/collision";
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
}

export interface ResolveAimTargetRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly camera: THREE.Camera;
  readonly visiblePortalPaths: readonly VisiblePortalPath[];
  readonly maxDistanceMeters?: number;
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
}

const centerNdc = { x: 0, y: 0 };
const aimPointToleranceMeters = 1e-5;
const fallbackObjectRadiusMeters = 0.25;
export const geodesicSegmentAimRadiusMeters = 0.28;
export const geodesicSegmentEmitterSuppressionRadiusMeters = 1;

export function resolveAimTarget(request: ResolveAimTargetRequest): AimTarget | undefined {
  const maxDistanceMeters = request.maxDistanceMeters ?? 24;
  request.camera.updateMatrixWorld(true);
  const originRootThree = new THREE.Vector3().setFromMatrixPosition(request.camera.matrixWorld);
  const directionRootThree = new THREE.Vector3(0, 0, -1);
  const cameraQuaternion = new THREE.Quaternion();
  request.camera.getWorldQuaternion(cameraQuaternion);
  directionRootThree.applyQuaternion(cameraQuaternion).normalize();

  return resolveAimTargetFromRootThreeRay({
    world: request.world,
    registry: request.registry,
    rootOriginThree: originRootThree,
    rootDirectionThree: directionRootThree,
    ndcPoint: centerNdc,
    visiblePortalPaths: request.visiblePortalPaths,
    maxDistanceMeters,
    ignoredGeodesicIds: new Set(request.ignoredGeodesicIds ?? []),
  });
}

function resolveAimTargetFromRootThreeRay(request: {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly rootOriginThree: THREE.Vector3;
  readonly rootDirectionThree: THREE.Vector3;
  readonly ndcPoint: { readonly x: number; readonly y: number };
  readonly visiblePortalPaths: readonly VisiblePortalPath[];
  readonly maxDistanceMeters: number;
  readonly ignoredGeodesicIds: ReadonlySet<string>;
}): AimTarget | undefined {
  const rootDirectionThree = request.rootDirectionThree.clone().normalize();

  let best: AimTarget | undefined;

  for (const path of request.visiblePortalPaths) {
    if (!pathContainsNdcPoint(path, request.ndcPoint)) {
      continue;
    }

    const cell = request.world.cellsById.get(path.destinationCellId);
    if (!cell) {
      continue;
    }

    const ray = buildCellRayFromRootThreeRay(request.rootOriginThree, rootDirectionThree, path);
    const candidates = [
      ...resolveObjectAimTargets(request.registry, cell, ray, request.maxDistanceMeters, request.ignoredGeodesicIds),
      ...resolveFloorAimTarget(cell, ray, request.maxDistanceMeters),
    ];

    for (const candidate of candidates) {
      if (!best || candidate.distanceMeters < best.distanceMeters) {
        best = candidate;
      }
    }
  }

  return best;
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
  ignoredGeodesicIds: ReadonlySet<string>,
): readonly AimTarget[] {
  const hits: AimTarget[] = [];

  for (const object of registry.getObjectsInCell(cell.id)) {
    if (object.kind === "geodesic-segment" && ignoredGeodesicIds.has(object.geodesicId)) {
      continue;
    }

    const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
    const hit = object.kind === "geodesic-segment"
      ? intersectRayWithSelectableSegment(registry, object, ray.origin, ray.direction)
      : bounds
        ? intersectRayWithVerticalCylinder(ray.origin, ray.direction, bounds)
        : intersectRayWithSphere(ray.origin, ray.direction, object.localPose.translation, fallbackObjectRadiusMeters);

    if (!hit || hit.distance > maxDistanceMeters) {
      continue;
    }

    const localPoint = hit.point ?? pointOnRay(ray.origin, ray.direction, hit.distance);
    hits.push({
      kind: "object",
      cellId: cell.id,
      localEyePosition: ray.origin,
      localPoint,
      localNormal: hit.normal,
      rootPoint: transformCellPointToRoot(ray.rootFromCellMatrix, localPoint),
      rootNormal: transformCellDirectionToRoot(ray.rootFromCellMatrix, hit.normal),
      distanceMeters: rootDistance(ray, localPoint),
      portalPathId: ray.path.pathId,
      object,
    });
  }

  return hits;
}

function intersectRayWithSelectableSegment(
  registry: RuntimeObjectRegistry,
  segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
  rayOrigin: Vec3,
  rayDirection: Vec3,
): ObjectAimHit | undefined {
  const selectableStartMeters = getSelectableSegmentStartMeters(registry, segment);
  if (selectableStartMeters >= segment.lengthMeters - aimPointToleranceMeters) {
    return undefined;
  }

  const clippedStart = pointOnSegmentCenterline(segment.start, segment.direction, selectableStartMeters);
  return intersectRayWithSegmentCapsule(
    rayOrigin,
    rayDirection,
    clippedStart,
    segment.direction,
    segment.lengthMeters - selectableStartMeters,
  );
}

function getSelectableSegmentStartMeters(
  registry: RuntimeObjectRegistry,
  segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
): number {
  const cannon = registry.getObjectsInCell(segment.cellId).find((object) =>
    object.kind === "geodesic-cannon" && object.geodesicIds.includes(segment.geodesicId)
  );
  if (!cannon) {
    return 0;
  }

  return getSegmentExitDistanceFromEmitterSuppressionRadius(segment, cannon.localPose.translation);
}

function getSegmentExitDistanceFromEmitterSuppressionRadius(
  segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
  emitterPoint: Vec3,
): number {
  const startOffsetX = segment.start.x - emitterPoint.x;
  const startOffsetY = segment.start.y - emitterPoint.y;
  const radius = geodesicSegmentEmitterSuppressionRadiusMeters;
  const startDistanceSquared = startOffsetX * startOffsetX + startOffsetY * startOffsetY;
  if (startDistanceSquared > radius * radius) {
    return 0;
  }

  const a = segment.direction.x * segment.direction.x + segment.direction.y * segment.direction.y;
  if (a <= aimPointToleranceMeters) {
    return 0;
  }

  const b = 2 * (startOffsetX * segment.direction.x + startOffsetY * segment.direction.y);
  const c = startDistanceSquared - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) {
    return 0;
  }

  const exitDistance = (-b + Math.sqrt(discriminant)) / (2 * a);
  if (!Number.isFinite(exitDistance) || exitDistance <= 0) {
    return 0;
  }

  return Math.min(segment.lengthMeters, exitDistance + geodesicSegmentAimRadiusMeters);
}

function intersectRayWithSegmentCapsule(
  origin: Vec3,
  direction: Vec3,
  segmentStart: Vec3,
  segmentDirection: Vec3,
  segmentLengthMeters: number,
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

  pushSegmentCylinderHit(hits, localOrigin, localDirection, origin, direction, segmentStart, segmentDirection, segmentLengthMeters);
  pushSegmentSphereHit(hits, localOrigin, localDirection, origin, direction, segmentStart, segmentDirection, 0);
  pushSegmentSphereHit(
    hits,
    localOrigin,
    localDirection,
    origin,
    direction,
    segmentStart,
    segmentDirection,
    segmentLengthMeters,
  );

  return hits.length > 0
    ? hits.reduce((best, hit) => hit.distance < best.distance ? hit : best)
    : undefined;
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
): void {
  const a = localDirection.y * localDirection.y + localDirection.z * localDirection.z;
  if (a <= aimPointToleranceMeters) {
    return;
  }

  const b = 2 * (localOrigin.y * localDirection.y + localOrigin.z * localDirection.z);
  const c = localOrigin.y * localOrigin.y + localOrigin.z * localOrigin.z -
    geodesicSegmentAimRadiusMeters * geodesicSegmentAimRadiusMeters;
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
): void {
  const sphereOrigin = {
    x: localOrigin.x - segmentDistance,
    y: localOrigin.y,
    z: localOrigin.z,
  };
  const b = 2 * dotVec3(sphereOrigin, localDirection);
  const c = dotVec3(sphereOrigin, sphereOrigin) -
    geodesicSegmentAimRadiusMeters * geodesicSegmentAimRadiusMeters;
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

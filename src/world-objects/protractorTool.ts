import { yawRigidTransform3 } from "../math/rigidTransform3";
import { dotVec3, type Vec3 } from "../math/vec3";
import {
  geodesicRayBeamHeightMeters,
  getRememberedGeodesicIntersectionObject,
  type GeodesicCannonObject,
  type GeodesicIntersectionObject,
  type GeodesicSegmentObject,
} from "./geodesicCannon";
import type { RuntimeObjectRegistry, RuntimeWorldObjectBase } from "./runtimeObjectRegistry";

export const protractorAngleRadiusMeters = 0.3;

export interface ProtractorAngleObject extends RuntimeWorldObjectBase {
  readonly kind: "protractor-angle";
  readonly centerObjectId: string;
  readonly centerPoint: Vec3;
  readonly first: ProtractorDirectedGeodesic;
  readonly second: ProtractorDirectedGeodesic;
  readonly angleRadians: number;
  readonly angleDegrees: number;
  readonly radiusMeters: number;
}

export interface ProtractorCenterSelection {
  readonly objectId: string;
  readonly cellId: string;
  readonly point: Vec3;
  readonly geodesicIds: readonly string[];
}

export interface ProtractorDirectedGeodesic {
  readonly geodesicId: string;
  readonly label?: string;
  readonly segmentId: string;
  readonly yawRadians: number;
  readonly directionSign?: 1 | -1;
}

export function resolveProtractorCenterSelection(
  object: GeodesicCannonObject | GeodesicIntersectionObject,
): ProtractorCenterSelection {
  return {
    objectId: object.id,
    cellId: object.cellId,
    point: resolveProtractorCenterPoint(object),
    geodesicIds: object.geodesicIds,
  };
}

function resolveProtractorCenterPoint(object: GeodesicCannonObject | GeodesicIntersectionObject): Vec3 {
  if (object.aimStickyTarget?.localPoint) {
    return object.aimStickyTarget.localPoint;
  }

  return {
    x: object.localPose.translation.x,
    y: object.localPose.translation.y,
    z: object.localPose.translation.z + (object.kind === "geodesic-cannon" ? geodesicRayBeamHeightMeters : 0),
  };
}

export function resolveProtractorDirectedGeodesicSelection(options: {
  readonly center: ProtractorCenterSelection;
  readonly segment: GeodesicSegmentObject;
  readonly hitPoint: Vec3;
}): ProtractorDirectedGeodesic | undefined {
  const { center, segment, hitPoint } = options;
  if (center.cellId !== segment.cellId || !center.geodesicIds.includes(segment.geodesicId)) {
    return undefined;
  }

  const centerDistance = getDistanceAlongSegment(segment, center.point);
  const clampedCenterDistance = Math.min(segment.lengthMeters, Math.max(0, centerDistance));
  const nearestPoint = getPointOnSegment(segment, clampedCenterDistance);
  if (distance2(center.point, nearestPoint) > protractorAngleRadiusMeters * protractorAngleRadiusMeters) {
    return undefined;
  }

  const hitOffset = {
    x: hitPoint.x - center.point.x,
    y: hitPoint.y - center.point.y,
    z: 0,
  };
  const hitDirectionDot = dotVec3(hitOffset, segment.direction);
  const sign = resolveSelectedSegmentDirectionSign(segment, centerDistance, hitDirectionDot);
  const yawRadians = normalizeSignedRadians(
    Math.atan2(segment.direction.y * sign, segment.direction.x * sign),
  );

  return {
    geodesicId: segment.geodesicId,
    segmentId: segment.id,
    yawRadians,
    directionSign: sign,
  };
}

export function resolveProtractorEmitterGeodesicSelection(options: {
  readonly center: ProtractorCenterSelection;
  readonly emitter: GeodesicCannonObject;
  readonly geodesicId?: string;
}): ProtractorDirectedGeodesic | undefined {
  const { center, emitter } = options;
  if (center.cellId !== emitter.cellId) {
    return undefined;
  }

  const geodesicId = options.geodesicId ??
    emitter.activeGeodesicId ??
    emitter.geodesicIds.find((candidate) => center.geodesicIds.includes(candidate));
  if (!geodesicId || !center.geodesicIds.includes(geodesicId) || !emitter.geodesicIds.includes(geodesicId)) {
    return undefined;
  }

  return {
    geodesicId,
    segmentId: `${emitter.id}:${geodesicId}:emitter`,
    yawRadians: normalizeSignedRadians(emitter.geodesicEmitterYawRadiansById?.[geodesicId] ?? emitter.aimYawRadians),
    directionSign: 1,
  };
}

export function createProtractorAngleObject(options: {
  readonly id: string;
  readonly center: ProtractorCenterSelection;
  readonly first: ProtractorDirectedGeodesic;
  readonly second: ProtractorDirectedGeodesic;
}): ProtractorAngleObject {
  const angleRadians = normalizePositiveRadians(options.second.yawRadians - options.first.yawRadians);
  const angleDegrees = angleRadians * 180 / Math.PI;
  const label = formatProtractorAngleLabel(options.first, options.second, angleDegrees);

  return {
    id: options.id,
    kind: "protractor-angle",
    cellId: options.center.cellId,
    localPose: yawRigidTransform3(options.first.yawRadians, options.center.point),
    aimStickyTarget: {
      localPoint: options.center.point,
    },
    portalRenderable: true,
    displayHelpMessage: "A persistent angle result between two selected geodesic sides. Use the primary action to remove it.",
    tooltip: {
      label,
      rangeMeters: 3,
    },
    centerObjectId: options.center.objectId,
    centerPoint: options.center.point,
    first: options.first,
    second: options.second,
    angleRadians,
    angleDegrees,
    radiusMeters: protractorAngleRadiusMeters,
  };
}

export function refreshProtractorAngleObject(options: {
  readonly registry: RuntimeObjectRegistry;
  readonly angle: ProtractorAngleObject;
}): ProtractorAngleObject | undefined {
  const centerObject = options.registry.get(options.angle.centerObjectId);
  if (centerObject?.kind !== "geodesic-cannon" && centerObject?.kind !== "geodesic-intersection") {
    const rememberedCenter = getRememberedGeodesicIntersectionObject(options.registry, options.angle.centerObjectId);
    return rememberedCenter ? {
      ...options.angle,
      portalRenderable: false,
    } : undefined;
  }

  const center = resolveProtractorCenterSelection(centerObject);
  const first = resolveLiveProtractorDirectedGeodesic(options.registry, center, options.angle.first);
  const second = resolveLiveProtractorDirectedGeodesic(options.registry, center, options.angle.second);
  if (!first || !second) {
    return undefined;
  }

  return createProtractorAngleObject({
    id: options.angle.id,
    center,
    first,
    second,
  });
}

export function formatProtractorAngleLabel(
  first: Pick<ProtractorDirectedGeodesic, "geodesicId" | "label">,
  second: Pick<ProtractorDirectedGeodesic, "geodesicId" | "label">,
  angleDegrees: number,
): string {
  return `${formatGeodesicLabel(first)} ∠ ${formatGeodesicLabel(second)} = ${formatDegrees(angleDegrees)}°`;
}

function getDistanceAlongSegment(segment: GeodesicSegmentObject, point: Vec3): number {
  return (point.x - segment.start.x) * segment.direction.x +
    (point.y - segment.start.y) * segment.direction.y +
    (point.z - segment.start.z) * segment.direction.z;
}

function resolveLiveProtractorDirectedGeodesic(
  registry: RuntimeObjectRegistry,
  center: ProtractorCenterSelection,
  previous: ProtractorDirectedGeodesic,
): ProtractorDirectedGeodesic | undefined {
  const emitter = resolveEmitterSelectionObject(registry, previous);
  if (emitter) {
    const selected = resolveProtractorEmitterGeodesicSelection({
      center,
      emitter,
      geodesicId: previous.geodesicId,
    });
    return selected ? { ...selected, label: previous.label } : undefined;
  }

  const segment = resolveSegmentSelectionObject(registry, center, previous);
  if (!segment) {
    return undefined;
  }

  return {
    geodesicId: segment.geodesicId,
    label: previous.label,
    segmentId: segment.id,
    yawRadians: resolveSegmentYawFromCenter(segment, center, previous),
    directionSign: resolveSegmentDirectionSign(segment, center, previous),
  };
}

function resolveEmitterSelectionObject(
  registry: RuntimeObjectRegistry,
  previous: ProtractorDirectedGeodesic,
): GeodesicCannonObject | undefined {
  const suffix = `:${previous.geodesicId}:emitter`;
  if (!previous.segmentId.endsWith(suffix)) {
    return undefined;
  }

  const object = registry.get(previous.segmentId.slice(0, -suffix.length));
  return object?.kind === "geodesic-cannon" ? object : undefined;
}

function resolveSegmentSelectionObject(
  registry: RuntimeObjectRegistry,
  center: ProtractorCenterSelection,
  previous: ProtractorDirectedGeodesic,
): GeodesicSegmentObject | undefined {
  const current = registry.get(previous.segmentId);
  if (current?.kind === "geodesic-segment" && segmentCanAnchorProtractorSelection(center, current)) {
    return current;
  }

  return registry.getAll()
    .filter((object): object is GeodesicSegmentObject => object.kind === "geodesic-segment")
    .filter((segment) => segment.geodesicId === previous.geodesicId && segmentCanAnchorProtractorSelection(center, segment))
    .sort((left, right) =>
      Math.abs(getDistanceAlongSegment(left, center.point)) -
      Math.abs(getDistanceAlongSegment(right, center.point))
    )[0];
}

function segmentCanAnchorProtractorSelection(
  center: ProtractorCenterSelection,
  segment: GeodesicSegmentObject,
): boolean {
  if (center.cellId !== segment.cellId || !center.geodesicIds.includes(segment.geodesicId)) {
    return false;
  }

  const centerDistance = getDistanceAlongSegment(segment, center.point);
  const clampedCenterDistance = Math.min(segment.lengthMeters, Math.max(0, centerDistance));
  return distance2(center.point, getPointOnSegment(segment, clampedCenterDistance)) <=
    protractorAngleRadiusMeters * protractorAngleRadiusMeters;
}

function resolveSegmentYawFromCenter(
  segment: GeodesicSegmentObject,
  center: ProtractorCenterSelection,
  previous: ProtractorDirectedGeodesic,
): number {
  const sign = resolveSegmentDirectionSign(segment, center, previous);
  return normalizeSignedRadians(Math.atan2(segment.direction.y * sign, segment.direction.x * sign));
}

function resolveSegmentDirectionSign(
  segment: GeodesicSegmentObject,
  center: ProtractorCenterSelection,
  previous: ProtractorDirectedGeodesic,
): 1 | -1 {
  if (previous.directionSign) {
    return previous.directionSign;
  }

  const centerDistance = getDistanceAlongSegment(segment, center.point);
  const endpointSign = resolveSegmentEndpointDirectionSign(segment, centerDistance);
  if (endpointSign) {
    return endpointSign;
  }

  const forwardYaw = normalizeSignedRadians(Math.atan2(segment.direction.y, segment.direction.x));
  const backwardYaw = normalizeSignedRadians(forwardYaw + Math.PI);
  return Math.abs(normalizeSignedRadians(forwardYaw - previous.yawRadians)) <=
      Math.abs(normalizeSignedRadians(backwardYaw - previous.yawRadians))
    ? 1
    : -1;
}

function resolveSelectedSegmentDirectionSign(
  segment: GeodesicSegmentObject,
  centerDistance: number,
  hitDirectionDot: number,
): 1 | -1 {
  const endpointSign = resolveSegmentEndpointDirectionSign(segment, centerDistance);
  if (endpointSign) {
    return endpointSign;
  }

  return toDirectionSign(Math.abs(hitDirectionDot) > 1e-6 ? Math.sign(hitDirectionDot) : 1);
}

function resolveSegmentEndpointDirectionSign(
  segment: GeodesicSegmentObject,
  centerDistance: number,
): 1 | -1 | undefined {
  const endpointToleranceMeters = protractorAngleRadiusMeters;
  if (centerDistance <= endpointToleranceMeters) {
    return 1;
  }
  if (centerDistance >= segment.lengthMeters - endpointToleranceMeters) {
    return -1;
  }

  return undefined;
}

function getPointOnSegment(segment: GeodesicSegmentObject, distanceMeters: number): Vec3 {
  return {
    x: segment.start.x + segment.direction.x * distanceMeters,
    y: segment.start.y + segment.direction.y * distanceMeters,
    z: segment.start.z + segment.direction.z * distanceMeters,
  };
}

function distance2(left: Vec3, right: Vec3): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function normalizePositiveRadians(radians: number): number {
  const twoPi = Math.PI * 2;
  return ((radians % twoPi) + twoPi) % twoPi;
}

function normalizeSignedRadians(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

function toDirectionSign(value: number): 1 | -1 {
  return value < 0 ? -1 : 1;
}

function formatDegrees(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatGeodesicLabel(geodesic: Pick<ProtractorDirectedGeodesic, "geodesicId" | "label">): string {
  return geodesic.label ?? geodesic.geodesicId;
}

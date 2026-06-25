import { yawRigidTransform3 } from "../math/rigidTransform3";
import { dotVec3, type Vec3 } from "../math/vec3";
import {
  getGeodesicEndpointAttachmentsForAnchor,
  geodesicRayBeamHeightMeters,
  getRememberedGeodesicIntersectionObject,
  resolveEndpointTangentAtAnchor,
  type GeodesicEndRole,
  type GeodesicCannonObject,
  type GeodesicIntersectionObject,
  type GeodesicSegmentObject,
} from "./geodesicCannon";
import type { RuntimeObjectRegistry, RuntimeWorldObjectBase } from "./runtimeObjectRegistry";

export const protractorAngleRadiusMeters = 0.3;
export const protractorAngleLabelBadgeWidthMeters = 0.42;
export const protractorAngleLabelBadgeHeightMeters = 0.1575;
export const protractorAngleLabelVerticalOffsetMeters = 0.3;
export const protractorAngleLabelAimPaddingMeters = 0.04;
export const protractorAngleLabelAimDepthMeters = 0.12;

export interface ProtractorAngleObject extends RuntimeWorldObjectBase {
  readonly kind: "protractor-angle";
  readonly centerObjectId: string;
  readonly centerPoint: Vec3;
  readonly first: ProtractorDirectedGeodesic;
  readonly second: ProtractorDirectedGeodesic;
  readonly angleRadians: number;
  readonly angleDegrees: number;
  readonly radiusMeters: number;
  readonly labelHitbox?: ProtractorAngleLabelHitbox;
}

export interface ProtractorAngleLabelHitbox {
  readonly center: Vec3;
  readonly yawRadians: number;
  readonly widthMeters: number;
  readonly heightMeters: number;
  readonly depthMeters: number;
}

export interface ProtractorCenterSelection {
  readonly objectId: string;
  readonly cellId: string;
  readonly point: Vec3;
  readonly geodesicIds: readonly string[];
}

export interface ProtractorDirectedGeodesic {
  readonly geodesicId: string;
  readonly endRole?: GeodesicEndRole;
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
    endRole: segment.halfRole,
    segmentId: segment.id,
    yawRadians,
    directionSign: sign,
  };
}

export function resolveProtractorEmitterGeodesicSelection(options: {
  readonly center: ProtractorCenterSelection;
  readonly emitter: GeodesicCannonObject;
  readonly registry?: RuntimeObjectRegistry;
  readonly geodesicId?: string;
  readonly endRole?: GeodesicEndRole;
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

  const selectedEndRole = options.registry
    ? selectEmitterEndpointRole({
      registry: options.registry,
      emitterId: emitter.id,
      geodesicId,
      endRole: options.endRole,
    })
    : options.endRole;
  const tangent = options.registry && selectedEndRole
    ? resolveEndpointTangentAtAnchor({
      registry: options.registry,
      geodesicId,
      endRole: selectedEndRole,
    })
    : undefined;
  return {
    geodesicId,
    ...(selectedEndRole ? { endRole: selectedEndRole } : {}),
    segmentId: `${emitter.id}:${geodesicId}:emitter`,
    yawRadians: normalizeSignedRadians(tangent?.yawRadians ?? emitter.geodesicEmitterYawRadiansById?.[geodesicId] ?? emitter.aimYawRadians),
    directionSign: 1,
  };
}

export function createProtractorAngleObject(options: {
  readonly id: string;
  readonly center: ProtractorCenterSelection;
  readonly first: ProtractorDirectedGeodesic;
  readonly second: ProtractorDirectedGeodesic;
}): ProtractorAngleObject {
  if (!protractorSelectionsUseDifferentGeodesics(options.first, options.second)) {
    throw new Error("Cannot create a protractor angle from the same geodesic endpoint twice.");
  }

  const angleRadians = normalizePositiveRadians(options.second.yawRadians - options.first.yawRadians);
  const angleDegrees = angleRadians * 180 / Math.PI;
  const label = formatProtractorAngleLabel(options.first, options.second, angleDegrees);
  const labelHitbox = createProtractorAngleLabelHitbox({
    centerPoint: options.center.point,
    firstYawRadians: options.first.yawRadians,
    angleRadians,
    radiusMeters: protractorAngleRadiusMeters,
  });

  return {
    id: options.id,
    kind: "protractor-angle",
    cellId: options.center.cellId,
    localPose: yawRigidTransform3(options.first.yawRadians, options.center.point),
    aimStickyTarget: {
      localPoint: labelHitbox.center,
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
    labelHitbox,
  };
}

export function protractorSelectionsUseDifferentGeodesics(
  first: Pick<ProtractorDirectedGeodesic, "geodesicId" | "endRole">,
  second: Pick<ProtractorDirectedGeodesic, "geodesicId" | "endRole">,
): boolean {
  return first.geodesicId !== second.geodesicId || first.endRole !== second.endRole;
}

export function createProtractorAngleLabelHitbox(options: {
  readonly centerPoint: Vec3;
  readonly firstYawRadians: number;
  readonly angleRadians: number;
  readonly radiusMeters: number;
}): ProtractorAngleLabelHitbox {
  const bisectorYawRadians = normalizeSignedRadians(options.firstYawRadians + options.angleRadians / 2);
  return {
    center: {
      x: options.centerPoint.x + Math.cos(bisectorYawRadians) * options.radiusMeters,
      y: options.centerPoint.y + Math.sin(bisectorYawRadians) * options.radiusMeters,
      z: options.centerPoint.z + protractorAngleLabelVerticalOffsetMeters,
    },
    yawRadians: normalizeSignedRadians(bisectorYawRadians + Math.PI / 2),
    widthMeters: protractorAngleLabelBadgeWidthMeters + protractorAngleLabelAimPaddingMeters * 2,
    heightMeters: protractorAngleLabelBadgeHeightMeters + protractorAngleLabelAimPaddingMeters * 2,
    depthMeters: protractorAngleLabelAimDepthMeters,
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
      registry,
      geodesicId: previous.geodesicId,
      endRole: previous.endRole,
    });
    return selected ? { ...selected, label: previous.label } : undefined;
  }

  const segment = resolveSegmentSelectionObject(registry, center, previous);
  if (!segment) {
    return undefined;
  }

  return {
    geodesicId: segment.geodesicId,
    endRole: previous.endRole ?? segment.halfRole,
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

function selectEmitterEndpointRole(options: {
  readonly registry: RuntimeObjectRegistry;
  readonly emitterId: string;
  readonly geodesicId: string;
  readonly endRole?: GeodesicEndRole;
}): GeodesicEndRole | undefined {
  const attachments = getGeodesicEndpointAttachmentsForAnchor(options.registry, options.emitterId)
    .filter((attachment) => attachment.geodesicId === options.geodesicId);
  if (options.endRole && attachments.some((attachment) => attachment.role === options.endRole)) {
    return options.endRole;
  }
  return attachments[0]?.role;
}

function resolveSegmentSelectionObject(
  registry: RuntimeObjectRegistry,
  center: ProtractorCenterSelection,
  previous: ProtractorDirectedGeodesic,
): GeodesicSegmentObject | undefined {
  const current = registry.get(previous.segmentId);
  if (
    current?.kind === "geodesic-segment" &&
    (previous.endRole === undefined || current.halfRole === previous.endRole) &&
    segmentCanAnchorProtractorSelection(center, current)
  ) {
    return current;
  }

  return registry.getAll()
    .filter((object): object is GeodesicSegmentObject => object.kind === "geodesic-segment")
    .filter((segment) =>
      segment.geodesicId === previous.geodesicId &&
      (previous.endRole === undefined || segment.halfRole === previous.endRole) &&
      segmentCanAnchorProtractorSelection(center, segment)
    )
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

import { yawRigidTransform3 } from "../math/rigidTransform3";
import { dotVec3, type Vec3 } from "../math/vec3";
import type { GeodesicCannonObject, GeodesicIntersectionObject, GeodesicSegmentObject } from "./geodesicCannon";
import type { RuntimeWorldObjectBase } from "./runtimeObjectRegistry";

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
  readonly segmentId: string;
  readonly yawRadians: number;
}

export function resolveProtractorCenterSelection(
  object: GeodesicCannonObject | GeodesicIntersectionObject,
): ProtractorCenterSelection {
  return {
    objectId: object.id,
    cellId: object.cellId,
    point: object.aimStickyTarget?.localPoint ?? {
      x: object.localPose.translation.x,
      y: object.localPose.translation.y,
      z: object.localPose.translation.z,
    },
    geodesicIds: object.geodesicIds,
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
  const sign = Math.abs(hitDirectionDot) > 1e-6
    ? Math.sign(hitDirectionDot)
    : centerDistance <= 0 ? 1 : centerDistance >= segment.lengthMeters ? -1 : 1;
  const yawRadians = normalizeSignedRadians(
    Math.atan2(segment.direction.y * sign, segment.direction.x * sign),
  );

  return {
    geodesicId: segment.geodesicId,
    segmentId: segment.id,
    yawRadians,
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
  const label = `${formatDegrees(angleDegrees)} deg`;

  return {
    id: options.id,
    kind: "protractor-angle",
    cellId: options.center.cellId,
    localPose: yawRigidTransform3(options.first.yawRadians, options.center.point),
    aimStickyTarget: {
      localPoint: options.center.point,
    },
    portalRenderable: true,
    tooltip: {
      label: `Angle ${label}`,
      rangeMeters: 3,
      desktopPrompt: `Angle ${label}\nRMouse - remove`,
      xrPrompt: `Angle ${label}`,
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

function getDistanceAlongSegment(segment: GeodesicSegmentObject, point: Vec3): number {
  return (point.x - segment.start.x) * segment.direction.x +
    (point.y - segment.start.y) * segment.direction.y +
    (point.z - segment.start.z) * segment.direction.z;
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

function formatDegrees(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

import { yawRigidTransform3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";
import type { GeodesicSegmentObject } from "./geodesicCannon";
import type { RuntimeObjectRegistry, RuntimeWorldObjectBase } from "./runtimeObjectRegistry";

export interface MeasuredGeodesicLengthObject extends RuntimeWorldObjectBase {
  readonly kind: "measured-geodesic-length";
  readonly geodesicId: string;
  readonly label?: string;
  readonly lengthMeters: number;
  readonly labelPoint: Vec3;
  readonly segmentId?: string;
}

export function createMeasuredGeodesicLengthObject(options: {
  readonly id: string;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly playerCellId: string;
  readonly playerPoint: Vec3;
  readonly label?: string;
  readonly fallbackSegment?: GeodesicSegmentObject;
}): MeasuredGeodesicLengthObject | undefined {
  const segment = findClosestGeodesicSegmentInCell(
    options.registry,
    options.geodesicId,
    options.playerCellId,
    options.playerPoint,
  ) ?? options.fallbackSegment;
  if (!segment) {
    return undefined;
  }

  return createMeasuredGeodesicLengthObjectAtSegment({
    id: options.id,
    registry: options.registry,
    geodesicId: options.geodesicId,
    label: options.label,
    playerPoint: options.playerPoint,
    segment,
  });
}

export function refreshMeasuredGeodesicLengthObject(options: {
  readonly registry: RuntimeObjectRegistry;
  readonly measurement: MeasuredGeodesicLengthObject;
  readonly playerCellId: string;
  readonly playerPoint: Vec3;
}): MeasuredGeodesicLengthObject | undefined {
  const lengthMeters = getGeodesicTotalLengthMeters(options.registry, options.measurement.geodesicId);
  if (!(lengthMeters > 0)) {
    return undefined;
  }

  const closestSegment = findClosestGeodesicSegmentInCell(
    options.registry,
    options.measurement.geodesicId,
    options.playerCellId,
    options.playerPoint,
  );
  if (!closestSegment) {
    return withMeasuredGeodesicLengthTooltip({
      ...options.measurement,
      lengthMeters,
    });
  }

  return createMeasuredGeodesicLengthObjectAtSegment({
    id: options.measurement.id,
    registry: options.registry,
    geodesicId: options.measurement.geodesicId,
    label: options.measurement.label,
    playerPoint: options.playerPoint,
    segment: closestSegment,
  });
}

export function formatMeasuredGeodesicLengthLabel(
  geodesic: { readonly geodesicId: string; readonly label?: string },
  lengthMeters: number,
): string {
  return `${geodesic.label ?? geodesic.geodesicId} length = ${formatMeters(lengthMeters)}`;
}

function createMeasuredGeodesicLengthObjectAtSegment(options: {
  readonly id: string;
  readonly registry: RuntimeObjectRegistry;
  readonly geodesicId: string;
  readonly label?: string;
  readonly playerPoint: Vec3;
  readonly segment: GeodesicSegmentObject;
}): MeasuredGeodesicLengthObject {
  const distanceMeters = getDistanceAlongSegment(options.segment, options.playerPoint);
  const clampedDistanceMeters = Math.min(options.segment.lengthMeters, Math.max(0, distanceMeters));
  const labelPoint = getPointOnSegment(options.segment, clampedDistanceMeters);
  const yawRadians = resolveLabelYawFacingPoint(labelPoint, options.playerPoint, options.segment);

  return withMeasuredGeodesicLengthTooltip({
    id: options.id,
    kind: "measured-geodesic-length",
    cellId: options.segment.cellId,
    localPose: yawRigidTransform3(yawRadians, labelPoint),
    aimStickyTarget: {
      localPoint: labelPoint,
    },
    portalRenderable: true,
    geodesicId: options.geodesicId,
    label: options.label,
    lengthMeters: getGeodesicTotalLengthMeters(options.registry, options.geodesicId),
    labelPoint,
    segmentId: options.segment.id,
  });
}

function withMeasuredGeodesicLengthTooltip(
  object: Omit<MeasuredGeodesicLengthObject, "tooltip">,
): MeasuredGeodesicLengthObject {
  const label = formatMeasuredGeodesicLengthLabel(object, object.lengthMeters);
  return {
    ...object,
    tooltip: {
      label,
      rangeMeters: 3,
    },
  };
}

function findClosestGeodesicSegmentInCell(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
  cellId: string,
  point: Vec3,
): GeodesicSegmentObject | undefined {
  return registry.getAll()
    .filter((object): object is GeodesicSegmentObject =>
      object.kind === "geodesic-segment" &&
      object.geodesicId === geodesicId &&
      object.cellId === cellId
    )
    .map((segment) => ({
      segment,
      distanceSquared: distanceSquared(point, getClosestPointOnSegment(segment, point)),
    }))
    .sort((left, right) => left.distanceSquared - right.distanceSquared)[0]?.segment;
}

function getGeodesicTotalLengthMeters(registry: RuntimeObjectRegistry, geodesicId: string): number {
  return registry.getAll()
    .filter((object): object is GeodesicSegmentObject =>
      object.kind === "geodesic-segment" && object.geodesicId === geodesicId
    )
    .reduce((total, segment) => total + segment.lengthMeters, 0);
}

function getClosestPointOnSegment(segment: GeodesicSegmentObject, point: Vec3): Vec3 {
  const distanceMeters = getDistanceAlongSegment(segment, point);
  return getPointOnSegment(segment, Math.min(segment.lengthMeters, Math.max(0, distanceMeters)));
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

function resolveLabelYawFacingPoint(labelPoint: Vec3, targetPoint: Vec3, fallbackSegment: GeodesicSegmentObject): number {
  const dx = targetPoint.x - labelPoint.x;
  const dy = targetPoint.y - labelPoint.y;
  if (Math.hypot(dx, dy) > 1e-6) {
    return Math.atan2(dy, dx);
  }

  return Math.atan2(fallbackSegment.direction.y, fallbackSegment.direction.x);
}

function distanceSquared(left: Vec3, right: Vec3): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function formatMeters(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} m`;
}

import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { Vec3 } from "../math/vec3";
import {
  isGeodesicLocked,
  pruneMissingGeodesicIntersectionObjects,
  rebuildConnectedGeodesicBetweenEmitters,
  removeGeodesic,
} from "../world-objects/geodesicCannon";
import {
  refreshMeasuredGeodesicLengthObject,
  type MeasuredGeodesicLengthObject,
} from "../world-objects/measureLengthTool";
import {
  refreshProtractorAngleObject,
  type ProtractorAngleObject,
} from "../world-objects/protractorTool";
import type { RuntimeObjectRegistry, RuntimeWorldObject } from "../world-objects/runtimeObjectRegistry";

export interface GeometryCommitComputedObjectPolicyCallbacks {
  readonly removeMeasuredGeodesicLength?: (objectId: string) => void;
  readonly syncMeasuredGeodesicLength?: (object: MeasuredGeodesicLengthObject) => void;
  readonly removeProtractorAngle?: (objectId: string) => void;
  readonly syncProtractorAngle?: (object: ProtractorAngleObject) => void;
}

export interface ApplyGeometryCommitComputedObjectPolicyOptions {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly playerCellId: string;
  readonly playerPoint: Vec3;
  readonly callbacks?: GeometryCommitComputedObjectPolicyCallbacks;
}

export interface GeometryCommitComputedObjectPolicyResult {
  readonly removedGeodesicIds: readonly string[];
  readonly rebuiltGeodesicIds: readonly string[];
  readonly failedLockedGeodesicIds: readonly string[];
  readonly removedMeasuredGeodesicLengthIds: readonly string[];
  readonly refreshedMeasuredGeodesicLengthIds: readonly string[];
  readonly removedProtractorAngleIds: readonly string[];
  readonly refreshedProtractorAngleIds: readonly string[];
  readonly prunedIntersectionIds: readonly string[];
}

export function applyGeometryCommitComputedObjectPolicy(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
): GeometryCommitComputedObjectPolicyResult {
  const result = createGeometryCommitComputedObjectPolicyResultBuilder();
  const lockedGeodesicIds = collectLockedGeodesicIds(options.registry);
  const allGeodesicIds = collectAllGeodesicIds(options.registry);

  for (const geodesicId of allGeodesicIds) {
    if (lockedGeodesicIds.has(geodesicId)) {
      continue;
    }

    removeProtractorAnglesForGeodesic(options, geodesicId, result);
    removeMeasuredGeodesicLengthsForGeodesic(options, geodesicId, result);
    removeGeodesic(options.registry, geodesicId);
    result.removedGeodesicIds.add(geodesicId);
  }

  const rebuiltLockedGeodesicIds: string[] = [];
  for (const geodesicId of lockedGeodesicIds) {
    const rebuilt = rebuildConnectedGeodesicBetweenEmitters({
      world: options.world,
      registry: options.registry,
      geodesicId,
    });
    if (rebuilt.length === 0) {
      removeProtractorAnglesForGeodesic(options, geodesicId, result);
      removeMeasuredGeodesicLengthsForGeodesic(options, geodesicId, result);
      removeGeodesic(options.registry, geodesicId);
      result.failedLockedGeodesicIds.add(geodesicId);
      result.removedGeodesicIds.add(geodesicId);
      continue;
    }

    refreshMeasuredGeodesicLengthsForGeodesic(options, geodesicId, result);
    result.rebuiltGeodesicIds.add(geodesicId);
    rebuiltLockedGeodesicIds.push(geodesicId);
  }
  refreshProtractorAnglesForGeodesics(options, rebuiltLockedGeodesicIds, result);

  const prunedIntersectionIds = pruneMissingGeodesicIntersectionObjects(options.registry);
  for (const intersectionId of prunedIntersectionIds) {
    result.prunedIntersectionIds.add(intersectionId);
  }
  removeProtractorAnglesForMissingVertices(options, prunedIntersectionIds, result);

  return freezeGeometryCommitComputedObjectPolicyResult(result);
}

function collectLockedGeodesicIds(registry: RuntimeObjectRegistry): Set<string> {
  return new Set(
    [...collectAllGeodesicIds(registry)]
      .filter((geodesicId) => isGeodesicLocked(registry, geodesicId)),
  );
}

function collectAllGeodesicIds(registry: RuntimeObjectRegistry): Set<string> {
  const geodesicIds = new Set(collectCannonGeodesicIds(registry));
  for (const object of registry.getAll()) {
    if (object.kind === "geodesic-interval") {
      geodesicIds.add(object.id);
    } else if (object.kind === "geodesic-segment") {
      geodesicIds.add(object.geodesicId);
    } else if (object.kind === "measured-geodesic-length") {
      geodesicIds.add(object.geodesicId);
    } else if (object.kind === "protractor-angle") {
      geodesicIds.add(object.first.geodesicId);
      geodesicIds.add(object.second.geodesicId);
    }
  }

  return geodesicIds;
}

function collectCannonGeodesicIds(registry: RuntimeObjectRegistry): readonly string[] {
  return registry.getAll()
    .filter((object): object is Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }> =>
      object.kind === "geodesic-cannon"
    )
    .flatMap((object) => [
      ...object.geodesicIds,
      ...(object.activeGeodesicId ? [object.activeGeodesicId] : []),
      ...Object.keys(object.geodesicConnectionsById ?? {}),
    ]);
}

function removeMeasuredGeodesicLengthsForGeodesic(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  geodesicId: string,
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  for (const object of options.registry.getAll()) {
    if (object.kind === "measured-geodesic-length" && object.geodesicId === geodesicId) {
      options.registry.remove(object.id);
      options.callbacks?.removeMeasuredGeodesicLength?.(object.id);
      result.removedMeasuredGeodesicLengthIds.add(object.id);
    }
  }
}

function refreshMeasuredGeodesicLengthsForGeodesic(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  geodesicId: string,
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  for (const object of options.registry.getAll()) {
    if (object.kind !== "measured-geodesic-length" || object.geodesicId !== geodesicId) {
      continue;
    }

    refreshMeasuredGeodesicLength(options, object, result);
  }
}

function refreshMeasuredGeodesicLength(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  object: MeasuredGeodesicLengthObject,
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  const refreshed = refreshMeasuredGeodesicLengthObject({
    registry: options.registry,
    measurement: object,
    playerCellId: options.playerCellId,
    playerPoint: options.playerPoint,
  });
  if (!refreshed) {
    options.registry.remove(object.id);
    options.callbacks?.removeMeasuredGeodesicLength?.(object.id);
    result.removedMeasuredGeodesicLengthIds.add(object.id);
    return;
  }

  if (!measuredGeodesicLengthChanged(object, refreshed)) {
    return;
  }

  options.registry.update(refreshed);
  options.callbacks?.syncMeasuredGeodesicLength?.(refreshed);
  result.refreshedMeasuredGeodesicLengthIds.add(refreshed.id);
}

function measuredGeodesicLengthChanged(
  previous: MeasuredGeodesicLengthObject,
  next: MeasuredGeodesicLengthObject,
): boolean {
  return next.cellId !== previous.cellId ||
    next.lengthMeters !== previous.lengthMeters ||
    next.labelPoint.x !== previous.labelPoint.x ||
    next.labelPoint.y !== previous.labelPoint.y ||
    next.labelPoint.z !== previous.labelPoint.z ||
    next.localPose.rotation.m00 !== previous.localPose.rotation.m00 ||
    next.localPose.rotation.m10 !== previous.localPose.rotation.m10 ||
    next.segmentId !== previous.segmentId;
}

function removeProtractorAnglesForGeodesic(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  geodesicId: string,
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  for (const object of options.registry.getAll()) {
    if (
      object.kind === "protractor-angle" &&
      (object.first.geodesicId === geodesicId || object.second.geodesicId === geodesicId)
    ) {
      options.registry.remove(object.id);
      options.callbacks?.removeProtractorAngle?.(object.id);
      result.removedProtractorAngleIds.add(object.id);
    }
  }
}

function removeProtractorAnglesForMissingVertices(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  vertexIds: readonly string[],
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  if (vertexIds.length === 0) {
    return;
  }

  const missingVertexIds = new Set(vertexIds);
  for (const object of options.registry.getAll()) {
    if (object.kind === "protractor-angle" && missingVertexIds.has(object.centerObjectId)) {
      options.registry.remove(object.id);
      options.callbacks?.removeProtractorAngle?.(object.id);
      result.removedProtractorAngleIds.add(object.id);
    }
  }
}

function refreshProtractorAnglesForGeodesics(
  options: ApplyGeometryCommitComputedObjectPolicyOptions,
  geodesicIds: readonly string[],
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): void {
  const affectedGeodesicIds = new Set(geodesicIds);
  const angles = options.registry.getAll()
    .filter((object): object is ProtractorAngleObject =>
      object.kind === "protractor-angle" &&
      (affectedGeodesicIds.has(object.first.geodesicId) || affectedGeodesicIds.has(object.second.geodesicId))
    );
  for (const object of angles) {
    const refreshed = refreshProtractorAngleObject({
      registry: options.registry,
      angle: object,
    });
    if (!refreshed) {
      options.registry.remove(object.id);
      options.callbacks?.removeProtractorAngle?.(object.id);
      result.removedProtractorAngleIds.add(object.id);
      continue;
    }

    options.registry.update(refreshed);
    options.callbacks?.syncProtractorAngle?.(refreshed);
    result.refreshedProtractorAngleIds.add(refreshed.id);
  }
}

interface GeometryCommitComputedObjectPolicyResultBuilder {
  readonly removedGeodesicIds: Set<string>;
  readonly rebuiltGeodesicIds: Set<string>;
  readonly failedLockedGeodesicIds: Set<string>;
  readonly removedMeasuredGeodesicLengthIds: Set<string>;
  readonly refreshedMeasuredGeodesicLengthIds: Set<string>;
  readonly removedProtractorAngleIds: Set<string>;
  readonly refreshedProtractorAngleIds: Set<string>;
  readonly prunedIntersectionIds: Set<string>;
}

function createGeometryCommitComputedObjectPolicyResultBuilder(): GeometryCommitComputedObjectPolicyResultBuilder {
  return {
    removedGeodesicIds: new Set(),
    rebuiltGeodesicIds: new Set(),
    failedLockedGeodesicIds: new Set(),
    removedMeasuredGeodesicLengthIds: new Set(),
    refreshedMeasuredGeodesicLengthIds: new Set(),
    removedProtractorAngleIds: new Set(),
    refreshedProtractorAngleIds: new Set(),
    prunedIntersectionIds: new Set(),
  };
}

function freezeGeometryCommitComputedObjectPolicyResult(
  result: GeometryCommitComputedObjectPolicyResultBuilder,
): GeometryCommitComputedObjectPolicyResult {
  return {
    removedGeodesicIds: [...result.removedGeodesicIds],
    rebuiltGeodesicIds: [...result.rebuiltGeodesicIds],
    failedLockedGeodesicIds: [...result.failedLockedGeodesicIds],
    removedMeasuredGeodesicLengthIds: [...result.removedMeasuredGeodesicLengthIds],
    refreshedMeasuredGeodesicLengthIds: [...result.refreshedMeasuredGeodesicLengthIds],
    removedProtractorAngleIds: [...result.removedProtractorAngleIds],
    refreshedProtractorAngleIds: [...result.refreshedProtractorAngleIds],
    prunedIntersectionIds: [...result.prunedIntersectionIds],
  };
}

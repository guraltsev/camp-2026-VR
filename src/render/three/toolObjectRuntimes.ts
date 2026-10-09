/** Scene-graph runtimes for placed flags, measured lengths, and protractor angles: sync, removal, and refresh. */
import * as THREE from "three";
import { type PlayerPose } from "../../movement/playerPose";
import { refreshMeasuredGeodesicLengthObject } from "../../world-objects/measureLengthTool";
import { type ProtractorAngleObject, refreshProtractorAngleObject } from "../../world-objects/protractorTool";
import { type RuntimeObjectRegistry, type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import {
  MeasuredGeodesicLengthRuntime,
  createMeasuredGeodesicLengthRuntime,
} from "./measureLengthRenderer";
import { PlacedFlagRuntime, createPlacedFlagRuntime } from "./placedFlagRenderer";
import { PreparedWorldAssets } from "./preloadWorldAssets";
import { ProtractorAngleRuntime, createProtractorAngleRuntime } from "./protractorAngleRenderer";
import {
  RuntimeObjectRenderArchetype,
  disposeRuntimeObjectRenderArchetypes,
} from "./runtimeObjectRenderArchetypes";
import { RuntimeObjectRenderSourceMesh } from "./runtimeObjectRenderRecords";

export interface ToolObjectRuntimesDeps {
  readonly assets: PreparedWorldAssets;
  readonly runtimeObjectRegistry: RuntimeObjectRegistry;
  readonly cellMeshes: ReadonlyMap<string, THREE.Object3D>;
  readonly placedFlagRuntimes: Map<string, PlacedFlagRuntime>;
  readonly measuredGeodesicLengthRuntimes: Map<string, MeasuredGeodesicLengthRuntime>;
  readonly protractorAngleRuntimes: Map<string, ProtractorAngleRuntime>;
  readonly runtimeObjectRootsById: Map<string, THREE.Object3D>;
  readonly runtimeObjectRenderSourcesByKey: Map<string, RuntimeObjectRenderSourceMesh>;
  readonly runtimeObjectRenderArchetypesByKey: Map<string, RuntimeObjectRenderArchetype>;
  readonly runtimeObjectRenderRoot: THREE.Object3D;
  getPlayerPose(): PlayerPose;
  resetProtractorToolState(): void;
  clearProtractorToolFeedback(): void;
  syncRuntimeObjectPortalInstances(): void;
  syncSelectableHitboxDebug(): void;
}

export function createToolObjectRuntimes(deps: ToolObjectRuntimesDeps) {
  const {
    assets,
    runtimeObjectRegistry,
    cellMeshes,
    placedFlagRuntimes,
    measuredGeodesicLengthRuntimes,
    protractorAngleRuntimes,
    runtimeObjectRootsById,
    runtimeObjectRenderSourcesByKey,
    runtimeObjectRenderArchetypesByKey,
    runtimeObjectRenderRoot,
    clearProtractorToolFeedback,
    syncRuntimeObjectPortalInstances,
    syncSelectableHitboxDebug,
  } = deps;

  function syncPlacedFlagRuntime(flag: RuntimeWorldObject): void {
    if (flag.kind !== "placed-flag") {
      return;
    }

    let runtime = placedFlagRuntimes.get(flag.id);
    if (!runtime) {
      runtime = createPlacedFlagRuntime(flag, assets);
      placedFlagRuntimes.set(flag.id, runtime);
      runtimeObjectRootsById.set(flag.id, runtime.root);
    }

    runtime.syncFromObject(flag);
    runtime.syncParent(cellMeshes);
    syncRuntimeObjectPortalInstances();
  }

  function removePlacedFlagRuntime(flagId: string): void {
    const runtime = placedFlagRuntimes.get(flagId);

    if (!runtime) {
      return;
    }

    runtime.dispose();
    placedFlagRuntimes.delete(flagId);
    runtimeObjectRootsById.delete(flagId);
    for (const [key, source] of [...runtimeObjectRenderSourcesByKey]) {
      if (source.objectId === flagId) {
        runtimeObjectRenderSourcesByKey.delete(key);
      }
    }
  }

  function syncMeasuredGeodesicLengthRuntime(object: RuntimeWorldObject): void {
    if (object.kind !== "measured-geodesic-length") {
      return;
    }

    let runtime = measuredGeodesicLengthRuntimes.get(object.id);
    if (!runtime) {
      runtime = createMeasuredGeodesicLengthRuntime(object);
      measuredGeodesicLengthRuntimes.set(object.id, runtime);
    } else {
      invalidateRuntimeObjectRenderState(object.id);
    }

    runtime.syncFromObject(object);
    runtimeObjectRootsById.set(object.id, runtime.root);
    syncRuntimeObjectPortalInstances();
  }

  function removeMeasuredGeodesicLengthRuntime(objectId: string): void {
    const runtime = measuredGeodesicLengthRuntimes.get(objectId);
    if (runtime) {
      runtime.dispose();
      measuredGeodesicLengthRuntimes.delete(objectId);
    }

    runtimeObjectRootsById.delete(objectId);
    invalidateRuntimeObjectRenderState(objectId);
  }

  function syncProtractorAngleRuntime(object: RuntimeWorldObject): void {
    if (object.kind !== "protractor-angle") {
      return;
    }

    let runtime = protractorAngleRuntimes.get(object.id);
    if (!runtime) {
      runtime = createProtractorAngleRuntime(object);
      protractorAngleRuntimes.set(object.id, runtime);
    } else {
      invalidateRuntimeObjectRenderState(object.id);
    }

    runtime.syncFromObject(object);
    runtimeObjectRootsById.set(object.id, runtime.root);
    syncRuntimeObjectPortalInstances();
  }

  function removeProtractorAngleRuntime(objectId: string): void {
    const runtime = protractorAngleRuntimes.get(objectId);
    if (runtime) {
      runtime.dispose();
      protractorAngleRuntimes.delete(objectId);
    }

    runtimeObjectRootsById.delete(objectId);
    invalidateRuntimeObjectRenderState(objectId);
  }

  function invalidateRuntimeObjectRenderState(objectId: string): void {
    for (const [key, source] of [...runtimeObjectRenderSourcesByKey]) {
      if (source.objectId === objectId) {
        runtimeObjectRenderSourcesByKey.delete(key);
        const archetype = runtimeObjectRenderArchetypesByKey.get(key);
        if (archetype) {
          runtimeObjectRenderRoot.remove(archetype.mesh);
          disposeRuntimeObjectRenderArchetypes([archetype]);
          runtimeObjectRenderArchetypesByKey.delete(key);
        }
      }
    }
  }

  function removePlacedFlags(): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "placed-flag") {
        runtimeObjectRegistry.remove(object.id);
        removePlacedFlagRuntime(object.id);
      }
    }
    syncRuntimeObjectPortalInstances();
  }

  function removeMeasuredGeodesicLengths(): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "measured-geodesic-length") {
        runtimeObjectRegistry.remove(object.id);
        removeMeasuredGeodesicLengthRuntime(object.id);
      }
    }
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function removeMeasuredGeodesicLengthsForGeodesic(geodesicId: string): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "measured-geodesic-length" && object.geodesicId === geodesicId) {
        runtimeObjectRegistry.remove(object.id);
        removeMeasuredGeodesicLengthRuntime(object.id);
      }
    }
  }

  function refreshMeasuredGeodesicLengths(): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "measured-geodesic-length") {
        continue;
      }

      refreshMeasuredGeodesicLength(object);
    }
  }

  function refreshMeasuredGeodesicLengthsForGeodesic(geodesicId: string): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "measured-geodesic-length" && object.geodesicId === geodesicId) {
        refreshMeasuredGeodesicLength(object);
      }
    }
  }

  function refreshMeasuredGeodesicLength(
    object: Extract<RuntimeWorldObject, { readonly kind: "measured-geodesic-length" }>,
  ): void {
    const refreshed = refreshMeasuredGeodesicLengthObject({
      registry: runtimeObjectRegistry,
      measurement: object,
      playerCellId: deps.getPlayerPose().cellId,
      playerPoint: deps.getPlayerPose().position,
    });
    if (!refreshed) {
      runtimeObjectRegistry.remove(object.id);
      removeMeasuredGeodesicLengthRuntime(object.id);
      return;
    }

    const changed =
      refreshed.cellId !== object.cellId ||
      refreshed.lengthMeters !== object.lengthMeters ||
      refreshed.labelPoint.x !== object.labelPoint.x ||
      refreshed.labelPoint.y !== object.labelPoint.y ||
      refreshed.labelPoint.z !== object.labelPoint.z ||
      refreshed.localPose.rotation.m00 !== object.localPose.rotation.m00 ||
      refreshed.localPose.rotation.m10 !== object.localPose.rotation.m10 ||
      refreshed.segmentId !== object.segmentId;
    if (!changed) {
      return;
    }

    runtimeObjectRegistry.update(refreshed);
    syncMeasuredGeodesicLengthRuntime(refreshed);
  }

  function removeProtractorAngles(): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "protractor-angle") {
        runtimeObjectRegistry.remove(object.id);
        removeProtractorAngleRuntime(object.id);
      }
    }
    deps.resetProtractorToolState();
    clearProtractorToolFeedback();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function removeProtractorAnglesForGeodesic(geodesicId: string): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (
        object.kind === "protractor-angle" &&
        (object.first.geodesicId === geodesicId || object.second.geodesicId === geodesicId)
      ) {
        runtimeObjectRegistry.remove(object.id);
        removeProtractorAngleRuntime(object.id);
      }
    }
  }

  function removeProtractorAnglesForMissingVertices(vertexIds: readonly string[]): void {
    if (vertexIds.length === 0) {
      return;
    }

    const missingVertexIds = new Set(vertexIds);
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "protractor-angle" && missingVertexIds.has(object.centerObjectId)) {
        runtimeObjectRegistry.remove(object.id);
        removeProtractorAngleRuntime(object.id);
      }
    }
  }

  function refreshProtractorAnglesForGeodesic(geodesicId: string): void {
    refreshProtractorAnglesForGeodesics([geodesicId]);
  }

  function refreshProtractorAnglesForGeodesics(geodesicIds: readonly string[]): void {
    const affectedGeodesicIds = new Set(geodesicIds);
    const angles = runtimeObjectRegistry.getAll().filter((object): object is ProtractorAngleObject =>
      object.kind === "protractor-angle" &&
      (affectedGeodesicIds.has(object.first.geodesicId) || affectedGeodesicIds.has(object.second.geodesicId))
    );
    for (const object of angles) {
      const refreshed = refreshProtractorAngleObject({
        registry: runtimeObjectRegistry,
        angle: object,
      });
      if (!refreshed) {
        runtimeObjectRegistry.remove(object.id);
        removeProtractorAngleRuntime(object.id);
        continue;
      }

      runtimeObjectRegistry.update(refreshed);
      syncProtractorAngleRuntime(refreshed);
    }
  }

  return {
    syncPlacedFlagRuntime,
    removePlacedFlagRuntime,
    syncMeasuredGeodesicLengthRuntime,
    removeMeasuredGeodesicLengthRuntime,
    syncProtractorAngleRuntime,
    removeProtractorAngleRuntime,
    removePlacedFlags,
    removeMeasuredGeodesicLengths,
    removeMeasuredGeodesicLengthsForGeodesic,
    refreshMeasuredGeodesicLengths,
    refreshMeasuredGeodesicLengthsForGeodesic,
    removeProtractorAngles,
    removeProtractorAnglesForGeodesic,
    removeProtractorAnglesForMissingVertices,
    refreshProtractorAnglesForGeodesic,
    refreshProtractorAnglesForGeodesics,
  };
}

/** Geodesic emitter (cannon) tools: place, rotate, aim, carry, tie-and-detach, and delete geodesics. */
import type { FocusedRuntimeObject } from "./aimInteraction";
import * as THREE from "three";
import { type CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { type DebugLevelId } from "../../glue/debugLevels";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import { type Vec3, normalizeVec3 } from "../../math/vec3";
import { testCellCollision } from "../../movement/collision";
import { moveDynamicObject } from "../../movement/moveDynamicObject";
import { type PlayerPose } from "../../movement/playerPose";
import {
  type RuntimeMenuState,
  closeRuntimeMenu,
  setRuntimeMenuSelectedTool,
  showRuntimeMenuGeodesicCannonActions,
} from "../../runtime/runtimeMenuState";
import {
  type GeodesicCarryPortalTransition,
  type GeodesicEndpointSelection,
  type GeodesicPortalTraversal,
  collectGeodesicPortalWord,
  collectLockedIncidentGeodesicIdsForEmitter,
  extendGeodesic,
  getGeodesicConnection,
  getGeodesicEndpointAttachmentsForAnchor,
  hasStraighteningIncidentGeodesic,
  isGeodesicLocked,
  isGeodesicStraightening,
  placeGeodesicCannonAtFloorPoint,
  placeGeodesicCannonAtGeodesicVertex,
  placeGeodesicCannonOnGeodesic,
  pruneMissingGeodesicIntersectionObjects,
  rebuildConnectedGeodesicBetweenEmitters,
  rebuildGeodesicToLength,
  removeGeodesic,
  removeGeodesicCannonAndSegments,
  removeUnlockedGeodesicsFromCannon,
  resolveGeodesicEndpointSelectionFromSegmentHit,
  shootGeodesic,
  tieAndDetachGeodesicEndpoints,
  updateLockedGeodesicPortalWordForCarriedAnchorTraversal,
} from "../../world-objects/geodesicCannon";
import {
  type RuntimeObjectRegistry,
  type RuntimeWorldObject,
  runtimeObjectToDynamicObjectState,
} from "../../world-objects/runtimeObjectRegistry";
import { AimTarget } from "./aimTarget";
import { formatGeodesicPortalWord, reverseGeodesicPortalTraversal } from "./appDebugHelpers";
import {
  carriedGeodesicEmitterPoseToleranceMeters,
  createCarriedGeodesicCannonGlow,
  getDistanceAlongGeodesicSegment,
  resolveCannonGeodesicId,
  resolveDesktopCarriedGeodesicCannonAnchor,
  resolveGeodesicCannonAbsoluteEmitterPoint,
  resolveVrCarriedGeodesicCannonAnchor,
} from "./carriedGeodesicCannon";
import { createDesktopControls } from "./desktopControls";
import { resolveGeodesicCannonAimYawFromAbsolutePoints } from "./geodesicCannonAimTarget";
import { resolveGeodesicCarryPortalTransitionFromPortalMove } from "./geodesicCarryPortalTransition";
import {
  RootAimRay,
  getAimForwardVector,
  getRuntimeObjectInteractionRangeMeters,
  intersectRootRayWithFloor,
} from "./rootAimRay";
import { distanceSquared } from "./runtimeSceneUtils";
import { worldPointToThree } from "./worldAxes";

/** Editing state of the geodesic emitter (cannon) tools. */
export interface GeodesicCannonToolState {
  readonly selectedCannonId?: string;
  readonly activeGeodesicId?: string;
  readonly carryPortalWord?: readonly GeodesicPortalTraversal[];
  readonly carryPortalWordsByGeodesicId?: Readonly<Record<string, readonly GeodesicPortalTraversal[]>>;
  readonly carryPortalTransitionSerial?: number;
  readonly carryPortalTransitionSerialByGeodesicId?: Readonly<Record<string, number>>;
  readonly tieAndDetachEndpointSelections?: readonly GeodesicEndpointSelection[];
}

export interface GeodesicCannonToolsDeps {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: ReturnType<typeof createDesktopControls>;
  readonly runtimeObjectRegistry: RuntimeObjectRegistry;
  getWorld(): CompiledCellComplex;
  getMenuState(): RuntimeMenuState;
  setMenuState(next: RuntimeMenuState): void;
  getCannonToolState(): GeodesicCannonToolState;
  setCannonToolState(next: GeodesicCannonToolState): void;
  getPlayerPose(): PlayerPose;
  getDebugLevel(): DebugLevelId;
  getLatestPlayerPortalTransition(): GeodesicCarryPortalTransition | undefined;
  getLatestPlayerPortalTransitionSerial(): number;
  recordPlayerPortalTransition(transition: GeodesicCarryPortalTransition): void;
  resolveCurrentAimTarget(ray: RootAimRay): AimTarget | undefined;
  resolveCurrentAimTargets(ray: RootAimRay): readonly AimTarget[];
  targetIsWithinInteractionRange(target: AimTarget | undefined): boolean;
  logVerboseAimClick(target: AimTarget | undefined): void;
  findFocusedRuntimeObject(ray?: RootAimRay): FocusedRuntimeObject | undefined;
  getGeodesicLabelsById(geodesicIds: readonly string[]): Readonly<Record<string, string>>;
  syncDesktopPalette(): void;
  syncRuntimeObjectPortalInstances(): void;
  syncSelectableHitboxDebug(): void;
  refreshMeasuredGeodesicLengthsForGeodesic(geodesicId: string): void;
  removeMeasuredGeodesicLengthsForGeodesic(geodesicId: string): void;
  removeProtractorAnglesForGeodesic(geodesicId: string): void;
  removeProtractorAnglesForMissingVertices(vertexIds: readonly string[]): void;
  refreshProtractorAnglesForGeodesic(geodesicId: string): void;
  refreshProtractorAnglesForGeodesics(geodesicIds: readonly string[]): void;
}

export function createGeodesicCannonTools(deps: GeodesicCannonToolsDeps) {
  const {
    scene,
    renderer,
    controls,
    runtimeObjectRegistry,
    resolveCurrentAimTarget,
    resolveCurrentAimTargets,
    targetIsWithinInteractionRange,
    logVerboseAimClick,
    findFocusedRuntimeObject,
    getGeodesicLabelsById,
    syncDesktopPalette,
    syncRuntimeObjectPortalInstances,
    syncSelectableHitboxDebug,
    refreshMeasuredGeodesicLengthsForGeodesic,
    removeMeasuredGeodesicLengthsForGeodesic,
    removeProtractorAnglesForGeodesic,
    removeProtractorAnglesForMissingVertices,
    refreshProtractorAnglesForGeodesic,
    refreshProtractorAnglesForGeodesics,
  } = deps;
  let geodesicCannonIdCounter = 0;
  let geodesicIdCounter = 0;
  let geodesicCannonRotationHeadHeightMeters: number | undefined;
  let geodesicCannonRotationTargetLengthMeters: number | undefined;
  let carriedGeodesicCannonGlow: THREE.Mesh | undefined;

  /** Forgets the frozen head height and target length once the matching tool mode has ended. */
  function resetGeodesicCannonRotationTracking(mode: { readonly rotating: boolean; readonly aiming: boolean }): void {
    if (!mode.rotating) {
      geodesicCannonRotationHeadHeightMeters = undefined;
    }
    if (!mode.rotating && !mode.aiming) {
      geodesicCannonRotationTargetLengthMeters = undefined;
    }
  }

  function tryUseGeodesicCannonToolFromAim(ray?: RootAimRay): void {
    if (!ray) {
      return;
    }

    const target = resolveCurrentAimTarget(ray);
    if (targetIsWithinInteractionRange(target) && target?.object?.kind === "geodesic-cannon") {
      addGeodesicToCannon(target.object.id, { afterAdd: "return-to-none" });
      return;
    }

    if (target?.object?.kind === "geodesic-intersection") {
      const forward = getAimForwardVector(ray);
      if (!forward) {
        return;
      }
      let horizontalForward: { readonly x: number; readonly y: number; readonly z: number };
      try {
        horizontalForward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
      } catch {
        return;
      }
      const aimYawRadians = Math.atan2(horizontalForward.y, horizontalForward.x);
      const result = placeGeodesicCannonAtGeodesicVertex({
        world: deps.getWorld(),
        registry: runtimeObjectRegistry,
        cellId: target.object.cellId,
        vertexPoint: target.object.aimStickyTarget?.localPoint ?? target.localPoint,
        aimYawRadians,
        id: `geodesic-cannon:${Date.now()}:${geodesicCannonIdCounter++}`,
        createContinuationGeodesicId: () => `geodesic:${Date.now()}:${geodesicIdCounter++}`,
      });
      if (!result.placed || !result.object) {
        return;
      }

      deps.setCannonToolState({
        selectedCannonId: result.object.id,
        activeGeodesicId: result.object.activeGeodesicId ?? result.object.geodesicIds[0],
      });
      deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
      return;
    }

    if (target?.object?.kind === "geodesic-segment") {
      const forward = getAimForwardVector(ray);
      if (!forward) {
        return;
      }
      let horizontalForward: { readonly x: number; readonly y: number; readonly z: number };
      try {
        horizontalForward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
      } catch {
        return;
      }
      const aimYawRadians = Math.atan2(horizontalForward.y, horizontalForward.x);
      const distanceAlongSegmentMeters = target.geodesicSegmentDistanceMeters ??
        getDistanceAlongGeodesicSegment(target.object, target.localPoint);
      const result = placeGeodesicCannonOnGeodesic({
        world: deps.getWorld(),
        registry: runtimeObjectRegistry,
        geodesicId: target.object.geodesicId,
        segmentId: target.object.id,
        distanceAlongSegmentMeters,
        aimYawRadians,
        id: `geodesic-cannon:${Date.now()}:${geodesicCannonIdCounter++}`,
      });
      if (!result.placed || !result.object) {
        return;
      }

      deps.setCannonToolState({
        selectedCannonId: result.object.id,
        activeGeodesicId: target.object.geodesicId,
      });
      deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
      return;
    }

    if (target?.kind !== "floor") {
      return;
    }

    const forward = getAimForwardVector(ray);
    if (!forward) {
      return;
    }
    let horizontalForward: { readonly x: number; readonly y: number; readonly z: number };
    try {
      horizontalForward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
    } catch {
      return;
    }
    const aimYawRadians = Math.atan2(horizontalForward.y, horizontalForward.x);
    const result = placeGeodesicCannonAtFloorPoint({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      cellId: target.cellId,
      floorPoint: target.localPoint,
      aimYawRadians,
      id: `geodesic-cannon:${Date.now()}:${geodesicCannonIdCounter++}`,
    });
    if (!result.placed || !result.object) {
      return;
    }

    const geodesicId = `geodesic:${Date.now()}:${geodesicIdCounter++}`;
    shootGeodesic({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      cannon: result.object,
      geodesicId,
    });
    deps.setCannonToolState({
      selectedCannonId: result.object.id,
      activeGeodesicId: geodesicId,
    });
    deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function tryExtendFocusedGeodesicFromAim(ray?: RootAimRay): boolean {
    if (!ray) {
      return false;
    }

    const target = resolveCurrentAimTarget(ray);
    logVerboseAimClick(target);
    if (!targetIsWithinInteractionRange(target)) {
      return false;
    }

    if (target?.object?.kind !== "geodesic-segment") {
      return false;
    }
    const geodesicId = target.object.geodesicId;

    const segment = extendGeodesic({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      geodesicId,
    });
    if (!segment) {
      return false;
    }

    deps.setCannonToolState({
      selectedCannonId: deps.getCannonToolState().selectedCannonId,
      activeGeodesicId: geodesicId,
    });
    refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    return true;
  }

  function addGeodesicToCannon(
    cannonId: string,
    options: { readonly afterAdd?: "show-cannon-menu" | "return-to-none" } = {},
  ): void {
    const afterAdd = options.afterAdd ?? "show-cannon-menu";
    const cannon = runtimeObjectRegistry.get(cannonId);
    if (cannon?.kind !== "geodesic-cannon") {
      deps.setMenuState(afterAdd === "return-to-none"
        ? closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"))
        : closeRuntimeMenu(deps.getMenuState()));
      syncDesktopPalette();
      return;
    }

    const geodesicId = `geodesic:${Date.now()}:${geodesicIdCounter++}`;
    const aimYawRadians = Math.random() * Math.PI * 2 - Math.PI;
    const cannonForNewGeodesic = {
      ...cannon,
      aimYawRadians,
      localPose: yawRigidTransform3(aimYawRadians, cannon.localPose.translation),
    };
    const segment = shootGeodesic({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      cannon: cannonForNewGeodesic,
      geodesicId,
    });
    const updatedCannon = runtimeObjectRegistry.get(cannonId);
    if (updatedCannon?.kind === "geodesic-cannon") {
      deps.setCannonToolState({
        selectedCannonId: updatedCannon.id,
        activeGeodesicId: geodesicId,
      });
      deps.setMenuState(afterAdd === "return-to-none"
        ? closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"))
        : showRuntimeMenuGeodesicCannonActions(deps.getMenuState(), {
            cannonId: updatedCannon.id,
            geodesicIds: updatedCannon.geodesicIds,
            geodesicLabelsById: getGeodesicLabelsById(updatedCannon.geodesicIds),
            lockedGeodesicIds: getLockedGeodesicIds(updatedCannon.geodesicIds),
            canTieAndDetach: canTieAndDetachGeodesicsFromCannon(updatedCannon.id),
          }));
    }

    if (segment) {
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
    }
    syncDesktopPalette();
  }

  function startGeodesicCannonRotation(cannonId: string, requestedGeodesicId?: string): void {
    const object = runtimeObjectRegistry.get(cannonId);
    const cannon = object?.kind === "geodesic-cannon" ? object : undefined;
    if (cannon?.kind !== "geodesic-cannon") {
      deps.setMenuState(closeRuntimeMenu(deps.getMenuState()));
      syncDesktopPalette();
      return;
    }

    const geodesicId = resolveCannonGeodesicId(cannon, requestedGeodesicId);
    if (geodesicId && isGeodesicLocked(runtimeObjectRegistry, geodesicId)) {
      syncDesktopPalette();
      return;
    }

    const selectedCannon = geodesicId && cannon.activeGeodesicId !== geodesicId
      ? { ...cannon, activeGeodesicId: geodesicId }
      : cannon;
    if (selectedCannon !== cannon) {
      runtimeObjectRegistry.update(selectedCannon);
    }
    deps.setCannonToolState({
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
    });
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    deps.setMenuState(closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "geodesic-cannon-rotate")));
    syncDesktopPalette();
    void controls.requestPointerLock();
  }

  function startGeodesicCannonAim(cannonId: string, requestedGeodesicId?: string): void {
    const object = runtimeObjectRegistry.get(cannonId);
    const cannon = object?.kind === "geodesic-cannon" ? object : undefined;
    if (cannon?.kind !== "geodesic-cannon") {
      deps.setMenuState(closeRuntimeMenu(deps.getMenuState()));
      syncDesktopPalette();
      return;
    }

    const geodesicId = resolveCannonGeodesicId(cannon, requestedGeodesicId);
    if (geodesicId && isGeodesicLocked(runtimeObjectRegistry, geodesicId)) {
      syncDesktopPalette();
      return;
    }

    const selectedCannon = geodesicId && cannon.activeGeodesicId !== geodesicId
      ? { ...cannon, activeGeodesicId: geodesicId }
      : cannon;
    if (selectedCannon !== cannon) {
      runtimeObjectRegistry.update(selectedCannon);
    }
    deps.setCannonToolState({
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
    });
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    deps.setMenuState(closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "geodesic-cannon-aim")));
    syncDesktopPalette();
    if (!renderer.xr.isPresenting) {
      void controls.requestPointerLock();
    }
  }

  function startGeodesicCannonCarry(cannonId: string, requestedGeodesicId?: string): void {
    if (hasStraighteningIncidentGeodesic(runtimeObjectRegistry, cannonId)) {
      syncDesktopPalette();
      return;
    }

    const cannon = prepareGeodesicCannonForLift(cannonId);
    if (cannon?.kind !== "geodesic-cannon") {
      deps.setMenuState(closeRuntimeMenu(deps.getMenuState()));
      syncDesktopPalette();
      return;
    }

    const geodesicId = resolveCannonGeodesicId(cannon, requestedGeodesicId);
    const selectedCannon = geodesicId && cannon.activeGeodesicId !== geodesicId
      ? { ...cannon, activeGeodesicId: geodesicId }
      : cannon;
    if (selectedCannon !== cannon) {
      runtimeObjectRegistry.update(selectedCannon);
    }
    const lockedIncidentGeodesicIds = collectLockedIncidentGeodesicIdsForEmitter(
      runtimeObjectRegistry,
      selectedCannon.id,
    );
    const carryPortalWordsByGeodesicId = Object.fromEntries(
      lockedIncidentGeodesicIds.map((incidentGeodesicId) => [
        incidentGeodesicId,
        collectGeodesicPortalWord(deps.getWorld(), runtimeObjectRegistry, incidentGeodesicId),
      ]),
    );
    deps.setCannonToolState({
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
      carryPortalWordsByGeodesicId,
      carryPortalWord: geodesicId
        ? carryPortalWordsByGeodesicId[geodesicId] ??
          collectGeodesicPortalWord(deps.getWorld(), runtimeObjectRegistry, geodesicId)
        : undefined,
    });
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    deps.setMenuState(closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "geodesic-cannon-carry")));
    syncDesktopPalette();
    if (!renderer.xr.isPresenting) {
      void controls.requestPointerLock();
    }
  }

  function tryStartFocusedGeodesicCannonCarry(ray?: RootAimRay): boolean {
    const focused = findFocusedRuntimeObject(ray);
    if (!focused || focused.object.kind !== "geodesic-cannon") {
      return false;
    }

    if (focused.distance > getRuntimeObjectInteractionRangeMeters(focused.object)) {
      return false;
    }

    startGeodesicCannonCarry(focused.object.id, focused.object.activeGeodesicId);
    return true;
  }

  function finishGeodesicCannonCarry(): boolean {
    if (deps.getMenuState().selectedTool !== "geodesic-cannon-carry") {
      return false;
    }

    const cannonId = deps.getCannonToolState().selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;
    if (cannon?.kind === "geodesic-cannon") {
      const normalized = normalizeReleasedCarriedGeodesicCannon(cannon);
      rebuildCarriedGeodesicFromCannon(normalized.cannon, normalized.previousCannon);
      removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
    }
    deps.setCannonToolState({});
    geodesicCannonRotationTargetLengthMeters = undefined;
    deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
    clearCarriedGeodesicCannonGlow();
    syncDesktopPalette();
    return true;
  }

  function normalizeReleasedCarriedGeodesicCannon(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): {
    readonly cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>;
    readonly previousCannon?: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>;
  } {
    const moveResult = moveDynamicObject({
      world: deps.getWorld(),
      object: runtimeObjectToDynamicObjectState(cannon),
      displacement: { x: 0, y: 0, z: 0 },
      ignoreForbiddenZones: true,
    });
    if (!moveResult.crossedPortal) {
      return { cannon };
    }

    const transition = resolveGeodesicCarryPortalTransitionFromPortalMove(deps.getWorld(), cannon.cellId, {
      crossedPortal: moveResult.crossedPortal,
      crossedPortalId: moveResult.crossedPortalId,
      pose: { cellId: moveResult.object.cellId },
    });
    if (transition) {
      deps.recordPlayerPortalTransition(transition);
    }

    const nextCannon = {
      ...cannon,
      cellId: moveResult.object.cellId,
      localPose: moveResult.object.localPose,
    };
    runtimeObjectRegistry.update(nextCannon);
    return { cannon: nextCannon, previousCannon: cannon };
  }

  function deleteGeodesicFromCannon(cannonId: string, geodesicId: string): void {
    const cannon = runtimeObjectRegistry.get(cannonId);
    if (cannon?.kind !== "geodesic-cannon") {
      deps.setMenuState(closeRuntimeMenu(deps.getMenuState()));
      syncDesktopPalette();
      return;
    }

    removeProtractorAnglesForGeodesic(geodesicId);
    removeMeasuredGeodesicLengthsForGeodesic(geodesicId);
    removeGeodesic(runtimeObjectRegistry, geodesicId);
    const refreshed = runtimeObjectRegistry.get(cannonId);
    const updatedCannon = refreshed?.kind === "geodesic-cannon" ? refreshed : cannon;
    const activeGeodesicId = updatedCannon.activeGeodesicId;
    deps.setCannonToolState({
      selectedCannonId: updatedCannon.id,
      activeGeodesicId,
    });
    deps.setMenuState(showRuntimeMenuGeodesicCannonActions(deps.getMenuState(), {
      cannonId: updatedCannon.id,
      geodesicIds: updatedCannon.geodesicIds,
      geodesicLabelsById: getGeodesicLabelsById(updatedCannon.geodesicIds),
      lockedGeodesicIds: getLockedGeodesicIds(updatedCannon.geodesicIds),
      canTieAndDetach: canTieAndDetachGeodesicsFromCannon(updatedCannon.id),
    }));
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function canTieAndDetachGeodesicsFromCannon(cannonId: string): boolean {
    return getGeodesicEndpointAttachmentsForAnchor(runtimeObjectRegistry, cannonId)
      .filter((attachment) => isGeodesicLocked(runtimeObjectRegistry, attachment.geodesicId))
      .filter((attachment) => !isGeodesicStraightening(runtimeObjectRegistry, attachment.geodesicId))
      .length >= 2;
  }

  function startGeodesicCannonTieAndDetach(cannonId: string): void {
    if (!canTieAndDetachGeodesicsFromCannon(cannonId)) {
      syncDesktopPalette();
      return;
    }

    syncTieAndDetachSelectionHighlights([]);
    deps.setCannonToolState({
      selectedCannonId: cannonId,
      tieAndDetachEndpointSelections: [],
    });
    deps.setMenuState(closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "geodesic-cannon-tie-detach")));
    syncDesktopPalette();
    if (!renderer.xr.isPresenting) {
      void controls.requestPointerLock();
    }
  }

  function trySelectTieAndDetachGeodesicFromAim(ray?: RootAimRay): boolean {
    const cannonId = deps.getCannonToolState().selectedCannonId;
    if (!ray || !cannonId) {
      return false;
    }

    const selectedEndpoint = resolveTieAndDetachEndpointFromAim(ray, cannonId);
    if (!selectedEndpoint) {
      return false;
    }

    const selected = deps.getCannonToolState().tieAndDetachEndpointSelections ?? [];
    if (selected.some((selection) =>
      selection.geodesicId === selectedEndpoint.geodesicId && selection.role === selectedEndpoint.role
    )) {
      return true;
    }

    const nextSelections = [...selected, selectedEndpoint];
    if (nextSelections.length < 2) {
      deps.setCannonToolState({
        ...deps.getCannonToolState(),
        tieAndDetachEndpointSelections: nextSelections,
      });
      syncTieAndDetachSelectionHighlights(nextSelections);
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      return true;
    }

    tieAndDetachGeodesicsFromCannon(cannonId, [nextSelections[0], nextSelections[1]]);
    return true;
  }

  function resolveTieAndDetachEndpointFromAim(ray: RootAimRay, cannonId: string): GeodesicEndpointSelection | undefined {
    const selectable = getGeodesicEndpointAttachmentsForAnchor(runtimeObjectRegistry, cannonId)
      .filter((attachment) => isGeodesicLocked(runtimeObjectRegistry, attachment.geodesicId))
      .filter((attachment) => !isGeodesicStraightening(runtimeObjectRegistry, attachment.geodesicId));
    for (const target of resolveCurrentAimTargets(ray)) {
      if (!targetIsWithinInteractionRange(target)) {
        continue;
      }

      const endpoint = target.object?.kind === "geodesic-segment"
        ? resolveGeodesicEndpointSelectionFromSegmentHit(runtimeObjectRegistry, target.object.id)
        : undefined;
      if (
        endpoint &&
        selectable.some((selection) => selection.geodesicId === endpoint.geodesicId && selection.role === endpoint.role)
      ) {
        return endpoint;
      }
    }

    return undefined;
  }

  function tieAndDetachGeodesicsFromCannon(cannonId: string, selectedEndpoints: readonly [GeodesicEndpointSelection, GeodesicEndpointSelection]): void {
    syncTieAndDetachSelectionHighlights([]);
    const pair = tieAndDetachGeodesicEndpoints({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      detachedEmitterId: cannonId,
      first: selectedEndpoints[0],
      second: selectedEndpoints[1],
      createPairId: () => `curve-shortening:${Date.now()}:${geodesicIdCounter++}`,
      createFreeEndId: () => `free-end:${Date.now()}:${geodesicIdCounter++}`,
    });
    if (!pair) {
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      return;
    }

    deps.setCannonToolState({});
    deps.setMenuState(closeRuntimeMenu(setRuntimeMenuSelectedTool(deps.getMenuState(), "none")));
    removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function syncTieAndDetachSelectionHighlights(selectedEndpoints: readonly GeodesicEndpointSelection[]): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "geodesic-segment") {
        continue;
      }

      const endpoint = resolveGeodesicEndpointSelectionFromSegmentHit(runtimeObjectRegistry, object.id);
      const nextHighlightState = endpoint && selectedEndpoints.some((selection) =>
        selection.geodesicId === endpoint.geodesicId && selection.role === endpoint.role
      )
        ? "tie-detach-selected"
        : undefined;
      if (object.highlightState === nextHighlightState) {
        continue;
      }

      runtimeObjectRegistry.update({
        ...object,
        highlightState: nextHighlightState,
      });
    }
  }

  function prepareGeodesicCannonForLift(
    cannonId: string,
  ): Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }> | undefined {
    if (hasStraighteningIncidentGeodesic(runtimeObjectRegistry, cannonId)) {
      return undefined;
    }

    const removed = removeUnlockedGeodesicsFromCannon(runtimeObjectRegistry, cannonId);
    if (removed.length > 0) {
      for (const geodesicId of removed) {
        removeProtractorAnglesForGeodesic(geodesicId);
        removeMeasuredGeodesicLengthsForGeodesic(geodesicId);
      }
      removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
    }

    const cannon = runtimeObjectRegistry.get(cannonId);
    return cannon?.kind === "geodesic-cannon" ? cannon : undefined;
  }

  function updateCarriedGeodesicCannonPose(xrActive: boolean, activeAimRay: RootAimRay | undefined): void {
    if (deps.getMenuState().selectedTool !== "geodesic-cannon-carry") {
      clearCarriedGeodesicCannonGlow();
      return;
    }

    const cannonId = deps.getCannonToolState().selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;
    if (cannon?.kind !== "geodesic-cannon") {
      return;
    }

    const anchor = xrActive
      ? resolveVrCarriedGeodesicCannonAnchor(cannon, activeAimRay)
      : resolveDesktopCarriedGeodesicCannonAnchor(cannon, activeAimRay);
    if (!anchor) {
      return;
    }

    const nextCannon = {
      ...cannon,
      cellId: deps.getPlayerPose().cellId,
      localPose: yawRigidTransform3(cannon.aimYawRadians, anchor),
    };
    if (carriedGeodesicCannonTouchesForbiddenZone(nextCannon)) {
      deleteCarriedGeodesicCannon(cannon.id);
      return;
    }

    if (
      nextCannon.cellId === cannon.cellId &&
      distanceSquared(nextCannon.localPose.translation, cannon.localPose.translation) <=
        carriedGeodesicEmitterPoseToleranceMeters * carriedGeodesicEmitterPoseToleranceMeters
    ) {
      syncCarriedGeodesicCannonGlow(cannon);
      return;
    }

    runtimeObjectRegistry.update(nextCannon);
    rebuildCarriedGeodesicFromCannon(nextCannon, cannon, { preserveGeodesicOnRebuildFailure: true });
    syncCarriedGeodesicCannonGlow(nextCannon);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function rebuildCarriedGeodesicFromCannon(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    previousCannon?: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    options: { readonly preserveGeodesicOnRebuildFailure?: boolean } = {},
  ): void {
    const geodesicId = cannon.activeGeodesicId ?? deps.getCannonToolState().activeGeodesicId;
    const lockedIncidentGeodesicIds = collectLockedIncidentGeodesicIdsForEmitter(runtimeObjectRegistry, cannon.id);
    if (lockedIncidentGeodesicIds.length === 0 && !geodesicId) {
      return;
    }

    if (lockedIncidentGeodesicIds.length > 0) {
      const rebuiltGeodesicIds: string[] = [];
      for (const incidentGeodesicId of lockedIncidentGeodesicIds) {
        updateCarriedGeodesicPortalWord(cannon, previousCannon, incidentGeodesicId);
        const carriedPortalWord = resolveCarriedGeodesicPortalWordForRebuild(incidentGeodesicId);
        rebuildConnectedGeodesicBetweenEmitters({
          world: deps.getWorld(),
          registry: runtimeObjectRegistry,
          geodesicId: incidentGeodesicId,
          carriedEmitterId: cannon.id,
          carriedEmitterBeforeMove: previousCannon,
          carriedEmitterPortalTransition: deps.getLatestPlayerPortalTransition(),
          carriedPortalWord,
          preserveGeodesicOnRebuildFailure: options.preserveGeodesicOnRebuildFailure,
          allowOutOfBoundsCarriedEndpoint: options.preserveGeodesicOnRebuildFailure,
        });
        rebuiltGeodesicIds.push(incidentGeodesicId);
        refreshMeasuredGeodesicLengthsForGeodesic(incidentGeodesicId);
      }
      refreshProtractorAnglesForGeodesics(rebuiltGeodesicIds);
    } else if (geodesicId && isGeodesicLocked(runtimeObjectRegistry, geodesicId)) {
      updateCarriedGeodesicPortalWord(cannon, previousCannon, geodesicId);
      rebuildConnectedGeodesicBetweenEmitters({
        world: deps.getWorld(),
        registry: runtimeObjectRegistry,
        geodesicId,
        carriedEmitterId: cannon.id,
        carriedEmitterBeforeMove: previousCannon,
        carriedEmitterPortalTransition: deps.getLatestPlayerPortalTransition(),
        carriedPortalWord: resolveCarriedGeodesicPortalWordForRebuild(geodesicId),
        preserveGeodesicOnRebuildFailure: options.preserveGeodesicOnRebuildFailure,
        allowOutOfBoundsCarriedEndpoint: options.preserveGeodesicOnRebuildFailure,
      });
      refreshProtractorAnglesForGeodesic(geodesicId);
      refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    } else if (geodesicId) {
      rebuildActiveGeodesicFromCannon(cannon, { connectEmitters: false, breakOnForbiddenZone: true });
      refreshProtractorAnglesForGeodesic(geodesicId);
      refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    }
  }

  function resolveCarriedGeodesicPortalWordForRebuild(geodesicId: string): readonly GeodesicPortalTraversal[] | undefined {
    if (runtimeObjectRegistry.get(geodesicId)?.kind === "geodesic-interval") {
      return collectGeodesicPortalWord(deps.getWorld(), runtimeObjectRegistry, geodesicId);
    }

    return deps.getCannonToolState().carryPortalWordsByGeodesicId?.[geodesicId] ??
      (deps.getCannonToolState().activeGeodesicId === geodesicId
        ? deps.getCannonToolState().carryPortalWord
        : undefined);
  }

  function updateCarriedGeodesicPortalWord(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    previousCannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }> | undefined,
    geodesicId: string,
  ): void {
    const transition = deps.getLatestPlayerPortalTransition();
    if (
      !previousCannon ||
      !transition ||
      deps.getCannonToolState().carryPortalTransitionSerialByGeodesicId?.[geodesicId] ===
        deps.getLatestPlayerPortalTransitionSerial() ||
      previousCannon.cellId !== transition.sourceCellId ||
      cannon.cellId !== transition.targetCellId
    ) {
      return;
    }

    const intervalWord = updateLockedGeodesicPortalWordForCarriedAnchorTraversal({
      registry: runtimeObjectRegistry,
      geodesicId,
      carriedAnchorObjectId: cannon.id,
      traversal: transition,
    });
    if (intervalWord) {
      deps.setCannonToolState({
        ...deps.getCannonToolState(),
        carryPortalWordsByGeodesicId: {
          ...deps.getCannonToolState().carryPortalWordsByGeodesicId,
          [geodesicId]: intervalWord,
        },
        carryPortalWord: deps.getCannonToolState().activeGeodesicId === geodesicId
          ? intervalWord
          : deps.getCannonToolState().carryPortalWord,
        carryPortalTransitionSerial: deps.getLatestPlayerPortalTransitionSerial(),
        carryPortalTransitionSerialByGeodesicId: {
          ...deps.getCannonToolState().carryPortalTransitionSerialByGeodesicId,
          [geodesicId]: deps.getLatestPlayerPortalTransitionSerial(),
        },
      });
      if (deps.getDebugLevel() === "verbose") {
        console.info("[noneuclid] carried geodesic interval portal word", {
          geodesicId,
          carriedEmitterId: cannon.id,
          word: formatGeodesicPortalWord(intervalWord),
          transition,
        });
      }
      return;
    }

    const connection = getGeodesicConnection(runtimeObjectRegistry, geodesicId);
    const currentWord = deps.getCannonToolState().carryPortalWordsByGeodesicId?.[geodesicId] ??
      (deps.getCannonToolState().activeGeodesicId === geodesicId
        ? deps.getCannonToolState().carryPortalWord
        : undefined) ??
      collectGeodesicPortalWord(deps.getWorld(), runtimeObjectRegistry, geodesicId);
    let nextWord: readonly GeodesicPortalTraversal[] | undefined;
    if (connection?.incomingEmitterId === cannon.id) {
      nextWord = [...currentWord, transition];
    } else if (connection?.outgoingEmitterId === cannon.id) {
      nextWord = [reverseGeodesicPortalTraversal(transition), ...currentWord];
    }

    if (!nextWord) {
      return;
    }

    deps.setCannonToolState({
      ...deps.getCannonToolState(),
      carryPortalWordsByGeodesicId: {
        ...deps.getCannonToolState().carryPortalWordsByGeodesicId,
        [geodesicId]: nextWord,
      },
      carryPortalWord: deps.getCannonToolState().activeGeodesicId === geodesicId
        ? nextWord
        : deps.getCannonToolState().carryPortalWord,
      carryPortalTransitionSerial: deps.getLatestPlayerPortalTransitionSerial(),
      carryPortalTransitionSerialByGeodesicId: {
        ...deps.getCannonToolState().carryPortalTransitionSerialByGeodesicId,
        [geodesicId]: deps.getLatestPlayerPortalTransitionSerial(),
      },
    });
    if (deps.getDebugLevel() === "verbose") {
      console.info("[noneuclid] carried geodesic portal word", {
        geodesicId,
        carriedEmitterId: cannon.id,
        word: formatGeodesicPortalWord(nextWord),
        transition,
      });
    }
  }

  function carriedGeodesicCannonTouchesForbiddenZone(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): boolean {
    const cell = deps.getWorld().cellsById.get(cannon.cellId);
    if (!cell) {
      return false;
    }

    return testCellCollision({
      cell,
      object: runtimeObjectToDynamicObjectState(cannon),
    }).reason === "forbidden-zone";
  }

  function deleteCarriedGeodesicCannon(cannonId: string): void {
    const geodesicIds = collectIncidentGeodesicIdsForCannon(cannonId);
    for (const geodesicId of geodesicIds) {
      removeProtractorAnglesForGeodesic(geodesicId);
      removeMeasuredGeodesicLengthsForGeodesic(geodesicId);
    }

    removeGeodesicCannonAndSegments(runtimeObjectRegistry, cannonId);
    deps.setCannonToolState({});
    geodesicCannonRotationTargetLengthMeters = undefined;
    deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
    clearCarriedGeodesicCannonGlow();
    removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    syncDesktopPalette();
  }

  function syncCarriedGeodesicCannonGlow(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): void {
    const glow = carriedGeodesicCannonGlow ?? createCarriedGeodesicCannonGlow();
    carriedGeodesicCannonGlow = glow;
    if (!glow.parent) {
      scene.add(glow);
    }

    glow.visible = deps.getMenuState().selectedTool === "geodesic-cannon-carry";
    glow.position.copy(worldPointToThree({
      x: cannon.localPose.translation.x,
      y: cannon.localPose.translation.y,
      z: cannon.localPose.translation.z + 0.86,
    }));
  }

  function clearCarriedGeodesicCannonGlow(): void {
    if (carriedGeodesicCannonGlow) {
      carriedGeodesicCannonGlow.visible = false;
    }
  }

  function collectIncidentGeodesicIdsForCannon(cannonId: string): readonly string[] {
    const ids = new Set<string>();
    const cannon = runtimeObjectRegistry.get(cannonId);
    if (cannon?.kind === "geodesic-cannon") {
      for (const geodesicId of cannon.geodesicIds) {
        ids.add(geodesicId);
      }
      if (cannon.activeGeodesicId) {
        ids.add(cannon.activeGeodesicId);
      }
    }

    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "geodesic-cannon") {
        continue;
      }
      for (const [geodesicId, connection] of Object.entries(object.geodesicConnectionsById ?? {})) {
        if (connection.outgoingEmitterId === cannonId || connection.incomingEmitterId === cannonId) {
          ids.add(geodesicId);
        }
      }
    }

    return [...ids];
  }

  function updateActiveGeodesicCannonRotation(yawDeltaRadians: number, finishRequested: boolean): void {
    const cannonId = deps.getCannonToolState().selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;

    if (!cannon || cannon.kind !== "geodesic-cannon") {
      deps.setCannonToolState({});
      deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
      syncDesktopPalette();
      return;
    }

    if (yawDeltaRadians !== 0 && Number.isFinite(yawDeltaRadians)) {
      const nextYaw = Math.atan2(
        Math.sin(cannon.aimYawRadians + yawDeltaRadians),
        Math.cos(cannon.aimYawRadians + yawDeltaRadians),
      );
      const activeGeodesicId = deps.getCannonToolState().activeGeodesicId;
      const nextCannon = {
        ...cannon,
        aimYawRadians: nextYaw,
        localPose: yawRigidTransform3(nextYaw, cannon.localPose.translation),
        geodesicEmitterYawRadiansById: activeGeodesicId
          ? {
              ...cannon.geodesicEmitterYawRadiansById,
              [activeGeodesicId]: nextYaw,
            }
          : cannon.geodesicEmitterYawRadiansById,
      };
      runtimeObjectRegistry.update(nextCannon);
      rebuildActiveGeodesicFromCannon(nextCannon, { connectEmitters: false });
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
    }

    if (finishRequested) {
      const refreshed = runtimeObjectRegistry.get(cannon.id);
      finishActiveGeodesicCannonEdit(refreshed?.kind === "geodesic-cannon" ? refreshed : cannon);
      geodesicCannonRotationTargetLengthMeters = undefined;
      deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
      syncDesktopPalette();
    }
  }

  function updateActiveGeodesicCannonAim(
    finishRequested: boolean,
    activeAimRay: RootAimRay | undefined,
  ): void {
    const cannonId = deps.getCannonToolState().selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;

    if (!cannon || cannon.kind !== "geodesic-cannon") {
      deps.setCannonToolState({});
      finishGeodesicCannonAimMode();
      return;
    }

    if (!playerIsWithinGeodesicCannonAimRange(cannon)) {
      finishGeodesicCannonAimMode();
      return;
    }

    const aimTarget = activeAimRay ? resolveCurrentAimTarget(activeAimRay) : undefined;
    const targetAbsolutePoint = aimTarget?.rootPoint
      ?? (activeAimRay ? intersectRootRayWithFloor(activeAimRay.origin, activeAimRay.direction) : undefined);
    const nextYaw = resolveGeodesicCannonAimYawFromAbsolutePoints({
      source: resolveGeodesicCannonAbsoluteEmitterPoint(cannon),
      target: targetAbsolutePoint,
    });
    if (nextYaw !== undefined) {
      const yawDelta = Math.atan2(
        Math.sin(nextYaw - cannon.aimYawRadians),
        Math.cos(nextYaw - cannon.aimYawRadians),
      );
      if (Math.abs(yawDelta) > 1e-6) {
        const activeGeodesicId = deps.getCannonToolState().activeGeodesicId;
        const nextCannon = {
          ...cannon,
          aimYawRadians: nextYaw,
          localPose: yawRigidTransform3(nextYaw, cannon.localPose.translation),
          geodesicEmitterYawRadiansById: activeGeodesicId
            ? {
                ...cannon.geodesicEmitterYawRadiansById,
                [activeGeodesicId]: nextYaw,
              }
            : cannon.geodesicEmitterYawRadiansById,
        };
        runtimeObjectRegistry.update(nextCannon);
        rebuildActiveGeodesicFromCannon(nextCannon, { connectEmitters: false });
        syncRuntimeObjectPortalInstances();
        syncSelectableHitboxDebug();
      }
    }

    if (finishRequested) {
      const refreshed = runtimeObjectRegistry.get(cannon.id);
      finishActiveGeodesicCannonEdit(refreshed?.kind === "geodesic-cannon" ? refreshed : cannon);
      finishGeodesicCannonAimMode();
    }
  }

  function playerIsWithinGeodesicCannonAimRange(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): boolean {
    if (deps.getPlayerPose().cellId !== cannon.cellId) {
      return false;
    }

    const rangeMeters = getRuntimeObjectInteractionRangeMeters(cannon);
    const dx = deps.getPlayerPose().position.x - cannon.localPose.translation.x;
    const dy = deps.getPlayerPose().position.y - cannon.localPose.translation.y;
    return Math.hypot(dx, dy) <= rangeMeters;
  }

  function finishGeodesicCannonAimMode(): void {
    geodesicCannonRotationTargetLengthMeters = undefined;
    deps.setMenuState(setRuntimeMenuSelectedTool(deps.getMenuState(), "none"));
    syncDesktopPalette();
  }

  function finishActiveGeodesicCannonEdit(cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>): void {
    rebuildActiveGeodesicFromCannon(cannon, { connectEmitters: true, snapToEmitter: true });
    removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function rebuildActiveGeodesicFromCannon(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    options: {
      readonly connectEmitters?: boolean;
      readonly snapToEmitter?: boolean;
      readonly breakOnForbiddenZone?: boolean;
    } = {},
  ): void {
    const geodesicId = cannon.activeGeodesicId ?? deps.getCannonToolState().activeGeodesicId;
    if (!geodesicId) {
      return;
    }

    const totalLengthMeters = geodesicCannonRotationTargetLengthMeters ?? getGeodesicTotalLengthMeters(geodesicId);
    rebuildGeodesicToLength({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      cannon,
      geodesicId,
      totalLengthMeters,
      connectEmitters: options.connectEmitters,
      snapToEmitter: options.snapToEmitter,
      breakOnForbiddenZone: options.breakOnForbiddenZone,
      rebuildLocked: true,
    });
    refreshProtractorAnglesForGeodesic(geodesicId);
    refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    deps.setCannonToolState({
      selectedCannonId: cannon.id,
      activeGeodesicId: geodesicId,
    });
  }

  function getGeodesicTotalLengthMeters(geodesicId: string): number {
    return runtimeObjectRegistry.getAll()
      .filter((object): object is Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }> =>
        object.kind === "geodesic-segment" && object.geodesicId === geodesicId
      )
      .reduce((total, segment) => total + segment.lengthMeters, 0);
  }

  function getLockedGeodesicIds(geodesicIds: readonly string[]): readonly string[] {
    return geodesicIds.filter((geodesicId) => isGeodesicLocked(runtimeObjectRegistry, geodesicId));
  }

  function freezeXrHeadHeightDuringGeodesicCannonRotation(headLocalMeters: Vec3 | undefined): Vec3 | undefined {
    if (!headLocalMeters) {
      return headLocalMeters;
    }

    geodesicCannonRotationHeadHeightMeters ??= headLocalMeters.z;
    return {
      ...headLocalMeters,
      z: geodesicCannonRotationHeadHeightMeters,
    };
  }

  return {
    tryUseGeodesicCannonToolFromAim,
    tryExtendFocusedGeodesicFromAim,
    addGeodesicToCannon,
    startGeodesicCannonRotation,
    startGeodesicCannonAim,
    startGeodesicCannonCarry,
    tryStartFocusedGeodesicCannonCarry,
    finishGeodesicCannonCarry,
    deleteGeodesicFromCannon,
    canTieAndDetachGeodesicsFromCannon,
    startGeodesicCannonTieAndDetach,
    trySelectTieAndDetachGeodesicFromAim,
    syncTieAndDetachSelectionHighlights,
    updateCarriedGeodesicCannonPose,
    syncCarriedGeodesicCannonGlow,
    clearCarriedGeodesicCannonGlow,
    updateActiveGeodesicCannonRotation,
    updateActiveGeodesicCannonAim,
    getGeodesicTotalLengthMeters,
    getLockedGeodesicIds,
    freezeXrHeadHeightDuringGeodesicCannonRotation,
    resetGeodesicCannonRotationTracking,
  };
}

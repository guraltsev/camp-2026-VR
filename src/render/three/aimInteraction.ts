/** Resolves what the player is aiming at (desktop camera or VR controller), cycles overlapping targets, and finds the focused object. */
import * as THREE from "three";
import { type CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { type DebugLevelId } from "../../glue/debugLevels";
import { type RuntimeMenuState } from "../../runtime/runtimeMenuState";
import {
  createWorldFocusMessageDefinition,
  formatWorldFocusMessageTextForLegacyFallback,
} from "../../ui/worldInteractionDefinition";
import { canExtendGeodesicSegment, isGeodesicLocked } from "../../world-objects/geodesicCannon";
import { type RuntimeObjectRegistry, type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { AimTarget, resolveAimTargets } from "./aimTarget";
import { formatVec3, roundNumber } from "./appDebugHelpers";
import { GeodesicCannonToolState } from "./geodesicCannonTools";
import { renderCameraFarMeters, renderCameraNearMeters } from "./renderCameraClip";
import {
  RootAimRay,
  createAimTargetCycleSignature,
  getRuntimeObjectInteractionRangeMeters,
} from "./rootAimRay";
import { VisiblePortalPath } from "./visiblePortalPaths";
import { createXrPlayerRig, xrRigidTransformLocalMatrix } from "./xrPlayerRig";

/** The interactable object the aim ray currently rests on. */
export interface FocusedRuntimeObject {
  readonly object: RuntimeWorldObject;
  readonly distance: number;
  readonly tooltipAnchor: { readonly x: number; readonly y: number; readonly z: number };
}

export interface AimInteractionDeps {
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly xrRig: ReturnType<typeof createXrPlayerRig>;
  readonly runtimeObjectRegistry: RuntimeObjectRegistry;
  getWorld(): CompiledCellComplex;
  getDebugLevel(): DebugLevelId;
  getMenuState(): RuntimeMenuState;
  getCannonToolState(): GeodesicCannonToolState;
  getRuntimeObjectVisiblePaths(): readonly VisiblePortalPath[];
}

export function createAimInteraction(deps: AimInteractionDeps) {
  const { camera, renderer, xrRig, runtimeObjectRegistry, getRuntimeObjectVisiblePaths } = deps;
  const aimRayCamera = new THREE.PerspectiveCamera(70, 1, renderCameraNearMeters, renderCameraFarMeters);
  let aimTargetCycleState: { readonly signature: string; readonly index: number } | undefined;

  function resolveCurrentAimTarget(ray: RootAimRay): AimTarget | undefined {
    const targets = resolveCurrentAimTargets(ray);
    const cycleTargets = getAimTargetCycleCandidates(targets);
    if (cycleTargets.length === 0) {
      aimTargetCycleState = undefined;
      return targets[0];
    }

    const signature = createAimTargetCycleSignature(cycleTargets);
    if (aimTargetCycleState?.signature !== signature) {
      aimTargetCycleState = undefined;
      return cycleTargets[0];
    }

    return cycleTargets[aimTargetCycleState.index % cycleTargets.length] ?? cycleTargets[0];
  }

  function resolveCurrentAimTargetCycleCandidates(ray: RootAimRay): readonly AimTarget[] {
    return getAimTargetCycleCandidates(resolveCurrentAimTargets(ray));
  }

  function resolveCurrentAimTargets(ray: RootAimRay): readonly AimTarget[] {
    const activeGeodesicId = deps.getCannonToolState().activeGeodesicId;
    const ignoredGeodesicIds = deps.getMenuState().selectedTool === "geodesic-cannon-aim" && activeGeodesicId
      ? [activeGeodesicId]
      : undefined;
    const aimCamera = syncAimRayCamera(ray);

    return resolveAimTargets({
      world: deps.getWorld(),
      registry: runtimeObjectRegistry,
      camera: aimCamera,
      visiblePortalPaths: getRuntimeObjectVisiblePaths(),
      maxDistanceMeters: 24,
      ignoredGeodesicIds,
    });
  }

  function getAimTargetCycleCandidates(targets: readonly AimTarget[]): readonly AimTarget[] {
    return targets.filter((target) =>
      target.kind === "object" &&
      target.object !== undefined &&
      targetIsWithinInteractionRange(target)
    );
  }

  function syncAimRayCamera(ray: RootAimRay): THREE.Camera {
    aimRayCamera.position.copy(ray.origin);
    aimRayCamera.quaternion.copy(ray.quaternion);
    aimRayCamera.updateMatrixWorld(true);
    return aimRayCamera;
  }

  function cycleFocusedAimTarget(ray?: RootAimRay): boolean {
    if (!ray) {
      return false;
    }

    const targets = resolveCurrentAimTargetCycleCandidates(ray);
    if (targets.length < 2) {
      return false;
    }

    const signature = createAimTargetCycleSignature(targets);
    const previousIndex = aimTargetCycleState?.signature === signature ? aimTargetCycleState.index : 0;
    aimTargetCycleState = {
      signature,
      index: (previousIndex + 1) % targets.length,
    };
    return true;
  }

  function findFocusedRuntimeObject(ray?: RootAimRay): {
    readonly object: RuntimeWorldObject;
    readonly distance: number;
    readonly tooltipAnchor: { readonly x: number; readonly y: number; readonly z: number };
  } | undefined {
    if (!ray) {
      return undefined;
    }

    const target = resolveCurrentAimTarget(ray);
    const object = target?.object;
    if (target?.kind !== "object" || !object || (!object.tooltip && !object.interactable)) {
      return undefined;
    }

    if (!targetIsWithinInteractionRange(target)) {
      return undefined;
    }

    return {
      object,
      distance: target.distanceMeters,
      tooltipAnchor: {
        x: target.rootPoint.x,
        y: target.rootPoint.y,
        z: target.rootPoint.z + 0.18,
      },
    };
  }

  function targetIsWithinInteractionRange(target: ReturnType<typeof resolveCurrentAimTarget>): boolean {
    const object = target?.object;
    if (target?.kind !== "object" || !object || target.distanceMeters <= 0.001) {
      return false;
    }

    return target.distanceMeters <= getRuntimeObjectInteractionRangeMeters(object);
  }

  function logVerboseAimClick(target: ReturnType<typeof resolveCurrentAimTarget>): void {
    if (deps.getDebugLevel() !== "verbose") {
      return;
    }

    if (!target) {
      console.info("Aim click: no target within 24m.");
      return;
    }

    const fields: Record<string, string | number | undefined> = {
      kind: target.kind,
      cellId: target.cellId,
      portalPathId: target.portalPathId,
      distanceMeters: roundNumber(target.distanceMeters),
      localPoint: formatVec3(target.localPoint),
      rootPoint: formatVec3(target.rootPoint),
      localNormal: formatVec3(target.localNormal),
    };

    if (target.object) {
      const interactionRange = target.object.tooltip?.rangeMeters ?? target.object.interactable?.rangeMeters;
      fields.objectId = target.object.id;
      fields.objectKind = target.object.kind;
      fields.interactionRangeMeters = interactionRange;
      fields.withinInteractionRange = interactionRange === undefined
        ? undefined
        : target.distanceMeters <= interactionRange ? "yes" : "no";
    }

    console.info("Aim click:", fields);
  }

  function resolveActiveRootAimRay(
    xrActive: boolean,
    xrFrame?: XRFrame,
    xrReferenceSpace?: XRReferenceSpace | null,
  ): RootAimRay | undefined {
    return xrActive
      ? resolveXrControllerRootRay(xrFrame, xrReferenceSpace ?? null)
      : resolveCameraRootRay();
  }

  function resolveCameraRootRay(): RootAimRay {
    camera.updateMatrixWorld(true);
    const origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const cameraQuaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraQuaternion);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion).normalize();
    return { origin, direction, quaternion: cameraQuaternion };
  }

  function resolveXrControllerRootRay(
    xrFrame: XRFrame | undefined,
    xrReferenceSpace: XRReferenceSpace | null,
  ): RootAimRay | undefined {
    const session = renderer.xr.getSession();
    if (!xrFrame || !xrReferenceSpace || !session) {
      return undefined;
    }

    const sources = [...session.inputSources].filter((source) => source.targetRaySpace && !source.hand);
    const source = sources.find((candidate) => candidate.handedness === "right") ?? sources[0];
    if (!source) {
      return undefined;
    }

    const pose = xrFrame.getPose(source.targetRaySpace, xrReferenceSpace);
    if (!pose) {
      return undefined;
    }

    const worldMatrix = xrRig.root.matrixWorld.clone().multiply(xrRigidTransformLocalMatrix(pose.transform));
    const origin = new THREE.Vector3().setFromMatrixPosition(worldMatrix);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(worldMatrix);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(worldMatrix).normalize();
    return { origin, direction, quaternion };
  }

  function resolveDesktopTooltipScreenPosition(): { readonly x: number; readonly y: number } {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2 - 28,
    };
  }

  function getRuntimeObjectTooltipText(object: RuntimeWorldObject, inputMode: "desktop" | "xr"): string | undefined {
    return formatWorldFocusMessageTextForLegacyFallback(
      getWorldFocusMessageDefinition(object),
      inputMode,
    );
  }

  function getWorldFocusMessageDefinition(object: RuntimeWorldObject) {
    return createWorldFocusMessageDefinition({
      object,
      selectedTool: deps.getMenuState().selectedTool,
      canExtendGeodesic: object.kind === "geodesic-segment" &&
        canExtendGeodesicSegment(object) &&
        !isGeodesicLocked(runtimeObjectRegistry, object.geodesicId),
    });
  }

  return {
    resolveCurrentAimTarget,
      resolveCurrentAimTargets,
    cycleFocusedAimTarget,
    findFocusedRuntimeObject,
    targetIsWithinInteractionRange,
    logVerboseAimClick,
    resolveActiveRootAimRay,
    resolveCameraRootRay,
    resolveDesktopTooltipScreenPosition,
    getRuntimeObjectTooltipText,
    getWorldFocusMessageDefinition,
  };
}

import * as THREE from "three";
import { reversePainterSortStable } from "@pmndrs/uikit";
import type { AppState } from "../../appState";
import type { CellComplexSpec } from "../../cell-complex/specs";
import type { PortalPathTablesByRootCell } from "../../cell-complex/portalPaths";
import type { PortalRenderPath } from "../../cell-complex/portalPaths";
import { checkPortalPathString, createPortalPathDebugState } from "../../cell-complex/portalPathDebug";
import {
  buildStaticallyCulledPortalPathTables,
  type StaticPortalPathCullResult,
} from "../../cell-complex/staticPortalPathCull";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import type { DebugSettings } from "../../glue/debugSettings";
import { hasActiveDebugOption, type DebugOptionId } from "../../glue/debugOptions";
import type { DebugLevelId } from "../../glue/debugLevels";
import type { LaunchOptions } from "../../glue/readLaunchOptions";
import { defaultAppConfig, isRuntimeToolEnabled, type AppConfig } from "../../glue/appConfig";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import { normalizeVec3, vec3, type Vec3 } from "../../math/vec3";
import { movePlayer } from "../../movement/movePlayer";
import { createAppCommandDispatcher } from "../../runtime/appCommandDispatcher";
import type { RuntimeCommand } from "../../runtime/runtimeCommands";
import { applyGeometryCommitComputedObjectPolicy } from "../../runtime/worldGeometryComputedObjects";
import {
  createDefaultWorldDeformationFamilyRegistry,
  createInitialWorldDeformationState,
  getWorldDeformationFamilyOrThrow,
} from "../../runtime/worldGeometryDeformationFamilies";
import {
  createWorldGeometrySession,
  type LiveGeometryDebugState,
  type WorldGeometrySnapshot,
} from "../../runtime/worldGeometrySession";
import {
  transformPoseWithCellMaps,
  transformRigidPoseWithMap,
  type CellDeformationMap,
} from "../../runtime/worldGeometryDeformations";
import {
  createDebugSettingsFromRuntimeMenuState,
  closeRuntimeMenu,
  createRuntimeMenuState,
  openRuntimeMenu,
  type RuntimeDebugOverlayItemId,
  selectRuntimeMenuPlaceFlagToolType,
  setRuntimeMenuConsoleLogLevel,
  setRuntimeMenuDebugEnabled,
  setRuntimeMenuDebugOverlayEnabled,
  setRuntimeMenuCollisionGeometryWireframesEnabled,
  setRuntimeMenuSelectedWorldId,
  setRuntimeMenuPortalInspectionEnabled,
  setRuntimeMenuPortalPanelMode,
  setRuntimeMenuAimCollisionOutlinesEnabled,
  setRuntimeMenuAntiNauseaModeEnabled,
  setRuntimeMenuEditingFlagId,
  setRuntimeMenuEditingSignMessage,
  setRuntimeMenuGoalPageIndex,
  setRuntimeMenuReloadConfirmUntilMs,
  setRuntimeMenuTutorialPageIndex,
  showRuntimeMenuGeodesicCannonActions,
  showRuntimeMenuGeometryComputerActions,
  showRuntimeMenuGoal,
  showRuntimeMenuDebugSettings,
  showRuntimeMenuEditSign,
  showRuntimeMenuMainPage,
  showRuntimeMenuPlaceFlagOptions,
  showRuntimeMenuQuestionHelp,
  showRuntimeMenuQuestionTutorial,
  showRuntimeMenuSettings,
  setRuntimeMenuSelectedTool,
  toggleRuntimeMenuDebugOverlayItem,
} from "../../runtime/runtimeMenuState";
import { createPaletteDefinition } from "../../ui/paletteDefinition";
import { createHelpLensDefinition } from "../../ui/helpLensDefinition";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import { playerPoseToDynamicObject, type PlayerPose } from "../../movement/playerPose";
import {
  createGeodesciMarmotRuntime,
  isGeodesciMarmotObjectSpec,
  type GeodesciMarmotRuntime,
} from "../../world-objects/geodesciMarmot";
import {
  createSimpleGeoCreatureRuntime,
  isSimpleGeoCreatureObjectSpec,
  type SimpleGeoCreatureRuntime,
} from "../../world-objects/simpleGeoCreature";
import {
  placeFlagAtFloorPoint,
  updatePlacedFlagFontColor,
  updatePlacedFlagMessage,
} from "../../world-objects/placedFlags";
import {
  collectLockedIncidentGeodesicIdsForEmitter,
  collectGeodesicPortalWord,
  advanceStraighteningGeodesics,
  canExtendGeodesicSegment,
  extendGeodesic,
  getGeodesicConnection,
  getGeodesicSegments,
  hasStraighteningIncidentGeodesic,
  isGeodesicLocked,
  isGeodesicStraightening,
  placeGeodesicCannonAtGeodesicVertex,
  placeGeodesicCannonOnGeodesic,
  placeGeodesicCannonAtFloorPoint,
  pruneMissingGeodesicIntersectionObjects,
  rebuildGeodesicToLength,
  rebuildConnectedGeodesicBetweenEmitters,
  removeGeodesic,
  removeGeodesicCannonAndSegments,
  removeUnlockedGeodesicsFromCannon,
  resolveGeodesicNumber,
  shootGeodesic,
  tieAndDetachIncidentGeodesics,
  geodesicRayBeamHeightMeters,
  type GeodesicCarryPortalTransition,
  type GeodesicPortalTraversal,
} from "../../world-objects/geodesicCannon";
import {
  createMeasuredGeodesicLengthObject,
  refreshMeasuredGeodesicLengthObject,
} from "../../world-objects/measureLengthTool";
import {
  createProtractorAngleObject,
  refreshProtractorAngleObject,
  resolveProtractorCenterSelection,
  resolveProtractorDirectedGeodesicSelection,
  resolveProtractorEmitterGeodesicSelection,
  type ProtractorCenterSelection,
  type ProtractorDirectedGeodesic,
} from "../../world-objects/protractorTool";
import {
  createRuntimeObjectRegistry,
  createRuntimeStaticAssetObject,
  runtimeObjectToDynamicObjectState,
  type RuntimeWorldObject,
} from "../../world-objects/runtimeObjectRegistry";
import {
  getDynamicObjectCollisionBounds,
  simpleCylinderIntersectsSimpleCylinder,
  testCellCollision,
  type SimpleCylinderBounds,
} from "../../movement/collision";
import { simpleCollisionCylinder } from "../../movement/dynamicObject";
import { createDesktopFlagEditor } from "../dom/desktopFlagEditor";
import { createDesktopToolIndicator } from "../dom/desktopToolIndicator";
import { createFloatingObjectTooltip } from "../dom/floatingObjectTooltip";
import { createAimCrossMarker } from "./aimCrossMarker";
import {
  getGeodesicEmitterAimCylinderBounds,
  getGeodesicEmitterAimSphereCenter,
  geodesicSegmentAimRadiusMeters,
  type AimTarget,
  resolveAimTargets,
} from "./aimTarget";
import { resolveGeodesicCannonAimYawFromAbsolutePoints } from "./geodesicCannonAimTarget";
import { createPlacedFlagRuntime, type PlacedFlagRuntime } from "./placedFlagRenderer";
import {
  createMeasuredGeodesicLengthRuntime,
  type MeasuredGeodesicLengthRuntime,
} from "./measureLengthRenderer";
import { createProtractorAngleRuntime, type ProtractorAngleRuntime } from "./protractorAngleRenderer";
import {
  collectGeodesicRuntimeRenderRecords,
  createGeodesicRuntimeRenderSources,
  geodesicRayEmitterPosition,
} from "./geodesicCannonRenderer";
import {
  buildCellRenderArchetypes,
  deriveCellRenderArchetypeCapacities,
  disposeCellRenderArchetypes,
  type CellRenderArchetype,
} from "./cellRenderArchetypes";
import { createDebugOverlay } from "./debugOverlay";
import { createDesktopControls } from "./desktopControls";
import {
  createDesktopScenePaletteInput,
  reduceDesktopScenePaletteToggle,
} from "./desktopScenePaletteInput";
import {
  createWorldFocusMessageDefinition,
  formatWorldFocusMessageTextForLegacyFallback,
} from "../../ui/worldInteractionDefinition";
import { createHelpLensRenderer } from "./helpLensRenderer";
import { resolveDesktopScenePalettePlacement } from "./desktopScenePalettePlacement";
import {
  collectGeodesicCreatureDebugDump,
  type GeodesicCreatureDebugDump,
} from "./geodesicCreatureDebug";
import { createScenePaletteController } from "./scenePaletteController";
import { buildForbiddenZoneWireframe } from "./debugCollisionWireframes";
import { buildStaticObjectCollisionWireframeGroup } from "./staticObjectCollisionWireframes";
import { SCENE_BACKGROUND_COLOR } from "./sceneColors";
import { createPortalInstanceDebugRenderer, type PortalInstanceDebugRenderer } from "./portalInstanceDebug";
import {
  createPortalClipPolygonOverlay,
  type PortalClipPolygonOverlayEntry,
} from "./portalClipPolygonOverlay";
import { prerenderCells } from "./prerenderCells";
import {
  createPortalInstanceDiagnostics,
  createPortalInstanceRenderDebugState,
  buildVisiblePathsByDestinationCell,
  flattenVisiblePortalPathGroups,
  groupVisiblePortalPathsByDestinationCell,
  updateCellRenderArchetypeInstances,
  updateRuntimeObjectRenderArchetypeInstances,
  type PortalInstanceRenderDebugState,
} from "./renderPortalInstances";
import {
  buildRuntimeObjectRenderArchetype,
  createRuntimeObjectRenderArchetypeDiagnostics,
  deriveRuntimeObjectRenderArchetypeCapacity,
  disposeRuntimeObjectRenderArchetypes,
  groupRuntimeObjectRenderRecordsByArchetype,
  type RuntimeObjectRenderArchetype,
} from "./runtimeObjectRenderArchetypes";
import {
  collectRuntimeObjectRenderSourceMeshes,
  type RuntimeObjectRenderRecord,
  type RuntimeObjectRenderSourceMesh,
} from "./runtimeObjectRenderRecords";
import { collectPortalGhostRuntimeObjectRenderRecords } from "./runtimeObjectGhostRecords";
import {
  createRenderQualityState,
  getPortalViewportPixels,
  getRendererCssCanvasSize,
  getWindowCssCanvasSize,
  portalClipEdgeSmoothingEnabled,
  renderAntialiasRequested,
  resolveRenderQualityPixelRatio,
  type RenderQualityState,
} from "./renderQuality";
import { renderCameraFarMeters, renderCameraNearMeters } from "./renderCameraClip";
import { installRuntimeDiagnostics, runtimeDiagnostics } from "./runtimeDiagnostics";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { createPlayerRoverRenderModel } from "./playerRoverModel";
import type {
  FramePerformanceRenderState,
  PortalEyeRenderDebugState,
  RuntimeInputFrame,
  VisiblePortalPathRenderState,
  WebGlRenderInfoState,
  XrDebugRenderState,
} from "./renderState";
import { createPortalClipData } from "./portalClipData";
import {
  createPortalClipMaterialState,
  updatePortalClipMaterialTextureEye,
  updatePortalClipMaterialViewport,
  updatePortalClipMaterialViewportFromRenderer,
} from "./portalClipMaterial";
import {
  createStylizedSceneLighting,
  disposeStylizedSceneLighting,
  updateStylizedSceneLighting,
} from "./sceneLighting";
import {
  computeIndependentVisiblePortalPaths,
  computeVisiblePortalPaths,
  describeVisiblePortalPath,
  type ComputeVisiblePortalPathsResult,
  type VisiblePortalPath,
  type VisiblePortalPathDebugSummary,
  type VisiblePortalPathLookupResult,
} from "./visiblePortalPaths";
import { rigidTransformToThreeMatrix, threeDirectionToWorld, threePointToWorld, worldPointToThree } from "./worldAxes";
import { createXrControls } from "./xrControls";
import { createXrControllerHandModels } from "./xrControllerHandModels";
import { createXrEntryUi } from "./xrEntryUi";
import { resolveXrPortalEyeRenderRoot, type XrPortalEyeRenderRoot } from "./xrPortalEye";
import { createXrPlayerRig, headLocalMetersFromViewerPose, headYawRadiansFromViewerPose, xrRigidTransformLocalMatrix } from "./xrPlayerRig";
import { resolveFrontFacingQuaternion, resolveVrPalettePlacement, shouldAutoCloseVrPalette } from "./vrPalettePlacement";
import { createXrScenePaletteInput } from "./xrScenePaletteInput";
import {
  createVrComfortVignette,
  isArtificialLocomotionActive,
  type VrComfortOptions,
} from "./vrComfort";
import {
  createXrSessionState,
  detectXrSessionState,
  transitionXrSessionState,
  type XrSessionState,
} from "./xrSessionState";
import { createXrSessionRestartCoordinator } from "./xrSessionRestart";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  invertRigidTransform3,
  transformPoint3,
  yawRigidTransform3,
} from "../../math/rigidTransform3";

export interface ThreeApp {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  updateDebugSettings(settings: DebugSettings): void;
  dispose(): void;
}

export interface ThreeAppOptions {
  readonly selectedWorldId: string;
  readonly worldSpec: CellComplexSpec;
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly renderQualityEnabled: boolean;
  readonly vrComfortOptions: VrComfortOptions;
  readonly appConfig?: AppConfig;
  readonly assets: PreparedWorldAssets;
  readonly onWorldChangeRequested?: (worldId: string) => void;
  readonly onReloadRequested?: () => void;
  readonly onLaunchOptionsChanged?: (patch: Partial<LaunchOptions>) => void;
  readonly onCopyUrlWithOptionsRequested?: () => void;
}

interface PortalEyeRenderState {
  readonly camera: THREE.Camera;
  readonly result: ComputeVisiblePortalPathsResult;
  readonly eyeIndex: number;
  readonly rootCellId: string;
}

interface ActiveWorldBundle {
  readonly snapshot: WorldGeometrySnapshot;
  readonly archetypeCapacitiesByCellId: ReadonlyMap<string, number>;
  readonly warmupViewsByCellId: ReadonlyMap<string, ReturnType<typeof createCellWarmupViews>>;
}

interface RootAimRay {
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

interface XrHeadWorldPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

const underCellInfinityFloorSizeMeters = 1_000;
const underCellInfinityFloorWorldZMeters = -1;
const fallbackObjectAimCollisionRadiusMeters = 0.25;
const selectableObjectHitboxDebugColor = 0xffc400;
const selectableGeodesicSegmentHitboxDebugColor = 0xff2bd6;
const aimCollisionOutlineDebugColor = 0xff44ff;
const selectableHitboxDebugOpacity = 0.24;
const aimCollisionOutlineDebugOpacity = 0.82;
const selectableHitboxDebugRenderOrder = 930;
const aimCollisionOutlineDebugRenderOrder = 935;
const reloadConfirmationWindowMs = 2000;
const xrObjectTooltipRenderOrder = 960;
const xrObjectTooltipYOffsetMeters = 0.18;
const geodesicEmitterLabelRangeMeters = 3;
const geodesicEmitterLabelRenderOrder = 940;
const geodesicEmitterLabelLocalForwardOffsetMeters = 0.12;
const geodesicEmitterLabelLocalYOffsetMeters = 0.03;
const carriedGeodesicEmitterDesktopDistanceMeters = 0.75;
const carriedGeodesicEmitterPoseToleranceMeters = 1e-4;
const geodesicCreatureDebugCheckIntervalSeconds = 0.1;
const geodesicCreatureHealthyLogIntervalSeconds = 5;
const xrHeadWorldMatrix = new THREE.Matrix4();
const xrHeadWorldPosition = new THREE.Vector3();
const xrHeadWorldQuaternion = new THREE.Quaternion();
const xrHeadWorldScale = new THREE.Vector3();

export function createThreeApp(container: HTMLElement, appState: AppState, options: ThreeAppOptions): ThreeApp {
  const appConfig = options.appConfig ?? defaultAppConfig;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
  scene.environment = null;
  scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, 12, 85);
  const underCellInfinityFloor = createUnderCellInfinityFloor();
  scene.add(underCellInfinityFloor);

  const initialCanvasSize = getWindowCssCanvasSize(window);
  const camera = new THREE.PerspectiveCamera(
    70,
    initialCanvasSize.width / initialCanvasSize.height,
    renderCameraNearMeters,
    renderCameraFarMeters,
  );
  const aimRayCamera = new THREE.PerspectiveCamera(70, 1, renderCameraNearMeters, renderCameraFarMeters);
  const portalCullingCamera = camera.clone();
  const portalCullingEyeCameras = [new THREE.Camera(), new THREE.Camera()];

  const pixelRatio = resolveRenderQualityPixelRatio(options.renderQualityEnabled, window.devicePixelRatio);
  const renderer = new THREE.WebGLRenderer({ antialias: renderAntialiasRequested });
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.setTransparentSort(reversePainterSortStable);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(initialCanvasSize.width, initialCanvasSize.height);
  container.append(renderer.domElement);
  const controls = createDesktopControls(renderer.domElement);
  let vrComfortOptions = options.vrComfortOptions;
  const xrControls = createXrControls(vrComfortOptions);
  const xrRig = createXrPlayerRig(camera, vrComfortOptions);
  scene.add(xrRig.root);
  const vrComfortVignette = createVrComfortVignette(camera, vrComfortOptions);
  const clock = new THREE.Clock();
  let playerPose = appState.playerPose;
  let xrSessionState: XrSessionState = createXrSessionState("unknown", {
    secureContext: window.isSecureContext,
  });
  let xrDebugState: XrDebugRenderState = createInitialXrDebugState(xrSessionState, playerPose);
  let debugLevel = options.debugLevel;
  let portalPanelMode = options.portalPanelMode;
  let debugOptions = options.debugOptions;
  let smoothedFrameRateFps: number | undefined;
  let smoothedFramePerformance: FramePerformanceRenderState | undefined;
  let latestWebGlRenderInfo: WebGlRenderInfoState | undefined;
  let showCellPathRendersInstances = hasActiveDebugOption(
    debugLevel,
    debugOptions,
    "portal-path-overlay-instances",
  );
  let menuState = createRuntimeMenuState({
    selectedWorldId: options.selectedWorldId,
    debugSettings: {
      debugLevel: options.debugLevel,
      portalPanelMode: options.portalPanelMode,
      debugOptions: options.debugOptions,
    },
    debugOverlayEnabled: options.debugOverlayEnabled,
    debugOverlayItems: options.debugOverlayItems,
    vrComfortOptions,
  });
  let previousDesktopPalettePlacement: ReturnType<typeof resolveDesktopScenePalettePlacement> | undefined;
  let fixedXrPalettePlacement: ReturnType<typeof resolveVrPalettePlacement> | undefined;
  let geodesicCannonRotationHeadHeightMeters: number | undefined;
  let geodesicCannonRotationTargetLengthMeters: number | undefined;
  let aimTargetCycleState: { readonly signature: string; readonly index: number } | undefined;
  let xrObjectTooltip: { readonly text: string; readonly root: THREE.Object3D } | undefined;
  let reloadConfirmationTimeout: number | undefined;
  const xrSessionRestartCoordinator = createXrSessionRestartCoordinator();
  const debugOverlay = createDebugOverlay(container);
  const commandDispatcher = createAppCommandDispatcher({
    reloadWorld() {
      requestAppRestart(() => options.onReloadRequested?.());
    },
    goHome() {
      resetPlayerToHome();
    },
    changeWorld(worldId) {
      requestAppRestart(() => options.onWorldChangeRequested?.(worldId));
    },
    setDebugOverlayEnabled(enabled) {
      applyMenuDebugState(setRuntimeMenuDebugOverlayEnabled(menuState, enabled));
    },
  });
  const desktopToolIndicator = createDesktopToolIndicator(document.body);
  const desktopScenePaletteInput = createDesktopScenePaletteInput();
  const xrScenePaletteInput = createXrScenePaletteInput();
  const xrControllerHandModels = createXrControllerHandModels(scene);
  const runtimeObjectRegistry = createRuntimeObjectRegistry();
  const desktopFlagEditor = createDesktopFlagEditor(document.body, {
    onMessageChanged(flagId, message) {
      const flag = runtimeObjectRegistry.get(flagId);
      if (flag?.kind !== "placed-flag") {
        return;
      }

      const nextFlag = updatePlacedFlagMessage(flag, message);
      runtimeObjectRegistry.update(nextFlag);
      syncPlacedFlagRuntime(nextFlag);
    },
    onFontColorChanged(flagId, fontColor) {
      const flag = runtimeObjectRegistry.get(flagId);
      if (flag?.kind !== "placed-flag") {
        return;
      }

      const nextFlag = updatePlacedFlagFontColor(flag, fontColor);
      runtimeObjectRegistry.update(nextFlag);
      syncPlacedFlagRuntime(nextFlag);
    },
    onDeleteRequested(flagId) {
      const flag = runtimeObjectRegistry.get(flagId);
      if (flag?.kind !== "placed-flag") {
        return;
      }

      runtimeObjectRegistry.remove(flagId);
      removePlacedFlagRuntime(flagId);
      syncRuntimeObjectPortalInstances();
    },
    onClosed() {
      menuState = setRuntimeMenuEditingFlagId(menuState, undefined);
      syncDesktopPalette();
      void controls.requestPointerLock();
    },
  });
  const aimCrossMarker = createAimCrossMarker(scene);
  const aimControllerRayPositions = new Float32Array(6);
  const aimControllerRayGeometry = new THREE.BufferGeometry();
  aimControllerRayGeometry.setAttribute("position", new THREE.BufferAttribute(aimControllerRayPositions, 3));
  const aimControllerRayMaterial = new THREE.LineBasicMaterial({
    color: 0xef1b1b,
    transparent: true,
    opacity: 0.74,
    depthTest: false,
    depthWrite: false,
  });
  const aimControllerRay = new THREE.Line(aimControllerRayGeometry, aimControllerRayMaterial);
  aimControllerRay.name = "aim-controller-ray";
  aimControllerRay.renderOrder = 49;
  aimControllerRay.frustumCulled = false;
  aimControllerRay.visible = false;
  scene.add(aimControllerRay);
  const floatingObjectTooltip = createFloatingObjectTooltip(document.body);
  const helpLensRenderer = createHelpLensRenderer(document.body, scene);
  const xrEntryUi = createXrEntryUi(container, enterVr);
  const clipPolygonOverlay = createPortalClipPolygonOverlay(container);
  const sceneLighting = createStylizedSceneLighting(scene);
  const scenePaletteController = createScenePaletteController({
    scene,
    getCamera: () => camera,
    getIsOpen: () => menuState.isOpen,
    onOpenRequested() {
      menuState = openRuntimeMenu(menuState);
      syncDesktopPalette();
    },
    onCloseRequested() {
      fixedXrPalettePlacement = undefined;
      cancelRuntimeMenuAndSelectedTool();
    },
    onShowSettingsRequested() {
      menuState = showRuntimeMenuSettings(menuState);
      syncDesktopPalette();
    },
    onShowMainRequested() {
      menuState = menuState.page === "debug-settings"
        ? showRuntimeMenuSettings(menuState)
        : menuState.page === "tutorial" || menuState.page === "goal"
          ? showRuntimeMenuQuestionHelp(menuState)
          : showRuntimeMenuMainPage(menuState);
      syncDesktopPalette();
    },
    onWorldSelected(worldId) {
      if (!appConfig.menu.worldSelectionSectionEnabled) {
        return;
      }
      menuState = setRuntimeMenuSelectedWorldId(menuState, worldId);
      syncDesktopPalette();
      dispatchRuntimeCommand({ kind: "change-world", worldId });
    },
    onReloadRequested() {
      requestConfirmedReload();
    },
    onHomeRequested() {
      dispatchRuntimeCommand({ kind: "go-home" });
    },
    onDebugEnabledChanged(enabled) {
      if (!appConfig.menu.debugSectionEnabled) {
        return;
      }
      applyMenuDebugState(setRuntimeMenuDebugEnabled(menuState, enabled));
    },
    onDebugSettingsRequested() {
      if (!appConfig.menu.debugSectionEnabled) {
        return;
      }
      menuState = showRuntimeMenuDebugSettings(menuState);
      syncDesktopPalette();
    },
    onConsoleLogLevelSelected(level) {
      applyMenuDebugState(setRuntimeMenuConsoleLogLevel(menuState, level));
    },
    onDebugOverlayToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuDebugOverlayEnabled(menuState, enabled));
    },
    onDebugOverlayItemToggled(itemId, enabled) {
      applyMenuDebugState(toggleRuntimeMenuDebugOverlayItem(menuState, itemId, enabled));
    },
    onAntiNauseaModeToggled(enabled) {
      applyMenuComfortState(setRuntimeMenuAntiNauseaModeEnabled(menuState, enabled));
    },
    onPortalPanelModeSelected(mode) {
      applyMenuDebugState(setRuntimeMenuPortalPanelMode(menuState, mode));
    },
    onPortalInspectionToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuPortalInspectionEnabled(menuState, enabled));
    },
    onCollisionGeometryWireframesToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuCollisionGeometryWireframesEnabled(menuState, enabled));
    },
    onAimCollisionOutlinesToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuAimCollisionOutlinesEnabled(menuState, enabled));
    },
    onCopyUrlWithOptionsRequested() {
      options.onCopyUrlWithOptionsRequested?.();
    },
    onToolSelected(toolId) {
      if (!isRuntimeToolEnabled(appConfig, toolId)) {
        return;
      }
      if (toolId !== "protractor") {
        activeProtractorToolState = {};
        clearProtractorToolFeedback();
      }
      if (toolId !== "geodesic-cannon-tie-detach") {
        syncTieAndDetachSelectionHighlights([]);
        syncRuntimeObjectPortalInstances();
        activeGeodesicCannonToolState = {
          ...activeGeodesicCannonToolState,
          tieAndDetachGeodesicIds: undefined,
        };
      }
      menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, toolId));
      syncDesktopPalette();
    },
    onPlaceFlagOptionsRequested() {
      if (!isRuntimeToolEnabled(appConfig, "place-flag")) {
        return;
      }
      menuState = showRuntimeMenuPlaceFlagOptions(menuState);
      syncDesktopPalette();
    },
    onPlaceFlagTypeSelected(flagType) {
      if (!isRuntimeToolEnabled(appConfig, "place-flag")) {
        return;
      }
      menuState = closeRuntimeMenu(selectRuntimeMenuPlaceFlagToolType(menuState, flagType));
      syncDesktopPalette();
    },
    onGeodesicCannonAddRequested(cannonId) {
      if (!isRuntimeToolEnabled(appConfig, "geodesic-cannon")) {
        return;
      }
      addGeodesicToCannon(cannonId);
    },
    onGeodesicCannonCarryRequested(cannonId) {
      if (!isRuntimeToolEnabled(appConfig, "geodesic-cannon-carry")) {
        return;
      }
      startGeodesicCannonCarry(cannonId);
    },
    onGeodesicCannonTieAndDetachRequested(cannonId) {
      if (!isRuntimeToolEnabled(appConfig, "geodesic-cannon-tie-detach")) {
        return;
      }
      startGeodesicCannonTieAndDetach(cannonId);
    },
    onGeodesicCannonRotateRequested(cannonId, geodesicId) {
      if (!isRuntimeToolEnabled(appConfig, "geodesic-cannon-rotate")) {
        return;
      }
      startGeodesicCannonRotation(cannonId, geodesicId);
    },
    onGeodesicCannonAimRequested(cannonId, geodesicId) {
      if (!isRuntimeToolEnabled(appConfig, "geodesic-cannon-aim")) {
        return;
      }
      startGeodesicCannonAim(cannonId, geodesicId);
    },
    onGeodesicCannonDeleteRequested(cannonId, geodesicId) {
      deleteGeodesicFromCannon(cannonId, geodesicId);
    },
    onGeometryComputerSetSkewRequested(computerId, skewXMeters) {
      setGeometryComputerSkewTarget(computerId, skewXMeters);
    },
    onGeometryComputerStepSkewRequested(computerId, deltaXMeters) {
      stepGeometryComputerSkewTarget(computerId, deltaXMeters);
    },
    onQuestionHelpTutorialRequested() {
      menuState = showRuntimeMenuQuestionTutorial(menuState);
      syncDesktopPalette();
    },
    onQuestionHelpGoalRequested() {
      menuState = showRuntimeMenuGoal(menuState);
      syncDesktopPalette();
    },
    onTutorialPreviousRequested() {
      stepOpenTutorialPage(-1);
    },
    onTutorialNextRequested() {
      stepOpenTutorialPage(1);
    },
    onGoalPreviousRequested() {
      stepOpenGoalPage(-1);
    },
    onGoalNextRequested() {
      stepOpenGoalPage(1);
    },
    onSignKeyboardCharacter(character) {
      appendEditingSignCharacter(character);
    },
    onSignKeyboardBackspace() {
      backspaceEditingSignMessage();
    },
    onSignDeleteRequested() {
      deleteEditingSign();
    },
  });

  const cellMeshes = new Map<string, THREE.Object3D>();
  const rootRenderPathMaxDepth = 10;
  const maxVisiblePaths = 2_000;
  const portalPathOptions = {
    maxDepth: rootRenderPathMaxDepth,
    skipImmediateReverse: true,
    toleranceMeters: 1e-6,
    maxKeptPathsPerRoot: 50_000,
  } as const;
  const deformationFamilyRegistry = createDefaultWorldDeformationFamilyRegistry();
  const initialWorldSnapshot: WorldGeometrySnapshot = {
    version: 0,
    deformation: createInitialWorldDeformationState(options.worldSpec),
    spec: options.worldSpec,
    world: appState.world,
    staticCull: buildStaticallyCulledPortalPathTables(appState.world, portalPathOptions),
    buildStats: {
      requestedAtMs: performance.now(),
      completedAtMs: performance.now(),
      worker: false,
    },
  };
  let activeWorldBundle = createActiveWorldBundle(initialWorldSnapshot);
  const geometrySession = createWorldGeometrySession({
    baseSpec: options.worldSpec,
    initialSnapshot: initialWorldSnapshot,
    familyRegistry: deformationFamilyRegistry,
    portalPathOptions,
    stepOptions: {
      maxStepMeters: 0.08,
      snapToleranceMeters: 1e-6,
    },
  });
  const activeWorld = () => activeWorldBundle.snapshot.world;
  const activeStaticCull = () => activeWorldBundle.snapshot.staticCull;

  function createActiveWorldBundle(snapshot: WorldGeometrySnapshot): ActiveWorldBundle {
    return {
      snapshot,
      archetypeCapacitiesByCellId: deriveCellRenderArchetypeCapacities(
        snapshot.world,
        snapshot.staticCull,
        maxVisiblePaths,
      ),
      warmupViewsByCellId: new Map(
        snapshot.world.cells.map((cell) => [cell.id, createCellWarmupViews(cell)] as const),
      ),
    };
  }

  const dynamicObjectRuntimes: Array<GeodesciMarmotRuntime | SimpleGeoCreatureRuntime> = [];
  const placedFlagRuntimes = new Map<string, PlacedFlagRuntime>();
  const measuredGeodesicLengthRuntimes = new Map<string, MeasuredGeodesicLengthRuntime>();
  const protractorAngleRuntimes = new Map<string, ProtractorAngleRuntime>();
  let placedFlagIdCounter = 0;
  let geodesicCannonIdCounter = 0;
  let geodesicIdCounter = 0;
  let measuredGeodesicLengthIdCounter = 0;
  let protractorAngleIdCounter = 0;
  let activeGeodesicCannonToolState: {
    readonly selectedCannonId?: string;
    readonly activeGeodesicId?: string;
    readonly carryPortalWord?: readonly GeodesicPortalTraversal[];
    readonly carryPortalWordsByGeodesicId?: Readonly<Record<string, readonly GeodesicPortalTraversal[]>>;
    readonly carryPortalTransitionSerial?: number;
    readonly carryPortalTransitionSerialByGeodesicId?: Readonly<Record<string, number>>;
    readonly tieAndDetachGeodesicIds?: readonly string[];
  } = {};
  let activeProtractorToolState: {
    readonly center?: ProtractorCenterSelection;
    readonly first?: ProtractorDirectedGeodesic;
  } = {};
  let protractorToolFeedback: {
    readonly signature: string;
    readonly cellId: string;
    readonly root: THREE.Group;
  } | undefined;
  let carriedGeodesicCannonGlow: THREE.Mesh | undefined;
  let geodesicCreatureDebugElapsedSeconds = 0;
  let geodesicCreatureHealthyLogElapsedSeconds = geodesicCreatureHealthyLogIntervalSeconds;
  let helpLensFocusedObjectId: string | undefined;
  const runtimeObjectRenderRoot = new THREE.Group();
  runtimeObjectRenderRoot.name = "runtime-object-archetype-renders";
  scene.add(runtimeObjectRenderRoot);
  const runtimeObjectRootsById = new Map<string, THREE.Object3D>();
  const runtimeObjectRenderSourcesByKey = new Map<string, RuntimeObjectRenderSourceMesh>();
  const runtimeObjectRenderArchetypesByKey = new Map<string, RuntimeObjectRenderArchetype>();
  const staticObjectCollisionWireframeGroupsByCellId = new Map<string, THREE.Group>();
  const selectableHitboxDebugGroupsByCellId = new Map<string, THREE.Group>();
  const aimCollisionOutlineDebugGroupsByCellId = new Map<string, THREE.Group>();
  const geodesicEmitterLabelsByKey = new Map<string, {
    readonly text: string;
    readonly root: THREE.Object3D;
  }>();
  const geodesicRuntimeRenderSources = createGeodesicRuntimeRenderSources(options.assets);
  const geodesicRuntimeArchetypeKeys = geodesicRuntimeRenderSources.map((source) => source.archetypeKey);
  const runtimeObjectRenderDiagnostics = createRuntimeObjectRenderArchetypeDiagnostics();
  const playerRoverRenderModel = createPlayerRoverRenderModel(options.assets);
  const portalInstanceDiagnostics = createPortalInstanceDiagnostics();
  const portalClipData = createPortalClipData({ maxVisiblePaths });
  const portalClipMaterialState = createPortalClipMaterialState(
    portalClipData,
    getPortalViewportPixels(renderer),
    { smoothClipEdges: options.renderQualityEnabled && portalClipEdgeSmoothingEnabled },
  );
  let latestVisibleResult: ComputeVisiblePortalPathsResult | undefined;
  let portalEyeRenderStates: readonly PortalEyeRenderState[] = [];
  let activePortalEyeIndex = 0;
  let latestPlayerPortalTransition: GeodesicCarryPortalTransition | undefined;
  let latestPlayerPortalTransitionSerial = 0;
  let portalInstanceRenderState: PortalInstanceRenderDebugState = {
    enabled: true,
    ShowCellPathRendersInstances: showCellPathRendersInstances,
    archetypeCount: 0,
    totalCapacity: 0,
    renderedInstanceCount: 0,
    renderedInstanceCountByCell: [],
    capacityOverflowCount: 0,
    capacityOverflowArchetypes: [],
    normalVisiblePathRenderingActive: false,
    visiblePathIds: [],
    visiblePathDestinations: [],
    clipPolygonVertexCountsByPath: [],
    clipPolygonOverflowPathIds: [],
    visiblePathOverflowCount: 0,
  };
  let cellRenderArchetypes: readonly CellRenderArchetype[] = [];
  let portalInstanceDebugRenderer: PortalInstanceDebugRenderer | undefined;
  let visibleCellId: string | undefined = playerPose.cellId;

  rebuildCellMeshes();
  applyDesktopCameraPose();
  syncPortalInstanceRender();
  let portalDebugRuntime = createPortalDebugRuntime();
  logDebugStartupGuide(debugLevel, debugOptions);
  installGeneralDebugHelpers({
    debugHelp: () => logDebugStartupGuide(debugLevel, debugOptions),
    dumpGeodesicCreatures: dumpGeodesicCreatures,
    dumpGeodesicPath: dumpGeodesicPath,
    dumpLockedGeodesicWords: dumpLockedGeodesicWords,
  });
  installGeometryDebugHelpersIfAvailable();
  syncDesktopPalette();

  for (const cell of activeWorld().cells) {
    for (const objectSpec of cell.objects) {
      if (isGeodesciMarmotObjectSpec(objectSpec)) {
        const runtime = createGeodesciMarmotRuntime(objectSpec, cell.id, options.assets, runtimeObjectRegistry);
        runtime.syncParent(cellMeshes);
        dynamicObjectRuntimes.push(runtime);
        runtimeObjectRootsById.set(runtime.objectId, runtime.root);
        syncDynamicObjectDebugWireframes();
        continue;
      }

      if (isSimpleGeoCreatureObjectSpec(objectSpec)) {
        const runtime = createSimpleGeoCreatureRuntime(objectSpec, cell.id, options.assets, runtimeObjectRegistry);
        runtime.syncParent(cellMeshes);
        dynamicObjectRuntimes.push(runtime);
        runtimeObjectRootsById.set(runtime.objectId, runtime.root);
        syncDynamicObjectDebugWireframes();
        continue;
      }

      if (objectSpec.kind === "asset" && objectSpec.collision) {
        runtimeObjectRegistry.add(createRuntimeStaticAssetObject(objectSpec, cell.id));
      }
    }
  }
  syncStaticObjectCollisionWireframes();
  syncRuntimeObjectPortalInstances();
  disableFrustumCulling(scene);
  disableShadows(scene);

  function applyDesktopCameraPose(): void {
    xrRig.syncDesktopCamera(playerPose);
    updateStylizedSceneLighting(sceneLighting, camera);
  }

  void detectXrSessionState(navigator, window.isSecureContext).then((state) => {
    xrSessionState = state;
    xrEntryUi.update(xrSessionState);
    syncXrDebugState("desktop");
  });
  xrEntryUi.update(xrSessionState);

  const warmupStartMs = performance.now();
  prerenderCells({
    renderer,
    scene,
    camera,
    cellMeshes,
    activeCellId: playerPose.cellId,
    warmupViewsByCellId: activeWorldBundle.warmupViewsByCellId,
  });
  runtimeDiagnostics().recordWarmup("startup", performance.now() - warmupStartMs);

  function updateVisibleCell(): void {
    if (visibleCellId === playerPose.cellId) {
      return;
    }

    for (const [cellId, cellMesh] of cellMeshes) {
      cellMesh.visible = cellId === playerPose.cellId;
    }

    visibleCellId = playerPose.cellId;
  }

  function onResize(): void {
    const canvasSize = getWindowCssCanvasSize(window);
    camera.aspect = canvasSize.width / canvasSize.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(canvasSize.width, canvasSize.height);
    updatePortalClipMaterialViewport(
      portalClipMaterialState,
      getPortalViewportPixels(renderer),
    );
  }

  function renderFrame(_time?: DOMHighResTimeStamp, xrFrame?: XRFrame): void {
    const frameStartMs = performance.now();
    const deltaSeconds = clock.getDelta();
    const frameRateFps = deltaSeconds > 0 ? 1 / deltaSeconds : undefined;
    smoothedFrameRateFps = frameRateFps === undefined
      ? smoothedFrameRateFps
      : smoothedFrameRateFps === undefined
        ? frameRateFps
        : THREE.MathUtils.lerp(smoothedFrameRateFps, frameRateFps, 0.15);
    commitReadyWorldGeometrySnapshot();
    const xrActive = renderer.xr.isPresenting && xrSessionState.status === "active";
    const xrReferenceSpace = xrActive ? renderer.xr.getReferenceSpace() : null;
    const xrViewerPose = xrActive && xrFrame && xrReferenceSpace
      ? xrFrame.getViewerPose(xrReferenceSpace)
      : undefined;
    const headLocalMeters = xrActive
      ? headLocalMetersFromViewerPose(xrViewerPose)
      : undefined;
    const headLocalYawRadians = xrActive
      ? headYawRadiansFromViewerPose(xrViewerPose)
      : undefined;
    const frameBeforeInputMs = performance.now();
    const frame = xrActive ? getXrInputFrame(deltaSeconds) : getDesktopInputFrame(deltaSeconds);
    vrComfortVignette.update({
      active: xrActive && isArtificialLocomotionActive(frame),
      deltaSeconds,
      normalFovDegrees: camera.fov,
    });
    const rotatingGeodesicCannon = menuState.selectedTool === "geodesic-cannon-rotate";
    const aimingGeodesicCannon = menuState.selectedTool === "geodesic-cannon-aim";
    const effectiveHeadLocalMeters = rotatingGeodesicCannon && xrActive
      ? freezeXrHeadHeightDuringGeodesicCannonRotation(headLocalMeters)
      : headLocalMeters;
    if (!rotatingGeodesicCannon) {
      geodesicCannonRotationHeadHeightMeters = undefined;
    }
    if (!rotatingGeodesicCannon && !aimingGeodesicCannon) {
      geodesicCannonRotationTargetLengthMeters = undefined;
    }
    const frameAfterInputMs = performance.now();
    const frameBeforeMoveMs = frameAfterInputMs;
    const previousCellId = playerPose.cellId;
    let moveResult: ReturnType<typeof movePlayer> | undefined;

    if (frame.resetRequested) {
      resetPlayerToHome();
      resetRuntimeWorld();
    } else {
      const yawDeltaRadians = xrActive
        ? xrRig.resolveCameraYawRadians(headLocalYawRadians) - playerPose.yawRadians + frame.yawDeltaRadians
        : frame.yawDeltaRadians;
      const playerYawDeltaRadians = rotatingGeodesicCannon ? 0 : yawDeltaRadians;
      moveResult = movePlayer({
        world: activeWorld(),
        pose: playerPose,
        body: appState.playerBody,
        localDisplacement: rotatingGeodesicCannon ? { x: 0, y: 0, z: 0 } : frame.localDisplacement,
        yawDeltaRadians: playerYawDeltaRadians,
        pitchDeltaRadians: rotatingGeodesicCannon ? 0 : frame.pitchDeltaRadians,
        coordinateFrame: "global",
      });
      moveResult = blockPlayerMoveAgainstRuntimeObjects(playerPose, moveResult);
      playerPose = moveResult.pose;
      recordCellTransition(previousCellId, moveResult);

      if (xrActive && !rotatingGeodesicCannon) {
        const beforePhysicalCellId = playerPose.cellId;
        const physicalReferenceSpaceYawRadians = playerPose.yawRadians - (headLocalYawRadians ?? 0);
        const physicalFrame = xrRig.consumePhysicalInput(
          effectiveHeadLocalMeters,
          playerPose.yawRadians,
          physicalReferenceSpaceYawRadians,
        );
        const physicalMoveResult = movePlayer({
          world: activeWorld(),
          pose: playerPose,
          body: appState.playerBody,
          localDisplacement: physicalFrame.localDisplacement,
          yawDeltaRadians: 0,
          pitchDeltaRadians: 0,
          coordinateFrame: "global",
        });
        const runtimeCollisionPhysicalMoveResult = blockPlayerMoveAgainstRuntimeObjects(playerPose, physicalMoveResult);
        playerPose = runtimeCollisionPhysicalMoveResult.pose;
        xrRig.acceptPhysicalMove(runtimeCollisionPhysicalMoveResult, effectiveHeadLocalMeters);
        moveResult = runtimeCollisionPhysicalMoveResult.blocked || runtimeCollisionPhysicalMoveResult.crossedPortal
          ? runtimeCollisionPhysicalMoveResult
          : moveResult;
        recordCellTransition(beforePhysicalCellId, runtimeCollisionPhysicalMoveResult);
      }
    }

    if (xrActive) {
      xrRig.syncXrRig(playerPose, effectiveHeadLocalMeters, headLocalYawRadians);
    } else {
      applyDesktopCameraPose();
    }
    const xrHeadWorldPose = xrActive ? resolveXrHeadWorldPose(xrViewerPose) : undefined;
    const activeAimRay = resolveActiveRootAimRay(xrActive, xrFrame, xrReferenceSpace);
    updateCarriedGeodesicCannonPose(xrActive, activeAimRay);
    if (frame.helpRequested && !desktopFlagEditor.isOpen()) {
      requestHelpLensForFocusedObject(activeAimRay);
    }
    const worldPrimaryActionRequested = frame.primaryActionRequested && !menuState.isOpen && !desktopFlagEditor.isOpen();
    let primaryActionConsumed = false;
    if (frame.carryActionRequested && !menuState.isOpen && !desktopFlagEditor.isOpen()) {
      primaryActionConsumed = menuState.selectedTool === "geodesic-cannon-carry"
        ? finishGeodesicCannonCarry()
        : tryStartFocusedGeodesicCannonCarry(activeAimRay);
    }

    if (menuState.selectedTool === "geodesic-cannon-carry") {
      if (frame.primaryActionRequested) {
        finishGeodesicCannonCarry();
        primaryActionConsumed = true;
      }
    } else if (menuState.selectedTool === "geodesic-cannon-rotate") {
      updateActiveGeodesicCannonRotation(frame.yawDeltaRadians, frame.primaryActionRequested);
      primaryActionConsumed = frame.primaryActionRequested;
    } else if (menuState.selectedTool === "geodesic-cannon-aim") {
      updateActiveGeodesicCannonAim(frame.primaryActionRequested, activeAimRay);
      primaryActionConsumed = frame.primaryActionRequested;
    } else if (worldPrimaryActionRequested && menuState.selectedTool === "geodesic-cannon-tie-detach") {
      primaryActionConsumed = trySelectTieAndDetachGeodesicFromAim(activeAimRay);
    } else if (worldPrimaryActionRequested && menuState.selectedTool === "place-flag") {
      tryPlaceFlagFromAim(activeAimRay);
      primaryActionConsumed = true;
    } else if (worldPrimaryActionRequested && menuState.selectedTool === "geodesic-cannon") {
      tryUseGeodesicCannonToolFromAim(activeAimRay);
      primaryActionConsumed = true;
    } else if (worldPrimaryActionRequested && menuState.selectedTool === "measure-length") {
      tryUseMeasureLengthToolFromAim(activeAimRay);
      primaryActionConsumed = true;
    } else if (worldPrimaryActionRequested && menuState.selectedTool === "protractor") {
      tryUseProtractorToolFromAim(activeAimRay);
      primaryActionConsumed = true;
    } else if (
      worldPrimaryActionRequested &&
      !primaryActionConsumed &&
      (menuState.selectedTool === "none" || menuState.selectedTool === "aim")
    ) {
      primaryActionConsumed = tryUseFocusedObjectPrimaryInteraction(activeAimRay);
    }

    if (frame.interactRequested && !desktopFlagEditor.isOpen()) {
      openContextMenuFromAim(activeAimRay);
    }
    const frameAfterMoveMs = performance.now();
    const frameBeforeObjectsMs = frameAfterMoveMs;
    const playerObstacle = createPlayerCollisionState(playerPose);

    for (const runtime of dynamicObjectRuntimes) {
      runtime.update(activeWorld(), frame.resetRequested ? 0 : deltaSeconds, [playerObstacle]);
      runtime.syncParent(cellMeshes);
    }
    updateGeodesicCreatureDebug(deltaSeconds);
    for (const runtime of placedFlagRuntimes.values()) {
      runtime.syncParent(cellMeshes);
    }
    const straightenedGeodesicIds = advanceStraighteningGeodesics({
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      deltaSeconds: frame.resetRequested ? 0 : deltaSeconds,
    });
    for (const geodesicId of straightenedGeodesicIds) {
      refreshProtractorAnglesForGeodesic(geodesicId);
      refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    }
    if (straightenedGeodesicIds.length > 0) {
      syncSelectableHitboxDebug();
    }
    refreshMeasuredGeodesicLengths();
    const frameAfterObjectsMs = performance.now();
    const frameBeforeCameraMs = frameAfterObjectsMs;

    updateVisibleCell();
    let portalCullingCameras: readonly THREE.Camera[] = [camera];
    if (xrActive) {
      xrRig.syncXrRig(playerPose, effectiveHeadLocalMeters, headLocalYawRadians);
      portalCullingCamera.copy(camera, false);
      xrRig.syncXrCullingCamera(portalCullingCamera, xrViewerPose);
      const xrEyeCameras = xrRig.syncXrViewCullingCameras(portalCullingEyeCameras, xrViewerPose);
      portalCullingCameras = xrEyeCameras.length > 0 ? xrEyeCameras : [portalCullingCamera];
      updateStylizedSceneLighting(sceneLighting, camera);
    } else {
      applyDesktopCameraPose();
    }
    updateFloatingObjectTooltip(xrActive, activeAimRay, xrHeadWorldPose);
    updateHelpLens(xrActive, activeAimRay);
    const frameAfterCameraMs = performance.now();
    const frameBeforePortalMs = frameAfterCameraMs;

    if (xrActive && portalCullingCameras.length > 1) {
      syncStereoPortalInstanceRender(portalCullingCameras.map(resolvePortalEyeRenderRoot));
    } else {
      const cullingCamera = portalCullingCameras[0] ?? camera;
      syncPortalInstanceRender(xrActive ? resolvePortalEyeRenderRoot(cullingCamera) : {
        rootCellId: playerPose.cellId,
        camera: cullingCamera,
        renderFromRootMatrix: new THREE.Matrix4(),
      });
    }
    syncRuntimeObjectPortalInstances();
    const frameAfterPortalMs = performance.now();
    const frameBeforeUiMs = frameAfterPortalMs;

    updateAimCrossMarker(xrActive, activeAimRay);
    updateProtractorToolFeedback(activeAimRay);
    updateGeodesicEmitterLabels();
    syncXrDebugState(frame.source, moveResult);
    updateScenePalette(xrActive, xrFrame, xrReferenceSpace, xrHeadWorldPose, deltaSeconds, frame);
    portalDebugRuntime.updateVisiblePortalPaths();
    const frameAfterUiMs = performance.now();
    const frameBeforeRenderMs = performance.now();
    renderer.render(scene, camera);
    const frameAfterRenderMs = performance.now();
    const framePerformance: FramePerformanceRenderState = {
      totalMs: frameAfterRenderMs - frameStartMs,
      inputMs: frameAfterInputMs - frameBeforeInputMs,
      moveMs: frameAfterMoveMs - frameBeforeMoveMs,
      objectsMs: frameAfterObjectsMs - frameBeforeObjectsMs,
      cameraMs: frameAfterCameraMs - frameBeforeCameraMs,
      portalMs: frameAfterPortalMs - frameBeforePortalMs,
      uiMs: frameAfterUiMs - frameBeforeUiMs,
      renderMs: frameAfterRenderMs - frameBeforeRenderMs,
    };
    smoothedFramePerformance = smoothFramePerformance(smoothedFramePerformance, framePerformance);
    latestWebGlRenderInfo = captureWebGlRenderInfo(renderer);
    runtimeDiagnostics().recordFrame(playerPose.cellId, {
      totalMs: framePerformance.totalMs,
      moveMs: framePerformance.moveMs,
      renderMs: framePerformance.renderMs,
    });
  }

  function commitReadyWorldGeometrySnapshot(): void {
    const snapshot = geometrySession.pollReadySnapshot();
    if (!snapshot) {
      return;
    }

    commitWorldGeometrySnapshot(snapshot);
  }

  function commitWorldGeometrySnapshot(snapshot: WorldGeometrySnapshot): void {
    const previousSnapshot = activeWorldBundle.snapshot;
    const family = getWorldDeformationFamilyOrThrow(deformationFamilyRegistry, snapshot.deformation.kind);
    const mapByCellId = family.createDynamicObjectMaps(
      previousSnapshot.deformation as never,
      snapshot.deformation as never,
      previousSnapshot.world,
      snapshot.world,
    );

    transformPlayerForGeometryCommit(mapByCellId);
    transformRuntimeObjectsForGeometryCommit(mapByCellId, snapshot);
    activeWorldBundle = createActiveWorldBundle(snapshot);
    latestVisibleResult = undefined;
    portalEyeRenderStates = [];
    activePortalEyeIndex = 0;
    clearGeometryToolStateAfterCommit();
    rebuildCellMeshes();
    for (const runtime of dynamicObjectRuntimes) {
      runtime.syncParent(cellMeshes);
    }
    for (const runtime of placedFlagRuntimes.values()) {
      runtime.syncParent(cellMeshes);
    }
    syncPortalInstanceRender();
    syncRuntimeObjectPortalInstances();
    syncDynamicObjectDebugWireframes();
    syncStaticObjectCollisionWireframes();
    syncSelectableHitboxDebug();
    applyDesktopCameraPose();
    portalDebugRuntime.dispose();
    portalDebugRuntime = createPortalDebugRuntime();
    installRuntimeDiagnostics(
      activeWorld(),
      debugLevel,
      hasActiveDebugOption(debugLevel, debugOptions, "runtime-diagnostics"),
    );
  }

  function transformPlayerForGeometryCommit(
    mapByCellId: ReadonlyMap<string, CellDeformationMap>,
  ): void {
    const transformed = transformPoseWithCellMaps(
      {
        cellId: playerPose.cellId,
        localPose: yawRigidTransform3(playerPose.yawRadians, playerPose.position),
      },
      mapByCellId,
    );

    if (!transformed || !activeWorld().cellsById.has(transformed.cellId)) {
      resetPlayerToHome();
      return;
    }

    playerPose = {
      ...playerPose,
      cellId: transformed.cellId,
      position: transformed.localPose.translation,
      yawRadians: yawFromPose(transformed.localPose),
    };
  }

  function transformRuntimeObjectsForGeometryCommit(
    mapByCellId: ReadonlyMap<string, CellDeformationMap>,
    snapshot: WorldGeometrySnapshot,
  ): void {
    for (const runtime of dynamicObjectRuntimes) {
      runtime.transformGeometry(mapByCellId);
    }

    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "asset") {
        runtimeObjectRegistry.remove(object.id);
      }
    }

    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "placed-flag") {
        const transformed = transformPoseWithCellMaps(object, mapByCellId);
        if (!transformed) {
          runtimeObjectRegistry.remove(object.id);
          removePlacedFlagRuntime(object.id);
          continue;
        }

        const nextObject = {
          ...object,
          cellId: transformed.cellId,
          localPose: transformed.localPose,
        };
        runtimeObjectRegistry.update(nextObject);
        syncPlacedFlagRuntime(nextObject);
      } else if (object.kind === "geodesic-cannon") {
        const transformed = transformGeodesicCannonForGeometryCommit(object, mapByCellId);
        if (!transformed) {
          runtimeObjectRegistry.remove(object.id);
          continue;
        }

        runtimeObjectRegistry.update(transformed);
      }
    }

    rebuildStaticAssetRegistryObjects(snapshot);
    rebuildGeometryDependentRuntimeObjectsAfterCommit(snapshot);
  }

  function transformGeodesicCannonForGeometryCommit(
    object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    mapByCellId: ReadonlyMap<string, CellDeformationMap>,
  ): Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }> | undefined {
    const map = mapByCellId.get(object.cellId);
    if (!map) {
      return undefined;
    }

    const position = map.mapPoint(object.localPose.translation);
    const aimYawRadians = transformYawWithMap(object.aimYawRadians, object.localPose.translation, map);
    const geodesicEmitterYawRadiansById = object.geodesicEmitterYawRadiansById
      ? Object.fromEntries(
          Object.entries(object.geodesicEmitterYawRadiansById).map(([geodesicId, yawRadians]) => [
            geodesicId,
            transformYawWithMap(yawRadians, object.localPose.translation, map),
          ]),
        )
      : undefined;

    return {
      ...object,
      cellId: map.cellId,
      localPose: yawRigidTransform3(aimYawRadians, position),
      aimYawRadians,
      geodesicEmitterYawRadiansById,
    };
  }

  function transformYawWithMap(
    yawRadians: number,
    atPoint: Vec3,
    map: CellDeformationMap,
  ): number {
    return yawFromPose(transformRigidPoseWithMap(yawRigidTransform3(yawRadians, atPoint), map));
  }

  function rebuildStaticAssetRegistryObjects(snapshot: WorldGeometrySnapshot): void {
    for (const cell of snapshot.world.cells) {
      for (const objectSpec of cell.objects) {
        if (objectSpec.kind === "asset" && objectSpec.collision) {
          runtimeObjectRegistry.add(createRuntimeStaticAssetObject(objectSpec, cell.id));
        }
      }
    }
  }

  function rebuildGeometryDependentRuntimeObjectsAfterCommit(snapshot: WorldGeometrySnapshot): void {
    applyGeometryCommitComputedObjectPolicy({
      world: snapshot.world,
      registry: runtimeObjectRegistry,
      playerCellId: playerPose.cellId,
      playerPoint: playerPose.position,
      callbacks: {
        removeMeasuredGeodesicLength: removeMeasuredGeodesicLengthRuntime,
        syncMeasuredGeodesicLength: syncMeasuredGeodesicLengthRuntime,
        removeProtractorAngle: removeProtractorAngleRuntime,
        syncProtractorAngle: syncProtractorAngleRuntime,
      },
    });
  }

  function clearGeometryToolStateAfterCommit(): void {
    activeGeodesicCannonToolState = {};
    activeProtractorToolState = {};
    clearCarriedGeodesicCannonGlow();
    clearProtractorToolFeedback();
    refreshOpenGeometryComputerMenu();
    syncDesktopPalette();
  }

  function installGeometryDebugHelpersIfAvailable(): void {
    if (geometrySession.state.current.kind !== "torus-skew" && debugLevel === "off") {
      uninstallGeometryDebugHelpers();
      return;
    }

    const helpers: GeometryDebugHelpers = {
      SetTorusSkew(skewXMeters) {
        const current = geometrySession.state.current;
        if (current.kind !== "torus-skew") {
          throw new Error("Torus skew is not available for the active world.");
        }

        geometrySession.setTarget({
          ...current,
          skewXMeters,
        });
      },
      StepTorusSkew(deltaXMeters) {
        const state = geometrySession.state;
        const base = state.target.kind === "torus-skew"
          ? state.target
          : state.current.kind === "torus-skew"
            ? state.current
            : undefined;
        if (!base) {
          throw new Error("Torus skew is not available for the active world.");
        }

        geometrySession.setTarget({
          ...base,
          skewXMeters: base.skewXMeters + deltaXMeters,
        });
      },
      Cancel() {
        geometrySession.cancel();
      },
      get state() {
        return geometrySession.state;
      },
    };

    (window as WindowWithGeometryDebugHelpers).noneuclidGeometry = helpers;
  }

  function applyMenuDebugState(nextMenuState: typeof menuState): void {
    menuState = nextMenuState;
    syncLaunchOptionsState();
    applyDebugSettings(createDebugSettingsFromRuntimeMenuState(menuState));
    syncDesktopPalette();
  }

  function applyMenuComfortState(nextMenuState: typeof menuState): void {
    menuState = nextMenuState;
    vrComfortOptions = {
      ...vrComfortOptions,
      antiNauseaModeEnabled: menuState.antiNauseaModeEnabled,
    };
    vrComfortVignette.setOptions(vrComfortOptions);
    syncLaunchOptionsState();
    syncDesktopPalette();
  }

  function applyDebugSettings(settings: DebugSettings): void {
    debugLevel = settings.debugLevel;
    portalPanelMode = settings.portalPanelMode;
    debugOptions = settings.debugOptions;
    showCellPathRendersInstances = hasActiveDebugOption(
      debugLevel,
      debugOptions,
      "portal-path-overlay-instances",
    );
    installRuntimeDiagnostics(
      activeWorld(),
      settings.debugLevel,
      hasActiveDebugOption(settings.debugLevel, settings.debugOptions, "runtime-diagnostics"),
    );
    rebuildCellMeshes();
    syncPortalInstanceRender();
    portalDebugRuntime.dispose();
    portalDebugRuntime = createPortalDebugRuntime();
    logDebugStartupGuide(debugLevel, debugOptions);
    installGeneralDebugHelpers({
      debugHelp: () => logDebugStartupGuide(debugLevel, debugOptions),
      dumpGeodesicCreatures: dumpGeodesicCreatures,
      dumpGeodesicPath: dumpGeodesicPath,
      dumpLockedGeodesicWords: dumpLockedGeodesicWords,
    });
    installGeometryDebugHelpersIfAvailable();
    for (const runtime of dynamicObjectRuntimes) {
      runtime.syncParent(cellMeshes);
    }
    syncDynamicObjectDebugWireframes();
    syncStaticObjectCollisionWireframes();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    applyDesktopCameraPose();
    renderer.render(scene, camera);
  }

  function dumpGeodesicCreatures(): GeodesicCreatureDebugDump {
    const dump = collectGeodesicCreatureDebugDump({
      world: activeWorld(),
      runtimes: dynamicObjectRuntimes,
      registry: runtimeObjectRegistry,
      cellRoots: cellMeshes,
    });
    console.info("[noneuclid] geodesic creature dump", dump);
    console.table(dump.records.map((record) => ({
      id: record.id,
      kind: record.kind,
      runtimeCellId: record.runtimeCellId,
      registryCellId: record.registryCellId,
      parentCellId: record.parentCellId,
      localPosition: record.localPosition
        ? `${record.localPosition.x}, ${record.localPosition.y}, ${record.localPosition.z}`
        : "(missing)",
      renderVisible: record.renderVisible,
      ancestorsVisible: record.ancestorsVisible,
      issues: record.issues.join(", "),
    })));
    return dump;
  }

  function dumpGeodesicPath(requestedGeodesicId?: string): GeodesicPathDebugDump | undefined {
    const geodesicId = requestedGeodesicId ?? resolveDebugGeodesicId();
    if (!geodesicId) {
      console.info("[noneuclid] geodesic path dump: no active or aimed geodesic.");
      return undefined;
    }

    const segments = getGeodesicSegments(runtimeObjectRegistry, geodesicId);
    const word = collectGeodesicPortalWord(activeWorld(), runtimeObjectRegistry, geodesicId);
    const carrySessionWord = activeGeodesicCannonToolState.carryPortalWordsByGeodesicId?.[geodesicId] ??
      (activeGeodesicCannonToolState.activeGeodesicId === geodesicId
        ? activeGeodesicCannonToolState.carryPortalWord
        : undefined);
    const start = segments[0]?.start;
    const dump: GeodesicPathDebugDump = {
      geodesicId,
      locked: isGeodesicLocked(runtimeObjectRegistry, geodesicId),
      connection: getGeodesicConnection(runtimeObjectRegistry, geodesicId),
      startCellId: segments[0]?.cellId,
      start: start ? formatVec3(start) : undefined,
      word,
      wordText: formatGeodesicPortalWord(word),
      carrySessionWord,
      carrySessionWordText: carrySessionWord
        ? formatGeodesicPortalWord(carrySessionWord)
        : undefined,
      reverseWordText: formatGeodesicPortalWord([...word].reverse().map(reverseGeodesicPortalTraversal)),
      latestPlayerPortalTransition,
      segments: segments.map((segment) => ({
        id: segment.id,
        cellId: segment.cellId,
        index: segment.segmentIndex,
        lengthMeters: Number(segment.lengthMeters.toFixed(4)),
        start: formatVec3(segment.start),
        direction: formatVec3(segment.direction),
        terminal: formatGeodesicTerminal(segment.terminal),
        connectionState: segment.connectionState ?? "open",
      })),
    };

    console.info("[noneuclid] geodesic path dump", dump);
    console.table(dump.segments);
    return dump;
  }

  function dumpLockedGeodesicWords(): readonly GeodesicWordDebugDump[] {
    const geodesicIds = collectKnownGeodesicIds()
      .filter((geodesicId) => isGeodesicLocked(runtimeObjectRegistry, geodesicId))
      .sort();
    const dumps = geodesicIds.map(createGeodesicWordDebugDump);
    console.info("[noneuclid] locked geodesic words", dumps);
    console.table(dumps.map((dump) => ({
      geodesicId: dump.geodesicId,
      startCellId: dump.startCellId,
      start: dump.start,
      word: dump.wordText,
      connection: dump.connection
        ? `${dump.connection.outgoingEmitterId}->${dump.connection.incomingEmitterId ?? "(open)"}:${dump.connection.state}`
        : "(none)",
    })));
    return dumps;
  }

  function createGeodesicWordDebugDump(geodesicId: string): GeodesicWordDebugDump {
    const segments = getGeodesicSegments(runtimeObjectRegistry, geodesicId);
    const word = collectGeodesicPortalWord(activeWorld(), runtimeObjectRegistry, geodesicId);
    const start = segments[0]?.start;
    return {
      geodesicId,
      locked: isGeodesicLocked(runtimeObjectRegistry, geodesicId),
      connection: getGeodesicConnection(runtimeObjectRegistry, geodesicId),
      startCellId: segments[0]?.cellId,
      start: start ? formatVec3(start) : undefined,
      word,
      wordText: formatGeodesicPortalWord(word),
      transitions: word.map((step, index) => ({
        index,
        sourceCellId: step.sourceCellId,
        sourcePortalId: step.sourcePortalId,
        targetCellId: step.targetCellId,
        targetPortalId: step.targetPortalId,
      })),
    };
  }

  function collectKnownGeodesicIds(): readonly string[] {
    const ids = new Set<string>();
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind === "geodesic-segment") {
        ids.add(object.geodesicId);
      } else if (object.kind === "geodesic-cannon") {
        for (const geodesicId of object.geodesicIds) {
          ids.add(geodesicId);
        }
        if (object.activeGeodesicId) {
          ids.add(object.activeGeodesicId);
        }
      }
    }
    return [...ids];
  }

  function resolveDebugGeodesicId(): string | undefined {
    if (activeGeodesicCannonToolState.activeGeodesicId) {
      return activeGeodesicCannonToolState.activeGeodesicId;
    }

    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
    const selectedCannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;
    if (selectedCannon?.kind === "geodesic-cannon") {
      return selectedCannon.activeGeodesicId ?? selectedCannon.geodesicIds[0];
    }

    const target = resolveCurrentAimTarget(resolveCameraRootRay());
    const object = target?.object;
    if (object?.kind === "geodesic-segment") {
      return object.geodesicId;
    }
    if (object?.kind === "geodesic-cannon") {
      return object.activeGeodesicId ?? object.geodesicIds[0];
    }

    return undefined;
  }

  function formatGeodesicTerminal(terminal: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>["terminal"]): string {
    switch (terminal.kind) {
      case "open":
        return "open";
      case "emitter-hit":
        return `emitter-hit:${terminal.emitterId}`;
      case "portal-hit":
        return `portal-hit:${terminal.portalId}->${terminal.targetCellId}:${terminal.targetPortalId}`;
      case "wall-hit":
        return `wall-hit:${terminal.sideIndex}`;
      case "forbidden-zone-hit":
        return `forbidden-zone-hit:${terminal.junctionId}`;
    }
  }

  function updateGeodesicCreatureDebug(deltaSeconds: number): void {
    if (debugLevel !== "verbose" || deltaSeconds <= 0) {
      return;
    }

    geodesicCreatureDebugElapsedSeconds += deltaSeconds;
    geodesicCreatureHealthyLogElapsedSeconds += deltaSeconds;
    if (geodesicCreatureDebugElapsedSeconds < geodesicCreatureDebugCheckIntervalSeconds) {
      return;
    }

    geodesicCreatureDebugElapsedSeconds = 0;
    const dump = collectGeodesicCreatureDebugDump({
      world: activeWorld(),
      runtimes: dynamicObjectRuntimes,
      registry: runtimeObjectRegistry,
      cellRoots: cellMeshes,
    });
    const message = `[noneuclid] geodesic creature consistency: ${dump.issueCount} issue(s) across ${dump.creatureCount} creature(s)`;

    if (dump.issueCount > 0) {
      console.warn(message, dump);
      return;
    }

    if (geodesicCreatureHealthyLogElapsedSeconds < geodesicCreatureHealthyLogIntervalSeconds) {
      return;
    }

    geodesicCreatureHealthyLogElapsedSeconds = 0;
    console.info(message, dump.records);
  }

  function syncLaunchOptionsState(): void {
    const settings = createDebugSettingsFromRuntimeMenuState(menuState);
    options.onLaunchOptionsChanged?.({
      debugLevel: settings.debugLevel,
      portalPanelMode: settings.portalPanelMode,
      debugOptions: settings.debugOptions,
      debugOverlayEnabled: menuState.debugOverlayEnabled,
      debugOverlayItems: menuState.debugOverlayItems,
      vrComfortOptions,
    });
  }

  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("contextmenu", onDesktopContextMenu);
  window.addEventListener("mousedown", onDesktopMouseDown);
  window.addEventListener("wheel", onDesktopWheel, { passive: false });
  window.addEventListener("keydown", onDesktopPaletteKeyDown);
  applyDesktopCameraPose();
  renderer.setAnimationLoop(renderFrame);

  return {
    scene,
    renderer,
    updateDebugSettings(settings) {
      applyDebugSettings(settings);
    },
    dispose() {
      if (reloadConfirmationTimeout !== undefined) {
        window.clearTimeout(reloadConfirmationTimeout);
        reloadConfirmationTimeout = undefined;
      }
      xrSessionRestartCoordinator.cancel();
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("contextmenu", onDesktopContextMenu);
      window.removeEventListener("mousedown", onDesktopMouseDown);
      window.removeEventListener("wheel", onDesktopWheel);
      window.removeEventListener("keydown", onDesktopPaletteKeyDown);
      scenePaletteController.dispose();
      xrControllerHandModels.dispose();
      desktopScenePaletteInput.dispose();
      desktopToolIndicator.dispose();
      desktopFlagEditor.dispose();
      aimCrossMarker.dispose();
      aimControllerRay.removeFromParent();
      aimControllerRayGeometry.dispose();
      aimControllerRayMaterial.dispose();
      floatingObjectTooltip.dispose();
      helpLensRenderer.dispose();
      vrComfortVignette.dispose();
      clearXrObjectTooltip();
      controls.dispose();
      clearProtractorToolFeedback();
      for (const runtime of placedFlagRuntimes.values()) {
        runtime.dispose();
      }
      placedFlagRuntimes.clear();
      for (const group of selectableHitboxDebugGroupsByCellId.values()) {
        group.removeFromParent();
        disposeObject3D(group);
      }
      selectableHitboxDebugGroupsByCellId.clear();
      for (const label of geodesicEmitterLabelsByKey.values()) {
        label.root.removeFromParent();
        disposeObject3D(label.root);
      }
      geodesicEmitterLabelsByKey.clear();
      for (const cellMesh of cellMeshes.values()) {
        disposeObject3D(cellMesh);
      }
      scene.remove(underCellInfinityFloor);
      disposeObject3D(underCellInfinityFloor);
      for (const archetype of cellRenderArchetypes) {
        scene.remove(archetype.mesh);
      }
      disposeCellRenderArchetypes(cellRenderArchetypes);
      portalInstanceDebugRenderer?.dispose();
      portalClipData.dispose();
      for (const archetype of runtimeObjectRenderArchetypesByKey.values()) {
        runtimeObjectRenderRoot.remove(archetype.mesh);
      }
      disposeRuntimeObjectRenderArchetypes(runtimeObjectRenderArchetypesByKey.values());
      runtimeObjectRenderArchetypesByKey.clear();
      runtimeObjectRenderRoot.removeFromParent();
      portalDebugRuntime.dispose();
      uninstallGeneralDebugHelpers();
      uninstallGeometryDebugHelpers();
      geometrySession.dispose();
      debugOverlay.dispose();
      xrEntryUi.dispose();
      clipPolygonOverlay.dispose();
      disposeStylizedSceneLighting(sceneLighting, scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  function requestAppRestart(restart: () => void): void {
    const session = renderer.xr.isPresenting ? renderer.xr.getSession() : undefined;

    xrSessionRestartCoordinator.requestRestart(session, restart, (error) => {
      const message = error instanceof Error ? error.message : "Unable to leave immersive VR before restarting.";
      console.warn("[noneuclid] unable to end XR session before restart", error);
      xrSessionState = transitionXrSessionState(xrSessionState, "failed", message);
      xrEntryUi.update(xrSessionState);
      syncXrDebugState("desktop");
    });
  }

  async function enterVr(): Promise<void> {
    const xr = navigator.xr;

    if (
      !xr?.requestSession ||
      !xrSessionState.immersiveVrSupported ||
      (xrSessionState.status !== "available" && xrSessionState.status !== "ended" && xrSessionState.status !== "failed")
    ) {
      return;
    }

    xrSessionState = transitionXrSessionState(xrSessionState, "entering");
    xrEntryUi.update(xrSessionState);
    syncXrDebugState("desktop");

    try {
      const session = await xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      });
      session.addEventListener("end", () => {
        xrSessionState = transitionXrSessionState(xrSessionState, "ended");
        xrRig.reset();
        xrScenePaletteInput.reset();
        xrControllerHandModels.reset();
        fixedXrPalettePlacement = undefined;
        scenePaletteController.setVisible(false);
        xrEntryUi.update(xrSessionState);
        syncXrDebugState("desktop");
      });
      await renderer.xr.setSession(session);
      xrSessionState = transitionXrSessionState(xrSessionState, "active");
      xrEntryUi.update(xrSessionState);
      syncXrDebugState("xr");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start immersive VR.";
      xrSessionState = transitionXrSessionState(xrSessionState, "failed", message);
      xrEntryUi.update(xrSessionState);
      syncXrDebugState("desktop");
    }
  }

  function updateScenePalette(
    xrActive: boolean,
    xrFrame: XRFrame | undefined,
    xrReferenceSpace: XRReferenceSpace | null,
    xrHeadWorldPose: XrHeadWorldPose | undefined,
    deltaSeconds: number,
    frame: RuntimeInputFrame,
  ): void {
    if (xrActive && xrFrame && xrReferenceSpace) {
      const inputSources = [...(renderer.xr.getSession()?.inputSources ?? [])];
      const headPosition = xrHeadWorldPose?.position ?? camera.getWorldPosition(new THREE.Vector3());
      const headQuaternion = xrHeadWorldPose?.quaternion ?? camera.getWorldQuaternion(new THREE.Quaternion());

      if (!menuState.isOpen) {
        fixedXrPalettePlacement = undefined;
      } else if (
        fixedXrPalettePlacement &&
        shouldAutoCloseVrPalette({
          headPosition,
          palettePosition: fixedXrPalettePlacement.position,
        })
      ) {
        cancelRuntimeMenuAndSelectedTool();
        fixedXrPalettePlacement = undefined;
      }

      const placement = fixedXrPalettePlacement ?? resolveVrPalettePlacement({
        head: {
          position: headPosition,
          quaternion: headQuaternion,
        },
      });
      scenePaletteController.update({
        input: xrScenePaletteInput.update({
          deltaSeconds,
          xrFrame,
          referenceSpace: xrReferenceSpace,
          referenceSpaceToWorldMatrix: xrRig.root.matrixWorld,
          inputSources,
        }),
        definition: createPaletteDefinition(menuState, appConfig, "xr"),
        placement,
      });
      if (menuState.isOpen && !fixedXrPalettePlacement) {
        fixedXrPalettePlacement = {
          anchorKind: placement.anchorKind,
          position: placement.position.clone(),
          quaternion: placement.quaternion.clone(),
        };
      }
      xrControllerHandModels.update({
        inputSources,
        xrFrame,
        referenceSpace: xrReferenceSpace,
        referenceSpaceToWorldMatrix: xrRig.root.matrixWorld,
        selectedTool: menuState.selectedTool,
        placeFlagType: menuState.placeFlagOptions.flagType,
      });
      return;
    }

    const placement = resolveDesktopScenePalettePlacement({
      camera,
      previousPlacement: previousDesktopPalettePlacement,
      freeze: menuState.isOpen,
    });
    previousDesktopPalettePlacement = placement;
    scenePaletteController.update({
      input: desktopScenePaletteInput.update({
        desktopFrame: {
          ...frame,
          palettePointerDeltaPixels: frame.palettePointerDeltaPixels ?? { x: 0, y: 0 },
          paletteSelectPressed: frame.paletteSelectPressed ?? false,
          paletteSelectRequested: frame.paletteSelectRequested ?? false,
        },
        deltaSeconds,
        camera,
        isOpen: menuState.isOpen,
        placement,
      }),
      definition: createPaletteDefinition(menuState, appConfig, "desktop"),
      placement,
    });
  }

  function resolveXrHeadWorldPose(xrViewerPose: XRViewerPose | undefined): XrHeadWorldPose | undefined {
    if (!xrViewerPose) {
      return undefined;
    }

    xrHeadWorldMatrix.copy(xrRig.root.matrixWorld).multiply(xrRigidTransformLocalMatrix(xrViewerPose.transform));
    xrHeadWorldMatrix.decompose(xrHeadWorldPosition, xrHeadWorldQuaternion, xrHeadWorldScale);
    return {
      position: xrHeadWorldPosition,
      quaternion: xrHeadWorldQuaternion,
    };
  }

  function onDesktopContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  function onDesktopMouseDown(event: MouseEvent): void {
    if (event.button !== 2 || renderer.xr.isPresenting) {
      return;
    }

    if (event.target !== renderer.domElement && !controls.isPointerLocked()) {
      return;
    }

    event.preventDefault();
    openContextMenuFromAim(resolveActiveRootAimRay(false));
  }

  function onDesktopPaletteKeyDown(event: KeyboardEvent): void {
    if (renderer.xr.isPresenting) {
      return;
    }

    if (event.code === "Escape") {
      const action = reduceDesktopScenePaletteToggle(menuState.isOpen, "escape-key");
      if (action !== "none") {
        event.preventDefault();
        applyDesktopScenePaletteToggle(action);
      } else if (helpLensFocusedObjectId) {
        event.preventDefault();
        helpLensFocusedObjectId = undefined;
      }
      return;
    }

    if (event.code === "Tab" && !menuState.isOpen && !desktopFlagEditor.isOpen()) {
      if (cycleFocusedAimTarget(resolveActiveRootAimRay(false))) {
        event.preventDefault();
      }
    }
  }

  function onDesktopWheel(event: WheelEvent): void {
    if (renderer.xr.isPresenting || menuState.isOpen || desktopFlagEditor.isOpen()) {
      return;
    }

    if (event.target !== renderer.domElement && !controls.isPointerLocked()) {
      return;
    }

    if (cycleFocusedAimTarget(resolveActiveRootAimRay(false))) {
      event.preventDefault();
    }
  }

  function applyDesktopScenePaletteToggle(action: "open" | "right-action" | "close" | "none"): void {
    if (action === "open" && !menuState.isOpen) {
      menuState = openRuntimeMenu(menuState);
      syncDesktopPalette();
    } else if (action === "right-action" && menuState.isOpen) {
      applyRuntimeMenuRightAction();
    } else if (action === "close" && menuState.isOpen) {
      cancelRuntimeMenuAndSelectedTool();
    }
  }

  function applyRuntimeMenuRightAction(): void {
    if (
      menuState.page === "main" ||
      menuState.page === "edit-sign" ||
      menuState.page === "geodesic-cannon-actions" ||
      menuState.page === "geometry-computer-actions" ||
      menuState.page === "question-help"
    ) {
      cancelRuntimeMenuAndSelectedTool();
      return;
    } else if (menuState.page === "tutorial" || menuState.page === "goal") {
      menuState = showRuntimeMenuQuestionHelp(menuState);
    } else if (menuState.page === "debug-settings") {
      menuState = showRuntimeMenuSettings(menuState);
    } else {
      menuState = showRuntimeMenuMainPage(menuState);
    }
    syncDesktopPalette();
  }

  function cancelRuntimeMenuAndSelectedTool(): void {
    activeProtractorToolState = {};
    activeGeodesicCannonToolState = {};
    syncTieAndDetachSelectionHighlights([]);
    clearProtractorToolFeedback();
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "none"));
    syncRuntimeObjectPortalInstances();
    syncDesktopPalette();
  }

  function getDesktopInputFrame(deltaSeconds: number): RuntimeInputFrame {
    controls.setLookMode(menuState.isOpen ? "palette" : "camera");
    const frame = controls.consumeFrame(deltaSeconds);

    return {
      ...frame,
      source: "desktop",
    };
  }

  function getXrInputFrame(deltaSeconds: number): RuntimeInputFrame {
    const session = renderer.xr.getSession();

    if (!session) {
      return {
        localDisplacement: { x: 0, y: 0, z: 0 },
        yawDeltaRadians: 0,
        pitchDeltaRadians: 0,
        resetRequested: false,
        primaryActionRequested: false,
        interactRequested: false,
        carryActionRequested: false,
        helpRequested: false,
        source: "xr",
      };
    }

    return {
      ...xrControls.consumeFrame(session.inputSources, deltaSeconds),
    };
  }

  function recordCellTransition(previousCellId: string, moveResult: ReturnType<typeof movePlayer>): void {
    if (playerPose.cellId !== previousCellId) {
      if (moveResult.crossedPortal) {
        const transition = resolveLatestPlayerPortalTransition(previousCellId, moveResult);
        if (transition) {
          latestPlayerPortalTransition = transition;
          latestPlayerPortalTransitionSerial += 1;
        }
        runtimeDiagnostics().recordCellEntered(
          previousCellId,
          playerPose.cellId,
          moveResult.crossedPortalId ?? "unknown-portal",
        );
      }
      portalDebugRuntime.syncRootCell();
    }
  }

  function resolveLatestPlayerPortalTransition(
    previousCellId: string,
    moveResult: ReturnType<typeof movePlayer>,
  ): GeodesicCarryPortalTransition | undefined {
    if (!moveResult.crossedPortal || !moveResult.crossedPortalId) {
      return undefined;
    }

    const portal = activeWorld().cellsById.get(previousCellId)?.portalsById.get(moveResult.crossedPortalId);
    if (!portal || portal.targetCellId !== moveResult.pose.cellId) {
      return undefined;
    }

    return {
      sourceCellId: previousCellId,
      sourcePortalId: portal.id,
      targetCellId: portal.targetCellId,
      targetPortalId: portal.targetPortalId,
      transformToTarget: portal.transformToTarget,
    };
  }

  function syncXrDebugState(
    source: RuntimeInputFrame["source"],
    moveResult?: ReturnType<typeof movePlayer>,
  ): void {
    xrDebugState = {
      secureContext: xrSessionState.secureContext,
      sessionStatus: xrSessionState.status,
      activeInputSource: source,
      framePerformance: smoothedFramePerformance,
      webGlRenderInfo: latestWebGlRenderInfo,
      currentCellId: playerPose.cellId,
      playerPosition: playerPose.position,
      yawRadians: playerPose.yawRadians,
      lastMovementBlocked: moveResult?.blocked ?? xrDebugState.lastMovementBlocked,
      lastBlockingReason: moveResult?.blockingReason ?? xrDebugState.lastBlockingReason,
      lastCrossedPortalId: moveResult?.crossedPortalId ?? xrDebugState.lastCrossedPortalId,
      sharedRenderRootCellId: renderer.xr.isPresenting ? xrRig.getSharedRenderRootCellId(playerPose) : undefined,
      visiblePortalPathCount: latestVisibleResult?.paths.length,
      visiblePortalPaths: latestVisibleResult ? visibleSummaryToRenderState(latestVisibleResult.summary) : undefined,
      portalInstances: portalInstanceRenderState,
      portalEyes: createPortalEyeDebugStates(),
    };
  }

  function createPortalEyeDebugStates(): readonly PortalEyeRenderDebugState[] | undefined {
    if (portalEyeRenderStates.length === 0) {
      return undefined;
    }

    return portalEyeRenderStates.map((state) => ({
      eyeIndex: state.eyeIndex,
      rootCellId: state.rootCellId,
      visiblePathCount: state.result.paths.length,
      maxVisibleDepth: state.result.summary.maxVisibleDepth,
    }));
  }

  function rebuildCellMeshes(): void {
    const currentlyVisibleCellId = visibleCellId ?? playerPose.cellId;

    portalInstanceDebugRenderer?.dispose();
    portalInstanceDebugRenderer = undefined;
    for (const archetype of cellRenderArchetypes) {
      scene.remove(archetype.mesh);
    }
    disposeCellRenderArchetypes(cellRenderArchetypes);
    cellRenderArchetypes = [];
    for (const runtime of dynamicObjectRuntimes) {
      runtime.root.removeFromParent();
    }
    for (const runtime of placedFlagRuntimes.values()) {
      runtime.root.removeFromParent();
    }

    for (const [cellId, cellMesh] of cellMeshes) {
      scene.remove(cellMesh);
      disposeObject3D(cellMesh);
      cellMeshes.delete(cellId);
    }

    const showForbiddenZoneWireframes = hasActiveDebugOption(
      debugLevel,
      debugOptions,
      "forbidden-zone-wireframes",
    );

    for (const cell of activeWorld().cells) {
      const cellMesh = new THREE.Group();
      cellMesh.name = `cell-root:${cell.id}`;
      cellMesh.visible = cell.id === currentlyVisibleCellId;
      if (showForbiddenZoneWireframes) {
        cellMesh.add(buildCurrentCellForbiddenZoneWireframes(cell));
      }
      cellMeshes.set(cell.id, cellMesh);
      scene.add(cellMesh);
    }

    cellRenderArchetypes = buildCellRenderArchetypes(activeWorld(), {
      debugLevel,
      portalPanelMode,
      eyeHeightMeters: DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      assets: options.assets,
      capacitiesByCellId: activeWorldBundle.archetypeCapacitiesByCellId,
      portalClipMaterialState,
      showForbiddenZoneWireframes: false,
    });
    for (const archetype of cellRenderArchetypes) {
      archetype.mesh.onBeforeRender = (renderer, _scene, renderCamera) => {
        activatePortalRenderStateForCamera(renderCamera, renderer);
        updatePortalClipMaterialViewportFromRenderer(portalClipMaterialState, renderer);
      };
      scene.add(archetype.mesh);
    }
    portalInstanceDebugRenderer = createPortalInstanceDebugRenderer(scene, cellRenderArchetypes);
    for (const runtime of placedFlagRuntimes.values()) {
      runtime.syncParent(cellMeshes);
    }
    syncStaticObjectCollisionWireframes();
    visibleCellId = currentlyVisibleCellId;
  }

  function buildCurrentCellForbiddenZoneWireframes(cell: CompiledPrismCell): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `forbidden-zone-wireframes:${cell.id}`;

    for (const zone of cell.forbiddenZones) {
      group.add(buildForbiddenZoneWireframe(cell.id, zone.collision, cell.heightMeters));
    }

    return group;
  }

  function resolvePortalEyeRenderRoot(cullingCamera: THREE.Camera): XrPortalEyeRenderRoot {
    return resolveXrPortalEyeRenderRoot({
      world: activeWorld(),
      sourceCellId: playerPose.cellId,
      camera: cullingCamera,
    });
  }

  function syncPortalInstanceRender(
    renderRoot: XrPortalEyeRenderRoot = {
      rootCellId: playerPose.cellId,
      camera,
      renderFromRootMatrix: new THREE.Matrix4(),
    },
  ): void {
    portalInstanceDiagnostics.reset();
    portalEyeRenderStates = [];
    activePortalEyeIndex = 0;
    updatePortalClipMaterialTextureEye(portalClipMaterialState, activePortalEyeIndex);
    updatePortalClipMaterialViewport(
      portalClipMaterialState,
      getPortalViewportPixels(renderer),
    );
    const table = activeStaticCull().tables.tablesByRootCellId.get(renderRoot.rootCellId);

    if (!table) {
      latestVisibleResult = undefined;
      portalClipData.update([]);
      updateCellRenderArchetypeInstances(cellRenderArchetypes, new Map(), portalInstanceDiagnostics);
      portalInstanceRenderState = createPortalInstanceRenderDebugState(
        cellRenderArchetypes,
        new Map(),
        portalInstanceDiagnostics,
        {
          enabled: false,
          showCellPathRendersInstances,
          normalVisiblePathRenderingActive: false,
        },
      );
      return;
    }

    const computed = computeVisiblePortalPaths({
      world: activeWorld(),
      rootCellId: renderRoot.rootCellId,
      pathTable: table,
      camera: renderRoot.camera,
      viewportPixels: getPortalViewportPixels(renderer),
      options: {
        maxDepth: rootRenderPathMaxDepth,
        maxVisiblePaths,
        minPortalScreenAreaPixels: 16,
        includeRootCell: true,
        sortMode: "depth-then-area",
      },
    });
    const renderedComputed = transformVisiblePortalResultToRenderFrame(computed, renderRoot.renderFromRootMatrix);
    const summary = mergeStaticPathCounts(renderedComputed.summary, activeStaticCull(), renderRoot.rootCellId);
    latestVisibleResult = {
      ...renderedComputed,
      summary,
    };
    applyPortalVisibleResult(renderRoot.rootCellId, latestVisibleResult.paths, latestVisibleResult.visiblePathById);
    portalInstanceRenderState = createPortalInstanceRenderStateFromVisibleResult(
      renderRoot.rootCellId,
      latestVisibleResult,
      true,
    );
  }

  function syncStereoPortalInstanceRender(renderRoots: readonly XrPortalEyeRenderRoot[]): void {
    portalInstanceDiagnostics.reset();
    updatePortalClipMaterialViewport(
      portalClipMaterialState,
      getPortalViewportPixels(renderer),
    );
    const hasTables = renderRoots.every((renderRoot) =>
      activeStaticCull().tables.tablesByRootCellId.has(renderRoot.rootCellId)
    );

    if (!hasTables) {
      latestVisibleResult = undefined;
      portalEyeRenderStates = [];
      activePortalEyeIndex = 0;
      updatePortalClipMaterialTextureEye(portalClipMaterialState, activePortalEyeIndex);
      portalClipData.update([]);
      updateCellRenderArchetypeInstances(cellRenderArchetypes, new Map(), portalInstanceDiagnostics);
      portalInstanceRenderState = createPortalInstanceRenderDebugState(
        cellRenderArchetypes,
        new Map(),
        portalInstanceDiagnostics,
        {
          enabled: false,
          showCellPathRendersInstances,
          normalVisiblePathRenderingActive: false,
        },
      );
      return;
    }

    const sharedRootCellId = renderRoots.every((renderRoot) => renderRoot.rootCellId === renderRoots[0]?.rootCellId)
      ? renderRoots[0]?.rootCellId
      : undefined;
    const computedEyeStates = sharedRootCellId
      ? computeIndependentVisiblePortalPaths({
          world: activeWorld(),
          rootCellId: sharedRootCellId,
          pathTable: activeStaticCull().tables.tablesByRootCellId.get(sharedRootCellId)!,
          cameras: renderRoots.map((renderRoot) => renderRoot.camera),
          viewportPixels: getPortalViewportPixels(renderer),
          options: {
            maxDepth: rootRenderPathMaxDepth,
            maxVisiblePaths,
            minPortalScreenAreaPixels: 16,
            includeRootCell: true,
            sortMode: "depth-then-area",
          },
        }).map((computed, eyeIndex) => {
          const renderRoot = renderRoots[eyeIndex];
          const renderedComputed = transformVisiblePortalResultToRenderFrame(computed, renderRoot.renderFromRootMatrix);

          return {
            camera: renderRoot.camera,
            eyeIndex,
            rootCellId: renderRoot.rootCellId,
            result: {
              ...renderedComputed,
              summary: mergeStaticPathCounts(renderedComputed.summary, activeStaticCull(), renderRoot.rootCellId),
            },
          };
        })
      : renderRoots.map((renderRoot, eyeIndex) => {
        const table = activeStaticCull().tables.tablesByRootCellId.get(renderRoot.rootCellId)!;
        const computed = computeVisiblePortalPaths({
        world: activeWorld(),
        rootCellId: renderRoot.rootCellId,
        pathTable: table,
        camera: renderRoot.camera,
        viewportPixels: getPortalViewportPixels(renderer),
        options: {
          maxDepth: rootRenderPathMaxDepth,
          maxVisiblePaths,
          minPortalScreenAreaPixels: 16,
          includeRootCell: true,
          sortMode: "depth-then-area",
        },
      });
      const renderedComputed = transformVisiblePortalResultToRenderFrame(computed, renderRoot.renderFromRootMatrix);

      return {
        camera: renderRoot.camera,
        eyeIndex,
        rootCellId: renderRoot.rootCellId,
        result: {
          ...renderedComputed,
          summary: mergeStaticPathCounts(renderedComputed.summary, activeStaticCull(), renderRoot.rootCellId),
        },
      };
      });
    portalEyeRenderStates = remapStereoPortalPathIds(computedEyeStates);

    latestVisibleResult = portalEyeRenderStates[0]?.result;
    activePortalEyeIndex = 0;
    updatePortalClipMaterialTextureEye(portalClipMaterialState, activePortalEyeIndex);
    if (latestVisibleResult) {
      const unionVisiblePathById = buildUnionVisiblePathById(portalEyeRenderStates.map((state) => state.result));
      const unionVisiblePaths = [...unionVisiblePathById.values()].sort((left, right) => left.pathId - right.pathId);
      portalClipData.updateStereo(portalEyeRenderStates.map((state) => state.result.paths));
      applyPortalVisiblePaths(unionVisiblePaths, false);
      portalInstanceRenderState = createPortalInstanceRenderStateFromVisibleResult(
        portalEyeRenderStates[0]?.rootCellId ?? playerPose.cellId,
        latestVisibleResult,
        true,
      );
    } else {
      portalClipData.update([]);
      updateCellRenderArchetypeInstances(cellRenderArchetypes, new Map(), portalInstanceDiagnostics);
      portalInstanceRenderState = createPortalInstanceRenderDebugState(
        cellRenderArchetypes,
        new Map(),
        portalInstanceDiagnostics,
        {
          enabled: false,
          showCellPathRendersInstances,
          normalVisiblePathRenderingActive: false,
        },
      );
    }
  }

  function activatePortalRenderStateForCamera(renderCamera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    if (portalEyeRenderStates.length <= 1) {
      updatePortalClipMaterialTextureEye(portalClipMaterialState, 0);
      return;
    }

    const state = findPortalEyeRenderState(renderCamera, renderer);

    if (!state || state.eyeIndex === activePortalEyeIndex) {
      return;
    }

    activePortalEyeIndex = state.eyeIndex;
    updatePortalClipMaterialTextureEye(portalClipMaterialState, state.eyeIndex);
  }

  function applyPortalVisibleResult(
    rootCellId: string,
    visiblePaths: readonly VisiblePortalPath[],
    visiblePathById: ReadonlyMap<number, VisiblePortalPath>,
    updateClipData = true,
  ): void {
    if (updateClipData) {
      portalClipData.update(visiblePaths);
    }
    const visiblePathsByDestinationCell = buildVisiblePathsByDestinationCell(
      activeStaticCull().tables.tablesByRootCellId.get(rootCellId)?.pathsByDestinationCellId ?? new Map(),
      visiblePathById,
    );
    updatePortalVisiblePathInstances(visiblePathsByDestinationCell);
    syncRuntimeObjectPortalInstances(flattenVisiblePortalPathGroups(visiblePathsByDestinationCell));
  }

  function applyPortalVisiblePaths(
    visiblePaths: readonly VisiblePortalPath[],
    updateClipData = true,
  ): void {
    if (updateClipData) {
      portalClipData.update(visiblePaths);
    }
    updatePortalVisiblePathInstances(groupVisiblePortalPathsByDestinationCell(visiblePaths));
    syncRuntimeObjectPortalInstances(visiblePaths);
  }

  function updatePortalVisiblePathInstances(
    visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  ): void {
    updateCellRenderArchetypeInstances(
      cellRenderArchetypes,
      visiblePathsByDestinationCell,
      portalInstanceDiagnostics,
      portalClipData.clipIndexByPathId,
    );
  }

  function createPortalInstanceRenderStateFromVisibleResult(
    rootCellId: string,
    result: ComputeVisiblePortalPathsResult,
    normalVisiblePathRenderingActive: boolean,
  ): PortalInstanceRenderDebugState {
    const visiblePathsByDestinationCell = buildVisiblePathsByDestinationCell(
      activeStaticCull().tables.tablesByRootCellId.get(rootCellId)?.pathsByDestinationCellId ?? new Map(),
      result.visiblePathById,
    );

    return createPortalInstanceRenderDebugState(
      cellRenderArchetypes,
      visiblePathsByDestinationCell,
      portalInstanceDiagnostics,
      {
        enabled: true,
        showCellPathRendersInstances,
        normalVisiblePathRenderingActive,
        visiblePaths: result.paths,
        clipPolygonVertexCountsByPathId: portalClipData.polygonVertexCountsByPathId,
        clipPolygonOverflowPathIds: portalClipData.polygonVertexOverflowPathIds,
        visiblePathOverflowCount: portalClipData.visiblePathOverflowCount,
      },
    );
  }

  function findPortalEyeRenderState(
    renderCamera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ): PortalEyeRenderState | undefined {
    const matrixMatched = portalEyeRenderStates.find((state) =>
      matricesNearlyEqual(state.camera.matrixWorld, renderCamera.matrixWorld) &&
      matricesNearlyEqual(state.camera.projectionMatrix, renderCamera.projectionMatrix)
    );

    if (matrixMatched) {
      return matrixMatched;
    }

    const viewport = renderer.getCurrentViewport(new THREE.Vector4());
    const drawingBuffer = renderer.getDrawingBufferSize(new THREE.Vector2());

    if (drawingBuffer.x > 0 && viewport.z > 0) {
      const viewportCenterX = viewport.x + viewport.z / 2;
      const index = Math.min(
        portalEyeRenderStates.length - 1,
        Math.max(0, Math.floor((viewportCenterX / drawingBuffer.x) * portalEyeRenderStates.length)),
      );

      return portalEyeRenderStates[index];
    }

    return portalEyeRenderStates[0];
  }

  function syncRuntimeObjectPortalInstances(
    visiblePaths: readonly VisiblePortalPath[] = getRuntimeObjectVisiblePaths(),
  ): void {
    syncRuntimeObjectRenderSources();
    const records = collectRuntimeObjectRenderRecords();
    const recordsByArchetypeKey = groupRuntimeObjectRenderRecordsByArchetype(records);
    const visiblePathsByDestinationCell = groupVisiblePortalPathsByDestinationCell(visiblePaths);
    runtimeObjectRenderDiagnostics.reset();
    updateRuntimeObjectRenderArchetypeInstances(
      [...runtimeObjectRenderArchetypesByKey.values()],
      recordsByArchetypeKey,
      visiblePathsByDestinationCell,
      runtimeObjectRenderDiagnostics,
      portalClipData.clipIndexByPathId,
    );
    syncSelectableHitboxDebug();
  }

  function syncRuntimeObjectRenderSources(): void {
    const activeKeys = new Set<string>();
    const hasGeodesicRuntimeObjects = runtimeObjectRegistry.getAll().some(
      (object) => object.portalRenderable && isGeodesicRuntimeRenderObject(object),
    );

    if (hasGeodesicRuntimeObjects) {
      for (const source of geodesicRuntimeRenderSources) {
        activeKeys.add(source.archetypeKey);
        if (!runtimeObjectRenderSourcesByKey.has(source.archetypeKey)) {
          runtimeObjectRenderSourcesByKey.set(source.archetypeKey, source);
        }
      }
    }

    if (playerRoverRenderModel) {
      for (const source of playerRoverRenderModel.collectSources()) {
        activeKeys.add(source.archetypeKey);
        if (!runtimeObjectRenderSourcesByKey.has(source.archetypeKey)) {
          runtimeObjectRenderSourcesByKey.set(source.archetypeKey, source);
        }
      }
    }

    for (const object of runtimeObjectRegistry.getAll()) {
      if (!object.portalRenderable) {
        continue;
      }

      if (isGeodesicRuntimeRenderObject(object)) {
        continue;
      }

      const root = runtimeObjectRootsById.get(object.id);
      if (!root) {
        continue;
      }

      const prefix = runtimeObjectArchetypeKeyPrefix(object);
      for (const source of collectRuntimeObjectRenderSourceMeshes(object.id, root, prefix)) {
        activeKeys.add(source.archetypeKey);
        if (!runtimeObjectRenderSourcesByKey.has(source.archetypeKey)) {
          runtimeObjectRenderSourcesByKey.set(source.archetypeKey, source);
        }
      }
    }

    for (const [key, archetype] of [...runtimeObjectRenderArchetypesByKey]) {
      if (activeKeys.has(key)) {
        continue;
      }

      runtimeObjectRenderRoot.remove(archetype.mesh);
      disposeRuntimeObjectRenderArchetypes([archetype]);
      runtimeObjectRenderArchetypesByKey.delete(key);
      runtimeObjectRenderSourcesByKey.delete(key);
    }

    const recordsByArchetypeKey = groupRuntimeObjectRenderRecordsByArchetype(collectRuntimeObjectRenderRecords());
    for (const key of activeKeys) {
      const capacity = deriveRuntimeObjectRenderArchetypeCapacity(
        recordsByArchetypeKey.get(key)?.length ?? 1,
        maxVisiblePaths,
      );
      const existing = runtimeObjectRenderArchetypesByKey.get(key);
      if (existing && existing.capacity >= capacity) {
        continue;
      }

      const source = runtimeObjectRenderSourcesByKey.get(key);
      if (!source) {
        continue;
      }

      if (existing) {
        runtimeObjectRenderRoot.remove(existing.mesh);
        disposeRuntimeObjectRenderArchetypes([existing]);
        runtimeObjectRenderArchetypesByKey.delete(key);
      }

      const archetype = buildRuntimeObjectRenderArchetype(source, capacity, portalClipMaterialState);
      archetype.mesh.onBeforeRender = (renderer, _scene, renderCamera) => {
        activatePortalRenderStateForCamera(renderCamera, renderer);
        updatePortalClipMaterialViewportFromRenderer(portalClipMaterialState, renderer);
      };
      runtimeObjectRenderArchetypesByKey.set(key, archetype);
      runtimeObjectRenderRoot.add(archetype.mesh);
    }
  }

  function collectRuntimeObjectRenderRecords(): readonly RuntimeObjectRenderRecord[] {
    const records = runtimeObjectRegistry.getAll().flatMap((object) => {
      if (object.portalRenderable && isGeodesicRuntimeRenderObject(object)) {
        return collectGeodesicRuntimeRenderRecords(object, geodesicRuntimeArchetypeKeys);
      }

      if (!object.portalRenderable || !runtimeObjectRootsById.has(object.id)) {
        return [];
      }

      const localMatrix = rigidTransformToThreeMatrix(object.localPose);
      const prefix = runtimeObjectArchetypeKeyPrefix(object);
      const archetypeKeys = [...runtimeObjectRenderSourcesByKey.keys()]
        .filter((key) => key.startsWith(`${prefix}:mesh:`));
      const baseRecords = archetypeKeys.map((archetypeKey) => ({
        objectId: object.id,
        cellId: object.cellId,
        archetypeKey,
        localMatrix,
      }));

      return [
        ...baseRecords,
        ...collectPortalGhostRuntimeObjectRenderRecords({
          world: activeWorld(),
          object,
          archetypeKeys,
        }),
      ];
    });

    return playerRoverRenderModel
      ? [
          ...records,
          ...playerRoverRenderModel.collectRecords(playerPose, runtimeObjectRenderSourcesByKey.keys(), {
            ghostWorld: activeWorld(),
            collision: createPlayerCollisionState(playerPose).collision,
          }),
        ]
      : records;
  }

  function runtimeObjectArchetypeKeyPrefix(object: RuntimeWorldObject): string {
    if (object.kind === "placed-flag") {
      return `placed-flag:${object.flagType}:${object.id}`;
    }

    return `${object.kind}:${object.id}`;
  }

  function buildUnionVisiblePathById(
    results: readonly ComputeVisiblePortalPathsResult[],
  ): ReadonlyMap<number, VisiblePortalPath> {
    const visiblePathById = new Map<number, VisiblePortalPath>();

    for (const result of results) {
      for (const path of result.paths) {
        if (!visiblePathById.has(path.pathId)) {
          visiblePathById.set(path.pathId, path);
        }
      }
    }

    return visiblePathById;
  }

  function transformVisiblePortalResultToRenderFrame(
    result: ComputeVisiblePortalPathsResult,
    renderFromRootMatrix: THREE.Matrix4,
  ): ComputeVisiblePortalPathsResult {
    const paths = result.paths.map((path) => ({
      ...path,
      rootFromDestinationMatrix: renderFromRootMatrix.clone().multiply(path.rootFromDestinationMatrix),
    }));

    return {
      ...result,
      paths,
      visiblePathById: new Map(paths.map((path) => [path.pathId, path])),
    };
  }

  function remapStereoPortalPathIds(states: readonly PortalEyeRenderState[]): readonly PortalEyeRenderState[] {
    const pathIdByRootPathKey = new Map<string, number>();
    let nextPathId = 0;

    return states.map((state) => {
      const remappedPaths = state.result.paths.map((path) => {
        const key = `${state.rootCellId}:${path.pathId}`;
        let pathId = pathIdByRootPathKey.get(key);

        if (pathId === undefined) {
          pathId = nextPathId;
          nextPathId += 1;
          pathIdByRootPathKey.set(key, pathId);
        }

        return {
          ...path,
          pathId,
        };
      });
      const visiblePathById = new Map(remappedPaths.map((path) => [path.pathId, path]));

      return {
        ...state,
        result: {
          ...state.result,
          paths: remappedPaths,
          visiblePathById,
        },
      };
    });
  }

  function getRuntimeObjectVisiblePaths(): readonly VisiblePortalPath[] {
    if (portalEyeRenderStates.length <= 1) {
      if (!latestVisibleResult) {
        return [];
      }

      return flattenVisiblePortalPathGroups(buildVisiblePathsByDestinationCell(
        activeStaticCull().tables.tablesByRootCellId.get(playerPose.cellId)?.pathsByDestinationCellId ?? new Map(),
        latestVisibleResult.visiblePathById,
      ));
    }

    const visiblePathsById = new Map<number, VisiblePortalPath>();

    for (const state of portalEyeRenderStates) {
      for (const path of state.result.paths) {
        visiblePathsById.set(path.pathId, path);
      }
    }

    return [...visiblePathsById.values()].sort((left, right) => left.pathId - right.pathId);
  }

  function createPortalDebugRuntime(): { updateVisiblePortalPaths(): void; syncRootCell(): void; dispose(): void } {
    const portalPathDebugActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-path-debug");
    const visiblePathDebugActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-visible-path-debug");
    const overlayActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-path-overlays");

    const staticCullDebugActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-static-cull-debug");
    if (portalPathDebugActive || visiblePathDebugActive || staticCullDebugActive) {
      console.info(`Portal path debug is building contextually culled path tables to depth ${rootRenderPathMaxDepth}.`);
    }
    const staticCull = staticCullDebugActive
      ? buildStaticallyCulledPortalPathTables(activeWorld(), {
          maxDepth: rootRenderPathMaxDepth,
          skipImmediateReverse: true,
          toleranceMeters: 1e-6,
          maxKeptPathsPerRoot: 50_000,
          keepRejectedPathDetails: true,
          onDepthComplete(status) {
            if (!portalPathDebugActive) {
              return;
            }

            console.info(
              [
                "Portal path debug depth complete:",
                `root=${status.rootCellId}`,
                `depth=${status.depth}`,
                `processed=${status.processedPathCount}`,
                `accepted=${status.acceptedPathCount}`,
                `rejected=${status.rejectedPathCount}`,
                `keptTotal=${status.totalKeptPathCount}`,
                `rejectedTotal=${status.totalRejectedPathCount}`,
                `budgetExhausted=${status.budgetExhausted}`,
              ].join(" "),
            );
          },
        })
      : activeStaticCull();
    const candidateTables = staticCull.tables;
    const overlays: THREE.Object3D[] = [];
    let activeOverlayPathText: string | undefined;
    let activeOverlayPathCheck: PortalPathCheckResultWithVisibility | undefined;
    let activePathTraceOverlay: THREE.Object3D | undefined;
    const selectedClipPolygonPaths = new Map<string, { readonly color: string; readonly order: number }>();
    let nextClipPolygonOrder = 0;
    function removeActivePathTraceOverlay(): void {
      if (!activePathTraceOverlay) {
        return;
      }

      scene.remove(activePathTraceOverlay);
      disposeObject3D(activePathTraceOverlay);
      activePathTraceOverlay = undefined;
    }

    const checkPath = (pathText: string): PortalPathCheckResultWithVisibility => {
      const check = checkPortalPathString(pathText, {
        world: activeWorld(),
        rootCellId: playerPose.cellId,
        candidateTables,
        keptTables: staticCull.tables,
        cullSummariesByRootCellId: staticCull.summariesByRootCellId,
      });

      return {
        ...check,
        ...liveVisibilityFields(check.matchedPathId, latestVisibleResult),
      };
    };

    const updateSelectedClipPolygonOverlay = (): void => {
      if (!latestVisibleResult) {
        clipPolygonOverlay.clear();
        return;
      }

      const entries: PortalClipPolygonOverlayEntry[] = [];

      for (const [pathText, selection] of [...selectedClipPolygonPaths.entries()].sort(
        (left, right) => left[1].order - right[1].order,
      )) {
        const check = checkPath(pathText);
        if (!check.valid || !check.survivedStaticCull || check.matchedPathId === undefined) {
          continue;
        }

        const visiblePath = latestVisibleResult.visiblePathById.get(check.matchedPathId);
        if (!visiblePath) {
          continue;
        }

        entries.push({
          pathText,
          color: selection.color,
          clipPolygonNdc: visiblePath.clipPolygonNdc,
        });
      }

      clipPolygonOverlay.update(
        entries,
        getRendererCssCanvasSize(renderer),
      );
    };

    installPortalDebugHelpers({
      CheckCellPath: checkPath,
      ShowCellPath(pathText: string) {
        const check = checkPath(pathText);

        if (!check.valid || !check.survivedStaticCull || check.matchedPathId === undefined) {
          hideCellPathOverlays(overlays, scene);
          portalInstanceDebugRenderer?.clear();
          activeOverlayPathText = undefined;
          activeOverlayPathCheck = undefined;
          removeActivePathTraceOverlay();
          return {
            ok: false,
            reason: check.rejectionReason ?? check.errors[0] ?? "path is not available in the kept table",
            check,
            pathId: check.matchedPathId,
            destinationCellId: check.destinationCellId,
            survivedStaticCull: check.survivedStaticCull,
            ...liveVisibilityFields(check.matchedPathId, latestVisibleResult),
            objectCount: 0,
          };
        }

        hideCellPathOverlays(overlays, scene);
        removeActivePathTraceOverlay();
        const table = staticCull.tables.tablesByRootCellId.get(playerPose.cellId);
        const path = table?.pathsById.get(check.matchedPathId);
        const destinationCell = check.destinationCellId ? activeWorld().cellsById.get(check.destinationCellId) : undefined;

        if (!path || !destinationCell) {
          return {
            ok: false,
            reason: "matched path or destination cell was not found",
            check,
            pathId: check.matchedPathId,
            destinationCellId: check.destinationCellId,
            survivedStaticCull: check.survivedStaticCull,
            ...liveVisibilityFields(check.matchedPathId, latestVisibleResult),
            objectCount: 0,
          };
        }

        let objectCount = 0;

        if (showCellPathRendersInstances) {
          objectCount = portalInstanceDebugRenderer?.renderCellInstances(
            path.destinationCellId,
            pathToThreeMatrix(path),
          ).objectCount ?? 0;
        } else {
          const geometry = new THREE.BufferGeometry();
          const vertices = destinationCell.baseVertices.map((vertex) =>
            transformPoint3(path.rootFromDestination, vec3(vertex.x, vertex.y, 0.03)),
          );
          geometry.setFromPoints(vertices.map((vertex) => worldPointToThree(vertex)));
          geometry.setIndex(triangleFanIndices(vertices.length));
          geometry.computeVertexNormals();

          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(destinationCell.floorColor),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = `debug-cell-path-overlay:${path.id}`;
          scene.add(mesh);
          overlays.push(mesh);
          objectCount = 1;
        }

        activePathTraceOverlay = createPathTraceOverlay(activeWorld(), path);
        scene.add(activePathTraceOverlay);
        activeOverlayPathText = pathText;
        activeOverlayPathCheck = check;

        return {
          ok: true,
          check,
          pathId: path.id,
          destinationCellId: path.destinationCellId,
          survivedStaticCull: true,
          ...liveVisibilityFields(path.id, latestVisibleResult),
          objectCount,
        };
      },
      HideCellPaths() {
        hideCellPathOverlays(overlays, scene);
        portalInstanceDebugRenderer?.clear();
        removeActivePathTraceOverlay();
        activeOverlayPathText = undefined;
        activeOverlayPathCheck = undefined;
      },
      ShowCellPathClipPolygon(pathText: string) {
        const check = checkPath(pathText);
        if (!check.valid || !check.survivedStaticCull || check.matchedPathId === undefined) {
          return {
            ok: false,
            reason: check.rejectionReason ?? check.errors[0] ?? "path is not available in the kept table",
            trackedPathTexts: [...selectedClipPolygonPaths.keys()],
            currentlyVisible: false,
            clipPolygonNdc: undefined,
          };
        }

        if (!selectedClipPolygonPaths.has(pathText)) {
          selectedClipPolygonPaths.set(pathText, {
            color: clipPolygonColorForIndex(nextClipPolygonOrder),
            order: nextClipPolygonOrder,
          });
          nextClipPolygonOrder += 1;
        }

        updateSelectedClipPolygonOverlay();
        const visiblePath = latestVisibleResult?.visiblePathById.get(check.matchedPathId);

        return {
          ok: true,
          pathId: check.matchedPathId,
          destinationCellId: check.destinationCellId,
          trackedPathTexts: [...selectedClipPolygonPaths.keys()],
          currentlyVisible: visiblePath !== undefined,
          clipPolygonNdc: visiblePath?.clipPolygonNdc,
        };
      },
      HideCellPathClipPolygon(pathText?: string) {
        if (pathText === undefined) {
          selectedClipPolygonPaths.clear();
        } else {
          selectedClipPolygonPaths.delete(pathText);
        }

        updateSelectedClipPolygonOverlay();
        return {
          trackedPathTexts: [...selectedClipPolygonPaths.keys()],
        };
      },
      HideClipPolygons() {
        selectedClipPolygonPaths.clear();
        updateSelectedClipPolygonOverlay();
        return {
          trackedPathTexts: [...selectedClipPolygonPaths.keys()],
        };
      },
      DumpCameraPose() {
        return dumpCameraPose(playerPose, camera, renderer, options.renderQualityEnabled);
      },
      get state() {
        return {
          ...createPortalPathDebugState(playerPose.cellId, candidateTables, staticCull),
          visiblePortalPaths: latestVisibleResult?.summary,
          portalInstances: portalInstanceRenderState,
          renderQuality: createRenderQualityState(renderer, pixelRatio, options.renderQualityEnabled),
          ShowCellPathRendersInstances: showCellPathRendersInstances,
        };
      },
      get ShowCellPathRendersInstances() {
        return showCellPathRendersInstances;
      },
      set ShowCellPathRendersInstances(value: boolean) {
        showCellPathRendersInstances = Boolean(value);
      },
      candidateTables,
      staticCull,
    });
    if (portalPathDebugActive) {
      logPortalDebugInstall(candidateTables, staticCull, staticCullDebugActive, overlayActive);
    }
    if (overlayActive) {
      logPortalOverlayGuide(true);
    }

    return {
      updateVisiblePortalPaths() {
        const visibleSummary = visiblePathDebugActive && latestVisibleResult
          ? visibleSummaryToRenderState(mergeStaticPathCounts(latestVisibleResult.summary, staticCull, playerPose.cellId))
          : undefined;
        const showDebugOverlay = menuState.debugEnabled && menuState.debugOverlayEnabled;
        const showFps = menuState.debugOverlayItems.includes("fps");
        const showLocation = menuState.debugOverlayItems.includes("location");
        const showPortalQuantities = menuState.debugOverlayItems.includes("portal-quantities");

        debugOverlay.update({
          visible: showDebugOverlay,
          frameRateFps: showFps ? smoothedFrameRateFps : undefined,
          framePerformance: showFps ? smoothedFramePerformance : undefined,
          webGlRenderInfo: showFps ? latestWebGlRenderInfo : undefined,
          visiblePortalPaths: showPortalQuantities ? visibleSummary : undefined,
          portalEyes: showPortalQuantities ? createPortalEyeDebugStates() : undefined,
          portalInstances: showPortalQuantities ? portalInstanceRenderState : undefined,
          location: showLocation ? xrDebugState : undefined,
          geometry: showLocation ? geometrySession.state : undefined,
          inspectedPathLine: showPortalQuantities
            ? formatInspectedPathLine(activeOverlayPathText, activeOverlayPathCheck, latestVisibleResult)
            : undefined,
        });
        updateSelectedClipPolygonOverlay();
      },
      syncRootCell() {
        if (activeOverlayPathText === undefined) {
          return;
        }

        const refreshResult = (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers })
          .noneuclidPortalDebug?.ShowCellPath(activeOverlayPathText);

        if (!refreshResult?.ok) {
          hideCellPathOverlays(overlays, scene);
          portalInstanceDebugRenderer?.clear();
          removeActivePathTraceOverlay();
          activeOverlayPathText = undefined;
          activeOverlayPathCheck = undefined;
        }
      },
      dispose() {
        hideCellPathOverlays(overlays, scene);
        portalInstanceDebugRenderer?.clear();
        removeActivePathTraceOverlay();
        activeOverlayPathText = undefined;
        activeOverlayPathCheck = undefined;
        debugOverlay.update({ visible: false });
        selectedClipPolygonPaths.clear();
        clipPolygonOverlay.clear();
        uninstallPortalDebugHelpers();
      },
    };
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

  function syncDesktopPalette(): void {
    controls.setLookMode(menuState.isOpen ? "palette" : "camera");
    desktopToolIndicator.setTool(menuState.selectedTool, menuState.placeFlagOptions.flagType, {
      protractorPrompt: getProtractorToolPrompt(),
      tieAndDetachPrompt: getTieAndDetachToolPrompt(),
    });
  }

  function getProtractorToolPrompt(): string {
    if (!activeProtractorToolState.center) {
      return "select: vertex";
    }

    if (!activeProtractorToolState.first) {
      return "select: side1";
    }

    return "select: side2";
  }

  function getTieAndDetachToolPrompt(): string {
    const selectedCount = activeGeodesicCannonToolState.tieAndDetachGeodesicIds?.length ?? 0;
    return selectedCount === 0 ? "select: geodesic 1" : "select: geodesic 2";
  }

  function syncPlacedFlagRuntime(flag: RuntimeWorldObject): void {
    if (flag.kind !== "placed-flag") {
      return;
    }

    let runtime = placedFlagRuntimes.get(flag.id);
    if (!runtime) {
      runtime = createPlacedFlagRuntime(flag, options.assets);
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

  function updateGeodesicEmitterLabels(): void {
    const activeLabelKeys = new Set<string>();
    const cameraQuaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraQuaternion);

    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "geodesic-cannon") {
        continue;
      }

      const inCurrentCell = object.cellId === playerPose.cellId;
      const distanceMeters = Math.hypot(
        playerPose.position.x - object.localPose.translation.x,
        playerPose.position.y - object.localPose.translation.y,
      );
      const visible = inCurrentCell && distanceMeters <= geodesicEmitterLabelRangeMeters;
      object.geodesicIds.forEach((geodesicId) => {
        const key = getGeodesicEmitterLabelKey(object.id, geodesicId);
        activeLabelKeys.add(key);
        const text = getGeodesicDisplayName(geodesicId);
        const label = syncGeodesicEmitterLabelObject(key, text);
        label.root.visible = visible;
        if (!visible) {
          return;
        }

        label.root.position.copy(resolveGeodesicEmitterLabelPosition(object, geodesicId));
        label.root.quaternion.copy(cameraQuaternion);
        label.root.updateMatrixWorld(true);
      });
    }

    for (const [key, label] of [...geodesicEmitterLabelsByKey]) {
      if (activeLabelKeys.has(key)) {
        continue;
      }

      label.root.removeFromParent();
      disposeObject3D(label.root);
      geodesicEmitterLabelsByKey.delete(key);
    }
  }

  function syncGeodesicEmitterLabelObject(key: string, text: string): { readonly text: string; readonly root: THREE.Object3D } {
    const existing = geodesicEmitterLabelsByKey.get(key);
    if (existing?.text === text) {
      return existing;
    }

    if (existing) {
      existing.root.removeFromParent();
      disposeObject3D(existing.root);
    }

    const root = createGeodesicEmitterLabel(text);
    root.name = `geodesic-emitter-label:${key}`;
    scene.add(root);
    const next = { text, root };
    geodesicEmitterLabelsByKey.set(key, next);
    return next;
  }

  function getGeodesicEmitterLabelKey(cannonId: string, geodesicId: string): string {
    return `${cannonId}:${geodesicId}`;
  }

  function resolveGeodesicEmitterLabelPosition(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    geodesicId: string,
  ): THREE.Vector3 {
    const yawRadians = cannon.geodesicEmitterYawRadiansById?.[geodesicId] ?? cannon.aimYawRadians;
    const emitterMatrix = rigidTransformToThreeMatrix(yawRigidTransform3(yawRadians, cannon.localPose.translation));
    return new THREE.Vector3(
      geodesicRayEmitterPosition.x + geodesicEmitterLabelLocalForwardOffsetMeters,
      geodesicRayEmitterPosition.y + geodesicEmitterLabelLocalYOffsetMeters,
      geodesicRayEmitterPosition.z,
    ).applyMatrix4(emitterMatrix);
  }

  function getGeodesicDisplayName(geodesicId: string): string {
    return `G${resolveGeodesicNumber(runtimeObjectRegistry, geodesicId)}`;
  }

  function getGeodesicLabelsById(geodesicIds: readonly string[]): Readonly<Record<string, string>> {
    return Object.fromEntries(geodesicIds.map((geodesicId) => [geodesicId, getGeodesicDisplayName(geodesicId)]));
  }

  function createGeodesicEmitterLabel(text: string): THREE.Object3D {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create geodesic emitter label canvas context.");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(10, 17, 20, 0.72)";
    roundRect(context, 138, 34, canvas.width - 276, 60, 15);
    context.fill();
    context.strokeStyle = "rgba(226, 232, 240, 0.58)";
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = "#f8fafc";
    context.font = "bold 38px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 300);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), material);
    mesh.renderOrder = geodesicEmitterLabelRenderOrder;
    mesh.visible = false;
    return mesh;
  }

  function roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function appendEditingSignCharacter(character: string): void {
    if (!/^[A-Z0-9]$/.test(character) && character !== "\n" && character !== " ") {
      return;
    }

    const editState = menuState.editSignOptions;
    if (!editState) {
      return;
    }

    setEditingSignMessage(editState.flagId, `${editState.message}${character}`);
  }

  function backspaceEditingSignMessage(): void {
    const editState = menuState.editSignOptions;
    if (!editState) {
      return;
    }

    setEditingSignMessage(editState.flagId, [...editState.message].slice(0, -1).join(""));
  }

  function deleteEditingSign(): void {
    const editState = menuState.editSignOptions;
    if (!editState) {
      return;
    }

    const flag = runtimeObjectRegistry.get(editState.flagId);
    if (flag?.kind === "placed-flag") {
      runtimeObjectRegistry.remove(editState.flagId);
      removePlacedFlagRuntime(editState.flagId);
      syncRuntimeObjectPortalInstances();
    }
    menuState = closeRuntimeMenu(menuState);
    syncDesktopPalette();
  }

  function setEditingSignMessage(flagId: string, message: string): void {
    const flag = runtimeObjectRegistry.get(flagId);
    if (flag?.kind !== "placed-flag") {
      menuState = closeRuntimeMenu(menuState);
      syncDesktopPalette();
      return;
    }

    const nextFlag = updatePlacedFlagMessage(flag, message);
    runtimeObjectRegistry.update(nextFlag);
    syncPlacedFlagRuntime(nextFlag);
    menuState = setRuntimeMenuEditingSignMessage(menuState, nextFlag.message);
    syncDesktopPalette();
  }

  function tryPlaceFlagFromAim(ray?: RootAimRay): void {
    if (!ray) {
      return;
    }

    const target = resolveCurrentAimTarget(ray);
    if (target?.kind !== "floor") {
      return;
    }

    const result = placeFlagAtFloorPoint({
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      cellId: target.cellId,
      eyePosition: target.localEyePosition,
      floorPoint: target.localPoint,
      flagType: menuState.placeFlagOptions.flagType,
      id: `placed-flag:${Date.now()}:${placedFlagIdCounter++}`,
    });

    if (result.placed && result.object) {
      syncPlacedFlagRuntime(result.object);
      menuState = setRuntimeMenuSelectedTool(menuState, "none");
      syncDesktopPalette();
      syncSelectableHitboxDebug();
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
        world: activeWorld(),
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

      activeGeodesicCannonToolState = {
        selectedCannonId: result.object.id,
        activeGeodesicId: result.object.activeGeodesicId ?? result.object.geodesicIds[0],
      };
      menuState = setRuntimeMenuSelectedTool(menuState, "none");
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
        world: activeWorld(),
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

      activeGeodesicCannonToolState = {
        selectedCannonId: result.object.id,
        activeGeodesicId: target.object.geodesicId,
      };
      menuState = setRuntimeMenuSelectedTool(menuState, "none");
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
      world: activeWorld(),
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
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      cannon: result.object,
      geodesicId,
    });
    activeGeodesicCannonToolState = {
      selectedCannonId: result.object.id,
      activeGeodesicId: geodesicId,
    };
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function tryUseMeasureLengthToolFromAim(ray?: RootAimRay): void {
    if (!ray) {
      return;
    }

    const target = resolveCurrentAimTarget(ray);
    logVerboseAimClick(target);
    if (!targetIsWithinInteractionRange(target) || target?.object?.kind !== "geodesic-segment") {
      return;
    }

    const geodesicId = target.object.geodesicId;
    const existing = runtimeObjectRegistry.getAll().find((object) =>
      object.kind === "measured-geodesic-length" && object.geodesicId === geodesicId
    );
    const measurement = createMeasuredGeodesicLengthObject({
      id: existing?.id ?? `measured-geodesic-length:${Date.now()}:${measuredGeodesicLengthIdCounter++}`,
      registry: runtimeObjectRegistry,
      geodesicId,
      playerCellId: playerPose.cellId,
      playerPoint: playerPose.position,
      label: getGeodesicDisplayName(geodesicId),
      fallbackSegment: target.object,
    });
    if (!measurement) {
      return;
    }

    if (existing) {
      runtimeObjectRegistry.update(measurement);
    } else {
      runtimeObjectRegistry.add(measurement);
    }
    syncMeasuredGeodesicLengthRuntime(measurement);
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
    syncDesktopPalette();
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
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      geodesicId,
    });
    if (!segment) {
      return false;
    }

    activeGeodesicCannonToolState = {
      selectedCannonId: activeGeodesicCannonToolState.selectedCannonId,
      activeGeodesicId: geodesicId,
    };
    refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    return true;
  }

  function requestConfirmedReload(): void {
    const now = Date.now();
    if ((menuState.reloadConfirmUntilMs ?? 0) > now) {
      menuState = setRuntimeMenuReloadConfirmUntilMs(menuState, undefined);
      syncDesktopPalette();
      dispatchRuntimeCommand({ kind: "reload-world" });
      return;
    }

    const confirmUntilMs = now + reloadConfirmationWindowMs;
    menuState = setRuntimeMenuReloadConfirmUntilMs(menuState, confirmUntilMs);
    syncDesktopPalette();

    if (reloadConfirmationTimeout !== undefined) {
      window.clearTimeout(reloadConfirmationTimeout);
    }

    reloadConfirmationTimeout = window.setTimeout(() => {
      if ((menuState.reloadConfirmUntilMs ?? 0) <= Date.now()) {
        menuState = setRuntimeMenuReloadConfirmUntilMs(menuState, undefined);
        syncDesktopPalette();
      }
      reloadConfirmationTimeout = undefined;
    }, reloadConfirmationWindowMs);
  }

  function resetPlayerToHome(): void {
    const startingPosition = activeWorld().startingPosition;
    const fallbackCell = activeWorld().cells[0];
    playerPose = startingPosition
      ? {
          cellId: startingPosition.cellId,
          position: startingPosition.position,
          yawRadians: startingPosition.yawRadians ?? 0,
          pitchRadians: startingPosition.pitchRadians ?? 0,
        }
      : {
          ...appState.playerPose,
          cellId: fallbackCell?.id ?? appState.playerPose.cellId,
        };
    xrRig.reset();
  }

  function resetRuntimeWorld(): void {
    for (const runtime of dynamicObjectRuntimes) {
      runtime.reset(cellMeshes);
    }
    removePlacedFlags();
    removeGeodesicRuntimeObjects();
    removeMeasuredGeodesicLengths();
    removeProtractorAngles();
  }

  function tryUseProtractorToolFromAim(ray?: RootAimRay): void {
    if (!ray) {
      return;
    }

    const target = resolveCurrentAimTarget(ray);
    logVerboseAimClick(target);
    if (!targetIsWithinInteractionRange(target)) {
      return;
    }

    if (!activeProtractorToolState.center) {
      if (target?.object?.kind !== "geodesic-cannon" && target?.object?.kind !== "geodesic-intersection") {
        return;
      }

      activeProtractorToolState = {
        center: resolveProtractorCenterSelection(target.object),
      };
      syncDesktopPalette();
      return;
    }

    const selected = resolveProtractorDirectedSelectionFromAimTarget(target, activeProtractorToolState.center);
    if (!selected) {
      return;
    }

    if (!activeProtractorToolState.first) {
      activeProtractorToolState = {
        center: activeProtractorToolState.center,
        first: selected,
      };
      syncDesktopPalette();
      return;
    }

    const angle = createProtractorAngleObject({
      id: `protractor-angle:${Date.now()}:${protractorAngleIdCounter++}`,
      center: activeProtractorToolState.center,
      first: activeProtractorToolState.first,
      second: selected,
    });
    runtimeObjectRegistry.add(angle);
    syncProtractorAngleRuntime(angle);
    activeProtractorToolState = {};
    clearProtractorToolFeedback();
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
    syncDesktopPalette();
    syncSelectableHitboxDebug();
  }

  function tryRemoveFocusedProtractorAngle(ray?: RootAimRay): boolean {
    const focused = findFocusedRuntimeObject(ray);
    if (focused?.object.kind !== "protractor-angle") {
      return false;
    }

    runtimeObjectRegistry.remove(focused.object.id);
    removeProtractorAngleRuntime(focused.object.id);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    return true;
  }

  function tryRemoveFocusedMeasuredGeodesicLength(ray?: RootAimRay): boolean {
    const focused = findFocusedRuntimeObject(ray);
    if (focused?.object.kind !== "measured-geodesic-length") {
      return false;
    }

    runtimeObjectRegistry.remove(focused.object.id);
    removeMeasuredGeodesicLengthRuntime(focused.object.id);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
    return true;
  }

  function tryUseFocusedObjectPrimaryInteraction(ray?: RootAimRay): boolean {
    if (!ray) {
      return false;
    }

    const target = resolveCurrentAimTarget(ray);
    if (!targetIsWithinInteractionRange(target)) {
      return false;
    }

    switch (target?.object?.kind) {
      case "asset":
        return tryOpenFocusedQuestionHelp(target.object);
      case "geodesic-segment":
        return tryExtendFocusedGeodesicFromAim(ray);
      case "measured-geodesic-length":
        return tryRemoveFocusedMeasuredGeodesicLength(ray);
      case "protractor-angle":
        return tryRemoveFocusedProtractorAngle(ray);
      default:
        return false;
    }
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

  function openContextMenuFromAim(ray?: RootAimRay): void {
    if (menuState.isOpen) {
      applyDesktopScenePaletteToggle(reduceDesktopScenePaletteToggle(true, "secondary-click"));
      return;
    }

    if (tryOpenFocusedObjectMenu(ray)) {
      return;
    }

    menuState = openRuntimeMenu(menuState);
    syncDesktopPalette();
  }

  function tryOpenFocusedObjectMenu(ray?: RootAimRay): boolean {
    const focused = findFocusedRuntimeObject(ray);
    if (!focused) {
      return false;
    }

    if (
      focused.object.kind === "placed-flag" &&
      focused.object.interactable?.action === "edit-flag" &&
      isRuntimeToolEnabled(appConfig, "place-flag")
    ) {
      menuState = showRuntimeMenuEditSign(menuState, {
        flagId: focused.object.id,
        message: focused.object.message,
      });
      syncDesktopPalette();
      return true;
    }

    if (focused.object.kind === "geodesic-cannon" && isRuntimeToolEnabled(appConfig, "geodesic-cannon")) {
      activeGeodesicCannonToolState = {
        selectedCannonId: focused.object.id,
        activeGeodesicId: focused.object.activeGeodesicId,
      };
      menuState = showRuntimeMenuGeodesicCannonActions(menuState, {
        cannonId: focused.object.id,
        geodesicIds: focused.object.geodesicIds,
        geodesicLabelsById: getGeodesicLabelsById(focused.object.geodesicIds),
        lockedGeodesicIds: getLockedGeodesicIds(focused.object.geodesicIds),
        canTieAndDetach: canTieAndDetachGeodesicsFromCannon(focused.object.id),
      });
      syncDesktopPalette();
      return true;
    }

    if (focused.object.kind === "asset" && focused.object.interactable?.action === "open-geometry-computer") {
      menuState = showRuntimeMenuGeometryComputerActions(
        menuState,
        createGeometryComputerMenuOptions(focused.object.id),
      );
      syncDesktopPalette();
      return true;
    }

    if (focused.object.kind === "asset" && tryOpenFocusedQuestionHelp(focused.object)) {
      return true;
    }

    return false;
  }

  function tryOpenFocusedQuestionHelp(object: RuntimeWorldObject): boolean {
    if (object.kind !== "asset" || object.interactable?.action !== "open-tutorial") {
      return false;
    }

    const tutorialPages = object.tutorialPages ?? [];
    const goalPages = object.goalPages ?? [];
    if (tutorialPages.length === 0 && goalPages.length === 0) {
      return false;
    }

    menuState = showRuntimeMenuQuestionHelp(menuState, {
      objectId: object.id,
      tutorialPages,
      goalPages,
    });
    syncDesktopPalette();
    return true;
  }

  function stepOpenTutorialPage(delta: -1 | 1): void {
    const options = menuState.tutorialOptions;
    if (menuState.page !== "tutorial" || !options) {
      return;
    }

    menuState = setRuntimeMenuTutorialPageIndex(menuState, options.pageIndex + delta);
    syncDesktopPalette();
  }

  function stepOpenGoalPage(delta: -1 | 1): void {
    const options = menuState.goalOptions;
    if (menuState.page !== "goal" || !options) {
      return;
    }

    menuState = setRuntimeMenuGoalPageIndex(menuState, options.pageIndex + delta);
    syncDesktopPalette();
  }

  function createGeometryComputerMenuOptions(computerId: string): Parameters<typeof showRuntimeMenuGeometryComputerActions>[1] {
    const state = geometrySession.state;
    const current = state.current.kind === "torus-skew" ? state.current : undefined;
    const target = state.target.kind === "torus-skew" ? state.target : undefined;

    return {
      computerId,
      available: current !== undefined || target !== undefined,
      currentSkewXMeters: current?.skewXMeters,
      targetSkewXMeters: target?.skewXMeters,
    };
  }

  function refreshOpenGeometryComputerMenu(): void {
    const computerId = menuState.geometryComputerOptions?.computerId;
    if (menuState.page !== "geometry-computer-actions" || !computerId) {
      return;
    }

    menuState = showRuntimeMenuGeometryComputerActions(
      menuState,
      createGeometryComputerMenuOptions(computerId),
    );
  }

  function setGeometryComputerSkewTarget(computerId: string, skewXMeters: number): void {
    const state = geometrySession.state;
    const base = state.target.kind === "torus-skew"
      ? state.target
      : state.current.kind === "torus-skew"
        ? state.current
        : undefined;
    if (!base) {
      refreshOpenGeometryComputerMenu();
      syncDesktopPalette();
      return;
    }

    geometrySession.setTarget({
      ...base,
      skewXMeters,
    });
    menuState = showRuntimeMenuGeometryComputerActions(
      menuState,
      createGeometryComputerMenuOptions(computerId),
    );
    syncDesktopPalette();
  }

  function stepGeometryComputerSkewTarget(computerId: string, deltaXMeters: number): void {
    const state = geometrySession.state;
    const base = state.target.kind === "torus-skew"
      ? state.target
      : state.current.kind === "torus-skew"
        ? state.current
        : undefined;
    if (!base) {
      refreshOpenGeometryComputerMenu();
      syncDesktopPalette();
      return;
    }

    setGeometryComputerSkewTarget(computerId, base.skewXMeters + deltaXMeters);
  }

  function addGeodesicToCannon(
    cannonId: string,
    options: { readonly afterAdd?: "show-cannon-menu" | "return-to-none" } = {},
  ): void {
    const afterAdd = options.afterAdd ?? "show-cannon-menu";
    const cannon = runtimeObjectRegistry.get(cannonId);
    if (cannon?.kind !== "geodesic-cannon") {
      menuState = afterAdd === "return-to-none"
        ? closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "none"))
        : closeRuntimeMenu(menuState);
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
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      cannon: cannonForNewGeodesic,
      geodesicId,
    });
    const updatedCannon = runtimeObjectRegistry.get(cannonId);
    if (updatedCannon?.kind === "geodesic-cannon") {
      activeGeodesicCannonToolState = {
        selectedCannonId: updatedCannon.id,
        activeGeodesicId: geodesicId,
      };
      menuState = afterAdd === "return-to-none"
        ? closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "none"))
        : showRuntimeMenuGeodesicCannonActions(menuState, {
            cannonId: updatedCannon.id,
            geodesicIds: updatedCannon.geodesicIds,
            geodesicLabelsById: getGeodesicLabelsById(updatedCannon.geodesicIds),
            lockedGeodesicIds: getLockedGeodesicIds(updatedCannon.geodesicIds),
            canTieAndDetach: canTieAndDetachGeodesicsFromCannon(updatedCannon.id),
          });
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
      menuState = closeRuntimeMenu(menuState);
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
    activeGeodesicCannonToolState = {
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
    };
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "geodesic-cannon-rotate"));
    syncDesktopPalette();
    void controls.requestPointerLock();
  }

  function startGeodesicCannonAim(cannonId: string, requestedGeodesicId?: string): void {
    const object = runtimeObjectRegistry.get(cannonId);
    const cannon = object?.kind === "geodesic-cannon" ? object : undefined;
    if (cannon?.kind !== "geodesic-cannon") {
      menuState = closeRuntimeMenu(menuState);
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
    activeGeodesicCannonToolState = {
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
    };
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "geodesic-cannon-aim"));
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
      menuState = closeRuntimeMenu(menuState);
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
        collectGeodesicPortalWord(activeWorld(), runtimeObjectRegistry, incidentGeodesicId),
      ]),
    );
    activeGeodesicCannonToolState = {
      selectedCannonId: selectedCannon.id,
      activeGeodesicId: geodesicId,
      carryPortalWordsByGeodesicId,
      carryPortalWord: geodesicId
        ? carryPortalWordsByGeodesicId[geodesicId] ??
          collectGeodesicPortalWord(activeWorld(), runtimeObjectRegistry, geodesicId)
        : undefined,
    };
    geodesicCannonRotationTargetLengthMeters = geodesicId
      ? getGeodesicTotalLengthMeters(geodesicId)
      : undefined;
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "geodesic-cannon-carry"));
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
    if (menuState.selectedTool !== "geodesic-cannon-carry") {
      return false;
    }

    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;
    if (cannon?.kind === "geodesic-cannon") {
      rebuildCarriedGeodesicFromCannon(cannon);
      removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
      syncRuntimeObjectPortalInstances();
      syncSelectableHitboxDebug();
    }
    activeGeodesicCannonToolState = {};
    geodesicCannonRotationTargetLengthMeters = undefined;
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
    clearCarriedGeodesicCannonGlow();
    syncDesktopPalette();
    return true;
  }

  function deleteGeodesicFromCannon(cannonId: string, geodesicId: string): void {
    const cannon = runtimeObjectRegistry.get(cannonId);
    if (cannon?.kind !== "geodesic-cannon") {
      menuState = closeRuntimeMenu(menuState);
      syncDesktopPalette();
      return;
    }

    removeProtractorAnglesForGeodesic(geodesicId);
    removeMeasuredGeodesicLengthsForGeodesic(geodesicId);
    removeGeodesic(runtimeObjectRegistry, geodesicId);
    const refreshed = runtimeObjectRegistry.get(cannonId);
    const updatedCannon = refreshed?.kind === "geodesic-cannon" ? refreshed : cannon;
    const activeGeodesicId = updatedCannon.activeGeodesicId;
    activeGeodesicCannonToolState = {
      selectedCannonId: updatedCannon.id,
      activeGeodesicId,
    };
    menuState = showRuntimeMenuGeodesicCannonActions(menuState, {
      cannonId: updatedCannon.id,
      geodesicIds: updatedCannon.geodesicIds,
      geodesicLabelsById: getGeodesicLabelsById(updatedCannon.geodesicIds),
      lockedGeodesicIds: getLockedGeodesicIds(updatedCannon.geodesicIds),
      canTieAndDetach: canTieAndDetachGeodesicsFromCannon(updatedCannon.id),
    });
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function canTieAndDetachGeodesicsFromCannon(cannonId: string): boolean {
    return collectLockedIncidentGeodesicIdsForEmitter(runtimeObjectRegistry, cannonId)
      .filter((geodesicId) => !isGeodesicStraightening(runtimeObjectRegistry, geodesicId))
      .length >= 2;
  }

  function startGeodesicCannonTieAndDetach(cannonId: string): void {
    if (!canTieAndDetachGeodesicsFromCannon(cannonId)) {
      syncDesktopPalette();
      return;
    }

    syncTieAndDetachSelectionHighlights([]);
    activeGeodesicCannonToolState = {
      selectedCannonId: cannonId,
      tieAndDetachGeodesicIds: [],
    };
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "geodesic-cannon-tie-detach"));
    syncDesktopPalette();
    if (!renderer.xr.isPresenting) {
      void controls.requestPointerLock();
    }
  }

  function trySelectTieAndDetachGeodesicFromAim(ray?: RootAimRay): boolean {
    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
    if (!ray || !cannonId) {
      return false;
    }

    const selectedGeodesicId = resolveTieAndDetachGeodesicFromAim(ray, cannonId);
    if (!selectedGeodesicId) {
      return false;
    }

    const selectedIds = activeGeodesicCannonToolState.tieAndDetachGeodesicIds ?? [];
    if (selectedIds.includes(selectedGeodesicId)) {
      return true;
    }

    const nextIds = [...selectedIds, selectedGeodesicId];
    if (nextIds.length < 2) {
      activeGeodesicCannonToolState = {
        ...activeGeodesicCannonToolState,
        tieAndDetachGeodesicIds: nextIds,
      };
      syncTieAndDetachSelectionHighlights(nextIds);
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      return true;
    }

    tieAndDetachGeodesicsFromCannon(cannonId, [nextIds[0], nextIds[1]]);
    return true;
  }

  function resolveTieAndDetachGeodesicFromAim(ray: RootAimRay, cannonId: string): string | undefined {
    const selectableIds = collectLockedIncidentGeodesicIdsForEmitter(runtimeObjectRegistry, cannonId)
      .filter((id) => !isGeodesicStraightening(runtimeObjectRegistry, id));
    for (const target of resolveCurrentAimTargets(ray)) {
      if (!targetIsWithinInteractionRange(target)) {
        continue;
      }

      const geodesicId = target.object?.kind === "geodesic-segment"
        ? target.object.geodesicId
        : target.object?.kind === "geodesic-cannon"
          ? target.geodesicEmitterGeodesicId
          : undefined;
      if (geodesicId && selectableIds.includes(geodesicId)) {
        return geodesicId;
      }
    }

    return undefined;
  }

  function tieAndDetachGeodesicsFromCannon(cannonId: string, selectedGeodesicIds: readonly [string, string]): void {
    syncTieAndDetachSelectionHighlights([]);
    const geodesicId = `geodesic:${Date.now()}:${geodesicIdCounter++}`;
    const segments = tieAndDetachIncidentGeodesics({
      world: activeWorld(),
      registry: runtimeObjectRegistry,
      emitterId: cannonId,
      geodesicId,
      incidentGeodesicIds: selectedGeodesicIds,
    });
    if (segments.length === 0) {
      syncDesktopPalette();
      syncRuntimeObjectPortalInstances();
      return;
    }

    activeGeodesicCannonToolState = {};
    menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, "none"));
    removeProtractorAnglesForMissingVertices(pruneMissingGeodesicIntersectionObjects(runtimeObjectRegistry));
    syncDesktopPalette();
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function syncTieAndDetachSelectionHighlights(selectedGeodesicIds: readonly string[]): void {
    const selected = new Set(selectedGeodesicIds);
    for (const object of runtimeObjectRegistry.getAll()) {
      if (object.kind !== "geodesic-segment") {
        continue;
      }

      const nextHighlightState = selected.has(object.geodesicId) ? "tie-detach-selected" : undefined;
      if (object.highlightState === nextHighlightState) {
        continue;
      }

      runtimeObjectRegistry.update({
        ...object,
        highlightState: nextHighlightState,
      });
    }
  }

  function resolveCannonGeodesicId(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    requestedGeodesicId: string | undefined,
  ): string | undefined {
    if (requestedGeodesicId && cannon.geodesicIds.includes(requestedGeodesicId)) {
      return requestedGeodesicId;
    }

    return cannon.activeGeodesicId ?? cannon.geodesicIds[0];
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
    if (menuState.selectedTool !== "geodesic-cannon-carry") {
      clearCarriedGeodesicCannonGlow();
      return;
    }

    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
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
      cellId: playerPose.cellId,
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
    rebuildCarriedGeodesicFromCannon(nextCannon, cannon);
    syncCarriedGeodesicCannonGlow(nextCannon);
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
  }

  function rebuildCarriedGeodesicFromCannon(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    previousCannon?: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): void {
    const geodesicId = cannon.activeGeodesicId ?? activeGeodesicCannonToolState.activeGeodesicId;
    const lockedIncidentGeodesicIds = collectLockedIncidentGeodesicIdsForEmitter(runtimeObjectRegistry, cannon.id);
    if (lockedIncidentGeodesicIds.length === 0 && !geodesicId) {
      return;
    }

    if (lockedIncidentGeodesicIds.length > 0) {
      for (const incidentGeodesicId of lockedIncidentGeodesicIds) {
        updateCarriedGeodesicPortalWord(cannon, previousCannon, incidentGeodesicId);
        const carriedPortalWord = activeGeodesicCannonToolState.carryPortalWordsByGeodesicId?.[incidentGeodesicId] ??
          (activeGeodesicCannonToolState.activeGeodesicId === incidentGeodesicId
            ? activeGeodesicCannonToolState.carryPortalWord
            : undefined);
        rebuildConnectedGeodesicBetweenEmitters({
          world: activeWorld(),
          registry: runtimeObjectRegistry,
          geodesicId: incidentGeodesicId,
          carriedEmitterId: cannon.id,
          carriedEmitterBeforeMove: previousCannon,
          carriedEmitterPortalTransition: latestPlayerPortalTransition,
          carriedPortalWord,
        });
        refreshProtractorAnglesForGeodesic(incidentGeodesicId);
        refreshMeasuredGeodesicLengthsForGeodesic(incidentGeodesicId);
      }
    } else if (geodesicId && isGeodesicLocked(runtimeObjectRegistry, geodesicId)) {
      updateCarriedGeodesicPortalWord(cannon, previousCannon, geodesicId);
      rebuildConnectedGeodesicBetweenEmitters({
        world: activeWorld(),
        registry: runtimeObjectRegistry,
        geodesicId,
        carriedEmitterId: cannon.id,
        carriedEmitterBeforeMove: previousCannon,
        carriedEmitterPortalTransition: latestPlayerPortalTransition,
        carriedPortalWord: activeGeodesicCannonToolState.carryPortalWordsByGeodesicId?.[geodesicId] ??
          activeGeodesicCannonToolState.carryPortalWord,
      });
      refreshProtractorAnglesForGeodesic(geodesicId);
      refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    } else if (geodesicId) {
      rebuildActiveGeodesicFromCannon(cannon, { connectEmitters: false, breakOnForbiddenZone: true });
      refreshProtractorAnglesForGeodesic(geodesicId);
      refreshMeasuredGeodesicLengthsForGeodesic(geodesicId);
    }
  }

  function updateCarriedGeodesicPortalWord(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    previousCannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }> | undefined,
    geodesicId: string,
  ): void {
    const transition = latestPlayerPortalTransition;
    if (
      !previousCannon ||
      !transition ||
      activeGeodesicCannonToolState.carryPortalTransitionSerialByGeodesicId?.[geodesicId] ===
        latestPlayerPortalTransitionSerial ||
      previousCannon.cellId !== transition.sourceCellId ||
      cannon.cellId !== transition.targetCellId
    ) {
      return;
    }

    const connection = getGeodesicConnection(runtimeObjectRegistry, geodesicId);
    const currentWord = activeGeodesicCannonToolState.carryPortalWordsByGeodesicId?.[geodesicId] ??
      (activeGeodesicCannonToolState.activeGeodesicId === geodesicId
        ? activeGeodesicCannonToolState.carryPortalWord
        : undefined) ??
      collectGeodesicPortalWord(activeWorld(), runtimeObjectRegistry, geodesicId);
    let nextWord: readonly GeodesicPortalTraversal[] | undefined;
    if (connection?.incomingEmitterId === cannon.id) {
      nextWord = [...currentWord, transition];
    } else if (connection?.outgoingEmitterId === cannon.id) {
      nextWord = [reverseGeodesicPortalTraversal(transition), ...currentWord];
    }

    if (!nextWord) {
      return;
    }

    activeGeodesicCannonToolState = {
      ...activeGeodesicCannonToolState,
      carryPortalWordsByGeodesicId: {
        ...activeGeodesicCannonToolState.carryPortalWordsByGeodesicId,
        [geodesicId]: nextWord,
      },
      carryPortalWord: activeGeodesicCannonToolState.activeGeodesicId === geodesicId
        ? nextWord
        : activeGeodesicCannonToolState.carryPortalWord,
      carryPortalTransitionSerial: latestPlayerPortalTransitionSerial,
      carryPortalTransitionSerialByGeodesicId: {
        ...activeGeodesicCannonToolState.carryPortalTransitionSerialByGeodesicId,
        [geodesicId]: latestPlayerPortalTransitionSerial,
      },
    };
    if (debugLevel === "verbose") {
      console.info("[noneuclid] carried geodesic portal word", {
        geodesicId,
        carriedEmitterId: cannon.id,
        word: formatGeodesicPortalWord(nextWord),
        transition,
      });
    }
  }

  function resolveDesktopCarriedGeodesicCannonAnchor(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    activeAimRay: RootAimRay | undefined,
  ): Vec3 | undefined {
    if (!activeAimRay) {
      return undefined;
    }

    const screenPoint = threePointToWorld(
      activeAimRay.origin.clone().add(
        activeAimRay.direction.clone().multiplyScalar(carriedGeodesicEmitterDesktopDistanceMeters),
      ),
    );
    return {
      x: screenPoint.x,
      y: screenPoint.y,
      z: cannon.localPose.translation.z,
    };
  }

  function resolveVrCarriedGeodesicCannonAnchor(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
    activeAimRay: RootAimRay | undefined,
  ): Vec3 | undefined {
    if (!activeAimRay) {
      return undefined;
    }

    const handPoint = threePointToWorld(activeAimRay.origin);
    return {
      x: handPoint.x,
      y: handPoint.y,
      z: cannon.localPose.translation.z,
    };
  }

  function carriedGeodesicCannonTouchesForbiddenZone(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): boolean {
    const cell = activeWorld().cellsById.get(cannon.cellId);
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
    activeGeodesicCannonToolState = {};
    geodesicCannonRotationTargetLengthMeters = undefined;
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
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

    glow.visible = menuState.selectedTool === "geodesic-cannon-carry";
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

  function createCarriedGeodesicCannonGlow(): THREE.Mesh {
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 1.72, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff7ac8,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    glow.name = "carried-geodesic-emitter-glow";
    glow.renderOrder = 925;
    glow.visible = false;
    return glow;
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
    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;

    if (!cannon || cannon.kind !== "geodesic-cannon") {
      activeGeodesicCannonToolState = {};
      menuState = setRuntimeMenuSelectedTool(menuState, "none");
      syncDesktopPalette();
      return;
    }

    if (yawDeltaRadians !== 0 && Number.isFinite(yawDeltaRadians)) {
      const nextYaw = Math.atan2(
        Math.sin(cannon.aimYawRadians + yawDeltaRadians),
        Math.cos(cannon.aimYawRadians + yawDeltaRadians),
      );
      const nextCannon = {
        ...cannon,
        aimYawRadians: nextYaw,
        localPose: yawRigidTransform3(nextYaw, cannon.localPose.translation),
        geodesicEmitterYawRadiansById: activeGeodesicCannonToolState.activeGeodesicId
          ? {
              ...cannon.geodesicEmitterYawRadiansById,
              [activeGeodesicCannonToolState.activeGeodesicId]: nextYaw,
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
      menuState = setRuntimeMenuSelectedTool(menuState, "none");
      syncDesktopPalette();
    }
  }

  function updateActiveGeodesicCannonAim(
    finishRequested: boolean,
    activeAimRay: RootAimRay | undefined,
  ): void {
    const cannonId = activeGeodesicCannonToolState.selectedCannonId;
    const cannon = cannonId ? runtimeObjectRegistry.get(cannonId) : undefined;

    if (!cannon || cannon.kind !== "geodesic-cannon") {
      activeGeodesicCannonToolState = {};
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
        const nextCannon = {
          ...cannon,
          aimYawRadians: nextYaw,
          localPose: yawRigidTransform3(nextYaw, cannon.localPose.translation),
          geodesicEmitterYawRadiansById: activeGeodesicCannonToolState.activeGeodesicId
            ? {
                ...cannon.geodesicEmitterYawRadiansById,
                [activeGeodesicCannonToolState.activeGeodesicId]: nextYaw,
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
    if (playerPose.cellId !== cannon.cellId) {
      return false;
    }

    const rangeMeters = getRuntimeObjectInteractionRangeMeters(cannon);
    const dx = playerPose.position.x - cannon.localPose.translation.x;
    const dy = playerPose.position.y - cannon.localPose.translation.y;
    return Math.hypot(dx, dy) <= rangeMeters;
  }

  function resolveGeodesicCannonAbsoluteEmitterPoint(
    cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  ): Vec3 {
    return {
      x: cannon.localPose.translation.x,
      y: cannon.localPose.translation.y,
      z: cannon.localPose.translation.z + geodesicRayBeamHeightMeters,
    };
  }

  function blockPlayerMoveAgainstRuntimeObjects(
    previousPose: PlayerPose,
    result: ReturnType<typeof movePlayer>,
  ): ReturnType<typeof movePlayer> {
    if (!playerIntersectsRuntimeObject(result.pose)) {
      return result;
    }

    return {
      ...result,
      pose: {
        ...previousPose,
        yawRadians: result.pose.yawRadians,
        pitchRadians: result.pose.pitchRadians,
      },
      blocked: true,
      crossedPortal: false,
      crossedPortalId: undefined,
    };
  }

  function playerIntersectsRuntimeObject(pose: PlayerPose): boolean {
    const playerBounds = getDynamicObjectCollisionBounds(createPlayerCollisionState(pose));
    if (!playerBounds) {
      return false;
    }

    for (const object of runtimeObjectRegistry.getPlayerBlockingObjectsInCell(pose.cellId)) {
      const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
      if (bounds && simpleCylinderIntersectsSimpleCylinder(playerBounds, bounds)) {
        return true;
      }
    }

    return false;
  }

  function createPlayerCollisionState(pose: PlayerPose) {
    return playerPoseToDynamicObject(
      pose,
      simpleCollisionCylinder(appState.playerBody.radiusMeters, appState.playerBody.heightMeters, {
        x: 0,
        y: 0,
        z: appState.playerBody.heightMeters / 2,
      }),
    );
  }

  function finishGeodesicCannonAimMode(): void {
    geodesicCannonRotationTargetLengthMeters = undefined;
    menuState = setRuntimeMenuSelectedTool(menuState, "none");
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
    const geodesicId = cannon.activeGeodesicId ?? activeGeodesicCannonToolState.activeGeodesicId;
    if (!geodesicId) {
      return;
    }

    const totalLengthMeters = geodesicCannonRotationTargetLengthMeters ?? getGeodesicTotalLengthMeters(geodesicId);
    rebuildGeodesicToLength({
      world: activeWorld(),
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
    activeGeodesicCannonToolState = {
      selectedCannonId: cannon.id,
      activeGeodesicId: geodesicId,
    };
  }

  function getGeodesicTotalLengthMeters(geodesicId: string): number {
    return runtimeObjectRegistry.getAll()
      .filter((object): object is Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }> =>
        object.kind === "geodesic-segment" && object.geodesicId === geodesicId
      )
      .reduce((total, segment) => total + segment.lengthMeters, 0);
  }

  function getDistanceAlongGeodesicSegment(
    segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
    localPoint: Vec3,
  ): number {
    const dx = localPoint.x - segment.start.x;
    const dy = localPoint.y - segment.start.y;
    const dz = localPoint.z - segment.start.z;
    return dx * segment.direction.x + dy * segment.direction.y + dz * segment.direction.z;
  }

  function getLockedGeodesicIds(geodesicIds: readonly string[]): readonly string[] {
    return geodesicIds.filter((geodesicId) => isGeodesicLocked(runtimeObjectRegistry, geodesicId));
  }

  function updateFloatingObjectTooltip(
    xrActive: boolean,
    activeAimRay: RootAimRay | undefined,
    xrHeadWorldPose: XrHeadWorldPose | undefined,
  ): void {
    if (menuState.isOpen || desktopFlagEditor.isOpen()) {
      floatingObjectTooltip.update({ visible: false });
      updateXrObjectTooltip(undefined);
      return;
    }

    const focused = findFocusedRuntimeObject(activeAimRay);
    const text = focused ? getRuntimeObjectTooltipText(focused.object, xrActive ? "xr" : "desktop") : undefined;
    if (xrActive) {
      floatingObjectTooltip.update({ visible: false });
      updateXrObjectTooltip(text && focused ? {
        text,
        anchor: focused.tooltipAnchor,
        headWorldPosition: xrHeadWorldPose?.position,
      } : undefined);
      return;
    }

    updateXrObjectTooltip(undefined);
    const screenPosition = focused ? resolveDesktopTooltipScreenPosition() : undefined;

    floatingObjectTooltip.update({
      visible: Boolean(text && screenPosition),
      text,
      xPixels: screenPosition?.x,
      yPixels: screenPosition?.y,
    });
  }

  function updateXrObjectTooltip(options: {
    readonly text: string;
    readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
    readonly headWorldPosition?: THREE.Vector3;
  } | undefined): void {
    if (!options) {
      if (xrObjectTooltip) {
        xrObjectTooltip.root.visible = false;
      }
      return;
    }

    const tooltip = syncXrObjectTooltip(options.text);
    tooltip.root.visible = true;
    tooltip.root.position.copy(worldPointToThree({
      x: options.anchor.x,
      y: options.anchor.y,
      z: options.anchor.z + xrObjectTooltipYOffsetMeters,
    }));
    tooltip.root.quaternion.copy(
      options.headWorldPosition
        ? resolveFrontFacingQuaternion(tooltip.root.position, options.headWorldPosition)
        : camera.quaternion,
    );
    tooltip.root.updateMatrixWorld(true);
  }

  function syncXrObjectTooltip(text: string): { readonly text: string; readonly root: THREE.Object3D } {
    if (xrObjectTooltip?.text === text) {
      return xrObjectTooltip;
    }

    clearXrObjectTooltip();
    const root = createXrObjectTooltip(text);
    root.name = "xr-object-tooltip";
    scene.add(root);
    xrObjectTooltip = { text, root };
    return xrObjectTooltip;
  }

  function clearXrObjectTooltip(): void {
    if (!xrObjectTooltip) {
      return;
    }

    xrObjectTooltip.root.removeFromParent();
    disposeObject3D(xrObjectTooltip.root);
    xrObjectTooltip = undefined;
  }

  function createXrObjectTooltip(text: string): THREE.Object3D {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create XR object tooltip canvas context.");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(10, 17, 20, 0.9)";
    roundRect(context, 42, 34, canvas.width - 84, canvas.height - 68, 18);
    context.fill();
    context.strokeStyle = "rgba(226, 232, 240, 0.66)";
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = "#f8fafc";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const lines = text.split("\n").slice(0, 3);
    const fontSize = lines.length > 2 ? 44 : 50;
    const lineHeight = fontSize * 1.18;
    const firstLineY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    context.font = `bold ${fontSize}px system-ui, sans-serif`;
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, firstLineY + index * lineHeight, canvas.width - 120);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.31), material);
    mesh.name = "xr-object-tooltip:billboard";
    mesh.renderOrder = xrObjectTooltipRenderOrder;
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  function updateAimCrossMarker(xrActive: boolean, activeAimRay: RootAimRay | undefined): void {
    if (
      (
        menuState.selectedTool !== "none" &&
        menuState.selectedTool !== "aim" &&
        menuState.selectedTool !== "place-flag" &&
        menuState.selectedTool !== "geodesic-cannon" &&
        menuState.selectedTool !== "geodesic-cannon-aim" &&
        menuState.selectedTool !== "geodesic-cannon-tie-detach" &&
        menuState.selectedTool !== "measure-length" &&
        menuState.selectedTool !== "protractor"
      ) ||
      menuState.isOpen ||
      desktopFlagEditor.isOpen()
    ) {
      aimCrossMarker.update(undefined);
      updateAimControllerRay(false);
      return;
    }

    const target = activeAimRay ? resolveCurrentAimTarget(activeAimRay) : undefined;
    aimCrossMarker.update(target, activeAimRay);
    updateAimControllerRay(xrActive && Boolean(target), activeAimRay, aimCrossMarker.root.position);
  }

  function updateAimControllerRay(
    visible: boolean,
    activeAimRay?: RootAimRay,
    targetPosition?: THREE.Vector3,
  ): void {
    if (!visible || !activeAimRay || !targetPosition) {
      aimControllerRay.visible = false;
      return;
    }

    aimControllerRayPositions[0] = activeAimRay.origin.x;
    aimControllerRayPositions[1] = activeAimRay.origin.y;
    aimControllerRayPositions[2] = activeAimRay.origin.z;
    aimControllerRayPositions[3] = targetPosition.x;
    aimControllerRayPositions[4] = targetPosition.y;
    aimControllerRayPositions[5] = targetPosition.z;
    aimControllerRayGeometry.attributes.position.needsUpdate = true;
    aimControllerRay.visible = true;
  }

  function updateProtractorToolFeedback(activeAimRay: RootAimRay | undefined): void {
    if (menuState.selectedTool !== "protractor" || menuState.isOpen || desktopFlagEditor.isOpen()) {
      clearProtractorToolFeedback();
      return;
    }

    const target = activeAimRay ? resolveCurrentAimTarget(activeAimRay) : undefined;
    const usableTarget = targetIsWithinInteractionRange(target) ? target : undefined;
    const center = activeProtractorToolState.center ??
      (usableTarget?.object?.kind === "geodesic-cannon" || usableTarget?.object?.kind === "geodesic-intersection"
        ? resolveProtractorCenterSelection(usableTarget.object)
        : undefined);
    if (!center) {
      clearProtractorToolFeedback();
      return;
    }

    const hoverSelection = activeProtractorToolState.center
      ? resolveProtractorDirectedSelectionFromAimTarget(usableTarget, activeProtractorToolState.center)
      : undefined;
    const feedback = createProtractorToolFeedback({
      center,
      centerLocked: Boolean(activeProtractorToolState.center),
      first: activeProtractorToolState.first,
      hover: hoverSelection,
    });
    if (!feedback) {
      clearProtractorToolFeedback();
      return;
    }

    syncProtractorToolFeedback(feedback);
  }

  function resolveProtractorDirectedSelectionFromAimTarget(
    target: ReturnType<typeof resolveCurrentAimTarget>,
    center: ProtractorCenterSelection,
  ): ProtractorDirectedGeodesic | undefined {
    if (target?.object?.kind === "geodesic-segment") {
      const selected = resolveProtractorDirectedGeodesicSelection({
        center,
        segment: target.object,
        hitPoint: target.localPoint,
      });
      return selected ? withProtractorGeodesicLabel(selected) : undefined;
    }

    if (target?.object?.kind === "geodesic-cannon") {
      const selected = resolveProtractorEmitterGeodesicSelection({
        center,
        emitter: target.object,
        geodesicId: target.geodesicEmitterGeodesicId,
      });
      return selected ? withProtractorGeodesicLabel(selected) : undefined;
    }

    return undefined;
  }

  function withProtractorGeodesicLabel(selection: ProtractorDirectedGeodesic): ProtractorDirectedGeodesic {
    return {
      ...selection,
      label: getGeodesicDisplayName(selection.geodesicId),
    };
  }

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
    const ignoredGeodesicIds = menuState.selectedTool === "geodesic-cannon-aim" &&
        activeGeodesicCannonToolState.activeGeodesicId
      ? [activeGeodesicCannonToolState.activeGeodesicId]
      : menuState.selectedTool === "geodesic-cannon-tie-detach"
        ? activeGeodesicCannonToolState.tieAndDetachGeodesicIds
        : undefined;
    const aimCamera = syncAimRayCamera(ray);

    return resolveAimTargets({
      world: activeWorld(),
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

  function createAimTargetCycleSignature(targets: readonly AimTarget[]): string {
    return targets.map((target) => [
      target.object?.id ?? "",
      target.geodesicEmitterGeodesicId ?? "",
      target.portalPathId,
    ].join(":")).join("|");
  }

  function syncAimRayCamera(ray: RootAimRay): THREE.Camera {
    aimRayCamera.position.copy(ray.origin);
    aimRayCamera.quaternion.copy(ray.quaternion);
    aimRayCamera.updateMatrixWorld(true);
    return aimRayCamera;
  }

  function syncProtractorToolFeedback(feedback: {
    readonly signature: string;
    readonly cellId: string;
    readonly root: THREE.Group;
  }): void {
    if (protractorToolFeedback?.signature === feedback.signature) {
      disposeObject3D(feedback.root);
      return;
    }

    clearProtractorToolFeedback();
    const cellRoot = cellMeshes.get(feedback.cellId);
    if (!cellRoot) {
      disposeObject3D(feedback.root);
      return;
    }

    cellRoot.add(feedback.root);
    protractorToolFeedback = feedback;
  }

  function clearProtractorToolFeedback(): void {
    if (!protractorToolFeedback) {
      return;
    }

    protractorToolFeedback.root.removeFromParent();
    disposeObject3D(protractorToolFeedback.root);
    protractorToolFeedback = undefined;
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

  function intersectRootRayWithFloor(originThree: THREE.Vector3, directionThree: THREE.Vector3): Vec3 | undefined {
    const origin = threePointToWorld(originThree);
    const direction = threeDirectionToWorld(directionThree);
    if (Math.abs(direction.z) <= 1e-6) {
      return undefined;
    }

    const t = -origin.z / direction.z;
    if (!Number.isFinite(t) || t <= 0) {
      return undefined;
    }

    return {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t,
      z: 0,
    };
  }

  function logVerboseAimClick(target: ReturnType<typeof resolveCurrentAimTarget>): void {
    if (debugLevel !== "verbose") {
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

  function getRuntimeObjectInteractionRangeMeters(object: RuntimeWorldObject): number {
    return object.tooltip?.rangeMeters ?? object.interactable?.rangeMeters ?? 2.5;
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
      selectedTool: menuState.selectedTool,
      canExtendGeodesic: object.kind === "geodesic-segment" &&
        canExtendGeodesicSegment(object) &&
        !isGeodesicLocked(runtimeObjectRegistry, object.geodesicId),
    });
  }

  function updateHelpLens(xrActive: boolean, activeAimRay: RootAimRay | undefined): void {
    if (menuState.isOpen || desktopFlagEditor.isOpen()) {
      helpLensRenderer.update({ visible: false, xrActive, camera });
      return;
    }

    const focused = findFocusedRuntimeObject(activeAimRay);
    if (helpLensFocusedObjectId) {
      if (focused?.object.id !== helpLensFocusedObjectId) {
        helpLensFocusedObjectId = undefined;
      } else {
        const definition = createHelpDefinitionForObject(focused.object, xrActive);
        helpLensRenderer.update({ visible: definition !== undefined, xrActive, camera, definition });
        return;
      }
    }

    const automaticObject = findAutomaticHelpObject();
    const definition = automaticObject ? createHelpDefinitionForObject(automaticObject, xrActive) : undefined;
    helpLensRenderer.update({
      visible: definition !== undefined,
      xrActive,
      camera,
      definition,
    });
  }

  function requestHelpLensForFocusedObject(activeAimRay: RootAimRay | undefined): void {
    const focused = findFocusedRuntimeObject(activeAimRay);
    const focusedObjectId = focused?.object.id;
    helpLensFocusedObjectId = focusedObjectId === helpLensFocusedObjectId ? undefined : focusedObjectId;
  }

  function createHelpDefinitionForObject(
    object: RuntimeWorldObject,
    xrActive: boolean,
  ): ReturnType<typeof createHelpLensDefinition> | undefined {
    const focus = getWorldFocusMessageDefinition(object);
    if (!focus) {
      return undefined;
    }

    return createHelpLensDefinition({
      focus,
      selectedTool: menuState.selectedTool,
      inputMode: xrActive ? "xr" : "desktop",
    });
  }

  function findAutomaticHelpObject(): RuntimeWorldObject | undefined {
    let best: { readonly object: RuntimeWorldObject; readonly distanceSquared: number } | undefined;
    for (const object of runtimeObjectRegistry.getObjectsInCell(playerPose.cellId)) {
      const rangeMeters = object.autoDisplayHelpRangeMeters;
      if (!object.displayHelpMessage || rangeMeters === undefined) {
        continue;
      }

      const dx = object.localPose.translation.x - playerPose.position.x;
      const dy = object.localPose.translation.y - playerPose.position.y;
      const dz = object.localPose.translation.z - playerPose.position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared > rangeMeters * rangeMeters) {
        continue;
      }

      if (!best || distanceSquared < best.distanceSquared) {
        best = { object, distanceSquared };
      }
    }

    return best?.object;
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

  function removeGeodesicRuntimeObjects(): void {
    for (const object of runtimeObjectRegistry.getAll()) {
      if (isGeodesicRuntimeRenderObject(object)) {
        runtimeObjectRegistry.remove(object.id);
      }
    }
    activeGeodesicCannonToolState = {};
    syncRuntimeObjectPortalInstances();
    syncSelectableHitboxDebug();
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
      playerCellId: playerPose.cellId,
      playerPoint: playerPose.position,
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
    activeProtractorToolState = {};
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
    for (const object of runtimeObjectRegistry.getAll()) {
      if (
        object.kind !== "protractor-angle" ||
        (object.first.geodesicId !== geodesicId && object.second.geodesicId !== geodesicId)
      ) {
        continue;
      }

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

  function getAimForwardVector(ray?: RootAimRay): { readonly x: number; readonly y: number; readonly z: number } | undefined {
    return ray ? threeDirectionToWorld(ray.direction) : undefined;
  }

  function syncDynamicObjectDebugWireframes(): void {
    const visible = hasActiveDebugOption(debugLevel, debugOptions, "object-collision-wireframes");

    for (const runtime of dynamicObjectRuntimes) {
      runtime.setCollisionWireframeVisible(visible);
    }
  }

  function syncStaticObjectCollisionWireframes(): void {
    for (const group of staticObjectCollisionWireframeGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    staticObjectCollisionWireframeGroupsByCellId.clear();

    if (!hasActiveDebugOption(debugLevel, debugOptions, "object-collision-wireframes")) {
      return;
    }

    for (const cell of activeWorld().cells) {
      const cellRoot = cellMeshes.get(cell.id);
      if (!cellRoot) {
        continue;
      }

      const group = buildStaticObjectCollisionWireframeGroup(cell.id, runtimeObjectRegistry.getObjectsInCell(cell.id));
      if (!group) {
        continue;
      }

      staticObjectCollisionWireframeGroupsByCellId.set(cell.id, group);
      cellRoot.add(group);
    }
  }

  function syncSelectableHitboxDebug(): void {
    for (const group of selectableHitboxDebugGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    selectableHitboxDebugGroupsByCellId.clear();

    for (const group of aimCollisionOutlineDebugGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    aimCollisionOutlineDebugGroupsByCellId.clear();

    const selectableHitboxesActive = hasActiveDebugOption(debugLevel, debugOptions, "selectable-hitboxes");
    const aimCollisionOutlinesActive = hasActiveDebugOption(debugLevel, debugOptions, "aim-collision-outlines");
    if (!selectableHitboxesActive && !aimCollisionOutlinesActive) {
      return;
    }

    for (const cell of activeWorld().cells) {
      const cellRoot = cellMeshes.get(cell.id);
      if (!cellRoot) {
        continue;
      }

      if (selectableHitboxesActive) {
        const group = new THREE.Group();
        group.name = `selectable-hitboxes:${cell.id}`;
        for (const object of runtimeObjectRegistry.getObjectsInCell(cell.id)) {
          const hitbox = buildSelectableHitboxDebugMesh(object);
          if (hitbox) {
            group.add(hitbox);
          }
        }

        if (group.children.length > 0) {
          cellRoot.add(group);
          selectableHitboxDebugGroupsByCellId.set(cell.id, group);
        } else {
          disposeObject3D(group);
        }
      }

      if (aimCollisionOutlinesActive) {
        const group = new THREE.Group();
        group.name = `aim-collision-outlines:${cell.id}`;
        for (const object of runtimeObjectRegistry.getObjectsInCell(cell.id)) {
          const outline = buildAimCollisionOutlineDebugMesh(object);
          if (outline) {
            group.add(outline);
          }
        }

        if (group.children.length > 0) {
          cellRoot.add(group);
          aimCollisionOutlineDebugGroupsByCellId.set(cell.id, group);
        } else {
          disposeObject3D(group);
        }
      }
    }
  }

  function buildSelectableHitboxDebugMesh(object: RuntimeWorldObject): THREE.Object3D | undefined {
    if (!object.tooltip && !object.interactable) {
      return undefined;
    }

    if (object.kind === "geodesic-segment") {
      return buildGeodesicSegmentSelectableHitboxDebugMesh(object);
    }

    const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
    return bounds ? buildCylinderSelectableHitboxDebugMesh(bounds, selectableObjectHitboxDebugColor) : undefined;
  }

  function buildAimCollisionOutlineDebugMesh(object: RuntimeWorldObject): THREE.Object3D | undefined {
    if (!object.tooltip && !object.interactable) {
      return undefined;
    }

    if (object.kind === "geodesic-segment") {
      return buildGeodesicSegmentAimCollisionOutlineDebugMesh(object);
    }

    if (object.kind === "geodesic-cannon") {
      const bounds = getGeodesicEmitterAimCylinderBounds(object);
      return bounds ? buildGeodesicEmitterAimCollisionOutlineDebugMesh(object, bounds) : undefined;
    }

    const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
    if (bounds) {
      return buildCylinderAimCollisionOutlineDebugMesh(bounds, "aim-collision-outline:cylinder");
    }

    return buildSphereAimCollisionOutlineDebugMesh(
      object.localPose.translation,
      fallbackObjectAimCollisionRadiusMeters,
      "aim-collision-outline:fallback-sphere",
    );
  }

  function dispatchRuntimeCommand(command: RuntimeCommand): void {
    commandDispatcher.dispatch(command);
  }
}

function logPortalOverlayGuide(portalPathDebugActive: boolean): void {
  const commands = [
    "window.noneuclidPortalDebug.state",
    'window.noneuclidPortalDebug.CheckCellPath("0 2 3")',
    'window.noneuclidPortalDebug.ShowCellPath("0 2 3")',
    'window.noneuclidPortalDebug.ShowCellPathClipPolygon("0 2 3")',
    'window.noneuclidPortalDebug.HideCellPathClipPolygon("0 2 3")',
    "window.noneuclidPortalDebug.HideClipPolygons()",
    "window.noneuclidPortalDebug.HideCellPaths()",
  ];

  console.info(
    portalPathDebugActive
      ? `Portal Path Overlays are enabled. Useful commands: ${commands.join("; ")}.`
      : "Portal Path Overlays are enabled, but Portal Path Debug is required before overlay commands are installed.",
  );
}

function logDebugStartupGuide(debugLevel: DebugLevelId, debugOptions: readonly DebugOptionId[]): void {
  const commands = [
    "debug_help()",
    "dump_geodesic_creatures()",
    "dump_geodesic_path()",
    "dump_locked_geodesic_words()",
    "window.noneuclidDebug.DumpGeodesicCreatures()",
    "window.noneuclidDebug.DumpGeodesicPath()",
    "window.noneuclidDebug.DumpLockedGeodesicWords()",
    "window.noneuclidPortalDebug.state",
    'window.noneuclidPortalDebug.CheckCellPath("0 2 3")',
    'window.noneuclidPortalDebug.ShowCellPath("0 2 3")',
    "window.noneuclidPortalDebug.HideCellPaths()",
    'window.noneuclidPortalDebug.ShowCellPathClipPolygon("0 2 3")',
    'window.noneuclidPortalDebug.HideCellPathClipPolygon("0 2 3")',
    "window.noneuclidPortalDebug.HideClipPolygons()",
    "window.noneuclidPortalDebug.DumpCameraPose()",
    "window.noneuclidPortalDebug.ShowCellPathRendersInstances = true",
  ];
  const activeOptions = debugOptions.length > 0 ? debugOptions.join(", ") : "(none)";

  console.info(
    [
      "Debugging quick start:",
      `debugLevel=${debugLevel}`,
      `debugOptions=${activeOptions}`,
      "Geodesic debug helpers are installed as debug_help(), dump_geodesic_creatures(), dump_geodesic_path(), and dump_locked_geodesic_words().",
      "Portal debug helpers are installed when portal-path-debug or portal-visible-path-debug is active.",
      "ShowCellPath overlays also need portal-path-overlays.",
      "Live clip polygons need portal-visible-path-debug.",
      "Useful commands:",
      ...commands.map((command) => `  ${command}`),
    ].join("\n"),
  );
}

function logPortalDebugInstall(
  candidateTables: PortalPathTablesByRootCell,
  staticCull: StaticPortalPathCullResult,
  staticCullDebugActive: boolean,
  overlayActive: boolean,
): void {
  console.info(
    [
      "Portal path debug is active.",
      `Contextual static culling is applied while expanding each path node to depth ${candidateTables.maxDepth}.`,
      "Use window.noneuclidPortalDebug.CheckCellPath(\"0 2 3\") to inspect a path.",
      overlayActive
        ? "Use window.noneuclidPortalDebug.ShowCellPath(\"0 2 3\") to draw a destination-cell overlay."
        : "Enable portal-path-overlays to allow ShowCellPath overlays.",
      "Use window.noneuclidPortalDebug.ShowCellPathClipPolygon(\"0 2 3\") to draw a live screen-space clip polygon.",
      "Use window.noneuclidPortalDebug.HideCellPathClipPolygon(\"0 2 3\") to remove one tracked clip polygon.",
      "Use window.noneuclidPortalDebug.HideClipPolygons() to clear all tracked clip polygons.",
      "Use window.noneuclidPortalDebug.DumpCameraPose() to inspect the current culling camera pose.",
      staticCullDebugActive
        ? "Static-cull rejected path details are included."
        : "Enable portal-static-cull-debug to include rejected path details.",
    ].join(" "),
  );

  console.table(
    [...candidateTables.tablesByRootCellId.entries()].map(([rootCellId, table]) => {
      const summary = staticCull.summariesByRootCellId.get(rootCellId);

      return {
        rootCellId,
        maxDepth: table.maxDepth,
        generatedPaths: summary?.inputPathCount ?? table.paths.length,
        keptPaths: summary?.keptPathCount ?? table.paths.length,
        rejectedPaths: summary?.rejectedPathCount ?? 0,
        maxAvailableDepth: Math.max(0, ...table.paths.map((path) => path.depth)),
        budgetRejected: summary?.rejectedByReason.get("static-path-budget") ?? 0,
      };
    }),
  );
}

interface PortalDebugHelpers {
  CheckCellPath(pathText: string): PortalPathCheckResultWithVisibility;
  ShowCellPath(pathText: string): {
    readonly ok: boolean;
    readonly reason?: string;
    readonly check: ReturnType<typeof checkPortalPathString>;
    readonly pathId?: number;
    readonly destinationCellId?: string;
    readonly survivedStaticCull: boolean;
    readonly currentlyVisible: boolean;
    readonly screenAreaPixels?: number;
    readonly clipRectNdc?: VisiblePortalPath["clipRectNdc"];
    readonly objectCount: number;
  };
  HideCellPaths(): void;
  ShowCellPathClipPolygon(pathText: string): {
    readonly ok: boolean;
    readonly reason?: string;
    readonly pathId?: number;
    readonly destinationCellId?: string;
    readonly trackedPathTexts: readonly string[];
    readonly currentlyVisible: boolean;
    readonly clipPolygonNdc?: readonly { readonly x: number; readonly y: number }[];
  };
  HideCellPathClipPolygon(pathText?: string): {
    readonly trackedPathTexts: readonly string[];
  };
  HideClipPolygons(): {
    readonly trackedPathTexts: readonly string[];
  };
  DumpCameraPose(): CameraPoseDebugDump;
  ShowCellPathRendersInstances: boolean;
  readonly state: ReturnType<typeof createPortalPathDebugState> & {
    readonly visiblePortalPaths?: VisiblePortalPathDebugSummary;
    readonly portalInstances: PortalInstanceRenderDebugState;
    readonly renderQuality: RenderQualityState;
    readonly ShowCellPathRendersInstances: boolean;
  };
  readonly candidateTables: PortalPathTablesByRootCell;
  readonly staticCull: StaticPortalPathCullResult;
}

interface GeneralDebugHelpers {
  debug_help(): void;
  dump_geodesic_creatures(): GeodesicCreatureDebugDump;
  DumpGeodesicCreatures(): GeodesicCreatureDebugDump;
  dump_geodesic_path(geodesicId?: string): GeodesicPathDebugDump | undefined;
  DumpGeodesicPath(geodesicId?: string): GeodesicPathDebugDump | undefined;
  dump_locked_geodesic_words(): readonly GeodesicWordDebugDump[];
  DumpLockedGeodesicWords(): readonly GeodesicWordDebugDump[];
}

interface GeneralDebugHelperCallbacks {
  readonly debugHelp: () => void;
  readonly dumpGeodesicCreatures: () => GeodesicCreatureDebugDump;
  readonly dumpGeodesicPath: (geodesicId?: string) => GeodesicPathDebugDump | undefined;
  readonly dumpLockedGeodesicWords: () => readonly GeodesicWordDebugDump[];
}

type WindowWithGeneralDebugHelpers = typeof window & {
  debug_help?: () => void;
  dump_geodesic_creatures?: () => GeodesicCreatureDebugDump;
  dump_geodesic_path?: (geodesicId?: string) => GeodesicPathDebugDump | undefined;
  dump_locked_geodesic_words?: () => readonly GeodesicWordDebugDump[];
  noneuclidDebug?: GeneralDebugHelpers;
};

interface GeometryDebugHelpers {
  SetTorusSkew(skewXMeters: number): void;
  StepTorusSkew(deltaXMeters: number): void;
  Cancel(): void;
  readonly state: LiveGeometryDebugState;
}

type WindowWithGeometryDebugHelpers = typeof window & {
  noneuclidGeometry?: GeometryDebugHelpers;
};

type PortalPathCheckResultWithVisibility = ReturnType<typeof checkPortalPathString> & VisiblePortalPathLookupResult;

interface CameraPoseDebugDump {
  readonly rootCellId: string;
  readonly playerPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly eyePosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly forward: { readonly x: number; readonly y: number; readonly z: number };
  readonly lookAtWorld: { readonly x: number; readonly y: number; readonly z: number };
  readonly yawRadians: number;
  readonly yawDegrees: number;
  readonly pitchRadians: number;
  readonly pitchDegrees: number;
  readonly threeCameraPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly threeCameraQuaternion: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly threeCameraEulerRadians: { readonly x: number; readonly y: number; readonly z: number; readonly order: string };
  readonly projection: {
    readonly type: string;
    readonly near?: number;
    readonly far?: number;
    readonly fovDegrees?: number;
    readonly aspect?: number;
    readonly zoom?: number;
  };
  readonly viewportPixels: { readonly width: number; readonly height: number };
  readonly renderQuality: RenderQualityState;
  readonly matrixWorld: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly projectionMatrix: readonly number[];
}

interface GeodesicPathDebugDump {
  readonly geodesicId: string;
  readonly locked: boolean;
  readonly connection: ReturnType<typeof getGeodesicConnection>;
  readonly startCellId?: string;
  readonly start?: string;
  readonly word: readonly GeodesicPortalTraversal[];
  readonly wordText: string;
  readonly carrySessionWord?: readonly GeodesicPortalTraversal[];
  readonly carrySessionWordText?: string;
  readonly reverseWordText: string;
  readonly latestPlayerPortalTransition?: GeodesicCarryPortalTransition;
  readonly segments: readonly {
    readonly id: string;
    readonly cellId: string;
    readonly index: number;
    readonly lengthMeters: number;
    readonly start: string;
    readonly direction: string;
    readonly terminal: string;
    readonly connectionState: string;
  }[];
}

interface GeodesicWordDebugDump {
  readonly geodesicId: string;
  readonly locked: boolean;
  readonly connection: ReturnType<typeof getGeodesicConnection>;
  readonly startCellId?: string;
  readonly start?: string;
  readonly word: readonly GeodesicPortalTraversal[];
  readonly wordText: string;
  readonly transitions: readonly {
    readonly index: number;
    readonly sourceCellId: string;
    readonly sourcePortalId: string;
    readonly targetCellId: string;
    readonly targetPortalId: string;
  }[];
}

function installPortalDebugHelpers(helpers: PortalDebugHelpers): void {
  (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug = helpers;
}

function uninstallPortalDebugHelpers(): void {
  delete (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug;
}

function installGeneralDebugHelpers(callbacks: GeneralDebugHelperCallbacks): void {
  const target = window as WindowWithGeneralDebugHelpers;
  const helpers: GeneralDebugHelpers = {
    debug_help: callbacks.debugHelp,
    dump_geodesic_creatures: callbacks.dumpGeodesicCreatures,
    DumpGeodesicCreatures: callbacks.dumpGeodesicCreatures,
    dump_geodesic_path: callbacks.dumpGeodesicPath,
    DumpGeodesicPath: callbacks.dumpGeodesicPath,
    dump_locked_geodesic_words: callbacks.dumpLockedGeodesicWords,
    DumpLockedGeodesicWords: callbacks.dumpLockedGeodesicWords,
  };

  target.debug_help = helpers.debug_help;
  target.dump_geodesic_creatures = helpers.dump_geodesic_creatures;
  target.dump_geodesic_path = helpers.dump_geodesic_path;
  target.dump_locked_geodesic_words = helpers.dump_locked_geodesic_words;
  target.noneuclidDebug = helpers;
}

function uninstallGeneralDebugHelpers(): void {
  const target = window as WindowWithGeneralDebugHelpers;

  delete target.debug_help;
  delete target.dump_geodesic_creatures;
  delete target.dump_geodesic_path;
  delete target.dump_locked_geodesic_words;
  delete target.noneuclidDebug;
}

function uninstallGeometryDebugHelpers(): void {
  delete (window as WindowWithGeometryDebugHelpers).noneuclidGeometry;
}

function liveVisibilityFields(
  pathId: number | undefined,
  latestVisibleResult: ComputeVisiblePortalPathsResult | undefined,
): {
  readonly currentlyVisible: boolean;
  readonly screenAreaPixels?: number;
  readonly clipRectNdc?: VisiblePortalPath["clipRectNdc"];
} {
  return describeVisiblePortalPath(pathId, latestVisibleResult);
}

function pathToThreeMatrix(path: PortalRenderPath): THREE.Matrix4 {
  return rigidTransformToThreeMatrix(path.rootFromDestination);
}

function dumpCameraPose(
  playerPose: PlayerPose,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  renderQualityEnabled: boolean,
): CameraPoseDebugDump {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const eyePosition = {
    x: playerPose.position.x,
    y: playerPose.position.y,
    z: playerPose.position.z + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
  };
  const forward = {
    x: -Math.sin(playerPose.yawRadians) * Math.cos(playerPose.pitchRadians),
    y: Math.cos(playerPose.yawRadians) * Math.cos(playerPose.pitchRadians),
    z: Math.sin(playerPose.pitchRadians),
  };
  const lookAtWorld = {
    x: eyePosition.x + forward.x,
    y: eyePosition.y + forward.y,
    z: eyePosition.z + forward.z,
  };
  const renderQuality = createRenderQualityState(renderer, renderer.getPixelRatio(), renderQualityEnabled);
  const dump: CameraPoseDebugDump = {
    rootCellId: playerPose.cellId,
    playerPosition: roundVec3(playerPose.position),
    eyePosition: roundVec3(eyePosition),
    forward: roundVec3(forward),
    lookAtWorld: roundVec3(lookAtWorld),
    yawRadians: roundNumber(playerPose.yawRadians),
    yawDegrees: roundNumber(THREE.MathUtils.radToDeg(playerPose.yawRadians)),
    pitchRadians: roundNumber(playerPose.pitchRadians),
    pitchDegrees: roundNumber(THREE.MathUtils.radToDeg(playerPose.pitchRadians)),
    threeCameraPosition: roundThreeVector3(camera.position),
    threeCameraQuaternion: roundQuaternion(camera.quaternion),
    threeCameraEulerRadians: {
      x: roundNumber(camera.rotation.x),
      y: roundNumber(camera.rotation.y),
      z: roundNumber(camera.rotation.z),
      order: camera.rotation.order,
    },
    projection: {
      type: camera.type,
      near: roundNumber(camera.near),
      far: roundNumber(camera.far),
      fovDegrees: roundNumber(camera.fov),
      aspect: roundNumber(camera.aspect),
      zoom: roundNumber(camera.zoom),
    },
    viewportPixels: {
      width: renderQuality.portalViewportPixels.width,
      height: renderQuality.portalViewportPixels.height,
    },
    renderQuality,
    matrixWorld: roundMatrix(camera.matrixWorld),
    matrixWorldInverse: roundMatrix(camera.matrixWorldInverse),
    projectionMatrix: roundMatrix(camera.projectionMatrix),
  };

  console.info("Current portal visibility camera pose:", dump);
  console.table({
    rootCellId: dump.rootCellId,
    playerPosition: formatVec3(dump.playerPosition),
    eyePosition: formatVec3(dump.eyePosition),
    forward: formatVec3(dump.forward),
    lookAtWorld: formatVec3(dump.lookAtWorld),
    yaw: `${dump.yawRadians} rad / ${dump.yawDegrees} deg`,
    pitch: `${dump.pitchRadians} rad / ${dump.pitchDegrees} deg`,
    threeCameraPosition: formatVec3(dump.threeCameraPosition),
    viewportPixels: `${dump.viewportPixels.width} x ${dump.viewportPixels.height}`,
    cssCanvasSize: `${dump.renderQuality.cssCanvasSize.width} x ${dump.renderQuality.cssCanvasSize.height}`,
    drawingBufferSize: `${dump.renderQuality.drawingBufferSize.width} x ${dump.renderQuality.drawingBufferSize.height}`,
    pixelRatio: dump.renderQuality.pixelRatio,
    antialiasRequested: dump.renderQuality.antialiasRequested,
    projection: `fov=${dump.projection.fovDegrees}, aspect=${dump.projection.aspect}, near=${dump.projection.near}, far=${dump.projection.far}`,
  });

  return dump;
}

function mergeStaticPathCounts(
  summary: VisiblePortalPathDebugSummary,
  staticCull: StaticPortalPathCullResult,
  rootCellId: string,
): VisiblePortalPathDebugSummary {
  const staticSummary = staticCull.summariesByRootCellId.get(rootCellId);

  return {
    ...summary,
    candidatePathCount: staticSummary?.inputPathCount ?? summary.candidatePathCount,
    keptPathCount: staticSummary?.keptPathCount ?? summary.keptPathCount,
  };
}

function visibleSummaryToRenderState(summary: VisiblePortalPathDebugSummary): VisiblePortalPathRenderState {
  return {
    candidatePathCount: summary.candidatePathCount,
    keptPathCount: summary.keptPathCount,
    visiblePathCount: summary.visiblePathCount,
    visiblePathCountByDepth: summary.visiblePathCountByDepth,
    maxVisibleDepth: summary.maxVisibleDepth,
    clippedByCameraCount: summary.clippedByCameraCount,
    clippedByAreaCount: summary.clippedByAreaCount,
    clippedByBudgetCount: summary.clippedByBudgetCount,
    budgetExhausted: summary.budgetExhausted,
  };
}

function formatInspectedPathLine(
  pathText: string | undefined,
  check: PortalPathCheckResultWithVisibility | undefined,
  latestVisibleResult: ComputeVisiblePortalPathsResult | undefined,
): string | undefined {
  if (!pathText || !check || check.matchedPathId === undefined || !check.destinationCellId) {
    return undefined;
  }

  const visibility = describeVisiblePortalPath(check.matchedPathId, latestVisibleResult);
  const visibilityLabel = visibility.currentlyVisible ? "Vis" : "Invis";

  return `Path ${pathText} -> ${check.destinationCellId} ${visibilityLabel}`;
}

function clipPolygonColorForIndex(index: number): string {
  const palette = ["#ff5252", "#3dd9b6", "#ffe066", "#5da9ff", "#ff8fab", "#b892ff"];
  return palette[index % palette.length];
}

function roundVec3(point: { readonly x: number; readonly y: number; readonly z: number }): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    z: roundNumber(point.z),
  };
}

function roundThreeVector3(point: THREE.Vector3): { readonly x: number; readonly y: number; readonly z: number } {
  return roundVec3(point);
}

function roundQuaternion(quaternion: THREE.Quaternion): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
} {
  return {
    x: roundNumber(quaternion.x),
    y: roundNumber(quaternion.y),
    z: roundNumber(quaternion.z),
    w: roundNumber(quaternion.w),
  };
}

function roundMatrix(matrix: THREE.Matrix4): readonly number[] {
  return matrix.toArray().map(roundNumber);
}

function matricesNearlyEqual(left: THREE.Matrix4, right: THREE.Matrix4, tolerance = 1e-5): boolean {
  const leftElements = left.elements;
  const rightElements = right.elements;

  for (let index = 0; index < leftElements.length; index += 1) {
    if (Math.abs(leftElements[index] - rightElements[index]) > tolerance) {
      return false;
    }
  }

  return true;
}

function roundNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatGeodesicPortalWord(word: readonly GeodesicPortalTraversal[]): string {
  return word.length === 0
    ? "(root)"
    : word
      .map((step) => `${step.sourceCellId}:${step.sourcePortalId}->${step.targetCellId}:${step.targetPortalId}`)
      .join(" ");
}

function reverseGeodesicPortalTraversal(step: GeodesicPortalTraversal): GeodesicPortalTraversal {
  return {
    sourceCellId: step.targetCellId,
    sourcePortalId: step.targetPortalId,
    targetCellId: step.sourceCellId,
    targetPortalId: step.sourcePortalId,
  };
}

function formatVec3(point: { readonly x: number; readonly y: number; readonly z: number }): string {
  return `(${point.x}, ${point.y}, ${point.z})`;
}

function createPathTraceOverlay(
  world: AppState["world"],
  path: PortalRenderPath,
): THREE.Object3D {
  const points = buildPathTracePoints(world, path);
  const group = new THREE.Group();
  group.name = `debug-cell-path-trace:${path.id}`;
  group.frustumCulled = false;

  if (points.length < 2) {
    return group;
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => worldPointToThree(point)));
  const materials = [
    new THREE.LineBasicMaterial({
      color: 0xff2b2b,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
    new THREE.LineBasicMaterial({
      color: 0xff3b3b,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
    new THREE.LineBasicMaterial({
      color: 0xff4d4d,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  ];

  for (const material of materials) {
    const line = new THREE.Line(geometry.clone(), material);
    line.frustumCulled = false;
    line.renderOrder = 1000;
    group.add(line);
  }

  return group;
}

function buildPathTracePoints(
  world: AppState["world"],
  path: PortalRenderPath,
): readonly { readonly x: number; readonly y: number; readonly z: number }[] {
  const rootCell = world.cellsById.get(path.rootCellId);

  if (!rootCell) {
    return [];
  }

  const points = [getCellTracePoint(rootCell)];
  let accumulatedTransform = identityRigidTransform3;

  for (const step of path.steps) {
    const sourceCell = world.cellsById.get(step.sourceCellId);
    const portal = sourceCell?.portalsById.get(step.sourcePortalId);
    const destinationCell = world.cellsById.get(step.targetCellId);

    if (!sourceCell || !portal || !destinationCell) {
      continue;
    }

    accumulatedTransform = composeRigidTransform3(portal.transformToTarget, accumulatedTransform);
    points.push(transformPoint3(invertRigidTransform3(accumulatedTransform), getCellTracePoint(destinationCell)));
  }

  return points;
}

function getCellTracePoint(cell: CompiledPrismCell): { readonly x: number; readonly y: number; readonly z: number } {
  let x = 0;
  let y = 0;

  for (const vertex of cell.baseVertices) {
    x += vertex.x;
    y += vertex.y;
  }

  const count = Math.max(1, cell.baseVertices.length);

  return {
    x: x / count,
    y: y / count,
    z: 0.03,
  };
}

function hideCellPathOverlays(overlays: THREE.Object3D[], scene: THREE.Scene): void {
  while (overlays.length > 0) {
    const overlay = overlays.pop()!;
    scene.remove(overlay);
    disposeObject3D(overlay);
  }
}

function triangleFanIndices(vertexCount: number): number[] {
  const indices: number[] = [];

  for (let index = 1; index < vertexCount - 1; index += 1) {
    indices.push(0, index, index + 1);
  }

  return indices;
}

function createUnderCellInfinityFloor(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(
    underCellInfinityFloorSizeMeters,
    underCellInfinityFloorSizeMeters,
  );
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "under-cell-infinity-floor";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = underCellInfinityFloorWorldZMeters;
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

function buildCylinderSelectableHitboxDebugMesh(
  bounds: SimpleCylinderBounds,
  color: number,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const material = createSelectableHitboxDebugMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "selectable-hitbox:cylinder";
  mesh.position.copy(worldPointToThree(bounds.center));
  mesh.scale.set(bounds.radius, bounds.halfHeight * 2, bounds.radius);
  mesh.renderOrder = selectableHitboxDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function buildCylinderAimCollisionOutlineDebugMesh(
  bounds: SimpleCylinderBounds,
  name: string,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const material = createAimCollisionOutlineDebugMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(worldPointToThree(bounds.center));
  mesh.scale.set(bounds.radius, bounds.halfHeight * 2, bounds.radius);
  mesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function buildSphereAimCollisionOutlineDebugMesh(
  center: { readonly x: number; readonly y: number; readonly z: number },
  radius: number,
  name: string,
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 24, 12);
  const material = createAimCollisionOutlineDebugMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(worldPointToThree(center));
  mesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function buildGeodesicEmitterAimCollisionOutlineDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  bounds: SimpleCylinderBounds,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "aim-collision-outline:geodesic-emitter";
  group.renderOrder = aimCollisionOutlineDebugRenderOrder;
  group.frustumCulled = false;
  group.add(
    buildCylinderAimCollisionOutlineDebugMesh(bounds, "aim-collision-outline:geodesic-emitter-cylinder"),
    buildSphereAimCollisionOutlineDebugMesh(
      getGeodesicEmitterAimSphereCenter(object),
      bounds.radius,
      "aim-collision-outline:geodesic-emitter-top-sphere",
    ),
  );
  return group;
}

function buildGeodesicSegmentSelectableHitboxDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "selectable-hitbox:geodesic-segment";
  group.renderOrder = selectableHitboxDebugRenderOrder;
  group.frustumCulled = false;

  const length = Math.max(0.001, object.lengthMeters);
  const segmentGeometry = new THREE.CylinderGeometry(
    geodesicSegmentAimRadiusMeters,
    geodesicSegmentAimRadiusMeters,
    length,
    20,
    1,
    true,
  );
  const material = createSelectableHitboxDebugMaterial(selectableGeodesicSegmentHitboxDebugColor);
  const segmentMesh = new THREE.Mesh(segmentGeometry, material);
  segmentMesh.name = "selectable-hitbox:geodesic-segment-body";
  segmentMesh.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length * 0.5,
    y: object.start.y + object.direction.y * length * 0.5,
    z: object.start.z + object.direction.z * length * 0.5,
  }));
  const threeDirection = worldPointToThree(object.direction).normalize();
  segmentMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), threeDirection);
  segmentMesh.renderOrder = selectableHitboxDebugRenderOrder;
  segmentMesh.frustumCulled = false;
  group.add(segmentMesh);

  const capGeometry = new THREE.SphereGeometry(geodesicSegmentAimRadiusMeters, 16, 8);
  const startCap = new THREE.Mesh(capGeometry, material.clone());
  startCap.name = "selectable-hitbox:geodesic-segment-start-cap";
  startCap.position.copy(worldPointToThree(object.start));
  startCap.renderOrder = selectableHitboxDebugRenderOrder;
  startCap.frustumCulled = false;
  group.add(startCap);

  const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
  endCap.name = "selectable-hitbox:geodesic-segment-end-cap";
  endCap.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length,
    y: object.start.y + object.direction.y * length,
    z: object.start.z + object.direction.z * length,
  }));
  endCap.renderOrder = selectableHitboxDebugRenderOrder;
  endCap.frustumCulled = false;
  group.add(endCap);

  return group;
}

function buildGeodesicSegmentAimCollisionOutlineDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "aim-collision-outline:geodesic-segment";
  group.renderOrder = aimCollisionOutlineDebugRenderOrder;
  group.frustumCulled = false;

  const length = Math.max(0.001, object.lengthMeters);
  const segmentGeometry = new THREE.CylinderGeometry(
    geodesicSegmentAimRadiusMeters,
    geodesicSegmentAimRadiusMeters,
    length,
    20,
    1,
    true,
  );
  const material = createAimCollisionOutlineDebugMaterial();
  const segmentMesh = new THREE.Mesh(segmentGeometry, material);
  segmentMesh.name = "aim-collision-outline:geodesic-segment-body";
  segmentMesh.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length * 0.5,
    y: object.start.y + object.direction.y * length * 0.5,
    z: object.start.z + object.direction.z * length * 0.5,
  }));
  const threeDirection = worldPointToThree(object.direction).normalize();
  segmentMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), threeDirection);
  segmentMesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  segmentMesh.frustumCulled = false;
  group.add(segmentMesh);

  const capGeometry = new THREE.SphereGeometry(geodesicSegmentAimRadiusMeters, 16, 8);
  const startCap = new THREE.Mesh(capGeometry, material.clone());
  startCap.name = "aim-collision-outline:geodesic-segment-start-cap";
  startCap.position.copy(worldPointToThree(object.start));
  startCap.renderOrder = aimCollisionOutlineDebugRenderOrder;
  startCap.frustumCulled = false;
  group.add(startCap);

  const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
  endCap.name = "aim-collision-outline:geodesic-segment-end-cap";
  endCap.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length,
    y: object.start.y + object.direction.y * length,
    z: object.start.z + object.direction.z * length,
  }));
  endCap.renderOrder = aimCollisionOutlineDebugRenderOrder;
  endCap.frustumCulled = false;
  group.add(endCap);

  return group;
}

function createSelectableHitboxDebugMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    opacity: selectableHitboxDebugOpacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

function createAimCollisionOutlineDebugMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: aimCollisionOutlineDebugColor,
    depthWrite: false,
    opacity: aimCollisionOutlineDebugOpacity,
    side: THREE.DoubleSide,
    transparent: true,
    wireframe: true,
  });
}

function createProtractorToolFeedback(options: {
  readonly center: ProtractorCenterSelection;
  readonly centerLocked: boolean;
  readonly first?: ProtractorDirectedGeodesic;
  readonly hover?: ProtractorDirectedGeodesic;
}): { readonly signature: string; readonly cellId: string; readonly root: THREE.Group } | undefined {
  const center = options.center;
  const point = center.point;
  const signature = [
    center.cellId,
    center.objectId,
    options.centerLocked ? "locked" : "hover",
    formatFeedbackNumber(options.first?.yawRadians),
    options.first?.geodesicId ?? "",
    formatFeedbackNumber(options.hover?.yawRadians),
    options.hover?.geodesicId ?? "",
  ].join(":");
  const root = new THREE.Group();
  root.name = "protractor-tool-feedback";

  root.add(createFeedbackCenterMarker(point, options.centerLocked));
  if (options.first) {
    root.add(createFeedbackRay(point, options.first.yawRadians, 0xffffff, 0.92, 0.52));
  }
  if (options.hover) {
    root.add(createFeedbackRay(point, options.hover.yawRadians, 0xffd166, 0.98, 0.56));
  }
  if (options.first && options.hover) {
    root.add(createFeedbackAngleSector(point, options.first.yawRadians, options.hover.yawRadians));
  }

  return {
    signature,
    cellId: center.cellId,
    root,
  };
}

function createFeedbackCenterMarker(point: Vec3, locked: boolean): THREE.Object3D {
  const group = new THREE.Group();
  group.name = locked ? "protractor-feedback-center:selected" : "protractor-feedback-center:hover";
  const color = locked ? 0xffd166 : 0x38f2ff;
  const ringGeometry = new THREE.TorusGeometry(0.16, 0.01, 8, 36);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: locked ? 0.96 : 0.7,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 70;
  ring.name = "protractor-feedback-center-ring";

  const dotGeometry = new THREE.SphereGeometry(0.035, 12, 8);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.renderOrder = 71;
  dot.name = "protractor-feedback-center-dot";

  group.position.copy(worldPointToThree(point));
  group.add(ring, dot);
  return group;
}

function createFeedbackRay(point: Vec3, yawRadians: number, color: number, opacity: number, lengthMeters: number): THREE.Mesh {
  return createFeedbackCylinderBetween(
    point,
    {
      x: point.x + Math.cos(yawRadians) * lengthMeters,
      y: point.y + Math.sin(yawRadians) * lengthMeters,
      z: point.z,
    },
    0.012,
    color,
    opacity,
    "protractor-feedback-ray",
  );
}

function createFeedbackAngleSector(point: Vec3, firstYawRadians: number, secondYawRadians: number): THREE.Object3D {
  const group = new THREE.Group();
  group.name = "protractor-feedback-angle-preview";
  const radiusMeters = 0.34;
  const angleRadians = normalizePositiveFeedbackRadians(secondYawRadians - firstYawRadians);
  const segmentCount = Math.max(8, Math.ceil(angleRadians / (Math.PI / 30)));
  const centerThree = worldPointToThree({ ...point, z: point.z + 0.004 });
  const positions: number[] = [centerThree.x, centerThree.y, centerThree.z];
  const indices: number[] = [];
  const arcPoints: Vec3[] = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const yawRadians = firstYawRadians + angleRadians * index / segmentCount;
    const arcPoint = {
      x: point.x + Math.cos(yawRadians) * radiusMeters,
      y: point.y + Math.sin(yawRadians) * radiusMeters,
      z: point.z + 0.004,
    };
    arcPoints.push(arcPoint);
    const threePoint = worldPointToThree(arcPoint);
    positions.push(threePoint.x, threePoint.y, threePoint.z);
    if (index > 0) {
      indices.push(0, index, index + 1);
    }
  }

  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  fillGeometry.setIndex(indices);
  fillGeometry.computeVertexNormals();
  const fill = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({
    color: 0x38f2ff,
    opacity: 0.24,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  fill.name = "protractor-feedback-angle-fill";
  fill.renderOrder = 68;
  group.add(fill);

  for (let index = 1; index < arcPoints.length; index += 1) {
    group.add(createFeedbackCylinderBetween(
      arcPoints[index - 1],
      arcPoints[index],
      0.007,
      0xffd166,
      0.96,
      "protractor-feedback-angle-arc",
    ));
  }

  return group;
}

function createFeedbackCylinderBetween(
  start: Vec3,
  end: Vec3,
  radiusMeters: number,
  color: number,
  opacity: number,
  name: string,
): THREE.Mesh {
  const startThree = worldPointToThree(start);
  const endThree = worldPointToThree(end);
  const delta = endThree.clone().sub(startThree);
  const length = delta.length();
  if (length <= 1e-6) {
    const geometry = new THREE.SphereGeometry(radiusMeters, 8, 6);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(startThree);
    mesh.renderOrder = 69;
    return mesh;
  }

  const geometry = new THREE.CylinderGeometry(radiusMeters, radiusMeters, length, 8);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(startThree).add(endThree).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.renderOrder = 69;
  return mesh;
}

function normalizePositiveFeedbackRadians(radians: number): number {
  const twoPi = Math.PI * 2;
  return ((radians % twoPi) + twoPi) % twoPi;
}

function formatFeedbackNumber(value: number | undefined): string {
  return value === undefined ? "" : value.toFixed(4);
}

function isGeodesicRuntimeRenderObject(
  object: RuntimeWorldObject,
): object is Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" | "geodesic-segment" | "geodesic-intersection" }> {
  return object.kind === "geodesic-cannon" ||
    object.kind === "geodesic-segment" ||
    object.kind === "geodesic-intersection";
}

function disableFrustumCulling(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.frustumCulled = false;
  });
}

function disableShadows(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function createCellWarmupViews(cell: AppState["world"]["cells"][number]) {
  const center = getCellCenter(cell);
  const eyeZ = Math.min(cell.heightMeters - 0.1, DEFAULT_PLAYER_EYE_HEIGHT_METERS);

  return [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((yawRadians) => ({
    position: {
      x: center.x,
      y: center.y,
      z: eyeZ,
    },
    yawRadians,
  }));
}

function getCellCenter(cell: AppState["world"]["cells"][number]): { readonly x: number; readonly y: number } {
  let x = 0;
  let y = 0;

  for (const vertex of cell.baseVertices) {
    x += vertex.x;
    y += vertex.y;
  }

  const count = Math.max(1, cell.baseVertices.length);
  return {
    x: x / count,
    y: y / count,
  };
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}

function smoothFramePerformance(
  previous: FramePerformanceRenderState | undefined,
  next: FramePerformanceRenderState,
): FramePerformanceRenderState {
  if (!previous) {
    return next;
  }

  return {
    totalMs: smoothNumber(previous.totalMs, next.totalMs),
    inputMs: smoothNumber(previous.inputMs, next.inputMs),
    moveMs: smoothNumber(previous.moveMs, next.moveMs),
    objectsMs: smoothNumber(previous.objectsMs, next.objectsMs),
    cameraMs: smoothNumber(previous.cameraMs, next.cameraMs),
    portalMs: smoothNumber(previous.portalMs, next.portalMs),
    uiMs: smoothNumber(previous.uiMs, next.uiMs),
    renderMs: smoothNumber(previous.renderMs, next.renderMs),
  };
}

function captureWebGlRenderInfo(renderer: THREE.WebGLRenderer): WebGlRenderInfoState {
  const viewportPixels = getPortalViewportPixels(renderer);

  return {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    lines: renderer.info.render.lines,
    points: renderer.info.render.points,
    viewportPixels,
    pixelRatio: renderer.getPixelRatio(),
  };
}

function smoothNumber(previous: number, next: number): number {
  return THREE.MathUtils.lerp(previous, next, 0.15);
}

function distanceSquared(left: Vec3, right: Vec3): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function yawFromPose(pose: { readonly rotation: { readonly m00: number; readonly m10: number } }): number {
  return Math.atan2(pose.rotation.m10, pose.rotation.m00);
}

function createInitialXrDebugState(xrSessionState: XrSessionState, playerPose: PlayerPose): XrDebugRenderState {
  return {
    secureContext: xrSessionState.secureContext,
    sessionStatus: xrSessionState.status,
    activeInputSource: "desktop",
    currentCellId: playerPose.cellId,
    playerPosition: playerPose.position,
    yawRadians: playerPose.yawRadians,
    lastMovementBlocked: false,
    sharedRenderRootCellId: undefined,
  };
}

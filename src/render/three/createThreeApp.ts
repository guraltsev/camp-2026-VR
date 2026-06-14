import * as THREE from "three";
import { reversePainterSortStable } from "@pmndrs/uikit";
import type { AppState } from "../../appState";
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
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import { distanceVec3, dotVec3, normalizeVec3, subVec3, vec3 } from "../../math/vec3";
import { movePlayer } from "../../movement/movePlayer";
import { createAppCommandDispatcher } from "../../runtime/appCommandDispatcher";
import type { RuntimeCommand } from "../../runtime/runtimeCommands";
import {
  createDebugSettingsFromRuntimeMenuState,
  closeRuntimeMenu,
  createRuntimeMenuState,
  openRuntimeMenu,
  type RuntimeDebugOverlayItemId,
  serializeRuntimeDebugOverlayItems,
  selectRuntimeMenuPlaceFlagToolType,
  setRuntimeMenuConsoleLogLevel,
  setRuntimeMenuDebugEnabled,
  setRuntimeMenuDebugOverlayEnabled,
  setRuntimeMenuCollisionGeometryWireframesEnabled,
  setRuntimeMenuSelectedWorldId,
  setRuntimeMenuPortalInspectionEnabled,
  setRuntimeMenuPortalPanelMode,
  setRuntimeMenuEditingFlagId,
  showRuntimeMenuDebugSettings,
  showRuntimeMenuMainPage,
  showRuntimeMenuPlaceFlagOptions,
  showRuntimeMenuSettings,
  setRuntimeMenuSelectedTool,
  toggleRuntimeMenuDebugOverlayItem,
} from "../../runtime/runtimeMenuState";
import { createPaletteDefinition } from "../../ui/paletteDefinition";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import { createDefaultPlayerPose, type PlayerPose } from "../../movement/playerPose";
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
  extendGeodesic,
  getGeodesicTail,
  placeGeodesicCannonAtFloorPoint,
  shootGeodesic,
} from "../../world-objects/geodesicCannon";
import {
  createRuntimeObjectRegistry,
  runtimeObjectToDynamicObjectState,
  type RuntimeWorldObject,
} from "../../world-objects/runtimeObjectRegistry";
import { getDynamicObjectCollisionBounds } from "../../movement/collision";
import { createDesktopFlagEditor } from "../dom/desktopFlagEditor";
import { createDesktopToolIndicator } from "../dom/desktopToolIndicator";
import { createFloatingObjectTooltip } from "../dom/floatingObjectTooltip";
import { createAimCrossMarker } from "./aimCrossMarker";
import { resolveAimTarget } from "./aimTarget";
import { createPlacedFlagRuntime, type PlacedFlagRuntime } from "./placedFlagRenderer";
import {
  collectGeodesicRuntimeRenderRecords,
  createGeodesicRuntimeRenderSources,
  getGeodesicFlashlightArchetypeKeys,
} from "./geodesicCannonRenderer";
import {
  buildCellRenderArchetypes,
  deriveCellRenderArchetypeCapacities,
  disposeCellRenderArchetypes,
  type CellRenderArchetype,
} from "./cellRenderArchetypes";
import { createDebugOverlay } from "./debugOverlay";
import { createDesktopControls } from "./desktopControls";
import { createDesktopScenePaletteInput, reduceDesktopScenePaletteToggle } from "./desktopScenePaletteInput";
import { resolveDesktopScenePalettePlacement } from "./desktopScenePalettePlacement";
import { createScenePaletteController } from "./scenePaletteController";
import { buildForbiddenZoneWireframe } from "./debugCollisionWireframes";
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
import { installRuntimeDiagnostics, runtimeDiagnostics } from "./runtimeDiagnostics";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
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
import { rigidTransformToThreeMatrix, worldPointToThree } from "./worldAxes";
import { createXrControls } from "./xrControls";
import { createXrEntryUi } from "./xrEntryUi";
import { resolveXrPortalEyeRenderRoot, type XrPortalEyeRenderRoot } from "./xrPortalEye";
import { createXrPlayerRig, headLocalMetersFromViewerPose, headYawRadiansFromViewerPose } from "./xrPlayerRig";
import { resolveVrPalettePlacement } from "./vrPalettePlacement";
import { createXrScenePaletteInput } from "./xrScenePaletteInput";
import {
  createXrSessionState,
  detectXrSessionState,
  transitionXrSessionState,
  type XrSessionState,
} from "./xrSessionState";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  invertRigidTransform3,
  transformPoint3,
} from "../../math/rigidTransform3";

export interface ThreeApp {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  updateDebugSettings(settings: DebugSettings): void;
  dispose(): void;
}

export interface ThreeAppOptions {
  readonly selectedWorldId: string;
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly renderQualityEnabled: boolean;
  readonly assets: PreparedWorldAssets;
}

interface PortalEyeRenderState {
  readonly camera: THREE.Camera;
  readonly result: ComputeVisiblePortalPathsResult;
  readonly eyeIndex: number;
  readonly rootCellId: string;
}

const renderCameraNearMeters = 0.001;
const renderCameraFarMeters = 250;
const underCellInfinityFloorSizeMeters = 1_000;
const underCellInfinityFloorWorldZMeters = -1;

export function createThreeApp(container: HTMLElement, appState: AppState, options: ThreeAppOptions): ThreeApp {
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
  const xrControls = createXrControls();
  const xrRig = createXrPlayerRig(camera);
  scene.add(xrRig.root);
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
  });
  let previousDesktopPalettePlacement: ReturnType<typeof resolveDesktopScenePalettePlacement> | undefined;
  let previousXrPalettePosition: THREE.Vector3 | undefined;
  let previousXrPaletteQuaternion: THREE.Quaternion | undefined;
  const debugOverlay = createDebugOverlay(container);
  const commandDispatcher = createAppCommandDispatcher({
    get currentUrl() {
      return window.location.href;
    },
    reloadWorld() {
      window.location.reload();
    },
    navigateToUrl(url) {
      window.location.assign(url);
    },
    setDebugOverlayEnabled(enabled) {
      applyMenuDebugState(setRuntimeMenuDebugOverlayEnabled(menuState, enabled));
    },
  });
  const desktopToolIndicator = createDesktopToolIndicator(document.body);
  const desktopScenePaletteInput = createDesktopScenePaletteInput();
  const xrScenePaletteInput = createXrScenePaletteInput();
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
  const floatingObjectTooltip = createFloatingObjectTooltip(document.body);
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
      menuState = closeRuntimeMenu(menuState);
      syncDesktopPalette();
    },
    onShowSettingsRequested() {
      menuState = showRuntimeMenuSettings(menuState);
      syncDesktopPalette();
    },
    onShowMainRequested() {
      menuState = menuState.page === "debug-settings"
        ? showRuntimeMenuSettings(menuState)
        : showRuntimeMenuMainPage(menuState);
      syncDesktopPalette();
    },
    onWorldSelected(worldId) {
      menuState = setRuntimeMenuSelectedWorldId(menuState, worldId);
      syncDesktopPalette();
      dispatchRuntimeCommand({ kind: "change-world", worldId });
    },
    onReloadRequested() {
      dispatchRuntimeCommand({ kind: "reload-world" });
    },
    onDebugEnabledChanged(enabled) {
      applyMenuDebugState(setRuntimeMenuDebugEnabled(menuState, enabled));
    },
    onDebugSettingsRequested() {
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
    onPortalPanelModeSelected(mode) {
      applyMenuDebugState(setRuntimeMenuPortalPanelMode(menuState, mode));
    },
    onPortalInspectionToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuPortalInspectionEnabled(menuState, enabled));
    },
    onCollisionGeometryWireframesToggled(enabled) {
      applyMenuDebugState(setRuntimeMenuCollisionGeometryWireframesEnabled(menuState, enabled));
    },
    onToolSelected(toolId) {
      menuState = closeRuntimeMenu(setRuntimeMenuSelectedTool(menuState, toolId));
      syncDesktopPalette();
    },
    onPlaceFlagOptionsRequested() {
      menuState = showRuntimeMenuPlaceFlagOptions(menuState);
      syncDesktopPalette();
    },
    onPlaceFlagTypeSelected(flagType) {
      menuState = closeRuntimeMenu(selectRuntimeMenuPlaceFlagToolType(menuState, flagType));
      syncDesktopPalette();
    },
  });

  const cellMeshes = new Map<string, THREE.Object3D>();
  const rootRenderPathMaxDepth = 10;
  const maxVisiblePaths = 2_000;
  const portalStaticCull = buildStaticallyCulledPortalPathTables(appState.world, {
    maxDepth: rootRenderPathMaxDepth,
    skipImmediateReverse: true,
    toleranceMeters: 1e-6,
    maxKeptPathsPerRoot: 50_000,
  });
  const archetypeCapacitiesByCellId = deriveCellRenderArchetypeCapacities(
    appState.world,
    portalStaticCull,
    maxVisiblePaths,
  );
  const warmupViewsByCellId = new Map(
    appState.world.cells.map((cell) => [cell.id, createCellWarmupViews(cell)] as const),
  );
  const dynamicObjectRuntimes: Array<GeodesciMarmotRuntime | SimpleGeoCreatureRuntime> = [];
  const placedFlagRuntimes = new Map<string, PlacedFlagRuntime>();
  let placedFlagIdCounter = 0;
  let geodesicCannonIdCounter = 0;
  let geodesicIdCounter = 0;
  let activeGeodesicCannonToolState: {
    readonly selectedCannonId?: string;
    readonly activeGeodesicId?: string;
  } = {};
  const runtimeObjectRenderRoot = new THREE.Group();
  runtimeObjectRenderRoot.name = "runtime-object-archetype-renders";
  scene.add(runtimeObjectRenderRoot);
  const runtimeObjectRootsById = new Map<string, THREE.Object3D>();
  const runtimeObjectRenderSourcesByKey = new Map<string, RuntimeObjectRenderSourceMesh>();
  const runtimeObjectRenderArchetypesByKey = new Map<string, RuntimeObjectRenderArchetype>();
  const geodesicRuntimeRenderSources = createGeodesicRuntimeRenderSources(options.assets);
  const geodesicFlashlightArchetypeKeys = getGeodesicFlashlightArchetypeKeys(geodesicRuntimeRenderSources);
  const runtimeObjectRenderDiagnostics = createRuntimeObjectRenderArchetypeDiagnostics();
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
  syncDesktopPalette();

  for (const cell of appState.world.cells) {
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
      }
    }
  }
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
    warmupViewsByCellId,
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
    const frameAfterInputMs = performance.now();
    const frameBeforeMoveMs = frameAfterInputMs;
    const previousCellId = playerPose.cellId;
    let moveResult: ReturnType<typeof movePlayer> | undefined;

    if (frame.resetRequested) {
      playerPose = createDefaultPlayerPose(appState.playerPose.cellId);
      xrRig.reset();
      for (const runtime of dynamicObjectRuntimes) {
        runtime.reset(cellMeshes);
      }
      removePlacedFlags();
      removeGeodesicRuntimeObjects();
    } else {
      const yawDeltaRadians = xrActive
        ? xrRig.resolveCameraYawRadians(headLocalYawRadians) - playerPose.yawRadians + frame.yawDeltaRadians
        : frame.yawDeltaRadians;
      moveResult = movePlayer({
        world: appState.world,
        pose: playerPose,
        body: appState.playerBody,
        localDisplacement: frame.localDisplacement,
        yawDeltaRadians,
        pitchDeltaRadians: frame.pitchDeltaRadians,
        coordinateFrame: "global",
      });
      playerPose = moveResult.pose;
      recordCellTransition(previousCellId, moveResult);

      if (xrActive) {
        const beforePhysicalCellId = playerPose.cellId;
        const physicalFrame = xrRig.consumePhysicalInput(headLocalMeters, playerPose.yawRadians);
        const physicalMoveResult = movePlayer({
          world: appState.world,
          pose: playerPose,
          body: appState.playerBody,
          localDisplacement: physicalFrame.localDisplacement,
          yawDeltaRadians: 0,
          pitchDeltaRadians: 0,
          coordinateFrame: "global",
        });
        playerPose = physicalMoveResult.pose;
        xrRig.acceptPhysicalMove(physicalMoveResult, headLocalMeters);
        moveResult = physicalMoveResult.blocked || physicalMoveResult.crossedPortal ? physicalMoveResult : moveResult;
        recordCellTransition(beforePhysicalCellId, physicalMoveResult);
      }
    }

    if (!xrActive && frame.primaryActionRequested && menuState.selectedTool === "place-flag") {
      tryPlaceFlagFromDesktopAim();
    }
    if (!xrActive && frame.primaryActionRequested && menuState.selectedTool === "geodesic-cannon") {
      tryUseGeodesicCannonToolFromDesktopAim();
    }

    if (!xrActive && frame.interactRequested) {
      tryOpenFocusedFlagEditor();
    }
    const frameAfterMoveMs = performance.now();
    const frameBeforeObjectsMs = frameAfterMoveMs;

    for (const runtime of dynamicObjectRuntimes) {
      runtime.update(appState.world, frame.resetRequested ? 0 : deltaSeconds);
      runtime.syncParent(cellMeshes);
    }
    for (const runtime of placedFlagRuntimes.values()) {
      runtime.syncParent(cellMeshes);
    }
    const frameAfterObjectsMs = performance.now();
    const frameBeforeCameraMs = frameAfterObjectsMs;

    updateVisibleCell();
    let portalCullingCameras: readonly THREE.Camera[] = [camera];
    if (xrActive) {
      xrRig.syncXrRig(playerPose, headLocalMeters, headLocalYawRadians);
      portalCullingCamera.copy(camera, false);
      xrRig.syncXrCullingCamera(portalCullingCamera, xrViewerPose);
      const xrEyeCameras = xrRig.syncXrViewCullingCameras(portalCullingEyeCameras, xrViewerPose);
      portalCullingCameras = xrEyeCameras.length > 0 ? xrEyeCameras : [portalCullingCamera];
      updateStylizedSceneLighting(sceneLighting, camera);
    } else {
      applyDesktopCameraPose();
    }
    updateFloatingObjectTooltip(xrActive);
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

    updateAimCrossMarker(xrActive);
    syncXrDebugState(frame.source, moveResult);
    updateScenePalette(xrActive, xrFrame, xrReferenceSpace, deltaSeconds, frame);
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

  function applyMenuDebugState(nextMenuState: typeof menuState): void {
    menuState = nextMenuState;
    syncDebugSettingsUrl();
    applyDebugSettings(createDebugSettingsFromRuntimeMenuState(menuState));
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
      appState.world,
      settings.debugLevel,
      hasActiveDebugOption(settings.debugLevel, settings.debugOptions, "runtime-diagnostics"),
    );
    rebuildCellMeshes();
    syncPortalInstanceRender();
    portalDebugRuntime.dispose();
    portalDebugRuntime = createPortalDebugRuntime();
    logDebugStartupGuide(debugLevel, debugOptions);
    for (const runtime of dynamicObjectRuntimes) {
      runtime.syncParent(cellMeshes);
    }
    syncDynamicObjectDebugWireframes();
    syncRuntimeObjectPortalInstances();
    applyDesktopCameraPose();
    renderer.render(scene, camera);
  }

  function syncDebugSettingsUrl(): void {
    const settings = createDebugSettingsFromRuntimeMenuState(menuState);
    const url = new URL(window.location.href);
    const serializedDebugOptions = settings.debugOptions.join(",");
    const serializedOverlayItems = serializeRuntimeDebugOverlayItems(menuState.debugOverlayItems);

    if (settings.debugLevel === "off") {
      url.searchParams.delete("debugLevel");
    } else {
      url.searchParams.set("debugLevel", settings.debugLevel);
    }

    if (settings.portalPanelMode === "none") {
      url.searchParams.delete("portalPanels");
    } else {
      url.searchParams.set("portalPanels", settings.portalPanelMode);
    }

    if (serializedDebugOptions) {
      url.searchParams.set("debugOptions", serializedDebugOptions);
    } else {
      url.searchParams.delete("debugOptions");
    }

    if (menuState.debugOverlayEnabled) {
      url.searchParams.delete("debugOverlay");
    } else {
      url.searchParams.set("debugOverlay", "false");
    }

    if (serializedOverlayItems === "fps,location,portal-quantities") {
      url.searchParams.delete("debugOverlayItems");
    } else {
      url.searchParams.set("debugOverlayItems", serializedOverlayItems);
    }

    url.searchParams.delete("debug");
    url.searchParams.delete("ui");
    url.searchParams.delete("worldPicker");
    window.history.replaceState({}, "", url);
  }

  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("contextmenu", onDesktopContextMenu);
  window.addEventListener("mousedown", onDesktopMouseDown);
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
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("contextmenu", onDesktopContextMenu);
      window.removeEventListener("mousedown", onDesktopMouseDown);
      window.removeEventListener("keydown", onDesktopPaletteKeyDown);
      scenePaletteController.dispose();
      desktopScenePaletteInput.dispose();
      desktopToolIndicator.dispose();
      desktopFlagEditor.dispose();
      aimCrossMarker.dispose();
      floatingObjectTooltip.dispose();
      controls.dispose();
      for (const runtime of placedFlagRuntimes.values()) {
        runtime.dispose();
      }
      placedFlagRuntimes.clear();
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
      debugOverlay.dispose();
      xrEntryUi.dispose();
      clipPolygonOverlay.dispose();
      disposeStylizedSceneLighting(sceneLighting, scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

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
        optionalFeatures: ["local-floor", "bounded-floor"],
      });
      session.addEventListener("end", () => {
        xrSessionState = transitionXrSessionState(xrSessionState, "ended");
        xrRig.reset();
        xrScenePaletteInput.reset();
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
    deltaSeconds: number,
    frame: RuntimeInputFrame,
  ): void {
    if (xrActive && xrFrame && xrReferenceSpace) {
      camera.updateMatrixWorld(true);
      const headPosition = new THREE.Vector3();
      const headQuaternion = new THREE.Quaternion();
      const headScale = new THREE.Vector3();
      camera.matrixWorld.decompose(headPosition, headQuaternion, headScale);
      const placement = resolveVrPalettePlacement({
        head: {
          position: headPosition,
          quaternion: headQuaternion,
        },
        previousPosition: previousXrPalettePosition,
        previousQuaternion: previousXrPaletteQuaternion,
        smoothing: 0.22,
        freeze: frame.paletteSelectPressed === true,
      });
      previousXrPalettePosition = placement.position.clone();
      previousXrPaletteQuaternion = placement.quaternion.clone();
      scenePaletteController.update({
        input: xrScenePaletteInput.update({
          deltaSeconds,
          xrFrame,
          referenceSpace: xrReferenceSpace,
          referenceSpaceToWorldMatrix: xrRig.root.matrixWorld,
          inputSources: [...(renderer.xr.getSession()?.inputSources ?? [])],
        }),
        definition: createPaletteDefinition(menuState),
        placement,
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
      definition: createPaletteDefinition(menuState),
      placement,
    });
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
    applyDesktopScenePaletteToggle(reduceDesktopScenePaletteToggle(menuState.isOpen, "secondary-click"));
  }

  function onDesktopPaletteKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Escape" || renderer.xr.isPresenting) {
      return;
    }

    const action = reduceDesktopScenePaletteToggle(menuState.isOpen, "escape-key");
    if (action !== "none") {
      event.preventDefault();
      applyDesktopScenePaletteToggle(action);
    }
  }

  function applyDesktopScenePaletteToggle(action: "open" | "close" | "none"): void {
    if (action === "open" && !menuState.isOpen) {
      menuState = openRuntimeMenu(menuState);
      syncDesktopPalette();
    } else if (action === "close" && menuState.isOpen) {
      menuState = closeRuntimeMenu(menuState);
      syncDesktopPalette();
    }
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
        source: "xr",
      };
    }

    return {
      ...xrControls.consumeFrame(session.inputSources, deltaSeconds),
      primaryActionRequested: false,
      interactRequested: false,
    };
  }

  function recordCellTransition(previousCellId: string, moveResult: ReturnType<typeof movePlayer>): void {
    if (playerPose.cellId !== previousCellId) {
      if (moveResult.crossedPortal) {
        runtimeDiagnostics().recordCellEntered(
          previousCellId,
          playerPose.cellId,
          moveResult.crossedPortalId ?? "unknown-portal",
        );
      }
      portalDebugRuntime.syncRootCell();
    }
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

    for (const cell of appState.world.cells) {
      const cellMesh = new THREE.Group();
      cellMesh.name = `cell-root:${cell.id}`;
      cellMesh.visible = cell.id === currentlyVisibleCellId;
      if (showForbiddenZoneWireframes) {
        cellMesh.add(buildCurrentCellForbiddenZoneWireframes(cell));
      }
      cellMeshes.set(cell.id, cellMesh);
      scene.add(cellMesh);
    }

    cellRenderArchetypes = buildCellRenderArchetypes(appState.world, {
      debugLevel,
      portalPanelMode,
      eyeHeightMeters: DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      assets: options.assets,
      capacitiesByCellId: archetypeCapacitiesByCellId,
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
      world: appState.world,
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
    const table = portalStaticCull.tables.tablesByRootCellId.get(renderRoot.rootCellId);

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
      world: appState.world,
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
    const summary = mergeStaticPathCounts(renderedComputed.summary, portalStaticCull, renderRoot.rootCellId);
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
      portalStaticCull.tables.tablesByRootCellId.has(renderRoot.rootCellId)
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
          world: appState.world,
          rootCellId: sharedRootCellId,
          pathTable: portalStaticCull.tables.tablesByRootCellId.get(sharedRootCellId)!,
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
              summary: mergeStaticPathCounts(renderedComputed.summary, portalStaticCull, renderRoot.rootCellId),
            },
          };
        })
      : renderRoots.map((renderRoot, eyeIndex) => {
        const table = portalStaticCull.tables.tablesByRootCellId.get(renderRoot.rootCellId)!;
        const computed = computeVisiblePortalPaths({
        world: appState.world,
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
          summary: mergeStaticPathCounts(renderedComputed.summary, portalStaticCull, renderRoot.rootCellId),
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
      portalStaticCull.tables.tablesByRootCellId.get(rootCellId)?.pathsByDestinationCellId ?? new Map(),
      visiblePathById,
    );
    updatePortalVisiblePathInstances(visiblePathsByDestinationCell);
    syncRuntimeObjectPortalInstances(visiblePaths);
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
      portalStaticCull.tables.tablesByRootCellId.get(rootCellId)?.pathsByDestinationCellId ?? new Map(),
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
  }

  function syncRuntimeObjectRenderSources(): void {
    const activeKeys = new Set<string>();
    const hasGeodesicRuntimeObjects = runtimeObjectRegistry.getAll().some(
      (object) => object.portalRenderable && (object.kind === "geodesic-cannon" || object.kind === "geodesic-segment"),
    );

    if (hasGeodesicRuntimeObjects) {
      for (const source of geodesicRuntimeRenderSources) {
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

      if (object.kind === "geodesic-cannon" || object.kind === "geodesic-segment") {
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
    return runtimeObjectRegistry.getAll().flatMap((object) => {
      if (object.portalRenderable && (object.kind === "geodesic-cannon" || object.kind === "geodesic-segment")) {
        return collectGeodesicRuntimeRenderRecords(object, geodesicFlashlightArchetypeKeys);
      }

      if (!object.portalRenderable || !runtimeObjectRootsById.has(object.id)) {
        return [];
      }

      const localMatrix = rigidTransformToThreeMatrix(object.localPose);
      const prefix = runtimeObjectArchetypeKeyPrefix(object);
      return [...runtimeObjectRenderSourcesByKey.keys()]
        .filter((key) => key.startsWith(`${prefix}:mesh:`))
        .map((archetypeKey) => ({
          objectId: object.id,
          cellId: object.cellId,
          archetypeKey,
          localMatrix,
        }));
    });
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
      return latestVisibleResult?.paths ?? [];
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
      ? buildStaticallyCulledPortalPathTables(appState.world, {
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
      : portalStaticCull;
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
        world: appState.world,
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
        const destinationCell = check.destinationCellId ? appState.world.cellsById.get(check.destinationCellId) : undefined;

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

        activePathTraceOverlay = createPathTraceOverlay(appState.world, path);
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

  function syncDesktopPalette(): void {
    controls.setLookMode(menuState.isOpen ? "palette" : "camera");
    desktopToolIndicator.setTool(menuState.selectedTool, menuState.placeFlagOptions.flagType);
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

  function tryPlaceFlagFromDesktopAim(): void {
    const target = resolveCurrentAimTarget();
    if (target?.kind !== "floor") {
      return;
    }

    const result = placeFlagAtFloorPoint({
      world: appState.world,
      registry: runtimeObjectRegistry,
      cellId: target.cellId,
      eyePosition: target.localEyePosition,
      floorPoint: target.localPoint,
      flagType: menuState.placeFlagOptions.flagType,
      id: `placed-flag:${Date.now()}:${placedFlagIdCounter++}`,
    });

    if (result.placed && result.object) {
      syncPlacedFlagRuntime(result.object);
    }
  }

  function tryUseGeodesicCannonToolFromDesktopAim(): void {
    const activeGeodesicId = activeGeodesicCannonToolState.activeGeodesicId;
    if (activeGeodesicId) {
      const tail = getGeodesicTail(runtimeObjectRegistry, activeGeodesicId);
      if (tail) {
        const segment = extendGeodesic({
          world: appState.world,
          registry: runtimeObjectRegistry,
          geodesicId: activeGeodesicId,
        });
        if (segment) {
          syncRuntimeObjectPortalInstances();
        }
        return;
      }
    }

    const target = resolveCurrentAimTarget();
    if (target?.kind !== "floor") {
      return;
    }

    const forward = getCameraForwardVector();
    let horizontalForward: { readonly x: number; readonly y: number; readonly z: number };
    try {
      horizontalForward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
    } catch {
      return;
    }
    const aimYawRadians = Math.atan2(horizontalForward.y, horizontalForward.x);
    const result = placeGeodesicCannonAtFloorPoint({
      world: appState.world,
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
      world: appState.world,
      registry: runtimeObjectRegistry,
      cannon: result.object,
      geodesicId,
    });
    activeGeodesicCannonToolState = {
      selectedCannonId: result.object.id,
      activeGeodesicId: geodesicId,
    };
    syncRuntimeObjectPortalInstances();
  }

  function tryOpenFocusedFlagEditor(): void {
    const focused = findFocusedRuntimeObject();
    if (!focused || focused.object.kind !== "placed-flag" || focused.object.interactable?.action !== "edit-flag") {
      return;
    }

    controls.pause();
    menuState = setRuntimeMenuEditingFlagId(menuState, focused.object.id);
    syncDesktopPalette();
    desktopFlagEditor.open(focused.object);
  }

  function updateFloatingObjectTooltip(xrActive: boolean): void {
    if (menuState.isOpen || desktopFlagEditor.isOpen()) {
      floatingObjectTooltip.update({ visible: false });
      return;
    }

    const focused = findFocusedRuntimeObject();
    const text = focused ? getRuntimeObjectTooltipText(focused.object, xrActive ? "xr" : "desktop") : undefined;
    const screenPosition = focused ? projectWorldPointToScreen(focused.tooltipAnchor) : undefined;

    floatingObjectTooltip.update({
      visible: Boolean(text && screenPosition),
      text,
      xPixels: screenPosition?.x,
      yPixels: screenPosition?.y,
    });
  }

  function updateAimCrossMarker(xrActive: boolean): void {
    if (
      xrActive ||
      (menuState.selectedTool !== "aim" && menuState.selectedTool !== "place-flag" && menuState.selectedTool !== "geodesic-cannon") ||
      menuState.isOpen ||
      desktopFlagEditor.isOpen()
    ) {
      aimCrossMarker.update(undefined);
      return;
    }

    aimCrossMarker.update(resolveCurrentAimTarget());
  }

  function resolveCurrentAimTarget() {
    return resolveAimTarget({
      world: appState.world,
      registry: runtimeObjectRegistry,
      camera,
      visiblePortalPaths: latestVisibleResult?.paths ?? [],
    });
  }

  function findFocusedRuntimeObject(): {
    readonly object: RuntimeWorldObject;
    readonly distance: number;
    readonly tooltipAnchor: { readonly x: number; readonly y: number; readonly z: number };
  } | undefined {
    const eye = getCameraWorldPosition();
    const forward = getCameraForwardVector();
    let best:
      | {
        readonly object: RuntimeWorldObject;
        readonly distance: number;
        readonly tooltipAnchor: { readonly x: number; readonly y: number; readonly z: number };
      }
      | undefined;

    for (const object of runtimeObjectRegistry.getTooltipObjectsInCell(playerPose.cellId)) {
      if (!object.tooltip && !object.interactable) {
        continue;
      }

      const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
      const target = bounds?.center ?? object.localPose.translation;
      const distance = distanceVec3(eye, target);
      const range = object.tooltip?.rangeMeters ?? object.interactable?.rangeMeters ?? 2.25;
      if (distance > range || distance <= 0.001) {
        continue;
      }

      const alignment = dotVec3(normalizeVec3(subVec3(target, eye)), forward);
      if (alignment < Math.cos(Math.PI / 7)) {
        continue;
      }

      if (!best || distance < best.distance) {
        best = {
          object,
          distance,
          tooltipAnchor: {
            x: target.x,
            y: target.y,
            z: target.z + (bounds?.halfHeight ?? 0.35) + 0.25,
          },
        };
      }
    }

    return best;
  }

  function getRuntimeObjectTooltipText(object: RuntimeWorldObject, inputMode: "desktop" | "xr"): string | undefined {
    if (inputMode === "desktop" && object.tooltip?.desktopPrompt) {
      return object.tooltip.desktopPrompt;
    }

    if (inputMode === "xr" && object.tooltip?.xrPrompt) {
      return object.tooltip.xrPrompt;
    }

    return object.tooltip?.label ?? object.interactable?.label;
  }

  function projectWorldPointToScreen(point: { readonly x: number; readonly y: number; readonly z: number }):
    | { readonly x: number; readonly y: number }
    | undefined {
    const projected = worldPointToThree(point).project(camera);
    if (
      !Number.isFinite(projected.x) ||
      !Number.isFinite(projected.y) ||
      !Number.isFinite(projected.z) ||
      projected.z < -1 ||
      projected.z > 1
    ) {
      return undefined;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
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
      if (object.kind === "geodesic-cannon" || object.kind === "geodesic-segment") {
        runtimeObjectRegistry.remove(object.id);
      }
    }
    activeGeodesicCannonToolState = {};
    syncRuntimeObjectPortalInstances();
  }

  function getCameraWorldPosition(): { readonly x: number; readonly y: number; readonly z: number } {
    camera.updateMatrixWorld(true);
    const position = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    return {
      x: position.x,
      y: -position.z,
      z: position.y,
    };
  }

  function getCameraForwardVector(): { readonly x: number; readonly y: number; readonly z: number } {
    const forward = new THREE.Vector3(0, 0, -1);
    const quaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(quaternion);
    forward.applyQuaternion(quaternion);
    return {
      x: forward.x,
      y: -forward.z,
      z: forward.y,
    };
  }

  function syncDynamicObjectDebugWireframes(): void {
    const visible = hasActiveDebugOption(debugLevel, debugOptions, "object-collision-wireframes");

    for (const runtime of dynamicObjectRuntimes) {
      runtime.setCollisionWireframeVisible(visible);
    }
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

function installPortalDebugHelpers(helpers: PortalDebugHelpers): void {
  (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug = helpers;
}

function uninstallPortalDebugHelpers(): void {
  delete (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug;
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

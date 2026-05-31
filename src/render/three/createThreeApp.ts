import * as THREE from "three";
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
import { vec3 } from "../../math/vec3";
import { movePlayer } from "../../movement/movePlayer";
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
  buildCellRenderArchetypes,
  deriveCellRenderArchetypeCapacities,
  disposeCellRenderArchetypes,
  type CellRenderArchetype,
} from "./cellRenderArchetypes";
import { createDebugOverlay } from "./debugOverlay";
import { createDesktopControls } from "./desktopControls";
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
  updateCellRenderArchetypeInstances,
  type PortalInstanceRenderDebugState,
} from "./renderPortalInstances";
import {
  createRenderQualityState,
  getPortalViewportPixels,
  getRendererCssCanvasSize,
  getWindowCssCanvasSize,
  renderAntialiasRequested,
  resolveRenderQualityPixelRatio,
  type RenderQualityState,
} from "./renderQuality";
import { runtimeDiagnostics } from "./runtimeDiagnostics";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import type { RuntimeInputFrame, VisiblePortalPathRenderState, XrDebugRenderState } from "./renderState";
import { createPortalClipData } from "./portalClipData";
import {
  createPortalClipMaterialState,
  patchPortalClipMaterial,
  updatePortalClipMaterialViewport,
  updatePortalClipMaterialViewportFromRenderer,
  type PortalClipMaterialState,
} from "./portalClipMaterial";
import {
  createStylizedSceneLighting,
  disposeStylizedSceneLighting,
  updateStylizedSceneLighting,
} from "./sceneLighting";
import {
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
import { createXrPlayerRig, headLocalMetersFromViewerPose } from "./xrPlayerRig";
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
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
  readonly renderQualityEnabled: boolean;
  readonly assets: PreparedWorldAssets;
}

interface LegacyObjectPortalRenderEntry {
  readonly root: THREE.Group;
  readonly destinationCellId: string;
  readonly sourceChildren: readonly THREE.Object3D[];
  readonly cloneChildren: readonly THREE.Object3D[];
}

export function createThreeApp(container: HTMLElement, appState: AppState, options: ThreeAppOptions): ThreeApp {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
  scene.environment = null;
  scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, 12, 85);

  const initialCanvasSize = getWindowCssCanvasSize(window);
  const camera = new THREE.PerspectiveCamera(
    70,
    initialCanvasSize.width / initialCanvasSize.height,
    0.01,
    250,
  );
  const portalCullingCamera = camera.clone();

  const pixelRatio = resolveRenderQualityPixelRatio(options.renderQualityEnabled, window.devicePixelRatio);
  const renderer = new THREE.WebGLRenderer({ antialias: renderAntialiasRequested });
  renderer.shadowMap.enabled = false;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
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
  let showCellPathRendersInstances = hasActiveDebugOption(
    debugLevel,
    debugOptions,
    "portal-path-overlay-instances",
  );
  const debugOverlay = createDebugOverlay(container);
  const xrEntryUi = createXrEntryUi(container, enterVr);
  const clipPolygonOverlay = createPortalClipPolygonOverlay(container);
  const sceneLighting = createStylizedSceneLighting(scene);

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
  const legacyObjectPortalRenderRoot = new THREE.Group();
  legacyObjectPortalRenderRoot.name = "legacy-object-portal-renders";
  scene.add(legacyObjectPortalRenderRoot);
  const legacyObjectPortalRenderEntries = new Map<number, LegacyObjectPortalRenderEntry>();
  const portalInstanceDiagnostics = createPortalInstanceDiagnostics();
  const portalClipData = createPortalClipData({ maxVisiblePaths });
  const portalClipMaterialState = createPortalClipMaterialState(
    portalClipData,
    getPortalViewportPixels(renderer),
    { smoothClipEdges: options.renderQualityEnabled },
  );
  let latestVisibleResult: ComputeVisiblePortalPathsResult | undefined;
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

  for (const cell of appState.world.cells) {
    for (const objectSpec of cell.objects) {
      if (isGeodesciMarmotObjectSpec(objectSpec)) {
        const runtime = createGeodesciMarmotRuntime(objectSpec, cell.id, options.assets);
        runtime.syncParent(cellMeshes);
        dynamicObjectRuntimes.push(runtime);
        continue;
      }

      if (isSimpleGeoCreatureObjectSpec(objectSpec)) {
        const runtime = createSimpleGeoCreatureRuntime(objectSpec, cell.id, options.assets);
        runtime.syncParent(cellMeshes);
        dynamicObjectRuntimes.push(runtime);
      }
    }
  }
  syncLegacyObjectPortalRenders();
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
    const xrActive = renderer.xr.isPresenting && xrSessionState.status === "active";
    const xrReferenceSpace = xrActive ? renderer.xr.getReferenceSpace() : null;
    const xrViewerPose = xrActive && xrFrame && xrReferenceSpace
      ? xrFrame.getViewerPose(xrReferenceSpace)
      : undefined;
    const headLocalMeters = xrActive
      ? headLocalMetersFromViewerPose(xrViewerPose)
      : undefined;
    const frame = xrActive ? getXrInputFrame(deltaSeconds) : getDesktopInputFrame(deltaSeconds);
    const frameBeforeMoveMs = performance.now();
    const previousCellId = playerPose.cellId;
    let moveResult: ReturnType<typeof movePlayer> | undefined;

    if (frame.resetRequested) {
      playerPose = createDefaultPlayerPose(appState.playerPose.cellId);
      xrRig.reset();
      for (const runtime of dynamicObjectRuntimes) {
        runtime.reset(cellMeshes);
      }
    } else {
      moveResult = movePlayer({
        world: appState.world,
        pose: playerPose,
        body: appState.playerBody,
        localDisplacement: frame.localDisplacement,
        yawDeltaRadians: frame.yawDeltaRadians,
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
    const frameAfterMoveMs = performance.now();

    for (const runtime of dynamicObjectRuntimes) {
      runtime.update(appState.world, frame.resetRequested ? 0 : deltaSeconds);
      runtime.syncParent(cellMeshes);
    }

    updateVisibleCell();
    if (xrActive) {
      xrRig.syncXrRig(playerPose, headLocalMeters);
      portalCullingCamera.copy(camera, false);
      xrRig.syncXrCullingCamera(portalCullingCamera, xrViewerPose);
      updateStylizedSceneLighting(sceneLighting, camera);
    } else {
      applyDesktopCameraPose();
    }
    syncPortalInstanceRender(xrActive ? portalCullingCamera : camera);
    syncLegacyObjectPortalRenders();
    syncXrDebugState(frame.source, moveResult);
    portalDebugRuntime.updateVisiblePortalPaths();
    const frameBeforeRenderMs = performance.now();
    renderer.render(scene, camera);
    const frameAfterRenderMs = performance.now();
    runtimeDiagnostics().recordFrame(playerPose.cellId, {
      totalMs: frameAfterRenderMs - frameStartMs,
      moveMs: frameAfterMoveMs - frameBeforeMoveMs,
      renderMs: frameAfterRenderMs - frameBeforeRenderMs,
    });
  }

  window.addEventListener("resize", onResize);
  applyDesktopCameraPose();
  renderer.setAnimationLoop(renderFrame);

  return {
    scene,
    renderer,
    updateDebugSettings(settings) {
      debugLevel = settings.debugLevel;
      portalPanelMode = settings.portalPanelMode;
      debugOptions = settings.debugOptions;
      showCellPathRendersInstances = hasActiveDebugOption(
        debugLevel,
        debugOptions,
        "portal-path-overlay-instances",
      );
      rebuildCellMeshes();
      syncPortalInstanceRender();
      portalDebugRuntime.dispose();
      portalDebugRuntime = createPortalDebugRuntime();
      logDebugStartupGuide(debugLevel, debugOptions);
      for (const runtime of dynamicObjectRuntimes) {
        runtime.syncParent(cellMeshes);
      }
      syncLegacyObjectPortalRenders();
      applyDesktopCameraPose();
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      for (const cellMesh of cellMeshes.values()) {
        disposeObject3D(cellMesh);
      }
      for (const archetype of cellRenderArchetypes) {
        scene.remove(archetype.mesh);
      }
      disposeCellRenderArchetypes(cellRenderArchetypes);
      portalInstanceDebugRenderer?.dispose();
      portalClipData.dispose();
      for (const pathId of [...legacyObjectPortalRenderEntries.keys()]) {
        removeLegacyObjectPortalRenderEntry(pathId);
      }
      legacyObjectPortalRenderRoot.removeFromParent();
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

  function getDesktopInputFrame(deltaSeconds: number): RuntimeInputFrame {
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
        source: "xr",
      };
    }

    return xrControls.consumeFrame(session.inputSources, deltaSeconds);
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
      currentCellId: playerPose.cellId,
      playerPosition: playerPose.position,
      yawRadians: playerPose.yawRadians,
      lastMovementBlocked: moveResult?.blocked ?? xrDebugState.lastMovementBlocked,
      lastBlockingReason: moveResult?.blockingReason ?? xrDebugState.lastBlockingReason,
      lastCrossedPortalId: moveResult?.crossedPortalId ?? xrDebugState.lastCrossedPortalId,
      sharedRenderRootCellId: renderer.xr.isPresenting ? xrRig.getSharedRenderRootCellId(playerPose) : undefined,
    };
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
    for (const pathId of [...legacyObjectPortalRenderEntries.keys()]) {
      removeLegacyObjectPortalRenderEntry(pathId);
    }
    for (const runtime of dynamicObjectRuntimes) {
      runtime.root.removeFromParent();
    }

    for (const [cellId, cellMesh] of cellMeshes) {
      scene.remove(cellMesh);
      disposeObject3D(cellMesh);
      cellMeshes.delete(cellId);
    }

    for (const cell of appState.world.cells) {
      const cellMesh = new THREE.Group();
      cellMesh.name = `cell-root:${cell.id}`;
      cellMesh.visible = cell.id === currentlyVisibleCellId;
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
    });
    for (const archetype of cellRenderArchetypes) {
      archetype.mesh.onBeforeRender = (renderer) => {
        updatePortalClipMaterialViewportFromRenderer(portalClipMaterialState, renderer);
      };
      scene.add(archetype.mesh);
    }
    portalInstanceDebugRenderer = createPortalInstanceDebugRenderer(scene, cellRenderArchetypes);
    visibleCellId = currentlyVisibleCellId;
  }

  function syncPortalInstanceRender(cullingCamera: THREE.Camera = camera): void {
    portalInstanceDiagnostics.reset();
    updatePortalClipMaterialViewport(
      portalClipMaterialState,
      getPortalViewportPixels(renderer),
    );
    const table = portalStaticCull.tables.tablesByRootCellId.get(playerPose.cellId);

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
      rootCellId: playerPose.cellId,
      pathTable: table,
      camera: cullingCamera,
      viewportPixels: getPortalViewportPixels(renderer),
      options: {
        maxDepth: rootRenderPathMaxDepth,
        maxVisiblePaths,
        minPortalScreenAreaPixels: 16,
        includeRootCell: true,
        sortMode: "depth-then-area",
      },
    });
    const summary = mergeStaticPathCounts(computed.summary, portalStaticCull, playerPose.cellId);
    latestVisibleResult = {
      ...computed,
      summary,
    };
    portalClipData.update(latestVisibleResult.paths);
    const visiblePathsByDestinationCell = buildVisiblePathsByDestinationCell(
      table.pathsByDestinationCellId,
      latestVisibleResult.visiblePathById,
    );
    updateCellRenderArchetypeInstances(
      cellRenderArchetypes,
      visiblePathsByDestinationCell,
      portalInstanceDiagnostics,
      portalClipData.clipIndexByPathId,
    );
    portalInstanceRenderState = createPortalInstanceRenderDebugState(
      cellRenderArchetypes,
      visiblePathsByDestinationCell,
      portalInstanceDiagnostics,
      {
        enabled: true,
        showCellPathRendersInstances,
        normalVisiblePathRenderingActive: true,
        visiblePaths: latestVisibleResult.paths,
        clipPolygonVertexCountsByPathId: portalClipData.polygonVertexCountsByPathId,
        clipPolygonOverflowPathIds: portalClipData.polygonVertexOverflowPathIds,
        visiblePathOverflowCount: portalClipData.visiblePathOverflowCount,
      },
    );
  }

  function syncLegacyObjectPortalRenders(): void {
    const visiblePathIds = new Set<number>();

    for (const path of latestVisibleResult?.paths ?? []) {
      if (path.depth === 0) {
        continue;
      }

      visiblePathIds.add(path.pathId);
      const cellRoot = cellMeshes.get(path.destinationCellId);

      if (!cellRoot || cellRoot.children.length === 0) {
        removeLegacyObjectPortalRenderEntry(path.pathId);
        continue;
      }

      const sourceChildren = [...cellRoot.children];
      const existing = legacyObjectPortalRenderEntries.get(path.pathId);
      const entry =
        existing &&
        existing.destinationCellId === path.destinationCellId &&
        sameObjectList(existing.sourceChildren, sourceChildren)
          ? existing
          : rebuildLegacyObjectPortalRenderEntry(path, sourceChildren);

      entry.root.matrix.copy(path.rootFromDestinationMatrix);
      entry.root.matrixWorldNeedsUpdate = true;
      const clipIndex = portalClipData.clipIndexByPathId.get(path.pathId) ?? -1;

      for (let index = 0; index < sourceChildren.length; index += 1) {
        syncObject3DTreeState(sourceChildren[index], entry.cloneChildren[index]);
        stampPortalClipAttributes(entry.cloneChildren[index], path.pathId, clipIndex);
      }
    }

    for (const pathId of [...legacyObjectPortalRenderEntries.keys()]) {
      if (!visiblePathIds.has(pathId)) {
        removeLegacyObjectPortalRenderEntry(pathId);
      }
    }
  }

  function rebuildLegacyObjectPortalRenderEntry(
    path: VisiblePortalPath,
    sourceChildren: readonly THREE.Object3D[],
  ): LegacyObjectPortalRenderEntry {
    removeLegacyObjectPortalRenderEntry(path.pathId);

    const root = new THREE.Group();
    root.name = `legacy-object-portal-render:${path.pathId}:${path.destinationCellId}`;
    root.matrixAutoUpdate = false;
    const clipIndex = portalClipData.clipIndexByPathId.get(path.pathId) ?? -1;
    const cloneChildren = sourceChildren.map((child) => {
      const copy = cloneObject3DWithFreshMeshResources(
        child,
        path.pathId,
        clipIndex,
        portalClipMaterialState,
      );
      root.add(copy);
      return copy;
    });
    const entry = {
      root,
      destinationCellId: path.destinationCellId,
      sourceChildren: [...sourceChildren],
      cloneChildren,
    };

    legacyObjectPortalRenderRoot.add(root);
    legacyObjectPortalRenderEntries.set(path.pathId, entry);
    return entry;
  }

  function removeLegacyObjectPortalRenderEntry(pathId: number): void {
    const entry = legacyObjectPortalRenderEntries.get(pathId);

    if (!entry) {
      return;
    }

    entry.root.removeFromParent();
    disposeObject3D(entry.root);
    legacyObjectPortalRenderEntries.delete(pathId);
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

        debugOverlay.update({
          visible: portalPathDebugActive || visiblePathDebugActive,
          visiblePortalPaths: visibleSummary,
          portalInstances: portalInstanceRenderState,
          xr: xrDebugState,
          inspectedPathLine: formatInspectedPathLine(activeOverlayPathText, activeOverlayPathCheck, latestVisibleResult),
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

function cloneObject3DWithFreshMeshResources(
  object: THREE.Object3D,
  portalPathId: number,
  portalClipIndex: number,
  portalClipMaterialState: PortalClipMaterialState,
): THREE.Object3D {
  const clone = object.clone(true);

  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) {
      return;
    }

    child.geometry = child.geometry.clone();
    child.material = patchPortalClipMaterial(cloneMaterial(child.material), portalClipMaterialState);
    child.onBeforeRender = (renderer) => {
      updatePortalClipMaterialViewportFromRenderer(portalClipMaterialState, renderer);
    };
    setGeometryPortalClipAttributes(child.geometry, portalPathId, portalClipIndex);
  });

  return clone;
}

function cloneMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone());
  }

  return material.clone();
}

function sameObjectList(left: readonly THREE.Object3D[], right: readonly THREE.Object3D[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function syncObject3DTreeState(source: THREE.Object3D, clone: THREE.Object3D): void {
  source.updateMatrix();
  clone.name = source.name;
  clone.visible = source.visible;
  clone.position.copy(source.position);
  clone.quaternion.copy(source.quaternion);
  clone.scale.copy(source.scale);
  clone.matrix.copy(source.matrix);
  clone.matrixAutoUpdate = source.matrixAutoUpdate;
  clone.matrixWorldNeedsUpdate = true;

  const count = Math.min(source.children.length, clone.children.length);
  for (let index = 0; index < count; index += 1) {
    syncObject3DTreeState(source.children[index], clone.children[index]);
  }
}

function stampPortalClipAttributes(object: THREE.Object3D, portalPathId: number, portalClipIndex: number): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      setGeometryPortalClipAttributes(child.geometry, portalPathId, portalClipIndex);
    }
  });
}

function setGeometryPortalClipAttributes(
  geometry: THREE.BufferGeometry,
  portalPathId: number,
  portalClipIndex: number,
): void {
  const vertexCount = geometry.getAttribute("position")?.count ?? 0;
  const portalPathIds = getOrCreateScalarBufferAttribute(geometry, "portalPathId", vertexCount);
  const portalClipIndexes = getOrCreateScalarBufferAttribute(geometry, "portalClipIndex", vertexCount);

  fillScalarBufferAttribute(portalPathIds, portalPathId);
  fillScalarBufferAttribute(portalClipIndexes, portalClipIndex);
}

function getOrCreateScalarBufferAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
  count: number,
): THREE.BufferAttribute {
  const existing = geometry.getAttribute(name);

  if (existing instanceof THREE.BufferAttribute && existing.count === count && existing.itemSize === 1) {
    return existing;
  }

  const attribute = new THREE.BufferAttribute(new Float32Array(count), 1);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attribute);
  return attribute;
}

function fillScalarBufferAttribute(attribute: THREE.BufferAttribute, value: number): void {
  const values = attribute.array as Float32Array;

  values.fill(value);
  attribute.needsUpdate = true;
}

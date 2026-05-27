import * as THREE from "three";
import type { AppState } from "../../appState";
import { buildPortalPathTables, type PortalPathTablesByRootCell } from "../../cell-complex/portalPaths";
import { checkPortalPathString, createPortalPathDebugState } from "../../cell-complex/portalPathDebug";
import {
  staticallyCullPortalPathTables,
  type StaticPortalPathCullResult,
} from "../../cell-complex/staticPortalPathCull";
import type { DebugSettings } from "../../glue/debugSettings";
import { hasActiveDebugOption, type DebugOptionId } from "../../glue/debugOptions";
import type { DebugLevelId } from "../../glue/debugLevels";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import { transformPoint3 } from "../../math/rigidTransform3";
import { vec3 } from "../../math/vec3";
import { movePlayer } from "../../movement/movePlayer";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import { createDefaultPlayerPose } from "../../movement/playerPose";
import {
  createGeodesciMarmotRuntime,
  isGeodesciMarmotObjectSpec,
  type GeodesciMarmotRuntime,
} from "../../world-objects/geodesciMarmot";
import { buildCellMesh } from "./buildCellMesh";
import { createDesktopControls } from "./desktopControls";
import { prerenderCells } from "./prerenderCells";
import { runtimeDiagnostics } from "./runtimeDiagnostics";
import type { PreparedWorldAssets } from "./preloadWorldAssets";

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
  readonly assets: PreparedWorldAssets;
}

export function createThreeApp(container: HTMLElement, appState: AppState, options: ThreeAppOptions): ThreeApp {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1c1c);
  scene.environment = null;
  scene.fog = new THREE.Fog(0x2f2f2f, 0, 200);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 250);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = false;
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.append(renderer.domElement);
  const controls = createDesktopControls(renderer.domElement);
  const clock = new THREE.Clock();
  let animationFrameId = 0;
  let playerPose = appState.playerPose;
  let debugLevel = options.debugLevel;
  let portalPanelMode = options.portalPanelMode;
  let debugOptions = options.debugOptions;
  let portalDebugRuntime = createPortalDebugRuntime();

  const light = new THREE.HemisphereLight(0xffffff, 0x304050, 2);
  light.castShadow = false;
  scene.add(light);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(3, 6, 4);
  keyLight.castShadow = false;
  scene.add(keyLight);

  const cellMeshes = new Map<string, THREE.Object3D>();
  const warmupViewsByCellId = new Map(
    appState.world.cells.map((cell) => [cell.id, createCellWarmupViews(cell)] as const),
  );
  const marmotRuntimes: GeodesciMarmotRuntime[] = [];
  let visibleCellId: string | undefined = playerPose.cellId;

  rebuildCellMeshes();

  for (const cell of appState.world.cells) {
    for (const objectSpec of cell.objects) {
      if (!isGeodesciMarmotObjectSpec(objectSpec)) {
        continue;
      }

      const runtime = createGeodesciMarmotRuntime(objectSpec, cell.id, options.assets);
      runtime.syncParent(cellMeshes);
      marmotRuntimes.push(runtime);
    }
  }
  disableFrustumCulling(scene);
  disableShadows(scene);

  function applyCameraPose(): void {
    camera.position.set(
      playerPose.position.x,
      playerPose.position.y + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      playerPose.position.z,
    );
    camera.rotation.set(playerPose.pitchRadians, playerPose.yawRadians, 0, "YXZ");
  }

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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function renderFrame(): void {
    const frameStartMs = performance.now();
    const deltaSeconds = clock.getDelta();
    const frame = controls.consumeFrame(deltaSeconds);
    const frameBeforeMoveMs = performance.now();
    const previousCellId = playerPose.cellId;
    let moveResult:
      | {
          readonly pose: typeof playerPose;
          readonly crossedPortal: boolean;
          readonly crossedPortalId?: string;
        }
      | undefined;

    if (frame.resetRequested) {
      playerPose = createDefaultPlayerPose(appState.playerPose.cellId);
      for (const runtime of marmotRuntimes) {
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
    }
    const frameAfterMoveMs = performance.now();

    if (moveResult?.crossedPortal && playerPose.cellId !== previousCellId) {
      runtimeDiagnostics().recordCellEntered(previousCellId, playerPose.cellId, moveResult.crossedPortalId ?? "unknown-portal");
    }

    for (const runtime of marmotRuntimes) {
      runtime.update(appState.world, frame.resetRequested ? 0 : deltaSeconds);
      runtime.syncParent(cellMeshes);
    }

    updateVisibleCell();
    applyCameraPose();
    const frameBeforeRenderMs = performance.now();
    renderer.render(scene, camera);
    const frameAfterRenderMs = performance.now();
    runtimeDiagnostics().recordFrame(playerPose.cellId, {
      totalMs: frameAfterRenderMs - frameStartMs,
      moveMs: frameAfterMoveMs - frameBeforeMoveMs,
      renderMs: frameAfterRenderMs - frameBeforeRenderMs,
    });
    animationFrameId = window.requestAnimationFrame(renderFrame);
  }

  window.addEventListener("resize", onResize);
  applyCameraPose();
  renderFrame();

  return {
    scene,
    renderer,
    updateDebugSettings(settings) {
      debugLevel = settings.debugLevel;
      portalPanelMode = settings.portalPanelMode;
      debugOptions = settings.debugOptions;
      rebuildCellMeshes();
      portalDebugRuntime.dispose();
      portalDebugRuntime = createPortalDebugRuntime();
      for (const runtime of marmotRuntimes) {
        runtime.syncParent(cellMeshes);
      }
      applyCameraPose();
      renderer.render(scene, camera);
    },
    dispose() {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      for (const cellMesh of cellMeshes.values()) {
        disposeObject3D(cellMesh);
      }
      portalDebugRuntime.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  function rebuildCellMeshes(): void {
    const currentlyVisibleCellId = visibleCellId ?? playerPose.cellId;

    for (const [cellId, cellMesh] of cellMeshes) {
      scene.remove(cellMesh);
      disposeObject3D(cellMesh);
      cellMeshes.delete(cellId);
    }

    for (const cell of appState.world.cells) {
      const cellMesh = buildCellMesh(cell, {
        debugLevel,
        portalPanelMode,
        eyeHeightMeters: DEFAULT_PLAYER_EYE_HEIGHT_METERS,
        assets: options.assets,
      });
      cellMesh.visible = cell.id === currentlyVisibleCellId;
      cellMeshes.set(cell.id, cellMesh);
      scene.add(cellMesh);
    }

    visibleCellId = currentlyVisibleCellId;
  }

  function createPortalDebugRuntime(): { dispose(): void } {
    const portalPathDebugActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-path-debug");

    if (!portalPathDebugActive) {
      uninstallPortalDebugHelpers();
      return { dispose() {} };
    }

    const overlayActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-path-overlays");
    const staticCullDebugActive = hasActiveDebugOption(debugLevel, debugOptions, "portal-static-cull-debug");
    const candidateTables = buildPortalPathTables(appState.world, {
      maxDepth: 10,
      skipImmediateReverse: true,
    });
    const staticCull = staticallyCullPortalPathTables(appState.world, candidateTables, {
      toleranceMeters: 1e-6,
      keepRejectedPathDetails: staticCullDebugActive,
    });
    const overlays: THREE.Object3D[] = [];
    const checkPath = (pathText: string) =>
      checkPortalPathString(pathText, {
        world: appState.world,
        rootCellId: playerPose.cellId,
        candidateTables,
        keptTables: staticCull.tables,
        cullSummariesByRootCellId: staticCull.summariesByRootCellId,
      });

    installPortalDebugHelpers({
      CheckCellPath: checkPath,
      ShowCellPath(pathText: string) {
        const check = checkPath(pathText);

        if (!overlayActive) {
          return {
            ok: false,
            reason: "portal-path-overlays is not active",
            check,
            pathId: check.matchedPathId,
            objectCount: 0,
          };
        }

        if (!check.valid || !check.survivedStaticCull || check.matchedPathId === undefined) {
          return {
            ok: false,
            reason: check.rejectionReason ?? check.errors[0] ?? "path is not available in the kept table",
            check,
            pathId: check.matchedPathId,
            objectCount: 0,
          };
        }

        hideCellPathOverlays(overlays, scene);
        const table = staticCull.tables.tablesByRootCellId.get(playerPose.cellId);
        const path = table?.pathsById.get(check.matchedPathId);
        const destinationCell = check.destinationCellId ? appState.world.cellsById.get(check.destinationCellId) : undefined;

        if (!path || !destinationCell) {
          return {
            ok: false,
            reason: "matched path or destination cell was not found",
            check,
            pathId: check.matchedPathId,
            objectCount: 0,
          };
        }

        const geometry = new THREE.BufferGeometry();
        const vertices = destinationCell.baseVertices.map((vertex) =>
          transformPoint3(path.rootFromDestination, vec3(vertex.x, 0.03, vertex.z)),
        );
        geometry.setFromPoints(vertices.map((vertex) => new THREE.Vector3(vertex.x, vertex.y, vertex.z)));
        geometry.setIndex(triangleFanIndices(vertices.length));
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({
          color: 0xff2222,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `debug-cell-path-overlay:${path.id}`;
        scene.add(mesh);
        overlays.push(mesh);

        return {
          ok: true,
          check,
          pathId: path.id,
          objectCount: 1,
        };
      },
      HideCellPaths() {
        hideCellPathOverlays(overlays, scene);
      },
      get state() {
        return createPortalPathDebugState(playerPose.cellId, candidateTables, staticCull);
      },
      candidateTables,
      staticCull,
    });
    logPortalDebugInstall(candidateTables, staticCull, staticCullDebugActive, overlayActive);

    return {
      dispose() {
        hideCellPathOverlays(overlays, scene);
        uninstallPortalDebugHelpers();
      },
    };
  }
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
      "Use window.noneuclidPortalDebug.CheckCellPath(\"0 2 3\") to inspect a path.",
      overlayActive
        ? "Use window.noneuclidPortalDebug.ShowCellPath(\"0 2 3\") to draw a red destination-cell overlay."
        : "Enable portal-path-overlays to allow ShowCellPath overlays.",
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
        candidatePaths: summary?.inputPathCount ?? table.paths.length,
        keptPaths: summary?.keptPathCount ?? table.paths.length,
        rejectedPaths: summary?.rejectedPathCount ?? 0,
        maxAvailableDepth: Math.max(0, ...table.paths.map((path) => path.depth)),
        budgetRejected: summary?.rejectedByReason.get("static-path-budget") ?? 0,
      };
    }),
  );
}

interface PortalDebugHelpers {
  CheckCellPath(pathText: string): ReturnType<typeof checkPortalPathString>;
  ShowCellPath(pathText: string): {
    readonly ok: boolean;
    readonly reason?: string;
    readonly check: ReturnType<typeof checkPortalPathString>;
    readonly pathId?: number;
    readonly objectCount: number;
  };
  HideCellPaths(): void;
  readonly state: ReturnType<typeof createPortalPathDebugState>;
  readonly candidateTables: PortalPathTablesByRootCell;
  readonly staticCull: StaticPortalPathCullResult;
}

function installPortalDebugHelpers(helpers: PortalDebugHelpers): void {
  (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug = helpers;
}

function uninstallPortalDebugHelpers(): void {
  delete (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug;
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
  const eyeY = Math.min(cell.heightMeters - 0.1, DEFAULT_PLAYER_EYE_HEIGHT_METERS);

  return [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((yawRadians) => ({
    position: {
      x: center.x,
      y: eyeY,
      z: center.z,
    },
    yawRadians,
  }));
}

function getCellCenter(cell: AppState["world"]["cells"][number]): { readonly x: number; readonly z: number } {
  let x = 0;
  let z = 0;

  for (const vertex of cell.baseVertices) {
    x += vertex.x;
    z += vertex.z;
  }

  const count = Math.max(1, cell.baseVertices.length);
  return {
    x: x / count,
    z: z / count,
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

import * as THREE from "three";
import type { AppState } from "../../appState";
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

export interface ThreeApp {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  dispose(): void;
}

export interface ThreeAppOptions {
  readonly debugLevel: number;
}

export function createThreeApp(container: HTMLElement, appState: AppState, options: ThreeAppOptions): ThreeApp {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.append(renderer.domElement);
  const controls = createDesktopControls(renderer.domElement);
  const clock = new THREE.Clock();
  let animationFrameId = 0;
  let playerPose = appState.playerPose;

  const light = new THREE.HemisphereLight(0xffffff, 0x304050, 2);
  scene.add(light);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(3, 6, 4);
  scene.add(keyLight);

  const cellMeshes = new Map<string, THREE.Object3D>();
  const cellSideCounts = new Map(appState.world.cells.map((cell) => [cell.id, cell.sideCount]));
  const marmotRuntimes: GeodesciMarmotRuntime[] = [];

  for (const cell of appState.world.cells) {
    const cellMesh = buildCellMesh(cell, {
      debugLevel: options.debugLevel,
      eyeHeightMeters: DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      cellSideCounts,
    });
    cellMesh.visible = false;
    cellMeshes.set(cell.id, cellMesh);
    scene.add(cellMesh);

    for (const objectSpec of cell.objects) {
      if (!isGeodesciMarmotObjectSpec(objectSpec)) {
        continue;
      }

      const runtime = createGeodesciMarmotRuntime(objectSpec, cell.id);
      runtime.syncParent(cellMeshes);
      marmotRuntimes.push(runtime);
    }
  }

  let visibleCellId: string | undefined;

  function applyCameraPose(): void {
    camera.position.set(
      playerPose.position.x,
      playerPose.position.y + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      playerPose.position.z,
    );
    camera.rotation.set(playerPose.pitchRadians, playerPose.yawRadians, 0, "YXZ");
  }

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
    const deltaSeconds = clock.getDelta();
    const frame = controls.consumeFrame(deltaSeconds);

    if (frame.resetRequested) {
      playerPose = createDefaultPlayerPose(appState.playerPose.cellId);
      for (const runtime of marmotRuntimes) {
        runtime.reset(cellMeshes);
      }
    } else {
      playerPose = movePlayer({
        world: appState.world,
        pose: playerPose,
        body: appState.playerBody,
        localDisplacement: frame.localDisplacement,
        yawDeltaRadians: frame.yawDeltaRadians,
        pitchDeltaRadians: frame.pitchDeltaRadians,
        coordinateFrame: "global",
      }).pose;
    }

    for (const runtime of marmotRuntimes) {
      runtime.update(appState.world, frame.resetRequested ? 0 : deltaSeconds);
      runtime.syncParent(cellMeshes);
    }

    updateVisibleCell();
    applyCameraPose();
    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(renderFrame);
  }

  window.addEventListener("resize", onResize);
  applyCameraPose();
  renderFrame();

  return {
    scene,
    renderer,
    dispose() {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      for (const cellMesh of cellMeshes.values()) {
        disposeObject3D(cellMesh);
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
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

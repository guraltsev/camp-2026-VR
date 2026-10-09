/** Debug overlay that draws a traced portal path through the cells it crosses. */
import * as THREE from "three";
import { type AppState } from "../../appState";
import { type PortalRenderPath } from "../../cell-complex/portalPaths";
import { type CompiledPrismCell } from "../../cell-complex/prismCells";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  invertRigidTransform3,
  transformPoint3,
} from "../../math/rigidTransform3";
import { disposeObject3D } from "./runtimeSceneUtils";
import { worldPointToThree } from "./worldAxes";

export function createPathTraceOverlay(
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

export function buildPathTracePoints(
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

export function getCellTracePoint(cell: CompiledPrismCell): { readonly x: number; readonly y: number; readonly z: number } {
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

export function hideCellPathOverlays(overlays: THREE.Object3D[], scene: THREE.Scene): void {
  while (overlays.length > 0) {
    const overlay = overlays.pop()!;
    scene.remove(overlay);
    disposeObject3D(overlay);
  }
}

export function triangleFanIndices(vertexCount: number): number[] {
  const indices: number[] = [];

  for (let index = 1; index < vertexCount - 1; index += 1) {
    indices.push(0, index, index + 1);
  }

  return indices;
}

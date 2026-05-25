import * as THREE from "three";

export interface PrerenderCellsOptions {
  readonly renderer: Pick<THREE.WebGLRenderer, "compile" | "render">;
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly cellMeshes: ReadonlyMap<string, THREE.Object3D>;
  readonly activeCellId: string;
}

export function prerenderCells(options: PrerenderCellsOptions): void {
  const visibilityByCellId = new Map<string, boolean>();

  for (const [cellId, cellMesh] of options.cellMeshes) {
    visibilityByCellId.set(cellId, cellMesh.visible);
    cellMesh.visible = true;
    cellMesh.userData = {
      ...cellMesh.userData,
      prerenderedByDefault: true,
    };
  }

  options.renderer.compile(options.scene, options.camera);
  options.renderer.render(options.scene, options.camera);

  for (const [cellId, cellMesh] of options.cellMeshes) {
    cellMesh.visible = cellId === options.activeCellId;
    cellMesh.userData = {
      ...cellMesh.userData,
      prerenderedByDefault: true,
      prerendered: true,
      previousVisible: visibilityByCellId.get(cellId) ?? false,
    };
  }
}

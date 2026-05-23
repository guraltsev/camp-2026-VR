import * as THREE from "three";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";

export function buildCellMesh(cell: CompiledPrismCell): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `cell:${cell.id}`;
  return group;
}

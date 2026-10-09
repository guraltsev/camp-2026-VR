/** Large plane drawn below the cells so the void reads as ground. */
import * as THREE from "three";

export const underCellInfinityFloorSizeMeters = 1_000;
export const underCellInfinityFloorWorldZMeters = -1;

export function createUnderCellInfinityFloor(): THREE.Mesh {
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

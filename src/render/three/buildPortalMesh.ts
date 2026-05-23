import * as THREE from "three";

export function buildPortalMesh(portalId: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `portal:${portalId}`;
  return group;
}

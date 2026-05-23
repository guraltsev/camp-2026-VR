import * as THREE from "three";

export function buildDecorationMesh(name: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `decoration:${name}`;
  return group;
}

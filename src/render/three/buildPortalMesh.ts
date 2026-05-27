import * as THREE from "three";
import { createPortalWallMaterial } from "./portalWallTexture";
import type { PreparedWorldAssets } from "./preloadWorldAssets";

export interface PortalWallMeshSpec {
  readonly portalId: string;
  readonly sideIndex: number;
  readonly start: { readonly x: number; readonly z: number };
  readonly end: { readonly x: number; readonly z: number };
  readonly heightMeters: number;
  readonly assets: PreparedWorldAssets;
  readonly showWall: boolean;
}

export function buildPortalMesh(spec: PortalWallMeshSpec): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `portal:${spec.portalId}`;
  const edgeLength = Math.hypot(spec.end.x - spec.start.x, spec.end.z - spec.start.z);
  const material = createPortalWallMaterial(
    Math.max(1, edgeLength / 8),
    Math.max(1, spec.heightMeters / 8),
    spec.assets,
  );
  group.userData = {
    kind: "portal-wall",
    portalId: spec.portalId,
    sideIndex: spec.sideIndex,
    textureUrl: material.userData.textureUrl,
  };

  if (spec.showWall) {
    const mesh = buildWallMesh(spec, material);
    mesh.name = `portal-wall:${spec.portalId}`;
    group.add(mesh);
  }

  return group;
}

function buildWallMesh(spec: PortalWallMeshSpec, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const start = new THREE.Vector3(spec.start.x, 0, spec.start.z);
  const end = new THREE.Vector3(spec.end.x, 0, spec.end.z);
  const edgeLength = new THREE.Vector3().subVectors(end, start).length();
  const inward = new THREE.Vector3(-(spec.end.z - spec.start.z), 0, spec.end.x - spec.start.x).normalize();
  const position = new THREE.Vector3(
    (spec.start.x + spec.end.x) / 2,
    spec.heightMeters / 2,
    (spec.start.z + spec.end.z) / 2,
  );

  const geometry = new THREE.PlaneGeometry(edgeLength, spec.heightMeters);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position).addScaledVector(inward, 0.01);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
  mesh.userData = {
    kind: "portal-wall-mesh",
    portalId: spec.portalId,
    sideIndex: spec.sideIndex,
  };
  return mesh;
}

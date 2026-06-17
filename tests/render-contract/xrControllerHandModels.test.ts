import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createHandModelTemplates } from "../../src/render/three/xrControllerHandModels";

describe("xrControllerHandModels", () => {
  it("keeps all meshes for each side of a split low-poly hand asset", () => {
    const source = new THREE.Group();
    source.add(
      createNamedBox("right-palm", -0.28),
      createNamedBox("right-finger", -0.12),
      createNamedBox("left-palm", 0.14),
      createNamedBox("left-finger", 0.31),
    );

    const templates = createHandModelTemplates(source);

    expect(collectMeshNames(templates.left)).toEqual(["left-palm", "left-finger"]);
    expect(collectMeshNames(templates.right)).toEqual(["right-palm", "right-finger"]);
  });
});

function createNamedBox(name: string, x: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.04),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = name;
  mesh.position.x = x;
  return mesh;
}

function collectMeshNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      names.push(mesh.name);
    }
  });
  return names;
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetObjectSpec, CellObjectSpec } from "../../cell-complex/specs";
import { publicAssetUrl } from "../../glue/assetUrls";

const gltfLoader = new GLTFLoader();

export function buildDecorationMesh(objectSpec: CellObjectSpec): THREE.Object3D {
  if (objectSpec.kind !== "asset") {
    throw new Error(`Cannot build static decoration mesh for object kind "${objectSpec.kind}".`);
  }

  return buildStaticAssetMesh(objectSpec);
}

function buildStaticAssetMesh(objectSpec: AssetObjectSpec): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `decoration:${objectSpec.id}`;
  group.position.set(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z);
  group.rotation.y = objectSpec.yawRadians ?? 0;

  const scale = objectSpec.scale ?? 1;
  group.scale.setScalar(scale);

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  );
  placeholder.position.y = 0.3;
  placeholder.name = `placeholder:${objectSpec.id}`;
  group.add(placeholder);

  gltfLoader.load(
    publicAssetUrl(objectSpec.assetPath),
    (gltf) => {
      placeholder.removeFromParent();
      disposeObject3D(placeholder);
      gltf.scene.name = `asset:${objectSpec.id}`;
      group.add(gltf.scene);
    },
    undefined,
    () => {
      placeholder.name = `missing-asset:${objectSpec.id}`;
    },
  );

  return group;
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
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

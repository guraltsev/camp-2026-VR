import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { publicAssetUrl } from "../../glue/assetUrls";
import { PORTAL_WALL_TEXTURE_FILE } from "./portalWallTexture";

const skyboxAssetNames = [
  "skybox-1.png",
  "skybox-2.jpg",
  "skybox-3.jpg",
  "skybox-4.jpg",
  "skybox-5.jpg",
  "skybox-6.jpg",
] as const;

export async function preloadWorldAssets(world: CompiledCellComplex): Promise<void> {
  const assetPaths = new Set<string>();

  for (const cell of world.cells) {
    for (const object of cell.objects) {
      assetPaths.add(object.assetPath);
    }
  }

  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();

  await Promise.allSettled([
    ...[PORTAL_WALL_TEXTURE_FILE, ...skyboxAssetNames].map((assetPath) =>
      textureLoader.loadAsync(publicAssetUrl(assetPath)),
    ),
    ...[...assetPaths].map((assetPath) => gltfLoader.loadAsync(publicAssetUrl(assetPath))),
  ]);
}

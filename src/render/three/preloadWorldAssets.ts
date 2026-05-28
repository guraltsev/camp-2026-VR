import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { publicAssetUrl } from "../../glue/assetUrls";
import { PORTAL_WALL_TEXTURE_FILE } from "./portalWallTexture";
import { runtimeDiagnostics } from "./runtimeDiagnostics";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface PreparedGltfAsset {
  readonly scene: THREE.Object3D;
  readonly animations: readonly THREE.AnimationClip[];
}

export interface PreparedWorldAssets {
  getTexture(assetPath: string): THREE.Texture | undefined;
  instantiateGltf(assetPath: string): PreparedGltfAsset | undefined;
}

export async function preloadWorldAssets(world: CompiledCellComplex): Promise<PreparedWorldAssets> {
  const assetPaths = new Set<string>();
  const diagnostics = runtimeDiagnostics();
  const textures = new Map<string, THREE.Texture>();
  const gltfs = new Map<string, GLTF>();

  for (const cell of world.cells) {
    for (const object of cell.objects) {
      assetPaths.add(object.assetPath);
    }
  }

  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();

  await Promise.all([
    ...[PORTAL_WALL_TEXTURE_FILE].map((assetPath) => {
      diagnostics.recordPreloadStart(assetPath, "texture");
      return textureLoader.loadAsync(publicAssetUrl(assetPath)).then(
        (texture) => {
          textures.set(assetPath, texture);
          diagnostics.recordPreloadComplete(assetPath, "texture");
          return texture;
        },
        (error: unknown) => {
          diagnostics.recordPreloadError(assetPath, "texture", error);
          throw error;
        },
      );
    }),
    ...[...assetPaths].map((assetPath) => {
      diagnostics.recordPreloadStart(assetPath, "gltf");
      return gltfLoader.loadAsync(publicAssetUrl(assetPath)).then(
        (gltf) => {
          gltfs.set(assetPath, gltf);
          diagnostics.recordPreloadComplete(assetPath, "gltf");
          return gltf;
        },
        (error: unknown) => {
          diagnostics.recordPreloadError(assetPath, "gltf", error);
          throw error;
        },
      );
    }),
  ]);

  return {
    getTexture(assetPath) {
      return textures.get(assetPath);
    },
    instantiateGltf(assetPath) {
      const gltf = gltfs.get(assetPath);

      if (!gltf) {
        return undefined;
      }

      return {
        scene: cloneSkeleton(gltf.scene),
        animations: gltf.animations,
      };
    },
  };
}

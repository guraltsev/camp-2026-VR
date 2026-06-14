import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { publicAssetUrl } from "../../glue/assetUrls";
import { PORTAL_WALL_TEXTURE_FILE } from "./portalWallTexture";
import { placedFlagAssetPaths } from "../../world-objects/placedFlags";
import { geodesicFlashlightAssetPaths } from "./geodesicCannonRenderer";
import { runtimeDiagnostics } from "./runtimeDiagnostics";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

export interface PreparedTextureRequest {
  readonly assetPath: string;
  readonly colorSpace: THREE.ColorSpace;
  readonly repeatX: number;
  readonly repeatY: number;
  readonly wrapS?: THREE.Wrapping;
  readonly wrapT?: THREE.Wrapping;
  readonly name?: string;
  readonly userData?: Record<string, unknown>;
}

export interface PreparedGltfAsset {
  readonly scene: THREE.Object3D;
  readonly animations: readonly THREE.AnimationClip[];
}

export interface PreparedWorldAssets {
  getTexture(assetPath: string): THREE.Texture | undefined;
  getConfiguredTexture(request: PreparedTextureRequest): THREE.Texture | undefined;
  instantiateGltf(assetPath: string): PreparedGltfAsset | undefined;
}

export type AssetPreloadKind = "texture" | "texture-exr" | "texture-ktx2" | "gltf";

export interface PreparedKtx2Loader {
  readonly loadAsync: (url: string) => Promise<THREE.Texture>;
  readonly dispose: () => void;
}

export interface PreloadWorldAssetsOptions {
  readonly createKtx2Loader?: () => Promise<PreparedKtx2Loader>;
}

export function collectWorldAssetPaths(world: CompiledCellComplex): readonly string[] {
  const assetPaths = new Set<string>();

  for (const cell of world.cells) {
    if (cell.floorMaterial.kind === "floor-texture") {
      for (const assetPath of [
        cell.floorMaterial.colorTexturePath,
        cell.floorMaterial.normalTexturePath,
        cell.floorMaterial.bumpTexturePath,
        cell.floorMaterial.roughnessTexturePath,
      ]) {
        if (assetPath) {
          assetPaths.add(assetPath);
        }
      }
    }

    for (const object of cell.objects) {
      assetPaths.add(object.assetPath);
    }
  }

  for (const assetPath of [
    ...Object.values(placedFlagAssetPaths),
    ...Object.values(geodesicFlashlightAssetPaths),
  ]) {
    assetPaths.add(assetPath);
  }

  return [...assetPaths];
}

export function classifyAssetPreloadKind(assetPath: string): AssetPreloadKind {
  if (/\.ktx2$/i.test(assetPath)) {
    return "texture-ktx2";
  }

  if (/\.exr$/i.test(assetPath)) {
    return "texture-exr";
  }

  if (/\.(avif|jpe?g|png|webp)$/i.test(assetPath)) {
    return "texture";
  }

  return "gltf";
}

export async function preloadWorldAssets(
  world: CompiledCellComplex,
  options: PreloadWorldAssetsOptions = {},
): Promise<PreparedWorldAssets> {
  const diagnostics = runtimeDiagnostics();
  const textures = new Map<string, THREE.Texture>();
  const configuredTextures = new Map<string, THREE.Texture>();
  const gltfs = new Map<string, GLTF>();
  const assetPaths = collectWorldAssetPaths(world);
  const optionalTexturePaths = collectOptionalFloorTexturePaths(world);
  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const exrLoader = new EXRLoader();
  const createKtx2Loader = options.createKtx2Loader ?? createRuntimeKtx2Loader;
  const hasKtx2Assets = assetPaths.some((assetPath) => classifyAssetPreloadKind(assetPath) === "texture-ktx2");
  const ktx2Loader = hasKtx2Assets ? await createKtx2Loader() : undefined;

  try {
    await Promise.all([
      loadRequiredTexture(PORTAL_WALL_TEXTURE_FILE, textureLoader, textures, diagnostics),
      ...assetPaths.map((assetPath) => {
        const optional = optionalTexturePaths.has(assetPath);
        const kind = classifyAssetPreloadKind(assetPath);

        switch (kind) {
          case "texture":
            return loadTextureAsset(assetPath, textureLoader, textures, diagnostics, optional);
          case "texture-exr":
            return loadTextureAsset(assetPath, exrLoader, textures, diagnostics, optional);
          case "texture-ktx2":
            if (!ktx2Loader) {
              throw new Error(`KTX2 texture loader was not initialized for ${assetPath}.`);
            }

            return loadTextureAsset(assetPath, ktx2Loader, textures, diagnostics, optional);
          case "gltf":
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
        }
      }),
    ]);
  } finally {
    ktx2Loader?.dispose();
  }

  return {
    getTexture(assetPath) {
      return textures.get(assetPath);
    },
    getConfiguredTexture(request) {
      const preparedTexture = textures.get(request.assetPath);

      if (!preparedTexture) {
        return undefined;
      }

      const cacheKey = [
        request.assetPath,
        request.colorSpace,
        request.repeatX,
        request.repeatY,
        request.wrapS ?? THREE.ClampToEdgeWrapping,
        request.wrapT ?? THREE.ClampToEdgeWrapping,
        request.name ?? "",
        JSON.stringify(request.userData ?? {}),
      ].join("|");
      const cachedTexture = configuredTextures.get(cacheKey);

      if (cachedTexture) {
        return cachedTexture;
      }

      const texture = preparedTexture.clone();
      texture.colorSpace = request.colorSpace;
      texture.wrapS = request.wrapS ?? THREE.ClampToEdgeWrapping;
      texture.wrapT = request.wrapT ?? THREE.ClampToEdgeWrapping;
      texture.repeat.set(request.repeatX, request.repeatY);

      if (request.name) {
        texture.name = request.name;
      }

      if (request.userData) {
        texture.userData = { ...request.userData };
      }

      texture.needsUpdate = true;
      configuredTextures.set(cacheKey, texture);
      return texture;
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

function collectOptionalFloorTexturePaths(world: CompiledCellComplex): ReadonlySet<string> {
  const optionalTexturePaths = new Set<string>();

  for (const cell of world.cells) {
    if (cell.floorMaterial.kind === "floor-texture" && cell.floorMaterial.colorTexturePath) {
      optionalTexturePaths.add(cell.floorMaterial.colorTexturePath);
    }
  }

  return optionalTexturePaths;
}

async function loadRequiredTexture(
  assetPath: string,
  loader: { loadAsync(url: string): Promise<THREE.Texture> },
  textures: Map<string, THREE.Texture>,
  diagnostics: ReturnType<typeof runtimeDiagnostics>,
): Promise<THREE.Texture> {
  diagnostics.recordPreloadStart(assetPath, "texture");
  return loader.loadAsync(publicAssetUrl(assetPath)).then(
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
}

async function loadTextureAsset(
  assetPath: string,
  loader: { loadAsync(url: string): Promise<THREE.Texture> },
  textures: Map<string, THREE.Texture>,
  diagnostics: ReturnType<typeof runtimeDiagnostics>,
  optional: boolean,
): Promise<THREE.Texture | undefined> {
  diagnostics.recordPreloadStart(assetPath, "texture");
  return loader.loadAsync(publicAssetUrl(assetPath)).then(
    (texture) => {
      textures.set(assetPath, texture);
      diagnostics.recordPreloadComplete(assetPath, "texture");
      return texture;
    },
    (error: unknown) => {
      diagnostics.recordPreloadError(assetPath, "texture", error);

      if (optional) {
        return undefined;
      }

      throw error;
    },
  );
}

async function createRuntimeKtx2Loader(): Promise<PreparedKtx2Loader> {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "low-power",
  });
  const loader = new KTX2Loader();
  loader.setTranscoderPath(publicAssetUrl("ktx2/"));
  loader.detectSupport(renderer);

  return {
    loadAsync(url) {
      return loader.loadAsync(url);
    },
    dispose() {
      loader.dispose();
      renderer.dispose();
    },
  };
}

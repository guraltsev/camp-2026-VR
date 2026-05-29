import * as THREE from "three";
import { legacyPublicAssetUrl } from "../../glue/assetUrls";
import type { PreparedWorldAssets } from "./preloadWorldAssets";

export const PORTAL_WALL_TEXTURE_FILE = "_legacy/abstract-fractal-geometric-figure-background-with-texture.jpg";
export const PORTAL_WALL_TEXTURE_URL = legacyPublicAssetUrl("abstract-fractal-geometric-figure-background-with-texture.jpg");

export function createPortalWallMaterial(
  repeatX: number,
  repeatY: number,
  assets: PreparedWorldAssets,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.userData.textureUrl = PORTAL_WALL_TEXTURE_URL;

  const preparedTexture = assets.getTexture(PORTAL_WALL_TEXTURE_FILE);
  if (!preparedTexture) {
    throw new Error(`Portal wall texture was not preloaded: ${PORTAL_WALL_TEXTURE_FILE}`);
  }

  material.map = configurePortalWallTexture(preparedTexture.clone(), repeatX, repeatY);
  material.needsUpdate = true;
  return material;
}

function configurePortalWallTexture(texture: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.name = "portal-wall-texture";
  texture.userData.textureUrl = PORTAL_WALL_TEXTURE_URL;
  texture.userData.repeatX = repeatX;
  texture.userData.repeatY = repeatY;
  return texture;
}

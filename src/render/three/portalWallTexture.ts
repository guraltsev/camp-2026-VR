import * as THREE from "three";
import { publicAssetUrl } from "../../glue/assetUrls";

export const PORTAL_WALL_TEXTURE_FILE = "abstract-fractal-geometric-figure-background-with-texture.jpg";
export const PORTAL_WALL_TEXTURE_URL = publicAssetUrl(PORTAL_WALL_TEXTURE_FILE);

export function createPortalWallMaterial(repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.userData.textureUrl = PORTAL_WALL_TEXTURE_URL;

  if (typeof Image !== "undefined") {
    material.map = loadPortalWallTexture(repeatX, repeatY);
    material.needsUpdate = true;
  }

  return material;
}

function loadPortalWallTexture(repeatX: number, repeatY: number): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(PORTAL_WALL_TEXTURE_URL, (loadedTexture) => {
    configurePortalWallTexture(loadedTexture, repeatX, repeatY);
  });

  configurePortalWallTexture(texture, repeatX, repeatY);
  return texture;
}

function configurePortalWallTexture(texture: THREE.Texture, repeatX: number, repeatY: number): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.name = "portal-wall-texture";
  texture.userData.textureUrl = PORTAL_WALL_TEXTURE_URL;
  texture.userData.repeatX = repeatX;
  texture.userData.repeatY = repeatY;
}

import * as THREE from "three";
import type { PlacedFlagObject } from "../../world-objects/placedFlags";
import { placedFlagAssetPaths } from "../../world-objects/placedFlags";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { applyWorldRigidTransform } from "./worldAxes";

export interface PlacedFlagRuntime {
  readonly root: THREE.Object3D;
  readonly cellId: string;
  readonly flagId: string;
  syncFromObject(flag: PlacedFlagObject): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  dispose(): void;
}

interface RenderedFlag {
  readonly root: THREE.Group;
  readonly textTexture: THREE.CanvasTexture;
  cellId: string;
  flagType: PlacedFlagObject["flagType"];
  message: string;
  fontColor: string;
}

interface FlagTextLayout {
  readonly centerX: number;
  readonly centerY: number;
  readonly frontZ: number;
  readonly backZ: number;
  readonly width: number;
  readonly height: number;
}

interface WritableAreaCalibration {
  readonly xScale: number;
  readonly yScale: number;
  readonly xOffset: number;
  readonly yOffset: number;
  readonly zOffset: number;
}

const SIGN_MODEL_SCALE = 0.75;
const MAX_TEXT_LINE_HEIGHT = 96;
const TEXT_LINE_HEIGHT_TO_FONT_SIZE = 0.82;
const writableAreaCalibrations: Record<PlacedFlagObject["flagType"], WritableAreaCalibration> = {
  WoodenSign1: {
    xScale: 0.53,
    yScale: 0.405,
    xOffset: -0.01,
    yOffset: 0.105,
    zOffset: 0.00,
  },
  WoodenSign2: {
    xScale: 0.55,
    yScale: 0.3,
    xOffset: -0.13,
    yOffset: 0.15,
    zOffset: 0.00,
  },
};
const FALLBACK_TEXT_LAYOUT: FlagTextLayout = {
  centerX: 0,
  centerY: 1,
  frontZ: -0.08,
  backZ: 0.08,
  width: 0.8,
  height: 0.4,
};

export function createPlacedFlagRuntime(flag: PlacedFlagObject, assets: PreparedWorldAssets): PlacedFlagRuntime {
  const rendered = createRenderedFlag(flag, assets);

  return {
    root: rendered.root,
    flagId: flag.id,
    get cellId() {
      return rendered.cellId;
    },
    syncFromObject(nextFlag) {
      if (nextFlag.id !== flag.id) {
        throw new Error(`Cannot sync placed flag runtime "${flag.id}" from "${nextFlag.id}".`);
      }

      syncRenderedFlag(nextFlag, rendered);
    },
    syncParent(cellRoots) {
      const parent = cellRoots.get(rendered.cellId);
      if (parent && rendered.root.parent !== parent) {
        parent.add(rendered.root);
      }
    },
    dispose() {
      rendered.root.removeFromParent();
      disposeRenderedFlag(rendered);
    },
  };
}

function createRenderedFlag(flag: PlacedFlagObject, assets: PreparedWorldAssets): RenderedFlag {
  const root = new THREE.Group();
  root.name = `placed-flag:${flag.id}`;

  const prepared = assets.instantiateGltf(placedFlagAssetPaths[flag.flagType]);
  if (!prepared) {
    throw new Error(`Placed flag asset was not preloaded: ${placedFlagAssetPaths[flag.flagType]}`);
  }

  prepared.scene.name = `asset:${flag.id}`;
  prepared.scene.scale.setScalar(SIGN_MODEL_SCALE);
  prepared.scene.rotation.y = Math.PI;
  root.add(prepared.scene);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const textTexture = new THREE.CanvasTexture(canvas);
  textTexture.colorSpace = THREE.SRGBColorSpace;
  textTexture.name = `placed-flag-text:${flag.id}`;
  const textLayout = resolveFlagTextLayout(prepared.scene, flag.flagType);
  root.add(
    createSignTextPlane(flag.id, "front", textTexture, textLayout, textLayout.frontZ, Math.PI),
    createSignTextPlane(flag.id, "back", textTexture, textLayout, textLayout.backZ, 0),
  );

  const rendered: RenderedFlag = {
    root,
    textTexture,
    cellId: flag.cellId,
    flagType: flag.flagType,
    message: "",
    fontColor: "",
  };
  redrawText(rendered, flag);
  syncRenderedFlag(flag, rendered);
  return rendered;
}

function syncRenderedFlag(flag: PlacedFlagObject, rendered: RenderedFlag): void {
  if (rendered.flagType !== flag.flagType) {
    throw new Error(`Cannot change placed flag runtime type from "${rendered.flagType}" to "${flag.flagType}".`);
  }

  rendered.cellId = flag.cellId;
  applyWorldRigidTransform(rendered.root, flag.localPose);
  if (rendered.message !== flag.message || rendered.fontColor !== flag.fontColor) {
    redrawText(rendered, flag);
  }
}

function redrawText(rendered: RenderedFlag, flag: PlacedFlagObject): void {
  const canvas = rendered.textTexture.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = flag.fontColor;

  const layout = fitTextToCanvas(context, flag.message, canvas.width, canvas.height);
  context.font = `bold ${layout.fontSize}px sans-serif`;
  const blockHeight = layout.lines.length * layout.lineHeight;
  const firstLineY = canvas.height / 2 - blockHeight / 2 + layout.lineHeight / 2;

  for (let index = 0; index < layout.lines.length; index += 1) {
    context.fillText(layout.lines[index], canvas.width / 2, firstLineY + index * layout.lineHeight, canvas.width);
  }

  rendered.message = flag.message;
  rendered.fontColor = flag.fontColor;
  rendered.flagType = flag.flagType;
  rendered.textTexture.needsUpdate = true;
}

function fitTextToCanvas(
  context: CanvasRenderingContext2D,
  message: string,
  maxWidth: number,
  maxHeight: number,
): { readonly lines: readonly string[]; readonly lineHeight: number; readonly fontSize: number } {
  const text = message;
  if (text.length === 0) {
    return {
      lines: [""],
      lineHeight: MAX_TEXT_LINE_HEIGHT,
      fontSize: Math.floor(MAX_TEXT_LINE_HEIGHT * TEXT_LINE_HEIGHT_TO_FONT_SIZE),
    };
  }

  for (let lineHeight = MAX_TEXT_LINE_HEIGHT; lineHeight >= 12; lineHeight -= 1) {
    const fontSize = Math.floor(lineHeight * TEXT_LINE_HEIGHT_TO_FONT_SIZE);
    context.font = `bold ${fontSize}px sans-serif`;
    const lines = wrapTextToWidth(context, text, maxWidth);
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, lineHeight, fontSize };
    }
  }

  const lineHeight = 12;
  const fontSize = Math.floor(lineHeight * TEXT_LINE_HEIGHT_TO_FONT_SIZE);
  context.font = `bold ${fontSize}px sans-serif`;
  return {
    lines: wrapTextToWidth(context, text, maxWidth),
    lineHeight,
    fontSize,
  };
}

function wrapTextToWidth(context: CanvasRenderingContext2D, text: string, maxWidth: number): readonly string[] {
  const lines: string[] = [];

  for (const explicitLine of text.split("\n")) {
    let line = "";
    for (const character of explicitLine) {
      const candidate = `${line}${character}`;
      if (line && measureTextWidth(context, candidate) > maxWidth) {
        lines.push(line);
        line = character.trimStart();
      } else {
        line = candidate;
      }
    }

    if (line || explicitLine.length === 0) {
      lines.push(line);
    }
  }

  return lines.length > 0 ? lines : [""];
}

function measureTextWidth(context: CanvasRenderingContext2D, text: string): number {
  const measurement = context.measureText?.(text);
  return measurement?.width ?? text.length * 16;
}

function disposeRenderedFlag(rendered: RenderedFlag): void {
  rendered.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose();
        }
      } else {
        material.dispose();
      }
    }
  });
  rendered.textTexture.dispose();
}

function createSignTextPlane(
  flagId: string,
  side: "front" | "back",
  texture: THREE.CanvasTexture,
  layout: FlagTextLayout,
  zOffset: number,
  rotationY: number,
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(layout.width, layout.height), material);
  plane.name = `placed-flag-text-plane:${flagId}:${side}`;
  plane.position.set(layout.centerX, layout.centerY, zOffset);
  plane.rotation.y = rotationY;
  plane.renderOrder = 20;
  return plane;
}

function resolveFlagTextLayout(scene: THREE.Object3D, flagType: PlacedFlagObject["flagType"]): FlagTextLayout {
  scene.updateMatrixWorld(true);
  const boardBox = findReadableBoardBox(scene);

  if (!boardBox) {
    return FALLBACK_TEXT_LAYOUT;
  }

  const center = boardBox.getCenter(new THREE.Vector3());
  const size = boardBox.getSize(new THREE.Vector3());
  const halfDepth = size.z / 2;
  const calibration = writableAreaCalibrations[flagType];

  return {
    centerX: center.x + size.x * calibration.xOffset,
    centerY: center.y + size.y * calibration.yOffset,
    frontZ: center.z - halfDepth - calibration.zOffset,
    backZ: center.z + halfDepth + calibration.zOffset,
    width: Math.max(size.x * calibration.xScale, 0.2),
    height: Math.max(size.y * calibration.yScale, 0.16),
  };
}

function findReadableBoardBox(scene: THREE.Object3D): THREE.Box3 | undefined {
  let best: { readonly box: THREE.Box3; readonly score: number } | undefined;

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) {
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    if (size.x < 0.35 || size.y < 0.22 || size.z > Math.max(size.x, size.y) * 0.4) {
      return;
    }

    const area = size.x * size.y;
    const squareness = Math.min(size.x, size.y) / Math.max(size.x, size.y);
    const flatness = Math.max(size.x, size.y) / Math.max(size.z, 0.01);
    const score = area * squareness * flatness;

    if (!best || score > best.score) {
      best = { box, score };
    }
  });

  return best?.box;
}

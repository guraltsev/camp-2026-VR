import * as THREE from "three";
import type { PlacedFlagObject } from "../../world-objects/placedFlags";
import { placedFlagAssetPaths } from "../../world-objects/placedFlags";
import type { RuntimeObjectRegistry } from "../../world-objects/runtimeObjectRegistry";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { applyWorldRigidTransform } from "./worldAxes";

export interface PlacedFlagRenderer {
  sync(): void;
  dispose(): void;
}

interface RenderedFlag {
  readonly root: THREE.Group;
  readonly textTexture: THREE.CanvasTexture;
  readonly textMaterial: THREE.MeshBasicMaterial;
  readonly textGeometry: THREE.PlaneGeometry;
  cellId: string;
  flagType: PlacedFlagObject["flagType"];
  message: string;
  fontColor: string;
}

export function createPlacedFlagRenderer(options: {
  readonly registry: RuntimeObjectRegistry;
  readonly assets: PreparedWorldAssets;
  readonly cellRoots: ReadonlyMap<string, THREE.Object3D>;
}): PlacedFlagRenderer {
  const renderedById = new Map<string, RenderedFlag>();

  function createRenderedFlag(flag: PlacedFlagObject): RenderedFlag {
    const root = new THREE.Group();
    root.name = `placed-flag:${flag.id}`;

    const prepared = options.assets.instantiateGltf(placedFlagAssetPaths[flag.flagType]);
    if (!prepared) {
      throw new Error(`Placed flag asset was not preloaded: ${placedFlagAssetPaths[flag.flagType]}`);
    }

    prepared.scene.name = `asset:${flag.id}`;
    prepared.scene.scale.setScalar(0.75);
    prepared.scene.rotation.y = Math.PI;
    root.add(prepared.scene);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const textTexture = new THREE.CanvasTexture(canvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.name = `placed-flag-text:${flag.id}`;
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const textGeometry = new THREE.PlaneGeometry(0.72, 0.27);
    const textPlane = new THREE.Mesh(textGeometry, textMaterial);
    textPlane.name = `placed-flag-text-plane:${flag.id}`;
    textPlane.position.set(0, -0.095, 0.78);
    textPlane.rotation.x = Math.PI / 2;
    root.add(textPlane);

    const rendered: RenderedFlag = {
      root,
      textTexture,
      textMaterial,
      textGeometry,
      cellId: flag.cellId,
      flagType: flag.flagType,
      message: "",
      fontColor: "",
    };
    redrawText(rendered, flag);
    return rendered;
  }

  function syncRenderedFlag(flag: PlacedFlagObject, rendered: RenderedFlag): void {
    if (rendered.flagType !== flag.flagType) {
      rendered.root.removeFromParent();
      disposeRenderedFlag(rendered);
      renderedById.set(flag.id, createRenderedFlag(flag));
      syncRenderedFlag(flag, renderedById.get(flag.id)!);
      return;
    }

    const parent = options.cellRoots.get(flag.cellId);
    if (parent && rendered.root.parent !== parent) {
      parent.add(rendered.root);
    }

    rendered.cellId = flag.cellId;
    applyWorldRigidTransform(rendered.root, flag.localPose);
    if (rendered.message !== flag.message || rendered.fontColor !== flag.fontColor) {
      redrawText(rendered, flag);
    }
  }

  return {
    sync() {
      const flags = options.registry.getAll().filter((object): object is PlacedFlagObject => object.kind === "placed-flag");
      const liveIds = new Set(flags.map((flag) => flag.id));

      for (const [id, rendered] of [...renderedById]) {
        if (!liveIds.has(id)) {
          rendered.root.removeFromParent();
          disposeRenderedFlag(rendered);
          renderedById.delete(id);
        }
      }

      for (const flag of flags) {
        let rendered = renderedById.get(flag.id);
        if (!rendered) {
          rendered = createRenderedFlag(flag);
          renderedById.set(flag.id, rendered);
        }
        syncRenderedFlag(flag, rendered);
      }
    },
    dispose() {
      for (const rendered of renderedById.values()) {
        rendered.root.removeFromParent();
        disposeRenderedFlag(rendered);
      }
      renderedById.clear();
    },
  };
}

function redrawText(rendered: RenderedFlag, flag: PlacedFlagObject): void {
  const canvas = rendered.textTexture.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "bold 72px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = flag.fontColor;
  context.fillText(flag.message, canvas.width / 2, canvas.height / 2, canvas.width - 32);
  rendered.message = flag.message;
  rendered.fontColor = flag.fontColor;
  rendered.flagType = flag.flagType;
  rendered.textTexture.needsUpdate = true;
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

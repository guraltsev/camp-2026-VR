import * as THREE from "three";
import {
  formatMeasuredGeodesicLengthLabel,
  type MeasuredGeodesicLengthObject,
} from "../../world-objects/measureLengthTool";
import { applyWorldRigidTransform } from "./worldAxes";

export interface MeasuredGeodesicLengthRuntime {
  readonly root: THREE.Object3D;
  readonly objectId: string;
  readonly cellId: string;
  syncFromObject(object: MeasuredGeodesicLengthObject): void;
  dispose(): void;
}

const labelHeightMeters = 0.22;
const labelRenderOrder = 57;

export function createMeasuredGeodesicLengthRuntime(
  object: MeasuredGeodesicLengthObject,
): MeasuredGeodesicLengthRuntime {
  let root = createMeasuredGeodesicLengthRoot(object);
  let cellId = object.cellId;

  return {
    get root() {
      return root;
    },
    objectId: object.id,
    get cellId() {
      return cellId;
    },
    syncFromObject(nextObject) {
      if (nextObject.id !== object.id) {
        throw new Error(`Cannot sync measured geodesic length runtime "${object.id}" from "${nextObject.id}".`);
      }

      const parent = root.parent;
      const nextRoot = createMeasuredGeodesicLengthRoot(nextObject);
      if (parent) {
        parent.remove(root);
        parent.add(nextRoot);
      }
      disposeObject3D(root);
      root = nextRoot;
      cellId = nextObject.cellId;
    },
    dispose() {
      root.removeFromParent();
      disposeObject3D(root);
    },
  };
}

function createMeasuredGeodesicLengthRoot(object: MeasuredGeodesicLengthObject): THREE.Group {
  const root = new THREE.Group();
  root.name = `measured-geodesic-length:${object.id}`;
  root.add(createLengthLabel(object));
  applyWorldRigidTransform(root, object.localPose);
  return root;
}

function createLengthLabel(object: MeasuredGeodesicLengthObject): THREE.Object3D {
  const text = formatMeasuredGeodesicLengthLabel(object, object.lengthMeters);
  if (typeof document === "undefined") {
    return createFallbackLengthTooltip();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) {
    return createFallbackLengthTooltip();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 36, 28, 440, 82, 18);
  context.fillStyle = "rgba(20, 83, 45, 0.94)";
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = "rgba(134, 239, 172, 0.96)";
  context.stroke();

  context.beginPath();
  context.moveTo(238, 110);
  context.lineTo(256, 134);
  context.lineTo(274, 110);
  context.closePath();
  context.fillStyle = "rgba(20, 83, 45, 0.94)";
  context.fill();
  context.strokeStyle = "rgba(134, 239, 172, 0.96)";
  context.stroke();

  context.font = "bold 40px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(2, 6, 23, 0.78)";
  context.fillStyle = "#ffffff";
  context.strokeText(text, canvas.width / 2, 70, 410);
  context.fillText(text, canvas.width / 2, 70, 410);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return createPositionedDoubleFacedTooltipBadge(material);
}

function createFallbackLengthTooltip(): THREE.Object3D {
  return createPositionedDoubleFacedTooltipBadge(new THREE.MeshBasicMaterial({
    color: 0x14532d,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    side: THREE.FrontSide,
  }));
}

function createPositionedDoubleFacedTooltipBadge(material: THREE.MeshBasicMaterial): THREE.Group {
  const badge = createDoubleFacedTooltipBadge(material);
  badge.name = "measured-geodesic-length-floating-tooltip";
  badge.position.set(0, labelHeightMeters, 0);
  badge.rotation.y = Math.PI / 2;
  badge.renderOrder = labelRenderOrder;
  return badge;
}

function createDoubleFacedTooltipBadge(material: THREE.MeshBasicMaterial): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(0.5, 0.15625);
  const front = new THREE.Mesh(geometry, material);
  front.name = "measured-geodesic-length-floating-tooltip:front";
  front.position.z = 0.001;
  front.renderOrder = labelRenderOrder;

  const back = new THREE.Mesh(geometry.clone(), cloneTooltipMaterial(material));
  back.name = "measured-geodesic-length-floating-tooltip:back";
  back.position.z = -0.001;
  back.rotation.y = Math.PI;
  back.renderOrder = labelRenderOrder;

  group.add(front, back);
  return group;
}

function cloneTooltipMaterial(material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
  const clone = material.clone();
  if (material.map) {
    clone.map = material.map.clone();
    clone.map.needsUpdate = true;
  }
  return clone;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      child.geometry?.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }

  if ("map" in material && material.map instanceof THREE.Texture) {
    material.map.dispose();
  }
  material.dispose();
}

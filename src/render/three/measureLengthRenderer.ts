import * as THREE from "three";
import {
  formatMeasuredGeodesicLengthLabel,
  type MeasuredGeodesicLengthObject,
} from "../../world-objects/measureLengthTool";
import { applyWorldRigidTransform } from "./worldAxes";
import { createWorldResultBadge } from "./worldResultBadge";

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
  const badge = createWorldResultBadge({
    text,
    variant: "length",
    widthMeters: 0.5,
    heightMeters: 0.15625,
    pointer: "down",
    doubleFaced: true,
    renderOrder: labelRenderOrder,
  });
  badge.name = "measured-geodesic-length-floating-tooltip";
  badge.children[0].name = "measured-geodesic-length-floating-tooltip:front";
  badge.children[1].name = "measured-geodesic-length-floating-tooltip:back";
  badge.position.set(0, labelHeightMeters, 0);
  badge.rotation.y = Math.PI / 2;
  badge.renderOrder = labelRenderOrder;
  return badge;
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

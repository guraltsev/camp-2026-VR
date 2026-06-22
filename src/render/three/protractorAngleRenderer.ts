import * as THREE from "three";
import {
  formatProtractorAngleLabel,
  protractorAngleLabelBadgeHeightMeters,
  protractorAngleLabelBadgeWidthMeters,
  protractorAngleLabelVerticalOffsetMeters,
  type ProtractorAngleObject,
} from "../../world-objects/protractorTool";
import { applyWorldRigidTransform } from "./worldAxes";
import { createWorldResultBadge } from "./worldResultBadge";

export interface ProtractorAngleRuntime {
  readonly root: THREE.Object3D;
  readonly objectId: string;
  readonly cellId: string;
  syncFromObject(object: ProtractorAngleObject): void;
  dispose(): void;
}

const arcColor = 0xffd166;
const fillColor = 0x38f2ff;
const boundaryColor = 0xffffff;
const arcTubeRadiusMeters = 0.008;

export function createProtractorAngleRuntime(object: ProtractorAngleObject): ProtractorAngleRuntime {
  let root = createProtractorAngleRoot(object);
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
        throw new Error(`Cannot sync protractor angle runtime "${object.id}" from "${nextObject.id}".`);
      }

      const parent = root.parent;
      const nextRoot = createProtractorAngleRoot(nextObject);
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

function createProtractorAngleRoot(object: ProtractorAngleObject): THREE.Group {
  const root = new THREE.Group();
  root.name = `protractor-angle:${object.id}`;
  root.add(
    createAngleFill(object),
    createArcLine(object),
    createBoundaryLine("first", object.radiusMeters),
    createBoundaryLine("second", object.radiusMeters, object.angleRadians),
    createAngleLabel(object),
  );
  applyWorldRigidTransform(root, object.localPose);
  return root;
}

function createAngleFill(object: ProtractorAngleObject): THREE.Mesh {
  const segments = resolveSegmentCount(object.angleRadians);
  const positions: number[] = [0, 0.002, 0];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = object.angleRadians * index / segments;
    positions.push(
      Math.cos(theta) * object.radiusMeters,
      0.002,
      -Math.sin(theta) * object.radiusMeters,
    );
    if (index > 0) {
      indices.push(0, index, index + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: fillColor,
    opacity: 0.18,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "protractor-angle-fill";
  mesh.renderOrder = 50;
  return mesh;
}

function createArcLine(object: ProtractorAngleObject): THREE.Mesh {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  curve.add(new AngleArcCurve(object.radiusMeters, object.angleRadians));
  const geometry = new THREE.TubeGeometry(curve, resolveSegmentCount(object.angleRadians), arcTubeRadiusMeters, 8, false);
  const material = new THREE.MeshBasicMaterial({
    color: arcColor,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "protractor-angle-arc";
  mesh.renderOrder = 51;
  return mesh;
}

function createBoundaryLine(name: string, radiusMeters: number, yawRadians = 0): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.006, 0.006, radiusMeters, 8);
  const material = new THREE.MeshBasicMaterial({
    color: boundaryColor,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `protractor-angle-boundary:${name}`;
  mesh.position.set(
    Math.cos(yawRadians) * radiusMeters / 2,
    0.006,
    -Math.sin(yawRadians) * radiusMeters / 2,
  );
  mesh.rotation.z = Math.PI / 2;
  mesh.rotation.y = yawRadians;
  mesh.renderOrder = 52;
  return mesh;
}

function createAngleLabel(object: ProtractorAngleObject): THREE.Object3D {
  const label = formatProtractorAngleLabel(object.first, object.second, object.angleDegrees);
  const badge = createWorldResultBadge({
    text: label,
    variant: "angle",
    widthMeters: protractorAngleLabelBadgeWidthMeters,
    heightMeters: protractorAngleLabelBadgeHeightMeters,
    pointer: "down",
    doubleFaced: true,
    renderOrder: 57,
  });
  badge.name = "protractor-angle-floating-tooltip";
  badge.children[0].name = "protractor-angle-floating-tooltip:front";
  badge.children[1].name = "protractor-angle-floating-tooltip:back";
  positionAngleLabelBadge(badge, object);
  badge.renderOrder = 57;
  return badge;
}

function positionAngleLabelBadge(badge: THREE.Object3D, object: ProtractorAngleObject): void {
  const labelAngle = object.angleRadians / 2;
  badge.position.set(
    Math.cos(labelAngle) * object.radiusMeters,
    protractorAngleLabelVerticalOffsetMeters,
    -Math.sin(labelAngle) * object.radiusMeters,
  );
  badge.rotation.y = labelAngle + Math.PI / 2;
}

class AngleArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly radiusMeters: number,
    private readonly angleRadians: number,
  ) {
    super();
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const theta = this.angleRadians * t;
    return optionalTarget.set(
      Math.cos(theta) * this.radiusMeters,
      0.01,
      -Math.sin(theta) * this.radiusMeters,
    );
  }
}

function resolveSegmentCount(angleRadians: number): number {
  return Math.max(8, Math.ceil(angleRadians / (Math.PI / 36)));
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

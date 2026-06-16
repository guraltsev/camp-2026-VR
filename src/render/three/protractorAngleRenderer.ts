import * as THREE from "three";
import type { ProtractorAngleObject } from "../../world-objects/protractorTool";
import { applyWorldRigidTransform } from "./worldAxes";

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
  const label = `${formatDegrees(object.angleDegrees)} deg`;
  if (typeof document === "undefined") {
    return new THREE.Group();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Group();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "bold 42px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(0, 0, 0, 0.78)";
  context.fillStyle = "#ffffff";
  context.strokeText(label, canvas.width / 2, canvas.height / 2);
  context.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const labelAngle = object.angleRadians / 2;
  sprite.name = "protractor-angle-label";
  sprite.position.set(
    Math.cos(labelAngle) * object.radiusMeters * 0.72,
    0.11,
    -Math.sin(labelAngle) * object.radiusMeters * 0.72,
  );
  sprite.scale.set(0.22, 0.0825, 1);
  sprite.renderOrder = 53;
  return sprite;
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

function formatDegrees(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

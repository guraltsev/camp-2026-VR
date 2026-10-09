/** Floating text labels shown next to geodesic emitters. */
import * as THREE from "three";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import { type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { roundRect } from "./canvasDrawing";
import { geodesicRayEmitterPosition } from "./geodesicCannonRenderer";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export const geodesicEmitterLabelRangeMeters = 3;
export const geodesicEmitterLabelRenderOrder = 940;
export const geodesicEmitterLabelLocalForwardOffsetMeters = 0.12;
export const geodesicEmitterLabelLocalYOffsetMeters = 0.03;

export function getGeodesicEmitterLabelKey(cannonId: string, geodesicId: string): string {
  return `${cannonId}:${geodesicId}`;
}

export function resolveGeodesicEmitterLabelPosition(
  cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  geodesicId: string,
): THREE.Vector3 {
  const yawRadians = cannon.geodesicEmitterYawRadiansById?.[geodesicId] ?? cannon.aimYawRadians;
  const emitterMatrix = rigidTransformToThreeMatrix(yawRigidTransform3(yawRadians, cannon.localPose.translation));
  return new THREE.Vector3(
    geodesicRayEmitterPosition.x + geodesicEmitterLabelLocalForwardOffsetMeters,
    geodesicRayEmitterPosition.y + geodesicEmitterLabelLocalYOffsetMeters,
    geodesicRayEmitterPosition.z,
  ).applyMatrix4(emitterMatrix);
}

export function createGeodesicEmitterLabel(text: string): THREE.Object3D {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create geodesic emitter label canvas context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 17, 20, 0.72)";
  roundRect(context, 138, 34, canvas.width - 276, 60, 15);
  context.fill();
  context.strokeStyle = "rgba(226, 232, 240, 0.58)";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.font = "bold 38px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 300);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), material);
  mesh.renderOrder = geodesicEmitterLabelRenderOrder;
  mesh.visible = false;
  return mesh;
}

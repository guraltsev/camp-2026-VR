/** Floating tooltip mesh shown above the object a VR controller points at. */
import * as THREE from "three";
import { roundRect } from "./canvasDrawing";

export const xrObjectTooltipRenderOrder = 960;
export const xrObjectTooltipYOffsetMeters = 0.18;

export function createXrObjectTooltip(text: string): THREE.Object3D {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create XR object tooltip canvas context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 17, 20, 0.9)";
  roundRect(context, 42, 34, canvas.width - 84, canvas.height - 68, 18);
  context.fill();
  context.strokeStyle = "rgba(226, 232, 240, 0.66)";
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = text.split("\n").slice(0, 3);
  const fontSize = lines.length > 2 ? 44 : 50;
  const lineHeight = fontSize * 1.18;
  const firstLineY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  context.font = `bold ${fontSize}px system-ui, sans-serif`;
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, firstLineY + index * lineHeight, canvas.width - 120);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.31), material);
  mesh.name = "xr-object-tooltip:billboard";
  mesh.renderOrder = xrObjectTooltipRenderOrder;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

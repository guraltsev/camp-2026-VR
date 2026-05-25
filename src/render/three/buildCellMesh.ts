import * as THREE from "three";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import { buildDecorationMesh } from "./buildDecorationMesh";
import { isGeodesciMarmotObjectSpec } from "../../world-objects/geodesciMarmot";

export interface BuildCellMeshOptions {
  readonly debugLevel: number;
  readonly eyeHeightMeters: number;
  readonly cellSideCounts: ReadonlyMap<string, number>;
}

export function buildCellMesh(cell: CompiledPrismCell, options: BuildCellMeshOptions): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `cell:${cell.id}`;

  group.add(buildFloorMesh(cell));
  group.add(buildFloorOutline(cell));

  if (options.debugLevel > 50) {
    group.add(buildPortalDebugPanels(cell, options));
  }

  for (const objectSpec of cell.objects) {
    if (isGeodesciMarmotObjectSpec(objectSpec)) {
      continue;
    }

    group.add(buildDecorationMesh(objectSpec));
  }

  return group;
}

function buildFloorMesh(cell: CompiledPrismCell): THREE.Object3D {
  const shape = new THREE.Shape();
  const first = cell.baseVertices[0];

  shape.moveTo(first.x, first.z);

  for (const vertex of cell.baseVertices.slice(1)) {
    shape.lineTo(vertex.x, vertex.z);
  }

  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cell.floorColor),
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const floor = new THREE.Mesh(geometry, material);
  floor.name = `floor:${cell.id}`;
  return floor;
}

function buildFloorOutline(cell: CompiledPrismCell): THREE.Object3D {
  const points = cell.baseVertices.map((vertex) => new THREE.Vector3(vertex.x, 0.02, vertex.z));
  points.push(points[0].clone());

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  const outline = new THREE.Line(geometry, material);
  outline.name = `floor-outline:${cell.id}`;
  return outline;
}

function buildPortalDebugPanels(cell: CompiledPrismCell, options: BuildCellMeshOptions): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `portal-debug:${cell.id}`;

  for (const portal of cell.portals) {
    const start = cell.baseVertices[portal.sideIndex];
    const end = cell.baseVertices[(portal.sideIndex + 1) % cell.baseVertices.length];

    if (!start || !end) {
      continue;
    }

    const edge = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
    const edgeLength = edge.length();
    const inward = new THREE.Vector3(-(end.z - start.z), 0, end.x - start.x).normalize();
    const position = new THREE.Vector3((start.x + end.x) / 2, options.eyeHeightMeters, (start.z + end.z) / 2);
    position.addScaledVector(inward, 0.04);

    const panelWidth = Math.min(edgeLength * 0.75, 6);
    const panelHeight = 1.1;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshBasicMaterial({
        color: 0x101820,
        opacity: 0.78,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    panel.position.copy(position);
    panel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
    panel.name = `portal-debug-panel:${cell.id}:${portal.id}`;

    const targetSideCount = options.cellSideCounts.get(portal.targetCellId) ?? 0;
    const label = buildTextPlane(
      `${portal.targetCellId}\nside ${formatReversedSideLabel(portal.targetPortalId, targetSideCount)}`,
      panelWidth * 0.9,
      panelHeight * 0.72,
    );
    label.position.copy(position);
    label.position.addScaledVector(inward, 0.02);
    label.quaternion.copy(panel.quaternion);
    label.name = `portal-debug-label:${cell.id}:${portal.id}`;

    group.add(panel);
    group.add(label);
  }

  return group;
}

function buildTextPlane(text: string, widthMeters: number, heightMeters: number): THREE.Object3D {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create text canvas context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "bold 96px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = text.split("\n");
  const lineHeight = 116;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  for (const [index, line] of lines.entries()) {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthMeters, heightMeters), material);
  return mesh;
}

function formatReversedSideLabel(portalId: string, targetSideCount: number): string {
  const match = /(?:side|edge)-(\d+)$/.exec(portalId);

  if (!match) {
    return portalId;
  }

  const sideIndex = Number.parseInt(match[1], 10);
  const nextIndex = targetSideCount > 0 ? (sideIndex + 1) % targetSideCount : sideIndex + 1;
  return `(${nextIndex},${sideIndex})`;
}

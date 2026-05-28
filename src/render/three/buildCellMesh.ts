import * as THREE from "three";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import type { DebugLevelId } from "../../glue/debugLevels";
import {
  shouldRenderPortalPlacard,
  shouldRenderPortalText,
  shouldRenderPortalWall,
  type PortalPanelModeId,
} from "../../glue/portalPanelMode";
import { buildDecorationMesh } from "./buildDecorationMesh";
import { buildPortalMesh } from "./buildPortalMesh";
import { isGeodesciMarmotObjectSpec } from "../../world-objects/geodesciMarmot";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { SCENE_BACKGROUND_COLOR } from "./sceneColors";

export interface BuildCellMeshOptions {
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly eyeHeightMeters: number;
  readonly assets: PreparedWorldAssets;
}

export function buildCellMesh(cell: CompiledPrismCell, options: BuildCellMeshOptions): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `cell:${cell.id}`;
  group.userData = {
    kind: "cell",
    cellId: cell.id,
    portalSides: cell.portals.map((portal) => ({
      portalId: portal.id,
      sideIndex: portal.sideIndex,
      targetCellId: portal.targetCellId,
      targetPortalId: portal.targetPortalId,
    })),
  };

  group.add(buildFloorMesh(cell));
  group.add(buildCeilingMesh(cell));
  group.add(buildSideWalls(cell, options.assets, options.debugLevel, options.portalPanelMode));
  group.add(buildFloorOutline(cell));

  if (options.debugLevel !== "off" && shouldRenderPortalText(options.portalPanelMode)) {
    group.add(buildPortalDebugPanels(cell, options));
  }

  for (const objectSpec of cell.objects) {
    if (isGeodesciMarmotObjectSpec(objectSpec)) {
      continue;
    }

    group.add(buildDecorationMesh(cell.id, objectSpec, options.assets));
  }

  return group;
}

function buildFloorMesh(cell: CompiledPrismCell): THREE.Object3D {
  const shape = new THREE.Shape();
  const first = cell.baseVertices[0];

  shape.moveTo(first.x, first.y);

  for (const vertex of cell.baseVertices.slice(1)) {
    shape.lineTo(vertex.x, vertex.y);
  }

  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);

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

function buildCeilingMesh(cell: CompiledPrismCell): THREE.Object3D {
  const shape = new THREE.Shape();
  const first = cell.baseVertices[0];

  shape.moveTo(first.x, first.y);

  for (const vertex of cell.baseVertices.slice(1)) {
    shape.lineTo(vertex.x, vertex.y);
  }

  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);

  const ceiling = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: SCENE_BACKGROUND_COLOR,
      roughness: 0.96,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  ceiling.name = `ceiling:${cell.id}`;
  ceiling.position.y = cell.heightMeters;
  return ceiling;
}

function buildSideWalls(
  cell: CompiledPrismCell,
  assets: PreparedWorldAssets,
  debugLevel: DebugLevelId,
  portalPanelMode: PortalPanelModeId,
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `walls:${cell.id}`;
  const showPortalWall = debugLevel !== "off" && shouldRenderPortalWall(portalPanelMode);

  for (const side of cell.sides) {
    const start = side.start;
    const end = side.end;

    if (side.portal) {
      group.add(
        buildPortalMesh({
          portalId: side.portal.id,
          sideIndex: side.sideIndex,
          start,
          end,
          heightMeters: cell.heightMeters,
          assets,
          showWall: showPortalWall,
        }),
      );
      continue;
    }

    const wall = buildSolidWallMesh(cell.id, side.sideIndex, start, end, cell.heightMeters);
    group.add(wall);
  }

  return group;
}

function buildFloorOutline(cell: CompiledPrismCell): THREE.Object3D {
  const points = cell.baseVertices.map((vertex) => new THREE.Vector3(vertex.x, 0.02, -vertex.y));
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

    const edge = new THREE.Vector3(end.x - start.x, 0, -(end.y - start.y));
    const edgeLength = edge.length();
    const inward = new THREE.Vector3(-(end.y - start.y), 0, -(end.x - start.x)).normalize();
    const position = new THREE.Vector3((start.x + end.x) / 2, options.eyeHeightMeters, -((start.y + end.y) / 2));
    position.addScaledVector(inward, 0.04);

    const panelWidth = Math.min(edgeLength * 0.75, 6);
    const panelHeight = 1.1;
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);

    if (shouldRenderPortalPlacard(options.portalPanelMode)) {
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
      panel.quaternion.copy(rotation);
      panel.name = `portal-debug-panel:${cell.id}:${portal.id}`;
      group.add(panel);
    }

    const label = buildTextPlane(
      `${portal.sideIndex} -> ${portal.targetCellId}, ${formatSideLabel(portal.targetPortalId)}`,
      panelWidth * 0.9,
      panelHeight * 0.72,
    );
    label.position.copy(position);
    label.position.addScaledVector(inward, shouldRenderPortalPlacard(options.portalPanelMode) ? 0.02 : 0.01);
    label.quaternion.copy(rotation);
    label.name = `portal-debug-label:${cell.id}:${portal.id}`;
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

function buildSolidWallMesh(
  cellId: string,
  sideIndex: number,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  heightMeters: number,
): THREE.Mesh {
  const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
  const inward = new THREE.Vector3(-(end.y - start.y), 0, -(end.x - start.x)).normalize();
  const position = new THREE.Vector3((start.x + end.x) / 2, heightMeters / 2, -((start.y + end.y) / 2));
  const geometry = new THREE.PlaneGeometry(edgeLength, heightMeters);
  const material = new THREE.MeshStandardMaterial({
    color: 0x6d7f86,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position).addScaledVector(inward, 0.01);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
  mesh.name = `wall:${cellId}:${sideIndex}`;
  mesh.userData = {
    kind: "solid-wall",
    cellId,
    sideIndex,
  };
  return mesh;
}

function formatSideLabel(portalId: string): string {
  const match = /side-(\d+)$/.exec(portalId);

  if (!match) {
    return portalId;
  }

  return match[1];
}

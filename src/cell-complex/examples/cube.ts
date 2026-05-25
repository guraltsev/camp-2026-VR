import type { CellObjectSpec } from "../specs";
import type { CellComplexSpec } from "../specs";
import type { AuthoredPortalSpec } from "../specs";

const sideMeters = 15;
const heightMeters = 4;
const halfSideMeters = sideMeters / 2;
const squareBase = [
  { x: -halfSideMeters, z: -halfSideMeters },
  { x: halfSideMeters, z: -halfSideMeters },
  { x: halfSideMeters, z: halfSideMeters },
  { x: -halfSideMeters, z: halfSideMeters },
] as const;

export const cube: CellComplexSpec = {
  cells: [
    cubeFace("front", "#d95f5f", "house-low-poly/scene.gltf", 3, [
      ["bottom", 2],
      ["right", 3],
      ["top", 0],
      ["left", 1],
    ]),
    cubeFace("right", "#4f9d69", "clock_low_poly/scene.gltf", 2, [
      ["bottom", 1],
      ["back", 3],
      ["top", 1],
      ["front", 1],
    ]),
    cubeFace("back", "#5f79d9", "low_poly_campfire/scene.gltf", 2, [
      ["bottom", 0],
      ["left", 3],
      ["top", 2],
      ["right", 1],
    ]),
    cubeFace("left", "#d9b44f", "low_poly_tree_wind/scene.gltf", 1, [
      ["bottom", 3],
      ["front", 3],
      ["top", 3],
      ["back", 1],
    ]),
    cubeFace("top", "#8f6ed5", "low_poly_emergency_button/scene.gltf", 2, [
      ["front", 2],
      ["right", 2],
      ["back", 2],
      ["left", 2],
    ]),
    cubeFace("bottom", "#4fb8c7", "low_poly_rocks/scene.gltf", 2, [
      ["back", 0],
      ["right", 0],
      ["front", 0],
      ["left", 0],
    ]),
  ],
};

function cubeFace(
  id: string,
  floorColor: string,
  assetPath: string,
  objectScale: number,
  sideTargets: readonly [
    readonly [targetCellId: string, targetSideIndex: number],
    readonly [targetCellId: string, targetSideIndex: number],
    readonly [targetCellId: string, targetSideIndex: number],
    readonly [targetCellId: string, targetSideIndex: number],
  ],
) {
  return {
    id,
    heightMeters,
    baseVertices: squareBase,
    visuals: {
      floorColor,
      objects: [centerObject(id, assetPath, objectScale, objectPlacement(id))],
    },
    portals: sideTargets.map(([targetCellId, targetSideIndex], sideIndex): AuthoredPortalSpec => ({
      id: sideId(sideIndex),
      sideIndex,
      targetCellId,
      targetPortalId: sideId(targetSideIndex),
    })),
  };
}

function sideId(sideIndex: number): string {
  return `side-${sideIndex}`;
}

function centerObject(
  cellId: string,
  assetPath: string,
  scale: number,
  placement: { readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly yawRadians: number },
): CellObjectSpec {
  return {
    id: `${cellId}-centerpiece`,
    kind: "asset",
    assetPath,
    position: placement.position,
    yawRadians: placement.yawRadians,
    scale,
  };
}

function objectPlacement(cellId: string): {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly yawRadians: number;
} {
  switch (cellId) {
    case "front":
      return { position: { x: -1.2, y: 0, z: 0.6 }, yawRadians: 0.2 };
    case "right":
      return { position: { x: 0.8, y: 0, z: -0.5 }, yawRadians: -0.35 };
    case "back":
      return { position: { x: 0.4, y: 0, z: 0.9 }, yawRadians: 1.15 };
    case "left":
      return { position: { x: -0.9, y: 0, z: 0.7 }, yawRadians: 0.8 };
    case "top":
      return { position: { x: 0.2, y: 0, z: -0.2 }, yawRadians: -0.15 };
    case "bottom":
      return { position: { x: -0.5, y: 0, z: -0.8 }, yawRadians: 0.5 };
    default:
      return { position: { x: 0, y: 0, z: 0 }, yawRadians: 0 };
  }
}

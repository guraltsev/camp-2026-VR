import type { CellObjectSpec, PrismCellSpec } from "../specs";
import type { CellComplexSpec } from "../specs";
import { createGeodesciMarmot } from "../../world-objects/geodesciMarmot";

const triangleSideMeters = 23;
const triangleAltitudeMeters = 20;
const prismHeightMeters = 4;
const halfTriangleSideMeters = triangleSideMeters / 2;
const triangleBase = [
  { x: 0, z: (-2 * triangleAltitudeMeters) / 3 },
  { x: halfTriangleSideMeters, z: triangleAltitudeMeters / 3 },
  { x: -halfTriangleSideMeters, z: triangleAltitudeMeters / 3 },
] as const;

export const tetrahedron: CellComplexSpec = {
  cells: [
    tetraFace("face-a", "#d95f5f", "house-low-poly/scene.gltf", 3, [
      ["face-b", 0],
      ["face-c", 0],
      ["face-d", 0],
    ]),
    tetraFace("face-b", "#4f9d69", "low_poly_campfire/scene.gltf", 2, [
      ["face-a", 0],
      ["face-d", 1],
      ["face-c", 1],
    ]),
    tetraFace("face-c", "#5f79d9", "low_poly_tree_wind/scene.gltf", 1, [
      ["face-a", 1],
      ["face-b", 2],
      ["face-d", 2],
    ]),
    tetraFace("face-d", "#d9b44f", "low_poly_rocks/scene.gltf", 2, [
      ["face-a", 2],
      ["face-b", 1],
      ["face-c", 2],
    ]),
  ],
};

function tetraFace(
  id: string,
  floorColor: string,
  assetPath: string,
  objectScale: number,
  neighbors: readonly [
    readonly [targetCellId: string, targetSideIndex: number],
    readonly [targetCellId: string, targetSideIndex: number],
    readonly [targetCellId: string, targetSideIndex: number],
  ],
): PrismCellSpec {
  return {
    id,
    heightMeters: prismHeightMeters,
    baseVertices: triangleBase,
    visuals: {
      floorColor,
      objects: [
        {
          id: `${id}-centerpiece`,
          kind: "asset",
          assetPath,
          position: { x: 0, y: 0, z: 0 },
          scale: objectScale,
        },
        ...marmotObjects(id),
      ],
    },
    portals: neighbors.map(([neighborId, targetSideIndex], sideIndex) => ({
      id: `edge-${sideIndex}`,
      sideIndex,
      targetCellId: neighborId,
      targetPortalId: `edge-${targetSideIndex}`,
    })),
  };
}

function marmotObjects(cellId: string): readonly CellObjectSpec[] {
  if (cellId !== "face-a") {
    return [];
  }

  return [
    createGeodesciMarmot({
      id: "face-a-geodesci-marmot",
      position: { x: -2.2, y: 0, z: 2.2 },
      scale: 1.05,
      velocity: { x: 1.6, z: -0.7 },
    }),
  ];
}

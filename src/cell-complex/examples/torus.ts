import type { CellComplexSpec } from "../specs";

const roomSizeMeters = 15;
const roomHeightMeters = 4;
const halfSizeMeters = roomSizeMeters / 2;

export const torus: CellComplexSpec = {
  cells: [
    {
      id: "torus-room",
      heightMeters: roomHeightMeters,
      baseVertices: [
        { x: -halfSizeMeters, z: -halfSizeMeters },
        { x: halfSizeMeters, z: -halfSizeMeters },
        { x: halfSizeMeters, z: halfSizeMeters },
        { x: -halfSizeMeters, z: halfSizeMeters },
      ],
      visuals: {
        floorColor: "#4fb8c7",
        objects: [
          {
            id: "torus-center-clock",
            kind: "asset",
            assetPath: "clock_low_poly/scene.gltf",
            position: { x: 0, y: 0, z: 0 },
            scale: 2,
          },
        ],
      },
      portals: [
        {
          id: "south",
          sideIndex: 0,
          targetCellId: "torus-room",
          targetPortalId: "north",
        },
        {
          id: "east",
          sideIndex: 1,
          targetCellId: "torus-room",
          targetPortalId: "west",
        },
        {
          id: "north",
          sideIndex: 2,
          targetCellId: "torus-room",
          targetPortalId: "south",
        },
        {
          id: "west",
          sideIndex: 3,
          targetCellId: "torus-room",
          targetPortalId: "east",
        },
      ],
    },
  ],
};

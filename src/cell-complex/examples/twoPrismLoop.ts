import { identityMat3, type RigidTransform3 } from "../../math/rigidTransform3";
import type { CellComplexSpec } from "../specs";

export const twoPrismLoop: CellComplexSpec = {
  cells: [
    {
      id: "room-a",
      heightMeters: 4,
      baseVertices: [
        { x: -7.5, z: -7.5 },
        { x: 7.5, z: -7.5 },
        { x: 7.5, z: 7.5 },
        { x: -7.5, z: 7.5 },
      ],
      visuals: {
        floorColor: "#d95f5f",
        objects: [
          {
            id: "room-a-house",
            kind: "asset",
            assetPath: "house-low-poly/scene.gltf",
            position: { x: 0, y: 0, z: 0 },
            scale: 3,
          },
        ],
      },
      portals: [
        {
          id: "east",
          sideIndex: 1,
          targetCellId: "room-b",
          targetPortalId: "west",
          transformToTarget: translate({ x: -15, y: 0, z: 0 }),
        },
      ],
    },
    {
      id: "room-b",
      heightMeters: 4,
      baseVertices: [
        { x: -7.5, z: -7.5 },
        { x: 7.5, z: -7.5 },
        { x: 7.5, z: 7.5 },
        { x: -7.5, z: 7.5 },
      ],
      visuals: {
        floorColor: "#5f79d9",
        objects: [
          {
            id: "room-b-clock",
            kind: "asset",
            assetPath: "clock_low_poly/scene.gltf",
            position: { x: 0, y: 0, z: 0 },
            scale: 2,
          },
        ],
      },
      portals: [
        {
          id: "west",
          sideIndex: 3,
          targetCellId: "room-a",
          targetPortalId: "east",
          transformToTarget: translate({ x: 15, y: 0, z: 0 }),
        },
      ],
    },
  ],
};

function translate(translation: { readonly x: number; readonly y: number; readonly z: number }): RigidTransform3 {
  return { rotation: identityMat3, translation };
}

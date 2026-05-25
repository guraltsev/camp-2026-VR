import { identityMat3, type RigidTransform3 } from "../../math/rigidTransform3";
import type { Vec3 } from "../../math/vec3";
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
          transformToTarget: translate({ x: 0, y: 0, z: roomSizeMeters }),
        },
        {
          id: "east",
          sideIndex: 1,
          targetCellId: "torus-room",
          targetPortalId: "west",
          transformToTarget: translate({ x: -roomSizeMeters, y: 0, z: 0 }),
        },
        {
          id: "north",
          sideIndex: 2,
          targetCellId: "torus-room",
          targetPortalId: "south",
          transformToTarget: translate({ x: 0, y: 0, z: -roomSizeMeters }),
        },
        {
          id: "west",
          sideIndex: 3,
          targetCellId: "torus-room",
          targetPortalId: "east",
          transformToTarget: translate({ x: roomSizeMeters, y: 0, z: 0 }),
        },
      ],
    },
  ],
};

function translate(translation: Vec3): RigidTransform3 {
  return { rotation: identityMat3, translation };
}

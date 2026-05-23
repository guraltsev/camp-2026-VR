import { identityRigidTransform3 } from "../../math/rigidTransform3";
import type { CellComplexSpec } from "../specs";

export const twoPrismLoop: CellComplexSpec = {
  cells: [
    {
      id: "room-a",
      heightMeters: 3,
      baseVertices: [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ],
      portals: [
        {
          id: "east",
          sideIndex: 1,
          targetCellId: "room-b",
          targetPortalId: "west",
          transformToTarget: identityRigidTransform3,
        },
      ],
    },
    {
      id: "room-b",
      heightMeters: 3,
      baseVertices: [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ],
      portals: [
        {
          id: "west",
          sideIndex: 3,
          targetCellId: "room-a",
          targetPortalId: "east",
          transformToTarget: identityRigidTransform3,
        },
      ],
    },
  ],
};

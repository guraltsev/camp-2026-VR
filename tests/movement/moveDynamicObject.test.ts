import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { identityMat3, identityRigidTransform3, yawRigidTransform3 } from "../../src/math/rigidTransform3";
import { moveDynamicObject } from "../../src/movement/moveDynamicObject";
import { simpleCollisionBox, type DynamicObjectState } from "../../src/movement/dynamicObject";

const squareRoomBase = [
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
] as const;

describe("moveDynamicObject", () => {
  it("moves generic dynamic objects inside a prism until geometry blocks them", () => {
    const world = compileCellComplex(singleRoom());
    const object = dynamicObject("room", { x: 0, y: 0.5, z: 0 });

    const moved = moveDynamicObject({ world, object, displacement: { x: 0.5, y: 0, z: 0 } });
    expect(moved.blocked).toBe(false);
    expect(moved.object.localPose.translation.x).toBeCloseTo(0.5);

    const blocked = moveDynamicObject({ world, object, displacement: { x: 1, y: 0, z: 0 } });
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockingReason).toBe("wall");
    expect(blocked.object).toBe(object);
  });

  it("blocks floor and ceiling intersections", () => {
    const world = compileCellComplex(singleRoom());
    const object = dynamicObject("room", { x: 0, y: 0.5, z: 0 });

    expect(moveDynamicObject({ world, object, displacement: { x: 0, y: -0.6, z: 0 } }).blockingReason).toBe("floor");
    expect(moveDynamicObject({ world, object, displacement: { x: 0, y: 1.6, z: 0 } }).blockingReason).toBe("ceiling");
  });

  it("crosses centered portals and transforms orientation through the portal mapping", () => {
    const world = compileCellComplex(twoRoomsWithTranslatedPortal());
    const object = dynamicObject("room-a", { x: 0.8, y: 0.5, z: 0 }, yawRigidTransform3(Math.PI / 2).rotation);

    const result = moveDynamicObject({ world, object, displacement: { x: 0.4, y: 0, z: 0 } });

    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(true);
    expect(result.crossedPortalId).toBe("east");
    expect(result.object.cellId).toBe("room-b");
    expect(result.object.localPose.translation.x).toBeCloseTo(-0.8);
    expect(result.object.localPose.rotation.m00).toBeCloseTo(0);
    expect(result.object.localPose.rotation.m02).toBeCloseTo(-1);
  });

  it("rejects movement into invisible collision columns at portal junctions", () => {
    const world = compileCellComplex(twoRoomsWithTranslatedPortal());
    const object = dynamicObject("room-a", { x: 0.65, y: 0.5, z: 0.7 });

    const result = moveDynamicObject({ world, object, displacement: { x: 0.2, y: 0, z: 0.2 } });

    expect(result.blocked).toBe(true);
    expect(result.blockingReason).toBe("forbidden-zone");
  });

  it("defaults SimpleCollisionBox offset to zero and honors explicit offsets", () => {
    const world = compileCellComplex(singleRoom());
    const centered = dynamicObject("room", { x: 0, y: 0.11, z: 0 }, identityMat3, simpleCollisionBox(0.2, 0.2, 0.2));
    const raised = dynamicObject(
      "room",
      { x: 0, y: 0.01, z: 0 },
      identityMat3,
      simpleCollisionBox(0.2, 0.2, 0.2, { x: 0, y: 0.1, z: 0 }),
    );

    expect(moveDynamicObject({ world, object: centered, displacement: { x: 0, y: -0.02, z: 0 } }).blocked).toBe(true);
    expect(moveDynamicObject({ world, object: raised, displacement: { x: 0, y: 0, z: 0 } }).blocked).toBe(false);
  });
});

function dynamicObject(
  cellId: string,
  translation: { readonly x: number; readonly y: number; readonly z: number },
  rotation = identityMat3,
  collision = simpleCollisionBox(0.2, 1, 0.2),
): DynamicObjectState {
  return {
    cellId,
    localPose: { rotation, translation },
    collision,
  };
}

function singleRoom(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 2,
        baseVertices: squareRoomBase,
        portals: [],
      },
    ],
  };
}

function twoRoomsWithTranslatedPortal(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room-a",
        heightMeters: 2,
        baseVertices: squareRoomBase,
        portals: [
          {
            id: "east",
            sideIndex: 1,
            targetCellId: "room-b",
            targetPortalId: "west",
            transformToTarget: {
              rotation: {
                m00: -1,
                m01: 0,
                m02: 0,
                m10: 0,
                m11: 1,
                m12: 0,
                m20: 0,
                m21: 0,
                m22: -1,
              },
              translation: { x: 0.4, y: 0, z: 0 },
            },
          },
        ],
      },
      {
        id: "room-b",
        heightMeters: 2,
        baseVertices: squareRoomBase,
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
}

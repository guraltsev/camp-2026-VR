import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import type { CompiledCellComplex } from "../../src/cell-complex/compileCellComplex";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { identityMat3, yawRigidTransform3 } from "../../src/math/rigidTransform3";
import { cube, tetrahedron } from "../../src/authoring/exampleWorlds";
import { vec3 } from "../../src/math/vec3";
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
    expect(blocked.object.localPose.translation.x).toBeCloseTo(0.9, 5);
  });

  it("blocks floor and ceiling intersections", () => {
    const world = compileCellComplex(singleRoom());
    const object = dynamicObject("room", { x: 0, y: 0.5, z: 0 });

    expect(moveDynamicObject({ world, object, displacement: { x: 0, y: -0.6, z: 0 } }).blockingReason).toBe("floor");
    expect(moveDynamicObject({ world, object, displacement: { x: 0, y: 1.6, z: 0 } }).blockingReason).toBe("ceiling");
  });

  it("crosses centered portals and transforms orientation through the portal mapping", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const object = dynamicObject("room-a", { x: 0.8, y: 0.5, z: 0 }, yawRigidTransform3(Math.PI / 2).rotation);

    const result = moveDynamicObject({ world, object, displacement: { x: 0.4, y: 0, z: 0 } });

    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(true);
    expect(result.crossedPortalId).toBe("east");
    expect(result.object.cellId).toBe("room-b");
    expect(result.object.localPose.translation.x).toBeCloseTo(-0.8);
    expect(result.object.localPose.rotation.m00).toBeCloseTo(0);
    expect(result.object.localPose.rotation.m02).toBeCloseTo(1);
  });

  it("crosses a portal when body clearance exits the source cell before the anchor point fully does", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const object = dynamicObject("room-a", { x: 0.75, y: 0.5, z: 0 });

    const result = moveDynamicObject({ world, object, displacement: { x: 0.2, y: 0, z: 0 } });

    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(true);
    expect(result.object.cellId).toBe("room-b");
    expect(result.object.localPose.translation.x).toBeCloseTo(-1.05);
  });

  it("resolves blocked non-portal exits back to an in-bounds pose near the wall", () => {
    const world = compileCellComplex(singleRoom());
    const object = dynamicObject("room", { x: -0.8, y: 0.5, z: 0 });

    const result = moveDynamicObject({ world, object, displacement: { x: -0.4, y: 0, z: 0 } });

    expect(result.blocked).toBe(true);
    expect(result.blockingReason).toBe("wall");
    expect(result.crossedPortal).toBe(false);
    expect(result.object).not.toBe(object);
    expect(result.object.localPose.translation.x).toBeCloseTo(-0.9, 5);
  });

  it("rejects movement into invisible collision columns at portal junctions", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
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

  it("crosses a compiled cube portal without authored transforms", () => {
    const world = compileCellComplex(cube);
    const object = dynamicObject("front", { x: 7.2, y: 0.5, z: 0 });

    const result = moveDynamicObject({ world, object, displacement: { x: 0.4, y: 0, z: 0 } });

    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(true);
    expect(result.object.cellId).toBe("right");
    expect(result.object.localPose.translation.x).toBeCloseTo(-7.4);
  });

  it("crosses a compiled tetrahedron portal without authored transforms", () => {
    const world = compileCellComplex(tetrahedron);
    const approach = portalApproach(world, "face-a", "edge-0-1");
    const object = dynamicObject("face-a", approach.start, identityMat3, simpleCollisionBox(0.05, 1, 0.05));

    const result = moveDynamicObject({ world, object, displacement: approach.displacement });

    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(true);
    expect(result.object.cellId).toBe("face-b");
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

function portalApproach(world: CompiledCellComplex, cellId: string, portalId: string) {
  const cell = world.cellsById.get(cellId);
  const portal = cell?.portalsById.get(portalId);

  if (!cell || !portal) {
    throw new Error(`Missing portal approach data for ${cellId}:${portalId}.`);
  }

  const side = cell.sides[portal.sideIndex];
  const midpoint = {
    x: (side.start.x + side.end.x) / 2,
    y: 0.5,
    z: (side.start.z + side.end.z) / 2,
  };
  const inward = vec3(side.inwardNormal.x, 0, side.inwardNormal.z);
  const outward = vec3(-side.inwardNormal.x, 0, -side.inwardNormal.z);

  return {
    start: {
      x: midpoint.x + inward.x * 0.12,
      y: midpoint.y,
      z: midpoint.z + inward.z * 0.12,
    },
    displacement: {
      x: outward.x * 0.3,
      y: 0,
      z: outward.z * 0.3,
    },
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

function twoRoomsWithPortal(): CellComplexSpec {
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
          },
        ],
      },
    ],
  };
}

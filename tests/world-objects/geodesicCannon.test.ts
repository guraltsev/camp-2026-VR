import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { createRuntimeObjectRegistry } from "../../src/world-objects/runtimeObjectRegistry";
import {
  createGeodesicCannonObject,
  extendGeodesic,
  getGeodesicSegmentEnd,
  getGeodesicTail,
  removeGeodesic,
  shootGeodesic,
  traceGeodesicSegment,
} from "../../src/world-objects/geodesicCannon";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";

describe("geodesic cannon world objects", () => {
  it("traces an open one-meter horizontal segment", () => {
    const result = traceGeodesicSegment({
      world: compileWorld(false),
      cellId: "a",
      start: { x: 0.5, y: 0.5, z: 0.32 },
      direction: { x: 1, y: 0, z: 0 },
      maxLengthMeters: 1,
    });

    expect(result.lengthMeters).toBe(1);
    expect(result.terminal).toEqual({ kind: "open" });
  });

  it("shortens a segment at a wall hit", () => {
    const result = traceGeodesicSegment({
      world: compileWorld(false),
      cellId: "a",
      start: { x: 1.5, y: 1, z: 0.32 },
      direction: { x: 1, y: 0, z: 0 },
      maxLengthMeters: 1,
    });

    expect(result.lengthMeters).toBeCloseTo(0.5);
    expect(result.terminal).toEqual({ kind: "wall-hit", sideIndex: 1 });
  });

  it("records portal target data and extends in the target cell", () => {
    const world = compileWorld(true);
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 1.5, y: 1, z: 0 }),
    });
    registry.add(cannon);

    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a", maxLengthMeters: 1 });
    expect(first.segmentIndex).toBe(0);
    expect(first.terminal.kind).toBe("portal-hit");
    if (first.terminal.kind !== "portal-hit") {
      throw new Error("Expected portal-hit terminal.");
    }
    expect(first.terminal.targetCellId).toBe("b");
    expect(first.terminal.targetPortalId).toBe("ba");

    const second = extendGeodesic({ world, registry, geodesicId: "g-a", maxLengthMeters: 1 });
    expect(second?.segmentIndex).toBe(1);
    expect(second?.cellId).toBe("b");
    expect(second?.start).toEqual(first.terminal.targetStart);
  });

  it("extends open tails and refuses wall-hit tails", () => {
    const world = compileWorld(false);
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 0.25, y: 1, z: 0 }),
    });
    registry.add(cannon);

    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a", maxLengthMeters: 0.25 });
    const second = extendGeodesic({ world, registry, geodesicId: "g-a", maxLengthMeters: 0.5 });
    const third = extendGeodesic({ world, registry, geodesicId: "g-a", maxLengthMeters: 1 });

    expect(second?.start).toEqual(getGeodesicSegmentEnd(first));
    expect(second?.terminal.kind).toBe("open");
    expect(third?.terminal.kind).toBe("wall-hit");
    expect(extendGeodesic({ world, registry, geodesicId: "g-a" })).toBeUndefined();
  });

  it("looks up tails and removes segment chains", () => {
    const world = compileWorld(false);
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 0.25, y: 1, z: 0 }),
    });
    registry.add(cannon);
    shootGeodesic({ world, registry, cannon, geodesicId: "g-a", maxLengthMeters: 0.5 });
    extendGeodesic({ world, registry, geodesicId: "g-a", maxLengthMeters: 0.5 });

    expect(getGeodesicTail(registry, "g-a")?.segmentIndex).toBe(1);
    removeGeodesic(registry, "g-a");
    expect(registry.getAll().filter((object) => object.kind === "geodesic-segment")).toHaveLength(0);
    expect(registry.get("cannon-a")?.kind).toBe("geodesic-cannon");
  });

  it("rejects zero directions", () => {
    expect(() =>
      traceGeodesicSegment({
        world: compileWorld(false),
        cellId: "a",
        start: { x: 1, y: 1, z: 0.32 },
        direction: { x: 0, y: 0, z: 0 },
        maxLengthMeters: 1,
      }),
    ).toThrow(/near-zero Vec3/);
  });
});

function compileWorld(withPortal: boolean) {
  return compileCellComplex({
    cells: [
      {
        id: "a",
        heightMeters: 3,
        baseVertices: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        portals: withPortal ? [{ id: "ab", sideIndex: 1, targetCellId: "b", targetPortalId: "ba" }] : [],
      },
      {
        id: "b",
        heightMeters: 3,
        baseVertices: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        portals: withPortal ? [{ id: "ba", sideIndex: 3, targetCellId: "a", targetPortalId: "ab" }] : [],
      },
    ],
  });
}

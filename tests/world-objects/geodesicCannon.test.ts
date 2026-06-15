import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { createRuntimeObjectRegistry } from "../../src/world-objects/runtimeObjectRegistry";
import {
  createGeodesicCannonObject,
  extendGeodesic,
  geodesicRayBeamHeightMeters,
  geodesicRayBeamStartOffsetMeters,
  getGeodesicSegmentEnd,
  getGeodesicSegments,
  getGeodesicTail,
  rebuildGeodesicToLength,
  removeGeodesic,
  resolveGeodesicCannonAimYawRadians,
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

  it("shoots and extends two-meter segments by default", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    registry.add(cannon);

    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a" });
    const second = extendGeodesic({ world, registry, geodesicId: "g-a" });

    expect(cannon.collision).toEqual({
      radius: 0.3,
      height: 1.25,
      offset: { x: 0, y: 0, z: 0.625 },
    });
    expect(cannon.tooltip?.label).toBe("Geodesic emitter");
    expect(cannon.tooltip?.rangeMeters).toBe(2.5);
    expect(cannon.tooltip?.desktopPrompt).toBe("Geodesic emitter\nRMouse / F - menu");
    expect(cannon.tooltip?.xrPrompt).toBe("Geodesic emitter\nA / X - menu");
    expect(first.lengthMeters).toBe(2);
    expect(first.geodesicNumber).toBe(1);
    expect(first.tooltip?.label).toBe("Geodesic G1");
    expect(first.tooltip?.rangeMeters).toBe(6);
    expect(second?.lengthMeters).toBe(2);
    expect(second?.geodesicNumber).toBe(1);
    expect(second?.tooltip?.label).toBe("Geodesic G1");
    expect(second?.tooltip?.rangeMeters).toBe(6);
  });

  it("numbers multiple geodesics from the same emitter pole incrementally", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    registry.add(cannon);

    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a" });
    const updatedCannon = registry.get("cannon-a");
    if (updatedCannon?.kind !== "geodesic-cannon") {
      throw new Error("Expected updated geodesic cannon.");
    }
    const second = shootGeodesic({ world, registry, cannon: updatedCannon, geodesicId: "g-b" });

    expect(first.tooltip?.label).toBe("Geodesic G1");
    expect(second.geodesicNumber).toBe(2);
    expect(second.tooltip?.label).toBe("Geodesic G2");
    expect(second.start.y).toBeCloseTo(0);
    const finalCannon = registry.get("cannon-a");
    expect(finalCannon?.kind === "geodesic-cannon" ? finalCannon.geodesicIds : []).toEqual(["g-a", "g-b"]);
  });

  it("starts the first ray segment at the visual laser emitter", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    registry.add(cannon);

    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a" });

    expect(first.start.x).toBeCloseTo(-1.5 + geodesicRayBeamStartOffsetMeters);
    expect(first.start.y).toBeCloseTo(0);
    expect(first.start.z).toBeCloseTo(geodesicRayBeamHeightMeters);
  });

  it("resolves cannon aim yaw from the local euclidean target direction", () => {
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 1, y: 1, z: 0 }),
    });

    expect(resolveGeodesicCannonAimYawRadians(cannon, { x: 1, y: 4, z: 2 })).toBeCloseTo(Math.PI / 2);
    expect(resolveGeodesicCannonAimYawRadians(cannon, { x: -2, y: 1, z: -1 })).toBeCloseTo(Math.PI);
  });

  it("does not resolve aim yaw at the same horizontal point as the cannon", () => {
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 1, y: 1, z: 0 }),
    });

    expect(resolveGeodesicCannonAimYawRadians(cannon, { x: 1, y: 1, z: 2 })).toBeUndefined();
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

  it("shortens a segment at a forbidden zone hit and refuses to extend it", () => {
    const world = compileWorld(true);
    const directionLength = Math.hypot(1, -1);
    const direction = { x: 1 / directionLength, y: -1 / directionLength, z: 0 };
    const result = traceGeodesicSegment({
      world,
      cellId: "a",
      start: { x: 1, y: 1, z: geodesicRayBeamHeightMeters },
      direction,
      maxLengthMeters: 2,
    });

    expect(result.lengthMeters).toBeCloseTo(Math.SQRT2 - 0.15);
    expect(result.terminal).toEqual({ kind: "forbidden-zone-hit", junctionId: "a:vertex-1" });

    const registry = createRuntimeObjectRegistry();
    registry.add(createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(Math.atan2(direction.y, direction.x), { x: 1, y: 1, z: 0 }),
    }));
    registry.add({
      id: "g-a:segment:0",
      kind: "geodesic-segment",
      cellId: "a",
      localPose: yawRigidTransform3(Math.atan2(direction.y, direction.x), result.start),
      portalRenderable: true,
      geodesicId: "g-a",
      segmentIndex: 0,
      start: result.start,
      direction: result.direction,
      lengthMeters: result.lengthMeters,
      terminal: result.terminal,
    });

    expect(extendGeodesic({ world, registry, geodesicId: "g-a" })).toBeUndefined();
  });

  it("rebuilds rotated geodesics to the remembered total length after moving past a forbidden zone", () => {
    const world = compileLargePortalWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 1, y: 2.5, z: 0 }),
    });
    registry.add(cannon);
    rebuildGeodesicToLength({
      world,
      registry,
      cannon,
      geodesicId: "g-a",
      totalLengthMeters: 4.7,
    });
    const rememberedLength = totalGeodesicLength(registry, "g-a");

    const blockedCannon = createGeodesicCannonObject({
      ...cannon,
      aimYawRadians: Math.atan2(-2.5, 4),
    });
    rebuildGeodesicToLength({
      world,
      registry,
      cannon: blockedCannon,
      geodesicId: "g-a",
      totalLengthMeters: rememberedLength,
    });

    expect(totalGeodesicLength(registry, "g-a")).toBeLessThan(rememberedLength);
    expect(getGeodesicSegments(registry, "g-a").at(-1)?.terminal.kind).toBe("forbidden-zone-hit");

    const clearCannon = createGeodesicCannonObject({
      ...cannon,
      aimYawRadians: 0,
    });
    rebuildGeodesicToLength({
      world,
      registry,
      cannon: clearCannon,
      geodesicId: "g-a",
      totalLengthMeters: rememberedLength,
    });

    expect(totalGeodesicLength(registry, "g-a")).toBeCloseTo(rememberedLength);
  });

  it("rebuilds total length as one segment per crossed cell piece", () => {
    const world = compileLargePortalWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: 4, y: 2.5, z: 0 }),
    });
    registry.add(cannon);

    rebuildGeodesicToLength({
      world,
      registry,
      cannon,
      geodesicId: "g-a",
      totalLengthMeters: 2,
    });

    const segments = getGeodesicSegments(registry, "g-a");
    expect(segments.map((segment) => segment.cellId)).toEqual(["a", "b"]);
    expect(segments[0]?.terminal.kind).toBe("portal-hit");
    expect(segments.at(-1)?.terminal.kind).toBe("open");
    expect(totalGeodesicLength(registry, "g-a")).toBeCloseTo(2);
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
    const updatedCannon = registry.get("cannon-a");
    expect(first.segmentIndex).toBe(0);
    expect(updatedCannon?.kind === "geodesic-cannon" ? updatedCannon.geodesicIds : []).toEqual(["g-a"]);
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

function totalGeodesicLength(registry: ReturnType<typeof createRuntimeObjectRegistry>, geodesicId: string): number {
  return getGeodesicSegments(registry, geodesicId)
    .reduce((total, segment) => total + segment.lengthMeters, 0);
}

function compileLargeWorld() {
  return compileCellComplex({
    cells: [
      {
        id: "a",
        heightMeters: 3,
        baseVertices: [
          { x: -3, y: -3 },
          { x: 3, y: -3 },
          { x: 3, y: 3 },
          { x: -3, y: 3 },
        ],
        portals: [],
      },
    ],
  });
}

function compileLargePortalWorld() {
  return compileCellComplex({
    cells: [
      {
        id: "a",
        heightMeters: 3,
        baseVertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
          { x: 0, y: 5 },
        ],
        portals: [{ id: "ab", sideIndex: 1, targetCellId: "b", targetPortalId: "ba" }],
      },
      {
        id: "b",
        heightMeters: 3,
        baseVertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
          { x: 0, y: 5 },
        ],
        portals: [{ id: "ba", sideIndex: 3, targetCellId: "a", targetPortalId: "ab" }],
      },
    ],
  });
}

import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { createRuntimeObjectRegistry } from "../../src/world-objects/runtimeObjectRegistry";
import {
  createGeodesicCannonObject,
  connectGeodesicToEmitter,
  extendGeodesic,
  geodesicRayBeamHeightMeters,
  geodesicRayBeamStartOffsetMeters,
  getGeodesicConnection,
  getGeodesicSegments,
  getGeodesicTail,
  isGeodesicLocked,
  placeGeodesicCannonOnGeodesic,
  rebuildGeodesicToLength,
  removeGeodesic,
  resolveGeodesicCannonAimYawRadians,
  resolveGeodesicNumber,
  shootGeodesic,
  traceGeodesicSegment,
  updateGeodesicIntersectionObjects,
  type GeodesicSegmentObject,
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

  it("extends same-cell geodesics by lengthening the tail segment", () => {
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
    expect(second?.id).toBe(first.id);
    expect(second?.segmentIndex).toBe(0);
    expect(second?.lengthMeters).toBe(4);
    expect(second?.geodesicNumber).toBe(1);
    expect(second?.tooltip?.label).toBe("Geodesic G1");
    expect(second?.tooltip?.rangeMeters).toBe(6);
    expect(getGeodesicSegments(registry, "g-a")).toHaveLength(1);
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

  it("numbers geodesics globally across emitters", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const firstCannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const secondCannon = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI / 2, { x: 1.5, y: 0, z: 0 }),
    });
    registry.add(firstCannon);
    registry.add(secondCannon);

    const first = shootGeodesic({ world, registry, cannon: firstCannon, geodesicId: "g-a" });
    const second = shootGeodesic({ world, registry, cannon: secondCannon, geodesicId: "g-b" });

    expect(first.geodesicNumber).toBe(1);
    expect(first.tooltip?.label).toBe("Geodesic G1");
    expect(second.geodesicNumber).toBe(2);
    expect(second.tooltip?.label).toBe("Geodesic G2");
    expect(resolveGeodesicNumber(registry, "g-a")).toBe(1);
    expect(resolveGeodesicNumber(registry, "g-b")).toBe(2);
  });

  it("preserves existing global geodesic numbers when lower numbers are absent", () => {
    const registry = createRuntimeObjectRegistry([
      createSegment({
        id: "g-b:segment:0",
        geodesicId: "g-b",
        geodesicNumber: 2,
      }),
    ]);

    expect(resolveGeodesicNumber(registry, "g-b")).toBe(2);
    expect(resolveGeodesicNumber(registry, "g-c")).toBe(1);
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

    expect(second?.id).toBe(first.id);
    expect(second?.segmentIndex).toBe(0);
    expect(second?.start).toEqual(first.start);
    expect(second?.lengthMeters).toBeCloseTo(0.75);
    expect(second?.terminal.kind).toBe("open");
    expect(third?.id).toBe(first.id);
    expect(third?.segmentIndex).toBe(0);
    expect(third?.terminal.kind).toBe("wall-hit");
    expect(getGeodesicSegments(registry, "g-a")).toHaveLength(1);
    expect(extendGeodesic({ world, registry, geodesicId: "g-a" })).toBeUndefined();
  });

  it("places an incoming emitter on a segment, truncates the geodesic, and locks it", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const cannon = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    registry.add(cannon);
    const first = shootGeodesic({ world, registry, cannon, geodesicId: "g-a" });

    const result = placeGeodesicCannonOnGeodesic({
      world,
      registry,
      geodesicId: "g-a",
      segmentId: first.id,
      distanceAlongSegmentMeters: 1,
      aimYawRadians: Math.PI / 2,
      id: "cannon-b",
    });

    expect(result.placed).toBe(true);
    expect(getGeodesicSegments(registry, "g-a")).toHaveLength(1);
    expect(getGeodesicTail(registry, "g-a")).toMatchObject({
      lengthMeters: 1,
      terminal: { kind: "emitter-hit", emitterId: "cannon-b" },
      connectionState: "connected",
    });
    expect(isGeodesicLocked(registry, "g-a")).toBe(true);
    expect(getCannonGeodesicIds(registry, "cannon-b")).toEqual(["g-a"]);
    expect(getCannonGeodesicYaw(registry, "cannon-b", "g-a")).toBeCloseTo(Math.PI);
    expect(extendGeodesic({ world, registry, geodesicId: "g-a" })).toBeUndefined();
  });

  it("connects immediately when an aimed geodesic reaches an emitter", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const source = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const incoming = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI, { x: 1, y: 0, z: 0 }),
    });
    registry.add(source);
    registry.add(incoming);

    const first = shootGeodesic({ world, registry, cannon: source, geodesicId: "g-a", maxLengthMeters: 4 });

    expect(first.lengthMeters).toBeCloseTo(2.3);
    expect(first.terminal).toEqual({ kind: "emitter-hit", emitterId: "cannon-b" });
    expect(getGeodesicConnection(registry, "g-a")).toEqual({
      outgoingEmitterId: "cannon-a",
      incomingEmitterId: "cannon-b",
      state: "connected",
    });
    expect(getCannonGeodesicIds(registry, "cannon-b")).toEqual(["g-a"]);
    expect(getCannonGeodesicYaw(registry, "cannon-b", "g-a")).toBeCloseTo(Math.PI);
  });

  it("does not connect to emitters during preview rebuilds", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const source = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const incoming = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI, { x: 1, y: 0.05, z: 0 }),
    });
    registry.add(source);
    registry.add(incoming);

    rebuildGeodesicToLength({
      world,
      registry,
      cannon: source,
      geodesicId: "g-a",
      totalLengthMeters: 4,
      connectEmitters: false,
    });

    expect(getGeodesicTail(registry, "g-a")?.terminal.kind).toBe("open");
    expect(getGeodesicTail(registry, "g-a")?.lengthMeters).toBeCloseTo(4);
    expect(isGeodesicLocked(registry, "g-a")).toBe(false);
    expect(getGeodesicConnection(registry, "g-a")).toEqual({
      outgoingEmitterId: "cannon-a",
      state: "open",
    });
  });

  it("snaps final rebuild yaw to a passed emitter and connects precisely", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const source = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const incoming = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI, { x: 1, y: 0.05, z: 0 }),
    });
    registry.add(source);
    registry.add(incoming);

    rebuildGeodesicToLength({
      world,
      registry,
      cannon: source,
      geodesicId: "g-a",
      totalLengthMeters: 4,
      snapToEmitter: true,
    });

    const snappedYaw = Math.atan2(0.05, 2.5);
    expect(getGeodesicTail(registry, "g-a")?.terminal).toEqual({ kind: "emitter-hit", emitterId: "cannon-b" });
    expect(getCannonGeodesicYaw(registry, "cannon-a", "g-a")).toBeCloseTo(snappedYaw);
    expect(isGeodesicLocked(registry, "g-a")).toBe(true);
  });

  it("does not connect until extension reaches the target emitter", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const source = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const incoming = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI, { x: 1, y: 0, z: 0 }),
    });
    registry.add(source);
    registry.add(incoming);

    const first = shootGeodesic({ world, registry, cannon: source, geodesicId: "g-a", maxLengthMeters: 1 });
    const second = extendGeodesic({ world, registry, geodesicId: "g-a", maxLengthMeters: 3 });

    expect(first.terminal.kind).toBe("open");
    expect(second?.terminal).toEqual({ kind: "emitter-hit", emitterId: "cannon-b" });
    expect(isGeodesicLocked(registry, "g-a")).toBe(true);
  });

  it("deleting a connected geodesic removes association from both emitters", () => {
    const world = compileLargeWorld();
    const registry = createRuntimeObjectRegistry();
    const source = createGeodesicCannonObject({
      id: "cannon-a",
      cellId: "a",
      activeGeodesicId: "g-a",
      geodesicIds: ["g-a"],
      geodesicEmitterYawRadiansById: { "g-a": 0 },
      localPose: yawRigidTransform3(0, { x: -1.5, y: 0, z: 0 }),
    });
    const incoming = createGeodesicCannonObject({
      id: "cannon-b",
      cellId: "a",
      localPose: yawRigidTransform3(Math.PI, { x: 1, y: 0, z: 0 }),
    });
    registry.add(source);
    registry.add(incoming);
    connectGeodesicToEmitter({
      world,
      registry,
      geodesicId: "g-a",
      incomingEmitterId: "cannon-b",
      totalLengthMeters: 2.3,
    });

    removeGeodesic(registry, "g-a");

    expect(getGeodesicSegments(registry, "g-a")).toHaveLength(0);
    expect(getCannonGeodesicIds(registry, "cannon-a")).toEqual([]);
    expect(getCannonGeodesicIds(registry, "cannon-b")).toEqual([]);
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

    expect(getGeodesicTail(registry, "g-a")?.segmentIndex).toBe(0);
    expect(getGeodesicSegments(registry, "g-a")).toHaveLength(1);
    removeGeodesic(registry, "g-a");
    expect(registry.getAll().filter((object) => object.kind === "geodesic-segment")).toHaveLength(0);
    expect(registry.get("cannon-a")?.kind).toBe("geodesic-cannon");
  });

  it("creates a vertex balloon where two geodesics intersect outside an emitter", () => {
    const registry = createRuntimeObjectRegistry([
      createSegment({
        id: "g-a:segment:0",
        geodesicId: "g-a",
        start: { x: 0, y: 1, z: geodesicRayBeamHeightMeters },
        direction: { x: 1, y: 0, z: 0 },
        lengthMeters: 2,
      }),
      createSegment({
        id: "g-b:segment:0",
        geodesicId: "g-b",
        start: { x: 1, y: 0, z: geodesicRayBeamHeightMeters },
        direction: { x: 0, y: 1, z: 0 },
        lengthMeters: 2,
      }),
    ]);

    const [vertex] = updateGeodesicIntersectionObjects(registry);

    expect(vertex).toMatchObject({
      kind: "geodesic-intersection",
      cellId: "a",
      tooltip: { label: "vertex", rangeMeters: 3 },
      geodesicIds: ["g-a", "g-b"],
      segmentIds: ["g-a:segment:0", "g-b:segment:0"],
    });
    expect(vertex.localPose.translation).toEqual({ x: 1, y: 1, z: geodesicRayBeamHeightMeters + 0.25 });
    expect(vertex.aimStickyTarget?.localPoint).toEqual({ x: 1, y: 1, z: geodesicRayBeamHeightMeters });
    expect(registry.getAll().filter((object) => object.kind === "geodesic-intersection")).toHaveLength(1);
  });

  it("creates a vertex balloon at an emitter when geodesics intersect there", () => {
    const registry = createRuntimeObjectRegistry([
      createGeodesicCannonObject({
        id: "cannon-a",
        cellId: "a",
        localPose: yawRigidTransform3(0, { x: 1, y: 1, z: 0 }),
      }),
      createSegment({
        id: "g-a:segment:0",
        geodesicId: "g-a",
        start: { x: 0, y: 1, z: geodesicRayBeamHeightMeters },
        direction: { x: 1, y: 0, z: 0 },
        lengthMeters: 2,
      }),
      createSegment({
        id: "g-b:segment:0",
        geodesicId: "g-b",
        start: { x: 1, y: 0, z: geodesicRayBeamHeightMeters },
        direction: { x: 0, y: 1, z: 0 },
        lengthMeters: 2,
      }),
    ]);

    const [vertex] = updateGeodesicIntersectionObjects(registry);

    expect(vertex).toMatchObject({
      kind: "geodesic-intersection",
      cellId: "a",
      geodesicIds: ["g-a", "g-b"],
      segmentIds: ["g-a:segment:0", "g-b:segment:0"],
    });
    expect(vertex.localPose.translation).toEqual({ x: 1, y: 1, z: geodesicRayBeamHeightMeters + 0.25 });
    expect(registry.getAll().filter((object) => object.kind === "geodesic-intersection")).toHaveLength(1);
  });

  it("removes stale vertex balloons when a geodesic is removed", () => {
    const registry = createRuntimeObjectRegistry([
      createSegment({
        id: "g-a:segment:0",
        geodesicId: "g-a",
        start: { x: 0, y: 1, z: geodesicRayBeamHeightMeters },
        direction: { x: 1, y: 0, z: 0 },
        lengthMeters: 2,
      }),
      createSegment({
        id: "g-b:segment:0",
        geodesicId: "g-b",
        start: { x: 1, y: 0, z: geodesicRayBeamHeightMeters },
        direction: { x: 0, y: 1, z: 0 },
        lengthMeters: 2,
      }),
    ]);
    updateGeodesicIntersectionObjects(registry);

    removeGeodesic(registry, "g-a");

    expect(registry.getAll().filter((object) => object.kind === "geodesic-intersection")).toHaveLength(0);
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

function createSegment(overrides: Partial<GeodesicSegmentObject> = {}): GeodesicSegmentObject {
  return {
    id: "g-a:segment:0",
    kind: "geodesic-segment",
    cellId: "a",
    localPose: yawRigidTransform3(0, { x: 0, y: 0, z: geodesicRayBeamHeightMeters }),
    portalRenderable: true,
    geodesicId: "g-a",
    segmentIndex: 0,
    start: { x: 0, y: 0, z: geodesicRayBeamHeightMeters },
    direction: { x: 1, y: 0, z: 0 },
    lengthMeters: 1,
    terminal: { kind: "open" },
    ...overrides,
  };
}

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

function getCannonGeodesicIds(registry: ReturnType<typeof createRuntimeObjectRegistry>, cannonId: string): readonly string[] {
  const cannon = registry.get(cannonId);
  return cannon?.kind === "geodesic-cannon" ? cannon.geodesicIds : [];
}

function getCannonGeodesicYaw(
  registry: ReturnType<typeof createRuntimeObjectRegistry>,
  cannonId: string,
  geodesicId: string,
): number | undefined {
  const cannon = registry.get(cannonId);
  return cannon?.kind === "geodesic-cannon" ? cannon.geodesicEmitterYawRadiansById?.[geodesicId] : undefined;
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

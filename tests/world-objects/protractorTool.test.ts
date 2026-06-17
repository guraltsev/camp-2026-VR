import { describe, expect, it } from "vitest";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";
import {
  createProtractorAngleObject,
  protractorAngleRadiusMeters,
  resolveProtractorCenterSelection,
  resolveProtractorDirectedGeodesicSelection,
  resolveProtractorEmitterGeodesicSelection,
} from "../../src/world-objects/protractorTool";
import {
  geodesicRayBeamHeightMeters,
  type GeodesicCannonObject,
  type GeodesicIntersectionObject,
  type GeodesicSegmentObject,
} from "../../src/world-objects/geodesicCannon";

describe("protractor tool objects", () => {
  it("uses the ray emitter height as the center for emitter selections", () => {
    const center = resolveProtractorCenterSelection(createEmitter({
      localPose: yawRigidTransform3(0, { x: 2, y: 3, z: 0.5 }),
    }));

    expect(center.point).toEqual({ x: 2, y: 3, z: 0.5 + geodesicRayBeamHeightMeters });
  });

  it("selects the side of a geodesic segment from the center toward the hit point", () => {
    const center = resolveProtractorCenterSelection(createIntersection());
    const segment = createSegment({
      geodesicId: "g-a",
      start: { x: -1, y: 0, z: 1.08 },
      direction: { x: 1, y: 0, z: 0 },
      lengthMeters: 2,
    });

    const right = resolveProtractorDirectedGeodesicSelection({
      center,
      segment,
      hitPoint: { x: 0.5, y: 0, z: 1.08 },
    });
    const left = resolveProtractorDirectedGeodesicSelection({
      center,
      segment,
      hitPoint: { x: -0.5, y: 0, z: 1.08 },
    });

    expect(right?.yawRadians).toBeCloseTo(0);
    expect(Math.abs(left?.yawRadians ?? 0)).toBeCloseTo(Math.PI);
  });

  it("measures the second selected side counterclockwise from the first", () => {
    const center = resolveProtractorCenterSelection(createEmitter());
    const angle = createProtractorAngleObject({
      id: "angle-a",
      center,
      first: { geodesicId: "g-a", segmentId: "segment-a", yawRadians: 0 },
      second: { geodesicId: "g-b", segmentId: "segment-b", yawRadians: Math.PI / 2 },
    });

    expect(angle.kind).toBe("protractor-angle");
    expect(angle.radiusMeters).toBe(protractorAngleRadiusMeters);
    expect(angle.angleDegrees).toBeCloseTo(90);
    expect(angle.tooltip?.label).toBe("g-a ∠ g-b = 90°");
  });

  it("uses supplied geodesic labels in the displayed angle measurement", () => {
    const center = resolveProtractorCenterSelection(createEmitter());
    const angle = createProtractorAngleObject({
      id: "angle-a",
      center,
      first: { geodesicId: "g-a", label: "G1", segmentId: "segment-a", yawRadians: 0 },
      second: { geodesicId: "g-b", label: "G2", segmentId: "segment-b", yawRadians: Math.PI / 2 },
    });

    expect(angle.tooltip?.label).toBe("G1 ∠ G2 = 90°");
    expect(angle.tooltip?.desktopPrompt).toBe("G1 ∠ G2 = 90°\nRMouse - remove");
    expect(angle.tooltip?.xrPrompt).toBe("G1 ∠ G2 = 90°");
  });

  it("wraps clockwise-looking selections into positive counterclockwise angles", () => {
    const center = resolveProtractorCenterSelection(createEmitter());
    const angle = createProtractorAngleObject({
      id: "angle-a",
      center,
      first: { geodesicId: "g-a", segmentId: "segment-a", yawRadians: Math.PI / 2 },
      second: { geodesicId: "g-b", segmentId: "segment-b", yawRadians: 0 },
    });

    expect(angle.angleDegrees).toBeCloseTo(270);
  });

  it("selects a geodesic side directly from an emitter", () => {
    const center = resolveProtractorCenterSelection(createEmitter({
      geodesicIds: ["g-a", "g-b"],
      activeGeodesicId: "g-b",
      geodesicEmitterYawRadiansById: { "g-b": Math.PI / 4 },
    }));

    const selected = resolveProtractorEmitterGeodesicSelection({
      center,
      emitter: createEmitter({
        geodesicIds: ["g-a", "g-b"],
        activeGeodesicId: "g-b",
        geodesicEmitterYawRadiansById: { "g-b": Math.PI / 4 },
      }),
    });

    expect(selected).toEqual({
      geodesicId: "g-b",
      segmentId: "emitter-a:g-b:emitter",
      yawRadians: Math.PI / 4,
    });
  });
});

function createIntersection(overrides: Partial<GeodesicIntersectionObject> = {}): GeodesicIntersectionObject {
  return {
    id: "vertex-a",
    kind: "geodesic-intersection",
    cellId: "cell-a",
    localPose: yawRigidTransform3(0, { x: 0, y: 0, z: 1.33 }),
    aimStickyTarget: { localPoint: { x: 0, y: 0, z: 1.08 } },
    portalRenderable: true,
    geodesicIds: ["g-a", "g-b"],
    segmentIds: ["segment-a", "segment-b"],
    ...overrides,
  };
}

function createEmitter(overrides: Partial<GeodesicCannonObject> = {}): GeodesicCannonObject {
  return {
    id: "emitter-a",
    kind: "geodesic-cannon",
    cellId: "cell-a",
    localPose: yawRigidTransform3(0, { x: 0, y: 0, z: 0 }),
    portalRenderable: true,
    geodesicIds: ["g-a", "g-b"],
    aimYawRadians: 0,
    ...overrides,
  };
}

function createSegment(overrides: Partial<GeodesicSegmentObject> = {}): GeodesicSegmentObject {
  return {
    id: "segment-a",
    kind: "geodesic-segment",
    cellId: "cell-a",
    localPose: yawRigidTransform3(0, { x: -1, y: 0, z: 1.08 }),
    portalRenderable: true,
    geodesicId: "g-a",
    segmentIndex: 0,
    start: { x: -1, y: 0, z: 1.08 },
    direction: { x: 1, y: 0, z: 0 },
    lengthMeters: 2,
    terminal: { kind: "open" },
    ...overrides,
  };
}

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildRuntimeObjectRenderArchetype } from "../../src/render/three/runtimeObjectRenderArchetypes";
import {
  collectGeodesicRuntimeRenderRecords,
  composeSegmentMatrix,
  createGeodesicRuntimeRenderSources,
  geodesicSegmentArchetypeKey,
} from "../../src/render/three/geodesicCannonRenderer";
import type { GeodesicSegmentObject } from "../../src/world-objects/geodesicCannon";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";

describe("geodesic cannon renderer", () => {
  it("publishes one render record per geodesic segment in the segment cell", () => {
    const segment = createSegment({ cellId: "cell-b", lengthMeters: 1.75 });
    const records = collectGeodesicRuntimeRenderRecords(segment);

    expect(records).toHaveLength(1);
    expect(records[0].objectId).toBe(segment.id);
    expect(records[0].cellId).toBe("cell-b");
    expect(records[0].archetypeKey).toBe(geodesicSegmentArchetypeKey);
  });

  it("scales the segment record matrix by segment length", () => {
    const matrix = composeSegmentMatrix(createSegment({ lengthMeters: 2.5 }));
    const origin = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    const end = new THREE.Vector3(1, 0, 0).applyMatrix4(matrix);

    expect(end.distanceTo(origin)).toBeCloseTo(2.5);
  });

  it("creates a reusable segment archetype source with portal clip instance attributes", () => {
    const source = createGeodesicRuntimeRenderSources().find(
      (entry) => entry.archetypeKey === geodesicSegmentArchetypeKey,
    );
    expect(source).toBeDefined();

    const archetype = buildRuntimeObjectRenderArchetype(source!, 3, undefined);
    expect(archetype.mesh.geometry.getAttribute("portalPathId")).toBe(archetype.portalPathIdAttribute);
    expect(archetype.mesh.geometry.getAttribute("portalClipIndex")).toBe(archetype.portalClipIndexAttribute);
    expect(archetype.capacity).toBe(3);
  });
});

function createSegment(overrides: Partial<GeodesicSegmentObject> = {}): GeodesicSegmentObject {
  return {
    id: "segment-a",
    kind: "geodesic-segment",
    cellId: "cell-a",
    localPose: yawRigidTransform3(0, { x: 0, y: 0, z: 0.32 }),
    portalRenderable: true,
    geodesicId: "g-a",
    segmentIndex: 0,
    start: { x: 0, y: 0, z: 0.32 },
    direction: { x: 1, y: 0, z: 0 },
    lengthMeters: 1,
    terminal: { kind: "open" },
    ...overrides,
  };
}

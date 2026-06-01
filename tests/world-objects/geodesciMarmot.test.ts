import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { createGeodesciMarmot, createGeodesciMarmotRuntime } from "../../src/world-objects/geodesciMarmot";
import type { PreparedWorldAssets } from "../../src/render/three/preloadWorldAssets";

describe("createGeodesciMarmotRuntime", () => {
  it("uses anchor crossing semantics and reparents on the same crossing frame", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const marmot = createGeodesciMarmot({
      id: "front-runner",
      position: { x: 0.75, y: 0, z: 0.5 },
      velocity: { x: -2, y: 0 },
    });
    const runtime = createGeodesciMarmotRuntime(marmot, "room-a", stubAssets());
    const roomARoot = new THREE.Group();
    const roomBRoot = new THREE.Group();
    const cellRoots = new Map<string, THREE.Object3D>([
      ["room-a", roomARoot],
      ["room-b", roomBRoot],
    ]);

    runtime.syncParent(cellRoots);
    expect(runtime.cellId).toBe("room-a");
    expect(runtime.root.parent).toBe(roomARoot);

    runtime.update(world, 0.1);
    runtime.syncParent(cellRoots);

    expect(runtime.cellId).toBe("room-a");
    expect(runtime.root.parent).toBe(roomARoot);
    expect(runtime.root.position.x).toBeCloseTo(0.95);

    runtime.update(world, 0.05);
    runtime.syncParent(cellRoots);

    expect(runtime.cellId).toBe("room-b");
    expect(runtime.root.parent).toBe(roomBRoot);
    expect(runtime.root.position.x).toBeCloseTo(-0.95);
  });
});

function stubAssets(): PreparedWorldAssets {
  return {
    getTexture() {
      return undefined;
    },
    getConfiguredTexture() {
      return undefined;
    },
    instantiateGltf() {
      return undefined;
    },
  };
}

function twoRoomsWithPortal() {
  const squareRoomBase = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];

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

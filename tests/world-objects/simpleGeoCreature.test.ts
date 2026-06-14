import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { identityMat3 } from "../../src/math/rigidTransform3";
import { simpleCollisionCylinder, type DynamicObjectState } from "../../src/movement/dynamicObject";
import type { PreparedWorldAssets } from "../../src/render/three/preloadWorldAssets";
import {
  createSimpleGeoCreature,
  createSimpleGeoCreatureRuntime,
  forbiddenZoneLateralOscillationScale,
} from "../../src/world-objects/simpleGeoCreature";

const squareRoomBase = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
] as const;

describe("simple geo creature movement", () => {
  it("keeps lateral oscillation bounded instead of accumulating sideways drift", () => {
    const world = compileCellComplex(singleRoom());
    const mouse = createSimpleGeoCreature("geo-mouse", "mouse", "mouse/Mouse.glb", {
      position: [0, 0.5, 0],
      scale: 0.1,
      speed: 0,
      oscillationRate: 1,
      oscillationMagnitude: 2,
    });
    const runtime = createSimpleGeoCreatureRuntime(mouse, "room", stubAssets());

    runtime.update(world, 0.25);
    expect(runtime.root.position.x).toBeCloseTo(0.2);

    runtime.update(world, 0.25);
    expect(runtime.root.position.x).toBeCloseTo(0);
  });

  it("scales only sideways delta while lateral oscillation is stopped near a forbidden zone", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const mouse = createSimpleGeoCreature("geo-mouse", "mouse", "mouse/Mouse.glb", {
      position: [0.25, 0.5, 1],
      scale: 0.1,
      speed: 0,
      oscillationRate: 1,
      oscillationMagnitude: 2,
    });
    const runtime = createSimpleGeoCreatureRuntime(mouse, "room-a", stubAssets());

    runtime.update(world, 0.25);
    expect(runtime.root.position.x).toBeCloseTo(0.25);

    runtime.update(world, 0.25);
    expect(runtime.root.position.x).toBeCloseTo(0.25);
  });

  it("stops lateral oscillation within 50cm of a forbidden zone", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const cell = world.cellsById.get("room-a");

    if (!cell) {
      throw new Error("Expected room-a.");
    }

    expect(forbiddenZoneLateralOscillationScale(cell, dynamicObject({ x: 0.25, y: 1, z: 0.5 }))).toBe(0);
  });

  it("interpolates lateral oscillation between 50cm and 1m from a forbidden zone", () => {
    const world = compileCellComplex(twoRoomsWithPortal());
    const cell = world.cellsById.get("room-a");

    if (!cell) {
      throw new Error("Expected room-a.");
    }

    expect(forbiddenZoneLateralOscillationScale(cell, dynamicObject({ x: 0, y: 1, z: 0.5 }))).toBeCloseTo(0.5);
    expect(forbiddenZoneLateralOscillationScale(cell, dynamicObject({ x: -0.25, y: 1, z: 0.5 }))).toBe(1);
  });
});

function dynamicObject(translation: { readonly x: number; readonly y: number; readonly z: number }): DynamicObjectState {
  return {
    cellId: "room-a",
    localPose: { rotation: identityMat3, translation },
    collision: simpleCollisionCylinder(0.1, 0.2),
  };
}

function stubAssets(): PreparedWorldAssets {
  return {
    getTexture() {
      return undefined;
    },
    getConfiguredTexture() {
      return undefined;
    },
    instantiateGltf() {
      return {
        scene: new THREE.Group(),
        animations: [],
      };
    },
  };
}

function singleRoom(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 2,
        baseVertices: [
          { x: -2, y: -2 },
          { x: 2, y: -2 },
          { x: 2, y: 2 },
          { x: -2, y: 2 },
        ],
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

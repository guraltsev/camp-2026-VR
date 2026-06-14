import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { identityRigidTransform3 } from "../../src/math/rigidTransform3";
import {
  createPlacedFlagObject,
  defaultPlacedFlagMessage,
  isPlacedFlagType,
  placeFlagFromAim,
  placedFlagToDynamicObjectState,
  sanitizePlacedFlagMessage,
  updatePlacedFlagFontColor,
} from "../../src/world-objects/placedFlags";
import { createRuntimeObjectRegistry } from "../../src/world-objects/runtimeObjectRegistry";

describe("placedFlags", () => {
  it("accepts the two wooden sign flag types", () => {
    expect(isPlacedFlagType("WoodenSign1")).toBe(true);
    expect(isPlacedFlagType("WoodenSign2")).toBe(true);
    expect(isPlacedFlagType("MapMarker")).toBe(false);
  });

  it("clamps messages to twenty characters", () => {
    expect(sanitizePlacedFlagMessage("1234567890123456789012345")).toBe("12345678901234567890");
  });

  it("defaults flag text by type and the next existing matching number", () => {
    const a1 = createPlacedFlagObject({
      id: "flag-a1",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign1",
      message: "A1",
    });
    const a7 = createPlacedFlagObject({
      id: "flag-a7",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign1",
      message: "A7",
    });
    const b3 = createPlacedFlagObject({
      id: "flag-b3",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign2",
      message: "B3",
    });

    expect(defaultPlacedFlagMessage("WoodenSign1", [a1, a7, b3])).toBe("A8");
    expect(defaultPlacedFlagMessage("WoodenSign2", [a1, a7, b3])).toBe("B4");
  });

  it("places flags with numbered default text from existing runtime flags", () => {
    const world = compileCellComplex(singleRoomWorld());
    const registry = createRuntimeObjectRegistry([
      createPlacedFlagObject({
        id: "flag-a7",
        cellId: "other-room",
        localPose: identityRigidTransform3,
        flagType: "WoodenSign1",
        message: "A7",
      }),
      createPlacedFlagObject({
        id: "flag-b3",
        cellId: "other-room",
        localPose: identityRigidTransform3,
        flagType: "WoodenSign2",
        message: "B3",
      }),
    ]);

    const sign1Result = placeFlagFromAim({
      world,
      registry,
      cellId: "room",
      eyePosition: { x: -1.5, y: -2, z: 1.6 },
      forward: { x: 0, y: 0, z: -1 },
      flagType: "WoodenSign1",
      id: "flag-new-a",
    });
    const sign2Result = placeFlagFromAim({
      world,
      registry,
      cellId: "room",
      eyePosition: { x: 1.5, y: -2, z: 1.6 },
      forward: { x: 0, y: 0, z: -1 },
      flagType: "WoodenSign2",
      id: "flag-new-b",
    });

    expect(sign1Result.object?.message).toBe("A8");
    expect(sign2Result.object?.message).toBe("B4");
  });

  it("defaults font color to white", () => {
    const flag = createPlacedFlagObject({
      id: "flag-a",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign1",
    });

    expect(flag.fontColor).toBe("#f8fafc");
  });

  it("font color updates preserve unrelated flag state", () => {
    const flag = createPlacedFlagObject({
      id: "flag-a",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign1",
      message: "Hi",
    });

    const updated = updatePlacedFlagFontColor(flag, "#2563eb");

    expect(updated).toMatchObject({
      id: "flag-a",
      cellId: "room-a",
      flagType: "WoodenSign1",
      message: "Hi",
      fontColor: "#2563eb",
    });
  });

  it("exposes placed flags as dynamic object state for collision", () => {
    const flag = createPlacedFlagObject({
      id: "flag-a",
      cellId: "room-a",
      localPose: identityRigidTransform3,
      flagType: "WoodenSign2",
    });

    expect(placedFlagToDynamicObjectState(flag)).toEqual({
      cellId: "room-a",
      localPose: identityRigidTransform3,
      collision: flag.collision,
    });
  });
});

function singleRoomWorld(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 3,
        baseVertices: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 },
        ],
        portals: [],
      },
    ],
  };
}

import { describe, expect, it } from "vitest";
import { identityRigidTransform3 } from "../../src/math/rigidTransform3";
import {
  createPlacedFlagObject,
  isPlacedFlagType,
  placedFlagToDynamicObjectState,
  sanitizePlacedFlagMessage,
  updatePlacedFlagFontColor,
} from "../../src/world-objects/placedFlags";

describe("placedFlags", () => {
  it("accepts the two wooden sign flag types", () => {
    expect(isPlacedFlagType("WoodenSign1")).toBe(true);
    expect(isPlacedFlagType("WoodenSign2")).toBe(true);
    expect(isPlacedFlagType("MapMarker")).toBe(false);
  });

  it("clamps messages to fifteen characters", () => {
    expect(sanitizePlacedFlagMessage("12345678901234567890")).toBe("123456789012345");
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

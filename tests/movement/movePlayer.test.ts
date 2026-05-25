import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { movePlayer } from "../../src/movement/movePlayer";
import { createDefaultPlayerPose } from "../../src/movement/playerPose";

describe("movePlayer", () => {
  it("moves a player through the explicit movement contract", () => {
    const result = movePlayer({
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 1, y: 0, z: 0 },
      yawDeltaRadians: 0,
      pitchDeltaRadians: 0,
      coordinateFrame: "global",
    });

    expect(result.kind).toBe("moved");
    expect(result.blocked).toBe(false);
    expect(result.crossedPortal).toBe(false);
    expect(result.pose).toEqual({
      cellId: "room-a",
      position: { x: 1, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
    });
  });

  it("keeps the coordinate frame choice explicit for later cell-local movement", () => {
    const result = movePlayer({
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 0, y: 0, z: -1 },
      yawDeltaRadians: Math.PI / 2,
      pitchDeltaRadians: 0,
      coordinateFrame: "current-cell",
    });

    expect(result.pose.cellId).toBe("room-a");
    expect(result.pose.yawRadians).toBeCloseTo(Math.PI / 2);
    expect(result.pose.position.x).toBeCloseTo(-1);
    expect(result.pose.position.z).toBeCloseTo(0);
  });

  it("moves forward in the same direction as the rendered camera faces", () => {
    const result = movePlayer({
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 0, y: 0, z: -1 },
      yawDeltaRadians: -Math.PI / 2,
      pitchDeltaRadians: 0,
      coordinateFrame: "global",
    });

    expect(result.pose.position.x).toBeCloseTo(1);
    expect(result.pose.position.z).toBeCloseTo(0);
  });

  it("updates pitch without changing horizontal movement direction", () => {
    const result = movePlayer({
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 0, y: 0, z: -1 },
      yawDeltaRadians: 0,
      pitchDeltaRadians: 0.5,
      coordinateFrame: "global",
    });

    expect(result.pose.pitchRadians).toBeCloseTo(0.5);
    expect(result.pose.position).toEqual({ x: 0, y: 0, z: -1 });
  });

  it("clamps pitch before the camera can flip over", () => {
    const result = movePlayer({
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 0, y: 0, z: 0 },
      yawDeltaRadians: 0,
      pitchDeltaRadians: Math.PI,
      coordinateFrame: "global",
    });

    expect(result.pose.pitchRadians).toBeCloseTo(Math.PI / 2 - 0.01);
  });

  it("uses the shared world-aware collision rules when a compiled world is provided", () => {
    const world = compileCellComplex({
      cells: [
        {
          id: "room-a",
          heightMeters: 2,
          baseVertices: [
            { x: -1, z: -1 },
            { x: 1, z: -1 },
            { x: 1, z: 1 },
            { x: -1, z: 1 },
          ],
          portals: [],
        },
      ],
    });

    const result = movePlayer({
      world,
      pose: createDefaultPlayerPose("room-a"),
      localDisplacement: { x: 2, y: 0, z: 0 },
      yawDeltaRadians: 0,
      pitchDeltaRadians: 0,
      coordinateFrame: "global",
    });

    expect(result.blocked).toBe(true);
    expect(result.blockingReason).toBe("wall");
    expect(result.pose.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});

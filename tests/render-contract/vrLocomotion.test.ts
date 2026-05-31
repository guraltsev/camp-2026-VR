import { describe, expect, it } from "vitest";
import {
  applyJoystickDeadZone,
  computeContinuousTurn,
  computeJoystickLocomotion,
  computePhysicalRoomScaleDisplacement,
} from "../../src/render/three/vrLocomotion";
import {
  globalHorizontalDeltaToPlayerLocal,
  createXrPlayerRig,
  resolveSharedXrRenderRootCellId,
  xrRigidTransformLocalMatrix,
} from "../../src/render/three/xrPlayerRig";
import { movePlayer, type MoveResult } from "../../src/movement/movePlayer";

describe("VR locomotion mapping", () => {
  it("dead-zones small stick noise", () => {
    expect(applyJoystickDeadZone({ x: 0.05, y: -0.05 }, 0.18)).toEqual({ x: 0, y: 0 });
    expect(computeJoystickLocomotion({ x: 0.05, y: -0.05 }, 1).localDisplacement).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("normalizes diagonal locomotion", () => {
    const frame = computeJoystickLocomotion({ x: 1, y: -1 }, 1, {
      moveSpeedMetersPerSecond: 1.5,
    });

    expect(Math.hypot(frame.localDisplacement.x, frame.localDisplacement.y)).toBeCloseTo(1.5);
    expect(frame.localDisplacement.x).toBeCloseTo(1.5 / Math.SQRT2);
    expect(frame.localDisplacement.y).toBeCloseTo(1.5 / Math.SQRT2);
  });

  it("returns zero displacement when axes are missing", () => {
    expect(computeJoystickLocomotion(undefined, 1).localDisplacement).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("maps continuous rotation from a turn axis without changing pitch", () => {
    expect(computeContinuousTurn(0.5, 2, { turnSpeedRadiansPerSecond: 1 })).toBeCloseTo(-1);
  });

  it("dead-zones continuous rotation", () => {
    expect(computeContinuousTurn(0.1, 2, { joystickDeadZone: 0.18 })).toBe(0);
  });

  it("keeps large physical tracking jumps at the previous accepted pose", () => {
    const result = computePhysicalRoomScaleDisplacement({
      previousHeadLocalMeters: { x: 0, y: 0, z: 1.6 },
      currentHeadLocalMeters: { x: 5, y: 0, z: 1.6 },
      maxPhysicalStepMeters: 0.75,
    });

    expect(result.ignoredTrackingJump).toBe(true);
    expect(result.localDisplacement).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.nextAcceptedHeadLocalMeters).toEqual({ x: 0, y: 0, z: 1.6 });
  });

  it("uses one shared first-pass XR render root cell", () => {
    expect(
      resolveSharedXrRenderRootCellId({
        cellId: "room-a",
        position: { x: 0, y: 0, z: 0 },
        yawRadians: 0,
        pitchRadians: 0,
      }),
    ).toBe("room-a");
  });

  it("converts room-scale world deltas back to player-local movement after artificial yaw", () => {
    const local = globalHorizontalDeltaToPlayerLocal({ x: 1, y: 0, z: 0 }, -Math.PI / 2);

    expect(local.x).toBeCloseTo(0);
    expect(local.y).toBeCloseTo(1);
    expect(local.z).toBe(0);
  });

  it("applies room-scale headset deltas in the current portal-transformed player basis", async () => {
    const THREE = await import("three");
    const rig = createXrPlayerRig(new THREE.PerspectiveCamera());
    const accepted: MoveResult = {
      kind: "moved",
      pose: {
        cellId: "room-b",
        position: { x: 0, y: 0, z: 0 },
        yawRadians: Math.PI,
        pitchRadians: 0,
      },
      attemptedDisplacement: { x: 0, y: 0, z: 0 },
      blocked: false,
      crossedPortal: false,
    };

    rig.acceptPhysicalMove(accepted, { x: 0, y: 0, z: 1.6 });
    const physicalFrame = rig.consumePhysicalInput({ x: 0, y: 0.2, z: 1.6 }, Math.PI);
    const moved = movePlayer({
      pose: accepted.pose,
      localDisplacement: physicalFrame.localDisplacement,
      yawDeltaRadians: 0,
      pitchDeltaRadians: 0,
      coordinateFrame: "global",
    });

    expect(physicalFrame.localDisplacement.y).toBeCloseTo(0.2);
    expect(moved.pose.position.x).toBeCloseTo(0);
    expect(moved.pose.position.y).toBeCloseTo(-0.2);
  });

  it("builds XR view matrices that survive Three camera matrix updates", async () => {
    const THREE = await import("three");
    const camera = new THREE.Camera();
    const matrix = xrRigidTransformLocalMatrix({
      position: { x: 1, y: 2, z: 3, w: 1 } as DOMPointReadOnly,
      orientation: { x: 0, y: 0, z: 0, w: 1 } as DOMPointReadOnly,
    });

    camera.matrixAutoUpdate = false;
    camera.matrix.copy(matrix);
    camera.matrixWorld.copy(matrix);
    camera.updateMatrixWorld(true);

    expect(camera.matrixWorld.elements).toEqual(matrix.elements);
  });
});

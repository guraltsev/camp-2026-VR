import { describe, expect, it } from "vitest";
import { createXrInputFrame, isResetPressed, readPrimaryStickAxes } from "../../src/render/three/xrControls";

describe("XR controls", () => {
  it("never throws and returns no movement when gamepad data is missing", () => {
    const frame = createXrInputFrame([{ handedness: "left" }], 1);

    expect(frame.localDisplacement).toEqual({ x: 0, y: 0, z: 0 });
    expect(frame.yawDeltaRadians).toBe(0);
    expect(frame.source).toBe("xr");
  });

  it("reads thumbstick axes defensively across common WebXR layouts", () => {
    expect(readPrimaryStickAxes({ axes: [0, 0, 0.25, -0.5] })).toEqual({ x: 0.25, y: -0.5 });
    expect(readPrimaryStickAxes({ axes: [0.3, -0.4] })).toEqual({ x: 0.3, y: -0.4 });
  });

  it("maps left stick to locomotion and right stick to continuous rotation", () => {
    const frame = createXrInputFrame(
      [
        { handedness: "left", gamepad: { axes: [0, 0, 0, -1] } },
        { handedness: "right", gamepad: { axes: [0, 0, 1, 0] } },
      ],
      1,
      {
        moveSpeedMetersPerSecond: 1.5,
        turnSpeedRadiansPerSecond: 1,
      },
    );

    expect(frame.localDisplacement).toEqual({ x: 0, y: 1.5, z: 0 });
    expect(frame.yawDeltaRadians).toBeCloseTo(-1);
    expect(frame.pitchDeltaRadians).toBe(0);
  });

  it("dead-zones small controller rotation", () => {
    const frame = createXrInputFrame(
      [
        { handedness: "left", gamepad: { axes: [0, 0, 0, 0] } },
        { handedness: "right", gamepad: { axes: [0, 0, 0.1, 0] } },
      ],
      1,
      { joystickDeadZone: 0.18 },
    );

    expect(frame.yawDeltaRadians).toBe(0);
  });

  it("maps thumbstick click style buttons to reset without consuming menu buttons", () => {
    expect(isResetPressed({ buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }] }))
      .toBe(true);
    expect(isResetPressed({ buttons: [{ pressed: false }, { pressed: true }] })).toBe(false);
    expect(
      createXrInputFrame([
        { gamepad: { buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }] } },
      ], 1).resetRequested,
    ).toBe(true);
  });
});

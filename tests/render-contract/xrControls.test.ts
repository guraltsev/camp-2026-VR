import { describe, expect, it } from "vitest";
import { createXrControls, createXrInputFrame, isCarryActionPressed, isInteractPressed, isResetPressed, readPrimaryStickAxes } from "../../src/render/three/xrControls";

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

  it("reports trigger as a primary action edge in stateful controls", () => {
    const controls = createXrControls();
    const released = { gamepad: { buttons: [{ pressed: false }] } };
    const pressed = { gamepad: { buttons: [{ pressed: true }] } };

    expect(controls.consumeFrame([released], 1).primaryActionRequested).toBe(false);
    expect(controls.consumeFrame([pressed], 1).primaryActionRequested).toBe(true);
    expect(controls.consumeFrame([pressed], 1).primaryActionRequested).toBe(false);
    expect(controls.consumeFrame([released], 1).primaryActionRequested).toBe(false);
  });

  it("maps A/X style buttons to object interaction edges", () => {
    const controls = createXrControls();
    const released = {
      gamepad: {
        buttons: [
          { pressed: false },
          { pressed: false },
          { pressed: false },
          { pressed: false },
          { pressed: false },
          { pressed: false },
        ],
      },
    };
    const pressed = {
      gamepad: {
        buttons: [
          { pressed: false },
          { pressed: false },
          { pressed: false },
          { pressed: false },
          { pressed: true },
          { pressed: false },
        ],
      },
    };

    expect(isInteractPressed(pressed.gamepad)).toBe(true);
    expect(createXrInputFrame([pressed], 1).interactRequested).toBe(true);
    expect(controls.consumeFrame([released], 1).interactRequested).toBe(false);
    expect(controls.consumeFrame([pressed], 1).interactRequested).toBe(true);
    expect(controls.consumeFrame([pressed], 1).interactRequested).toBe(false);
    expect(controls.consumeFrame([released], 1).interactRequested).toBe(false);
  });

  it("maps the right side trigger to carry action edges", () => {
    const controls = createXrControls();
    const released = { handedness: "right", gamepad: { buttons: [{ pressed: false }, { pressed: false }] } };
    const pressed = { handedness: "right", gamepad: { buttons: [{ pressed: false }, { pressed: true }] } };
    const leftPressed = { handedness: "left", gamepad: { buttons: [{ pressed: false }, { pressed: true }] } };

    expect(isCarryActionPressed(pressed)).toBe(true);
    expect(isCarryActionPressed(leftPressed)).toBe(false);
    expect(createXrInputFrame([pressed], 1).carryActionRequested).toBe(true);
    expect(controls.consumeFrame([released], 1).carryActionRequested).toBe(false);
    expect(controls.consumeFrame([pressed], 1).carryActionRequested).toBe(true);
    expect(controls.consumeFrame([pressed], 1).carryActionRequested).toBe(false);
    expect(controls.consumeFrame([released], 1).carryActionRequested).toBe(false);
  });
});

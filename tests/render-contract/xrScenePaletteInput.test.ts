import { describe, expect, it } from "vitest";
import { isMenuTogglePressed, isSelectPressed } from "../../src/render/three/xrScenePaletteInput";

describe("xrScenePaletteInput", () => {
  it("maps controller select and menu buttons without treating A/X as menu toggles", () => {
    const gamepad = {
      buttons: [
        { pressed: true },
        { pressed: false },
        { pressed: false },
        { pressed: true },
      ],
    } as unknown as XRInputSource["gamepad"];

    expect(isSelectPressed(gamepad)).toBe(true);
    expect(isMenuTogglePressed(gamepad)).toBe(true);

    const faceButtonGamepad = {
      buttons: [
        { pressed: false },
        { pressed: false },
        { pressed: false },
        { pressed: false },
        { pressed: true },
        { pressed: true },
      ],
    } as unknown as XRInputSource["gamepad"];

    expect(isMenuTogglePressed(faceButtonGamepad)).toBe(false);
  });
});

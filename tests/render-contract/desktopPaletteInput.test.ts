import { describe, expect, it } from "vitest";
import { reduceDesktopPaletteInput } from "../../src/render/three/desktopPaletteInput";

describe("desktopPaletteInput", () => {
  it("opens on canvas right-click when closed", () => {
    expect(reduceDesktopPaletteInput(false, { kind: "canvas-contextmenu" })).toBe("open");
  });

  it("opens on secondary click when closed", () => {
    expect(reduceDesktopPaletteInput(false, { kind: "secondary-click" })).toBe("open");
  });

  it("closes on escape when open", () => {
    expect(reduceDesktopPaletteInput(true, { kind: "escape-key" })).toBe("close");
  });

  it("closes on outside right-click when open", () => {
    expect(
      reduceDesktopPaletteInput(true, {
        kind: "outside-secondary-click",
        targetInsidePalette: false,
      }),
    ).toBe("close");
  });

  it("ignores inside right-clicks while open", () => {
    expect(
      reduceDesktopPaletteInput(true, {
        kind: "outside-secondary-click",
        targetInsidePalette: true,
      }),
    ).toBe("none");
  });
});

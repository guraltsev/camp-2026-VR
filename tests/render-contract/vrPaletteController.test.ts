import { describe, expect, it } from "vitest";
import { describeVrInputMode } from "../../src/render/three/vrPaletteController";

describe("vrPaletteController", () => {
  it("describes controller interaction cleanly", () => {
    expect(describeVrInputMode(true, "controller")).toBe("controllers");
    expect(describeVrInputMode(true, undefined)).toBe("controllers");
    expect(describeVrInputMode(false, undefined)).toBe("xr");
  });
});

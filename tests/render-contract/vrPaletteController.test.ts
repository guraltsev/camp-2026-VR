import { describe, expect, it } from "vitest";
import { describeVrInputMode } from "../../src/render/three/vrPaletteController";

describe("vrPaletteController", () => {
  it("describes hybrid hand interaction when both input types exist and a hand is active", () => {
    expect(describeVrInputMode(true, true, "hand")).toBe("hybrid-hands");
  });

  it("describes controller fallback cleanly", () => {
    expect(describeVrInputMode(false, true, "controller")).toBe("controllers");
    expect(describeVrInputMode(false, false, undefined)).toBe("xr");
  });
});

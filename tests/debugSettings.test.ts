import { describe, expect, it } from "vitest";
import { canApplyDebugSettingsAtRuntime } from "../src/glue/debugSettings";

describe("canApplyDebugSettingsAtRuntime", () => {
  it("allows the current runtime-mutable debug settings", () => {
    expect(
      canApplyDebugSettingsAtRuntime({
        debugLevel: "basic",
        portalPanelMode: "panel",
        debugOptions: ["runtime-diagnostics"],
      }),
    ).toBe(true);
  });

  it("still allows updates when no checkbox debug options are selected", () => {
    expect(
      canApplyDebugSettingsAtRuntime({
        debugLevel: "off",
        portalPanelMode: "none",
        debugOptions: [],
      }),
    ).toBe(true);
  });
});

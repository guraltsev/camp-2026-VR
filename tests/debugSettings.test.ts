import { describe, expect, it } from "vitest";
import { canApplyDebugSettingsAtRuntime } from "../src/glue/debugSettings";
import { hasActiveDebugOption, parseDebugOptions } from "../src/glue/debugOptions";

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

  it("parses portal path debug options and keeps them inactive at debug level off", () => {
    const parsed = parseDebugOptions("portal-path-debug,portal-static-cull-debug,portal-path-overlays");

    expect(parsed).toEqual(["portal-path-debug", "portal-static-cull-debug", "portal-path-overlays"]);
    expect(hasActiveDebugOption("off", parsed, "portal-path-debug")).toBe(false);
    expect(hasActiveDebugOption("basic", parsed, "portal-path-debug")).toBe(true);
  });
});

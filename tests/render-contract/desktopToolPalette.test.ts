import { describe, expect, it } from "vitest";
import { createRuntimeMenuState, showRuntimeMenuSettings } from "../../src/runtime/runtimeMenuState";
import { createPaletteDefinition } from "../../src/ui/paletteDefinition";
import { describeDesktopPaletteView } from "../../src/render/dom/desktopToolPalette";

describe("desktopToolPalette", () => {
  it("describes the main page as an empty tool rectangle with settings and close actions", () => {
    const definition = createPaletteDefinition(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("main");
    expect(view.leftAction.id).toBe("settings");
    expect(view.rightAction.id).toBe("close");
    expect(view.content.kind).toBe("empty");
  });

  it("describes the settings page with world options, back action, and debug toggle state", () => {
    const definition = createPaletteDefinition(showRuntimeMenuSettings(createRuntimeMenuState({
      selectedWorldId: "torus",
      debugOverlayEnabled: false,
    })));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("settings");
    expect(view.leftAction.id).toBe("none");
    expect(view.rightAction.id).toBe("back");
    expect(view.content.kind).toBe("settings");

    if (view.content.kind !== "settings") {
      throw new Error("Expected settings content.");
    }

    expect(view.content.selectedWorldId).toBe("torus");
    expect(view.content.debugOverlayEnabled).toBe(false);
    expect(view.content.worldLabels).toContain("Cube");
    expect(view.content.worldLabels).toContain("Torus");
  });
});

import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  showRuntimeMenuDebugSettings,
  showRuntimeMenuSettings,
} from "../../src/runtime/runtimeMenuState";
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

  it("describes the settings page with compact debug entry", () => {
    const definition = createPaletteDefinition(showRuntimeMenuSettings(createRuntimeMenuState({
      selectedWorldId: "torus",
      debugOverlayEnabled: false,
      debugSettings: {
        debugLevel: "verbose",
        portalPanelMode: "text-only",
        debugOptions: ["portal-path-debug", "portal-static-cull-debug", "portal-path-overlays"],
      },
    })));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("settings");
    expect(view.leftAction.id).toBe("none");
    expect(view.rightAction.id).toBe("back");
    expect(view.content.kind).toBe("settings");

    if (view.content.kind !== "settings") {
      throw new Error("Expected settings content.");
    }

    expect(view.content.debugEnabled).toBe(true);
  });

  it("describes the debug settings page with the expanded debug controls", () => {
    const definition = createPaletteDefinition(showRuntimeMenuDebugSettings(createRuntimeMenuState({
      selectedWorldId: "torus",
      debugOverlayEnabled: false,
      debugSettings: {
        debugLevel: "verbose",
        portalPanelMode: "text-only",
        debugOptions: [
          "portal-path-debug",
          "portal-static-cull-debug",
          "portal-path-overlays",
          "forbidden-zone-wireframes",
          "object-collision-wireframes",
        ],
      },
    })));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("debug-settings");
    expect(view.leftAction.id).toBe("none");
    expect(view.rightAction.id).toBe("back");
    expect(view.content.kind).toBe("debug-settings");

    if (view.content.kind !== "debug-settings") {
      throw new Error("Expected debug settings content.");
    }

    expect(view.content.consoleLogLevel).toBe("verbose");
    expect(view.content.debugOverlayEnabled).toBe(false);
    expect(view.content.portalPanelMode).toBe("text-only");
    expect(view.content.portalInspectionEnabled).toBe(true);
    expect(view.content.collisionGeometryWireframesEnabled).toBe(true);
  });
});

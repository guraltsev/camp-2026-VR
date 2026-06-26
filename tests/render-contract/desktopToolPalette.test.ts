import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  showRuntimeMenuGeodesicCannonActions,
  showRuntimeMenuGeometryComputerActions,
  showRuntimeMenuDebugSettings,
  showRuntimeMenuSettings,
  showRuntimeMenuQuestionHelp,
  showRuntimeMenuTutorial,
} from "../../src/runtime/runtimeMenuState";
import { createPaletteDefinition, questionHelpHubBody } from "../../src/ui/paletteDefinition";
import { describeDesktopPaletteView } from "../../src/render/dom/desktopToolPalette";

describe("desktopToolPalette", () => {
  it("describes the main page with no default tool selection plus place-flag tool controls and settings actions", () => {
    const definition = createPaletteDefinition(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("main");
    expect(view.leftAction.id).toBe("settings");
    expect(view.rightAction.id).toBe("close");
    expect(view.content.kind).toBe("main");
    if (view.content.kind !== "main") {
      throw new Error("Expected main content.");
    }
    expect(view.content.selectedTool).toBe("none");
    expect(view.content.placeFlagType).toBe("WoodenSign1");
  });

  it("describes the flag options page with both wooden sign types", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    });
    const definition = createPaletteDefinition({
      ...state,
      page: "place-flag-options",
    });
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("place-flag-options");
    expect(view.content.kind).toBe("place-flag-options");
    if (view.content.kind !== "place-flag-options") {
      throw new Error("Expected place flag options content.");
    }
    expect(view.content.flagTypeLabels).toEqual(["WoodenSign1", "WoodenSign2"]);
  });

  it("describes the geodesic ray emitter action menu with enabled aim", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }), {
      cannonId: "cannon-a",
      geodesicIds: ["g-a"],
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("geodesic-cannon-actions");
    expect(view.content.kind).toBe("geodesic-cannon-actions");
    if (view.content.kind !== "geodesic-cannon-actions") {
      throw new Error("Expected geodesic cannon actions content.");
    }
    expect(view.content.addLabel).toBe("Add geodesic");
    expect(view.content.geodesicLabels).toEqual(["G1"]);
    expect(view.content.disabledGeodesicActions).toEqual([]);
  });

  it("describes locked geodesics without aim actions", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }), {
      cannonId: "cannon-a",
      geodesicIds: ["g-a"],
      lockedGeodesicIds: ["g-a"],
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.content.kind).toBe("geodesic-cannon-actions");
    if (view.content.kind !== "geodesic-cannon-actions") {
      throw new Error("Expected geodesic cannon actions content.");
    }
    expect(view.content.disabledGeodesicActions).toEqual(["aim:g-a"]);
  });

  it("describes the geometry computer action menu", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeometryComputerActions(createRuntimeMenuState({
      selectedWorldId: "torus",
      debugOverlayEnabled: true,
    }), {
      computerId: "torus-geometry-computer",
      available: true,
      widthMeters: 15,
      currentSkewXMeters: 0,
      currentDepthMeters: 15,
      targetSkewXMeters: 2,
      targetDepthMeters: 15,
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("geometry-computer-actions");
    expect(view.content.kind).toBe("geometry-computer-actions");
    if (view.content.kind !== "geometry-computer-actions") {
      throw new Error("Expected geometry computer actions content.");
    }
    expect(view.content.available).toBe(true);
    expect(view.content.statusLabel).toBe("Current (0 m, 15 m) / target (2 m, 15 m)");
  });

  it("describes the tutorial page controls", () => {
    const definition = createPaletteDefinition(showRuntimeMenuTutorial(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }), {
      objectId: "startingQuestionCube",
      pages: [
        { title: "Move", body: "Use arrows." },
        { title: "Act", body: "Click things." },
      ],
      pageIndex: 1,
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("tutorial");
    expect(view.content.kind).toBe("tutorial");
    if (view.content.kind !== "tutorial") {
      throw new Error("Expected tutorial content.");
    }
    expect(view.content.title).toBe("Act");
    expect(view.content.pageLabel).toBe("2 / 2");
    expect(view.content.previousDisabled).toBe(false);
    expect(view.content.nextDisabled).toBe(true);
  });

  it("describes the help hub choices", () => {
    const definition = createPaletteDefinition(showRuntimeMenuQuestionHelp(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugOverlayEnabled: true,
    }), {
      objectId: "startingQuestionCube",
      tutorialPages: [{ title: "Move", body: "Use arrows." }],
      goalPages: [{ title: "Goal", body: "Find a portal." }],
    }));
    const view = describeDesktopPaletteView(definition);

    expect(view.pageId).toBe("question-help");
    expect(view.content.kind).toBe("question-help");
    if (view.content.kind !== "question-help") {
      throw new Error("Expected help hub content.");
    }
    expect(view.content.body).toBe(questionHelpHubBody);
    expect(view.content.optionLabels).toEqual(["Tutorial", "Goal"]);
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

    expect(view.content.worldLabel).toBe("Torus");
    expect(view.content.appConfigLabel).toBe("Default");
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
          "aim-collision-outlines",
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
    expect(view.content.aimCollisionOutlinesEnabled).toBe(true);
  });
});

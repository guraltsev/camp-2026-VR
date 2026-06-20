import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  createDebugSettingsFromRuntimeMenuState,
  selectRuntimeMenuPlaceFlagToolType,
  setRuntimeMenuAimCollisionOutlinesEnabled,
  setRuntimeMenuEditingSignMessage,
  setRuntimeMenuSelectedTool,
  showRuntimeMenuDebugSettings,
  showRuntimeMenuGeodesicCannonActions,
  showRuntimeMenuGeometryComputerActions,
  showRuntimeMenuMainPage,
  showRuntimeMenuEditSign,
  showRuntimeMenuPlaceFlagOptions,
} from "../../src/runtime/runtimeMenuState";
import { createPaletteDefinition } from "../../src/ui/paletteDefinition";

describe("runtimeMenuState", () => {
  it("starts with no tool selected by default", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
    });

    expect(state.selectedTool).toBe("none");
  });

  it("keeps no tool selected when a caller clears the selection", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
    });

    expect(setRuntimeMenuSelectedTool(state, "none").selectedTool).toBe("none");
  });

  it("selects the place-flag tool when a flag type is selected", () => {
    const state = showRuntimeMenuPlaceFlagOptions(createRuntimeMenuState({
      selectedWorldId: "cube",
    }));

    const next = selectRuntimeMenuPlaceFlagToolType(state, "WoodenSign2");

    expect(next.selectedTool).toBe("place-flag");
    expect(next.placeFlagOptions.flagType).toBe("WoodenSign2");
    expect(next.page).toBe("place-flag-options");
  });

  it("selects the protractor tool from the main palette", () => {
    const state = setRuntimeMenuSelectedTool(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), "protractor");
    const definition = createPaletteDefinition(state);

    expect(state.selectedTool).toBe("protractor");
    expect(definition.content.kind).toBe("main");
    if (definition.content.kind !== "main") {
      throw new Error("Expected main palette.");
    }
    expect(definition.content.selectedTool).toBe("protractor");
  });

  it("selects the measure length tool from the main palette", () => {
    const state = setRuntimeMenuSelectedTool(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), "measure-length");
    const definition = createPaletteDefinition(state);

    expect(state.selectedTool).toBe("measure-length");
    expect(definition.content.kind).toBe("main");
    if (definition.content.kind !== "main") {
      throw new Error("Expected main palette.");
    }
    expect(definition.content.selectedTool).toBe("measure-length");
  });

  it("serializes the aim collision outline debug toggle", () => {
    const state = setRuntimeMenuAimCollisionOutlinesEnabled(createRuntimeMenuState({
      selectedWorldId: "cube",
      debugSettings: {
        debugLevel: "basic",
        portalPanelMode: "none",
        debugOptions: [],
      },
    }), true);

    expect(createDebugSettingsFromRuntimeMenuState(state).debugOptions).toContain("aim-collision-outlines");
    expect(createPaletteDefinition(showRuntimeMenuDebugSettings(state)).content).toMatchObject({
      kind: "debug-settings",
      aimCollisionOutlinesEnabled: true,
    });
  });

  it("clears the selected tool when backing out to the main menu", () => {
    const state = setRuntimeMenuSelectedTool(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), "place-flag");

    const next = showRuntimeMenuMainPage(state);

    expect(next.page).toBe("main");
    expect(next.selectedTool).toBe("none");
  });

  it("tracks the active in-game sign editor message", () => {
    const state = showRuntimeMenuEditSign(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), {
      flagId: "sign-a",
      message: "A1",
    });

    const next = setRuntimeMenuEditingSignMessage(state, "A12");

    expect(next.isOpen).toBe(true);
    expect(next.page).toBe("edit-sign");
    expect(next.editSignOptions).toEqual({
      flagId: "sign-a",
      message: "A12",
    });
  });

  it("treats the sign editor as an object-specific menu that closes when backing out", () => {
    const definition = createPaletteDefinition(showRuntimeMenuEditSign(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), {
      flagId: "sign-a",
      message: "A1",
    }));

    expect(definition.pageId).toBe("edit-sign");
    expect(definition.rightAction.id).toBe("close");
  });

  it("creates a geodesic ray emitter action menu with aim enabled", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), {
      cannonId: "cannon-a",
      geodesicIds: ["g-a", "g-b"],
    }));

    expect(definition.pageId).toBe("geodesic-cannon-actions");
    expect(definition.rightAction.id).toBe("close");
    expect(definition.content.kind).toBe("geodesic-cannon-actions");
    if (definition.content.kind !== "geodesic-cannon-actions") {
      throw new Error("Expected geodesic cannon actions.");
    }
    expect(definition.content.addAction).toEqual({ label: "Add geodesic", disabled: false });
    expect(definition.content.geodesics).toEqual([
      { id: "g-a", label: "G1", locked: false, connectionSymbolLabel: undefined, deleteDisabled: false },
      { id: "g-b", label: "G2", locked: false, connectionSymbolLabel: undefined, deleteDisabled: false },
    ]);
  });

  it("uses explicit global geodesic labels in emitter action menus", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), {
      cannonId: "cannon-b",
      geodesicIds: ["g-b"],
      geodesicLabelsById: { "g-b": "G2" },
    }));

    expect(definition.content.kind).toBe("geodesic-cannon-actions");
    if (definition.content.kind !== "geodesic-cannon-actions") {
      throw new Error("Expected geodesic cannon actions.");
    }
    expect(definition.content.geodesics).toEqual([
      { id: "g-b", label: "G2", locked: false, connectionSymbolLabel: undefined, deleteDisabled: false },
    ]);
  });

  it("marks locked geodesic rows with a connection symbol label", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), {
      cannonId: "cannon-b",
      geodesicIds: ["g-b"],
      lockedGeodesicIds: ["g-b"],
    }));

    expect(definition.content.kind).toBe("geodesic-cannon-actions");
    if (definition.content.kind !== "geodesic-cannon-actions") {
      throw new Error("Expected geodesic cannon actions.");
    }
    expect(definition.content.geodesics).toEqual([
      {
        id: "g-b",
        label: "G1",
        locked: true,
        connectionSymbolLabel: "Locked geodesic segment between emitters",
        deleteDisabled: false,
      },
    ]);
  });

  it("creates a geometry computer action menu with torus skew controls", () => {
    const definition = createPaletteDefinition(showRuntimeMenuGeometryComputerActions(createRuntimeMenuState({
      selectedWorldId: "torus",
    }), {
      computerId: "torus-geometry-computer",
      available: true,
      currentSkewXMeters: 0.5,
      targetSkewXMeters: 1,
    }));

    expect(definition.pageId).toBe("geometry-computer-actions");
    expect(definition.rightAction.id).toBe("close");
    expect(definition.content.kind).toBe("geometry-computer-actions");
    if (definition.content.kind !== "geometry-computer-actions") {
      throw new Error("Expected geometry computer actions.");
    }
    expect(definition.content.statusLabel).toBe("Current 0.5 m / target 1 m");
    expect(definition.content.setActions.map((action) => action.label)).toEqual(["-2 m", "-1 m", "Flat 0 m", "+1 m", "+2 m"]);
    expect(definition.content.stepActions.map((action) => action.label)).toEqual(["-0.25 m", "+0.25 m"]);
  });
});

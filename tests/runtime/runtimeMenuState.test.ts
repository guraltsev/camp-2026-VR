import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  selectRuntimeMenuPlaceFlagToolType,
  setRuntimeMenuEditingSignMessage,
  setRuntimeMenuSelectedTool,
  showRuntimeMenuMainPage,
  showRuntimeMenuEditSign,
  showRuntimeMenuPlaceFlagOptions,
} from "../../src/runtime/runtimeMenuState";
import { createPaletteDefinition } from "../../src/ui/paletteDefinition";

describe("runtimeMenuState", () => {
  it("selects the aim tool by default", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
    });

    expect(state.selectedTool).toBe("aim");
  });

  it("keeps the default tool selected when a caller attempts to clear the selection", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
    });

    expect(setRuntimeMenuSelectedTool(state, "none").selectedTool).toBe("aim");
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

  it("restores the default tool when backing out to the main menu", () => {
    const state = setRuntimeMenuSelectedTool(createRuntimeMenuState({
      selectedWorldId: "cube",
    }), "place-flag");

    const next = showRuntimeMenuMainPage(state);

    expect(next.page).toBe("main");
    expect(next.selectedTool).toBe("aim");
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
});

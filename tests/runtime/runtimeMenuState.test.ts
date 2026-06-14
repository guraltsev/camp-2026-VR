import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  selectRuntimeMenuPlaceFlagToolType,
  showRuntimeMenuPlaceFlagOptions,
} from "../../src/runtime/runtimeMenuState";

describe("runtimeMenuState", () => {
  it("selects the aim tool by default", () => {
    const state = createRuntimeMenuState({
      selectedWorldId: "cube",
    });

    expect(state.selectedTool).toBe("aim");
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
});

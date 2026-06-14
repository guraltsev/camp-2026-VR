import { describe, expect, it } from "vitest";
import { createRuntimeMenuState, showRuntimeMenuPlaceFlagOptions } from "../../src/runtime/runtimeMenuState";
import { createScenePaletteLibraryAdapter } from "../../src/render/three/scenePaletteLibraryAdapter";
import { createPaletteDefinition } from "../../src/ui/paletteDefinition";

describe("scenePaletteLibraryAdapter", () => {
  it("renders main tool tiles", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    adapter.setDefinition(createPaletteDefinition(createRuntimeMenuState({ selectedWorldId: "cube" })));

    const itemIds = collectPaletteItemIds(adapter.root);

    expect(itemIds).toContain("tool:aim");
    expect(itemIds).toContain("tool:place-flag");
    expect(itemIds).toContain("tool:geodesic-cannon");

    adapter.dispose();
  });

  it("renders place flag options", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    adapter.setDefinition(createPaletteDefinition(showRuntimeMenuPlaceFlagOptions(
      createRuntimeMenuState({ selectedWorldId: "cube" }),
    )));

    const itemIds = collectPaletteItemIds(adapter.root);

    expect(itemIds).toContain("flag-type:WoodenSign1");
    expect(itemIds).toContain("flag-type:WoodenSign2");

    adapter.dispose();
  });
});

function collectPaletteItemIds(root: { readonly children: readonly any[]; readonly userData?: Record<string, unknown> }): string[] {
  const ids: string[] = [];
  const visit = (node: { readonly children?: readonly any[]; readonly userData?: Record<string, unknown> }) => {
    if (typeof node.userData?.scenePaletteItemId === "string") {
      ids.push(node.userData.scenePaletteItemId);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return ids;
}

function createNoopOptions(): Parameters<typeof createScenePaletteLibraryAdapter>[0] {
  return {
    onLeftAction: () => undefined,
    onRightAction: () => undefined,
    onWorldSelected: () => undefined,
    onReloadRequested: () => undefined,
    onDebugEnabledChanged: () => undefined,
    onDebugSettingsRequested: () => undefined,
    onConsoleLogLevelSelected: () => undefined,
    onDebugOverlayToggled: () => undefined,
    onDebugOverlayItemToggled: () => undefined,
    onPortalPanelModeSelected: () => undefined,
    onPortalInspectionToggled: () => undefined,
    onCollisionGeometryWireframesToggled: () => undefined,
    onToolSelected: () => undefined,
    onPlaceFlagOptionsRequested: () => undefined,
    onPlaceFlagTypeSelected: () => undefined,
  };
}

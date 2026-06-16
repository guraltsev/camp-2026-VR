import { describe, expect, it } from "vitest";
import {
  createRuntimeMenuState,
  showRuntimeMenuEditSign,
  showRuntimeMenuGeodesicCannonActions,
  showRuntimeMenuPlaceFlagOptions,
} from "../../src/runtime/runtimeMenuState";
import { createScenePaletteLibraryAdapter } from "../../src/render/three/scenePaletteLibraryAdapter";
import { createPaletteDefinition } from "../../src/ui/paletteDefinition";

describe("scenePaletteLibraryAdapter", () => {
  it("renders explicit main tool tiles without a default tool tile", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    adapter.setDefinition(createPaletteDefinition(createRuntimeMenuState({ selectedWorldId: "cube" })));

    const itemIds = collectPaletteItemIds(adapter.root);
    const imageSources = collectPaletteImageSources(adapter.root);

    expect(itemIds).not.toContain("tool:aim");
    expect(itemIds).toContain("tool:place-flag");
    expect(itemIds).toContain("tool:geodesic-cannon");
    expect(itemIds).toContain("tool-options:place-sign");
    expect(imageSources).toContain("/assets/WoodenSign1/WoodenSign1.png");
    expect(imageSources).toContain("/assets/flashlight/Lightsaber.png");

    adapter.dispose();
  });

  it("renders place sign options", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    adapter.setDefinition(createPaletteDefinition(showRuntimeMenuPlaceFlagOptions(
      createRuntimeMenuState({ selectedWorldId: "cube" }),
    )));

    const itemIds = collectPaletteItemIds(adapter.root);
    const imageSources = collectPaletteImageSources(adapter.root);

    expect(itemIds).toContain("sign-type:WoodenSign1");
    expect(itemIds).toContain("sign-type:WoodenSign2");
    expect(imageSources).toContain("/assets/WoodenSign1/WoodenSign1.png");
    expect(imageSources).toContain("/assets/WoodenSign2/WoodenSign2.png");

    adapter.dispose();
  });

  it("renders geodesic ray emitter actions and enables aim", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    adapter.setDefinition(createPaletteDefinition(showRuntimeMenuGeodesicCannonActions(
      createRuntimeMenuState({ selectedWorldId: "cube" }),
      { cannonId: "cannon-a", geodesicIds: ["g-a"] },
    )));

    const itemIds = collectPaletteItemIds(adapter.root);
    const actionIds = collectPaletteActionItemIds(adapter.root);
    const imageSources = collectPaletteImageSources(adapter.root);

    expect(itemIds).toContain("geodesic-cannon-action:add-geodesic");
    expect(itemIds).toContain("geodesic-cannon-action:rotate:g-a");
    expect(itemIds).toContain("geodesic-cannon-action:aim:g-a");
    expect(itemIds).toContain("geodesic-cannon-action:delete:g-a");
    expect(actionIds).toContain("geodesic-cannon-action:add-geodesic");
    expect(actionIds).toContain("geodesic-cannon-action:rotate:g-a");
    expect(actionIds).toContain("geodesic-cannon-action:aim:g-a");
    expect(actionIds).toContain("geodesic-cannon-action:delete:g-a");
    expect(imageSources).toContain("/assets/icons/arrow-circle-inverted.png");
    expect(imageSources).toContain("/assets/icons/aim-inverted.png");

    adapter.dispose();
  });


  it("renders sign editing with fixed number, QWERTY, space, enter, backspace, cursor, and trash controls", () => {
    const adapter = createScenePaletteLibraryAdapter(createNoopOptions());
    const definition = createPaletteDefinition(showRuntimeMenuEditSign(
      createRuntimeMenuState({ selectedWorldId: "cube" }),
      { flagId: "sign-a", message: "A\nB" },
    ));
    adapter.setDefinition(definition);

    const itemIds = collectPaletteItemIds(adapter.root);
    const previewLines = collectSignPreviewLines(adapter.root);

    expect(definition.rightAction.id).toBe("close");
    expect(previewLines).toEqual(["A", "B|", ""]);
    expect(itemIds).toContain("sign-key:1");
    expect(itemIds).toContain("sign-key:0");
    expect(itemIds).toContain("sign-key:Q");
    expect(itemIds).toContain("sign-key:M");
    expect(itemIds).toContain("sign-key:Enter");
    expect(itemIds).toContain("sign-key:Space");
    expect(itemIds).toContain("sign-key:Backspace");
    expect(itemIds).toContain("sign-action:trash");
    expect(itemIds).not.toContain("sign-key:Erase");
    expect(itemIds).not.toContain("sign-key:Shift");
    expect(itemIds).not.toContain("sign-key:CapsLock");
    expect(itemIds).not.toContain("sign-key:Ctrl");
    expect(itemIds).not.toContain("sign-key:Alt");
    expect(itemIds).not.toContain("sign-key:ArrowLeft");
    expect(itemIds).not.toContain("sign-key:ArrowRight");

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

function collectPaletteImageSources(root: { readonly children: readonly any[]; readonly userData?: Record<string, unknown> }): string[] {
  const sources: string[] = [];
  const visit = (node: { readonly children?: readonly any[]; readonly userData?: Record<string, unknown> }) => {
    const src = node.userData?.scenePaletteIconSrc;
    if (typeof src === "string") {
      sources.push(src);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return sources;
}

function collectPaletteActionItemIds(root: { readonly children: readonly any[]; readonly userData?: Record<string, unknown> }): string[] {
  const ids: string[] = [];
  const visit = (node: { readonly children?: readonly any[]; readonly userData?: Record<string, unknown> }) => {
    if (
      typeof node.userData?.scenePaletteItemId === "string" &&
      typeof node.userData?.scenePaletteAction === "function"
    ) {
      ids.push(node.userData.scenePaletteItemId);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return ids;
}

function collectSignPreviewLines(root: { readonly children: readonly any[]; readonly userData?: Record<string, unknown> }): string[] {
  const lines: { readonly index: number; readonly text: string }[] = [];
  const visit = (node: { readonly children?: readonly any[]; readonly userData?: Record<string, unknown> }) => {
    if (
      typeof node.userData?.scenePaletteSignPreviewLine === "number" &&
      typeof node.userData?.scenePaletteSignPreviewText === "string"
    ) {
      lines.push({
        index: node.userData.scenePaletteSignPreviewLine,
        text: node.userData.scenePaletteSignPreviewText,
      });
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return lines.sort((left, right) => left.index - right.index).map((line) => line.text);
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
    onAimCollisionOutlinesToggled: () => undefined,
    onToolSelected: () => undefined,
    onPlaceFlagOptionsRequested: () => undefined,
    onPlaceFlagTypeSelected: () => undefined,
    onSignKeyboardCharacter: () => undefined,
    onSignKeyboardBackspace: () => undefined,
    onSignDeleteRequested: () => undefined,
  };
}

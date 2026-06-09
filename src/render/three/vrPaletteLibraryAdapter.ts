import { Container, Text } from "@pmndrs/uikit";
import type { PaletteDefinition } from "../../ui/paletteDefinition";

export interface VrPaletteLibraryAdapterOptions {
  readonly onLeftAction: (actionId: PaletteDefinition["leftAction"]["id"]) => void;
  readonly onRightAction: (actionId: PaletteDefinition["rightAction"]["id"]) => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
}

export interface VrPaletteLibraryAdapter {
  readonly root: Container;
  setDefinition(definition: PaletteDefinition): void;
  setVisible(visible: boolean): void;
  update(deltaMs: number): void;
  dispose(): void;
}

const panelPixelSize = 0.0012;
const panelWidth = 720;
const panelHeight = 440;
const surfaceColor = "#0f172a";
const sectionColor = "#111827";
const borderColor = "#475569";
const actionColor = "#1d4ed8";
const activeColor = "#0f766e";

export function createVrPaletteLibraryAdapter(options: VrPaletteLibraryAdapterOptions): VrPaletteLibraryAdapter {
  const root = new Container({
    width: panelWidth,
    minHeight: panelHeight,
    pixelSize: panelPixelSize,
    flexDirection: "column",
    borderRadius: 28,
    padding: 24,
    gap: 18,
    backgroundColor: surfaceColor,
    color: "#f8fafc",
    opacity: 1,
    overflow: "hidden",
    pointerEvents: "auto",
    scrollbarColor: "#64748b",
    borderColor,
    borderWidth: 3,
    renderOrder: 999,
    depthTest: false,
    depthWrite: false,
  });
  root.name = "vr-tool-palette";
  root.visible = false;
  root.pointerEventsType = { allow: ["ray"] };

  return {
    root,
    setDefinition(nextDefinition) {
      root.clear();
      root.add(buildHeader(nextDefinition, options));
      root.add(buildContent(nextDefinition, options));
    },
    setVisible(visible) {
      root.visible = visible;
    },
    update(deltaMs) {
      root.update(deltaMs);
    },
    dispose() {
      root.removeFromParent();
      root.dispose();
    },
  };
}

function buildHeader(
  definition: PaletteDefinition,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const header = new Container({
    width: "100%",
    height: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  });

  header.add(createHeaderButton(definition.leftAction.label, definition.leftAction.ariaLabel, definition.leftAction.disabled, () => {
    options.onLeftAction(definition.leftAction.id);
  }));
  header.add(new Text({
    text: definition.pageId === "settings" ? "Settings" : "Tools",
    fontSize: 28,
    fontWeight: "bold",
    color: "#f8fafc",
  }));
  header.add(createHeaderButton(definition.rightAction.label, definition.rightAction.ariaLabel, definition.rightAction.disabled, () => {
    options.onRightAction(definition.rightAction.id);
  }));

  return header;
}

function createHeaderButton(
  label: string,
  ariaLabel: string,
  disabled: boolean,
  onClick: () => void,
): Container {
  const button = createInteractiveSurface({
    width: 64,
    height: 44,
    label,
    onClick,
    disabled,
    backgroundColor: disabled ? "#334155" : actionColor,
  });
  button.name = ariaLabel || "palette-header-action";
  button.userData.xrPaletteItemId = ariaLabel || label;
  return button;
}

function buildContent(
  definition: PaletteDefinition,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  if (definition.content.kind === "empty") {
    const content = new Container({
      width: "100%",
      minHeight: 300,
      borderRadius: 24,
      backgroundColor: sectionColor,
      borderColor,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
    });
    content.add(new Text({
      text: "Tool area reserved",
      color: "#94a3b8",
      fontSize: 22,
    }));
    return content;
  }

  const settings = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 16,
  });

  const worldSection = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  worldSection.add(createSectionLabel("World"));
  const worldList = new Container({
    width: "100%",
    maxHeight: 132,
    flexDirection: "column",
    gap: 8,
    overflow: "scroll",
    paddingRight: 6,
  });
  for (const option of definition.content.worldOptions) {
    worldList.add(createWorldButton(option.id, option.label, option.id === definition.content.selectedWorldId, () => {
      options.onWorldSelected(option.id);
    }));
  }
  worldSection.add(worldList);

  const actionsSection = new Container({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  actionsSection.add(createSectionLabel("Reload world"));
  actionsSection.add(createActionButton("Reload", "reload-world", options.onReloadRequested));

  const overlaySection = new Container({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  const settingsContent = definition.content;
  const labels = settingsContent.debugOverlayItems
    .filter((item) => item.checked)
    .map((item) => item.label)
    .join(", ");
  const labelText = labels.length > 0 ? `Debug overlay (${labels})` : "Debug overlay";
  overlaySection.add(createSectionLabel(labelText));
  const overlaySwitch = createInteractiveSurface({
    width: 118,
    height: 46,
    label: settingsContent.debugOverlayEnabled ? "On" : "Off",
    onClick: () => options.onDebugOverlayToggled(!settingsContent.debugOverlayEnabled),
    backgroundColor: settingsContent.debugOverlayEnabled ? activeColor : "#374151",
  });
  overlaySwitch.userData.xrPaletteItemId = "debug-overlay-toggle";
  overlaySwitch.userData.xrPaletteAction = () => options.onDebugOverlayToggled(!settingsContent.debugOverlayEnabled);
  overlaySection.add(overlaySwitch);

  settings.add(worldSection, actionsSection, overlaySection);
  return settings;
}

function createSectionLabel(text: string): Text {
  return new Text({
    text,
    fontSize: 20,
    fontWeight: "medium",
    color: "#e2e8f0",
  });
}

function createWorldButton(id: string, label: string, active: boolean, onClick: () => void): Container {
  const button = createInteractiveSurface({
    width: "100%",
    height: 44,
    justifyContent: "flex-start",
    paddingLeft: 16,
    backgroundColor: active ? activeColor : "#1f2937",
    label,
    onClick,
  });
  button.userData.xrPaletteItemId = `world:${id}`;
  button.userData.xrPaletteAction = onClick;
  button.add(createButtonText(label, 18));
  return button;
}

function createActionButton(label: string, itemId: string, onClick: () => void): Container {
  const button = createInteractiveSurface({
    width: 128,
    height: 46,
    backgroundColor: actionColor,
    label,
    onClick,
  });
  button.userData.xrPaletteItemId = itemId;
  return button;
}

function createInteractiveSurface(options: {
  readonly width: number | `${number}%` | `${number}px` | "auto";
  readonly height: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly justifyContent?: "center" | "flex-start";
  readonly paddingLeft?: number;
  readonly backgroundColor: string;
}): Container {
  const button = new Container({
    width: options.width,
    height: options.height,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: options.justifyContent ?? "center",
    paddingLeft: options.paddingLeft ?? 0,
    backgroundColor: options.backgroundColor,
    borderColor: "#93c5fd",
    borderWidth: 1,
    opacity: options.disabled ? 0.45 : 1,
    pointerEvents: options.disabled ? "none" : "auto",
    renderOrder: 1001,
    depthTest: false,
    depthWrite: false,
  });
  button.userData.xrPaletteAction = options.disabled ? undefined : options.onClick;
  button.add(createButtonText(options.label, 18));
  return button;
}

function createButtonText(text: string, fontSize: number): Text {
  return new Text({
    text,
    fontSize,
    fontWeight: "bold",
    color: "#f8fafc",
  });
}

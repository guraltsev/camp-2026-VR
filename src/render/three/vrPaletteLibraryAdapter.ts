import { Container, Text } from "@pmndrs/uikit";
import { ArrowLeft, Settings, X } from "@pmndrs/uikit-lucide";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
} from "../../runtime/runtimeMenuState";
import type { PaletteDefinition } from "../../ui/paletteDefinition";

export interface VrPaletteLibraryAdapterOptions {
  readonly onLeftAction: (actionId: PaletteDefinition["leftAction"]["id"]) => void;
  readonly onRightAction: (actionId: PaletteDefinition["rightAction"]["id"]) => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onDebugEnabledChanged: (enabled: boolean) => void;
  readonly onConsoleLogLevelSelected: (level: RuntimeMenuConsoleLogLevelId) => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
  readonly onDebugOverlayItemToggled: (itemId: RuntimeDebugOverlayItemId, enabled: boolean) => void;
  readonly onPortalPanelModeSelected: (mode: PortalPanelModeId) => void;
  readonly onPortalInspectionToggled: (enabled: boolean) => void;
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
const panelHeight = 500;
const surfaceColor = "#0f172a";
const sectionColor = "#111827";
const borderColor = "#475569";
const actionColor = "#1d4ed8";
const activeColor = "#0f766e";
const inactiveColor = "#374151";

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
  }, definition.leftAction.id));
  header.add(new Text({
    text: "",
    fontSize: 28,
    fontWeight: "bold",
    color: "#f8fafc",
  }));
  header.add(createHeaderButton(definition.rightAction.label, definition.rightAction.ariaLabel, definition.rightAction.disabled, () => {
    options.onRightAction(definition.rightAction.id);
  }, definition.rightAction.id));

  return header;
}

function createHeaderButton(
  label: string,
  ariaLabel: string,
  disabled: boolean,
  onClick: () => void,
  actionId: PaletteDefinition["leftAction"]["id"],
): Container {
  const button = createInteractiveSurface({
    width: 64,
    height: 44,
    label: actionId === "none" ? "" : label,
    onClick,
    disabled,
    backgroundColor: disabled ? "#334155" : actionColor,
  });
  button.name = ariaLabel || "palette-header-action";
  button.userData.xrPaletteItemId = ariaLabel || label;
  const icon = createHeaderIcon(actionId);
  if (icon) {
    button.clear();
    button.add(icon);
  }
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
    return content;
  }

  const settings = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 14,
    maxHeight: 388,
    overflow: "scroll",
    paddingRight: 8,
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

  const debugSection = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  debugSection.add(createSectionLabel("Debug"));
  debugSection.add(createToggleRow("Debug tools", definition.content.debugEnabled, (enabled) => {
    options.onDebugEnabledChanged(enabled);
  }, "debug-tools-toggle"));

  if (definition.content.debugEnabled) {
    debugSection.add(createChoiceSection(
      "Console log level",
      definition.content.consoleLogLevelOptions,
      definition.content.consoleLogLevel,
      (id) => options.onConsoleLogLevelSelected(id as RuntimeMenuConsoleLogLevelId),
      "console-log-level",
    ));
    debugSection.add(createToggleRow("UI overlay", definition.content.debugOverlayEnabled, (enabled) => {
      options.onDebugOverlayToggled(enabled);
    }, "debug-overlay-toggle"));

    if (definition.content.debugOverlayEnabled) {
      for (const item of definition.content.debugOverlayItems) {
        debugSection.add(createToggleRow(item.label, item.checked, (enabled) => {
          options.onDebugOverlayItemToggled(item.id, enabled);
        }, `debug-overlay-item:${item.id}`));
      }
    }

    debugSection.add(createChoiceSection(
      "Portal labels",
      definition.content.portalPanelModeOptions,
      definition.content.portalPanelMode,
      (id) => options.onPortalPanelModeSelected(id as PortalPanelModeId),
      "portal-labels",
    ));
    debugSection.add(createToggleRow("Portal inspection tools", definition.content.portalInspectionEnabled, (enabled) => {
      options.onPortalInspectionToggled(enabled);
    }, "portal-inspection-toggle"));
  }

  settings.add(worldSection, actionsSection, debugSection);
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
  return button;
}

function createChoiceSection(
  label: string,
  options: readonly { readonly id: string; readonly label: string }[],
  selectedId: string,
  onSelected: (id: string) => void,
  itemPrefix: string,
): Container {
  const section = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 8,
  });
  section.add(createSectionLabel(label));
  const list = new Container({
    width: "100%",
    maxHeight: 128,
    flexDirection: "column",
    gap: 8,
    overflow: "scroll",
    paddingRight: 6,
  });
  for (const option of options) {
    const button = createInteractiveSurface({
      width: "100%",
      height: 40,
      justifyContent: "flex-start",
      paddingLeft: 16,
      backgroundColor: option.id === selectedId ? activeColor : "#1f2937",
      label: option.label,
      onClick: () => onSelected(option.id),
    });
    button.userData.xrPaletteItemId = `${itemPrefix}:${option.id}`;
    list.add(button);
  }
  section.add(list);
  return section;
}

function createToggleRow(
  label: string,
  enabled: boolean,
  onToggled: (enabled: boolean) => void,
  itemId: string,
): Container {
  const row = new Container({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  });
  row.add(createSectionLabel(label));
  const button = createInteractiveSurface({
    width: 118,
    height: 42,
    label: enabled ? "On" : "Off",
    onClick: () => onToggled(!enabled),
    backgroundColor: enabled ? activeColor : inactiveColor,
  });
  button.userData.xrPaletteItemId = itemId;
  row.add(button);
  return row;
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

function createHeaderIcon(
  actionId: PaletteDefinition["leftAction"]["id"],
): InstanceType<typeof Settings> | InstanceType<typeof X> | InstanceType<typeof ArrowLeft> | undefined {
  const iconProperties = {
    width: 28,
    height: 28,
    color: "#f8fafc",
  };

  switch (actionId) {
    case "settings":
      return new Settings(iconProperties);
    case "close":
      return new X(iconProperties);
    case "back":
      return new ArrowLeft(iconProperties);
    case "none":
      return undefined;
  }
}

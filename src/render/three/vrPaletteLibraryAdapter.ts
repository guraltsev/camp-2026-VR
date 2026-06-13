import { Component, Container, Text } from "@pmndrs/uikit";
import { ArrowLeft, Settings, X } from "@pmndrs/uikit-lucide";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
} from "../../runtime/runtimeMenuState";
import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";
import { resolveVrPaletteHeaderActions } from "./vrPaletteHeaderActions";

export interface VrPaletteLibraryAdapterOptions {
  readonly onLeftAction: (actionId: PaletteDefinition["leftAction"]["id"]) => void;
  readonly onRightAction: (actionId: PaletteDefinition["rightAction"]["id"]) => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onDebugEnabledChanged: (enabled: boolean) => void;
  readonly onDebugSettingsRequested: () => void;
  readonly onConsoleLogLevelSelected: (level: RuntimeMenuConsoleLogLevelId) => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
  readonly onDebugOverlayItemToggled: (itemId: RuntimeDebugOverlayItemId, enabled: boolean) => void;
  readonly onPortalPanelModeSelected: (mode: PortalPanelModeId) => void;
  readonly onPortalInspectionToggled: (enabled: boolean) => void;
  readonly onCollisionGeometryWireframesToggled: (enabled: boolean) => void;
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
const textColor = "#f8fafc";
const mutedTextColor = "#e2e8f0";
const scrollbarColor = "#38bdf8";
const scrollbarBorderColor = "#0f172a";

export function createVrPaletteLibraryAdapter(options: VrPaletteLibraryAdapterOptions): VrPaletteLibraryAdapter {
  let renderedChildren: Container[] = [];
  const root = new Container({
    width: panelWidth,
    height: panelHeight,
    pixelSize: panelPixelSize,
    flexDirection: "column",
    borderRadius: 28,
    padding: 20,
    gap: 12,
    backgroundColor: surfaceColor,
    color: textColor,
    fill: textColor,
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
      disposeRenderedChildren(renderedChildren);
      renderedChildren = [
        buildHeader(nextDefinition, options),
        buildContent(nextDefinition, options),
      ];
      root.add(...renderedChildren);
    },
    setVisible(visible) {
      root.visible = visible;
    },
    update(deltaMs) {
      root.update(deltaMs);
    },
    dispose() {
      disposeRenderedChildren(renderedChildren);
      renderedChildren = [];
      root.removeFromParent();
      root.dispose();
    },
  };
}

function buildHeader(
  definition: PaletteDefinition,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const headerActions = resolveVrPaletteHeaderActions(definition);
  const header = new Container({
    width: "100%",
    height: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  });

  header.add(createHeaderButton(headerActions.leftAction, () => {
    dispatchHeaderAction(headerActions.leftAction.id, options);
  }));
  header.add(new Text({
    text: "",
    fontSize: 28,
    fontWeight: "bold",
    color: textColor,
    fill: textColor,
  }));
  header.add(createHeaderButton(headerActions.rightAction, () => {
    dispatchHeaderAction(headerActions.rightAction.id, options);
  }));

  return header;
}

function createHeaderButton(
  action: PaletteHeaderAction,
  onClick: () => void,
): Container {
  if (action.id === "none") {
    return new Container({
      width: 64,
      height: 44,
      opacity: 0,
      pointerEvents: "none",
    });
  }

  const button = createInteractiveSurface({
    width: 64,
    height: 44,
    label: "",
    onClick,
    disabled: action.disabled,
    backgroundColor: action.disabled ? "#334155" : actionColor,
  });
  button.name = action.ariaLabel || "palette-header-action";
  button.userData.xrPaletteItemId = action.ariaLabel || action.label;
  const icon = createHeaderIcon(action.id);
  if (icon) {
    button.add(icon);
  } else if (action.label) {
    button.add(createButtonText(action.label, 15));
  }
  return button;
}

function dispatchHeaderAction(
  actionId: PaletteHeaderAction["id"],
  options: VrPaletteLibraryAdapterOptions,
): void {
  if (actionId === "none") {
    return;
  }

  if (actionId === "settings") {
    options.onLeftAction(actionId);
    return;
  }

  options.onRightAction(actionId);
}

function buildContent(
  definition: PaletteDefinition,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  if (definition.content.kind === "main" || definition.content.kind === "place-flag-options") {
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

  if (definition.content.kind === "debug-settings") {
    return buildDebugSettingsContent(definition.content, options);
  }

  const settings = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 10,
    height: 400,
    overflow: "scroll",
    paddingRight: 24,
    scrollbarWidth: 14,
    scrollbarColor,
    scrollbarBorderColor,
    scrollbarBorderWidth: 2,
    scrollbarBorderRadius: 7,
    scrollbarZIndex: 1004,
  });

  const worldSection = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  worldSection.add(createSectionLabel("World"));
  worldSection.add(createOptionGrid(
    definition.content.worldOptions,
    definition.content.selectedWorldId,
    "world",
    options.onWorldSelected,
  ));

  const actionsSection = new Container({
    width: "100%",
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
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
    gap: 8,
    padding: 12,
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
    debugSection.add(createActionButton("...", "debug-settings", options.onDebugSettingsRequested));
  }

  settings.add(worldSection, actionsSection, debugSection);
  return settings;
}

function buildDebugSettingsContent(
  content: Extract<PaletteDefinition["content"], { readonly kind: "debug-settings" }>,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const settings = createSettingsScrollContainer();

  const debugSection = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 1,
  });
  debugSection.add(createSectionLabel("Debug"));
    debugSection.add(createChoiceSection(
      "Console log level",
      content.consoleLogLevelOptions,
      content.consoleLogLevel,
      (id) => options.onConsoleLogLevelSelected(id as RuntimeMenuConsoleLogLevelId),
      "console-log-level",
    ));
    debugSection.add(createToggleRow("UI overlay", content.debugOverlayEnabled, (enabled) => {
      options.onDebugOverlayToggled(enabled);
    }, "debug-overlay-toggle"));

    if (content.debugOverlayEnabled) {
      for (const item of content.debugOverlayItems) {
        debugSection.add(createToggleRow(item.label, item.checked, (enabled) => {
          options.onDebugOverlayItemToggled(item.id, enabled);
        }, `debug-overlay-item:${item.id}`));
      }
    }

    debugSection.add(createChoiceSection(
      "Portal labels",
      content.portalPanelModeOptions,
      content.portalPanelMode,
      (id) => options.onPortalPanelModeSelected(id as PortalPanelModeId),
      "portal-labels",
    ));
    debugSection.add(createToggleRow("Portal inspection tools", content.portalInspectionEnabled, (enabled) => {
      options.onPortalInspectionToggled(enabled);
    }, "portal-inspection-toggle"));
    debugSection.add(createToggleRow(
      "Collision geometry wireframes",
      content.collisionGeometryWireframesEnabled,
      (enabled) => {
        options.onCollisionGeometryWireframesToggled(enabled);
      },
      "collision-geometry-wireframes-toggle",
    ));

  settings.add(debugSection);
  return settings;
}

function createSettingsScrollContainer(): Container {
  return new Container({
    width: "100%",
    flexDirection: "column",
    gap: 10,
    height: 400,
    overflow: "scroll",
    paddingRight: 24,
    scrollbarWidth: 14,
    scrollbarColor,
    scrollbarBorderColor,
    scrollbarBorderWidth: 2,
    scrollbarBorderRadius: 7,
    scrollbarZIndex: 1004,
  });
}

function createSectionLabel(text: string): Text {
  return new Text({
    text,
    fontSize: 16,
    fontWeight: "medium",
    color: mutedTextColor,
    fill: mutedTextColor,
    flexShrink: 1,
    wordBreak: "break-word",
  });
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
  section.add(createOptionGrid(options, selectedId, itemPrefix, onSelected));
  return section;
}

function createOptionGrid(
  options: readonly { readonly id: string; readonly label: string }[],
  selectedId: string,
  itemPrefix: string,
  onSelected: (id: string) => void,
): Container {
  const grid = new Container({
    width: "100%",
    flexDirection: "column",
    gap: 6,
  });

  for (let index = 0; index < options.length; index += 2) {
    const row = new Container({
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    });

    for (const option of options.slice(index, index + 2)) {
      const button = createInteractiveSurface({
        width: "49%",
        height: 34,
        justifyContent: "flex-start",
        paddingLeft: 12,
        backgroundColor: option.id === selectedId ? activeColor : "#1f2937",
        label: option.label,
        labelFontSize: 15,
        onClick: () => onSelected(option.id),
      });
      button.userData.xrPaletteItemId = `${itemPrefix}:${option.id}`;
      row.add(button);
    }

    grid.add(row);
  }

  return grid;
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
    width: 96,
    height: 34,
    label: enabled ? "On" : "Off",
    labelFontSize: 15,
    onClick: () => onToggled(!enabled),
    backgroundColor: enabled ? activeColor : inactiveColor,
  });
  button.userData.xrPaletteItemId = itemId;
  row.add(button);
  return row;
}

function createActionButton(label: string, itemId: string, onClick: () => void): Container {
  const button = createInteractiveSurface({
    width: 112,
    height: 36,
    backgroundColor: actionColor,
    label,
    labelFontSize: 15,
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
  readonly labelFontSize?: number;
}): Container {
  const button = new Container({
    width: options.width,
    height: options.height,
    borderRadius: 12,
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
  if (options.label) {
    button.add(createButtonText(options.label, options.labelFontSize ?? 15));
  }
  return button;
}

function createButtonText(text: string, fontSize: number): Text {
  return new Text({
    text,
    fontSize,
    fontWeight: "bold",
    color: textColor,
    fill: textColor,
    flexShrink: 1,
    wordBreak: "break-word",
  });
}

function createHeaderIcon(
  actionId: PaletteDefinition["leftAction"]["id"],
): InstanceType<typeof Settings> | InstanceType<typeof X> | InstanceType<typeof ArrowLeft> | undefined {
  const iconProperties = {
    width: 28,
    height: 28,
    color: textColor,
    fill: textColor,
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

function disposeRenderedChildren(children: readonly Container[]): void {
  for (const child of children) {
    disposeComponentTree(child);
  }
}

function disposeComponentTree(component: Component<any>): void {
  for (const child of [...component.children]) {
    if (child instanceof Component) {
      disposeComponentTree(child);
    }
  }
  component.dispose();
}

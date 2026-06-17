import { Component, Container, Image, Text } from "@pmndrs/uikit";
import { ArrowLeft, Settings, Trash2, X } from "@pmndrs/uikit-lucide";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
  RuntimeToolId,
} from "../../runtime/runtimeMenuState";
import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";
import type { PlacedFlagType } from "../../world-objects/placedFlags";
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
  readonly onAimCollisionOutlinesToggled: (enabled: boolean) => void;
  readonly onToolSelected?: (toolId: RuntimeToolId) => void;
  readonly onPlaceFlagOptionsRequested?: () => void;
  readonly onPlaceFlagTypeSelected?: (flagType: PlacedFlagType) => void;
  readonly onGeodesicCannonAddRequested?: (cannonId: string) => void;
  readonly onGeodesicCannonRotateRequested?: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonAimRequested?: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonDeleteRequested?: (cannonId: string, geodesicId: string) => void;
  readonly onSignKeyboardCharacter?: (character: string) => void;
  readonly onSignKeyboardBackspace?: () => void;
  readonly onSignDeleteRequested?: () => void;
}

export interface VrPaletteLibraryAdapter {
  readonly root: Container;
  setDefinition(definition: PaletteDefinition): void;
  setVisible(visible: boolean): void;
  update(deltaMs: number): void;
  dispose(): void;
}

export type ScenePaletteLibraryAdapterOptions = VrPaletteLibraryAdapterOptions;
export type ScenePaletteLibraryAdapter = VrPaletteLibraryAdapter;

const panelPixelSize = 0.0012;
const panelWidth = 780;
const panelHeight = 560;
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
const signIconSources: Record<PlacedFlagType, string> = {
  WoodenSign1: "/assets/WoodenSign1/WoodenSign1.png",
  WoodenSign2: "/assets/WoodenSign2/WoodenSign2.png",
};
const rotateIconSource = "/assets/icons/arrow-circle-inverted.png";
const aimIconSource = "/assets/icons/aim-inverted.png";
const lockIconSource = "/assets/icons/lock.png";
const rayToolIconSource = "/assets/flashlight/Lightsaber.png";
const protractorToolIconSource = "/assets/icons/protractor.png";
const signTypeLabels: Record<PlacedFlagType, string> = {
  WoodenSign1: "Wooden Sign 1",
  WoodenSign2: "Wooden Sign 2",
};
const signKeyboardRows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
] as const;

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

export const createScenePaletteLibraryAdapter = createVrPaletteLibraryAdapter;

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
  if (definition.content.kind === "main") {
    return buildMainContent(definition.content, options);
  }

  if (definition.content.kind === "place-flag-options") {
    return buildPlaceSignOptionsContent(definition.content, options);
  }

  if (definition.content.kind === "edit-sign") {
    return buildEditSignContent(definition.content, options);
  }

  if (definition.content.kind === "geodesic-cannon-actions") {
    return buildGeodesicCannonActionsContent(definition.content, options);
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

function buildMainContent(
  content: Extract<PaletteDefinition["content"], { readonly kind: "main" }>,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const panel = new Container({
    width: "100%",
    minHeight: 300,
    flexDirection: "column",
    gap: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 2,
  });

  const row = new Container({
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  });
  row.add(
    createToolTile("place-flag", "Sign", content.selectedTool, options, content.placeFlagType),
    createToolTile("geodesic-cannon", "Ray", content.selectedTool, options),
    createToolTile("protractor", "Protractor", content.selectedTool, options),
  );

  panel.add(row);
  return panel;
}

function buildGeodesicCannonActionsContent(
  content: Extract<PaletteDefinition["content"], { readonly kind: "geodesic-cannon-actions" }>,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const panel = new Container({
    width: "100%",
    minHeight: 382,
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 2,
  });
  panel.add(createSectionLabel("Geodesic emitter"));

  const list = new Container({
    width: "100%",
    height: 316,
    flexDirection: "column",
    gap: 8,
    overflow: "scroll",
    paddingRight: 18,
    scrollbarWidth: 12,
    scrollbarColor,
    scrollbarBorderColor,
    scrollbarBorderWidth: 2,
    scrollbarBorderRadius: 6,
    scrollbarZIndex: 1004,
  });

  for (const geodesic of content.geodesics) {
    const row = new Container({
      width: "100%",
      height: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: 8,
      borderRadius: 14,
      backgroundColor: inactiveColor,
      borderColor,
      borderWidth: 1,
    });
    row.add(createButtonText(geodesic.label, 18));

    const deleteButton = createInteractiveSurface({
      width: 46,
      height: 42,
      label: "",
      disabled: geodesic.deleteDisabled,
      backgroundColor: geodesic.deleteDisabled ? "#334155" : "#7f1d1d",
      onClick: () => options.onGeodesicCannonDeleteRequested?.(content.cannonId, geodesic.id),
    });
    deleteButton.userData.xrPaletteItemId = `geodesic-cannon-action:delete:${geodesic.id}`;
    deleteButton.userData.scenePaletteItemId = `geodesic-cannon-action:delete:${geodesic.id}`;
    deleteButton.add(new Trash2({
      width: 24,
      height: 24,
      color: textColor,
      fill: textColor,
    }));

    if (geodesic.locked) {
      const status = createInteractiveSurface({
        width: 252,
        height: 42,
        label: "",
        labelFontSize: 15,
        disabled: true,
        backgroundColor: "#334155",
        onClick: () => {},
      });
      status.name = geodesic.connectionSymbolLabel ?? "Locked geodesic segment between emitters";
      status.add(createLockedGeodesicSegmentStatus());
      row.add(status, deleteButton);
    } else {
      const rotateButton = createInteractiveSurface({
        width: 132,
        height: 42,
        label: "Rotate",
        labelFontSize: 16,
        disabled: false,
        backgroundColor: actionColor,
        onClick: () => options.onGeodesicCannonRotateRequested?.(content.cannonId, geodesic.id),
      });
      rotateButton.userData.xrPaletteItemId = `geodesic-cannon-action:rotate:${geodesic.id}`;
      rotateButton.userData.scenePaletteItemId = `geodesic-cannon-action:rotate:${geodesic.id}`;
      rotateButton.add(createGeodesicCannonActionIcon("rotate"));

      const aimButton = createInteractiveSurface({
        width: 112,
        height: 42,
        label: "Aim",
        labelFontSize: 16,
        disabled: false,
        backgroundColor: actionColor,
        onClick: () => options.onGeodesicCannonAimRequested?.(content.cannonId, geodesic.id),
      });
      aimButton.userData.xrPaletteItemId = `geodesic-cannon-action:aim:${geodesic.id}`;
      aimButton.userData.scenePaletteItemId = `geodesic-cannon-action:aim:${geodesic.id}`;
      aimButton.add(createGeodesicCannonActionIcon("aim"));

      row.add(rotateButton, aimButton, deleteButton);
    }
    list.add(row);
  }

  const addButton = createInteractiveSurface({
    width: "100%",
    height: 50,
    label: content.addAction.label,
    labelFontSize: 17,
    justifyContent: "flex-start",
    paddingLeft: 18,
    disabled: content.addAction.disabled,
    backgroundColor: content.addAction.disabled ? "#334155" : "#2563eb",
    onClick: () => options.onGeodesicCannonAddRequested?.(content.cannonId),
  });
  addButton.userData.xrPaletteItemId = "geodesic-cannon-action:add-geodesic";
  addButton.userData.scenePaletteItemId = "geodesic-cannon-action:add-geodesic";
  addButton.add(createButtonText("+", 24));
  list.add(addButton);

  panel.add(list);
  return panel;
}

function buildPlaceSignOptionsContent(
  content: Extract<PaletteDefinition["content"], { readonly kind: "place-flag-options" }>,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const panel = new Container({
    width: "100%",
    minHeight: 300,
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 2,
  });
  panel.add(createSectionLabel("Sign type"));

  const grid = new Container({
    width: "100%",
    flexDirection: "row",
    gap: 12,
  });
  for (const option of content.flagTypeOptions) {
    const tile = createInteractiveSurface({
      width: "49%",
      height: 150,
      label: "",
      labelFontSize: 17,
      flexDirection: "column",
      backgroundColor: option.id === content.selectedFlagType ? activeColor : inactiveColor,
      onClick: () => options.onPlaceFlagTypeSelected?.(option.id as PlacedFlagType),
    });
    const signType = option.id as PlacedFlagType;
    tile.userData.xrPaletteItemId = `sign-type:${option.id}`;
    tile.userData.scenePaletteItemId = `sign-type:${option.id}`;
    tile.add(createSignImage(signType, 92), createButtonText(signTypeLabels[signType], 15));
    grid.add(tile);
  }

  panel.add(grid);
  return panel;
}

function buildEditSignContent(
  content: Extract<PaletteDefinition["content"], { readonly kind: "edit-sign" }>,
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const panel = new Container({
    width: "100%",
    minHeight: 382,
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 24,
    backgroundColor: sectionColor,
    borderColor,
    borderWidth: 2,
  });

  const preview = new Container({
    width: "100%",
    height: 96,
    flexDirection: "column",
    justifyContent: "center",
    gap: 4,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#020617",
    borderColor,
    borderWidth: 1,
  });
  preview.add(
    createSectionLabel(`Sign text ${content.message.length}/${content.maxLength}`),
    createSignPreviewLines(content.message),
  );
  panel.add(preview);

  for (const row of signKeyboardRows) {
    panel.add(createKeyboardRow(row, options));
  }

  const backspaceRow = new Container({
    width: "100%",
    height: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  });
  const enter = createInteractiveSurface({
    width: 132,
    height: 42,
    label: "Enter",
    labelFontSize: 15,
    backgroundColor: actionColor,
    onClick: () => options.onSignKeyboardCharacter?.("\n"),
  });
  enter.userData.xrPaletteItemId = "sign-key:Enter";
  enter.userData.scenePaletteItemId = "sign-key:Enter";
  const space = createInteractiveSurface({
    width: 156,
    height: 42,
    label: "Space",
    labelFontSize: 15,
    backgroundColor: inactiveColor,
    onClick: () => options.onSignKeyboardCharacter?.(" "),
  });
  space.userData.xrPaletteItemId = "sign-key:Space";
  space.userData.scenePaletteItemId = "sign-key:Space";
  const trash = createInteractiveSurface({
    width: 132,
    height: 42,
    label: "",
    labelFontSize: 15,
    backgroundColor: "#7f1d1d",
    onClick: () => options.onSignDeleteRequested?.(),
  });
  trash.userData.xrPaletteItemId = "sign-action:trash";
  trash.userData.scenePaletteItemId = "sign-action:trash";
  trash.add(new Trash2({
    width: 24,
    height: 24,
    color: textColor,
    fill: textColor,
  }));
  const backspace = createInteractiveSurface({
    width: 156,
    height: 42,
    label: "Backspace",
    labelFontSize: 15,
    backgroundColor: "#991b1b",
    onClick: () => options.onSignKeyboardBackspace?.(),
  });
  backspace.userData.xrPaletteItemId = "sign-key:Backspace";
  backspace.userData.scenePaletteItemId = "sign-key:Backspace";
  backspaceRow.add(enter, space, backspace, trash);
  panel.add(backspaceRow);

  return panel;
}

function createSignPreviewLines(message: string): Container {
  const allLines = message.split("\n");
  const cursorLineIndex = allLines.length - 1;
  const firstVisibleLine = Math.max(0, cursorLineIndex - 2);
  const lines = allLines.slice(firstVisibleLine, firstVisibleLine + 3);
  while (lines.length < 3) {
    lines.push("");
  }

  const block = new Container({
    width: "100%",
    height: 62,
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
  });

  for (let index = 0; index < 3; index += 1) {
    const sourceLineIndex = firstVisibleLine + index;
    const line = lines[index] ?? "";
    const displayLine = sourceLineIndex === cursorLineIndex ? `${line}|` : line;
    const text = new Text({
      text: displayLine || " ",
      fontSize: 18,
      fontWeight: "bold",
      color: textColor,
      fill: textColor,
      flexShrink: 1,
      wordBreak: "break-word",
    });
    text.userData.scenePaletteSignPreviewLine = index;
    text.userData.scenePaletteSignPreviewText = displayLine;
    block.add(text);
  }

  return block;
}

function createKeyboardRow(
  keys: readonly string[],
  options: VrPaletteLibraryAdapterOptions,
): Container {
  const row = new Container({
    width: "100%",
    height: 38,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  });

  for (const key of keys) {
    const button = createInteractiveSurface({
      width: 48,
      height: 38,
      label: key,
      labelFontSize: 16,
      backgroundColor: inactiveColor,
      onClick: () => options.onSignKeyboardCharacter?.(key),
    });
    button.userData.xrPaletteItemId = `sign-key:${key}`;
    button.userData.scenePaletteItemId = `sign-key:${key}`;
    row.add(button);
  }

  return row;
}

function createToolTile(
  toolId: RuntimeToolId,
  label: string,
  selectedTool: RuntimeToolId,
  options: VrPaletteLibraryAdapterOptions,
  signType?: PlacedFlagType,
): Container {
  const selected = toolId === selectedTool;
  const button = createInteractiveSurface({
    width: "49%",
    height: 150,
    label: "",
    labelFontSize: 18,
    positionType: "relative",
    flexDirection: "column",
    backgroundColor: selected ? activeColor : inactiveColor,
    onClick: () => options.onToolSelected?.(toolId),
  });
  button.userData.xrPaletteItemId = `tool:${toolId}`;
  button.userData.scenePaletteItemId = `tool:${toolId}`;
  button.add(createToolIcon(toolId, signType), createButtonText(label, 16));
  if (toolId === "place-flag") {
    button.add(createSignOptionsButton(options));
  }
  return button;
}

function createToolIcon(
  toolId: RuntimeToolId,
  signType: PlacedFlagType | undefined,
): Component<any> {
  if (toolId === "place-flag") {
    return createSignIcon(signType ?? "WoodenSign1");
  }

  if (toolId === "geodesic-cannon") {
    return createRayIcon();
  }

  if (toolId === "protractor") {
    return createProtractorIcon();
  }

  return new Container({ width: 64, height: 64, opacity: 0 });
}

function createRayIcon(): Component<any> {
  const image = new Image({
    src: rayToolIconSource,
    width: 88,
    height: 88,
    objectFit: "fill",
    keepAspectRatio: true,
    depthTest: false,
    depthWrite: false,
    renderOrder: 1002,
  });
  image.userData.scenePaletteIconSrc = rayToolIconSource;
  return image;
}

function createProtractorIcon(): Component<any> {
  const image = new Image({
    src: protractorToolIconSource,
    width: 88,
    height: 88,
    objectFit: "fill",
    keepAspectRatio: true,
    depthTest: false,
    depthWrite: false,
    renderOrder: 1002,
  });
  image.userData.scenePaletteIconSrc = protractorToolIconSource;
  return image;
}

function createGeodesicCannonActionIcon(actionId: "add-geodesic" | "rotate" | "aim"): Component<any> {
  const source = actionId === "rotate" || actionId === "add-geodesic" ? rotateIconSource : aimIconSource;
  const image = new Image({
    src: source,
    width: 28,
    height: 28,
    objectFit: "fill",
    keepAspectRatio: true,
    depthTest: false,
    depthWrite: false,
    renderOrder: 1002,
  });
  image.userData.scenePaletteIconSrc = source;
  return image;
}

function createLockedGeodesicSegmentStatus(): Container {
  const status = new Container({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 168,
    height: 28,
  });

  status.add(
    createLockedGeodesicSegmentEmitter(),
    createLockedGeodesicSegmentLine(),
    createLockIcon(),
    createLockedGeodesicSegmentLine(),
    createLockedGeodesicSegmentEmitter(),
  );
  return status;
}

function createLockedGeodesicSegmentEmitter(): Container {
  return new Container({
    width: 4,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
  });
}

function createLockedGeodesicSegmentLine(): Container {
  return new Container({
    width: 50,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
  });
}

function createLockIcon(): Component<any> {
  const image = new Image({
    src: lockIconSource,
    width: 22,
    height: 22,
    marginLeft: 8,
    marginRight: 8,
    objectFit: "fill",
    keepAspectRatio: true,
    depthTest: false,
    depthWrite: false,
    renderOrder: 1002,
  });
  image.userData.scenePaletteIconSrc = lockIconSource;
  return image;
}

function createSignIcon(signType: PlacedFlagType): Container {
  const icon = new Container({
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  });
  icon.add(createSignImage(signType, 82));
  return icon;
}

function createSignOptionsButton(options: VrPaletteLibraryAdapterOptions): Container {
  const optionsButton = createInteractiveSurface({
    width: 34,
    height: 24,
    label: "...",
    labelFontSize: 13,
    positionType: "absolute",
    positionTop: 8,
    positionRight: 8,
    zIndexOffset: 8,
    backgroundColor: "#0f172a",
    onClick: () => options.onPlaceFlagOptionsRequested?.(),
  });
  optionsButton.userData.xrPaletteItemId = "tool-options:place-sign";
  optionsButton.userData.scenePaletteItemId = "tool-options:place-sign";
  return optionsButton;
}

function createSignImage(signType: PlacedFlagType, size: number): Component<any> {
  const image = new Image({
    src: signIconSources[signType],
    width: size,
    height: size,
    objectFit: "fill",
    keepAspectRatio: true,
    depthTest: false,
    depthWrite: false,
    renderOrder: 1002,
  });
  image.userData.scenePaletteIconSrc = signIconSources[signType];
  return image;
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
    debugSection.add(createToggleRow(
      "Aim collision outlines",
      content.aimCollisionOutlinesEnabled,
      (enabled) => {
        options.onAimCollisionOutlinesToggled(enabled);
      },
      "aim-collision-outlines-toggle",
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
      button.userData.scenePaletteItemId = `${itemPrefix}:${option.id}`;
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
  button.userData.scenePaletteItemId = itemId;
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
  button.userData.scenePaletteItemId = itemId;
  return button;
}

function createInteractiveSurface(options: {
  readonly width: number | `${number}%` | `${number}px` | "auto";
  readonly height: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly flexDirection?: "row" | "column";
  readonly positionType?: "static" | "relative" | "absolute";
  readonly positionTop?: number;
  readonly positionRight?: number;
  readonly positionBottom?: number;
  readonly zIndexOffset?: number;
  readonly justifyContent?: "center" | "flex-start";
  readonly paddingLeft?: number;
  readonly backgroundColor: string;
  readonly labelFontSize?: number;
}): Container {
  const button = new Container({
    width: options.width,
    height: options.height,
    positionType: options.positionType,
    positionTop: options.positionTop,
    positionRight: options.positionRight,
    positionBottom: options.positionBottom,
    zIndexOffset: options.zIndexOffset,
    borderRadius: 12,
    flexDirection: options.flexDirection ?? "row",
    gap: options.label ? 8 : 10,
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
  button.userData.scenePaletteAction = options.disabled ? undefined : options.onClick;
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

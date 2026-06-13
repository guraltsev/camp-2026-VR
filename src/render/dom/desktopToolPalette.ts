import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDesktopToolId,
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
} from "../../runtime/runtimeMenuState";
import type { PlacedFlagType } from "../../world-objects/placedFlags";

export interface DesktopPaletteView {
  readonly pageId: PaletteDefinition["pageId"];
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly content:
    | {
      readonly kind: "main";
      readonly selectedTool: RuntimeDesktopToolId;
      readonly placeFlagType: PlacedFlagType;
    }
    | {
      readonly kind: "settings";
      readonly selectedWorldId: string;
      readonly worldLabel?: string;
      readonly debugEnabled: boolean;
    }
    | {
      readonly kind: "debug-settings";
      readonly consoleLogLevel: RuntimeMenuConsoleLogLevelId;
      readonly debugOverlayEnabled: boolean;
      readonly debugOverlayLabels: readonly string[];
      readonly portalPanelMode: string;
      readonly portalInspectionEnabled: boolean;
      readonly collisionGeometryWireframesEnabled: boolean;
    }
    | {
      readonly kind: "place-flag-options";
      readonly selectedFlagType: PlacedFlagType;
      readonly flagTypeLabels: readonly string[];
    };
}

export interface DesktopToolPaletteOptions {
  readonly onLeftAction: (actionId: PaletteHeaderAction["id"]) => void;
  readonly onRightAction: (actionId: PaletteHeaderAction["id"]) => void;
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
  readonly onToolSelected: (toolId: RuntimeDesktopToolId) => void;
  readonly onPlaceFlagOptionsRequested: () => void;
  readonly onPlaceFlagTypeSelected: (flagType: PlacedFlagType) => void;
  readonly onResumeRequested: () => void;
}

export interface DesktopToolPalette {
  readonly root: HTMLDivElement;
  setDefinition(definition: PaletteDefinition): void;
  setOpen(isOpen: boolean): void;
  setResumePromptVisible(visible: boolean): void;
  contains(target: EventTarget | null): boolean;
  dispose(): void;
}

export function createDesktopToolPalette(
  container: HTMLElement,
  options: DesktopToolPaletteOptions,
): DesktopToolPalette {
  const root = document.createElement("div");
  root.className = "desktop-tool-palette-shell";
  root.hidden = true;

  const panel = document.createElement("section");
  panel.className = "desktop-tool-palette";
  panel.ariaLabel = "Tool palette";
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "desktop-tool-palette-header";

  const leftButton = document.createElement("button");
  leftButton.type = "button";
  leftButton.className = "desktop-tool-palette-action";
  leftButton.addEventListener("click", () => {
    const actionId = leftButton.dataset.actionId as PaletteHeaderAction["id"] | undefined;

    if (actionId) {
      options.onLeftAction(actionId);
    }
  });

  const title = document.createElement("div");
  title.className = "desktop-tool-palette-title";
  title.setAttribute("aria-hidden", "true");

  const rightButton = document.createElement("button");
  rightButton.type = "button";
  rightButton.className = "desktop-tool-palette-action";
  rightButton.addEventListener("click", () => {
    const actionId = rightButton.dataset.actionId as PaletteHeaderAction["id"] | undefined;

    if (actionId) {
      options.onRightAction(actionId);
    }
  });

  header.append(leftButton, title, rightButton);

  const content = document.createElement("div");
  content.className = "desktop-tool-palette-content";

  const resumePrompt = document.createElement("button");
  resumePrompt.type = "button";
  resumePrompt.className = "desktop-palette-resume";
  resumePrompt.hidden = true;
  resumePrompt.textContent = "Click to resume look";

  root.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  root.addEventListener("click", (event) => {
    if (resumePrompt.hidden || !panel.hidden) {
      return;
    }

    event.preventDefault();
    options.onResumeRequested();
  });

  panel.append(header, content);
  root.append(panel, resumePrompt);
  container.append(root);

  return {
    root,
    setDefinition(definition) {
      const view = describeDesktopPaletteView(definition);
      title.textContent = "";
      syncActionButton(leftButton, view.leftAction);
      syncActionButton(rightButton, view.rightAction);
      content.replaceChildren(renderContent(definition, options));
    },
    setOpen(isOpen) {
      root.hidden = !isOpen && resumePrompt.hidden;
      panel.hidden = !isOpen;
      root.classList.toggle("desktop-tool-palette-shell-open", isOpen);
      root.classList.toggle("desktop-tool-palette-shell-resume", false);
    },
    setResumePromptVisible(visible) {
      resumePrompt.hidden = !visible;
      root.hidden = panel.hidden && !visible;
      root.classList.toggle("desktop-tool-palette-shell-resume", visible);
    },
    contains(target) {
      return target instanceof Node && panel.contains(target);
    },
    dispose() {
      root.remove();
    },
  };
}

export function describeDesktopPaletteView(definition: PaletteDefinition): DesktopPaletteView {
  if (definition.content.kind === "settings") {
    const content = definition.content;
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "settings",
        selectedWorldId: content.selectedWorldId,
        worldLabel: content.worldOptions.find((option) => option.id === content.selectedWorldId)?.label,
        debugEnabled: content.debugEnabled,
      },
    };
  }

  if (definition.content.kind === "debug-settings") {
    const content = definition.content;
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "debug-settings",
        consoleLogLevel: content.consoleLogLevel,
        debugOverlayEnabled: content.debugOverlayEnabled,
        debugOverlayLabels: content.debugOverlayItems
          .filter((item) => item.checked)
          .map((item) => item.label),
        portalPanelMode: content.portalPanelMode,
        portalInspectionEnabled: content.portalInspectionEnabled,
        collisionGeometryWireframesEnabled: content.collisionGeometryWireframesEnabled,
      },
    };
  }

  if (definition.content.kind === "place-flag-options") {
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "place-flag-options",
        selectedFlagType: definition.content.selectedFlagType,
        flagTypeLabels: definition.content.flagTypeOptions.map((option) => option.label),
      },
    };
  }

  return {
    pageId: definition.pageId,
    leftAction: definition.leftAction,
    rightAction: definition.rightAction,
    content: {
      kind: "main",
      selectedTool: definition.content.kind === "main" ? definition.content.selectedTool : "none",
      placeFlagType: definition.content.kind === "main" ? definition.content.placeFlagType : "WoodenSign1",
    },
  };
}

function syncActionButton(button: HTMLButtonElement, action: PaletteHeaderAction): void {
  button.dataset.actionId = action.disabled ? "" : action.id;
  button.textContent = action.label;
  button.ariaLabel = action.ariaLabel;
  button.disabled = action.disabled;
  button.hidden = false;
  button.style.visibility = action.disabled ? "hidden" : "visible";
}

function renderContent(definition: PaletteDefinition, options: DesktopToolPaletteOptions): HTMLElement {
  if (definition.content.kind === "main") {
    const mainContent = definition.content;
    const tools = document.createElement("div");
    tools.className = "desktop-tool-palette-tool-grid";

    const flagTile = document.createElement("div");
    flagTile.className = "desktop-tool-tile-wrap";

    const flagButton = document.createElement("button");
    flagButton.type = "button";
    flagButton.className = "desktop-tool-tile";
    flagButton.classList.toggle("desktop-tool-tile-selected", mainContent.selectedTool === "place-flag");
    flagButton.ariaLabel = "Place flags";
    flagButton.ariaPressed = String(mainContent.selectedTool === "place-flag");
    flagButton.addEventListener("click", () => {
      options.onToolSelected(mainContent.selectedTool === "place-flag" ? "none" : "place-flag");
    });

    const icon = createFlagTileIcon(mainContent.placeFlagType);
    const label = document.createElement("span");
    label.className = "desktop-tool-tile-label";
    label.textContent = "flags";
    flagButton.append(icon, label);

    const optionsButton = document.createElement("button");
    optionsButton.type = "button";
    optionsButton.className = "desktop-tool-tile-options";
    optionsButton.textContent = "\u2699";
    optionsButton.ariaLabel = "Choose flag type";
    optionsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onPlaceFlagOptionsRequested();
    });

    flagTile.append(flagButton, optionsButton);
    tools.append(flagTile);
    return tools;
  }

  if (definition.content.kind === "place-flag-options") {
    const settings = document.createElement("div");
    settings.className = "desktop-tool-palette-tool-grid";

    for (const option of definition.content.flagTypeOptions) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "desktop-tool-tile";
      tile.classList.toggle("desktop-tool-tile-selected", option.id === definition.content.selectedFlagType);
      tile.ariaLabel = `Select ${option.label}`;
      tile.ariaPressed = String(option.id === definition.content.selectedFlagType);
      tile.addEventListener("click", () => {
        options.onPlaceFlagTypeSelected(option.id as PlacedFlagType);
      });

      const label = document.createElement("span");
      label.className = "desktop-tool-tile-label";
      label.textContent = option.label;
      tile.append(createFlagTileIcon(option.id as PlacedFlagType), label);
      settings.append(tile);
    }

    return settings;
  }

  if (definition.content.kind === "settings") {
    const settings = document.createElement("div");
    settings.className = "desktop-tool-palette-settings";

    const worldField = document.createElement("label");
    worldField.className = "desktop-tool-palette-field";

    const worldLabel = document.createElement("span");
    worldLabel.className = "desktop-tool-palette-field-label";
    worldLabel.textContent = "World";

    const worldSelect = document.createElement("select");
    worldSelect.className = "desktop-tool-palette-select";
    worldSelect.ariaLabel = "World";

    for (const option of definition.content.worldOptions) {
      const item = document.createElement("option");
      item.value = option.id;
      item.textContent = option.label;
      item.selected = option.id === definition.content.selectedWorldId;
      worldSelect.append(item);
    }

    worldSelect.addEventListener("change", () => {
      options.onWorldSelected(worldSelect.value);
    });

    worldField.append(worldLabel, worldSelect);

    const reloadButton = document.createElement("button");
    reloadButton.type = "button";
    reloadButton.className = "desktop-tool-palette-button";
    reloadButton.textContent = "Reload";
    reloadButton.addEventListener("click", () => options.onReloadRequested());

    const debugSection = document.createElement("section");
    debugSection.className = "desktop-tool-palette-section";

    const debugHeading = document.createElement("span");
    debugHeading.className = "desktop-tool-palette-field-label";
    debugHeading.textContent = "Debug";
    debugSection.append(debugHeading);

    const debugToggle = document.createElement("label");
    debugToggle.className = "desktop-tool-palette-toggle";

    const debugEnabledCheckbox = document.createElement("input");
    debugEnabledCheckbox.type = "checkbox";
    debugEnabledCheckbox.checked = definition.content.debugEnabled;
    debugEnabledCheckbox.addEventListener("change", () => {
      options.onDebugEnabledChanged(debugEnabledCheckbox.checked);
    });

    const debugToggleCopy = document.createElement("span");
    debugToggleCopy.textContent = "Debug tools";

    debugToggle.append(debugEnabledCheckbox, debugToggleCopy);
    debugSection.append(debugToggle);

    if (definition.content.debugEnabled) {
      const debugDetailsButton = document.createElement("button");
      debugDetailsButton.type = "button";
      debugDetailsButton.className = "desktop-tool-palette-button";
      debugDetailsButton.textContent = "...";
      debugDetailsButton.ariaLabel = "Open debug settings";
      debugDetailsButton.addEventListener("click", () => options.onDebugSettingsRequested());
      debugSection.append(debugDetailsButton);
    }

    settings.append(worldField, reloadButton, debugSection);
    return settings;
  }

  if (definition.content.kind === "debug-settings") {
    const settings = document.createElement("div");
    settings.className = "desktop-tool-palette-settings";

    const debugSection = document.createElement("section");
    debugSection.className = "desktop-tool-palette-section";

    const debugHeading = document.createElement("span");
    debugHeading.className = "desktop-tool-palette-field-label";
    debugHeading.textContent = "Debug";
    debugSection.append(debugHeading);

      const consoleField = document.createElement("label");
      consoleField.className = "desktop-tool-palette-field";

      const consoleLabel = document.createElement("span");
      consoleLabel.className = "desktop-tool-palette-field-label";
      consoleLabel.textContent = "Console log level";

      const consoleSelect = document.createElement("select");
      consoleSelect.className = "desktop-tool-palette-select";
      consoleSelect.ariaLabel = "Console log level";

      for (const option of definition.content.consoleLogLevelOptions) {
        const item = document.createElement("option");
        item.value = option.id;
        item.textContent = option.label;
        item.selected = option.id === definition.content.consoleLogLevel;
        consoleSelect.append(item);
      }

      consoleSelect.addEventListener("change", () => {
        options.onConsoleLogLevelSelected(consoleSelect.value as RuntimeMenuConsoleLogLevelId);
      });

      consoleField.append(consoleLabel, consoleSelect);
      debugSection.append(consoleField);

      const overlayField = document.createElement("div");
      overlayField.className = "desktop-tool-palette-field";

      const overlayToggle = document.createElement("label");
      overlayToggle.className = "desktop-tool-palette-toggle";

      const debugCheckbox = document.createElement("input");
      debugCheckbox.type = "checkbox";
      debugCheckbox.checked = definition.content.debugOverlayEnabled;
      debugCheckbox.addEventListener("change", () => {
        options.onDebugOverlayToggled(debugCheckbox.checked);
      });

      const debugText = document.createElement("span");
      debugText.textContent = "UI overlay";

      overlayToggle.append(debugCheckbox, debugText);
      overlayField.append(overlayToggle);

      if (definition.content.debugOverlayEnabled) {
        const overlayItems = document.createElement("div");
        overlayItems.className = "desktop-tool-palette-suboptions";

        for (const item of definition.content.debugOverlayItems) {
          const itemToggle = document.createElement("label");
          itemToggle.className = "desktop-tool-palette-toggle";

          const itemCheckbox = document.createElement("input");
          itemCheckbox.type = "checkbox";
          itemCheckbox.checked = item.checked;
          itemCheckbox.addEventListener("change", () => {
            options.onDebugOverlayItemToggled(item.id, itemCheckbox.checked);
          });

          const itemText = document.createElement("span");
          itemText.textContent = item.label;

          itemToggle.append(itemCheckbox, itemText);
          overlayItems.append(itemToggle);
        }

        overlayField.append(overlayItems);
      }

      debugSection.append(overlayField);

      const portalField = document.createElement("label");
      portalField.className = "desktop-tool-palette-field";

      const portalLabel = document.createElement("span");
      portalLabel.className = "desktop-tool-palette-field-label";
      portalLabel.textContent = "Portal labels";

      const portalSelect = document.createElement("select");
      portalSelect.className = "desktop-tool-palette-select";
      portalSelect.ariaLabel = "Portal labels";

      for (const option of definition.content.portalPanelModeOptions) {
        const item = document.createElement("option");
        item.value = option.id;
        item.textContent = option.label;
        item.selected = option.id === definition.content.portalPanelMode;
        portalSelect.append(item);
      }

      portalSelect.addEventListener("change", () => {
        options.onPortalPanelModeSelected(portalSelect.value as PortalPanelModeId);
      });

      portalField.append(portalLabel, portalSelect);
      debugSection.append(portalField);

      const portalInspectionToggle = document.createElement("label");
      portalInspectionToggle.className = "desktop-tool-palette-toggle";

      const portalInspectionCheckbox = document.createElement("input");
      portalInspectionCheckbox.type = "checkbox";
      portalInspectionCheckbox.checked = definition.content.portalInspectionEnabled;
      portalInspectionCheckbox.addEventListener("change", () => {
        options.onPortalInspectionToggled(portalInspectionCheckbox.checked);
      });

      const portalInspectionText = document.createElement("span");
      portalInspectionText.textContent = "Portal inspection tools";

      portalInspectionToggle.append(portalInspectionCheckbox, portalInspectionText);
      debugSection.append(portalInspectionToggle);

      const collisionGeometryToggle = document.createElement("label");
      collisionGeometryToggle.className = "desktop-tool-palette-toggle";

      const collisionGeometryCheckbox = document.createElement("input");
      collisionGeometryCheckbox.type = "checkbox";
      collisionGeometryCheckbox.checked = definition.content.collisionGeometryWireframesEnabled;
      collisionGeometryCheckbox.addEventListener("change", () => {
        options.onCollisionGeometryWireframesToggled(collisionGeometryCheckbox.checked);
      });

      const collisionGeometryText = document.createElement("span");
      collisionGeometryText.textContent = "Collision geometry wireframes";

      collisionGeometryToggle.append(collisionGeometryCheckbox, collisionGeometryText);
      debugSection.append(collisionGeometryToggle);

    settings.append(debugSection);
    return settings;
  }

  const empty = document.createElement("div");
  empty.className = "desktop-tool-palette-empty";
  empty.ariaLabel = "Tool area placeholder";
  return empty;
}

function createFlagTileIcon(flagType: PlacedFlagType): HTMLElement {
  const icon = document.createElement("span");
  icon.className = `desktop-tool-tile-icon desktop-tool-flag-icon desktop-tool-flag-icon-${flagType}`;
  icon.setAttribute("aria-hidden", "true");

  const board = document.createElement("span");
  board.className = "desktop-tool-flag-board";
  const post = document.createElement("span");
  post.className = "desktop-tool-flag-post";

  icon.append(board, post);
  return icon;
}

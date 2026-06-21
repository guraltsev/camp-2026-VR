import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type { ConfigurableToolId } from "../../glue/appConfig";
import type {
  RuntimeDesktopToolId,
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
} from "../../runtime/runtimeMenuState";
import type { PlacedFlagType } from "../../world-objects/placedFlags";

const rotateIconSource = "/assets/icons/arrow-circle-inverted.png";
const aimIconSource = "/assets/icons/aim-inverted.png";
const lockIconSource = "/assets/icons/lock.png";
const carryIconSource = "/assets/icons/carry-icon-white.png";
const rayToolIconSource = "/assets/flashlight/Lightsaber.png";
const protractorToolIconSource = "/assets/icons/protractor.png";
const measureLengthToolIconSource = "/assets/icons/Ruler.png";

export interface DesktopPaletteView {
  readonly pageId: PaletteDefinition["pageId"];
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly content:
    | {
      readonly kind: "main";
      readonly selectedTool: RuntimeDesktopToolId;
      readonly placeFlagType: PlacedFlagType;
      readonly toolLabels: readonly string[];
    }
    | {
      readonly kind: "settings";
      readonly selectedWorldId: string;
      readonly worldLabel?: string;
      readonly debugEnabled: boolean;
      readonly reloadConfirmationActive: boolean;
    }
    | {
      readonly kind: "debug-settings";
      readonly consoleLogLevel: RuntimeMenuConsoleLogLevelId;
      readonly debugOverlayEnabled: boolean;
      readonly debugOverlayLabels: readonly string[];
      readonly portalPanelMode: string;
      readonly portalInspectionEnabled: boolean;
      readonly collisionGeometryWireframesEnabled: boolean;
      readonly aimCollisionOutlinesEnabled: boolean;
    }
    | {
      readonly kind: "place-flag-options";
      readonly selectedFlagType: PlacedFlagType;
      readonly flagTypeLabels: readonly string[];
    }
    | {
      readonly kind: "geodesic-cannon-actions";
      readonly addLabel: string;
      readonly geodesicLabels: readonly string[];
      readonly disabledGeodesicActions: readonly string[];
    }
    | {
      readonly kind: "geometry-computer-actions";
      readonly statusLabel: string;
      readonly available: boolean;
    };
}

export interface DesktopToolPaletteOptions {
  readonly onLeftAction: (actionId: PaletteHeaderAction["id"]) => void;
  readonly onRightAction: (actionId: PaletteHeaderAction["id"]) => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onHomeRequested: () => void;
  readonly onDebugEnabledChanged: (enabled: boolean) => void;
  readonly onDebugSettingsRequested: () => void;
  readonly onConsoleLogLevelSelected: (level: RuntimeMenuConsoleLogLevelId) => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
  readonly onDebugOverlayItemToggled: (itemId: RuntimeDebugOverlayItemId, enabled: boolean) => void;
  readonly onPortalPanelModeSelected: (mode: PortalPanelModeId) => void;
  readonly onPortalInspectionToggled: (enabled: boolean) => void;
  readonly onCollisionGeometryWireframesToggled: (enabled: boolean) => void;
  readonly onAimCollisionOutlinesToggled: (enabled: boolean) => void;
  readonly onCopyUrlWithOptionsRequested?: () => void;
  readonly onToolSelected: (toolId: RuntimeDesktopToolId) => void;
  readonly onPlaceFlagOptionsRequested: () => void;
  readonly onPlaceFlagTypeSelected: (flagType: PlacedFlagType) => void;
  readonly onGeodesicCannonAddRequested?: (cannonId: string) => void;
  readonly onGeodesicCannonCarryRequested?: (cannonId: string) => void;
  readonly onGeodesicCannonTieAndDetachRequested?: (cannonId: string) => void;
  readonly onGeodesicCannonRotateRequested?: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonAimRequested?: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonDeleteRequested?: (cannonId: string, geodesicId: string) => void;
  readonly onGeometryComputerSetSkewRequested?: (computerId: string, skewXMeters: number) => void;
  readonly onGeometryComputerStepSkewRequested?: (computerId: string, deltaXMeters: number) => void;
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

  const leftActions = document.createElement("div");
  leftActions.className = "desktop-tool-palette-header-actions";

  const leftButton = document.createElement("button");
  leftButton.type = "button";
  leftButton.className = "desktop-tool-palette-action";
  leftButton.addEventListener("click", () => {
    const actionId = leftButton.dataset.actionId as PaletteHeaderAction["id"] | undefined;

    if (actionId) {
      options.onLeftAction(actionId);
    }
  });

  const homeButton = document.createElement("button");
  homeButton.type = "button";
  homeButton.className = "desktop-tool-palette-action";
  homeButton.textContent = "⌂";
  homeButton.ariaLabel = "Go home";
  homeButton.addEventListener("click", () => options.onHomeRequested());

  const reloadButton = document.createElement("button");
  reloadButton.type = "button";
  reloadButton.className = "desktop-tool-palette-action";
  reloadButton.textContent = "↻";
  reloadButton.ariaLabel = "Reload world";
  reloadButton.title = "Click once to arm reload, then again within 2 seconds.";
  reloadButton.addEventListener("click", () => options.onReloadRequested());

  const reloadTooltip = document.createElement("span");
  reloadTooltip.className = "desktop-tool-palette-reload-tooltip";
  reloadTooltip.textContent = "Click again to confirm";
  reloadTooltip.hidden = true;

  leftActions.append(leftButton, homeButton, reloadButton, reloadTooltip);

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

  header.append(leftActions, title, rightButton);

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
      reloadButton.classList.toggle("desktop-tool-palette-action-danger", definition.reloadConfirmationActive);
      reloadTooltip.hidden = !definition.reloadConfirmationActive;
      reloadButton.ariaLabel = definition.reloadConfirmationActive
        ? "Confirm reload world"
        : "Reload world";
      reloadButton.title = definition.reloadConfirmationActive
        ? "Click again to confirm."
        : "Click once to arm reload, then again within 2 seconds.";
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
        reloadConfirmationActive: content.reloadConfirmationActive,
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
        aimCollisionOutlinesEnabled: content.aimCollisionOutlinesEnabled,
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

  if (definition.content.kind === "geodesic-cannon-actions") {
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "geodesic-cannon-actions",
        addLabel: definition.content.addAction.label,
        geodesicLabels: definition.content.geodesics.map((geodesic) => geodesic.label),
        disabledGeodesicActions: definition.content.geodesics
          .filter((geodesic) => geodesic.locked)
          .flatMap((geodesic) => [`rotate:${geodesic.id}`, `aim:${geodesic.id}`]),
      },
    };
  }

  if (definition.content.kind === "geometry-computer-actions") {
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "geometry-computer-actions",
        statusLabel: definition.content.statusLabel,
        available: definition.content.available,
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
      toolLabels: definition.content.kind === "main" ? definition.content.toolOptions.map((option) => option.label) : [],
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

    for (const tool of mainContent.toolOptions) {
      tools.append(tool.id === "place-flag"
        ? createFlagToolTile(mainContent, options)
        : createSimpleToolTile(tool.id, tool.label, mainContent.selectedTool, options));
    }
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

  if (definition.content.kind === "geodesic-cannon-actions") {
    const geodesicCannonContent = definition.content;
    const actions = document.createElement("div");
    actions.className = "desktop-tool-palette-settings";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "desktop-tool-palette-button";
    addButton.disabled = geodesicCannonContent.addAction.disabled;
    addButton.ariaDisabled = String(geodesicCannonContent.addAction.disabled);
    addButton.append(createGeodesicCannonActionIcon("add-geodesic"), document.createTextNode(geodesicCannonContent.addAction.label));
    addButton.addEventListener("click", () => {
      options.onGeodesicCannonAddRequested?.(geodesicCannonContent.cannonId);
    });

    const carryButton = document.createElement("button");
    carryButton.type = "button";
    carryButton.className = "desktop-tool-palette-button";
    carryButton.disabled = geodesicCannonContent.carryAction.disabled;
    carryButton.ariaDisabled = String(geodesicCannonContent.carryAction.disabled);
    carryButton.append(createGeodesicCannonActionIcon("carry"), document.createTextNode(geodesicCannonContent.carryAction.label));
    carryButton.addEventListener("click", () => {
      options.onGeodesicCannonCarryRequested?.(geodesicCannonContent.cannonId);
    });

    const tieAndDetachButton = document.createElement("button");
    tieAndDetachButton.type = "button";
    tieAndDetachButton.className = "desktop-tool-palette-button";
    tieAndDetachButton.disabled = geodesicCannonContent.tieAndDetachAction.disabled;
    tieAndDetachButton.ariaDisabled = String(geodesicCannonContent.tieAndDetachAction.disabled);
    tieAndDetachButton.textContent = geodesicCannonContent.tieAndDetachAction.label;
    tieAndDetachButton.addEventListener("click", () => {
      options.onGeodesicCannonTieAndDetachRequested?.(geodesicCannonContent.cannonId);
    });
    actions.append(addButton, carryButton, tieAndDetachButton);

    const geodesicList = document.createElement("div");
    geodesicList.className = "desktop-tool-palette-geodesic-list";
    for (const geodesic of geodesicCannonContent.geodesics) {
      const row = document.createElement("div");
      row.className = "desktop-tool-palette-geodesic-row";
      const label = document.createElement("span");
      label.className = "desktop-tool-palette-field-label";
      label.textContent = geodesic.label;

      if (geodesic.locked) {
        const lockStatus = document.createElement("span");
        lockStatus.className = "desktop-tool-palette-connection-symbol";
        lockStatus.ariaLabel = geodesic.connectionSymbolLabel ?? "Connected locked geodesic";
        lockStatus.append(createLockedGeodesicSegmentSymbol());
        row.append(label, lockStatus);
      } else {
        row.append(label);
      }

      if (!geodesic.locked) {
        const rotateButton = document.createElement("button");
        rotateButton.type = "button";
        rotateButton.className = "desktop-tool-palette-button";
        rotateButton.append(createGeodesicCannonActionIcon("rotate"), document.createTextNode("Rotate"));
        rotateButton.addEventListener("click", () => {
          options.onGeodesicCannonRotateRequested?.(geodesicCannonContent.cannonId, geodesic.id);
        });

        const aimButton = document.createElement("button");
        aimButton.type = "button";
        aimButton.className = "desktop-tool-palette-button";
        aimButton.append(createGeodesicCannonActionIcon("aim"), document.createTextNode("Aim"));
        aimButton.addEventListener("click", () => {
          options.onGeodesicCannonAimRequested?.(geodesicCannonContent.cannonId, geodesic.id);
        });

        row.append(rotateButton, aimButton);
      }

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "desktop-tool-palette-button";
      deleteButton.disabled = geodesic.deleteDisabled;
      deleteButton.ariaDisabled = String(geodesic.deleteDisabled);
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        options.onGeodesicCannonDeleteRequested?.(geodesicCannonContent.cannonId, geodesic.id);
      });
      row.append(deleteButton);
      geodesicList.append(row);
    }
    actions.append(geodesicList);

    return actions;
  }

  if (definition.content.kind === "geometry-computer-actions") {
    const content = definition.content;
    const actions = document.createElement("div");
    actions.className = "desktop-tool-palette-settings";

    const section = document.createElement("section");
    section.className = "desktop-tool-palette-section";

    const heading = document.createElement("span");
    heading.className = "desktop-tool-palette-field-label";
    heading.textContent = "Torus skew";
    section.append(heading);

    const status = document.createElement("span");
    status.className = "desktop-tool-palette-field-label";
    status.textContent = content.statusLabel;
    section.append(status);

    const presetGrid = document.createElement("div");
    presetGrid.className = "desktop-tool-palette-tool-grid";
    for (const action of content.setActions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "desktop-tool-palette-button";
      button.disabled = action.disabled;
      button.ariaDisabled = String(action.disabled);
      button.textContent = action.label;
      button.addEventListener("click", () => {
        options.onGeometryComputerSetSkewRequested?.(content.computerId, action.skewXMeters);
      });
      presetGrid.append(button);
    }
    section.append(presetGrid);

    const stepRow = document.createElement("div");
    stepRow.className = "desktop-tool-palette-geodesic-row";
    for (const action of content.stepActions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "desktop-tool-palette-button";
      button.disabled = action.disabled;
      button.ariaDisabled = String(action.disabled);
      button.textContent = action.label;
      button.addEventListener("click", () => {
        options.onGeometryComputerStepSkewRequested?.(content.computerId, action.deltaXMeters);
      });
      stepRow.append(button);
    }
    section.append(stepRow);
    actions.append(section);
    return actions;
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

    if (definition.content.worldSelectionSectionEnabled) {
      settings.append(worldField);
    }

    if (definition.content.debugSectionEnabled) {
      settings.append(debugSection);
    }

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

      const aimCollisionToggle = document.createElement("label");
      aimCollisionToggle.className = "desktop-tool-palette-toggle";

      const aimCollisionCheckbox = document.createElement("input");
      aimCollisionCheckbox.type = "checkbox";
      aimCollisionCheckbox.checked = definition.content.aimCollisionOutlinesEnabled;
      aimCollisionCheckbox.addEventListener("change", () => {
        options.onAimCollisionOutlinesToggled(aimCollisionCheckbox.checked);
      });

      const aimCollisionText = document.createElement("span");
      aimCollisionText.textContent = "Aim collision outlines";

      aimCollisionToggle.append(aimCollisionCheckbox, aimCollisionText);
      debugSection.append(aimCollisionToggle);

      if (options.onCopyUrlWithOptionsRequested) {
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "desktop-tool-palette-button";
        copyButton.textContent = "Copy URL with options";
        copyButton.addEventListener("click", () => {
          options.onCopyUrlWithOptionsRequested?.();
        });
        debugSection.append(copyButton);
      }

    settings.append(debugSection);
    return settings;
  }

  const empty = document.createElement("div");
  empty.className = "desktop-tool-palette-empty";
  empty.ariaLabel = "Tool area placeholder";
  return empty;
}

function createFlagToolTile(
  mainContent: Extract<PaletteDefinition["content"], { readonly kind: "main" }>,
  options: DesktopToolPaletteOptions,
): HTMLElement {
  const flagTile = document.createElement("div");
  flagTile.className = "desktop-tool-tile-wrap";

  const flagButton = createToolButton("place-flag", "Place flags", "flags", mainContent.selectedTool, options);
  flagButton.prepend(createFlagTileIcon(mainContent.placeFlagType));

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
  return flagTile;
}

function createSimpleToolTile(
  toolId: Exclude<ConfigurableToolId, "place-flag">,
  label: string,
  selectedTool: RuntimeDesktopToolId,
  options: DesktopToolPaletteOptions,
): HTMLElement {
  const button = createToolButton(toolId, getToolAriaLabel(toolId), label.toLowerCase(), selectedTool, options);

  switch (toolId) {
    case "geodesic-cannon":
      button.prepend(createCannonTileIcon());
      break;
    case "measure-length":
      button.prepend(createMeasureLengthTileIcon());
      break;
    case "protractor":
      button.prepend(createProtractorTileIcon());
      break;
  }

  return button;
}

function createToolButton(
  toolId: ConfigurableToolId,
  ariaLabel: string,
  labelText: string,
  selectedTool: RuntimeDesktopToolId,
  options: DesktopToolPaletteOptions,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "desktop-tool-tile";
  button.classList.toggle("desktop-tool-tile-selected", selectedTool === toolId);
  button.ariaLabel = ariaLabel;
  button.ariaPressed = String(selectedTool === toolId);
  button.addEventListener("click", () => {
    options.onToolSelected(toolId);
  });

  const label = document.createElement("span");
  label.className = "desktop-tool-tile-label";
  label.textContent = labelText;
  button.append(label);
  return button;
}

function getToolAriaLabel(toolId: ConfigurableToolId): string {
  switch (toolId) {
    case "place-flag":
      return "Place flags";
    case "geodesic-cannon":
      return "Geodesic emitter";
    case "measure-length":
      return "Measure length";
    case "protractor":
      return "Protractor";
  }
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

function createCannonTileIcon(): HTMLElement {
  const icon = document.createElement("img");
  icon.className = "desktop-tool-tile-icon desktop-tool-ray-icon";
  icon.src = rayToolIconSource;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createProtractorTileIcon(): HTMLElement {
  const icon = document.createElement("img");
  icon.className = "desktop-tool-tile-icon";
  icon.src = protractorToolIconSource;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createMeasureLengthTileIcon(): HTMLElement {
  const icon = document.createElement("img");
  icon.className = "desktop-tool-tile-icon";
  icon.src = measureLengthToolIconSource;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createGeodesicCannonActionIcon(actionId: "add-geodesic" | "rotate" | "aim" | "lock" | "carry"): HTMLElement {
  const icon = document.createElement("img");
  icon.className = "desktop-tool-palette-button-icon";
  icon.src = actionId === "carry"
    ? carryIconSource
    : actionId === "lock"
    ? lockIconSource
    : actionId === "rotate" || actionId === "add-geodesic" ? rotateIconSource : aimIconSource;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createLockedGeodesicSegmentSymbol(): HTMLElement {
  const symbol = document.createElement("span");
  symbol.className = "desktop-tool-palette-locked-segment";
  symbol.setAttribute("aria-hidden", "true");

  const leftEmitter = document.createElement("span");
  leftEmitter.className = "desktop-tool-palette-locked-segment-emitter";
  const leftSegment = document.createElement("span");
  leftSegment.className = "desktop-tool-palette-locked-segment-line";
  const lock = createGeodesicCannonActionIcon("lock");
  lock.classList.add("desktop-tool-palette-locked-segment-lock");
  const rightSegment = document.createElement("span");
  rightSegment.className = "desktop-tool-palette-locked-segment-line";
  const rightEmitter = document.createElement("span");
  rightEmitter.className = "desktop-tool-palette-locked-segment-emitter";

  symbol.append(leftEmitter, leftSegment, lock, rightSegment, rightEmitter);
  return symbol;
}

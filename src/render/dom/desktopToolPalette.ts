import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";

export interface DesktopPaletteView {
  readonly pageId: PaletteDefinition["pageId"];
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly content:
    | { readonly kind: "empty" }
    | {
      readonly kind: "settings";
      readonly selectedWorldId: string;
      readonly worldLabels: readonly string[];
      readonly debugOverlayEnabled: boolean;
    };
}

export interface DesktopToolPaletteOptions {
  readonly onLeftAction: (actionId: PaletteHeaderAction["id"]) => void;
  readonly onRightAction: (actionId: PaletteHeaderAction["id"]) => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
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
  resumePrompt.addEventListener("click", () => options.onResumeRequested());

  root.addEventListener("contextmenu", (event) => {
    event.preventDefault();
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
    return {
      pageId: definition.pageId,
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
      content: {
        kind: "settings",
        selectedWorldId: definition.content.selectedWorldId,
        worldLabels: definition.content.worldOptions.map((option) => option.label),
        debugOverlayEnabled: definition.content.debugOverlayEnabled,
      },
    };
  }

  return {
    pageId: definition.pageId,
    leftAction: definition.leftAction,
    rightAction: definition.rightAction,
    content: {
      kind: "empty",
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
    worldSelect.ariaLabel = "Select world";

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

    const debugToggle = document.createElement("label");
    debugToggle.className = "desktop-tool-palette-toggle";

    const debugCheckbox = document.createElement("input");
    debugCheckbox.type = "checkbox";
    debugCheckbox.checked = definition.content.debugOverlayEnabled;
    debugCheckbox.addEventListener("change", () => {
      options.onDebugOverlayToggled(debugCheckbox.checked);
    });

    const debugText = document.createElement("span");
    debugText.textContent = "Debug overlay";

    debugToggle.append(debugCheckbox, debugText);
    settings.append(worldField, reloadButton, debugToggle);
    return settings;
  }

  const empty = document.createElement("div");
  empty.className = "desktop-tool-palette-empty";
  empty.ariaLabel = "Tool area placeholder";
  return empty;
}

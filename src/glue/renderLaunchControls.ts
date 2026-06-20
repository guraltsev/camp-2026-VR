import { worldCatalog } from "../authoring/worldCatalog";
import type { DebugSettings } from "./debugSettings";
import {
  debugOptionDefinitions,
  hasDebugOption,
  parseDebugOptions,
  type DebugOptionId,
} from "./debugOptions";
import { debugLevelDefinitions, parseDebugLevel, type DebugLevelId } from "./debugLevels";
import { parsePortalPanelMode, portalPanelModeDefinitions, type PortalPanelModeId } from "./portalPanelMode";
import type { UiOptionId } from "./uiOptions";

export interface RenderLaunchControlsOptions {
  readonly selectedWorldId: string;
  readonly uiOptions: readonly UiOptionId[];
  readonly renderWorldPicker: boolean;
  readonly renderDebugButton: boolean;
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
  readonly onWorldChangeRequested?: (worldId: string) => void;
  readonly applyDebugSettings?: ((settings: DebugSettings) => void) | undefined;
  readonly onCopyUrlWithOptionsRequested?: (() => void) | undefined;
}

export function renderLaunchControls(container: HTMLElement, options: RenderLaunchControlsOptions): void {
  const controls = document.createElement("div");
  controls.className = "launch-controls";

  if (options.renderWorldPicker) {
    controls.append(createWorldPicker(options.selectedWorldId, options));
  }

  if (options.renderDebugButton) {
    controls.append(createDebugButton(options));
  }

  if (controls.childElementCount === 0) {
    return;
  }

  container.append(controls);
}

function createWorldPicker(selectedWorldId: string, options: RenderLaunchControlsOptions): HTMLSelectElement {
  const picker = document.createElement("select");
  picker.ariaLabel = "World";
  picker.title = "World";
  picker.className = "launch-control";

  for (const world of worldCatalog) {
    const item = document.createElement("option");
    item.value = world.id;
    item.textContent = world.label;
    item.selected = world.id === selectedWorldId;
    picker.append(item);
  }

  picker.addEventListener("change", () => {
    options.onWorldChangeRequested?.(picker.value);
  });

  return picker;
}

function createDebugButton(options: RenderLaunchControlsOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "launch-control debug-button";
  button.textContent = "Debug";

  const modal = createDebugModal(options);
  document.body.append(modal.dialog);

  button.addEventListener("click", () => {
    modal.syncFromUrl();
    modal.dialog.showModal();
  });

  return button;
}

function createDebugModal(options: RenderLaunchControlsOptions): {
  readonly dialog: HTMLDialogElement;
  syncFromUrl(): void;
} {
  const dialog = document.createElement("dialog");
  dialog.className = "debug-modal";

  const form = document.createElement("form");
  form.method = "dialog";
  form.className = "debug-modal-form";

  const title = document.createElement("h2");
  title.className = "debug-modal-title";
  title.textContent = "Debug Options";
  form.append(title);

  const copy = document.createElement("p");
  copy.className = "debug-modal-copy";
  copy.textContent = "Choose a debug level and debug systems. Supported changes apply immediately; others reload the experience.";
  form.append(copy);

  const levelLabel = document.createElement("label");
  levelLabel.className = "debug-field";

  const levelText = document.createElement("span");
  levelText.className = "debug-field-label";
  levelText.textContent = "Debug Level";

  const levelSelect = document.createElement("select");
  levelSelect.className = "launch-control";
  levelSelect.ariaLabel = "Debug level";

  for (const level of debugLevelDefinitions) {
    const option = document.createElement("option");
    option.value = level.id;
    option.textContent = `${level.label} - ${level.description}`;
    option.selected = level.id === options.debugLevel;
    levelSelect.append(option);
  }

  levelLabel.append(levelText, levelSelect);
  form.append(levelLabel);

  const portalPanelLabel = document.createElement("label");
  portalPanelLabel.className = "debug-field";

  const portalPanelText = document.createElement("span");
  portalPanelText.className = "debug-field-label";
  portalPanelText.textContent = "Portal Panels";

  const portalPanelSelect = document.createElement("select");
  portalPanelSelect.className = "launch-control";
  portalPanelSelect.ariaLabel = "Portal panels";

  for (const mode of portalPanelModeDefinitions) {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = `${mode.label} - ${mode.description}`;
    option.selected = mode.id === options.portalPanelMode;
    portalPanelSelect.append(option);
  }

  portalPanelLabel.append(portalPanelText, portalPanelSelect);
  form.append(portalPanelLabel);

  const checkboxMap = new Map<DebugOptionId, HTMLInputElement>();

  for (const option of debugOptionDefinitions) {
    const label = document.createElement("label");
    label.className = "debug-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = option.id;
    checkbox.checked = hasDebugOption(options.debugOptions, option.id);
    checkboxMap.set(option.id, checkbox);

    const text = document.createElement("span");
    text.className = "debug-option-text";
    text.textContent = option.label;

    const description = document.createElement("span");
    description.className = "debug-option-description";
    description.textContent = option.description;

    label.append(checkbox, text, description);
    form.append(label);
  }

  const actions = document.createElement("div");
  actions.className = "debug-modal-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "launch-control debug-button-secondary";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => dialog.close());

  const applyButton = document.createElement("button");
  applyButton.type = "submit";
  applyButton.className = "launch-control debug-button";
  applyButton.textContent = "Apply";

  const copyUrlButton = document.createElement("button");
  copyUrlButton.type = "button";
  copyUrlButton.className = "launch-control debug-button-secondary";
  copyUrlButton.textContent = "Copy URL with options";
  copyUrlButton.addEventListener("click", () => {
    options.onCopyUrlWithOptionsRequested?.();
  });

  actions.append(copyUrlButton, cancelButton, applyButton);
  form.append(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedOptions = debugOptionDefinitions
      .map((option) => option.id)
      .filter((optionId) => checkboxMap.get(optionId)?.checked);
    const selectedDebugLevel = levelSelect.value as DebugLevelId;
    const selectedPortalPanelMode = portalPanelSelect.value as PortalPanelModeId;
    const nextSettings: DebugSettings = {
      debugLevel: selectedDebugLevel,
      portalPanelMode: selectedPortalPanelMode,
      debugOptions: selectedOptions,
    };

    dialog.close();

    options.applyDebugSettings?.(nextSettings);
  });

  dialog.append(form);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  return {
    dialog,
    syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      levelSelect.value = parseDebugLevel(params.get("debugLevel")) ?? options.debugLevel;
      portalPanelSelect.value = parsePortalPanelMode(params.get("portalPanels")) ?? options.portalPanelMode;
      const selected = new Set(parseDebugOptions(params.get("debugOptions")));

      for (const option of debugOptionDefinitions) {
        const checkbox = checkboxMap.get(option.id);

        if (checkbox) {
          checkbox.checked = selected.has(option.id);
        }
      }
    },
  };
}

import { worldCatalog } from "../authoring/worldCatalog";
import { portalPanelModeDefinitions } from "../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
  RuntimeMenuPageId,
  RuntimeMenuState,
} from "../runtime/runtimeMenuState";

export interface PaletteSelectOption {
  readonly id: string;
  readonly label: string;
}

export interface PaletteHeaderAction {
  readonly id: "none" | "settings" | "close" | "back";
  readonly label: string;
  readonly ariaLabel: string;
  readonly disabled: boolean;
}

export interface MainPaletteContent {
  readonly kind: "empty";
}

export interface SettingsPaletteContent {
  readonly kind: "settings";
  readonly selectedWorldId: string;
  readonly worldOptions: readonly PaletteSelectOption[];
  readonly debugEnabled: boolean;
  readonly consoleLogLevel: RuntimeMenuConsoleLogLevelId;
  readonly consoleLogLevelOptions: readonly PaletteSelectOption[];
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly {
    readonly id: RuntimeDebugOverlayItemId;
    readonly label: string;
    readonly checked: boolean;
  }[];
  readonly portalPanelMode: string;
  readonly portalPanelModeOptions: readonly PaletteSelectOption[];
  readonly portalInspectionEnabled: boolean;
}

export interface PaletteDefinition {
  readonly pageId: RuntimeMenuPageId;
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly content: MainPaletteContent | SettingsPaletteContent;
}

export function createPaletteDefinition(state: RuntimeMenuState): PaletteDefinition {
  if (state.page === "settings") {
    return {
      pageId: "settings",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      content: {
        kind: "settings",
        selectedWorldId: state.selectedWorldId,
        worldOptions: worldCatalog.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        debugEnabled: state.debugEnabled,
        consoleLogLevel: state.consoleLogLevel,
        consoleLogLevelOptions: [
          { id: "basic", label: "Basic" },
          { id: "verbose", label: "Verbose" },
        ],
        debugOverlayEnabled: state.debugOverlayEnabled,
        debugOverlayItems: [
          { id: "fps", label: "FPS", checked: state.debugOverlayItems.includes("fps") },
          { id: "location", label: "Location", checked: state.debugOverlayItems.includes("location") },
          {
            id: "portal-quantities",
            label: "Portal quantities",
            checked: state.debugOverlayItems.includes("portal-quantities"),
          },
        ],
        portalPanelMode: state.portalPanelMode,
        portalPanelModeOptions: portalPanelModeDefinitions.map((mode) => ({
          id: mode.id,
          label: mode.label,
        })),
        portalInspectionEnabled: state.portalInspectionEnabled,
      },
    };
  }

  return {
    pageId: "main",
    leftAction: createHeaderAction("settings"),
    rightAction: createHeaderAction("close"),
    content: {
      kind: "empty",
    },
  };
}

function createHeaderAction(id: PaletteHeaderAction["id"]): PaletteHeaderAction {
  switch (id) {
    case "settings":
      return {
        id,
        label: "\u2699",
        ariaLabel: "Open settings",
        disabled: false,
      };
    case "close":
      return {
        id,
        label: "X",
        ariaLabel: "Close palette",
        disabled: false,
      };
    case "back":
      return {
        id,
        label: "\u2190",
        ariaLabel: "Back to main menu",
        disabled: false,
      };
    case "none":
      return {
        id,
        label: "",
        ariaLabel: "",
        disabled: true,
      };
  }
}

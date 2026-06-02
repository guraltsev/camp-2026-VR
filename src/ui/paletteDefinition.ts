import { worldCatalog } from "../authoring/worldCatalog";
import type { RuntimeMenuPageId, RuntimeMenuState } from "../runtime/runtimeMenuState";

export interface PaletteWorldOption {
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
  readonly worldOptions: readonly PaletteWorldOption[];
  readonly selectedWorldId: string;
  readonly debugOverlayEnabled: boolean;
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
        worldOptions: worldCatalog.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        selectedWorldId: state.selectedWorldId,
        debugOverlayEnabled: state.debugOverlayEnabled,
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

import { worldCatalog } from "../authoring/worldCatalog";
import { portalPanelModeDefinitions } from "../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
  RuntimeMenuPageId,
  RuntimeMenuState,
  RuntimeToolId,
} from "../runtime/runtimeMenuState";
import { placedFlagMaxMessageLength, placedFlagTypes, type PlacedFlagType } from "../world-objects/placedFlags";

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
  readonly kind: "main";
  readonly selectedTool: RuntimeToolId;
  readonly placeFlagType: PlacedFlagType;
}

export interface SettingsPaletteContent {
  readonly kind: "settings";
  readonly selectedWorldId: string;
  readonly worldOptions: readonly PaletteSelectOption[];
  readonly debugEnabled: boolean;
}

export interface DebugSettingsPaletteContent {
  readonly kind: "debug-settings";
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
  readonly collisionGeometryWireframesEnabled: boolean;
}

export interface PlaceFlagOptionsPaletteContent {
  readonly kind: "place-flag-options";
  readonly selectedFlagType: PlacedFlagType;
  readonly flagTypeOptions: readonly PaletteSelectOption[];
}

export interface EditSignPaletteContent {
  readonly kind: "edit-sign";
  readonly flagId: string;
  readonly message: string;
  readonly maxLength: number;
}

export interface GeodesicCannonActionsPaletteContent {
  readonly kind: "geodesic-cannon-actions";
  readonly cannonId: string;
  readonly addAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
  readonly geodesics: readonly {
    readonly id: string;
    readonly label: string;
    readonly rotateDisabled: boolean;
    readonly aimDisabled: boolean;
    readonly deleteDisabled: boolean;
  }[];
}

export interface PaletteDefinition {
  readonly pageId: RuntimeMenuPageId;
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly content:
    | MainPaletteContent
    | SettingsPaletteContent
    | DebugSettingsPaletteContent
    | PlaceFlagOptionsPaletteContent
    | EditSignPaletteContent
    | GeodesicCannonActionsPaletteContent;
}

export function createPaletteDefinition(state: RuntimeMenuState): PaletteDefinition {
  if (state.page === "debug-settings") {
    return {
      pageId: "debug-settings",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      content: {
        kind: "debug-settings",
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
        collisionGeometryWireframesEnabled: state.collisionGeometryWireframesEnabled,
      },
    };
  }

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
      },
    };
  }

  if (state.page === "place-flag-options") {
    return {
      pageId: "place-flag-options",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      content: {
        kind: "place-flag-options",
        selectedFlagType: state.placeFlagOptions.flagType,
        flagTypeOptions: placedFlagTypes.map((id) => ({
          id,
          label: id,
        })),
      },
    };
  }

  if (state.page === "edit-sign" && state.editSignOptions) {
    return {
      pageId: "edit-sign",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("close"),
      content: {
        kind: "edit-sign",
        flagId: state.editSignOptions.flagId,
        message: state.editSignOptions.message,
        maxLength: placedFlagMaxMessageLength,
      },
    };
  }

  if (state.page === "geodesic-cannon-actions" && state.geodesicCannonOptions) {
    return {
      pageId: "geodesic-cannon-actions",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("close"),
      content: {
        kind: "geodesic-cannon-actions",
        cannonId: state.geodesicCannonOptions.cannonId,
        addAction: { label: "Add geodesic", disabled: false },
        geodesics: createGeodesicCannonEntries(
          state.geodesicCannonOptions.geodesicIds,
          state.geodesicCannonOptions.geodesicLabelsById,
        ),
      },
    };
  }

  return {
    pageId: "main",
    leftAction: createHeaderAction("settings"),
    rightAction: createHeaderAction("close"),
    content: {
      kind: "main",
      selectedTool: state.selectedTool,
      placeFlagType: state.placeFlagOptions.flagType,
    },
  };
}

function createGeodesicCannonEntries(
  geodesicIds: readonly string[],
  geodesicLabelsById: Readonly<Record<string, string>> | undefined,
): GeodesicCannonActionsPaletteContent["geodesics"] {
  return geodesicIds.map((geodesicId, index) => ({
    id: geodesicId,
    label: geodesicLabelsById?.[geodesicId] ?? `G${index + 1}`,
    rotateDisabled: false,
    aimDisabled: false,
    deleteDisabled: false,
  }));
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

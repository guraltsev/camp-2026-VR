import { worldCatalog } from "../authoring/worldCatalog";
import { defaultAppConfig, getEnabledMainTools, type AppConfig, type ConfigurableToolId } from "../glue/appConfig";
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
  readonly toolOptions: readonly {
    readonly id: ConfigurableToolId;
    readonly label: string;
  }[];
}

export interface SettingsPaletteContent {
  readonly kind: "settings";
  readonly selectedWorldId: string;
  readonly worldOptions: readonly PaletteSelectOption[];
  readonly worldSelectionSectionEnabled: boolean;
  readonly debugSectionEnabled: boolean;
  readonly debugEnabled: boolean;
  readonly reloadConfirmationActive: boolean;
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
  readonly aimCollisionOutlinesEnabled: boolean;
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
  readonly carryAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
  readonly tieAndDetachAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
  readonly geodesics: readonly {
    readonly id: string;
    readonly label: string;
    readonly locked: boolean;
    readonly connectionSymbolLabel?: string;
    readonly deleteDisabled: boolean;
  }[];
}

export interface GeometryComputerActionsPaletteContent {
  readonly kind: "geometry-computer-actions";
  readonly computerId: string;
  readonly available: boolean;
  readonly statusLabel: string;
  readonly setActions: readonly {
    readonly skewXMeters: number;
    readonly label: string;
    readonly disabled: boolean;
  }[];
  readonly stepActions: readonly {
    readonly deltaXMeters: number;
    readonly label: string;
    readonly disabled: boolean;
  }[];
}

export interface PaletteDefinition {
  readonly pageId: RuntimeMenuPageId;
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
  readonly reloadConfirmationActive: boolean;
  readonly content:
    | MainPaletteContent
    | SettingsPaletteContent
    | DebugSettingsPaletteContent
    | PlaceFlagOptionsPaletteContent
    | EditSignPaletteContent
    | GeodesicCannonActionsPaletteContent
    | GeometryComputerActionsPaletteContent;
}

export function createPaletteDefinition(state: RuntimeMenuState, appConfig: AppConfig = defaultAppConfig): PaletteDefinition {
  const reloadConfirmationActive = (state.reloadConfirmUntilMs ?? 0) > Date.now();

  if (state.page === "debug-settings" && appConfig.menu.debugSectionEnabled) {
    return {
      pageId: "debug-settings",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      reloadConfirmationActive,
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
        aimCollisionOutlinesEnabled: state.aimCollisionOutlinesEnabled,
      },
    };
  }

  if (state.page === "settings") {
    return {
      pageId: "settings",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      reloadConfirmationActive,
      content: {
        kind: "settings",
        selectedWorldId: state.selectedWorldId,
        worldOptions: worldCatalog.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        worldSelectionSectionEnabled: appConfig.menu.worldSelectionSectionEnabled,
        debugSectionEnabled: appConfig.menu.debugSectionEnabled,
        debugEnabled: state.debugEnabled,
        reloadConfirmationActive,
      },
    };
  }

  if (state.page === "place-flag-options") {
    return {
      pageId: "place-flag-options",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      reloadConfirmationActive,
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
      reloadConfirmationActive,
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
      reloadConfirmationActive,
      content: {
        kind: "geodesic-cannon-actions",
        cannonId: state.geodesicCannonOptions.cannonId,
        addAction: { label: "Add geodesic", disabled: false },
        carryAction: { label: "Carry", disabled: false },
        tieAndDetachAction: { label: "Tie & detach", disabled: !state.geodesicCannonOptions.canTieAndDetach },
        geodesics: createGeodesicCannonEntries(
          state.geodesicCannonOptions.geodesicIds,
          state.geodesicCannonOptions.geodesicLabelsById,
          state.geodesicCannonOptions.lockedGeodesicIds,
        ),
      },
    };
  }

  if (state.page === "geometry-computer-actions" && state.geometryComputerOptions) {
    return {
      pageId: "geometry-computer-actions",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("close"),
      reloadConfirmationActive,
      content: createGeometryComputerActionsContent(state.geometryComputerOptions),
    };
  }

  return {
    pageId: "main",
    leftAction: createHeaderAction("settings"),
    rightAction: createHeaderAction("close"),
    reloadConfirmationActive,
    content: {
      kind: "main",
      selectedTool: state.selectedTool,
      placeFlagType: state.placeFlagOptions.flagType,
      toolOptions: createToolOptions(appConfig),
    },
  };
}

function createToolOptions(appConfig: AppConfig): MainPaletteContent["toolOptions"] {
  return getEnabledMainTools(appConfig).map((id) => ({
    id,
    label: toolLabels[id],
  }));
}

const toolLabels = {
  "place-flag": "Sign",
  "geodesic-cannon": "Geodesic emitter",
  "measure-length": "Length",
  protractor: "Protractor",
} as const satisfies Record<ConfigurableToolId, string>;

function createGeometryComputerActionsContent(
  options: NonNullable<RuntimeMenuState["geometryComputerOptions"]>,
): GeometryComputerActionsPaletteContent {
  const available = options.available;
  const current = options.currentSkewXMeters;
  const target = options.targetSkewXMeters;
  const statusLabel = available
    ? `Current ${formatMeters(current ?? 0)} / target ${formatMeters(target ?? current ?? 0)}`
    : "Torus skew is only available in the torus world.";
  const fixedSkews = [-2, -1, 0, 1, 2] as const;

  return {
    kind: "geometry-computer-actions",
    computerId: options.computerId,
    available,
    statusLabel,
    setActions: fixedSkews.map((skewXMeters) => ({
      skewXMeters,
      label: skewXMeters === 0 ? "Flat 0 m" : `${skewXMeters > 0 ? "+" : ""}${skewXMeters} m`,
      disabled: !available,
    })),
    stepActions: [
      { deltaXMeters: -0.25, label: "-0.25 m", disabled: !available },
      { deltaXMeters: 0.25, label: "+0.25 m", disabled: !available },
    ],
  };
}

function createGeodesicCannonEntries(
  geodesicIds: readonly string[],
  geodesicLabelsById: Readonly<Record<string, string>> | undefined,
  lockedGeodesicIds: readonly string[] | undefined,
): GeodesicCannonActionsPaletteContent["geodesics"] {
  const lockedIds = new Set(lockedGeodesicIds ?? []);
  return geodesicIds.map((geodesicId, index) => ({
    id: geodesicId,
    label: geodesicLabelsById?.[geodesicId] ?? `G${index + 1}`,
    locked: lockedIds.has(geodesicId),
    connectionSymbolLabel: lockedIds.has(geodesicId) ? "Locked geodesic segment between emitters" : undefined,
    deleteDisabled: false,
  }));
}

function formatMeters(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded} m` : `${rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} m`;
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

import { appConfigCatalog, defaultAppConfig, getEnabledMainTools, type AppConfig, type ConfigurableToolId } from "../glue/appConfig";
import { worldCatalog } from "../authoring/worldCatalog";
import { helpHubHomeGuidance } from "../helpHubCopy";
import { portalPanelModeDefinitions } from "../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
  RuntimeMenuPageId,
  RuntimeMenuState,
  RuntimeToolId,
} from "../runtime/runtimeMenuState";
import type { InputMode } from "./inputIntents";
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
  readonly selectedAppConfigName: string;
  readonly appConfigOptions: readonly PaletteSelectOption[];
  readonly configSelectionSectionEnabled: boolean;
  readonly debugSectionEnabled: boolean;
  readonly debugEnabled: boolean;
  readonly antiNauseaModeEnabled: boolean;
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

export interface TutorialPaletteContent {
  readonly kind: "tutorial";
  readonly objectId: string;
  readonly title: string;
  readonly body: string;
  readonly pageLabel: string;
  readonly previousAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
  readonly nextAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
}

export interface GoalPaletteContent {
  readonly kind: "goal";
  readonly objectId: string;
  readonly title: string;
  readonly body: string;
  readonly pageLabel: string;
  readonly previousAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
  readonly nextAction: {
    readonly label: string;
    readonly disabled: boolean;
  };
}

export interface QuestionHelpPaletteContent {
  readonly kind: "question-help";
  readonly objectId: string;
  readonly body: string;
  readonly options: readonly {
    readonly id: "tutorial" | "goal";
    readonly label: string;
    readonly disabled: boolean;
  }[];
}

export const questionHelpHubBody = helpHubHomeGuidance;

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
    | GeometryComputerActionsPaletteContent
    | TutorialPaletteContent
    | GoalPaletteContent
    | QuestionHelpPaletteContent;
}

export function createPaletteDefinition(
  state: RuntimeMenuState,
  appConfig: AppConfig = defaultAppConfig,
  inputMode: InputMode = "desktop",
): PaletteDefinition {
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
        selectedAppConfigName: state.selectedAppConfigName,
        appConfigOptions: appConfigCatalog.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        configSelectionSectionEnabled: appConfig.menu.configSelectionSectionEnabled,
        debugSectionEnabled: appConfig.menu.debugSectionEnabled,
        debugEnabled: state.debugEnabled,
        antiNauseaModeEnabled: state.antiNauseaModeEnabled,
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
        tieAndDetachAction: {
          label: "Tie & detach",
          disabled: state.geodesicCannonOptions.canTieAndDetach !== true,
        },
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

  if (state.page === "tutorial" && state.tutorialOptions) {
    return {
      pageId: "tutorial",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      reloadConfirmationActive,
      content: createPagedHelpContent("tutorial", state.tutorialOptions, inputMode),
    };
  }

  if (state.page === "goal" && state.goalOptions) {
    return {
      pageId: "goal",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("back"),
      reloadConfirmationActive,
      content: createPagedHelpContent("goal", state.goalOptions, inputMode),
    };
  }

  if (state.page === "question-help" && state.questionHelpOptions) {
    return {
      pageId: "question-help",
      leftAction: createHeaderAction("none"),
      rightAction: createHeaderAction("close"),
      reloadConfirmationActive,
      content: {
        kind: "question-help",
        objectId: state.questionHelpOptions.objectId,
        body: questionHelpHubBody,
        options: [
          {
            id: "tutorial",
            label: "Tutorial",
            disabled: state.questionHelpOptions.tutorialPages.length === 0,
          },
          {
            id: "goal",
            label: "Goal",
            disabled: state.questionHelpOptions.goalPages.length === 0,
          },
        ],
      },
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

function createPagedHelpContent(
  kind: "tutorial",
  options: NonNullable<RuntimeMenuState["tutorialOptions"]>,
  inputMode: InputMode,
): TutorialPaletteContent;
function createPagedHelpContent(
  kind: "goal",
  options: NonNullable<RuntimeMenuState["goalOptions"]>,
  inputMode: InputMode,
): GoalPaletteContent;
function createPagedHelpContent(
  kind: "tutorial" | "goal",
  options: NonNullable<RuntimeMenuState["tutorialOptions"]> | NonNullable<RuntimeMenuState["goalOptions"]>,
  inputMode: InputMode,
): TutorialPaletteContent | GoalPaletteContent {
  const pageCount = options.pages.length;
  const pageIndex = pageCount === 0
    ? 0
    : Math.max(0, Math.min(pageCount - 1, options.pageIndex));
  const page = options.pages[pageIndex] ?? { title: "Tutorial", body: "" };

  return {
    kind,
    objectId: options.objectId,
    title: page.title,
    body: resolveTutorialBodyForInputMode(page, inputMode),
    pageLabel: pageCount === 0 ? "0 / 0" : `${pageIndex + 1} / ${pageCount}`,
    previousAction: {
      label: "<",
      disabled: pageIndex <= 0,
    },
    nextAction: {
      label: ">",
      disabled: pageIndex >= pageCount - 1,
    },
  };
}

function resolveTutorialBodyForInputMode(
  page: NonNullable<RuntimeMenuState["tutorialOptions"]>["pages"][number],
  inputMode: InputMode,
): string {
  if (inputMode === "desktop") {
    return page.desktopBody ?? formatTutorialBodyForInputMode(page.body, "desktop");
  }

  return page.xrBody ?? formatTutorialBodyForInputMode(page.body, "xr");
}

function formatTutorialBodyForInputMode(body: string, inputMode: InputMode): string {
  if (inputMode === "desktop") {
    return body
      .replace("Move with Arrow keys or the left stick.", "Move with Arrow keys.")
      .replace("Use primary action or trigger for the selected action.", "Left click uses the selected/default action.")
      .replace("Use primary action or trigger for the selected/default action.", "Left click uses the selected/default action.")
      .replace("Use context action or side trigger for tools and object menus.", "Right click opens tools and object menus.")
      .replace("Press H or B while aiming at an object for its help.", "Press H while aiming at an object for its help.");
  }

  return body
    .replace("Move with Arrow keys or the left stick.", "Move with the left stick.")
    .replace("Use primary action or trigger for the selected action.", "Trigger uses the selected/default action.")
    .replace("Use primary action or trigger for the selected/default action.", "Trigger uses the selected/default action.")
    .replace("Use context action or side trigger for tools and object menus.", "Side trigger opens tools and object menus.")
    .replace("Press H or B while aiming at an object for its help.", "Press B while aiming at an object for its help.");
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

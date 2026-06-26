import type { DebugOptionId } from "../glue/debugOptions";
import type { DebugSettings } from "../glue/debugSettings";
import type { DebugLevelId } from "../glue/debugLevels";
import type { PortalPanelModeId } from "../glue/portalPanelMode";
import type { VrComfortOptions } from "../render/three/vrComfort";
import type { PlacedFlagType } from "../world-objects/placedFlags";
import type { TutorialPageSpec } from "../cell-complex/specs";
import { defaultAppConfigName } from "../glue/appConfig";

export type RuntimeMenuPageId =
  | "main"
  | "settings"
  | "debug-settings"
  | "place-flag-options"
  | "edit-sign"
  | "geodesic-cannon-actions"
  | "geometry-computer-actions"
  | "question-help"
  | "tutorial"
  | "goal";
export type RuntimeMenuConsoleLogLevelId = Exclude<DebugLevelId, "off">;
export type RuntimeDebugOverlayItemId = "fps" | "location" | "portal-quantities";
export type RuntimeToolId =
  | "none"
  | "aim"
  | "place-flag"
  | "geodesic-cannon"
  | "measure-length"
  | "protractor"
  | "geodesic-cannon-carry"
  | "geodesic-cannon-rotate"
  | "geodesic-cannon-aim"
  | "geodesic-cannon-tie-detach";
export type RuntimeDesktopToolId = RuntimeToolId;

const defaultRuntimeDebugOverlayItems = ["fps", "location", "portal-quantities"] as const;
const portalInspectionDebugOptions = [
  "portal-path-debug",
  "portal-static-cull-debug",
  "portal-path-overlays",
  "portal-path-overlay-instances",
] as const satisfies readonly DebugOptionId[];
const collisionGeometryDebugOptions = [
  "forbidden-zone-wireframes",
  "object-collision-wireframes",
] as const satisfies readonly DebugOptionId[];
const aimCollisionDebugOptions = [
  "aim-collision-outlines",
] as const satisfies readonly DebugOptionId[];

export interface RuntimeMenuState {
  readonly isOpen: boolean;
  readonly page: RuntimeMenuPageId;
  readonly selectedWorldId: string;
  readonly selectedAppConfigName: string;
  readonly debugEnabled: boolean;
  readonly consoleLogLevel: RuntimeMenuConsoleLogLevelId;
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly portalPanelMode: PortalPanelModeId;
  readonly portalInspectionEnabled: boolean;
  readonly collisionGeometryWireframesEnabled: boolean;
  readonly aimCollisionOutlinesEnabled: boolean;
  readonly antiNauseaModeEnabled: boolean;
  readonly selectedTool: RuntimeToolId;
  readonly reloadConfirmUntilMs?: number;
  readonly placeFlagOptions: {
    readonly flagType: PlacedFlagType;
  };
  readonly editSignOptions?: {
    readonly flagId: string;
    readonly message: string;
  };
  readonly geodesicCannonOptions?: {
    readonly cannonId: string;
    readonly geodesicIds: readonly string[];
    readonly geodesicLabelsById?: Readonly<Record<string, string>>;
    readonly lockedGeodesicIds?: readonly string[];
    readonly canTieAndDetach?: boolean;
  };
  readonly geometryComputerOptions?: {
    readonly computerId: string;
    readonly available: boolean;
    readonly widthMeters?: number;
    readonly currentSkewXMeters?: number;
    readonly currentDepthMeters?: number;
    readonly targetSkewXMeters?: number;
    readonly targetDepthMeters?: number;
  };
  readonly tutorialOptions?: {
    readonly objectId: string;
    readonly pages: readonly TutorialPageSpec[];
    readonly pageIndex: number;
  };
  readonly goalOptions?: {
    readonly objectId: string;
    readonly pages: readonly TutorialPageSpec[];
    readonly pageIndex: number;
  };
  readonly questionHelpOptions?: {
    readonly objectId: string;
    readonly tutorialPages: readonly TutorialPageSpec[];
    readonly goalPages: readonly TutorialPageSpec[];
  };
  readonly editingFlagId?: string;
}

export interface CreateRuntimeMenuStateOptions {
  readonly selectedWorldId: string;
  readonly selectedAppConfigName?: string;
  readonly debugSettings?: DebugSettings;
  readonly debugOverlayEnabled?: boolean;
  readonly debugOverlayItems?: readonly RuntimeDebugOverlayItemId[];
  readonly vrComfortOptions?: Pick<VrComfortOptions, "antiNauseaModeEnabled">;
}

export function createRuntimeMenuState(options: CreateRuntimeMenuStateOptions): RuntimeMenuState {
  const debugSettings = options.debugSettings;

  return {
    isOpen: false,
    page: "main",
    selectedWorldId: options.selectedWorldId,
    selectedAppConfigName: options.selectedAppConfigName ?? defaultAppConfigName,
    debugEnabled: debugSettings?.debugLevel !== "off",
    consoleLogLevel: debugSettings?.debugLevel === "verbose" ? "verbose" : "basic",
    debugOverlayEnabled: options.debugOverlayEnabled ?? true,
    debugOverlayItems: options.debugOverlayItems ?? [...defaultRuntimeDebugOverlayItems],
    portalPanelMode: debugSettings?.portalPanelMode ?? "none",
    portalInspectionEnabled: hasAnyDebugOption(debugSettings?.debugOptions, portalInspectionDebugOptions),
    collisionGeometryWireframesEnabled: hasAnyDebugOption(
      debugSettings?.debugOptions,
      collisionGeometryDebugOptions,
    ),
    aimCollisionOutlinesEnabled: hasAnyDebugOption(debugSettings?.debugOptions, aimCollisionDebugOptions),
    antiNauseaModeEnabled: options.vrComfortOptions?.antiNauseaModeEnabled ?? true,
    selectedTool: "none",
    placeFlagOptions: {
      flagType: "WoodenSign1",
    },
  };
}

export function openRuntimeMenu(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "main",
  };
}

export function closeRuntimeMenu(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    isOpen: false,
    page: "main",
    editSignOptions: undefined,
    geodesicCannonOptions: undefined,
    geometryComputerOptions: undefined,
    tutorialOptions: undefined,
    goalOptions: undefined,
    questionHelpOptions: undefined,
    editingFlagId: undefined,
  };
}

export function showRuntimeMenuSettings(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "settings",
  };
}

export function showRuntimeMenuDebugSettings(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "debug-settings",
  };
}

export function showRuntimeMenuPlaceFlagOptions(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "place-flag-options",
  };
}

export function showRuntimeMenuMainPage(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "main",
    selectedTool: "none",
    editSignOptions: undefined,
    geodesicCannonOptions: undefined,
    geometryComputerOptions: undefined,
    tutorialOptions: undefined,
    goalOptions: undefined,
    questionHelpOptions: undefined,
    editingFlagId: undefined,
  };
}

export function showRuntimeMenuEditSign(
  state: RuntimeMenuState,
  options: {
    readonly flagId: string;
    readonly message: string;
  },
): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "edit-sign",
    editingFlagId: options.flagId,
    editSignOptions: {
      flagId: options.flagId,
      message: options.message,
    },
  };
}

export function showRuntimeMenuGeodesicCannonActions(
  state: RuntimeMenuState,
  options: {
    readonly cannonId: string;
    readonly geodesicIds?: readonly string[];
    readonly geodesicLabelsById?: Readonly<Record<string, string>>;
    readonly lockedGeodesicIds?: readonly string[];
    readonly canTieAndDetach?: boolean;
  },
): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "geodesic-cannon-actions",
    geodesicCannonOptions: {
      cannonId: options.cannonId,
      geodesicIds: options.geodesicIds ?? [],
      geodesicLabelsById: options.geodesicLabelsById,
      lockedGeodesicIds: options.lockedGeodesicIds,
      canTieAndDetach: options.canTieAndDetach,
    },
  };
}

export function showRuntimeMenuGeometryComputerActions(
  state: RuntimeMenuState,
  options: {
    readonly computerId: string;
    readonly available: boolean;
    readonly widthMeters?: number;
    readonly currentSkewXMeters?: number;
    readonly currentDepthMeters?: number;
    readonly targetSkewXMeters?: number;
    readonly targetDepthMeters?: number;
  },
): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "geometry-computer-actions",
    geometryComputerOptions: {
      computerId: options.computerId,
      available: options.available,
      widthMeters: options.widthMeters,
      currentSkewXMeters: options.currentSkewXMeters,
      currentDepthMeters: options.currentDepthMeters,
      targetSkewXMeters: options.targetSkewXMeters,
      targetDepthMeters: options.targetDepthMeters,
    },
  };
}

export function showRuntimeMenuTutorial(
  state: RuntimeMenuState,
  options: {
    readonly objectId: string;
    readonly pages: readonly TutorialPageSpec[];
    readonly pageIndex?: number;
  },
): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "tutorial",
    tutorialOptions: {
      objectId: options.objectId,
      pages: options.pages,
      pageIndex: clampTutorialPageIndex(options.pageIndex ?? 0, options.pages),
    },
  };
}

export function showRuntimeMenuQuestionHelp(
  state: RuntimeMenuState,
  options?: {
    readonly objectId: string;
    readonly tutorialPages?: readonly TutorialPageSpec[];
    readonly goalPages?: readonly TutorialPageSpec[];
  },
): RuntimeMenuState {
  const questionHelpOptions = options
    ? {
        objectId: options.objectId,
        tutorialPages: options.tutorialPages ?? [],
        goalPages: options.goalPages ?? [],
      }
    : state.questionHelpOptions;
  if (!questionHelpOptions) {
    return state;
  }

  return {
    ...state,
    isOpen: true,
    page: "question-help",
    questionHelpOptions,
    tutorialOptions: undefined,
    goalOptions: undefined,
  };
}

export function showRuntimeMenuQuestionTutorial(state: RuntimeMenuState): RuntimeMenuState {
  const options = state.questionHelpOptions;
  if (!options || options.tutorialPages.length === 0) {
    return state;
  }

  return showRuntimeMenuTutorial(state, {
    objectId: options.objectId,
    pages: options.tutorialPages,
  });
}

export function showRuntimeMenuGoal(
  state: RuntimeMenuState,
  options?: {
    readonly objectId: string;
    readonly pages: readonly TutorialPageSpec[];
    readonly pageIndex?: number;
  },
): RuntimeMenuState {
  const resolvedOptions = options ?? (state.questionHelpOptions
    ? {
        objectId: state.questionHelpOptions.objectId,
        pages: state.questionHelpOptions.goalPages,
      }
    : undefined);
  if (!resolvedOptions || resolvedOptions.pages.length === 0) {
    return state;
  }

  return {
    ...state,
    isOpen: true,
    page: "goal",
    goalOptions: {
      objectId: resolvedOptions.objectId,
      pages: resolvedOptions.pages,
      pageIndex: clampTutorialPageIndex(resolvedOptions.pageIndex ?? 0, resolvedOptions.pages),
    },
  };
}

export function setRuntimeMenuTutorialPageIndex(
  state: RuntimeMenuState,
  pageIndex: number,
): RuntimeMenuState {
  if (!state.tutorialOptions) {
    return state;
  }

  return {
    ...state,
    tutorialOptions: {
      ...state.tutorialOptions,
      pageIndex: clampTutorialPageIndex(pageIndex, state.tutorialOptions.pages),
    },
  };
}

export function setRuntimeMenuGoalPageIndex(
  state: RuntimeMenuState,
  pageIndex: number,
): RuntimeMenuState {
  if (!state.goalOptions) {
    return state;
  }

  return {
    ...state,
    goalOptions: {
      ...state.goalOptions,
      pageIndex: clampTutorialPageIndex(pageIndex, state.goalOptions.pages),
    },
  };
}

export function setRuntimeMenuEditingSignMessage(state: RuntimeMenuState, message: string): RuntimeMenuState {
  if (!state.editSignOptions) {
    return state;
  }

  return {
    ...state,
    editSignOptions: {
      ...state.editSignOptions,
      message,
    },
  };
}

export function setRuntimeMenuSelectedWorldId(state: RuntimeMenuState, worldId: string): RuntimeMenuState {
  return {
    ...state,
    selectedWorldId: worldId,
  };
}

export function setRuntimeMenuSelectedAppConfigName(state: RuntimeMenuState, configName: string): RuntimeMenuState {
  return {
    ...state,
    selectedAppConfigName: configName,
  };
}

export function setRuntimeMenuDebugEnabled(state: RuntimeMenuState, enabled: boolean): RuntimeMenuState {
  return {
    ...state,
    debugEnabled: enabled,
  };
}

export function setRuntimeMenuConsoleLogLevel(
  state: RuntimeMenuState,
  level: RuntimeMenuConsoleLogLevelId,
): RuntimeMenuState {
  return {
    ...state,
    consoleLogLevel: level,
  };
}

export function setRuntimeMenuDebugOverlayEnabled(state: RuntimeMenuState, enabled: boolean): RuntimeMenuState {
  return {
    ...state,
    debugOverlayEnabled: enabled,
  };
}

export function toggleRuntimeMenuDebugOverlayItem(
  state: RuntimeMenuState,
  itemId: RuntimeDebugOverlayItemId,
  enabled: boolean,
): RuntimeMenuState {
  const nextItems = enabled
    ? state.debugOverlayItems.includes(itemId)
      ? state.debugOverlayItems
      : [...state.debugOverlayItems, itemId]
    : state.debugOverlayItems.filter((entry) => entry !== itemId);

  return {
    ...state,
    debugOverlayItems: orderRuntimeDebugOverlayItems(nextItems),
  };
}

export function setRuntimeMenuPortalPanelMode(
  state: RuntimeMenuState,
  portalPanelMode: PortalPanelModeId,
): RuntimeMenuState {
  return {
    ...state,
    portalPanelMode,
  };
}

export function setRuntimeMenuPortalInspectionEnabled(state: RuntimeMenuState, enabled: boolean): RuntimeMenuState {
  return {
    ...state,
    portalInspectionEnabled: enabled,
  };
}

export function setRuntimeMenuCollisionGeometryWireframesEnabled(
  state: RuntimeMenuState,
  enabled: boolean,
): RuntimeMenuState {
  return {
    ...state,
    collisionGeometryWireframesEnabled: enabled,
  };
}

export function setRuntimeMenuAimCollisionOutlinesEnabled(
  state: RuntimeMenuState,
  enabled: boolean,
): RuntimeMenuState {
  return {
    ...state,
    aimCollisionOutlinesEnabled: enabled,
  };
}

export function setRuntimeMenuAntiNauseaModeEnabled(
  state: RuntimeMenuState,
  enabled: boolean,
): RuntimeMenuState {
  return {
    ...state,
    antiNauseaModeEnabled: enabled,
  };
}

export function setRuntimeMenuSelectedTool(state: RuntimeMenuState, selectedTool: RuntimeToolId): RuntimeMenuState {
  return {
    ...state,
    selectedTool,
  };
}

export function setRuntimeMenuReloadConfirmUntilMs(
  state: RuntimeMenuState,
  reloadConfirmUntilMs: number | undefined,
): RuntimeMenuState {
  return {
    ...state,
    reloadConfirmUntilMs,
  };
}

export function setRuntimeMenuPlaceFlagType(state: RuntimeMenuState, flagType: PlacedFlagType): RuntimeMenuState {
  return {
    ...state,
    placeFlagOptions: {
      ...state.placeFlagOptions,
      flagType,
    },
  };
}

export function selectRuntimeMenuPlaceFlagToolType(state: RuntimeMenuState, flagType: PlacedFlagType): RuntimeMenuState {
  return setRuntimeMenuSelectedTool(setRuntimeMenuPlaceFlagType(state, flagType), "place-flag");
}

export function setRuntimeMenuEditingFlagId(state: RuntimeMenuState, editingFlagId: string | undefined): RuntimeMenuState {
  return {
    ...state,
    editingFlagId,
  };
}

export function createDebugSettingsFromRuntimeMenuState(state: RuntimeMenuState): DebugSettings {
  const debugOptions: DebugOptionId[] = [];

  if (state.debugEnabled) {
    debugOptions.push("runtime-diagnostics");

    if (state.portalInspectionEnabled) {
      debugOptions.push(...portalInspectionDebugOptions);
    }

    if (state.collisionGeometryWireframesEnabled) {
      debugOptions.push(...collisionGeometryDebugOptions);
    }

    if (state.aimCollisionOutlinesEnabled) {
      debugOptions.push(...aimCollisionDebugOptions);
    }

    if (state.debugOverlayEnabled && state.debugOverlayItems.includes("portal-quantities")) {
      debugOptions.push("portal-visible-path-debug");
    }
  }

  return {
    debugLevel: state.debugEnabled ? state.consoleLogLevel : "off",
    portalPanelMode: state.debugEnabled ? state.portalPanelMode : "none",
    debugOptions,
  };
}

export function parseRuntimeDebugOverlayItems(rawValue: string | null): readonly RuntimeDebugOverlayItemId[] {
  if (rawValue === null) {
    return [...defaultRuntimeDebugOverlayItems];
  }

  const knownItems = new Set<RuntimeDebugOverlayItemId>(defaultRuntimeDebugOverlayItems);
  const requestedItems = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is RuntimeDebugOverlayItemId => knownItems.has(value as RuntimeDebugOverlayItemId));

  return orderRuntimeDebugOverlayItems(requestedItems);
}

export function serializeRuntimeDebugOverlayItems(
  items: readonly RuntimeDebugOverlayItemId[],
): string {
  return orderRuntimeDebugOverlayItems(items).join(",");
}

function hasAnyDebugOption(
  debugOptions: readonly DebugOptionId[] | undefined,
  optionIds: readonly DebugOptionId[],
): boolean {
  return optionIds.some((optionId) => debugOptions?.includes(optionId));
}

function orderRuntimeDebugOverlayItems(
  items: readonly RuntimeDebugOverlayItemId[],
): readonly RuntimeDebugOverlayItemId[] {
  const requestedItems = new Set(items);
  return defaultRuntimeDebugOverlayItems.filter((itemId) => requestedItems.has(itemId));
}

function clampTutorialPageIndex(pageIndex: number, pages: readonly TutorialPageSpec[]): number {
  if (pages.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(pages.length - 1, Math.trunc(pageIndex)));
}

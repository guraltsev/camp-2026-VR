import type { DebugOptionId } from "../glue/debugOptions";
import type { DebugSettings } from "../glue/debugSettings";
import type { DebugLevelId } from "../glue/debugLevels";
import type { PortalPanelModeId } from "../glue/portalPanelMode";
import type { PlacedFlagType } from "../world-objects/placedFlags";

export type RuntimeMenuPageId = "main" | "settings" | "debug-settings" | "place-flag-options";
export type RuntimeMenuConsoleLogLevelId = Exclude<DebugLevelId, "off">;
export type RuntimeDebugOverlayItemId = "fps" | "location" | "portal-quantities";
export type RuntimeDesktopToolId = "none" | "place-flag";

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

export interface RuntimeMenuState {
  readonly isOpen: boolean;
  readonly page: RuntimeMenuPageId;
  readonly selectedWorldId: string;
  readonly debugEnabled: boolean;
  readonly consoleLogLevel: RuntimeMenuConsoleLogLevelId;
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly portalPanelMode: PortalPanelModeId;
  readonly portalInspectionEnabled: boolean;
  readonly collisionGeometryWireframesEnabled: boolean;
  readonly selectedTool: RuntimeDesktopToolId;
  readonly placeFlagOptions: {
    readonly flagType: PlacedFlagType;
  };
  readonly editingFlagId?: string;
}

export interface CreateRuntimeMenuStateOptions {
  readonly selectedWorldId: string;
  readonly debugSettings?: DebugSettings;
  readonly debugOverlayEnabled?: boolean;
  readonly debugOverlayItems?: readonly RuntimeDebugOverlayItemId[];
}

export function createRuntimeMenuState(options: CreateRuntimeMenuStateOptions): RuntimeMenuState {
  const debugSettings = options.debugSettings;

  return {
    isOpen: false,
    page: "main",
    selectedWorldId: options.selectedWorldId,
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
  };
}

export function setRuntimeMenuSelectedWorldId(state: RuntimeMenuState, worldId: string): RuntimeMenuState {
  return {
    ...state,
    selectedWorldId: worldId,
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

export function setRuntimeMenuSelectedTool(state: RuntimeMenuState, selectedTool: RuntimeDesktopToolId): RuntimeMenuState {
  return {
    ...state,
    selectedTool,
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

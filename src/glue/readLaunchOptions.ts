import { defaultWorldId, findWorldCatalogEntry, normalizeWorldId } from "../authoring/worldCatalog";
import { parseDebugOptions, type DebugOptionId } from "./debugOptions";
import { parseDebugLevel, type DebugLevelId } from "./debugLevels";
import { parsePortalPanelMode, type PortalPanelModeId } from "./portalPanelMode";
import { parseUiOptions, type UiOptionId } from "./uiOptions";
import {
  parseRuntimeDebugOverlayItems,
  type RuntimeDebugOverlayItemId,
} from "../runtime/runtimeMenuState";
import { defaultAppConfig, defaultAppConfigName, type AppConfig } from "./appConfig";

export interface LaunchOptions {
  readonly selectedWorldId: string;
  readonly uiOptions: readonly UiOptionId[];
  readonly renderWorldPicker: boolean;
  readonly renderDebugButton: boolean;
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
  readonly debugOverlayEnabled: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly renderQualityEnabled: boolean;
  readonly appConfig: AppConfig;
  readonly appConfigName: string;
}

export function readLaunchOptions(
  location: Location,
  appConfig: AppConfig = defaultAppConfig,
  appConfigName = defaultAppConfigName,
): LaunchOptions {
  const params = new URLSearchParams(location.search);
  const requestedWorldId = normalizeWorldId(params.get("world")) ?? appConfig.startingWorldId ?? defaultWorldId;
  const selectedWorldId = findWorldCatalogEntry(requestedWorldId)?.id ?? defaultWorldId;
  const requestedUiOptions = parseUiOptions(params.get("ui"));
  const hasExplicitUiOptions = params.has("ui");
  const renderWorldPicker = hasExplicitUiOptions
    ? requestedUiOptions.includes("WorldSelector")
    : appConfig.menu.worldSelectionSectionEnabled;
  const legacyDebugEnabled = isEnabled(params.get("debug"));
  const renderDebugButton = hasExplicitUiOptions
    ? requestedUiOptions.includes("DebugButton")
    : appConfig.menu.debugSectionEnabled;
  const debugOptions = params.has("debugOptions")
    ? parseDebugOptions(params.get("debugOptions"))
    : appConfig.debug.options;
  const legacyPortalPanelsEnabled = params
    .get("debugOptions")
    ?.split(",")
    .map((value) => value.trim())
    .includes("portal-panels");
  const debugLevel = params.has("debugLevel") || params.has("debug")
    ? parseDebugLevel(params.get("debugLevel")) ?? (legacyDebugEnabled ? "basic" : "off")
    : appConfig.debug.level;
  const portalPanelMode = params.has("portalPanels") || legacyPortalPanelsEnabled
    ? parsePortalPanelMode(params.get("portalPanels")) ?? (legacyPortalPanelsEnabled ? "panel-with-text" : "none")
    : appConfig.debug.portalPanelMode;

  return {
    selectedWorldId,
    uiOptions: [
      ...(renderWorldPicker ? (["WorldSelector"] as const) : []),
      ...(renderDebugButton ? (["DebugButton"] as const) : []),
    ],
    renderWorldPicker,
    renderDebugButton,
    debugLevel,
    portalPanelMode,
    debugOptions,
    debugOverlayEnabled: params.has("debugOverlay")
      ? !isExplicitlyDisabled(params.get("debugOverlay"))
      : appConfig.debug.overlayEnabled,
    debugOverlayItems: params.has("debugOverlayItems")
      ? parseRuntimeDebugOverlayItems(params.get("debugOverlayItems"))
      : appConfig.debug.overlayItems,
    renderQualityEnabled: params.has("renderQuality")
      ? isRenderQualityEnabled(params.get("renderQuality"))
      : appConfig.debug.renderQualityEnabled,
    appConfig,
    appConfigName,
  };
}

function isEnabled(rawValue: string | null): boolean {
  return rawValue !== null && rawValue !== "0" && rawValue !== "false" && rawValue !== "no";
}

function isExplicitlyDisabled(rawValue: string | null): boolean {
  return rawValue === "0" || rawValue === "false" || rawValue === "no" || rawValue === "off";
}

function isRenderQualityEnabled(rawValue: string | null): boolean {
  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on" || rawValue === "enabled";
}

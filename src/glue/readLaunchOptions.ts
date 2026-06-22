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
import { defaultVrComfortOptions, type VrComfortOptions } from "../render/three/vrComfort";

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
  readonly vrComfortOptions: VrComfortOptions;
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
    vrComfortOptions: readVrComfortOptions(params),
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

function readVrComfortOptions(params: URLSearchParams): VrComfortOptions {
  return {
    ...defaultVrComfortOptions,
    antiNauseaModeEnabled: params.has("antiNausea")
      ? !isExplicitlyDisabled(params.get("antiNausea"))
      : defaultVrComfortOptions.antiNauseaModeEnabled,
    antiNauseaVisibleFovScale: readNumberParam(
      params,
      "antiNauseaFovScale",
      defaultVrComfortOptions.antiNauseaVisibleFovScale,
      0.05,
      1,
    ),
  };
}

function readNumberParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const rawValue = params.get(key);
  if (rawValue === null) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

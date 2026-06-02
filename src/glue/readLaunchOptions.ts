import { defaultWorldId, findWorldCatalogEntry, normalizeWorldId } from "../authoring/worldCatalog";
import { parseDebugOptions, type DebugOptionId } from "./debugOptions";
import { parseDebugLevel, type DebugLevelId } from "./debugLevels";
import { parsePortalPanelMode, type PortalPanelModeId } from "./portalPanelMode";
import { parseUiOptions, type UiOptionId } from "./uiOptions";
import {
  parseRuntimeDebugOverlayItems,
  type RuntimeDebugOverlayItemId,
} from "../runtime/runtimeMenuState";

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
}

export function readLaunchOptions(location: Location): LaunchOptions {
  const params = new URLSearchParams(location.search);
  const requestedWorldId = normalizeWorldId(params.get("world")) ?? defaultWorldId;
  const selectedWorldId = findWorldCatalogEntry(requestedWorldId)?.id ?? defaultWorldId;
  const requestedUiOptions = parseUiOptions(params.get("ui"));
  const hasExplicitUiOptions = params.has("ui");
  const renderWorldPicker = hasExplicitUiOptions
    ? requestedUiOptions.includes("WorldSelector")
    : true;
  const legacyDebugEnabled = isEnabled(params.get("debug"));
  const renderDebugButton = hasExplicitUiOptions
    ? requestedUiOptions.includes("DebugButton")
    : true;
  const debugOptions = parseDebugOptions(params.get("debugOptions"));
  const legacyPortalPanelsEnabled = params
    .get("debugOptions")
    ?.split(",")
    .map((value) => value.trim())
    .includes("portal-panels");

  return {
    selectedWorldId,
    uiOptions: [
      ...(renderWorldPicker ? (["WorldSelector"] as const) : []),
      ...(renderDebugButton ? (["DebugButton"] as const) : []),
    ],
    renderWorldPicker,
    renderDebugButton,
    debugLevel: parseDebugLevel(params.get("debugLevel")) ?? (legacyDebugEnabled ? "basic" : "off"),
    portalPanelMode: parsePortalPanelMode(params.get("portalPanels")) ?? (legacyPortalPanelsEnabled ? "panel-with-text" : "none"),
    debugOptions,
    debugOverlayEnabled: !isExplicitlyDisabled(params.get("debugOverlay")),
    debugOverlayItems: parseRuntimeDebugOverlayItems(params.get("debugOverlayItems")),
    renderQualityEnabled: isRenderQualityEnabled(params.get("renderQuality")),
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

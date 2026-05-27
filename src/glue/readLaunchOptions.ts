import { defaultWorldId, findWorldCatalogEntry, normalizeWorldId } from "../authoring/worldCatalog";
import { parseDebugOptions, type DebugOptionId } from "./debugOptions";
import { parseDebugLevel, type DebugLevelId } from "./debugLevels";
import { parsePortalPanelMode, type PortalPanelModeId } from "./portalPanelMode";
import { parseUiOptions, type UiOptionId } from "./uiOptions";

export interface LaunchOptions {
  readonly selectedWorldId: string;
  readonly uiOptions: readonly UiOptionId[];
  readonly renderWorldPicker: boolean;
  readonly renderDebugButton: boolean;
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
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
  };
}

function isEnabled(rawValue: string | null): boolean {
  return rawValue !== null && rawValue !== "0" && rawValue !== "false" && rawValue !== "no";
}

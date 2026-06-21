import { findWorldCatalogEntry, normalizeWorldId, defaultWorldId } from "../authoring/worldCatalog";
import { debugOptionDefinitions, type DebugOptionId } from "./debugOptions";
import { parseDebugLevel, type DebugLevelId } from "./debugLevels";
import { parsePortalPanelMode, type PortalPanelModeId } from "./portalPanelMode";
import type { RuntimeDebugOverlayItemId, RuntimeToolId } from "../runtime/runtimeMenuState";

export type ConfigurableToolId = "place-flag" | "geodesic-cannon" | "measure-length" | "protractor";

export interface AppMenuConfig {
  readonly worldSelectionSectionEnabled: boolean;
  readonly debugSectionEnabled: boolean;
}

export interface AppToolConfig {
  readonly placeFlags: boolean;
  readonly geodesicEmitters: boolean;
  readonly distances: boolean;
  readonly angles: boolean;
}

export interface AppDebugConfig {
  readonly level: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly options: readonly DebugOptionId[];
  readonly overlayEnabled: boolean;
  readonly overlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly renderQualityEnabled: boolean;
}

export interface AppConfig {
  readonly startingWorldId: string;
  readonly menu: AppMenuConfig;
  readonly tools: AppToolConfig;
  readonly debug: AppDebugConfig;
}

export type RawAppConfig = Record<string, unknown>;

export const defaultAppConfigName = "default";

const defaultDebugOverlayItems = ["fps", "location", "portal-quantities"] as const;
const debugOptionIds = debugOptionDefinitions.map((option) => option.id);

export const defaultAppConfig: AppConfig = {
  startingWorldId: defaultWorldId,
  menu: {
    worldSelectionSectionEnabled: true,
    debugSectionEnabled: true,
  },
  tools: {
    placeFlags: true,
    geodesicEmitters: true,
    distances: true,
    angles: true,
  },
  debug: {
    level: "off",
    portalPanelMode: "none",
    options: [],
    overlayEnabled: true,
    overlayItems: [...defaultDebugOverlayItems],
    renderQualityEnabled: false,
  },
};

export async function loadAppConfig(configName = defaultAppConfigName): Promise<AppConfig> {
  const configUrl = buildAppConfigUrl(configName);
  try {
    const module = await import(/* @vite-ignore */ `${configUrl}?v=${Date.now()}`);
    return normalizeAppConfig(module.default ?? module.noneuclidConfig ?? {});
  } catch (error) {
    console.warn("[noneuclid] using built-in defaults; unable to load app config", error);
    return defaultAppConfig;
  }
}

export function readAppConfigName(location: Location): string {
  const params = new URLSearchParams(location.search);
  return normalizeAppConfigName(params.get("config"));
}

export function normalizeAppConfigName(rawValue: string | null | undefined): string {
  if (!rawValue) {
    return defaultAppConfigName;
  }

  const withoutExtension = rawValue.replace(/(\.config)?\.js$/, "");
  return /^[a-zA-Z0-9_-]+$/.test(withoutExtension) ? withoutExtension : defaultAppConfigName;
}

export function buildAppConfigUrl(configName: string): string {
  return `/${normalizeAppConfigName(configName)}.config.js`;
}

export function normalizeAppConfig(rawConfig: unknown): AppConfig {
  const raw = isRecord(rawConfig) ? rawConfig : {};
  const rawMenu = readRecord(raw, "optionsMenu") ?? readRecord(raw, "menu") ?? {};
  const rawTools = readRecord(raw, "tools") ?? {};
  const rawDebug = readRecord(raw, "debug") ?? {};
  const rawOverlay = readRecord(rawDebug, "overlay") ?? {};

  return {
    startingWorldId: readWorldId(raw, "startingWorld") ?? readWorldId(raw, "startingWorldId") ?? defaultAppConfig.startingWorldId,
    menu: {
      worldSelectionSectionEnabled: readBoolean(rawMenu, "worldSelectionSection", defaultAppConfig.menu.worldSelectionSectionEnabled),
      debugSectionEnabled: readBoolean(rawMenu, "debugSection", defaultAppConfig.menu.debugSectionEnabled),
    },
    tools: {
      placeFlags: readBoolean(rawTools, "placeFlags", defaultAppConfig.tools.placeFlags),
      geodesicEmitters: readBoolean(rawTools, "geodesicEmitters", defaultAppConfig.tools.geodesicEmitters),
      distances: readBoolean(rawTools, "distances", defaultAppConfig.tools.distances),
      angles: readBoolean(rawTools, "angles", defaultAppConfig.tools.angles),
    },
    debug: {
      level: readDebugLevel(rawDebug, "level", defaultAppConfig.debug.level),
      portalPanelMode: readPortalPanelMode(rawDebug, "portalPanels", defaultAppConfig.debug.portalPanelMode),
      options: readDebugOptions(rawDebug),
      overlayEnabled: readBoolean(rawOverlay, "enabled", defaultAppConfig.debug.overlayEnabled),
      overlayItems: readOverlayItems(rawOverlay),
      renderQualityEnabled: readBoolean(rawDebug, "renderQuality", defaultAppConfig.debug.renderQualityEnabled),
    },
  };
}

export function isRuntimeToolEnabled(config: AppConfig, toolId: RuntimeToolId): boolean {
  switch (toolId) {
    case "place-flag":
      return config.tools.placeFlags;
    case "geodesic-cannon":
    case "geodesic-cannon-carry":
    case "geodesic-cannon-rotate":
    case "geodesic-cannon-aim":
    case "geodesic-cannon-tie-detach":
      return config.tools.geodesicEmitters;
    case "measure-length":
      return config.tools.distances;
    case "protractor":
      return config.tools.angles;
    default:
      return true;
  }
}

export function getEnabledMainTools(config: AppConfig): readonly ConfigurableToolId[] {
  return [
    ...(config.tools.placeFlags ? (["place-flag"] as const) : []),
    ...(config.tools.geodesicEmitters ? (["geodesic-cannon"] as const) : []),
    ...(config.tools.distances ? (["measure-length"] as const) : []),
    ...(config.tools.angles ? (["protractor"] as const) : []),
  ];
}

function readWorldId(raw: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = raw[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeWorldId(value);
  return normalized && findWorldCatalogEntry(normalized) ? normalized : undefined;
}

function readDebugLevel(raw: Readonly<Record<string, unknown>>, key: string, fallback: DebugLevelId): DebugLevelId {
  const value = raw[key];
  return typeof value === "string" ? parseDebugLevel(value) ?? fallback : fallback;
}

function readPortalPanelMode(raw: Readonly<Record<string, unknown>>, key: string, fallback: PortalPanelModeId): PortalPanelModeId {
  const value = raw[key];
  return typeof value === "string" ? parsePortalPanelMode(value) ?? fallback : fallback;
}

function readDebugOptions(rawDebug: Readonly<Record<string, unknown>>): readonly DebugOptionId[] {
  const rawOptions = readRecord(rawDebug, "options") ?? rawDebug;
  return debugOptionIds.filter((optionId) => rawOptions[optionId] === true);
}

function readOverlayItems(rawOverlay: Readonly<Record<string, unknown>>): readonly RuntimeDebugOverlayItemId[] {
  const rawItems = readRecord(rawOverlay, "items") ?? {};
  return defaultDebugOverlayItems.filter((itemId) => rawItems[itemId] !== false);
}

function readBoolean(raw: Readonly<Record<string, unknown>>, key: string, fallback: boolean): boolean {
  const value = raw[key];
  return typeof value === "boolean" ? value : fallback;
}

function readRecord(raw: Readonly<Record<string, unknown>>, key: string): Readonly<Record<string, unknown>> | undefined {
  const value = raw[key];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

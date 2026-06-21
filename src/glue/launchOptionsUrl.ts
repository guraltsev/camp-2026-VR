import type { LaunchOptions } from "./readLaunchOptions";
import { serializeDebugOptions } from "./debugOptions";
import { serializeUiOptions } from "./uiOptions";
import { defaultAppConfigName } from "./appConfig";
import { serializeRuntimeDebugOverlayItems } from "../runtime/runtimeMenuState";

const launchOptionSearchParams = [
  "config",
  "world",
  "ui",
  "debug",
  "debugLevel",
  "portalPanels",
  "debugOptions",
  "debugOverlay",
  "debugOverlayItems",
  "renderQuality",
  "worldPicker",
] as const;

export function removeLaunchOptionsFromUrl(href: string): string {
  const url = new URL(href);

  for (const param of launchOptionSearchParams) {
    url.searchParams.delete(param);
  }

  return url.toString();
}

export function replaceVisibleUrlWithoutLaunchOptions(window: Window): void {
  const cleanUrl = removeLaunchOptionsFromUrl(window.location.href);

  if (cleanUrl !== window.location.href) {
    window.history.replaceState({}, "", cleanUrl);
  }
}

export function buildUrlWithLaunchOptions(href: string, options: LaunchOptions): string {
  const url = new URL(removeLaunchOptionsFromUrl(href));

  if (options.appConfigName !== defaultAppConfigName) {
    url.searchParams.set("config", options.appConfigName);
  }

  url.searchParams.set("world", options.selectedWorldId);
  url.searchParams.set("ui", serializeUiOptions(options.uiOptions));
  url.searchParams.set("debugLevel", options.debugLevel);
  url.searchParams.set("portalPanels", options.portalPanelMode);

  const debugOptions = serializeDebugOptions(options.debugOptions);
  if (debugOptions) {
    url.searchParams.set("debugOptions", debugOptions);
  }

  url.searchParams.set("debugOverlay", options.debugOverlayEnabled ? "true" : "false");
  url.searchParams.set("debugOverlayItems", serializeRuntimeDebugOverlayItems(options.debugOverlayItems));
  url.searchParams.set("renderQuality", options.renderQualityEnabled ? "true" : "false");

  return url.toString();
}

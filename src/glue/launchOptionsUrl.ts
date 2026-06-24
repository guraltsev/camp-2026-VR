import type { LaunchOptions } from "./readLaunchOptions";
import { serializeDebugOptions } from "./debugOptions";
import { serializeUiOptions } from "./uiOptions";
import { defaultAppConfigName } from "./appConfig";
import { serializeRuntimeDebugOverlayItems } from "../runtime/runtimeMenuState";

const launchOptionSearchParams = [
  "world",
  "ui",
  "debug",
  "debugLevel",
  "portalPanels",
  "debugOptions",
  "debugOverlay",
  "debugOverlayItems",
  "renderQuality",
  "antiNausea",
  "antiNauseaFovScale",
  "worldPicker",
] as const;

const copiedUrlLaunchOptionSearchParams = [
  "config",
  "configName",
  ...launchOptionSearchParams,
] as const;

export function removeLaunchOptionsFromUrl(href: string): string {
  return removeSearchParamsFromUrl(href, launchOptionSearchParams);
}

function removeCopiedUrlLaunchOptionsFromUrl(href: string): string {
  return removeSearchParamsFromUrl(href, copiedUrlLaunchOptionSearchParams);
}

function removeSearchParamsFromUrl(href: string, paramsToRemove: readonly string[]): string {
  const url = new URL(href);

  for (const param of paramsToRemove) {
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
  const url = new URL(removeCopiedUrlLaunchOptionsFromUrl(href));

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
  url.searchParams.set("antiNausea", options.vrComfortOptions.antiNauseaModeEnabled ? "true" : "false");
  url.searchParams.set(
    "antiNauseaFovScale",
    String(options.vrComfortOptions.antiNauseaVisibleFovScale),
  );

  return url.toString();
}

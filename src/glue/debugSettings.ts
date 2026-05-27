import type { DebugOptionId } from "./debugOptions";
import type { DebugLevelId } from "./debugLevels";
import type { PortalPanelModeId } from "./portalPanelMode";

export interface DebugSettings {
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly debugOptions: readonly DebugOptionId[];
}

export interface DebugSettingsSupport {
  readonly runtimeMutableOptions: readonly DebugOptionId[];
}

const defaultDebugSettingsSupport: DebugSettingsSupport = {
  runtimeMutableOptions: ["runtime-diagnostics"],
};

export function canApplyDebugSettingsAtRuntime(
  settings: DebugSettings,
  support: DebugSettingsSupport = defaultDebugSettingsSupport,
): boolean {
  const runtimeMutableOptions = new Set<DebugOptionId>(support.runtimeMutableOptions);
  return settings.debugOptions.every((optionId) => runtimeMutableOptions.has(optionId));
}

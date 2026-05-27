export const debugLevelDefinitions = [
  {
    id: "off",
    label: "Off",
    description: "Keep debug systems disabled while leaving the launcher available.",
  },
  {
    id: "basic",
    label: "Basic",
    description: "Enable selected visual and runtime debug features.",
  },
  {
    id: "verbose",
    label: "Verbose",
    description: "Enable selected debug features and keep detailed console traces flowing.",
  },
] as const;

export type DebugLevelId = (typeof debugLevelDefinitions)[number]["id"];

const debugLevelIds = new Set<DebugLevelId>(debugLevelDefinitions.map((level) => level.id));

export function parseDebugLevel(rawValue: string | null): DebugLevelId | undefined {
  if (!rawValue) {
    return undefined;
  }

  return debugLevelIds.has(rawValue as DebugLevelId) ? (rawValue as DebugLevelId) : undefined;
}

export function isDebugLevelEnabled(debugLevel: DebugLevelId): boolean {
  return debugLevel !== "off";
}

export function isVerboseDebugLevel(debugLevel: DebugLevelId): boolean {
  return debugLevel === "verbose";
}

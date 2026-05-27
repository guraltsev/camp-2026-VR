export const debugOptionDefinitions = [
  {
    id: "runtime-diagnostics",
    label: "Runtime Diagnostics",
    description: "Log asset loads, portal crossings, and slow frames to the dev console.",
  },
] as const;

export type DebugOptionId = (typeof debugOptionDefinitions)[number]["id"];

const debugOptionIds = new Set<DebugOptionId>(debugOptionDefinitions.map((option) => option.id));

export function parseDebugOptions(rawValue: string | null): readonly DebugOptionId[] {
  if (!rawValue) {
    return [];
  }

  const requestedIds = new Set(
    rawValue
    .split(",")
    .map((value) => value.trim())
      .filter((value): value is DebugOptionId => debugOptionIds.has(value as DebugOptionId)),
  );

  return debugOptionDefinitions.map((option) => option.id).filter((optionId) => requestedIds.has(optionId));
}

export function serializeDebugOptions(debugOptions: readonly DebugOptionId[]): string {
  return debugOptionDefinitions
    .map((option) => option.id)
    .filter((optionId) => debugOptions.includes(optionId))
    .join(",");
}

export function hasDebugOption(debugOptions: readonly DebugOptionId[], optionId: DebugOptionId): boolean {
  return debugOptions.includes(optionId);
}

export function hasActiveDebugOption(
  debugLevel: "off" | "basic" | "verbose",
  debugOptions: readonly DebugOptionId[],
  optionId: DebugOptionId,
): boolean {
  return debugLevel !== "off" && hasDebugOption(debugOptions, optionId);
}

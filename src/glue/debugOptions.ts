export const debugOptionDefinitions = [
  {
    id: "runtime-diagnostics",
    label: "Runtime Diagnostics",
    description: "Log asset loads, portal crossings, and slow frames to the dev console.",
  },
  {
    id: "portal-path-debug",
    label: "Portal Path Debug",
    description: "Expose portal path table summaries and dev-console inspection helpers.",
  },
  {
    id: "portal-static-cull-debug",
    label: "Portal Static Cull Debug",
    description: "Include static portal culling summaries and rejected path details.",
  },
  {
    id: "portal-visible-path-debug",
    label: "Portal Visible Path Debug",
    description: "Compute live camera-visible portal paths and show compact per-frame counts.",
  },
  {
    id: "portal-path-overlays",
    label: "Portal Path Overlays",
    description: "Allow temporary visual overlays for inspected portal paths.",
  },
  {
    id: "portal-path-overlay-instances",
    label: "ShowCellPathRendersInstances",
    description: "Render ShowCellPath overlays through the portal instance archetype path.",
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

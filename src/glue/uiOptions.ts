export const uiOptionDefinitions = [
  {
    id: "WorldSelector",
    label: "World Selector",
  },
  {
    id: "DebugButton",
    label: "Debug Button",
  },
] as const;

export type UiOptionId = (typeof uiOptionDefinitions)[number]["id"];

const uiOptionIds = new Set<UiOptionId>(uiOptionDefinitions.map((option) => option.id));

export function parseUiOptions(rawValue: string | null): readonly UiOptionId[] {
  if (!rawValue) {
    return [];
  }

  const requestedIds = new Set(
    rawValue
    .split(",")
    .map((value) => value.trim())
      .filter((value): value is UiOptionId => uiOptionIds.has(value as UiOptionId)),
  );

  return uiOptionDefinitions.map((option) => option.id).filter((optionId) => requestedIds.has(optionId));
}

export function serializeUiOptions(uiOptions: readonly UiOptionId[]): string {
  return uiOptionDefinitions
    .map((option) => option.id)
    .filter((optionId) => uiOptions.includes(optionId))
    .join(",");
}

export function hasUiOption(uiOptions: readonly UiOptionId[], optionId: UiOptionId): boolean {
  return uiOptions.includes(optionId);
}

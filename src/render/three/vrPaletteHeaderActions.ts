import type { PaletteDefinition, PaletteHeaderAction } from "../../ui/paletteDefinition";

export interface VrPaletteHeaderActions {
  readonly leftAction: PaletteHeaderAction;
  readonly rightAction: PaletteHeaderAction;
}

export function resolveVrPaletteHeaderActions(
  definition: Pick<PaletteDefinition, "leftAction" | "rightAction">,
): VrPaletteHeaderActions {
  if (definition.rightAction.id === "back") {
    return {
      leftAction: definition.rightAction,
      rightAction: createCloseHeaderAction(),
    };
  }

  if (definition.rightAction.id === "close") {
    return {
      leftAction: definition.leftAction,
      rightAction: definition.rightAction,
    };
  }

  return {
    leftAction: definition.leftAction,
    rightAction: createCloseHeaderAction(),
  };
}

function createCloseHeaderAction(): PaletteHeaderAction {
  return {
    id: "close",
    label: "X",
    ariaLabel: "Close palette",
    disabled: false,
  };
}

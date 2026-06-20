export function resolvePaletteTooltipLabel(itemId: string | undefined): string | undefined {
  if (!itemId) {
    return undefined;
  }

  if (itemId.startsWith("tool:")) {
    return toolTooltip(itemId.slice("tool:".length));
  }

  if (itemId.startsWith("geodesic-cannon-action:delete:")) {
    return "Delete geodesic";
  }

  if (itemId.startsWith("geodesic-cannon-action:rotate:")) {
    return "Rotate";
  }

  if (itemId.startsWith("geodesic-cannon-action:aim:")) {
    return "Aim";
  }

  if (itemId.startsWith("geometry-computer:set:")) {
    return "Set skew";
  }

  if (itemId.startsWith("geometry-computer:step:")) {
    return "Step skew";
  }

  if (itemId.startsWith("sign-type:")) {
    return "Choose sign type";
  }

  if (itemId.startsWith("sign-key:")) {
    return itemId.slice("sign-key:".length);
  }

  return fixedTooltips[itemId];
}

const fixedTooltips: Readonly<Record<string, string>> = {
  "settings": "Settings",
  "close": "Close",
  "back": "Back",
  "go-home": "Home",
  "reload-world": "Reload",
  "debug-settings": "Debug settings",
  "debug-tools-toggle": "Debug tools",
  "tool-options:place-sign": "Sign options",
  "geodesic-cannon-action:add-geodesic": "Add geodesic",
  "geodesic-cannon-action:carry": "Carry",
  "geodesic-cannon-action:tie-and-detach": "Tie and detach",
  "sign-action:trash": "Delete sign",
  "sign-key:Space": "Space",
  "sign-key:Enter": "New line",
  "sign-key:Backspace": "Backspace",
};

function toolTooltip(toolId: string): string | undefined {
  switch (toolId) {
    case "place-flag":
      return "Place sign";
    case "geodesic-cannon":
      return "Create and terminate straight lines";
    case "measure-length":
      return "Measure length";
    case "protractor":
      return "Measure angle";
    default:
      return undefined;
  }
}

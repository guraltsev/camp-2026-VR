import type { RuntimeDesktopToolId } from "../../runtime/runtimeMenuState";
import type { PlacedFlagType } from "../../world-objects/placedFlags";

export interface DesktopToolIndicator {
  readonly root: HTMLDivElement;
  setTool(toolId: RuntimeDesktopToolId, flagType: PlacedFlagType): void;
  dispose(): void;
}

export function createDesktopToolIndicator(container: HTMLElement): DesktopToolIndicator {
  const root = document.createElement("div");
  root.className = "desktop-tool-indicator";
  root.hidden = true;

  const icon = document.createElement("span");
  icon.className = "desktop-tool-indicator-icon";
  icon.setAttribute("aria-hidden", "true");

  const board = document.createElement("span");
  board.className = "desktop-tool-indicator-board";
  const post = document.createElement("span");
  post.className = "desktop-tool-indicator-post";
  icon.append(board, post);

  const label = document.createElement("span");
  label.className = "desktop-tool-indicator-label";

  root.append(icon, label);
  container.append(root);

  return {
    root,
    setTool(toolId, flagType) {
      root.hidden = toolId === "none";
      root.classList.toggle("desktop-tool-indicator-WoodenSign1", flagType === "WoodenSign1");
      root.classList.toggle("desktop-tool-indicator-WoodenSign2", flagType === "WoodenSign2");
      label.textContent = toolId === "place-flag" ? "Flags" : "";
      root.ariaLabel = toolId === "place-flag" ? "Selected tool: flags" : "No selected tool";
    },
    dispose() {
      root.remove();
    },
  };
}

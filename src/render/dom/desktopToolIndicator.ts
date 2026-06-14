import type { RuntimeDesktopToolId } from "../../runtime/runtimeMenuState";
import type { PlacedFlagType } from "../../world-objects/placedFlags";

const signIconSources: Record<PlacedFlagType, string> = {
  WoodenSign1: "/assets/WoodenSign1/WoodenSign1.png",
  WoodenSign2: "/assets/WoodenSign2/WoodenSign2.png",
};

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

  const aimIcon = createSvgIcon("desktop-tool-indicator-svg", "0 0 24 24", [
    ["circle", { cx: "12", cy: "12", r: "7" }],
    ["path", { d: "M12 2v4" }],
    ["path", { d: "M12 18v4" }],
    ["path", { d: "M2 12h4" }],
    ["path", { d: "M18 12h4" }],
  ]);
  aimIcon.classList.add("desktop-tool-indicator-aim-icon");

  const signIcon = document.createElement("img");
  signIcon.className = "desktop-tool-indicator-sign-icon";
  signIcon.alt = "";
  signIcon.decoding = "async";

  const lightIcon = createSvgIcon("desktop-tool-indicator-svg", "0 0 24 24", [
    ["path", { d: "M18 6l-6 6" }],
    ["path", { d: "M9 11l4 4" }],
    ["path", { d: "M6 14l4 4" }],
    ["path", { d: "M5 13l6 6" }],
    ["path", { d: "M13 5l6 6" }],
    ["path", { d: "M15 3l6 6" }],
  ]);
  lightIcon.classList.add("desktop-tool-indicator-light-icon");
  icon.append(aimIcon, signIcon, lightIcon);

  const label = document.createElement("span");
  label.className = "desktop-tool-indicator-label";

  root.append(icon, label);
  container.append(root);

  return {
    root,
    setTool(toolId, flagType) {
      root.hidden = toolId === "none";
      root.classList.toggle("desktop-tool-indicator-aim", toolId === "aim");
      root.classList.toggle("desktop-tool-indicator-place-flag", toolId === "place-flag");
      root.classList.toggle("desktop-tool-indicator-geodesic-cannon", toolId === "geodesic-cannon");
      root.classList.toggle("desktop-tool-indicator-WoodenSign1", flagType === "WoodenSign1");
      root.classList.toggle("desktop-tool-indicator-WoodenSign2", flagType === "WoodenSign2");
      signIcon.src = signIconSources[flagType];
      label.textContent = toolId === "geodesic-cannon" ? "Light" : toolId === "place-flag" ? "Sign" : toolId === "aim" ? "Aim" : "";
      root.ariaLabel = toolId === "place-flag"
        ? "Selected tool: sign"
        : toolId === "geodesic-cannon"
          ? "Selected tool: geodesic flashlight"
          : toolId === "aim"
            ? "Selected tool: aim"
            : "No selected tool";
    },
    dispose() {
      root.remove();
    },
  };
}

function createSvgIcon(
  className: string,
  viewBox: string,
  children: readonly [string, Record<string, string>][],
): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add(className);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  for (const [tagName, attributes] of children) {
    const child = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    for (const [name, value] of Object.entries(attributes)) {
      child.setAttribute(name, value);
    }
    svg.append(child);
  }

  return svg;
}

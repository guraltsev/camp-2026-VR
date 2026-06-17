import type { RuntimeDesktopToolId } from "../../runtime/runtimeMenuState";
import type { PlacedFlagType } from "../../world-objects/placedFlags";

const signIconSources: Record<PlacedFlagType, string> = {
  WoodenSign1: "/assets/WoodenSign1/WoodenSign1.png",
  WoodenSign2: "/assets/WoodenSign2/WoodenSign2.png",
};
const rayToolIconSource = "/assets/flashlight/Lightsaber.png";
const protractorToolIconSource = "/assets/icons/protractor.png";

export interface DesktopToolIndicator {
  readonly root: HTMLDivElement;
  setTool(
    toolId: RuntimeDesktopToolId,
    flagType: PlacedFlagType,
    options?: { readonly protractorPrompt?: string },
  ): void;
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

  const rayIcon = document.createElement("img");
  rayIcon.className = "desktop-tool-indicator-ray-icon";
  rayIcon.alt = "";
  rayIcon.decoding = "async";
  rayIcon.src = rayToolIconSource;
  const protractorIcon = document.createElement("img");
  protractorIcon.className = "desktop-tool-indicator-protractor-icon";
  protractorIcon.alt = "";
  protractorIcon.decoding = "async";
  protractorIcon.src = protractorToolIconSource;
  protractorIcon.setAttribute("aria-hidden", "true");
  icon.append(aimIcon, signIcon, rayIcon, protractorIcon);

  const label = document.createElement("span");
  label.className = "desktop-tool-indicator-label";
  const prompt = document.createElement("span");
  prompt.className = "desktop-tool-indicator-prompt";

  const text = document.createElement("span");
  text.className = "desktop-tool-indicator-text";
  text.append(label, prompt);

  root.append(icon, text);
  container.append(root);

  return {
    root,
    setTool(toolId, flagType, indicatorOptions = {}) {
      root.hidden = toolId === "none" || toolId === "aim";
      root.classList.toggle("desktop-tool-indicator-aim", toolId === "aim");
      root.classList.toggle("desktop-tool-indicator-place-flag", toolId === "place-flag");
      root.classList.toggle(
        "desktop-tool-indicator-geodesic-cannon",
        toolId === "geodesic-cannon" ||
          toolId === "geodesic-cannon-rotate" ||
          toolId === "geodesic-cannon-aim",
      );
      root.classList.toggle("desktop-tool-indicator-protractor", toolId === "protractor");
      root.classList.toggle("desktop-tool-indicator-WoodenSign1", flagType === "WoodenSign1");
      root.classList.toggle("desktop-tool-indicator-WoodenSign2", flagType === "WoodenSign2");
      signIcon.src = signIconSources[flagType];
      label.textContent = toolId === "geodesic-cannon-rotate"
        ? "Rotate"
        : toolId === "geodesic-cannon-aim"
          ? "Aim"
          : toolId === "protractor"
            ? "Angle"
          : toolId === "geodesic-cannon"
            ? "Ray"
            : toolId === "place-flag"
              ? "Sign"
              : "";
      prompt.textContent = toolId === "protractor" ? indicatorOptions.protractorPrompt ?? "select: vertex" : "";
      prompt.hidden = toolId !== "protractor";
      root.ariaLabel = toolId === "place-flag"
        ? "Selected tool: sign"
        : toolId === "geodesic-cannon"
          ? "Selected tool: geodesic ray"
          : toolId === "protractor"
            ? `Selected tool: protractor, ${prompt.textContent}`
          : toolId === "geodesic-cannon-rotate"
            ? "Selected tool: rotate geodesic ray emitter"
            : toolId === "geodesic-cannon-aim"
              ? "Selected tool: aim geodesic ray emitter"
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

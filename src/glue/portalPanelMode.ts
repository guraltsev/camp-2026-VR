export const portalPanelModeDefinitions = [
  {
    id: "none",
    label: "None",
    description: "Hide the textured portal wall and its label placard.",
  },
  {
    id: "panel",
    label: "Panel",
    description: "Show the textured portal wall without the label placard.",
  },
  {
    id: "panel-with-text",
    label: "Panel With Text",
    description: "Show the textured portal wall with the label placard.",
  },
] as const;

export type PortalPanelModeId = (typeof portalPanelModeDefinitions)[number]["id"];

const portalPanelModeIds = new Set<PortalPanelModeId>(portalPanelModeDefinitions.map((mode) => mode.id));

export function parsePortalPanelMode(rawValue: string | null): PortalPanelModeId | undefined {
  if (!rawValue) {
    return undefined;
  }

  return portalPanelModeIds.has(rawValue as PortalPanelModeId) ? (rawValue as PortalPanelModeId) : undefined;
}

export function shouldRenderPortalWall(mode: PortalPanelModeId): boolean {
  return mode === "panel" || mode === "panel-with-text";
}

export function shouldRenderPortalPlacard(mode: PortalPanelModeId): boolean {
  return mode === "panel-with-text";
}

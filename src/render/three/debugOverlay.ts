import type { PortalInstanceRenderState, VisiblePortalPathRenderState } from "./renderState";

export interface DebugOverlayState {
  readonly visible: boolean;
  readonly visiblePortalPaths?: VisiblePortalPathRenderState;
  readonly portalInstances?: PortalInstanceRenderState;
  readonly inspectedPathLine?: string;
}

export interface DebugOverlay {
  update(state: DebugOverlayState): void;
  dispose(): void;
}

export function createDebugOverlay(container: HTMLElement): DebugOverlay {
  const root = document.createElement("div");
  root.className = "debug-overlay";
  root.hidden = true;
  container.append(root);

  return {
    update(state) {
      const hasContent = Boolean(state.visiblePortalPaths || state.portalInstances || state.inspectedPathLine);
      root.hidden = !state.visible || !hasContent;

      if (!hasContent) {
        root.textContent = "";
        return;
      }

      root.textContent = [
        state.visiblePortalPaths ? formatVisiblePortalPathLine(state.visiblePortalPaths) : undefined,
        state.portalInstances ? formatPortalInstanceLine(state.portalInstances) : undefined,
        state.portalInstances ? formatPortalArchetypeLine(state.portalInstances) : undefined,
        state.inspectedPathLine,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");
    },
    dispose() {
      root.remove();
    },
  };
}

export function formatVisiblePortalPathLine(state: VisiblePortalPathRenderState): string {
  const budget = state.budgetExhausted ? " / budget" : "";

  return `visible paths: ${state.visiblePathCount} / kept ${state.keptPathCount} / depth ${state.maxVisibleDepth}${budget}`;
}

export function formatPortalInstanceLine(state: PortalInstanceRenderState): string {
  return `portal instances: ${state.renderedInstanceCount} / ${state.totalCapacity} slots`;
}

export function formatPortalArchetypeLine(state: PortalInstanceRenderState): string {
  const clipOverflow = state.clipPolygonOverflowPathIds.length + state.visiblePathOverflowCount;
  return `archetypes: ${state.archetypeCount} / overflow ${state.capacityOverflowCount} / clip ${clipOverflow}`;
}

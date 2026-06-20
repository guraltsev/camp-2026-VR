import type {
  FramePerformanceRenderState,
  PortalEyeRenderDebugState,
  PortalInstanceRenderState,
  VisiblePortalPathRenderState,
  WebGlRenderInfoState,
  XrDebugRenderState,
} from "./renderState";
import type { LiveGeometryDebugState } from "../../runtime/worldGeometrySession";

export interface DebugOverlayState {
  readonly visible: boolean;
  readonly frameRateFps?: number;
  readonly framePerformance?: FramePerformanceRenderState;
  readonly webGlRenderInfo?: WebGlRenderInfoState;
  readonly visiblePortalPaths?: VisiblePortalPathRenderState;
  readonly portalEyes?: readonly PortalEyeRenderDebugState[];
  readonly portalInstances?: PortalInstanceRenderState;
  readonly location?: XrDebugRenderState;
  readonly geometry?: LiveGeometryDebugState;
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
      const hasContent = Boolean(
        state.frameRateFps !== undefined
        || state.framePerformance
        || state.webGlRenderInfo
        || state.visiblePortalPaths
        || state.portalEyes
        || state.portalInstances
        || state.location
        || state.geometry
        || state.inspectedPathLine,
      );
      root.hidden = !state.visible || !hasContent;

      if (!hasContent) {
        root.textContent = "";
        return;
      }

      root.textContent = [
        state.frameRateFps !== undefined ? formatFrameRateLine(state.frameRateFps) : undefined,
        state.framePerformance ? formatFramePerformanceLine(state.framePerformance) : undefined,
        state.webGlRenderInfo ? formatWebGlRenderInfoLine(state.webGlRenderInfo) : undefined,
        state.visiblePortalPaths ? formatVisiblePortalPathLine(state.visiblePortalPaths) : undefined,
        state.portalEyes && state.portalEyes.length > 1 ? formatPortalEyeLine(state.portalEyes) : undefined,
        state.portalInstances ? formatPortalInstanceLine(state.portalInstances) : undefined,
        state.portalInstances ? formatPortalArchetypeLine(state.portalInstances) : undefined,
        state.location ? formatLocationLine(state.location) : undefined,
        state.geometry ? formatGeometryLine(state.geometry) : undefined,
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

export function formatFrameRateLine(frameRateFps: number): string {
  return `fps: ${roundNumber(frameRateFps)} (${roundNumber(1000 / frameRateFps)} ms)`;
}

export function formatFramePerformanceLine(state: FramePerformanceRenderState): string {
  return [
    `frame ms: total ${roundNumber(state.totalMs)}`,
    `move ${roundNumber(state.moveMs)}`,
    `objects ${roundNumber(state.objectsMs)}`,
    `portal ${roundNumber(state.portalMs)}`,
    `render ${roundNumber(state.renderMs)}`,
    `ui ${roundNumber(state.uiMs)}`,
  ].join(" / ");
}

export function formatWebGlRenderInfoLine(state: WebGlRenderInfoState): string {
  const megaPixels = (state.viewportPixels.width * state.viewportPixels.height) / 1_000_000;

  return [
    `webgl: ${state.drawCalls} calls`,
    `${formatCount(state.triangles)} tris`,
    `${state.viewportPixels.width}x${state.viewportPixels.height}`,
    `${roundNumber(megaPixels)} MP`,
    `pxr ${roundNumber(state.pixelRatio)}`,
  ].join(" / ");
}

export function formatVisiblePortalPathLine(state: VisiblePortalPathRenderState): string {
  const budget = state.budgetExhausted ? " / budget" : "";

  return `visible paths: ${state.visiblePathCount} / kept ${state.keptPathCount} / depth ${state.maxVisibleDepth}${budget}`;
}

export function formatPortalEyeLine(states: readonly PortalEyeRenderDebugState[]): string {
  const counts = states
    .map((state) => `${state.eyeIndex}:${state.visiblePathCount}@${state.maxVisibleDepth}`)
    .join(" / ");

  return `portal eyes: ${counts}`;
}

export function formatPortalInstanceLine(state: PortalInstanceRenderState): string {
  return `portal instances: ${state.renderedInstanceCount} / ${state.totalCapacity} slots`;
}

export function formatPortalArchetypeLine(state: PortalInstanceRenderState): string {
  const clipOverflow = state.clipPolygonOverflowPathIds.length + state.visiblePathOverflowCount;
  return `archetypes: ${state.archetypeCount} / overflow ${state.capacityOverflowCount} / clip ${clipOverflow}`;
}

export function formatLocationLine(state: XrDebugRenderState): string {
  const blocked = state.lastMovementBlocked
    ? `blocked ${state.lastBlockingReason ?? "unknown"}`
    : "not blocked";
  const portal = state.lastCrossedPortalId ? ` / last portal ${state.lastCrossedPortalId}` : "";
  const root = state.sharedRenderRootCellId ? ` / xr root ${state.sharedRenderRootCellId}` : "";
  const inputMode = state.inputMode ? ` / input ${state.inputMode}` : "";
  const visiblePaths = state.visiblePortalPathCount !== undefined ? ` / visible ${state.visiblePortalPathCount}` : "";

  return [
    `location: cell ${state.currentCellId}`,
    `pos ${formatVec3(state.playerPosition)}`,
    `yaw ${roundNumber(state.yawRadians)}`,
    `xr ${state.sessionStatus}`,
    blocked,
  ].join(" / ") + inputMode + visiblePaths + portal + root;
}

export function formatGeometryLine(state: LiveGeometryDebugState): string {
  const target = state.target.kind === "torus-skew"
    ? `target skew ${roundNumber(state.target.skewXMeters)}`
    : `target ${state.target.kind}`;
  const current = state.current.kind === "torus-skew"
    ? `skew ${roundNumber(state.current.skewXMeters)}`
    : state.current.kind;
  const pending = state.buildInFlight ? "building" : "idle";
  const timing = state.lastBuildMs === undefined ? "" : ` / build ${roundNumber(state.lastBuildMs)} ms`;
  const error = state.lastError ? ` / error ${state.lastError}` : "";

  return `geometry: v${state.version} / ${state.deformationKind} / ${current} / ${target} / ${pending}${timing}${error}`;
}

function formatVec3(point: { readonly x: number; readonly y: number; readonly z: number }): string {
  return `(${roundNumber(point.x)}, ${roundNumber(point.y)}, ${roundNumber(point.z)})`;
}

function roundNumber(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${roundNumber(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${roundNumber(value / 1_000)}k`;
  }

  return String(value);
}

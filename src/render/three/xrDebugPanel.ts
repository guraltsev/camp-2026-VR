import * as THREE from "three";
import type { RuntimeDebugOverlayItemId } from "../../runtime/runtimeMenuState";
import type {
  FramePerformanceRenderState,
  PortalEyeRenderDebugState,
  PortalInstanceRenderState,
  VisiblePortalPathRenderState,
  WebGlRenderInfoState,
  XrDebugRenderState,
} from "./renderState";

export interface XrDebugPanel {
  readonly root: THREE.Sprite;
  update(state: XrDebugRenderState, visible: boolean, items?: readonly RuntimeDebugOverlayItemId[]): void;
  dispose(): void;
}

const defaultXrDebugPanelItems = ["fps", "location", "portal-quantities"] as const satisfies readonly RuntimeDebugOverlayItemId[];

export function createXrDebugPanel(): XrDebugPanel {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const root = new THREE.Sprite(material);
  root.name = "xr-debug-panel";
  root.scale.set(0.68, 0.34, 1);
  root.renderOrder = 999;
  root.visible = false;

  function draw(state: XrDebugRenderState, items: readonly RuntimeDebugOverlayItemId[]): void {
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(15, 23, 42, 0.88)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(148, 163, 184, 0.65)";
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

    context.fillStyle = "#f8fafc";
    context.font = "700 28px sans-serif";
    context.fillText("XR Debug", 24, 40);
    context.font = "20px sans-serif";
    const lines = buildXrDebugPanelLines(state, items);
    lines.forEach((line, index) => {
      context.fillText(line, 24, 82 + index * 29);
    });
    texture.needsUpdate = true;
  }

  return {
    root,
    update(state, visible, items = defaultXrDebugPanelItems) {
      root.visible = visible;
      if (!visible) {
        return;
      }
      draw(state, items);
    },
    dispose() {
      root.removeFromParent();
      texture.dispose();
      material.dispose();
    },
  };
}

export function buildXrDebugPanelLines(
  state: XrDebugRenderState,
  items: readonly RuntimeDebugOverlayItemId[] = defaultXrDebugPanelItems,
): readonly string[] {
  const requestedItems = new Set(items);
  const lines: string[] = [];

  if (requestedItems.has("fps")) {
    lines.push(`FPS: ${state.frameRateFps === undefined ? "n/a" : formatFps(state.frameRateFps)}`);

    if (state.framePerformance) {
      lines.push(formatFramePerformanceLine(state.framePerformance));
    }

    if (state.webGlRenderInfo) {
      lines.push(formatWebGlRenderInfoLine(state.webGlRenderInfo));
    }
  }

  if (requestedItems.has("location")) {
    lines.push(
      `Cell: ${state.currentCellId}`,
      ...(state.baseCellId ? [`Base: ${state.baseCellId}`] : []),
      ...(state.orientationSheet ? [`Sheet: ${state.orientationSheet}`] : []),
      `XR: ${state.sessionStatus}`,
      `Input: ${state.inputMode ?? state.activeInputSource}`,
      `Blocked: ${state.lastMovementBlocked ? state.lastBlockingReason ?? "yes" : "no"}`,
    );
  }

  if (requestedItems.has("portal-quantities")) {
    lines.push(formatVisiblePortalPathLine(state.visiblePortalPaths, state.visiblePortalPathCount));

    if (state.portalEyes && state.portalEyes.length > 1) {
      lines.push(formatPortalEyeLine(state.portalEyes));
    }

    if (state.portalInstances) {
      lines.push(formatPortalInstanceLine(state.portalInstances));
    }
  }

  return lines;
}

function formatFps(value: number): string {
  return `${roundNumber(value)} (${roundNumber(1000 / value)} ms)`;
}

function formatFramePerformanceLine(state: FramePerformanceRenderState): string {
  return [
    `CPU ms: ${roundNumber(state.totalMs)}`,
    `portal ${roundNumber(state.portalMs)}`,
    `draw ${roundNumber(state.renderMs)}`,
    `move ${roundNumber(state.moveMs)}`,
  ].join(" / ");
}

function formatWebGlRenderInfoLine(state: WebGlRenderInfoState): string {
  return [
    `GL: ${state.drawCalls} calls`,
    `${formatCount(state.triangles)} tris`,
    `${state.viewportPixels.width}x${state.viewportPixels.height}`,
  ].join(" / ");
}

function formatVisiblePortalPathLine(
  state: VisiblePortalPathRenderState | undefined,
  fallbackVisiblePathCount: number | undefined,
): string {
  if (!state) {
    return `Paths: ${fallbackVisiblePathCount ?? "n/a"}`;
  }

  const budget = state.budgetExhausted ? " budget" : "";
  return `Paths: ${state.visiblePathCount} / kept ${state.keptPathCount} / depth ${state.maxVisibleDepth}${budget}`;
}

function formatPortalEyeLine(states: readonly PortalEyeRenderDebugState[]): string {
  const counts = states
    .map((state) => `${state.eyeIndex}:${state.visiblePathCount}@${state.maxVisibleDepth}`)
    .join(" ");

  return `Eyes: ${counts}`;
}

function formatPortalInstanceLine(state: PortalInstanceRenderState): string {
  const clipOverflow = state.clipPolygonOverflowPathIds.length + state.visiblePathOverflowCount;
  const overflow = state.capacityOverflowCount > 0 || clipOverflow > 0
    ? ` / overflow ${state.capacityOverflowCount}+${clipOverflow}`
    : "";

  return `Instances: ${state.renderedInstanceCount} / ${state.totalCapacity}${overflow}`;
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

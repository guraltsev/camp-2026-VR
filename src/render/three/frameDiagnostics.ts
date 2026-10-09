/** Frame-rate smoothing, WebGL render-info capture, and initial XR debug state. */
import * as THREE from "three";
import { type PlayerPose } from "../../movement/playerPose";
import { getPortalViewportPixels } from "./renderQuality";
import {
  type FramePerformanceRenderState,
  type WebGlRenderInfoState,
  type XrDebugRenderState,
} from "./renderState";
import { type XrSessionState } from "./xrSessionState";

export function smoothFramePerformance(
  previous: FramePerformanceRenderState | undefined,
  next: FramePerformanceRenderState,
): FramePerformanceRenderState {
  if (!previous) {
    return next;
  }

  return {
    totalMs: smoothNumber(previous.totalMs, next.totalMs),
    inputMs: smoothNumber(previous.inputMs, next.inputMs),
    moveMs: smoothNumber(previous.moveMs, next.moveMs),
    objectsMs: smoothNumber(previous.objectsMs, next.objectsMs),
    cameraMs: smoothNumber(previous.cameraMs, next.cameraMs),
    portalMs: smoothNumber(previous.portalMs, next.portalMs),
    uiMs: smoothNumber(previous.uiMs, next.uiMs),
    renderMs: smoothNumber(previous.renderMs, next.renderMs),
  };
}

export function captureWebGlRenderInfo(renderer: THREE.WebGLRenderer): WebGlRenderInfoState {
  const viewportPixels = getPortalViewportPixels(renderer);

  return {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    lines: renderer.info.render.lines,
    points: renderer.info.render.points,
    viewportPixels,
    pixelRatio: renderer.getPixelRatio(),
  };
}

export function smoothNumber(previous: number, next: number): number {
  return THREE.MathUtils.lerp(previous, next, 0.15);
}

export function createInitialXrDebugState(xrSessionState: XrSessionState, playerPose: PlayerPose): XrDebugRenderState {
  return {
    secureContext: xrSessionState.secureContext,
    sessionStatus: xrSessionState.status,
    activeInputSource: "desktop",
    currentCellId: playerPose.cellId,
    playerPosition: playerPose.position,
    yawRadians: playerPose.yawRadians,
    lastMovementBlocked: false,
    sharedRenderRootCellId: undefined,
  };
}

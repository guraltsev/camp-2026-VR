import * as THREE from "three";

export const renderAntialiasRequested = true;
export const portalClipEdgeSmoothingEnabled = false;
export const defaultMaxDevicePixelRatio = 1.25;

export interface ViewportPixels {
  readonly width: number;
  readonly height: number;
}

export interface RenderQualityState {
  readonly enabled: boolean;
  readonly antialiasRequested: boolean;
  readonly portalClipEdgeSmoothing: boolean;
  readonly pixelRatio: number;
  readonly maxDevicePixelRatio: number;
  readonly cssCanvasSize: ViewportPixels;
  readonly drawingBufferSize: ViewportPixels;
  readonly portalViewportPixels: ViewportPixels;
}

export function resolveRenderPixelRatio(
  devicePixelRatio: number | undefined,
  maxDevicePixelRatio = defaultMaxDevicePixelRatio,
): number {
  const fallbackPixelRatio = 1;
  const resolvedDevicePixelRatio =
    devicePixelRatio === undefined || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0
      ? fallbackPixelRatio
      : devicePixelRatio;
  const resolvedMaxDevicePixelRatio =
    Number.isFinite(maxDevicePixelRatio) && maxDevicePixelRatio > 0
      ? maxDevicePixelRatio
      : defaultMaxDevicePixelRatio;

  return Math.min(resolvedDevicePixelRatio, resolvedMaxDevicePixelRatio);
}

export function resolveRenderQualityPixelRatio(enabled: boolean, devicePixelRatio: number | undefined): number {
  return enabled ? resolveRenderPixelRatio(devicePixelRatio) : 1;
}

export function getWindowCssCanvasSize(windowLike: Pick<Window, "innerWidth" | "innerHeight">): ViewportPixels {
  return {
    width: Math.max(1, windowLike.innerWidth),
    height: Math.max(1, windowLike.innerHeight),
  };
}

export function getRendererCssCanvasSize(renderer: THREE.WebGLRenderer): ViewportPixels {
  const size = renderer.getSize(new THREE.Vector2());

  return vectorToViewportPixels(size);
}

export function getRendererDrawingBufferPixels(renderer: THREE.WebGLRenderer): ViewportPixels {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());

  return vectorToViewportPixels(size);
}

export function getPortalViewportPixels(renderer: THREE.WebGLRenderer): ViewportPixels {
  return getRendererDrawingBufferPixels(renderer);
}

export function createRenderQualityState(
  renderer: THREE.WebGLRenderer,
  pixelRatio: number,
  enabled = true,
  maxDevicePixelRatio = defaultMaxDevicePixelRatio,
): RenderQualityState {
  const cssCanvasSize = getRendererCssCanvasSize(renderer);
  const drawingBufferSize = getRendererDrawingBufferPixels(renderer);

  return {
    enabled,
    antialiasRequested: renderAntialiasRequested,
    portalClipEdgeSmoothing: enabled && portalClipEdgeSmoothingEnabled,
    pixelRatio,
    maxDevicePixelRatio,
    cssCanvasSize,
    drawingBufferSize,
    portalViewportPixels: drawingBufferSize,
  };
}

function vectorToViewportPixels(size: THREE.Vector2): ViewportPixels {
  return {
    width: size.x,
    height: size.y,
  };
}

import * as THREE from "three";
import type { XrDebugRenderState } from "./renderState";

export interface XrDebugPanel {
  readonly root: THREE.Sprite;
  update(state: XrDebugRenderState, visible: boolean): void;
  dispose(): void;
}

export function createXrDebugPanel(): XrDebugPanel {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 256;
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
  root.scale.set(0.64, 0.22, 1);
  root.renderOrder = 999;
  root.visible = false;

  function draw(state: XrDebugRenderState): void {
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
    context.font = "22px sans-serif";
    const lines = [
      `Cell: ${state.currentCellId}`,
      `XR: ${state.sessionStatus}`,
      `Input: ${state.inputMode ?? state.activeInputSource}`,
      `Blocked: ${state.lastMovementBlocked ? state.lastBlockingReason ?? "yes" : "no"}`,
      `Visible paths: ${state.visiblePortalPathCount ?? "n/a"}`,
    ];
    lines.forEach((line, index) => {
      context.fillText(line, 24, 86 + index * 32);
    });
    texture.needsUpdate = true;
  }

  return {
    root,
    update(state, visible) {
      root.visible = visible;
      if (!visible) {
        return;
      }
      draw(state);
    },
    dispose() {
      root.removeFromParent();
      texture.dispose();
      material.dispose();
    },
  };
}

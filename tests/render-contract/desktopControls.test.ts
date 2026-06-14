import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopControls } from "../../src/render/three/desktopControls";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktopControls", () => {
  it("does not convert right-click release into a palette select", () => {
    const { canvas, windowTarget } = installPointerLockDom();
    const controls = createDesktopControls(canvas);
    controls.setLookMode("palette");

    dispatchMouse(windowTarget, "mousedown", 2);
    dispatchMouse(canvas, "click", 2);
    dispatchMouse(windowTarget, "mouseup", 2);

    const frame = controls.consumeFrame(1 / 60);

    expect(frame.paletteSelectPressed).toBe(false);
    expect(frame.paletteSelectRequested).toBe(false);
    expect(frame.primaryActionRequested).toBe(false);

    controls.dispose();
  });

  it("maps left-click to palette select while in palette look mode", () => {
    const { canvas, windowTarget } = installPointerLockDom();
    const controls = createDesktopControls(canvas);
    controls.setLookMode("palette");

    dispatchMouse(windowTarget, "mousedown", 0);
    dispatchMouse(canvas, "click", 0);

    const frame = controls.consumeFrame(1 / 60);

    expect(frame.paletteSelectPressed).toBe(true);
    expect(frame.paletteSelectRequested).toBe(true);
    expect(frame.primaryActionRequested).toBe(false);

    controls.dispose();
  });
});

function installPointerLockDom(): {
  readonly canvas: HTMLCanvasElement;
  readonly windowTarget: EventTarget;
} {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget() as EventTarget & {
    pointerLockElement: Element | null;
    exitPointerLock: () => void;
  };
  const canvas = new EventTarget() as HTMLCanvasElement & {
    requestPointerLock: () => Promise<void>;
  };

  documentTarget.pointerLockElement = canvas;
  documentTarget.exitPointerLock = () => {
    documentTarget.pointerLockElement = null;
  };
  canvas.requestPointerLock = async () => {
    documentTarget.pointerLockElement = canvas;
  };

  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", documentTarget);

  return { canvas, windowTarget };
}

function dispatchMouse(target: EventTarget, type: string, button: number): void {
  const event = new Event(type, { cancelable: true }) as Event & {
    button: number;
    movementX: number;
    movementY: number;
  };
  event.button = button;
  event.movementX = 0;
  event.movementY = 0;
  target.dispatchEvent(event);
}

import { vec3, type Vec3 } from "../../math/vec3";

export interface DesktopInputFrame {
  readonly localDisplacement: Vec3;
  readonly yawDeltaRadians: number;
  readonly pitchDeltaRadians: number;
  readonly palettePointerDeltaPixels: { readonly x: number; readonly y: number };
  readonly paletteSelectPressed: boolean;
  readonly paletteSelectRequested: boolean;
  readonly resetRequested: boolean;
  readonly primaryActionRequested: boolean;
  readonly interactRequested: boolean;
}

export type DesktopLookMode = "camera" | "palette";

export interface DesktopControls {
  readonly enabled: boolean;
  setLookMode(mode: DesktopLookMode): void;
  consumeFrame(deltaSeconds: number): DesktopInputFrame;
  pause(): void;
  resume(options?: { readonly requestPointerLock?: boolean }): Promise<boolean>;
  requestPointerLock(): Promise<boolean>;
  isPointerLocked(): boolean;
  dispose(): void;
}

export interface DesktopControlsOptions {
  readonly moveSpeedMetersPerSecond?: number;
  readonly turnSpeedRadiansPerSecond?: number;
  readonly mouseSensitivityRadiansPerPixel?: number;
}

const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
const turnKeys = new Set(["KeyQ", "KeyE"]);

export function createDesktopControls(
  canvas: HTMLCanvasElement,
  options: DesktopControlsOptions = {},
): DesktopControls {
  const pressedKeys = new Set<string>();
  const moveSpeed = options.moveSpeedMetersPerSecond ?? 2.5;
  const turnSpeed = options.turnSpeedRadiansPerSecond ?? 2.25;
  const mouseSensitivity = options.mouseSensitivityRadiansPerPixel ?? 0.0025;
  let paused = false;
  let pendingMouseYawDeltaRadians = 0;
  let pendingMousePitchDeltaRadians = 0;
  let pendingPalettePointerDeltaX = 0;
  let pendingPalettePointerDeltaY = 0;
  let resetRequested = false;
  let primaryActionRequested = false;
  let paletteSelectPressed = false;
  let paletteSelectRequested = false;
  let suppressNextPrimaryClick = false;
  let interactRequested = false;
  let lookMode: DesktopLookMode = "camera";

  function onKeyDown(event: KeyboardEvent): void {
    if (paused) {
      return;
    }

    if (movementKeys.has(event.code) || turnKeys.has(event.code) || event.code === "KeyR" || event.code === "KeyF") {
      event.preventDefault();
    }

    if (event.code === "KeyR") {
      resetRequested = true;
      return;
    }

    if (event.code === "KeyF") {
      interactRequested = true;
      return;
    }

    pressedKeys.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent): void {
    pressedKeys.delete(event.code);
  }

  function onClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    if (document.pointerLockElement === canvas) {
      if (lookMode === "palette") {
        event.preventDefault();
        paletteSelectRequested = true;
        suppressNextPrimaryClick = true;
      } else {
        if (suppressNextPrimaryClick) {
          event.preventDefault();
          suppressNextPrimaryClick = false;
          return;
        }
        primaryActionRequested = true;
      }
      return;
    }

    void requestPointerLock();
  }

  function onMouseDown(event: MouseEvent): void {
    if (document.pointerLockElement === canvas && lookMode === "palette" && event.button === 0) {
      event.preventDefault();
      paletteSelectPressed = true;
      suppressNextPrimaryClick = true;
    }
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      paletteSelectPressed = false;
    }
  }

  function onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === canvas) {
      if (lookMode === "palette") {
        pendingPalettePointerDeltaX += event.movementX;
        pendingPalettePointerDeltaY += event.movementY;
      } else {
        pendingMouseYawDeltaRadians -= event.movementX * mouseSensitivity;
        pendingMousePitchDeltaRadians -= event.movementY * mouseSensitivity;
      }
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", onClick);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousemove", onMouseMove);

  function clearPendingInput(): void {
    pressedKeys.clear();
    pendingMouseYawDeltaRadians = 0;
    pendingMousePitchDeltaRadians = 0;
    pendingPalettePointerDeltaX = 0;
    pendingPalettePointerDeltaY = 0;
    resetRequested = false;
    primaryActionRequested = false;
    paletteSelectPressed = false;
    paletteSelectRequested = false;
    suppressNextPrimaryClick = false;
    interactRequested = false;
  }

  async function requestPointerLock(): Promise<boolean> {
    if (paused) {
      return false;
    }

    try {
      await canvas.requestPointerLock();
      return document.pointerLockElement === canvas;
    } catch (error: unknown) {
      console.warn("Unable to capture FPS pointer lock.", error);
      return false;
    }
  }

  return {
    get enabled() {
      return !paused;
    },
    setLookMode(mode) {
      if (lookMode === mode) {
        return;
      }

      lookMode = mode;
      pendingMouseYawDeltaRadians = 0;
      pendingMousePitchDeltaRadians = 0;
      pendingPalettePointerDeltaX = 0;
      pendingPalettePointerDeltaY = 0;
      primaryActionRequested = false;
      paletteSelectRequested = false;
      paletteSelectPressed = false;
    },
    consumeFrame(deltaSeconds: number): DesktopInputFrame {
      if (paused) {
        clearPendingInput();
        return {
          localDisplacement: vec3(0, 0, 0),
          yawDeltaRadians: 0,
          pitchDeltaRadians: 0,
          palettePointerDeltaPixels: { x: 0, y: 0 },
          paletteSelectPressed: false,
          paletteSelectRequested: false,
          resetRequested: false,
          primaryActionRequested: false,
          interactRequested: false,
        };
      }

      let yawDeltaRadians = lookMode === "camera" ? pendingMouseYawDeltaRadians : 0;
      const pitchDeltaRadians = lookMode === "camera" ? pendingMousePitchDeltaRadians : 0;
      if (lookMode === "camera") {
        yawDeltaRadians += (pressedKeys.has("KeyQ") ? 1 : 0) * turnSpeed * deltaSeconds;
        yawDeltaRadians -= (pressedKeys.has("KeyE") ? 1 : 0) * turnSpeed * deltaSeconds;
      }

      const movementEnabled = lookMode === "camera";
      const forwardInput = movementEnabled ? (
        (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0) -
        (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0)
      ) : 0;
      const rightInput = movementEnabled ? (
        (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0) -
        (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0)
      ) : 0;
      const inputLength = Math.hypot(forwardInput, rightInput) || 1;
      const stepMeters = moveSpeed * deltaSeconds;
      const frameResetRequested = resetRequested;
      const framePrimaryActionRequested = lookMode === "camera" ? primaryActionRequested : false;
      const framePalettePointerDeltaPixels = {
        x: pendingPalettePointerDeltaX,
        y: pendingPalettePointerDeltaY,
      };
      const framePaletteSelectPressed = lookMode === "palette" && paletteSelectPressed;
      const framePaletteSelectRequested = lookMode === "palette" && paletteSelectRequested;
      const frameInteractRequested = interactRequested;

      pendingMouseYawDeltaRadians = 0;
      pendingMousePitchDeltaRadians = 0;
      pendingPalettePointerDeltaX = 0;
      pendingPalettePointerDeltaY = 0;
      resetRequested = false;
      primaryActionRequested = false;
      paletteSelectRequested = false;
      interactRequested = false;

      return {
        localDisplacement: vec3((rightInput / inputLength) * stepMeters, (forwardInput / inputLength) * stepMeters, 0),
        yawDeltaRadians,
        pitchDeltaRadians,
        palettePointerDeltaPixels: framePalettePointerDeltaPixels,
        paletteSelectPressed: framePaletteSelectPressed || framePaletteSelectRequested,
        paletteSelectRequested: framePaletteSelectRequested,
        resetRequested: frameResetRequested,
        primaryActionRequested: framePrimaryActionRequested,
        interactRequested: frameInteractRequested,
      };
    },
    pause(): void {
      paused = true;
      clearPendingInput();
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    },
    async resume(resumeOptions = {}): Promise<boolean> {
      paused = false;
      clearPendingInput();
      if (resumeOptions.requestPointerLock) {
        return requestPointerLock();
      }
      return document.pointerLockElement === canvas;
    },
    requestPointerLock,
    isPointerLocked(): boolean {
      return document.pointerLockElement === canvas;
    },
    dispose(): void {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
    },
  };
}

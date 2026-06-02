import { vec3, type Vec3 } from "../../math/vec3";

export interface DesktopInputFrame {
  readonly localDisplacement: Vec3;
  readonly yawDeltaRadians: number;
  readonly pitchDeltaRadians: number;
  readonly resetRequested: boolean;
}

export interface DesktopControls {
  readonly enabled: boolean;
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
  let resetRequested = false;

  function onKeyDown(event: KeyboardEvent): void {
    if (paused) {
      return;
    }

    if (movementKeys.has(event.code) || turnKeys.has(event.code) || event.code === "KeyR") {
      event.preventDefault();
    }

    if (event.code === "KeyR") {
      resetRequested = true;
      return;
    }

    pressedKeys.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent): void {
    pressedKeys.delete(event.code);
  }

  function onClick(): void {
    void requestPointerLock();
  }

  function onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === canvas) {
      pendingMouseYawDeltaRadians -= event.movementX * mouseSensitivity;
      pendingMousePitchDeltaRadians -= event.movementY * mouseSensitivity;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", onClick);
  document.addEventListener("mousemove", onMouseMove);

  function clearPendingInput(): void {
    pressedKeys.clear();
    pendingMouseYawDeltaRadians = 0;
    pendingMousePitchDeltaRadians = 0;
    resetRequested = false;
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
    consumeFrame(deltaSeconds: number): DesktopInputFrame {
      if (paused) {
        clearPendingInput();
        return {
          localDisplacement: vec3(0, 0, 0),
          yawDeltaRadians: 0,
          pitchDeltaRadians: 0,
          resetRequested: false,
        };
      }

      let yawDeltaRadians = pendingMouseYawDeltaRadians;
      const pitchDeltaRadians = pendingMousePitchDeltaRadians;
      yawDeltaRadians += (pressedKeys.has("KeyQ") ? 1 : 0) * turnSpeed * deltaSeconds;
      yawDeltaRadians -= (pressedKeys.has("KeyE") ? 1 : 0) * turnSpeed * deltaSeconds;

      const forwardInput =
        (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0) -
        (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0);
      const rightInput =
        (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0) -
        (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0);
      const inputLength = Math.hypot(forwardInput, rightInput) || 1;
      const stepMeters = moveSpeed * deltaSeconds;
      const frameResetRequested = resetRequested;

      pendingMouseYawDeltaRadians = 0;
      pendingMousePitchDeltaRadians = 0;
      resetRequested = false;

      return {
        localDisplacement: vec3((rightInput / inputLength) * stepMeters, (forwardInput / inputLength) * stepMeters, 0),
        yawDeltaRadians,
        pitchDeltaRadians,
        resetRequested: frameResetRequested,
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
      document.removeEventListener("mousemove", onMouseMove);
    },
  };
}

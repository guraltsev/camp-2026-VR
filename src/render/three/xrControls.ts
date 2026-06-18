import { vec3 } from "../../math/vec3";
import type { RuntimeInputFrame } from "./renderState";
import { computeContinuousTurn, computeJoystickLocomotion, type StickAxes } from "./vrLocomotion";
import { defaultVrComfortOptions, type VrComfortOptions } from "./vrComfort";

export interface GamepadLike {
  readonly axes?: readonly number[];
  readonly buttons?: readonly { readonly pressed: boolean }[];
}

export interface XrInputSourceLike {
  readonly handedness?: XRHandedness | "none" | string;
  readonly targetRayMode?: XRTargetRayMode | string;
  readonly gamepad?: GamepadLike;
}

export interface XrControls {
  consumeFrame(inputSources: Iterable<XrInputSourceLike>, deltaSeconds: number): RuntimeInputFrame;
}

export function createXrControls(options: Partial<VrComfortOptions> = {}): XrControls {
  const comfort = { ...defaultVrComfortOptions, ...options };
  let previousPrimaryActionPressed = false;
  let previousInteractPressed = false;
  let previousCarryActionPressed = false;

  return {
    consumeFrame(inputSources, deltaSeconds) {
      const sources = [...inputSources];
      const frame = createXrInputFrame(sources, deltaSeconds, comfort);
      const primaryActionPressed = sources.some((source) => isPrimaryActionPressed(source.gamepad));
      const primaryActionRequested = primaryActionPressed && !previousPrimaryActionPressed;
      const interactPressed = sources.some((source) => isInteractPressed(source.gamepad));
      const interactRequested = interactPressed && !previousInteractPressed;
      const carryActionPressed = sources.some((source) => isCarryActionPressed(source));
      const carryActionRequested = carryActionPressed && !previousCarryActionPressed;
      previousPrimaryActionPressed = primaryActionPressed;
      previousInteractPressed = interactPressed;
      previousCarryActionPressed = carryActionPressed;
      return {
        ...frame,
        primaryActionRequested,
        interactRequested,
        carryActionRequested,
      };
    },
  };
}

export function createXrInputFrame(
  inputSources: Iterable<XrInputSourceLike>,
  deltaSeconds: number,
  options: Partial<VrComfortOptions> = {},
): RuntimeInputFrame {
  const comfort = { ...defaultVrComfortOptions, ...options };
  const sources = [...inputSources].filter((source) => source.gamepad);
  const left = sources.find((source) => source.handedness === "left");
  const right = sources.find((source) => source.handedness === "right");
  const movementSource = left ?? sources[0];
  const rotationSource = right && right !== movementSource ? right : sources.find((source) => source !== movementSource);
  const moveAxes = readPrimaryStickAxes(movementSource?.gamepad);
  const turnAxes = readPrimaryStickAxes(rotationSource?.gamepad);
  const locomotion = computeJoystickLocomotion(moveAxes, deltaSeconds, comfort);
  const yawDeltaRadians = computeContinuousTurn(turnAxes?.x, deltaSeconds, comfort);

  return {
    localDisplacement: locomotion.localDisplacement,
    yawDeltaRadians,
    pitchDeltaRadians: 0,
    resetRequested: sources.some((source) => isResetPressed(source.gamepad)),
    primaryActionRequested: sources.some((source) => isPrimaryActionPressed(source.gamepad)),
    interactRequested: sources.some((source) => isInteractPressed(source.gamepad)),
    carryActionRequested: sources.some((source) => isCarryActionPressed(source)),
    source: "xr",
  };
}

export function readPrimaryStickAxes(gamepad: GamepadLike | undefined): StickAxes | undefined {
  const axes = gamepad?.axes;

  if (!axes || axes.length < 2) {
    return undefined;
  }

  const pairs = [
    [2, 3],
    [0, 1],
  ] as const;

  for (const [xIndex, yIndex] of pairs) {
    const x = axes[xIndex];
    const y = axes[yIndex];

    if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > 0) {
      return { x, y };
    }
  }

  return { x: axes[0] ?? 0, y: axes[1] ?? 0 };
}

export function isResetPressed(gamepad: GamepadLike | undefined): boolean {
  const buttons = gamepad?.buttons;

  if (!buttons) {
    return false;
  }

  return buttons[3]?.pressed === true;
}

export function isPrimaryActionPressed(gamepad: GamepadLike | undefined): boolean {
  return gamepad?.buttons?.[0]?.pressed === true;
}

export function isInteractPressed(gamepad: GamepadLike | undefined): boolean {
  return gamepad?.buttons?.[4]?.pressed === true || gamepad?.buttons?.[5]?.pressed === true;
}

export function isCarryActionPressed(source: XrInputSourceLike): boolean {
  return source.handedness === "right" && source.gamepad?.buttons?.[1]?.pressed === true;
}

export function emptyXrInputFrame(): RuntimeInputFrame {
  return {
    localDisplacement: vec3(0, 0, 0),
    yawDeltaRadians: 0,
    pitchDeltaRadians: 0,
    resetRequested: false,
    primaryActionRequested: false,
    interactRequested: false,
    carryActionRequested: false,
    source: "xr",
  };
}

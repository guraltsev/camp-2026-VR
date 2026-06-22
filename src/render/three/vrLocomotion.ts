import { vec3, type Vec3 } from "../../math/vec3";
import { defaultVrComfortOptions, type VrComfortOptions } from "./vrComfort";

export interface StickAxes {
  readonly x: number;
  readonly y: number;
}

export interface VrLocomotionRequest {
  readonly localDisplacement: Vec3;
}

export function applyJoystickDeadZone(
  axes: StickAxes,
  deadZone: number = defaultVrComfortOptions.joystickDeadZone,
): StickAxes {
  const length = Math.hypot(axes.x, axes.y);

  if (length <= deadZone) {
    return { x: 0, y: 0 };
  }

  if (length <= 1) {
    return axes;
  }

  return {
    x: axes.x / length,
    y: axes.y / length,
  };
}

export function computeJoystickLocomotion(
  axes: StickAxes | undefined,
  deltaSeconds: number,
  options: Partial<VrComfortOptions> = {},
): VrLocomotionRequest {
  if (!axes) {
    return { localDisplacement: vec3(0, 0, 0) };
  }

  const comfort = { ...defaultVrComfortOptions, ...options };

  if (Math.abs(axes.y) <= comfort.joystickDeadZone) {
    return { localDisplacement: vec3(0, 0, 0) };
  }

  const scaledY = Math.max(-1, Math.min(1, axes.y));
  const stepMeters = comfort.moveSpeedMetersPerSecond * deltaSeconds;

  return {
    localDisplacement: vec3(0, -scaledY * stepMeters, 0),
  };
}

export function computeContinuousTurn(
  axisX: number | undefined,
  deltaSeconds: number,
  options: Partial<VrComfortOptions> = {},
): number {
  if (axisX === undefined || !Number.isFinite(axisX)) {
    return 0;
  }

  const comfort = { ...defaultVrComfortOptions, ...options };

  if (Math.abs(axisX) <= comfort.joystickDeadZone) {
    return 0;
  }

  return -Math.max(-1, Math.min(1, axisX)) * comfort.turnSpeedRadiansPerSecond * deltaSeconds;
}

export function computePhysicalRoomScaleDisplacement(request: {
  readonly previousHeadLocalMeters?: Vec3;
  readonly currentHeadLocalMeters?: Vec3;
  readonly maxPhysicalStepMeters?: number;
}): {
  readonly localDisplacement: Vec3;
  readonly nextAcceptedHeadLocalMeters?: Vec3;
  readonly ignoredTrackingJump: boolean;
} {
  if (!request.previousHeadLocalMeters || !request.currentHeadLocalMeters) {
    return {
      localDisplacement: vec3(0, 0, 0),
      nextAcceptedHeadLocalMeters: request.currentHeadLocalMeters,
      ignoredTrackingJump: false,
    };
  }

  const delta = vec3(
    request.currentHeadLocalMeters.x - request.previousHeadLocalMeters.x,
    request.currentHeadLocalMeters.y - request.previousHeadLocalMeters.y,
    0,
  );
  const maxStep = request.maxPhysicalStepMeters ?? defaultVrComfortOptions.maxPhysicalStepMeters;

  if (Math.hypot(delta.x, delta.y) > maxStep) {
    return {
      localDisplacement: vec3(0, 0, 0),
      nextAcceptedHeadLocalMeters: request.previousHeadLocalMeters,
      ignoredTrackingJump: true,
    };
  }

  return {
    localDisplacement: delta,
    nextAcceptedHeadLocalMeters: request.currentHeadLocalMeters,
    ignoredTrackingJump: false,
  };
}

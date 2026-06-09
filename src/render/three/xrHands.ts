import * as THREE from "three";

export interface XrJointPoseLike {
  readonly transform: {
    readonly position: DOMPointReadOnly;
    readonly orientation: DOMPointReadOnly;
  };
}

export interface XrFrameLike {
  getJointPose?(joint: unknown, referenceSpace: XRReferenceSpace): XrJointPoseLike | undefined;
}

export interface XrHandLike {
  get(jointName: string): unknown;
}

export interface XrHandInputSourceLike {
  readonly handedness?: XRHandedness | "left" | "right" | "none" | string;
  readonly hand?: XrHandLike | null;
}

export interface XrHandJoints {
  readonly handedness: "left" | "right";
  readonly wrist: THREE.Vector3;
  readonly wristQuaternion: THREE.Quaternion;
  readonly indexTip: THREE.Vector3;
  readonly thumbTip: THREE.Vector3;
  readonly pinchDistanceMeters: number;
  readonly pinchDirection: THREE.Vector3;
}

export interface XrPinchState {
  readonly pressed: boolean;
  readonly justStarted: boolean;
  readonly justEnded: boolean;
}

export interface CreateXrHandsOptions {
  readonly pinchStartDistanceMeters?: number;
  readonly pinchEndDistanceMeters?: number;
}

export interface XrTrackedHandState extends XrHandJoints, XrPinchState {}

export interface XrHands {
  update(
    inputSources: Iterable<XrHandInputSourceLike>,
    frame: XrFrameLike,
    referenceSpace: XRReferenceSpace,
  ): readonly XrTrackedHandState[];
}

const defaultPinchStartDistanceMeters = 0.018;
const defaultPinchEndDistanceMeters = 0.028;
const zeroQuaternion = new THREE.Quaternion();

export function createXrHands(options: CreateXrHandsOptions = {}): XrHands {
  const pinchStateByHandedness = new Map<"left" | "right", boolean>();
  const pinchStartDistanceMeters = options.pinchStartDistanceMeters ?? defaultPinchStartDistanceMeters;
  const pinchEndDistanceMeters = options.pinchEndDistanceMeters ?? defaultPinchEndDistanceMeters;

  return {
    update(inputSources, frame, referenceSpace) {
      const states: XrTrackedHandState[] = [];

      for (const source of inputSources) {
        const handedness = normalizeHandedness(source.handedness);
        if (!handedness || !source.hand) {
          continue;
        }

        const joints = readXrHandJoints(handedness, source.hand, frame, referenceSpace);
        if (!joints) {
          continue;
        }

        const previousPressed = pinchStateByHandedness.get(handedness) ?? false;
        const pinchState = computePinchState(
          joints.pinchDistanceMeters,
          previousPressed,
          pinchStartDistanceMeters,
          pinchEndDistanceMeters,
        );
        pinchStateByHandedness.set(handedness, pinchState.pressed);
        states.push({ ...joints, ...pinchState });
      }

      return states;
    },
  };
}

export function computePinchState(
  pinchDistanceMeters: number,
  previousPressed: boolean,
  pinchStartDistanceMeters = defaultPinchStartDistanceMeters,
  pinchEndDistanceMeters = defaultPinchEndDistanceMeters,
): XrPinchState {
  const pressed = previousPressed
    ? pinchDistanceMeters <= pinchEndDistanceMeters
    : pinchDistanceMeters <= pinchStartDistanceMeters;

  return {
    pressed,
    justStarted: !previousPressed && pressed,
    justEnded: previousPressed && !pressed,
  };
}

export function readXrHandJoints(
  handedness: "left" | "right",
  hand: XrHandLike,
  frame: XrFrameLike,
  referenceSpace: XRReferenceSpace,
): XrHandJoints | undefined {
  const wristPose = readJointPose(hand.get("wrist"), frame, referenceSpace);
  const indexTipPose = readJointPose(hand.get("index-finger-tip"), frame, referenceSpace);
  const thumbTipPose = readJointPose(hand.get("thumb-tip"), frame, referenceSpace);

  if (!wristPose || !indexTipPose || !thumbTipPose) {
    return undefined;
  }

  const pinchDirection = indexTipPose.position.clone().sub(wristPose.position).normalize();

  return {
    handedness,
    wrist: wristPose.position,
    wristQuaternion: wristPose.quaternion,
    indexTip: indexTipPose.position,
    thumbTip: thumbTipPose.position,
    pinchDistanceMeters: indexTipPose.position.distanceTo(thumbTipPose.position),
    pinchDirection: pinchDirection.lengthSq() > 1e-6 ? pinchDirection : new THREE.Vector3(0, 0, -1),
  };
}

function readJointPose(
  joint: unknown,
  frame: XrFrameLike,
  referenceSpace: XRReferenceSpace,
): { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion } | undefined {
  if (!joint) {
    return undefined;
  }

  const pose = frame.getJointPose?.(joint, referenceSpace);
  if (!pose) {
    return undefined;
  }

  const { position, orientation } = pose.transform;
  return {
    position: new THREE.Vector3(position.x, position.y, position.z),
    quaternion: orientation
      ? new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
      : zeroQuaternion.clone(),
  };
}

function normalizeHandedness(
  handedness: XrHandInputSourceLike["handedness"],
): "left" | "right" | undefined {
  return handedness === "left" || handedness === "right" ? handedness : undefined;
}

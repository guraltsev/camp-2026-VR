import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { computePinchState, readXrHandJoints } from "../../src/render/three/xrHands";

describe("xrHands", () => {
  it("applies hysteresis to pinch transitions", () => {
    expect(computePinchState(0.015, false)).toEqual({
      pressed: true,
      justStarted: true,
      justEnded: false,
    });
    expect(computePinchState(0.024, true)).toEqual({
      pressed: true,
      justStarted: false,
      justEnded: false,
    });
    expect(computePinchState(0.04, true)).toEqual({
      pressed: false,
      justStarted: false,
      justEnded: true,
    });
  });

  it("reads wrist and fingertip data into a tracked-hand snapshot", () => {
    const jointObjects = new Map([
      ["wrist", { key: "wrist" }],
      ["index-finger-tip", { key: "index" }],
      ["thumb-tip", { key: "thumb" }],
    ]);
    const poses = new Map<unknown, ReturnType<typeof poseAt>>([
      [jointObjects.get("wrist"), poseAt(0, 1, 0)],
      [jointObjects.get("index-finger-tip"), poseAt(0.1, 1, 0)],
      [jointObjects.get("thumb-tip"), poseAt(0.08, 1, 0)],
    ]);

    const joints = readXrHandJoints(
      "left",
      {
        get(jointName: string) {
          return jointObjects.get(jointName);
        },
      },
      {
        getJointPose(joint: unknown) {
          return poses.get(joint);
        },
      },
      {} as XRReferenceSpace,
    );

    expect(joints?.handedness).toBe("left");
    expect(joints?.pinchDistanceMeters).toBeCloseTo(0.02);
    expect(joints?.pinchDirection).toEqual(new THREE.Vector3(1, 0, 0));
  });
});

function poseAt(x: number, y: number, z: number) {
  return {
    transform: {
      position: { x, y, z } as DOMPointReadOnly,
      orientation: { x: 0, y: 0, z: 0, w: 1 } as DOMPointReadOnly,
    },
  };
}

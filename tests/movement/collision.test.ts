import { describe, expect, it } from "vitest";
import { getCollisionBounds, getDynamicObjectCollisionBounds, simpleBoxIntersectsSimpleBox } from "../../src/movement/collision";
import { simpleCollisionBox, type DynamicObjectState } from "../../src/movement/dynamicObject";
import { identityMat3, yawRigidTransform3, type Mat3 } from "../../src/math/rigidTransform3";

describe("collision bounds", () => {
  it("preserves identity-rotation bounds from the position-based helper", () => {
    const collision = simpleCollisionBox(0.4, 0.6, 0.8, { x: 0.1, y: -0.2, z: 0.3 });
    const object = dynamicObject({ x: 1, y: 2, z: 3 }, identityMat3, collision);

    expect(getDynamicObjectCollisionBounds(object)).toEqual(getCollisionBounds(object.localPose.translation, collision));
  });

  it("returns undefined for objects without collision", () => {
    expect(getDynamicObjectCollisionBounds(dynamicObject({ x: 1, y: 2, z: 3 }, identityMat3, undefined))).toBeUndefined();
  });

  it("keeps zero-offset boxes centered on object translation", () => {
    const bounds = getDynamicObjectCollisionBounds(
      dynamicObject({ x: 1, y: 2, z: 3 }, yawRigidTransform3(Math.PI / 3).rotation, simpleCollisionBox(0.4, 0.6, 0.8)),
    );

    expect(bounds?.center).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("rotates explicit offsets into cell-local coordinates", () => {
    const bounds = getDynamicObjectCollisionBounds(
      dynamicObject(
        { x: 1, y: 2, z: 3 },
        yawRigidTransform3(Math.PI / 2).rotation,
        simpleCollisionBox(0.2, 0.2, 0.2, { x: 0.4, y: 0, z: 0.1 }),
      ),
    );

    expect(bounds?.center.x).toBeCloseTo(1);
    expect(bounds?.center.y).toBeCloseTo(2.4);
    expect(bounds?.center.z).toBeCloseTo(3.1);
  });

  it("swaps horizontal extents for a rectangular 90-degree yaw", () => {
    const bounds = getDynamicObjectCollisionBounds(
      dynamicObject({ x: 0, y: 0, z: 0 }, yawRigidTransform3(Math.PI / 2).rotation, simpleCollisionBox(0.8, 0.2, 0.4)),
    );

    expect(bounds?.halfX).toBeCloseTo(0.1);
    expect(bounds?.halfY).toBeCloseTo(0.4);
    expect(bounds?.halfZ).toBeCloseTo(0.2);
  });

  it("expands a 45-degree yawed rectangle to enclose the rotated local box", () => {
    const bounds = getDynamicObjectCollisionBounds(
      dynamicObject({ x: 0, y: 0, z: 0 }, yawRigidTransform3(Math.PI / 4).rotation, simpleCollisionBox(2, 1, 0.4)),
    );
    const expectedHalf = Math.SQRT1_2 * 1 + Math.SQRT1_2 * 0.5;

    expect(bounds?.halfX).toBeCloseTo(expectedHalf);
    expect(bounds?.halfY).toBeCloseTo(expectedHalf);
    expect(bounds?.halfZ).toBeCloseTo(0.2);
  });

  it("lets pitch or roll conservatively affect vertical extents", () => {
    const bounds = getDynamicObjectCollisionBounds(
      dynamicObject({ x: 0, y: 0, z: 0 }, pitchMat3(Math.PI / 2), simpleCollisionBox(0.2, 0.8, 0.2)),
    );

    expect(bounds?.halfZ).toBeCloseTo(0.4);
  });
});

describe("simpleBoxIntersectsSimpleBox", () => {
  it("uses strict overlap on all axes", () => {
    expect(simpleBoxIntersectsSimpleBox(box(0, 0, 0, 0.5), box(1.1, 0, 0, 0.5))).toBe(false);
    expect(simpleBoxIntersectsSimpleBox(box(0, 0, 0, 0.5), box(0.9, 0, 0, 0.5))).toBe(true);
    expect(simpleBoxIntersectsSimpleBox(box(0, 0, 0, 0.5), box(1, 0, 0, 0.5))).toBe(false);
  });

  it("can compare rotation-derived conservative boxes", () => {
    const a = getDynamicObjectCollisionBounds(
      dynamicObject({ x: 0, y: 0, z: 0 }, yawRigidTransform3(Math.PI / 4).rotation, simpleCollisionBox(1, 1, 1)),
    );
    const b = getDynamicObjectCollisionBounds(dynamicObject({ x: 0.9, y: 0, z: 0 }, identityMat3, simpleCollisionBox(0.5, 0.5, 0.5)));

    expect(a && b && simpleBoxIntersectsSimpleBox(a, b)).toBe(true);
  });
});

function dynamicObject(
  translation: { readonly x: number; readonly y: number; readonly z: number },
  rotation: Mat3,
  collision: DynamicObjectState["collision"],
): DynamicObjectState {
  return {
    cellId: "cell",
    localPose: { rotation, translation },
    collision,
  };
}

function pitchMat3(radians: number): Mat3 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    m00: 1,
    m01: 0,
    m02: 0,
    m10: 0,
    m11: cos,
    m12: -sin,
    m20: 0,
    m21: sin,
    m22: cos,
  };
}

function box(x: number, y: number, z: number, half: number) {
  return {
    center: { x, y, z },
    halfX: half,
    halfY: half,
    halfZ: half,
  };
}

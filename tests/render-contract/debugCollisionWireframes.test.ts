import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";
import { simpleCollisionCylinder, type DynamicObjectState } from "../../src/movement/dynamicObject";
import { buildObjectCollisionWireframe } from "../../src/render/three/debugCollisionWireframes";
import { applyWorldRigidTransform } from "../../src/render/three/worldAxes";

describe("debug collision wireframes", () => {
  it("draws object collision wireframes as runtime cylinders in cell axes", () => {
    const object: DynamicObjectState = {
      cellId: "room",
      localPose: yawRigidTransform3(Math.PI / 2, { x: 1, y: 2, z: 0.5 }),
      collision: simpleCollisionCylinder(0.25, 1),
    };
    const root = new THREE.Group();
    const wireframe = buildObjectCollisionWireframe("long-box", object);
    const positions = wireframe.geometry.getAttribute("position");

    root.add(wireframe);
    applyWorldRigidTransform(root, object.localPose);
    root.updateMatrixWorld(true);

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    wireframe.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

    expect(wireframe).toBeInstanceOf(THREE.LineSegments);
    expect(positions.count).toBe(104);
    expect(worldPosition.x).toBeCloseTo(1);
    expect(worldPosition.y).toBeCloseTo(0.5);
    expect(worldPosition.z).toBeCloseTo(-2);
    expect(worldQuaternion.x).toBeCloseTo(0);
    expect(worldQuaternion.y).toBeCloseTo(0);
    expect(worldQuaternion.z).toBeCloseTo(0);
    expect(Math.abs(worldQuaternion.w)).toBeCloseTo(1);
    expect(worldScale.x).toBeCloseTo(0.5);
    expect(worldScale.y).toBeCloseTo(1);
    expect(worldScale.z).toBeCloseTo(0.5);
  });
});

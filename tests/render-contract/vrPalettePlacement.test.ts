import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveVrPalettePlacement } from "../../src/render/three/vrPalettePlacement";

describe("vrPalettePlacement", () => {
  it("floats in front of the headset at a comfortable distance", () => {
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0), quaternion: new THREE.Quaternion() },
    });

    expect(placement.anchorKind).toBe("head");
    expect(placement.position.x).toBeCloseTo(0);
    expect(placement.position.y).toBeCloseTo(1.48);
    expect(placement.position.z).toBeCloseTo(-0.72);
  });

  it("places the panel along the headset forward direction", () => {
    const headYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0), quaternion: headYaw },
    });

    expect(placement.anchorKind).toBe("head");
    expect(placement.position.x).toBeLessThan(-0.7);
    expect(placement.position.z).toBeCloseTo(0);
  });

  it("stabilizes from the previous pose when freeze is active", () => {
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0) },
      previousPosition: new THREE.Vector3(1, 2, 3),
      previousQuaternion: new THREE.Quaternion(0, 0, 0, 1),
      freeze: true,
    });

    expect(placement.position.toArray()).toEqual([1, 2, 3]);
  });
});

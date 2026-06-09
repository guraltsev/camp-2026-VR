import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveVrPalettePlacement } from "../../src/render/three/vrPalettePlacement";

describe("vrPalettePlacement", () => {
  it("anchors to the tracked hand when available", () => {
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0) },
      hand: { position: new THREE.Vector3(-0.2, 1.3, -0.1), quaternion: new THREE.Quaternion() },
    });

    expect(placement.anchorKind).toBe("hand");
    expect(placement.position.x).toBeLessThan(-0.2);
  });

  it("falls back to the headset when no hand or controller is tracked", () => {
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0), quaternion: new THREE.Quaternion() },
    });

    expect(placement.anchorKind).toBe("head");
    expect(placement.position.z).toBeLessThan(0);
  });

  it("stabilizes from the previous pose when freeze is active", () => {
    const placement = resolveVrPalettePlacement({
      head: { position: new THREE.Vector3(0, 1.6, 0) },
      hand: { position: new THREE.Vector3(-0.2, 1.3, -0.1), quaternion: new THREE.Quaternion() },
      previousPosition: new THREE.Vector3(1, 2, 3),
      previousQuaternion: new THREE.Quaternion(0, 0, 0, 1),
      freeze: true,
    });

    expect(placement.position.toArray()).toEqual([1, 2, 3]);
  });
});

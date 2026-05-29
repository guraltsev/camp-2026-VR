import { describe, expect, it } from "vitest";
import { worldObjectLibrary } from "../../src/world-objects/library";

describe("worldObjectLibrary", () => {
  it("maps static wrappers to the expected asset paths and ids", () => {
    expect(
      worldObjectLibrary.small_house("front-house", {
        position: [-1, 0, 2],
        scale: 3,
        turn: 15,
      }),
    ).toMatchObject({
      id: "front-house",
      kind: "asset",
      assetPath: "small_house/Small House.glb",
      position: { x: -1, y: 2, z: 0 },
      scale: 7.5,
      modelOffset: { x: 0, y: 0, z: 3.75 },
      turnRadians: Math.PI / 12,
      yawRadians: Math.PI / 12,
    });

    expect(
      worldObjectLibrary.tree("right-tree", {
        position: [0.5, 0, -0.5],
      }),
    ).toMatchObject({
      id: "right-tree",
      kind: "asset",
      assetPath: "Tree1/Tree.glb",
      position: { x: 0.5, y: -0.5, z: 0 },
    });

    expect(
      worldObjectLibrary.grass("top-grass", {
        position: [0, 0, 0],
      }),
    ).toMatchObject({
      id: "top-grass",
      assetPath: "grass1/Grass.glb",
    });
  });

  it("keeps static wrappers non-collidable by default", () => {
    const object = worldObjectLibrary.small_house("front-house", {
      position: [0, 0, 0],
    });

    expect(object.kind).toBe("asset");
    expect("collision" in object).toBe(false);
  });

  it("makes trees taller and narrower using per-axis scaling", () => {
    const object = worldObjectLibrary.tree("left-tree", {
      position: [0, 0, 0],
      scale: 3,
    });

    expect(object).toMatchObject({
      scale: 3,
      scaleXYZ: {
        x: 0.04,
        y: 0.15,
        z: 0.04,
      },
    });
  });

  it("creates geo mice as dynamic specs with authored speed and oscillation", () => {
    const object = worldObjectLibrary.geo_mouse("front-runner", {
      position: [-4.2, 0, -1.8],
      scale: 1.05,
      turn: 74,
      speed: 2.4,
      oscillationRate: 1.6,
      oscillationMagnitude: 0.18,
    });

    expect(object).toMatchObject({
      id: "front-runner",
      kind: "geo-mouse",
      assetPath: "mouse/Mouse.glb",
      position: { x: -4.2, y: -1.8, z: 0 },
      scale: 0.035,
      turnRadians: (74 * Math.PI) / 180,
      yawRadians: (74 * Math.PI) / 180,
      speedMetersPerSecond: 2.4,
      oscillationRateHz: 1.6,
      oscillationMagnitudeMeters: 0.018,
    });
  });

  it("creates geo butterflies as dynamic specs", () => {
    const object = worldObjectLibrary.geo_butterfly("flutter", {
      position: [1, 2, 3],
      speed: 0.8,
    });

    expect(object).toMatchObject({
      id: "flutter",
      kind: "geo-butterfly",
      assetPath: "butterfly/Butterfly.glb",
      position: { x: 1, y: 3, z: 2 },
      scale: 0.8,
      speedMetersPerSecond: 0.8,
    });
  });
});

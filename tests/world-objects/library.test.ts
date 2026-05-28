import { describe, expect, it } from "vitest";
import { worldObjectLibrary } from "../../src/world-objects/library";

describe("worldObjectLibrary", () => {
  it("maps static wrappers to the expected asset paths and ids", () => {
    expect(
      worldObjectLibrary.house("front-house", {
        position: [-1, 0, 2],
        scale: 3,
        yaw: 0.25,
      }),
    ).toMatchObject({
      id: "front-house",
      kind: "asset",
      assetPath: "house-low-poly/scene.gltf",
      position: { x: -1, y: 0, z: 2 },
      scale: 3,
      yawRadians: 0.25,
    });

    expect(
      worldObjectLibrary.clock("right-clock", {
        position: [0.5, 0, -0.5],
      }),
    ).toMatchObject({
      id: "right-clock",
      kind: "asset",
      assetPath: "clock_low_poly/scene.gltf",
      position: { x: 0.5, y: 0, z: -0.5 },
    });

    expect(
      worldObjectLibrary.campfire("back-campfire", {
        position: [0, 0, 0],
      }),
    ).toMatchObject({
      id: "back-campfire",
      assetPath: "low_poly_campfire/scene.gltf",
    });

    expect(
      worldObjectLibrary.tree("left-tree", {
        position: [0, 0, 0],
      }),
    ).toMatchObject({
      id: "left-tree",
      assetPath: "low_poly_tree_wind/scene.gltf",
      scaleXYZ: {
        x: 1 / 1.5,
        y: 2.5,
        z: 1 / 1.5,
      },
    });

    expect(
      worldObjectLibrary.rocks("bottom-rocks", {
        position: [0, 0, 0],
      }),
    ).toMatchObject({
      id: "bottom-rocks",
      assetPath: "low_poly_rocks/scene.gltf",
    });

    expect(
      worldObjectLibrary.emergency_button("top-button", {
        position: [0, 0, 0],
      }),
    ).toMatchObject({
      id: "top-button",
      assetPath: "low_poly_emergency_button/scene.gltf",
    });
  });

  it("keeps static wrappers non-collidable by default", () => {
    const object = worldObjectLibrary.house("front-house", {
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
        x: 2,
        y: 7.5,
        z: 2,
      },
    });
  });

  it("creates geodesic marmots as dynamic specs with movement-facing yaw", () => {
    const object = worldObjectLibrary.geodesic_marmot("front-runner", {
      position: [-4.2, 0, -1.8],
      velocity: [2.3, 0.65],
      scale: 1.05,
    });

    expect(object).toMatchObject({
      id: "front-runner",
      kind: "geodesci-marmot",
      assetPath: "racoon-animation/scene.gltf",
      position: { x: -4.2, y: -1.8, z: 0 },
      velocity: { x: 2.3, y: 0.65 },
      scale: 1.05,
      yawRadians: Math.atan2(2.3, 0.65),
    });
  });
});

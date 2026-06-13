import { describe, expect, it } from "vitest";
import { chooseActiveXrPointer } from "../../src/render/three/xrPointers";

describe("xrPointers", () => {
  it("prefers a pressed pointer over hover-only sources", () => {
    const active = chooseActiveXrPointer([
      {
        id: "left-controller",
        kind: "controller",
        handedness: "left",
        hoveredTargetId: "world:cube",
        pressed: false,
        justStarted: false,
        justEnded: false,
        dominant: false,
      },
      {
        id: "right-controller",
        kind: "controller",
        handedness: "right",
        hoveredTargetId: undefined,
        pressed: true,
        justStarted: true,
        justEnded: false,
        dominant: true,
      },
    ]);

    expect(active?.id).toBe("right-controller");
  });

  it("falls back to the dominant hovered source when nothing is pressed", () => {
    const active = chooseActiveXrPointer([
      {
        id: "left-controller",
        kind: "controller",
        handedness: "left",
        hoveredTargetId: "reload-world",
        pressed: false,
        justStarted: false,
        justEnded: false,
        dominant: false,
      },
      {
        id: "right-controller",
        kind: "controller",
        handedness: "right",
        hoveredTargetId: "debug-overlay-toggle",
        pressed: false,
        justStarted: false,
        justEnded: false,
        dominant: true,
      },
    ]);

    expect(active?.id).toBe("right-controller");
  });
});

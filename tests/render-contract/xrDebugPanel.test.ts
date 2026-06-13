import { describe, expect, it } from "vitest";
import { buildXrDebugPanelLines } from "../../src/render/three/xrDebugPanel";

describe("xrDebugPanel", () => {
  const state = {
    secureContext: true,
    sessionStatus: "active",
    activeInputSource: "xr" as const,
    inputMode: "controllers",
    frameRateFps: 72.12345,
    currentCellId: "front",
    playerPosition: { x: 0, y: 0, z: 1.6 },
    yawRadians: 0,
    lastMovementBlocked: false,
    visiblePortalPathCount: 5,
  };

  it("renders only the requested XR debug overlay lines", () => {
    expect(buildXrDebugPanelLines(state, ["fps"])).toEqual(["FPS: 72.123"]);
    expect(buildXrDebugPanelLines(state, ["portal-quantities"])).toEqual(["Visible paths: 5"]);
  });

  it("keeps the location block separate from FPS and portal quantities", () => {
    expect(buildXrDebugPanelLines(state, ["location"])).toEqual([
      "Cell: front",
      "XR: active",
      "Input: controllers",
      "Blocked: no",
    ]);
  });
});

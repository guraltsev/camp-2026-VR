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
    expect(buildXrDebugPanelLines(state, ["fps"])).toEqual(["FPS: 72.123 (13.865 ms)"]);
    expect(buildXrDebugPanelLines(state, ["portal-quantities"])).toEqual(["Paths: 5"]);
  });

  it("keeps the location block separate from FPS and portal quantities", () => {
    expect(buildXrDebugPanelLines(state, ["location"])).toEqual([
      "Cell: front",
      "XR: active",
      "Input: controllers",
      "Blocked: no",
    ]);
  });

  it("adds performance, render, and portal details when available", () => {
    expect(buildXrDebugPanelLines({
      ...state,
      framePerformance: {
        totalMs: 23.4567,
        inputMs: 0.1,
        moveMs: 0.4567,
        objectsMs: 0.2,
        cameraMs: 0.3,
        portalMs: 4.5678,
        uiMs: 0.6,
        renderMs: 15.6789,
      },
      webGlRenderInfo: {
        drawCalls: 42,
        triangles: 123_456,
        lines: 0,
        points: 0,
        viewportPixels: { width: 1832, height: 1920 },
        pixelRatio: 1,
      },
      visiblePortalPaths: {
        candidatePathCount: 500,
        keptPathCount: 320,
        visiblePathCount: 18,
        visiblePathCountByDepth: [],
        maxVisibleDepth: 6,
        clippedByCameraCount: 10,
        clippedByAreaCount: 20,
        clippedByBudgetCount: 0,
        budgetExhausted: false,
      },
      portalEyes: [
        { eyeIndex: 0, rootCellId: "front", visiblePathCount: 18, maxVisibleDepth: 6 },
        { eyeIndex: 1, rootCellId: "front", visiblePathCount: 21, maxVisibleDepth: 6 },
      ],
      portalInstances: {
        enabled: true,
        ShowCellPathRendersInstances: false,
        archetypeCount: 6,
        totalCapacity: 320,
        renderedInstanceCount: 39,
        renderedInstanceCountByCell: [],
        capacityOverflowCount: 0,
        capacityOverflowArchetypes: [],
        normalVisiblePathRenderingActive: true,
        visiblePathIds: [],
        visiblePathDestinations: [],
        clipPolygonVertexCountsByPath: [],
        clipPolygonOverflowPathIds: [],
        visiblePathOverflowCount: 0,
      },
    }, ["fps", "portal-quantities"])).toEqual([
      "FPS: 72.123 (13.865 ms)",
      "CPU ms: 23.457 / portal 4.568 / draw 15.679 / move 0.457",
      "GL: 42 calls / 123.456k tris / 1832x1920",
      "Paths: 18 / kept 320 / depth 6",
      "Eyes: 0:18@6 1:21@6",
      "Instances: 39 / 320",
    ]);
  });
});

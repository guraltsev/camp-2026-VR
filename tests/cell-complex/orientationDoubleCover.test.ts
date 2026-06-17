import { describe, expect, it } from "vitest";
import {
  expandOrientationDoubleCover,
  getCoverCellId,
  hasOrientationReversingPortal,
  prepareWorldForCompilation,
} from "../../src/cell-complex/orientationDoubleCover";
import { compileCellComplex, getBaseCellId, getOppositeSheetCellId, getOrientationSheet } from "../../src/cell-complex/compileCellComplex";
import { torus } from "../../src/authoring/exampleWorlds";
import type { CellComplexSpec } from "../../src/cell-complex/specs";

describe("orientation double cover", () => {
  it("skips expansion for orientable worlds", () => {
    expect(hasOrientationReversingPortal(torus)).toBe(false);

    const prepared = prepareWorldForCompilation(torus);

    expect(prepared.spec).toBe(torus);
    expect(prepared.orientationCover).toBeUndefined();
  });

  it("expands a one-cell Mobius strip into two cover cells", () => {
    const cover = expandOrientationDoubleCover(mobiusSpec());
    const positive = cover.spec.cells.find((cell) => cell.id === "room#positive");
    const negative = cover.spec.cells.find((cell) => cell.id === "room#negative");

    expect(cover.spec.cells.map((cell) => cell.id)).toEqual(["room#positive", "room#negative"]);
    expect(positive?.baseVertices).toEqual(mobiusSpec().cells[0]?.baseVertices);
    expect(negative?.baseVertices).toEqual(mobiusSpec().cells[0]?.baseVertices);
    expect(positive?.visuals).toEqual({
      ...mobiusSpec().cells[0]?.visuals,
      objects: [
        {
          id: "marker#positive",
          kind: "asset",
          assetPath: "trafficCone/Cone.glb",
          position: { x: 0.25, y: 0.5, z: 0 },
          yawRadians: Math.PI / 4,
        },
      ],
    });
    expect(negative?.visuals?.objects?.map((object) => object.id)).toEqual(["marker#negative"]);
    expect(negative?.visuals?.objects?.[0]?.position).toEqual({ x: 0.25, y: 0.5, z: 0 });
    expect(negative?.visuals?.objects?.[0]?.yawRadians).toBeCloseTo(Math.PI / 4);
    expect(positive?.portals).toEqual([
      {
        id: "side-1",
        sideIndex: 1,
        targetCellId: "room#negative",
        targetPortalId: "side-3",
        orientation: "preserving",
      },
      {
        id: "side-3",
        sideIndex: 3,
        targetCellId: "room#negative",
        targetPortalId: "side-1",
        orientation: "preserving",
      },
    ]);
    expect(negative?.portals).toEqual([
      {
        id: "side-1",
        sideIndex: 1,
        targetCellId: "room#positive",
        targetPortalId: "side-3",
        orientation: "preserving",
      },
      {
        id: "side-3",
        sideIndex: 3,
        targetCellId: "room#positive",
        targetPortalId: "side-1",
        orientation: "preserving",
      },
    ]);
    expect(cover.coverCellMetadataById.get("room#positive")).toEqual({
      baseCellId: "room",
      sheet: "positive",
    });
    expect(cover.coverCellMetadataById.get("room#negative")).toEqual({
      baseCellId: "room",
      sheet: "negative",
    });
    expect(getCoverCellId(cover, "room", "negative")).toBe("room#negative");
    expect(cover.mirrorSideIndexByBaseCellId.get("room")).toBe(1);
  });

  it("keeps preserving portals on the same sheet and reversing portals across sheets", () => {
    const cover = expandOrientationDoubleCover(mixedFlippedSquareSpec());
    const positive = cover.spec.cells.find((cell) => cell.id === "room#positive");
    const negative = cover.spec.cells.find((cell) => cell.id === "room#negative");

    expect(positive?.portals.find((portal) => portal.id === "side-0")?.targetCellId).toBe("room#positive");
    expect(positive?.portals.find((portal) => portal.id === "side-1")?.targetCellId).toBe("room#negative");
    expect(negative?.portals.find((portal) => portal.id === "side-0")?.targetCellId).toBe("room#negative");
    expect(negative?.portals.find((portal) => portal.id === "side-1")?.targetCellId).toBe("room#positive");
  });

  it("attaches cover metadata to compiled non-orientable worlds", () => {
    const world = compileCellComplex(mobiusSpec());

    expect(world.cells.map((cell) => cell.id)).toEqual(["room#positive", "room#negative"]);
    expect(world.orientationCover).toBeDefined();
    expect(getBaseCellId(world, "room#negative")).toBe("room");
    expect(getOrientationSheet(world, "room#negative")).toBe("negative");
    expect(getOppositeSheetCellId(world, "room#negative")).toBe("room#positive");
  });
});

function mobiusSpec(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 3,
        baseVertices: squareBase(),
        portals: [
          {
            id: "side-1",
            sideIndex: 1,
            targetCellId: "room",
            targetPortalId: "side-3",
            orientation: "reversing",
          },
          {
            id: "side-3",
            sideIndex: 3,
            targetCellId: "room",
            targetPortalId: "side-1",
            orientation: "reversing",
          },
        ],
        visuals: {
          floorColor: "#abc",
          objects: [
            {
              id: "marker",
              kind: "asset",
              assetPath: "trafficCone/Cone.glb",
              position: { x: 0.25, y: 0.5, z: 0 },
              yawRadians: Math.PI / 4,
            },
          ],
        },
      },
    ],
  };
}

function mixedFlippedSquareSpec(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 3,
        baseVertices: squareBase(),
        portals: [
          {
            id: "side-0",
            sideIndex: 0,
            targetCellId: "room",
            targetPortalId: "side-2",
          },
          {
            id: "side-2",
            sideIndex: 2,
            targetCellId: "room",
            targetPortalId: "side-0",
          },
          {
            id: "side-1",
            sideIndex: 1,
            targetCellId: "room",
            targetPortalId: "side-3",
            orientation: "reversing",
          },
          {
            id: "side-3",
            sideIndex: 3,
            targetCellId: "room",
            targetPortalId: "side-1",
            orientation: "reversing",
          },
        ],
      },
    ],
  };
}

function squareBase() {
  return [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
}

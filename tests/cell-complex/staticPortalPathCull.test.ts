import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { buildPortalPathTables, createPortalPathTable, type PortalPathTablesByRootCell } from "../../src/cell-complex/portalPaths";
import { staticallyCullPortalPathTables } from "../../src/cell-complex/staticPortalPathCull";
import { cube, twoPrismLoop } from "../../src/authoring/exampleWorlds";
import { identityMat3, invertRigidTransform3, type RigidTransform3 } from "../../src/math/rigidTransform3";

describe("staticallyCullPortalPathTables", () => {
  it("keeps depth-0 paths and preserves kept path ids", () => {
    const world = compileCellComplex(twoPrismLoop);
    const candidates = buildPortalPathTables(world, { maxDepth: 2, skipImmediateReverse: false });
    const result = staticallyCullPortalPathTables(world, candidates, { toleranceMeters: 1e-6 });
    const kept = result.tables.tablesByRootCellId.get("room-a")!;

    expect(kept.pathsById.get(0)?.depth).toBe(0);
    expect(kept.paths.map((path) => path.id)).toEqual(candidates.tablesByRootCellId.get("room-a")?.paths.map((path) => path.id));
  });

  it("keeps ambiguous bounds in the conservative no-geometry pass", () => {
    const world = compileCellComplex(cube);
    const candidates = buildPortalPathTables(world, { maxDepth: 2 });
    const result = staticallyCullPortalPathTables(world, candidates, { toleranceMeters: 1e-6 });
    const summary = result.summariesByRootCellId.get("front")!;

    expect(summary.keptPathCount).toBe(summary.inputPathCount);
    expect(summary.rejectedPathCount).toBe(0);
  });

  it("rejects impossible bounds against ancestor portal apertures and counts the reason", () => {
    const world = compileCellComplex(twoPrismLoop);
    const rootPath = buildPortalPathTables(world, { maxDepth: 0 }).tablesByRootCellId.get("room-a")!.paths[0];
    const rootFromDestination = translatedTransform(-20, 0, 0);
    const impossibleTable = createPortalPathTable("room-a", 1, [
      rootPath,
      {
        id: 4,
        rootCellId: "room-a",
        destinationCellId: "room-b",
        depth: 1,
        parentPathId: 0,
        steps: [
          {
            sourceCellId: "room-a",
            sourcePortalId: "side-1",
            sourcePortalSideIndex: 1,
            targetCellId: "room-b",
            targetPortalId: "side-3",
          },
        ],
        destinationFromRoot: invertRigidTransform3(rootFromDestination),
        rootFromDestination,
      },
    ]);
    const candidates: PortalPathTablesByRootCell = {
      maxDepth: 1,
      tablesByRootCellId: new Map([["room-a", impossibleTable]]),
    };
    const result = staticallyCullPortalPathTables(world, candidates, {
      toleranceMeters: 1e-6,
      keepRejectedPathDetails: true,
    });
    const summary = result.summariesByRootCellId.get("room-a")!;

    expect(result.tables.tablesByRootCellId.get("room-a")!.paths.map((path) => path.id)).toEqual([0]);
    expect(summary.rejectedPathCount).toBe(1);
    expect(summary.rejectedByReason.get("outside-ancestor-portal-plane")).toBe(1);
    expect(summary.rejectedPaths).toEqual([
      expect.objectContaining({
        pathId: 4,
        reason: "outside-ancestor-portal-plane",
        details: expect.stringContaining("room-a:side-1"),
      }),
    ]);
  });

  it("returns well-formed summaries and tables when no paths are rejected", () => {
    const world = compileCellComplex(twoPrismLoop);
    const candidates = buildPortalPathTables(world, { maxDepth: 0 });
    const result = staticallyCullPortalPathTables(world, candidates, {
      toleranceMeters: 1e-6,
      keepRejectedPathDetails: true,
    });
    const summary = result.summariesByRootCellId.get("room-a")!;
    const table = result.tables.tablesByRootCellId.get("room-a")!;

    expect(summary).toMatchObject({
      rootCellId: "room-a",
      inputPathCount: 1,
      keptPathCount: 1,
      rejectedPathCount: 0,
      rejectedPaths: [],
    });
    expect(summary.rejectedByReason.size).toBe(0);
    expect(table.paths).toHaveLength(1);
    expect(table.pathsById.get(0)).toBeDefined();
  });

  it("reports static path budget rejections instead of silently truncating", () => {
    const world = compileCellComplex(cube);
    const candidates = buildPortalPathTables(world, { maxDepth: 2 });
    const result = staticallyCullPortalPathTables(world, candidates, {
      toleranceMeters: 1e-6,
      maxKeptPathsPerRoot: 2,
      keepRejectedPathDetails: true,
    });
    const summary = result.summariesByRootCellId.get("front")!;

    expect(summary.keptPathCount).toBe(2);
    expect(summary.rejectedPathCount).toBe(summary.inputPathCount - 2);
    expect(summary.rejectedByReason.get("static-path-budget")).toBe(summary.rejectedPathCount);
    expect(summary.rejectedPaths.every((path) => path.reason === "static-path-budget")).toBe(true);
    expect(summary.rejectedPaths[0]?.details).toContain("static path budget");
  });
});

function translatedTransform(x: number, y: number, z: number): RigidTransform3 {
  return {
    rotation: identityMat3,
    translation: { x, y, z },
  };
}

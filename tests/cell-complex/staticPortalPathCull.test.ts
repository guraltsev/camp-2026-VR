import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { buildPortalPathTables } from "../../src/cell-complex/portalPaths";
import { staticallyCullPortalPathTables } from "../../src/cell-complex/staticPortalPathCull";
import { cube, twoPrismLoop } from "../../src/authoring/exampleWorlds";

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

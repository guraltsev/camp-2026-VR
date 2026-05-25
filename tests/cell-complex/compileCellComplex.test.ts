import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { cube } from "../../src/cell-complex/examples/cube";
import { tetrahedron } from "../../src/cell-complex/examples/tetrahedron";
import { torus } from "../../src/cell-complex/examples/torus";
import { twoPrismLoop } from "../../src/cell-complex/examples/twoPrismLoop";
import { validateAuthoringSpec } from "../../src/authoring/validateAuthoringSpec";

describe("compileCellComplex", () => {
  it("preserves the visible prism cells from the starter world", () => {
    const compiled = compileCellComplex(twoPrismLoop);

    expect(compiled.cells.map((cell) => cell.id)).toEqual(["room-a", "room-b"]);
  });

  it("compiles the stage geometry examples", () => {
    expect(compileCellComplex(torus).cells.map((cell) => cell.id)).toEqual(["torus-room"]);
    expect(compileCellComplex(tetrahedron).cells).toHaveLength(4);
    expect(compileCellComplex(cube).cells).toHaveLength(6);
    expect(compileCellComplex(cube).cells.every((cell) => cell.sideCount === 4)).toBe(true);
    expect(compileCellComplex(cube).cells.every((cell) => cell.objects.length === 1)).toBe(true);
  });

  it("compiles portal lookups, side geometry, and forbidden zones for movement", () => {
    const compiled = compileCellComplex(twoPrismLoop);
    const roomA = compiled.cellsById.get("room-a");

    expect(roomA?.portalsById.get("east")?.targetCellId).toBe("room-b");
    expect(roomA?.portalBySideIndex.get(1)?.id).toBe("east");
    expect(roomA?.sides).toHaveLength(4);
    expect(roomA?.forbiddenZones.map((zone) => zone.junctionId)).toEqual(["room-a:vertex-1", "room-a:vertex-2"]);
    expect(roomA?.singularityColumns.map((column) => column.junctionId)).toEqual([
      "room-a:vertex-1",
      "room-a:vertex-2",
    ]);
    expect(roomA?.singularityColumns[0]?.kind).toBe("invisible-column");
    expect(roomA?.singularityColumns[0]?.heightMeters).toBe(roomA?.heightMeters);
  });

  it("reports readable movement-critical authoring errors", () => {
    const errors = validateAuthoringSpec({
      cells: [
        {
          id: "room",
          heightMeters: 2,
          baseVertices: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
          ],
          portals: [
            {
              id: "bad",
              sideIndex: 3,
              targetCellId: "missing",
              targetPortalId: "also-missing",
              transformToTarget: {
                rotation: {
                  m00: 1,
                  m01: 0,
                  m02: 0,
                  m10: 0,
                  m11: 1,
                  m12: 0,
                  m20: 0,
                  m21: 0,
                  m22: 1,
                },
                translation: { x: 0, y: 0, z: 0 },
              },
            },
            {
              id: "bad",
              sideIndex: 0,
              targetCellId: "room",
              targetPortalId: "bad",
              transformToTarget: {
                rotation: {
                  m00: 1,
                  m01: 0,
                  m02: 0,
                  m10: 0,
                  m11: 1,
                  m12: 0,
                  m20: 0,
                  m21: 0,
                  m22: 1,
                },
                translation: { x: 0, y: 0, z: 0 },
              },
            },
          ],
        },
        {
          id: "room",
          heightMeters: 2,
          baseVertices: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
          ],
          portals: [],
        },
      ],
    });

    expect(errors).toContain('Duplicate cell id "room".');
    expect(errors).toContain('Cell "room" has duplicate portal id "bad".');
    expect(errors).toContain('Portal "room:bad" has sideIndex 3, expected 0-2.');
    expect(errors).toContain('Portal "room:bad" targets missing cell "missing".');
    expect(errors).toContain('Portal "room:bad" is not reciprocated by "room:bad".');
  });
});

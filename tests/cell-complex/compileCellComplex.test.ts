import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { cube } from "../../src/cell-complex/examples/cube";
import { tetrahedron } from "../../src/cell-complex/examples/tetrahedron";
import { torus } from "../../src/cell-complex/examples/torus";
import { twoPrismLoop } from "../../src/cell-complex/examples/twoPrismLoop";

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
});

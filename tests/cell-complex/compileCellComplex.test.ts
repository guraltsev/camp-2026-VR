import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { twoPrismLoop } from "../../src/cell-complex/examples/twoPrismLoop";

describe("compileCellComplex", () => {
  it("preserves the visible prism cells from the starter world", () => {
    const compiled = compileCellComplex(twoPrismLoop);

    expect(compiled.cells.map((cell) => cell.id)).toEqual(["room-a", "room-b"]);
  });
});

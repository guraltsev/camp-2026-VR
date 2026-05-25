import type { CellComplexSpec } from "../cell-complex/specs";
import { compileWorldScript } from "./compileWorldScript";
import cubeWorldSource from "../examples/cube.world.js?raw";
import tetrahedronWorldSource from "../examples/tetrahedron.world.js?raw";
import torusWorldSource from "../examples/torus.world.js?raw";
import twoPrismLoopWorldSource from "../examples/twoPrismLoop.world.js?raw";

export const cube = compileExampleWorld(cubeWorldSource, "cube.world.js");
export const tetrahedron = compileExampleWorld(tetrahedronWorldSource, "tetrahedron.world.js");
export const torus = compileExampleWorld(torusWorldSource, "torus.world.js");
export const twoPrismLoop = compileExampleWorld(twoPrismLoopWorldSource, "twoPrismLoop.world.js");

function compileExampleWorld(sourceText: string, sourceName: string): CellComplexSpec {
  return compileWorldScript(sourceText, { sourceName });
}

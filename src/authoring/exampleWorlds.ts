import type { CellComplexSpec } from "../cell-complex/specs";
import { compileWorldScript } from "./compileWorldScript";
import basicCubeWorldSource from "../examples/001-basic-cube.world.js?raw";
import basicTetrahedronWorldSource from "../examples/002-basic-tetrahedron.world.js?raw";
import cubeWorldSource from "../examples/cube.world.js?raw";
import dodecahedronWorldSource from "../examples/dodecahedron.world.js?raw";
import genus2TorusWorldSource from "../examples/genus-2-torus.world.js?raw";
import icosahedronWorldSource from "../examples/icosahedron.world.js?raw";
import octahedronWorldSource from "../examples/octahedron.world.js?raw";
import tetrahedronWorldSource from "../examples/tetrahedron.world.js?raw";
import torusWorldSource from "../examples/torus.world.js?raw";
import torusModuliWorldSource from "../examples/torus-moduli.world.js?raw";

export const basicCube = compileExampleWorld(basicCubeWorldSource, "001-basic-cube.world.js");
export const basicTetrahedron = compileExampleWorld(basicTetrahedronWorldSource, "002-basic-tetrahedron.world.js");
export const cube = compileExampleWorld(cubeWorldSource, "cube.world.js");
export const dodecahedron = compileExampleWorld(dodecahedronWorldSource, "dodecahedron.world.js");
export const genus2Torus = compileExampleWorld(genus2TorusWorldSource, "genus-2-torus.world.js");
export const icosahedron = compileExampleWorld(icosahedronWorldSource, "icosahedron.world.js");
export const octahedron = compileExampleWorld(octahedronWorldSource, "octahedron.world.js");
export const tetrahedron = compileExampleWorld(tetrahedronWorldSource, "tetrahedron.world.js");
export const torus = compileExampleWorld(torusWorldSource, "torus.world.js");
export const torusModuli = compileExampleWorld(torusModuliWorldSource, "torus-moduli.world.js");

function compileExampleWorld(sourceText: string, sourceName: string): CellComplexSpec {
  return compileWorldScript(sourceText, { sourceName });
}

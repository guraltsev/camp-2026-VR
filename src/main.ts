import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { twoPrismLoop } from "./cell-complex/examples/twoPrismLoop";
import { createInitialAppState } from "./appState";
import { createThreeApp } from "./render/three/createThreeApp";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

const world = compileCellComplex(twoPrismLoop);
const appState = createInitialAppState(world);

createThreeApp(appElement, appState);

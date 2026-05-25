import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { describeGeometrySpec } from "./cell-complex/describeGeometry";
import { createInitialAppState } from "./appState";
import { loadGeometrySpec, readGeometrySelectionOptions, renderGeometryPicker } from "./geometrySelection";
import { createThreeApp } from "./render/three/createThreeApp";
import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

void startApp(appElement);

async function startApp(container: HTMLDivElement): Promise<void> {
  const geometryOptions = readGeometrySelectionOptions(window.location);
  const geometrySpec = await loadGeometrySpec(geometryOptions.selectedGeometryId);
  console.info(describeGeometrySpec(geometrySpec));
  const world = compileCellComplex(geometrySpec);
  const appState = createInitialAppState(world);

  if (geometryOptions.renderPicker) {
    renderGeometryPicker(document.body, geometryOptions.selectedGeometryId);
  }

  createThreeApp(container, appState, { debugLevel: geometryOptions.debugLevel });
}

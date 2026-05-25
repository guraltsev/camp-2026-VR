import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { describeGeometrySpec } from "./cell-complex/describeGeometry";
import { createInitialAppState } from "./appState";
import { loadWorldSpec } from "./authoring/worldCatalog";
import { readLaunchOptions } from "./glue/readLaunchOptions";
import { renderWorldPicker } from "./glue/renderWorldPicker";
import { createThreeApp } from "./render/three/createThreeApp";
import { preloadWorldAssets } from "./render/three/preloadWorldAssets";
import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

void startApp(appElement);

async function startApp(container: HTMLDivElement): Promise<void> {
  const launchOptions = readLaunchOptions(window.location);
  const geometrySpec = await loadWorldSpec(launchOptions.selectedWorldId);
  console.info(describeGeometrySpec(geometrySpec));
  const world = compileCellComplex(geometrySpec);
  await preloadWorldAssets(world);
  const appState = createInitialAppState(world);

  if (launchOptions.renderWorldPicker) {
    renderWorldPicker(document.body, launchOptions.selectedWorldId);
  }

  createThreeApp(container, appState, { debugLevel: launchOptions.debugLevel });
}

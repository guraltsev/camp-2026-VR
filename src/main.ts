import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { describeGeometrySpec } from "./cell-complex/describeGeometry";
import { createInitialAppState } from "./appState";
import { loadWorldSpec } from "./authoring/worldCatalog";
import type { DebugSettings } from "./glue/debugSettings";
import { hasActiveDebugOption } from "./glue/debugOptions";
import { readLaunchOptions } from "./glue/readLaunchOptions";
import { renderLaunchControls } from "./glue/renderLaunchControls";
import { createThreeApp } from "./render/three/createThreeApp";
import { preloadWorldAssets } from "./render/three/preloadWorldAssets";
import { installRuntimeDiagnostics } from "./render/three/runtimeDiagnostics";
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
  applyRuntimeDiagnostics(world, {
    debugLevel: launchOptions.debugLevel,
    portalPanelMode: launchOptions.portalPanelMode,
    debugOptions: launchOptions.debugOptions,
  });
  const assets = await preloadWorldAssets(world);
  const appState = createInitialAppState(world);
  const threeApp = createThreeApp(container, appState, {
    debugLevel: launchOptions.debugLevel,
    portalPanelMode: launchOptions.portalPanelMode,
    assets,
  });

  if (launchOptions.renderWorldPicker || launchOptions.renderDebugButton) {
    renderLaunchControls(document.body, {
      ...launchOptions,
      applyDebugSettings(settings) {
        applyRuntimeDiagnostics(world, settings);
        threeApp.updateDebugSettings(settings);
      },
    });
  }
}

function applyRuntimeDiagnostics(world: Parameters<typeof installRuntimeDiagnostics>[0], settings: DebugSettings): void {
  installRuntimeDiagnostics(
    world,
    settings.debugLevel,
    hasActiveDebugOption(settings.debugLevel, settings.debugOptions, "runtime-diagnostics"),
  );
}

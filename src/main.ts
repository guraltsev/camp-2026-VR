import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { describeGeometrySpec } from "./cell-complex/describeGeometry";
import { createInitialAppState } from "./appState";
import { loadWorldSpec } from "./authoring/worldCatalog";
import type { DebugSettings } from "./glue/debugSettings";
import { hasActiveDebugOption } from "./glue/debugOptions";
import { createLoadingStatus } from "./glue/loadingStatus";
import { readLaunchOptions } from "./glue/readLaunchOptions";
import { createThreeApp } from "./render/three/createThreeApp";
import { preloadWorldAssets } from "./render/three/preloadWorldAssets";
import { installRuntimeDiagnostics } from "./render/three/runtimeDiagnostics";
import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

const loadingStatus = createLoadingStatus(appElement);
void startApp(appElement);

async function startApp(container: HTMLDivElement): Promise<void> {
  try {
    loadingStatus.setPhase("Reading launch options");
    const launchOptions = readLaunchOptions(window.location);
    const geometrySpec = await loadingStatus.track("Loading world description", () =>
      loadWorldSpec(launchOptions.selectedWorldId),
    );
    console.info(describeGeometrySpec(geometrySpec));
    const world = await loadingStatus.track("Computing world", () => compileCellComplex(geometrySpec));
    applyRuntimeDiagnostics(world, {
      debugLevel: launchOptions.debugLevel,
      portalPanelMode: launchOptions.portalPanelMode,
      debugOptions: launchOptions.debugOptions,
    });
    const assets = await loadingStatus.track("Loading objects", () => preloadWorldAssets(world));
    loadingStatus.setPhase("Placing player");
    const appState = createInitialAppState(world);
    await loadingStatus.track("Preparing renderer", () =>
      createThreeApp(container, appState, {
        selectedWorldId: launchOptions.selectedWorldId,
        worldSpec: geometrySpec,
        debugLevel: launchOptions.debugLevel,
        portalPanelMode: launchOptions.portalPanelMode,
        debugOptions: launchOptions.debugOptions,
        debugOverlayEnabled: launchOptions.debugOverlayEnabled,
        debugOverlayItems: launchOptions.debugOverlayItems,
        renderQualityEnabled: launchOptions.renderQualityEnabled,
        assets,
      }),
    );

    loadingStatus.dispose();
  } catch (error) {
    console.error(error);
    loadingStatus.showError(error instanceof Error ? error.message : "Unable to start the world.");
  }
}

function applyRuntimeDiagnostics(world: Parameters<typeof installRuntimeDiagnostics>[0], settings: DebugSettings): void {
  installRuntimeDiagnostics(
    world,
    settings.debugLevel,
    hasActiveDebugOption(settings.debugLevel, settings.debugOptions, "runtime-diagnostics"),
  );
}

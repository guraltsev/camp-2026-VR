import { compileCellComplex } from "./cell-complex/compileCellComplex";
import { describeGeometrySpec } from "./cell-complex/describeGeometry";
import { createInitialAppState } from "./appState";
import { loadWorldSpec } from "./authoring/worldCatalog";
import type { DebugSettings } from "./glue/debugSettings";
import { hasActiveDebugOption } from "./glue/debugOptions";
import {
  buildUrlWithLaunchOptions,
  replaceVisibleUrlWithoutLaunchOptions,
} from "./glue/launchOptionsUrl";
import { createLoadingStatus } from "./glue/loadingStatus";
import { readLaunchOptions, type LaunchOptions } from "./glue/readLaunchOptions";
import { createThreeApp, type ThreeApp } from "./render/three/createThreeApp";
import { preloadWorldAssets } from "./render/three/preloadWorldAssets";
import { installRuntimeDiagnostics } from "./render/three/runtimeDiagnostics";
import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

let launchOptions = readLaunchOptions(window.location);
replaceVisibleUrlWithoutLaunchOptions(window);
let activeApp: ThreeApp | undefined;
let activeRunId = 0;

void restartApp(appElement, launchOptions);

async function restartApp(container: HTMLDivElement, nextLaunchOptions: LaunchOptions): Promise<void> {
  launchOptions = nextLaunchOptions;
  activeRunId += 1;
  const runId = activeRunId;

  activeApp?.dispose();
  activeApp = undefined;

  const loadingStatus = createLoadingStatus(container);
  try {
    loadingStatus.setPhase("Reading launch options");
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
    const nextApp = await loadingStatus.track("Preparing renderer", () =>
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
        onWorldChangeRequested(worldId) {
          void restartApp(container, {
            ...launchOptions,
            selectedWorldId: worldId,
          });
        },
        onReloadRequested() {
          void restartApp(container, launchOptions);
        },
        onLaunchOptionsChanged(patch) {
          launchOptions = {
            ...launchOptions,
            ...patch,
          };
        },
        onCopyUrlWithOptionsRequested() {
          void copyUrlWithOptions(launchOptions);
        },
      }),
    );

    if (runId !== activeRunId) {
      nextApp.dispose();
      loadingStatus.dispose();
      return;
    }

    activeApp = nextApp;
    loadingStatus.dispose();
  } catch (error) {
    if (runId !== activeRunId) {
      loadingStatus.dispose();
      return;
    }

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

async function copyUrlWithOptions(options: LaunchOptions): Promise<void> {
  const url = buildUrlWithLaunchOptions(window.location.href, options);

  try {
    await navigator.clipboard.writeText(url);
    console.info("[noneuclid] copied URL with options", url);
  } catch (error) {
    console.warn("[noneuclid] unable to copy URL with options", error, url);
  }
}

import { describe, expect, it } from "vitest";
import {
  buildWorldChangeUrl,
  dispatchRuntimeCommand,
  type CreateAppCommandDispatcherOptions,
} from "../../src/runtime/appCommandDispatcher";

describe("runtimeCommands", () => {
  function createAdapters(): {
    readonly adapters: CreateAppCommandDispatcherOptions;
    readonly calls: {
      reloads: number;
      home: number;
      navigatedTo: string[];
      debugOverlay: boolean[];
    };
  } {
    const calls = {
      reloads: 0,
      home: 0,
      navigatedTo: [] as string[],
      debugOverlay: [] as boolean[],
    };

    return {
      calls,
      adapters: {
        currentUrl: "https://example.test/?world=cube&debugLevel=basic",
        reloadWorld() {
          calls.reloads += 1;
        },
        goHome() {
          calls.home += 1;
        },
        navigateToUrl(url) {
          calls.navigatedTo.push(url);
        },
        setDebugOverlayEnabled(enabled) {
          calls.debugOverlay.push(enabled);
        },
      },
    };
  }

  it("builds a world-change URL by preserving other query params", () => {
    expect(buildWorldChangeUrl("https://example.test/?world=cube&debugLevel=basic", "torus"))
      .toBe("https://example.test/?world=torus&debugLevel=basic");
  });

  it("dispatches reload-world through the reload adapter", () => {
    const { adapters, calls } = createAdapters();

    dispatchRuntimeCommand({ kind: "reload-world" }, adapters);

    expect(calls.reloads).toBe(1);
  });

  it("dispatches go-home through the home adapter", () => {
    const { adapters, calls } = createAdapters();

    dispatchRuntimeCommand({ kind: "go-home" }, adapters);

    expect(calls.home).toBe(1);
  });

  it("dispatches change-world through navigation", () => {
    const { adapters, calls } = createAdapters();

    dispatchRuntimeCommand({ kind: "change-world", worldId: "tetrahedron" }, adapters);

    expect(calls.navigatedTo).toEqual(["https://example.test/?world=tetrahedron&debugLevel=basic"]);
  });

  it("dispatches debug overlay toggles through the debug adapter", () => {
    const { adapters, calls } = createAdapters();

    dispatchRuntimeCommand({ kind: "set-debug-overlay", enabled: false }, adapters);

    expect(calls.debugOverlay).toEqual([false]);
  });
});

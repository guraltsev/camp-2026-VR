import type { RuntimeCommand } from "./runtimeCommands";

export interface AppCommandDispatcher {
  dispatch(command: RuntimeCommand): void;
}

export interface CreateAppCommandDispatcherOptions {
  readonly currentUrl: string;
  readonly reloadWorld: () => void;
  readonly goHome: () => void;
  readonly navigateToUrl: (url: string) => void;
  readonly setDebugOverlayEnabled: (enabled: boolean) => void;
}

export function createAppCommandDispatcher(options: CreateAppCommandDispatcherOptions): AppCommandDispatcher {
  return {
    dispatch(command) {
      dispatchRuntimeCommand(command, options);
    },
  };
}

export function dispatchRuntimeCommand(
  command: RuntimeCommand,
  options: CreateAppCommandDispatcherOptions,
): void {
  switch (command.kind) {
    case "reload-world":
      options.reloadWorld();
      return;
    case "go-home":
      options.goHome();
      return;
    case "change-world":
      options.navigateToUrl(buildWorldChangeUrl(options.currentUrl, command.worldId));
      return;
    case "set-debug-overlay":
      options.setDebugOverlayEnabled(command.enabled);
      return;
  }
}

export function buildWorldChangeUrl(currentUrl: string, worldId: string): string {
  const url = new URL(currentUrl);
  url.searchParams.set("world", worldId);
  return url.toString();
}

import type { RuntimeCommand } from "./runtimeCommands";

export interface AppCommandDispatcher {
  dispatch(command: RuntimeCommand): void;
}

export interface CreateAppCommandDispatcherOptions {
  readonly reloadWorld: () => void;
  readonly goHome: () => void;
  readonly changeWorld: (worldId: string) => void;
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
      options.changeWorld(command.worldId);
      return;
    case "set-debug-overlay":
      options.setDebugOverlayEnabled(command.enabled);
      return;
  }
}

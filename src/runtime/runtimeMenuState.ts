export type RuntimeMenuPageId = "main" | "settings";

export interface RuntimeMenuState {
  readonly isOpen: boolean;
  readonly page: RuntimeMenuPageId;
  readonly selectedWorldId: string;
  readonly debugOverlayEnabled: boolean;
}

export interface CreateRuntimeMenuStateOptions {
  readonly selectedWorldId: string;
  readonly debugOverlayEnabled?: boolean;
}

export function createRuntimeMenuState(options: CreateRuntimeMenuStateOptions): RuntimeMenuState {
  return {
    isOpen: false,
    page: "main",
    selectedWorldId: options.selectedWorldId,
    debugOverlayEnabled: options.debugOverlayEnabled ?? true,
  };
}

export function openRuntimeMenu(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    isOpen: true,
    page: "main",
  };
}

export function closeRuntimeMenu(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    isOpen: false,
    page: "main",
  };
}

export function showRuntimeMenuSettings(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "settings",
  };
}

export function showRuntimeMenuMainPage(state: RuntimeMenuState): RuntimeMenuState {
  return {
    ...state,
    page: "main",
  };
}

export function setRuntimeMenuSelectedWorldId(state: RuntimeMenuState, worldId: string): RuntimeMenuState {
  return {
    ...state,
    selectedWorldId: worldId,
  };
}

export function setRuntimeMenuDebugOverlayEnabled(state: RuntimeMenuState, enabled: boolean): RuntimeMenuState {
  return {
    ...state,
    debugOverlayEnabled: enabled,
  };
}

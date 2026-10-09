/** Geometry-computer menu: pending torus-skew targets and starting the deformation. */
import {
  type RuntimeMenuState,
  closeRuntimeMenu,
  showRuntimeMenuGeometryComputerActions,
} from "../../runtime/runtimeMenuState";
import { createWorldGeometrySession } from "../../runtime/worldGeometrySession";
import { clampInteger } from "./runtimeSceneUtils";

export interface GeometryComputerMenuDeps {
  readonly geometrySession: ReturnType<typeof createWorldGeometrySession>;
  getMenuState(): RuntimeMenuState;
  setMenuState(next: RuntimeMenuState): void;
  syncDesktopPalette(): void;
}

export function createGeometryComputerMenu(deps: GeometryComputerMenuDeps) {
  const { geometrySession, syncDesktopPalette } = deps;

  function createGeometryComputerMenuOptions(computerId: string): Parameters<typeof showRuntimeMenuGeometryComputerActions>[1] {
    const state = geometrySession.state;
    const current = state.current.kind === "torus-skew" ? state.current : undefined;
    const target = state.target.kind === "torus-skew" ? state.target : undefined;
    const pending = deps.getMenuState().geometryComputerOptions;

    return {
      computerId,
      available: current !== undefined || target !== undefined,
      widthMeters: current?.widthMeters ?? target?.widthMeters,
      currentSkewXMeters: current?.skewXMeters,
      currentDepthMeters: current?.depthMeters,
      targetSkewXMeters: pending?.targetSkewXMeters ?? target?.skewXMeters,
      targetDepthMeters: pending?.targetDepthMeters ?? target?.depthMeters,
    };
  }

  function refreshOpenGeometryComputerMenu(): void {
    const computerId = deps.getMenuState().geometryComputerOptions?.computerId;
    if (deps.getMenuState().page !== "geometry-computer-actions" || !computerId) {
      return;
    }

    deps.setMenuState(showRuntimeMenuGeometryComputerActions(
      deps.getMenuState(),
      createGeometryComputerMenuOptions(computerId),
    ));
  }

  function setGeometryComputerPendingTarget(
    computerId: string,
    target: { readonly aMeters: number; readonly bMeters: number },
  ): void {
    const base = getGeometryComputerBaseState();
    if (!base) {
      refreshOpenGeometryComputerMenu();
      syncDesktopPalette();
      return;
    }

    const sanitized = sanitizeGeometryComputerTarget(base.widthMeters, target);
    deps.setMenuState(showRuntimeMenuGeometryComputerActions(
      deps.getMenuState(),
      {
        ...createGeometryComputerMenuOptions(computerId),
        targetSkewXMeters: sanitized.aMeters,
        targetDepthMeters: sanitized.bMeters,
      },
    ));
    syncDesktopPalette();
  }

  function stepGeometryComputerPendingTarget(computerId: string, axis: "a" | "b", deltaMeters: number): void {
    const base = getGeometryComputerBaseState();
    if (!base) {
      refreshOpenGeometryComputerMenu();
      syncDesktopPalette();
      return;
    }

    const pending = deps.getMenuState().geometryComputerOptions;
    const next = sanitizeGeometryComputerTarget(base.widthMeters, {
      aMeters: (pending?.targetSkewXMeters ?? base.skewXMeters) + (axis === "a" ? deltaMeters : 0),
      bMeters: (pending?.targetDepthMeters ?? base.depthMeters) + (axis === "b" ? deltaMeters : 0),
    });
    setGeometryComputerPendingTarget(computerId, next);
  }

  function startGeometryComputerDeformation(_computerId: string): void {
    const base = getGeometryComputerBaseState();
    if (!base) {
      refreshOpenGeometryComputerMenu();
      syncDesktopPalette();
      return;
    }

    const pending = deps.getMenuState().geometryComputerOptions;
    const target = sanitizeGeometryComputerTarget(base.widthMeters, {
      aMeters: pending?.targetSkewXMeters ?? base.skewXMeters,
      bMeters: pending?.targetDepthMeters ?? base.depthMeters,
    });

    geometrySession.setTarget({
      ...base,
      skewXMeters: target.aMeters,
      depthMeters: target.bMeters,
    });
    deps.setMenuState(closeRuntimeMenu(deps.getMenuState()));
    syncDesktopPalette();
  }

  function getGeometryComputerBaseState() {
    const state = geometrySession.state;
    return state.current.kind === "torus-skew"
      ? state.current
      : state.target.kind === "torus-skew"
        ? state.target
        : undefined;
  }

  function sanitizeGeometryComputerTarget(
    widthMeters: number,
    target: { readonly aMeters: number; readonly bMeters: number },
  ): { readonly aMeters: number; readonly bMeters: number } {
    return {
      aMeters: clampInteger(target.aMeters, 0, 2 * widthMeters),
      bMeters: clampInteger(target.bMeters, widthMeters / 2, 2 * widthMeters),
    };
  }

  return {
    createGeometryComputerMenuOptions,
    refreshOpenGeometryComputerMenu,
    stepGeometryComputerPendingTarget,
    startGeometryComputerDeformation,
    setGeometryComputerPendingTarget,
  };
}

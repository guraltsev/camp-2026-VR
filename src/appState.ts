import type { CompiledCellComplex } from "./cell-complex/compileCellComplex";

export interface AppState {
  readonly world: CompiledCellComplex;
  readonly selectedTool: "none" | "straight-ray" | "marker";
}

export function createInitialAppState(world: CompiledCellComplex): AppState {
  return {
    world,
    selectedTool: "none",
  };
}

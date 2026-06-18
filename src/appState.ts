import type { CompiledCellComplex } from "./cell-complex/compileCellComplex";
import { createDefaultPlayerBody, type PlayerBody } from "./movement/playerBody";
import { createDefaultPlayerPose, type PlayerPose } from "./movement/playerPose";

export interface AppState {
  readonly world: CompiledCellComplex;
  readonly playerBody: PlayerBody;
  readonly playerPose: PlayerPose;
  readonly selectedTool: "none" | "straight-ray" | "marker";
}

export function createInitialAppState(world: CompiledCellComplex): AppState {
  const startCell = world.cells[0];

  if (!startCell) {
    throw new Error("Cannot create app state without at least one compiled cell.");
  }

  return {
    world,
    playerBody: createDefaultPlayerBody(),
    playerPose: world.startingPosition
      ? {
          cellId: world.startingPosition.cellId,
          position: world.startingPosition.position,
          yawRadians: world.startingPosition.yawRadians ?? 0,
          pitchRadians: world.startingPosition.pitchRadians ?? 0,
        }
      : createDefaultPlayerPose(startCell.id),
    selectedTool: "none",
  };
}

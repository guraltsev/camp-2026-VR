import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { GeodesicCarryPortalTransition } from "../../world-objects/geodesicCannon";
import type { movePlayer } from "../../movement/movePlayer";

interface PortalMoveResult {
  readonly crossedPortal: boolean;
  readonly crossedPortalId?: string;
  readonly pose: { readonly cellId: string };
}

export function resolveGeodesicCarryPortalTransitionFromMove(
  world: CompiledCellComplex,
  previousCellId: string,
  moveResult: ReturnType<typeof movePlayer>,
): GeodesicCarryPortalTransition | undefined {
  return resolveGeodesicCarryPortalTransitionFromPortalMove(world, previousCellId, moveResult);
}

export function resolveGeodesicCarryPortalTransitionFromPortalMove(
  world: CompiledCellComplex,
  previousCellId: string,
  moveResult: PortalMoveResult,
): GeodesicCarryPortalTransition | undefined {
  if (!moveResult.crossedPortal || !moveResult.crossedPortalId) {
    return undefined;
  }

  const portal = world.cellsById.get(previousCellId)?.portalsById.get(moveResult.crossedPortalId);
  if (!portal || portal.targetCellId !== moveResult.pose.cellId) {
    return undefined;
  }

  return {
    sourceCellId: previousCellId,
    sourcePortalId: portal.id,
    targetCellId: portal.targetCellId,
    targetPortalId: portal.targetPortalId,
    transformToTarget: portal.transformToTarget,
  };
}

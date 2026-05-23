import type { PortalSpec } from "../cell-complex/specs";
import { applyRigidTransform3 } from "../math/rigidTransform3";
import type { PlayerBody } from "./playerBody";

export function crossPortal(player: PlayerBody, portal: PortalSpec): PlayerBody {
  return {
    ...player,
    cellId: portal.targetCellId,
    position: applyRigidTransform3(portal.transformToTarget, player.position),
  };
}

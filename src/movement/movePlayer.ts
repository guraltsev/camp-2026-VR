import { addVec3, type Vec3 } from "../math/vec3";
import type { PlayerBody } from "./playerBody";

export function movePlayer(player: PlayerBody, displacement: Vec3): PlayerBody {
  return {
    ...player,
    position: addVec3(player.position, displacement),
  };
}

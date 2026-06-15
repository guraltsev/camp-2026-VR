import type { Vec3 } from "../../math/vec3";

const aimPointToleranceMeters = 1e-7;

export function resolveGeodesicCannonAimYawFromAbsolutePoints(options: {
  readonly source: Vec3 | undefined;
  readonly target: Vec3 | undefined;
}): number | undefined {
  if (!options.source || !options.target) {
    return undefined;
  }

  const dx = options.target.x - options.source.x;
  const dy = options.target.y - options.source.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) <= aimPointToleranceMeters) {
    return undefined;
  }

  return Math.atan2(dy, dx);
}

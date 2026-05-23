export const forbiddenPortalJunctionRadiusMeters = 0.15;

export interface PortalJunction {
  readonly id: string;
  readonly adjacentPortalIds: readonly string[];
}

export interface ForbiddenZone {
  readonly junctionId: string;
  readonly radiusMeters: number;
}

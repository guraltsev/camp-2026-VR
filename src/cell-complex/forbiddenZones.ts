export const forbiddenPortalJunctionRadiusMeters = 0.15;

export interface PortalJunction {
  readonly id: string;
  readonly adjacentPortalIds: readonly string[];
  readonly position: { readonly x: number; readonly z: number };
}

export interface ForbiddenZone {
  readonly junctionId: string;
  readonly collision: SingularityCollisionColumn;
}

export interface SingularityCollisionColumn {
  readonly kind: "invisible-column";
  readonly junctionId: string;
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly radiusMeters: number;
  readonly heightMeters: number;
}

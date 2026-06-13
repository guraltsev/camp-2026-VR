export const forbiddenPortalJunctionRadiusMeters = 0.15;
export const forbiddenPortalJunctionHalfExtentMeters = forbiddenPortalJunctionRadiusMeters;
export const forbiddenPortalJunctionHalfHeightMeters = 500;

export interface PortalJunction {
  readonly id: string;
  readonly adjacentPortalIds: readonly string[];
  readonly position: { readonly x: number; readonly y: number };
}

export interface ForbiddenZone {
  readonly junctionId: string;
  readonly collision: SingularityCollisionBox;
}

export interface SingularityCollisionBox {
  readonly kind: "invisible-box";
  readonly junctionId: string;
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
}

export const forbiddenPortalJunctionRadiusMeters = 0.15;
export const forbiddenPortalJunctionHeightMeters = Infinity;

export interface PortalJunction {
  readonly id: string;
  readonly adjacentPortalIds: readonly string[];
  readonly position: { readonly x: number; readonly y: number };
}

export interface ForbiddenZone {
  readonly junctionId: string;
  readonly collision: SingularityCollisionCylinder;
}

export interface SingularityCollisionCylinder {
  readonly kind: "invisible-cylinder";
  readonly junctionId: string;
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly radius: number;
  readonly height: number;
}

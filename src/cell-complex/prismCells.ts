import type { AuthoredPortalSpec, CellObjectSpec, CompiledPortal, FloorMaterialSpec, PrismCellSpec } from "./specs";
import {
  forbiddenPortalJunctionRadiusMeters,
  type ForbiddenZone,
  type PortalJunction,
  type SingularityCollisionColumn,
} from "./forbiddenZones";

export interface CompiledPrismCellGeometry {
  readonly id: string;
  readonly heightMeters: number;
  readonly isConvex: true;
  readonly sideCount: number;
  readonly baseVertices: readonly { readonly x: number; readonly y: number }[];
  readonly sides: readonly CompiledPrismSide[];
  readonly portalJunctions: readonly PortalJunction[];
  readonly singularityColumns: readonly SingularityCollisionColumn[];
  readonly forbiddenZones: readonly ForbiddenZone[];
  readonly floorColor: string;
  readonly floorMaterial: FloorMaterialSpec;
  readonly objects: readonly CellObjectSpec[];
}

export interface CompiledPrismCell extends CompiledPrismCellGeometry {
  readonly portals: readonly CompiledPortal[];
  readonly portalsById: ReadonlyMap<string, CompiledPortal>;
  readonly portalBySideIndex: ReadonlyMap<number, CompiledPortal>;
}

export interface CompiledPrismSide {
  readonly sideIndex: number;
  readonly start: { readonly x: number; readonly y: number };
  readonly end: { readonly x: number; readonly y: number };
  readonly inwardNormal: { readonly x: number; readonly y: number };
  readonly lengthMeters: number;
  readonly portal?: CompiledPortal;
}

export function compilePrismCellGeometry(spec: PrismCellSpec): CompiledPrismCellGeometry {
  const sides = spec.baseVertices.map((start, sideIndex): CompiledPrismSide => {
    const end = spec.baseVertices[(sideIndex + 1) % spec.baseVertices.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthMeters = Math.hypot(dx, dy);

    return {
      sideIndex,
      start,
      end,
      inwardNormal: {
        x: -dy / lengthMeters,
        y: dx / lengthMeters,
      },
      lengthMeters,
    };
  });
  const portalJunctions = compilePortalJunctions(spec);
  const singularityColumns = portalJunctions.map((junction) => ({
      kind: "invisible-column" as const,
      junctionId: junction.id,
      center: {
        x: junction.position.x,
        y: junction.position.y,
        z: spec.heightMeters / 2,
      },
      radiusMeters: forbiddenPortalJunctionRadiusMeters,
      heightMeters: spec.heightMeters,
  }));
  const forbiddenZones = singularityColumns.map((column) => ({
    junctionId: column.junctionId,
    collision: column,
  }));

  return {
    id: spec.id,
    heightMeters: spec.heightMeters,
    isConvex: true,
    sideCount: spec.baseVertices.length,
    baseVertices: spec.baseVertices,
    sides,
    portalJunctions,
    singularityColumns,
    forbiddenZones,
    floorColor: spec.visuals?.floorColor ?? "#3f6f7a",
    floorMaterial: spec.visuals?.floorMaterial ?? {
      kind: "floor-color",
      floorColor: spec.visuals?.floorColor ?? "#3f6f7a",
    },
    objects: spec.visuals?.objects ?? [],
  };
}

export function linkCompiledPrismCellPortals(
  geometry: CompiledPrismCellGeometry,
  portals: readonly CompiledPortal[],
): CompiledPrismCell {
  const portalsById = new Map(portals.map((portal) => [portal.id, portal]));
  const portalBySideIndex = new Map(portals.map((portal) => [portal.sideIndex, portal]));

  return {
    ...geometry,
    portals,
    portalsById,
    portalBySideIndex,
    sides: geometry.sides.map((side) => ({
      ...side,
      portal: portalBySideIndex.get(side.sideIndex),
    })),
  };
}

function compilePortalJunctions(spec: PrismCellSpec): readonly PortalJunction[] {
  const portalIdsByVertexIndex = new Map<number, string[]>();

  for (const portal of spec.portals) {
    addPortalJunctionSide(portalIdsByVertexIndex, portal.sideIndex, portal.id);
    addPortalJunctionSide(portalIdsByVertexIndex, (portal.sideIndex + 1) % spec.baseVertices.length, portal.id);
  }

  return [...portalIdsByVertexIndex.entries()]
    .filter(([, portalIds]) => portalIds.length > 0)
    .map(([vertexIndex, portalIds]) => {
      const vertex = spec.baseVertices[vertexIndex];

      return {
        id: `${spec.id}:vertex-${vertexIndex}`,
        position: vertex,
        adjacentPortalIds: [...new Set(portalIds)].sort(),
      };
    });
}

function addPortalJunctionSide(
  portalIdsByVertexIndex: Map<number, string[]>,
  vertexIndex: number,
  portalId: AuthoredPortalSpec["id"],
): void {
  const portalIds = portalIdsByVertexIndex.get(vertexIndex);

  if (portalIds) {
    portalIds.push(portalId);
    return;
  }

  portalIdsByVertexIndex.set(vertexIndex, [portalId]);
}

import type { CellObjectSpec, PortalSpec, PrismCellSpec } from "./specs";
import {
  forbiddenPortalJunctionRadiusMeters,
  type ForbiddenZone,
  type PortalJunction,
  type SingularityCollisionColumn,
} from "./forbiddenZones";

export interface CompiledPrismCell {
  readonly id: string;
  readonly heightMeters: number;
  readonly sideCount: number;
  readonly baseVertices: readonly { readonly x: number; readonly z: number }[];
  readonly portals: readonly PortalSpec[];
  readonly portalsById: ReadonlyMap<string, PortalSpec>;
  readonly portalBySideIndex: ReadonlyMap<number, PortalSpec>;
  readonly sides: readonly CompiledPrismSide[];
  readonly portalJunctions: readonly PortalJunction[];
  readonly singularityColumns: readonly SingularityCollisionColumn[];
  readonly forbiddenZones: readonly ForbiddenZone[];
  readonly floorColor: string;
  readonly objects: readonly CellObjectSpec[];
}

export interface CompiledPrismSide {
  readonly sideIndex: number;
  readonly start: { readonly x: number; readonly z: number };
  readonly end: { readonly x: number; readonly z: number };
  readonly inwardNormal: { readonly x: number; readonly z: number };
  readonly lengthMeters: number;
  readonly portal?: PortalSpec;
}

export function compilePrismCell(spec: PrismCellSpec): CompiledPrismCell {
  const portalsById = new Map(spec.portals.map((portal) => [portal.id, portal]));
  const portalBySideIndex = new Map(spec.portals.map((portal) => [portal.sideIndex, portal]));
  const sides = spec.baseVertices.map((start, sideIndex): CompiledPrismSide => {
    const end = spec.baseVertices[(sideIndex + 1) % spec.baseVertices.length];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthMeters = Math.hypot(dx, dz);

    return {
      sideIndex,
      start,
      end,
      inwardNormal: {
        x: -dz / lengthMeters,
        z: dx / lengthMeters,
      },
      lengthMeters,
      portal: portalBySideIndex.get(sideIndex),
    };
  });
  const portalJunctions = compilePortalJunctions(spec);
  const singularityColumns = portalJunctions.map((junction) => ({
      kind: "invisible-column" as const,
      junctionId: junction.id,
      center: {
        x: junction.position.x,
        y: spec.heightMeters / 2,
        z: junction.position.z,
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
    sideCount: spec.baseVertices.length,
    baseVertices: spec.baseVertices,
    portals: spec.portals,
    portalsById,
    portalBySideIndex,
    sides,
    portalJunctions,
    singularityColumns,
    forbiddenZones,
    floorColor: spec.visuals?.floorColor ?? "#3f6f7a",
    objects: spec.visuals?.objects ?? [],
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
  portalId: string,
): void {
  const portalIds = portalIdsByVertexIndex.get(vertexIndex);

  if (portalIds) {
    portalIds.push(portalId);
    return;
  }

  portalIdsByVertexIndex.set(vertexIndex, [portalId]);
}

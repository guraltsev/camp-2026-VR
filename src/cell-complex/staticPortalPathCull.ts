import type { CompiledCellComplex } from "./compileCellComplex";
import { forbiddenPortalJunctionRadiusMeters } from "./forbiddenZones";
import {
  createPortalPathTable,
  type PortalPathTable,
  type PortalPathTablesByRootCell,
  type PortalRenderPath,
} from "./portalPaths";
import type { CompiledPrismSide } from "./prismCells";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  transformPoint3,
  type RigidTransform3,
} from "../math/rigidTransform3";
import { dotVec3, normalizeVec3, vec3, type Vec3 } from "../math/vec3";

export interface StaticPortalPathCullOptions {
  readonly toleranceMeters: number;
  readonly maxKeptPathsPerRoot?: number;
  readonly keepRejectedPathDetails?: boolean;
}

export interface StaticPortalPathCullResult {
  readonly tables: PortalPathTablesByRootCell;
  readonly summariesByRootCellId: ReadonlyMap<string, StaticPortalPathCullSummary>;
}

export interface StaticPortalPathCullSummary {
  readonly rootCellId: string;
  readonly inputPathCount: number;
  readonly keptPathCount: number;
  readonly rejectedPathCount: number;
  readonly rejectedByReason: ReadonlyMap<StaticPortalPathRejectReason, number>;
  readonly rejectedPaths: readonly RejectedPortalRenderPath[];
}

export type StaticPortalPathRejectReason =
  | "outside-ancestor-portal-plane"
  | "outside-ancestor-portal-slab"
  | "outside-ancestor-vertical-range"
  | "static-path-budget";

export interface RejectedPortalRenderPath {
  readonly pathId: number;
  readonly reason: StaticPortalPathRejectReason;
  readonly details?: string;
}

export function staticallyCullPortalPathTables(
  world: CompiledCellComplex,
  pathTables: PortalPathTablesByRootCell,
  options: StaticPortalPathCullOptions,
): StaticPortalPathCullResult {
  if (options.toleranceMeters < 0) {
    throw new Error(`Static portal path cull tolerance must be non-negative; received ${options.toleranceMeters}.`);
  }

  const tablesByRootCellId = new Map<string, PortalPathTable>();
  const summariesByRootCellId = new Map<string, StaticPortalPathCullSummary>();

  for (const [rootCellId, table] of pathTables.tablesByRootCellId) {
    if (!world.cellsById.has(rootCellId)) {
      throw new Error(`Static portal path culling received unknown root cell "${rootCellId}".`);
    }

    const keptPaths: PortalRenderPath[] = [];
    const rejectedPaths: RejectedPortalRenderPath[] = [];
    const rejectedByReason = new Map<StaticPortalPathRejectReason, number>();
    const budget = options.maxKeptPathsPerRoot ?? Number.POSITIVE_INFINITY;
    const cullTolerance = Math.max(options.toleranceMeters, forbiddenPortalJunctionRadiusMeters / 2);

    for (const path of table.paths) {
      const geometricRejection =
        path.depth === 0 ? undefined : rejectGeometrically(world, path, cullTolerance, options.keepRejectedPathDetails);
      const budgetRejection =
        path.depth > 0 && !geometricRejection && keptPaths.length >= budget
          ? createRejection(path.id, "static-path-budget", options.keepRejectedPathDetails)
          : undefined;
      const rejection = geometricRejection ?? budgetRejection;

      if (rejection) {
        rejectedPaths.push(rejection);
        rejectedByReason.set(rejection.reason, (rejectedByReason.get(rejection.reason) ?? 0) + 1);
        continue;
      }

      keptPaths.push(path);
    }

    tablesByRootCellId.set(rootCellId, createPortalPathTable(rootCellId, table.maxDepth, keptPaths));
    summariesByRootCellId.set(rootCellId, {
      rootCellId,
      inputPathCount: table.paths.length,
      keptPathCount: keptPaths.length,
      rejectedPathCount: rejectedPaths.length,
      rejectedByReason,
      rejectedPaths: options.keepRejectedPathDetails ? rejectedPaths : rejectedPaths.map(stripRejectionDetails),
    });
  }

  return {
    tables: {
      maxDepth: pathTables.maxDepth,
      tablesByRootCellId,
    },
    summariesByRootCellId,
  };
}

function rejectGeometrically(
  world: CompiledCellComplex,
  path: PortalRenderPath,
  toleranceMeters: number,
  includeDetails: boolean | undefined,
): RejectedPortalRenderPath | undefined {
  const destinationCell = world.cellsById.get(path.destinationCellId);

  if (!destinationCell) {
    throw new Error(`Static portal path culling reached missing destination cell "${path.destinationCellId}".`);
  }

  const boundInRoot = prismBoundVertices(destinationCell.baseVertices, destinationCell.heightMeters).map((point) =>
    transformPoint3(path.rootFromDestination, point),
  );
  let sourceFromRoot: RigidTransform3 = identityRigidTransform3;

  for (const step of path.steps) {
    const sourceCell = world.cellsById.get(step.sourceCellId);
    const portal = sourceCell?.portalsById.get(step.sourcePortalId);

    if (!sourceCell || !portal) {
      throw new Error(`Static portal path culling reached missing portal "${step.sourceCellId}:${step.sourcePortalId}".`);
    }

    const boundInSource = boundInRoot.map((point) => transformPoint3(sourceFromRoot, point));
    const rejection = rejectAgainstPortalAperture(
      path.id,
      sourceCell.id,
      sourceCell.sides[portal.sideIndex],
      sourceCell.heightMeters,
      boundInSource,
      toleranceMeters,
      includeDetails,
    );

    if (rejection) {
      return rejection;
    }

    sourceFromRoot = composeRigidTransform3(portal.transformToTarget, sourceFromRoot);
  }

  return undefined;
}

function rejectAgainstPortalAperture(
  pathId: number,
  sourceCellId: string,
  side: CompiledPrismSide,
  sourceCellHeightMeters: number,
  boundInSource: readonly Vec3[],
  toleranceMeters: number,
  includeDetails: boolean | undefined,
): RejectedPortalRenderPath | undefined {
  const sideStart = vec3(side.start.x, 0, side.start.z);
  const sideEnd = vec3(side.end.x, 0, side.end.z);
  const tangent = normalizeVec3(vec3(sideEnd.x - sideStart.x, 0, sideEnd.z - sideStart.z));
  const lengthMeters = Math.hypot(sideEnd.x - sideStart.x, sideEnd.z - sideStart.z);
  const inwardNormal = vec3(side.inwardNormal.x, 0, side.inwardNormal.z);
  const planeDistances = boundInSource.map((point) =>
    (point.x - sideStart.x) * inwardNormal.x + (point.z - sideStart.z) * inwardNormal.z,
  );

  if (planeDistances.every((distance) => distance > toleranceMeters)) {
    return createGeometricRejection(
      pathId,
      "outside-ancestor-portal-plane",
      includeDetails,
      `${sourceCellId}:side-${side.sideIndex}`,
    );
  }

  const slabCoordinates = boundInSource.map((point) => dotVec3(vec3(point.x - sideStart.x, 0, point.z - sideStart.z), tangent));

  if (
    slabCoordinates.every((coordinate) => coordinate < -toleranceMeters) ||
    slabCoordinates.every((coordinate) => coordinate > lengthMeters + toleranceMeters)
  ) {
    return createGeometricRejection(
      pathId,
      "outside-ancestor-portal-slab",
      includeDetails,
      `${sourceCellId}:side-${side.sideIndex}`,
    );
  }

  if (
    boundInSource.every((point) => point.y < -toleranceMeters) ||
    boundInSource.every((point) => point.y > sourceCellHeightMeters + toleranceMeters)
  ) {
    return createGeometricRejection(
      pathId,
      "outside-ancestor-vertical-range",
      includeDetails,
      `${sourceCellId}:side-${side.sideIndex}`,
    );
  }

  return undefined;
}

function prismBoundVertices(
  baseVertices: readonly { readonly x: number; readonly z: number }[],
  heightMeters: number,
): readonly Vec3[] {
  return baseVertices.flatMap((vertex) => [vec3(vertex.x, 0, vertex.z), vec3(vertex.x, heightMeters, vertex.z)]);
}

function createGeometricRejection(
  pathId: number,
  reason: StaticPortalPathRejectReason,
  includeDetails: boolean | undefined,
  portalLabel: string,
): RejectedPortalRenderPath {
  return {
    pathId,
    reason,
    ...(includeDetails ? { details: `Rejected path ${pathId} against ancestor portal ${portalLabel}.` } : {}),
  };
}

function createRejection(
  pathId: number,
  reason: StaticPortalPathRejectReason,
  includeDetails: boolean | undefined,
): RejectedPortalRenderPath {
  return {
    pathId,
    reason,
    ...(includeDetails ? { details: `Rejected path ${pathId} because the static path budget was exhausted.` } : {}),
  };
}

function stripRejectionDetails(rejection: RejectedPortalRenderPath): RejectedPortalRenderPath {
  return {
    pathId: rejection.pathId,
    reason: rejection.reason,
  };
}

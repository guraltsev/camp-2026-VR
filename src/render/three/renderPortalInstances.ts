import * as THREE from "three";
import type { PortalRenderPath } from "../../cell-complex/portalPaths";
import type { CellRenderArchetype } from "./cellRenderArchetypes";
import type {
  RuntimeObjectRenderArchetype,
  RuntimeObjectRenderArchetypeDiagnostics,
} from "./runtimeObjectRenderArchetypes";
import type { RuntimeObjectRenderRecord } from "./runtimeObjectRenderRecords";
import type { VisiblePortalPath, VisiblePortalPathDebugSummary } from "./visiblePortalPaths";

export interface PortalInstanceRenderDebugState {
  readonly enabled: boolean;
  readonly ShowCellPathRendersInstances: boolean;
  readonly archetypeCount: number;
  readonly totalCapacity: number;
  readonly renderedInstanceCount: number;
  readonly renderedInstanceCountByCell: readonly {
    readonly cellId: string;
    readonly count: number;
  }[];
  readonly capacityOverflowCount: number;
  readonly capacityOverflowArchetypes: readonly string[];
  readonly normalVisiblePathRenderingActive: boolean;
  readonly visiblePathIds: readonly number[];
  readonly visiblePathDestinations: readonly {
    readonly pathId: number;
    readonly destinationCellId: string;
  }[];
  readonly clipPolygonVertexCountsByPath: readonly {
    readonly pathId: number;
    readonly vertexCount: number;
  }[];
  readonly clipPolygonOverflowPathIds: readonly number[];
  readonly visiblePathOverflowCount: number;
}

export interface PortalInstanceDiagnostics {
  reset(): void;
  recordCapacityOverflow(archetype: CellRenderArchetype, requestedCount: number): void;
  readonly capacityOverflowArchetypes: readonly string[];
  readonly capacityOverflowCount: number;
}

const fullScreenPolygonNdc = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
] as const;

export const unclippedPortalClipIndex = -2;

export function createPortalInstanceDiagnostics(): PortalInstanceDiagnostics {
  const capacityOverflowArchetypes = new Set<string>();

  return {
    reset() {
      capacityOverflowArchetypes.clear();
    },
    recordCapacityOverflow(archetype) {
      capacityOverflowArchetypes.add(archetype.archetypeId);
    },
    get capacityOverflowArchetypes() {
      return [...capacityOverflowArchetypes].sort();
    },
    get capacityOverflowCount() {
      return capacityOverflowArchetypes.size;
    },
  };
}

export function createRootVisiblePortalPath(cellId: string): VisiblePortalPath {
  return {
    pathId: 0,
    destinationCellId: cellId,
    depth: 0,
    rootFromDestinationMatrix: new THREE.Matrix4(),
    clipPolygonNdc: fullScreenPolygonNdc,
    clipRectNdc: {
      minX: -1,
      minY: -1,
      maxX: 1,
      maxY: 1,
    },
    screenAreaPixels: Number.POSITIVE_INFINITY,
  };
}

export function groupVisiblePortalPathsByDestinationCell(
  paths: readonly VisiblePortalPath[],
): ReadonlyMap<string, readonly VisiblePortalPath[]> {
  const grouped = new Map<string, VisiblePortalPath[]>();

  for (const path of paths) {
    const existing = grouped.get(path.destinationCellId);

    if (existing) {
      existing.push(path);
      continue;
    }

    grouped.set(path.destinationCellId, [path]);
  }

  return grouped;
}

export function buildVisiblePathsByDestinationCell(
  staticallyKeptPathsByDestinationCell: ReadonlyMap<string, readonly PortalRenderPath[]>,
  visiblePathById: ReadonlyMap<number, VisiblePortalPath>,
): ReadonlyMap<string, readonly VisiblePortalPath[]> {
  const grouped = new Map<string, VisiblePortalPath[]>();

  for (const [destinationCellId, keptPaths] of staticallyKeptPathsByDestinationCell) {
    const visiblePaths: VisiblePortalPath[] = [];

    for (const keptPath of keptPaths) {
      const visiblePath = visiblePathById.get(keptPath.id);

      if (visiblePath) {
        visiblePaths.push(visiblePath);
      }
    }

    if (visiblePaths.length > 0) {
      grouped.set(destinationCellId, visiblePaths);
    }
  }

  return grouped;
}

export function flattenVisiblePortalPathGroups(
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
): readonly VisiblePortalPath[] {
  const visiblePathById = new Map<number, VisiblePortalPath>();

  for (const paths of visiblePathsByDestinationCell.values()) {
    for (const path of paths) {
      visiblePathById.set(path.pathId, path);
    }
  }

  return [...visiblePathById.values()].sort((left, right) => left.pathId - right.pathId);
}

export function updateCellRenderArchetypeInstances(
  archetypes: readonly CellRenderArchetype[],
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  diagnostics: PortalInstanceDiagnostics,
  clipIndexByPathId: ReadonlyMap<number, number> = new Map(),
): void {
  for (const archetype of archetypes) {
    const paths = visiblePathsByDestinationCell.get(archetype.cellId) ?? [];
    const count = Math.min(paths.length, archetype.capacity);

    for (let index = 0; index < count; index += 1) {
      const path = paths[index];
      archetype.mesh.setMatrixAt(index, path.rootFromDestinationMatrix);
      archetype.portalPathIdAttribute.setX(index, path.pathId);
      archetype.portalClipIndexAttribute.setX(
        index,
        path.depth === 0 ? unclippedPortalClipIndex : clipIndexByPathId.get(path.pathId) ?? -1,
      );
    }

    archetype.mesh.count = count;
    archetype.mesh.instanceMatrix.needsUpdate = true;
    archetype.portalPathIdAttribute.needsUpdate = true;
    archetype.portalClipIndexAttribute.needsUpdate = true;

    if (paths.length > archetype.capacity) {
      diagnostics.recordCapacityOverflow(archetype, paths.length);
    }
  }
}

export function updateRuntimeObjectRenderArchetypeInstances(
  archetypes: readonly RuntimeObjectRenderArchetype[],
  recordsByArchetypeKey: ReadonlyMap<string, readonly RuntimeObjectRenderRecord[]>,
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  diagnostics: RuntimeObjectRenderArchetypeDiagnostics,
  clipIndexByPathId: ReadonlyMap<number, number> = new Map(),
): void {
  const composedMatrix = new THREE.Matrix4();

  for (const archetype of archetypes) {
    const records = recordsByArchetypeKey.get(archetype.archetypeKey) ?? [];
    let requestedCount = 0;
    let count = 0;

    for (const record of records) {
      const paths = visiblePathsByDestinationCell.get(record.cellId) ?? [];
      const renderablePaths = record.omitRootVisiblePath
        ? paths.filter((path) => path.depth !== 0)
        : paths;
      requestedCount += renderablePaths.length;

      for (const path of renderablePaths) {
        if (count >= archetype.capacity) {
          continue;
        }

        composedMatrix.multiplyMatrices(path.rootFromDestinationMatrix, record.localMatrix);
        archetype.mesh.setMatrixAt(count, composedMatrix);
        archetype.portalPathIdAttribute.setX(count, path.pathId);
        archetype.portalClipIndexAttribute.setX(
          count,
          path.depth === 0 ? unclippedPortalClipIndex : clipIndexByPathId.get(path.pathId) ?? -1,
        );
        count += 1;
      }
    }

    archetype.mesh.count = count;
    archetype.mesh.instanceMatrix.needsUpdate = true;
    archetype.portalPathIdAttribute.needsUpdate = true;
    archetype.portalClipIndexAttribute.needsUpdate = true;

    if (requestedCount > archetype.capacity) {
      diagnostics.recordCapacityOverflow(archetype, requestedCount);
    }
  }
}

export function createPortalInstanceRenderDebugState(
  archetypes: readonly CellRenderArchetype[],
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  diagnostics: PortalInstanceDiagnostics,
  options: {
    readonly enabled: boolean;
    readonly showCellPathRendersInstances: boolean;
    readonly normalVisiblePathRenderingActive?: boolean;
    readonly visiblePaths?: readonly VisiblePortalPath[];
    readonly clipPolygonVertexCountsByPathId?: ReadonlyMap<number, number>;
    readonly clipPolygonOverflowPathIds?: readonly number[];
    readonly visiblePathOverflowCount?: number;
  },
): PortalInstanceRenderDebugState {
  const totalCapacity = archetypes.reduce((sum, archetype) => sum + archetype.capacity, 0);
  const renderedInstanceCount = archetypes.reduce((sum, archetype) => sum + archetype.mesh.count, 0);
  const countsByCell = new Map<string, number>();

  for (const archetype of archetypes) {
    countsByCell.set(archetype.cellId, (countsByCell.get(archetype.cellId) ?? 0) + archetype.mesh.count);
  }

  for (const [cellId, paths] of visiblePathsByDestinationCell) {
    if (countsByCell.has(cellId)) {
      continue;
    }

    countsByCell.set(cellId, paths.length);
  }

  return {
    enabled: options.enabled,
    ShowCellPathRendersInstances: options.showCellPathRendersInstances,
    archetypeCount: archetypes.length,
    totalCapacity,
    renderedInstanceCount,
    renderedInstanceCountByCell: [...countsByCell.entries()]
      .filter(([, count]) => count > 0)
      .map(([cellId, count]) => ({ cellId, count }))
      .sort((left, right) => left.cellId.localeCompare(right.cellId)),
    capacityOverflowCount: diagnostics.capacityOverflowCount,
    capacityOverflowArchetypes: diagnostics.capacityOverflowArchetypes,
    normalVisiblePathRenderingActive: options.normalVisiblePathRenderingActive ?? false,
    visiblePathIds: (options.visiblePaths ?? []).map((path) => path.pathId),
    visiblePathDestinations: (options.visiblePaths ?? []).map((path) => ({
      pathId: path.pathId,
      destinationCellId: path.destinationCellId,
    })),
    clipPolygonVertexCountsByPath: [...(options.clipPolygonVertexCountsByPathId ?? new Map()).entries()]
      .map(([pathId, vertexCount]) => ({ pathId, vertexCount }))
      .sort((left, right) => left.pathId - right.pathId),
    clipPolygonOverflowPathIds: options.clipPolygonOverflowPathIds ?? [],
    visiblePathOverflowCount: options.visiblePathOverflowCount ?? 0,
  };
}

export function visiblePortalSummaryToRenderState(summary: VisiblePortalPathDebugSummary) {
  return {
    candidatePathCount: summary.candidatePathCount,
    keptPathCount: summary.keptPathCount,
    visiblePathCount: summary.visiblePathCount,
    visiblePathCountByDepth: summary.visiblePathCountByDepth,
    maxVisibleDepth: summary.maxVisibleDepth,
    clippedByCameraCount: summary.clippedByCameraCount,
    clippedByAreaCount: summary.clippedByAreaCount,
    clippedByBudgetCount: summary.clippedByBudgetCount,
    budgetExhausted: summary.budgetExhausted,
  };
}

import * as THREE from "three";
import type { CellRenderArchetype } from "./cellRenderArchetypes";
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

export function updateCellRenderArchetypeInstances(
  archetypes: readonly CellRenderArchetype[],
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  diagnostics: PortalInstanceDiagnostics,
): void {
  for (const archetype of archetypes) {
    const paths = visiblePathsByDestinationCell.get(archetype.cellId) ?? [];
    const count = Math.min(paths.length, archetype.capacity);

    for (let index = 0; index < count; index += 1) {
      archetype.mesh.setMatrixAt(index, paths[index].rootFromDestinationMatrix);
    }

    archetype.mesh.count = count;
    archetype.mesh.instanceMatrix.needsUpdate = true;

    if (paths.length > archetype.capacity) {
      diagnostics.recordCapacityOverflow(archetype, paths.length);
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

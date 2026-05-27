import type { CompiledCellComplex } from "./compileCellComplex";
import type { PortalPathTable, PortalPathTablesByRootCell, PortalRenderStep } from "./portalPaths";
import type {
  StaticPortalPathCullSummary,
  StaticPortalPathRejectReason,
  StaticPortalPathCullResult,
} from "./staticPortalPathCull";

export interface PortalPathDebugState {
  readonly currentRootCellId: string;
  readonly maxDepth: number;
  readonly candidatePathCount: number;
  readonly keptPathCount: number;
  readonly rejectedPathCountByReason: ReadonlyMap<StaticPortalPathRejectReason, number>;
  readonly maximumAvailablePathDepth: number;
  readonly staticPathBudgetExhausted: boolean;
}

export interface PortalPathCheckContext {
  readonly world: CompiledCellComplex;
  readonly rootCellId: string;
  readonly candidateTables: PortalPathTablesByRootCell;
  readonly keptTables?: PortalPathTablesByRootCell;
  readonly cullSummariesByRootCellId?: ReadonlyMap<string, StaticPortalPathCullSummary>;
}

export interface PortalPathCheckResult {
  readonly parsed: boolean;
  readonly requestedPortalIndices: readonly number[];
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly rootCellId: string;
  readonly destinationCellId?: string;
  readonly steps: readonly PortalRenderStep[];
  readonly matchedPathId?: number;
  readonly existsInBuiltTable: boolean;
  readonly survivedStaticCull: boolean;
  readonly rejectionReason?: StaticPortalPathRejectReason;
}

export function createPortalPathDebugState(
  rootCellId: string,
  candidateTables: PortalPathTablesByRootCell,
  staticCull?: StaticPortalPathCullResult,
): PortalPathDebugState {
  const candidateTable = candidateTables.tablesByRootCellId.get(rootCellId);
  const keptTable = staticCull?.tables.tablesByRootCellId.get(rootCellId) ?? candidateTable;
  const summary = staticCull?.summariesByRootCellId.get(rootCellId);
  const rejectedPathCountByReason = summary?.rejectedByReason ?? new Map<StaticPortalPathRejectReason, number>();

  return {
    currentRootCellId: rootCellId,
    maxDepth: candidateTables.maxDepth,
    candidatePathCount: candidateTable?.paths.length ?? 0,
    keptPathCount: keptTable?.paths.length ?? 0,
    rejectedPathCountByReason,
    maximumAvailablePathDepth: Math.max(0, ...(candidateTable?.paths.map((path) => path.depth) ?? [0])),
    staticPathBudgetExhausted: (rejectedPathCountByReason.get("static-path-budget") ?? 0) > 0,
  };
}

export function checkPortalPathString(pathText: string, context: PortalPathCheckContext): PortalPathCheckResult {
  const parsed = parsePortalPathText(pathText);

  if (!parsed.ok) {
    return {
      parsed: false,
      requestedPortalIndices: [],
      valid: false,
      errors: parsed.errors,
      rootCellId: context.rootCellId,
      steps: [],
      existsInBuiltTable: false,
      survivedStaticCull: false,
    };
  }

  const candidateTable = context.candidateTables.tablesByRootCellId.get(context.rootCellId);
  const keptTable = context.keptTables?.tablesByRootCellId.get(context.rootCellId) ?? candidateTable;
  const steps: PortalRenderStep[] = [];
  const errors: string[] = [];
  let currentCellId = context.rootCellId;

  for (const portalIndex of parsed.indices) {
    const cell = context.world.cellsById.get(currentCellId);
    const portal = cell?.portalBySideIndex.get(portalIndex) ?? cell?.portals[portalIndex];

    if (!cell || !portal) {
      errors.push(`No portal "${portalIndex}" from cell "${currentCellId}".`);
      break;
    }

    steps.push({
      sourceCellId: cell.id,
      sourcePortalId: portal.id,
      sourcePortalSideIndex: portal.sideIndex,
      targetCellId: portal.targetCellId,
      targetPortalId: portal.targetPortalId,
    });
    currentCellId = portal.targetCellId;
  }

  const matchedPath = errors.length === 0 && candidateTable ? findMatchingPath(candidateTable, steps) : undefined;
  const keptPath = matchedPath && keptTable ? keptTable.pathsById.get(matchedPath.id) : undefined;
  const rejectedPath = matchedPath
    ? context.cullSummariesByRootCellId
        ?.get(context.rootCellId)
        ?.rejectedPaths.find((path) => path.pathId === matchedPath.id)
    : undefined;

  return {
    parsed: true,
    requestedPortalIndices: parsed.indices,
    valid: errors.length === 0,
    errors,
    rootCellId: context.rootCellId,
    destinationCellId: errors.length === 0 ? currentCellId : undefined,
    steps,
    matchedPathId: matchedPath?.id,
    existsInBuiltTable: matchedPath !== undefined,
    survivedStaticCull: keptPath !== undefined,
    rejectionReason: rejectedPath?.reason,
  };
}

function parsePortalPathText(pathText: string): { readonly ok: true; readonly indices: readonly number[] } | { readonly ok: false; readonly errors: readonly string[] } {
  const trimmed = pathText.trim();

  if (!trimmed) {
    return { ok: true, indices: [] };
  }

  const indices: number[] = [];
  const errors: string[] = [];

  for (const token of trimmed.split(/\s+/)) {
    const value = Number(token);

    if (!Number.isInteger(value) || value < 0) {
      errors.push(`Portal path token "${token}" is not a non-negative integer.`);
      continue;
    }

    indices.push(value);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, indices };
}

function findMatchingPath(table: PortalPathTable, steps: readonly PortalRenderStep[]) {
  return table.paths.find((path) => {
    if (path.steps.length !== steps.length) {
      return false;
    }

    return path.steps.every((step, index) => {
      const expected = steps[index];

      return (
        step.sourceCellId === expected.sourceCellId &&
        step.sourcePortalId === expected.sourcePortalId &&
        step.targetCellId === expected.targetCellId &&
        step.targetPortalId === expected.targetPortalId
      );
    });
  });
}

import type { CompiledCellComplex } from "./compileCellComplex";
import type { CompiledPortal } from "./specs";
import {
  composeRigidTransform3,
  identityRigidTransform3,
  invertRigidTransform3,
  type RigidTransform3,
} from "../math/rigidTransform3";

export interface BuildPortalPathTablesOptions {
  readonly maxDepth: number;
  readonly skipImmediateReverse?: boolean;
}

export interface PortalPathTablesByRootCell {
  readonly maxDepth: number;
  readonly tablesByRootCellId: ReadonlyMap<string, PortalPathTable>;
}

export interface PortalPathTable {
  readonly rootCellId: string;
  readonly maxDepth: number;
  readonly paths: readonly PortalRenderPath[];
  readonly pathsById: ReadonlyMap<number, PortalRenderPath>;
  readonly pathsByDestinationCellId: ReadonlyMap<string, readonly PortalRenderPath[]>;
  readonly pathsByParentPathId: ReadonlyMap<number, readonly PortalRenderPath[]>;
}

export interface PortalRenderPath {
  readonly id: number;
  readonly rootCellId: string;
  readonly destinationCellId: string;
  readonly depth: number;
  readonly parentPathId?: number;
  readonly steps: readonly PortalRenderStep[];
  readonly destinationFromRoot: RigidTransform3;
  readonly rootFromDestination: RigidTransform3;
}

export interface PortalRenderStep {
  readonly sourceCellId: string;
  readonly sourcePortalId: string;
  readonly sourcePortalSideIndex: number;
  readonly targetCellId: string;
  readonly targetPortalId: string;
}

export function buildPortalPathTables(
  world: CompiledCellComplex,
  options: BuildPortalPathTablesOptions,
): PortalPathTablesByRootCell {
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new Error(`Portal path maxDepth must be a non-negative integer; received ${options.maxDepth}.`);
  }

  const skipImmediateReverse = options.skipImmediateReverse ?? true;
  const tablesByRootCellId = new Map(
    world.cells.map((cell) => [
      cell.id,
      buildPortalPathTableForRoot(world, cell.id, options.maxDepth, skipImmediateReverse),
    ]),
  );

  return {
    maxDepth: options.maxDepth,
    tablesByRootCellId,
  };
}

export function createPortalPathTable(
  rootCellId: string,
  maxDepth: number,
  paths: readonly PortalRenderPath[],
): PortalPathTable {
  const pathsById = new Map(paths.map((path) => [path.id, path]));
  const pathsByDestinationCellId = new Map<string, PortalRenderPath[]>();
  const pathsByParentPathId = new Map<number, PortalRenderPath[]>();

  for (const path of paths) {
    pushMapValue(pathsByDestinationCellId, path.destinationCellId, path);

    if (path.parentPathId !== undefined) {
      pushMapValue(pathsByParentPathId, path.parentPathId, path);
    }
  }

  return {
    rootCellId,
    maxDepth,
    paths,
    pathsById,
    pathsByDestinationCellId,
    pathsByParentPathId,
  };
}

function buildPortalPathTableForRoot(
  world: CompiledCellComplex,
  rootCellId: string,
  maxDepth: number,
  skipImmediateReverse: boolean,
): PortalPathTable {
  const rootPath: PortalRenderPath = {
    id: 0,
    rootCellId,
    destinationCellId: rootCellId,
    depth: 0,
    steps: [],
    destinationFromRoot: identityRigidTransform3,
    rootFromDestination: identityRigidTransform3,
  };
  const paths: PortalRenderPath[] = [rootPath];
  const queue: PortalRenderPath[] = [rootPath];

  while (queue.length > 0) {
    const parent = queue.shift()!;

    if (parent.depth >= maxDepth) {
      continue;
    }

    const sourceCell = world.cellsById.get(parent.destinationCellId);

    if (!sourceCell) {
      throw new Error(`Portal path reached missing cell "${parent.destinationCellId}".`);
    }

    for (const portal of sourceCell.portals) {
      if (skipImmediateReverse && isImmediateReverse(parent, portal)) {
        continue;
      }

      const destinationFromRoot = composeRigidTransform3(portal.transformToTarget, parent.destinationFromRoot);
      const child: PortalRenderPath = {
        id: paths.length,
        rootCellId,
        destinationCellId: portal.targetCellId,
        depth: parent.depth + 1,
        parentPathId: parent.id,
        steps: [
          ...parent.steps,
          {
            sourceCellId: sourceCell.id,
            sourcePortalId: portal.id,
            sourcePortalSideIndex: portal.sideIndex,
            targetCellId: portal.targetCellId,
            targetPortalId: portal.targetPortalId,
          },
        ],
        destinationFromRoot,
        rootFromDestination: invertRigidTransform3(destinationFromRoot),
      };

      paths.push(child);
      queue.push(child);
    }
  }

  return createPortalPathTable(rootCellId, maxDepth, paths);
}

function isImmediateReverse(parent: PortalRenderPath, portal: CompiledPortal): boolean {
  const previousStep = parent.steps[parent.steps.length - 1];

  if (!previousStep) {
    return false;
  }

  return (
    parent.destinationCellId === previousStep.targetCellId &&
    portal.id === previousStep.targetPortalId &&
    portal.targetCellId === previousStep.sourceCellId &&
    portal.reciprocalPortalId === previousStep.sourcePortalId
  );
}

function pushMapValue<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue): void {
  const current = map.get(key);

  if (current) {
    current.push(value);
    return;
  }

  map.set(key, [value]);
}

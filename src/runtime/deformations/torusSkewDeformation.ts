import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { CellComplexSpec, PrismCellSpec } from "../../cell-complex/specs";
import { vec3, type Vec3 } from "../../math/vec3";
import {
  applyPrismBaseReplacements,
  transformCellObjectsWithMaps,
  transformStartingPositionWithMap,
  validateTopologyPreservingSnapshot,
  type CellDeformationMap,
  type DynamicGeometryStepOptions,
  type WorldDeformationFamily,
} from "../worldGeometryDeformations";

export interface TorusSkewDeformationState {
  readonly kind: "torus-skew";
  readonly cellId: "torus-room";
  readonly widthMeters: number;
  readonly depthMeters: number;
  readonly skewXMeters: number;
}

interface TorusLatticeFrame {
  readonly origin: { readonly x: number; readonly y: number };
  readonly u: { readonly x: number; readonly y: number };
  readonly v: { readonly x: number; readonly y: number };
}

const torusCellId = "torus-room";
const expectedPortalPairs = [
  ["side-0", 0, "side-2"],
  ["side-1", 1, "side-3"],
  ["side-2", 2, "side-0"],
  ["side-3", 3, "side-1"],
] as const;
const dimensionToleranceMeters = 1e-6;

export const defaultTorusSkewDeformationState: TorusSkewDeformationState = {
  kind: "torus-skew",
  cellId: torusCellId,
  widthMeters: 15,
  depthMeters: 15,
  skewXMeters: 0,
};

export function createTorusSkewDeformationFamily(): WorldDeformationFamily<TorusSkewDeformationState> {
  return {
    kind: "torus-skew",
    canApplyToSpec(baseSpec) {
      return validateTorusSkewBaseSpec(baseSpec).length === 0;
    },
    normalizeState(baseSpec, state) {
      const inferred = inferTorusSkewState(baseSpec);
      return normalizeTorusSkewState({
        ...state,
        cellId: torusCellId,
        widthMeters: state.widthMeters || inferred.widthMeters,
        depthMeters: state.depthMeters || inferred.depthMeters,
      });
    },
    applyToSpec(baseSpec, state) {
      const errors = validateTorusSkewBaseSpec(baseSpec);
      if (errors.length > 0) {
        throw new Error(`Cannot apply torus skew deformation:\n${errors.map((error) => `- ${error}`).join("\n")}`);
      }

      const normalized = normalizeTorusSkewState(state);
      const baseState = inferTorusSkewState(baseSpec);
      const mapsByCellId = createTorusSkewCellDeformationMaps(baseState, normalized);
      const replaced = applyPrismBaseReplacements(baseSpec, [
        {
          cellId: normalized.cellId,
          baseVertices: buildTorusParallelogramVertices(normalized),
        },
      ]);

      return {
        ...replaced,
        startingPosition: transformStartingPositionWithMap(baseSpec.startingPosition, mapsByCellId),
        cells: replaced.cells.map((cell) => transformCellObjectsWithMaps(cell, mapsByCellId)),
      };
    },
    createDynamicObjectMaps(previous, next) {
      return createTorusSkewCellDeformationMaps(previous, next);
    },
    nextStep(current, target, options) {
      return nextTorusSkewStep(current, target, options);
    },
    validateSnapshot(previousWorld, nextWorld) {
      return [
        ...validateTopologyPreservingSnapshot(previousWorld, nextWorld),
        ...validateCompiledTorusSkewSnapshot(nextWorld),
      ];
    },
  };
}

export function buildTorusParallelogramVertices(
  state: Pick<TorusSkewDeformationState, "widthMeters" | "depthMeters" | "skewXMeters">,
): readonly { readonly x: number; readonly y: number }[] {
  const u = { x: state.widthMeters, y: 0 };
  const v = { x: state.skewXMeters, y: state.depthMeters };

  return [
    { x: -0.5 * u.x - 0.5 * v.x, y: -0.5 * u.y - 0.5 * v.y },
    { x: 0.5 * u.x - 0.5 * v.x, y: 0.5 * u.y - 0.5 * v.y },
    { x: 0.5 * u.x + 0.5 * v.x, y: 0.5 * u.y + 0.5 * v.y },
    { x: -0.5 * u.x + 0.5 * v.x, y: -0.5 * u.y + 0.5 * v.y },
  ];
}

export function createTorusSkewCellDeformationMaps(
  previous: TorusSkewDeformationState,
  next: TorusSkewDeformationState,
): ReadonlyMap<string, CellDeformationMap> {
  const previousFrame = torusLatticeFrame(previous);
  const nextFrame = torusLatticeFrame(next);

  return new Map([
    [
      torusCellId,
      {
        cellId: torusCellId,
        mapPoint(point) {
          const coordinates = latticeCoordinates(previousFrame, point);
          return vec3(
            nextFrame.origin.x + coordinates.alpha * nextFrame.u.x + coordinates.beta * nextFrame.v.x,
            nextFrame.origin.y + coordinates.alpha * nextFrame.u.y + coordinates.beta * nextFrame.v.y,
            point.z,
          );
        },
        mapDirection(direction) {
          const coordinates = latticeDirectionCoordinates(previousFrame, direction);
          return vec3(
            coordinates.alpha * nextFrame.u.x + coordinates.beta * nextFrame.v.x,
            coordinates.alpha * nextFrame.u.y + coordinates.beta * nextFrame.v.y,
            direction.z,
          );
        },
      },
    ],
  ]);
}

export function nextTorusSkewStep(
  current: TorusSkewDeformationState,
  target: TorusSkewDeformationState,
  options: DynamicGeometryStepOptions,
): TorusSkewDeformationState {
  const maxStepMeters = Math.max(0, options.maxStepMeters);
  const snapToleranceMeters = options.snapToleranceMeters ?? 1e-9;
  const delta = target.skewXMeters - current.skewXMeters;

  if (Math.abs(delta) <= Math.max(maxStepMeters, snapToleranceMeters)) {
    return normalizeTorusSkewState(target);
  }

  return normalizeTorusSkewState({
    ...current,
    widthMeters: target.widthMeters,
    depthMeters: target.depthMeters,
    skewXMeters: current.skewXMeters + Math.sign(delta) * maxStepMeters,
  });
}

export function validateTorusSkewBaseSpec(baseSpec: CellComplexSpec): readonly string[] {
  const errors: string[] = [];
  const cell = baseSpec.cells.find((candidate) => candidate.id === torusCellId);

  if (!cell) {
    return [`Expected a "${torusCellId}" cell.`];
  }

  if (baseSpec.cells.length !== 1) {
    errors.push(`Expected torus skew to apply to one cell, found ${baseSpec.cells.length}.`);
  }

  if (cell.baseVertices.length !== 4) {
    errors.push(`Expected "${torusCellId}" to have 4 base vertices, found ${cell.baseVertices.length}.`);
  }

  for (const [portalId, sideIndex, targetPortalId] of expectedPortalPairs) {
    const portal = cell.portals.find((candidate) => candidate.id === portalId);
    if (!portal) {
      errors.push(`Expected portal "${torusCellId}:${portalId}".`);
      continue;
    }

    if (
      portal.sideIndex !== sideIndex ||
      portal.targetCellId !== torusCellId ||
      portal.targetPortalId !== targetPortalId
    ) {
      errors.push(`Portal "${torusCellId}:${portalId}" does not match the torus side pairing.`);
    }
  }

  if (cell.heightMeters <= 0 || !Number.isFinite(cell.heightMeters)) {
    errors.push(`Cell "${torusCellId}" must have a finite positive height.`);
  }

  return errors;
}

export function inferTorusSkewState(baseSpec: CellComplexSpec): TorusSkewDeformationState {
  const cell = requireTorusCell(baseSpec);
  const vertices = cell.baseVertices;
  const bottom = subtract2(vertices[1], vertices[0]);
  const left = subtract2(vertices[3], vertices[0]);
  const widthMeters = length2(bottom);
  const depthMeters = left.y;
  const skewXMeters = left.x;

  return normalizeTorusSkewState({
    kind: "torus-skew",
    cellId: torusCellId,
    widthMeters,
    depthMeters,
    skewXMeters,
  });
}

function validateCompiledTorusSkewSnapshot(world: CompiledCellComplex): readonly string[] {
  const errors: string[] = [];
  const cell = world.cellsById.get(torusCellId);
  if (!cell) {
    return [`Compiled torus skew world is missing "${torusCellId}".`];
  }

  const oppositePairs = [
    [0, 2],
    [1, 3],
  ] as const;
  for (const [leftIndex, rightIndex] of oppositePairs) {
    const left = cell.sides[leftIndex];
    const right = cell.sides[rightIndex];
    if (!left || !right) {
      errors.push(`Compiled torus skew world is missing side ${leftIndex} or ${rightIndex}.`);
      continue;
    }

    if (Math.abs(left.lengthMeters - right.lengthMeters) > dimensionToleranceMeters) {
      errors.push(`Torus opposite sides ${leftIndex} and ${rightIndex} are not length-compatible.`);
    }
  }

  return errors;
}

function normalizeTorusSkewState(state: TorusSkewDeformationState): TorusSkewDeformationState {
  if (state.cellId !== torusCellId) {
    throw new Error(`Torus skew only supports cell "${torusCellId}".`);
  }

  if (!(state.widthMeters > 0) || !Number.isFinite(state.widthMeters)) {
    throw new Error(`Torus skew widthMeters must be finite and positive; received ${state.widthMeters}.`);
  }

  if (!(state.depthMeters > 0) || !Number.isFinite(state.depthMeters)) {
    throw new Error(`Torus skew depthMeters must be finite and positive; received ${state.depthMeters}.`);
  }

  if (!Number.isFinite(state.skewXMeters)) {
    throw new Error(`Torus skew skewXMeters must be finite; received ${state.skewXMeters}.`);
  }

  return {
    kind: "torus-skew",
    cellId: torusCellId,
    widthMeters: state.widthMeters,
    depthMeters: state.depthMeters,
    skewXMeters: state.skewXMeters,
  };
}

function requireTorusCell(baseSpec: CellComplexSpec): PrismCellSpec {
  const cell = baseSpec.cells.find((candidate) => candidate.id === torusCellId);
  if (!cell) {
    throw new Error(`Expected a "${torusCellId}" cell.`);
  }

  return cell;
}

function torusLatticeFrame(state: TorusSkewDeformationState): TorusLatticeFrame {
  const u = { x: state.widthMeters, y: 0 };
  const v = { x: state.skewXMeters, y: state.depthMeters };

  return {
    origin: {
      x: -0.5 * u.x - 0.5 * v.x,
      y: -0.5 * u.y - 0.5 * v.y,
    },
    u,
    v,
  };
}

function latticeCoordinates(
  frame: TorusLatticeFrame,
  point: Vec3,
): { readonly alpha: number; readonly beta: number } {
  const offset = {
    x: point.x - frame.origin.x,
    y: point.y - frame.origin.y,
  };
  const beta = offset.y / frame.v.y;
  const alpha = (offset.x - beta * frame.v.x) / frame.u.x;

  return { alpha, beta };
}

function latticeDirectionCoordinates(
  frame: TorusLatticeFrame,
  direction: Vec3,
): { readonly alpha: number; readonly beta: number } {
  const beta = direction.y / frame.v.y;
  const alpha = (direction.x - beta * frame.v.x) / frame.u.x;

  return { alpha, beta };
}

function subtract2(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
  };
}

function length2(vector: { readonly x: number; readonly y: number }): number {
  return Math.hypot(vector.x, vector.y);
}

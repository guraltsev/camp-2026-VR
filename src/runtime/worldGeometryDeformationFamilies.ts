import type { CellComplexSpec } from "../cell-complex/specs";
import {
  createIdentityCellDeformationMaps,
  validateTopologyPreservingSnapshot,
  type DynamicGeometryStepOptions,
  type StaticWorldDeformationState,
  type WorldDeformationFamily,
  type WorldDeformationState,
} from "./worldGeometryDeformations";
import { createTorusSkewDeformationFamily } from "./deformations/torusSkewDeformation";

export interface WorldDeformationFamilyRegistry {
  get<TState extends WorldDeformationState>(
    kind: TState["kind"],
  ): WorldDeformationFamily<TState> | undefined;
  list(): readonly WorldDeformationFamily<WorldDeformationState>[];
}

export function createWorldDeformationFamilyRegistry(
  families: readonly WorldDeformationFamily<WorldDeformationState>[],
): WorldDeformationFamilyRegistry {
  const familiesByKind = new Map<WorldDeformationState["kind"], WorldDeformationFamily<WorldDeformationState>>();

  for (const family of families) {
    familiesByKind.set(family.kind, family);
  }

  return {
    get(kind) {
      return familiesByKind.get(kind) as WorldDeformationFamily<never> | undefined;
    },
    list() {
      return [...familiesByKind.values()];
    },
  };
}

export function createDefaultWorldDeformationFamilyRegistry(): WorldDeformationFamilyRegistry {
  return createWorldDeformationFamilyRegistry([
    createStaticWorldDeformationFamily(),
    createTorusSkewDeformationFamily() as WorldDeformationFamily<WorldDeformationState>,
  ]);
}

export function getWorldDeformationFamilyOrThrow<TState extends WorldDeformationState>(
  registry: WorldDeformationFamilyRegistry,
  kind: TState["kind"],
): WorldDeformationFamily<TState> {
  const family = registry.get<TState>(kind);
  if (!family) {
    throw new Error(`Unknown world deformation family "${kind}".`);
  }

  return family;
}

export function applyWorldDeformationToSpec(
  baseSpec: CellComplexSpec,
  state: WorldDeformationState,
  registry: WorldDeformationFamilyRegistry = createDefaultWorldDeformationFamilyRegistry(),
): CellComplexSpec {
  const family = getWorldDeformationFamilyOrThrow(registry, state.kind);
  if (!family.canApplyToSpec(baseSpec)) {
    throw new Error(`World deformation family "${state.kind}" cannot apply to this world spec.`);
  }

  return family.applyToSpec(baseSpec, family.normalizeState(baseSpec, state as never));
}

export function createInitialWorldDeformationState(baseSpec: CellComplexSpec): WorldDeformationState {
  const registry = createDefaultWorldDeformationFamilyRegistry();
  const torusFamily = registry.get("torus-skew");

  if (torusFamily?.canApplyToSpec(baseSpec)) {
    return torusFamily.normalizeState(baseSpec, {
      kind: "torus-skew",
      cellId: "torus-room",
      widthMeters: 15,
      depthMeters: 15,
      skewXMeters: 0,
    });
  }

  return { kind: "static-world" };
}

function createStaticWorldDeformationFamily(): WorldDeformationFamily<StaticWorldDeformationState> {
  return {
    kind: "static-world",
    canApplyToSpec() {
      return true;
    },
    normalizeState() {
      return { kind: "static-world" };
    },
    applyToSpec(baseSpec) {
      return baseSpec;
    },
    createDynamicObjectMaps(_previous, _next, previousWorld) {
      return createIdentityCellDeformationMaps(previousWorld);
    },
    nextStep(current, _target, _options: DynamicGeometryStepOptions) {
      return current;
    },
    validateSnapshot(previousWorld, nextWorld) {
      return validateTopologyPreservingSnapshot(previousWorld, nextWorld);
    },
  };
}

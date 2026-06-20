import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellComplexSpec } from "../cell-complex/specs";
import type { StaticPortalPathCullResult } from "../cell-complex/staticPortalPathCull";
import {
  createDefaultWorldDeformationFamilyRegistry,
  getWorldDeformationFamilyOrThrow,
  type WorldDeformationFamilyRegistry,
} from "./worldGeometryDeformationFamilies";
import {
  deformationStatesEqual,
  type DynamicGeometryStepOptions,
  type WorldDeformationState,
} from "./worldGeometryDeformations";
import {
  createDefaultWorldGeometryBuildClient,
  type WorldGeometryBuildClient,
} from "./worldGeometryWorkerClient";

export interface WorldGeometrySnapshot {
  readonly version: number;
  readonly deformation: WorldDeformationState;
  readonly spec: CellComplexSpec;
  readonly world: CompiledCellComplex;
  readonly staticCull: StaticPortalPathCullResult;
  readonly buildStats: {
    readonly requestedAtMs: number;
    readonly completedAtMs: number;
    readonly worker: boolean;
  };
}

export interface LiveGeometryDebugState {
  readonly version: number;
  readonly deformationKind: WorldDeformationState["kind"];
  readonly current: WorldDeformationState;
  readonly target: WorldDeformationState;
  readonly buildInFlight: boolean;
  readonly lastBuildMs?: number;
  readonly lastCommitMs?: number;
  readonly lastError?: string;
}

export interface WorldDeformationNudge {
  readonly kind: WorldDeformationState["kind"];
  readonly target: WorldDeformationState;
}

export interface WorldGeometrySession {
  setTarget(target: WorldDeformationState): void;
  nudge(request: WorldDeformationNudge): void;
  cancel(): void;
  pollReadySnapshot(): WorldGeometrySnapshot | undefined;
  readonly state: LiveGeometryDebugState;
  dispose(): void;
}

export interface CreateWorldGeometrySessionOptions {
  readonly baseSpec: CellComplexSpec;
  readonly initialSnapshot: WorldGeometrySnapshot;
  readonly familyRegistry?: WorldDeformationFamilyRegistry;
  readonly buildClient?: WorldGeometryBuildClient;
  readonly portalPathOptions: {
    readonly maxDepth: number;
    readonly skipImmediateReverse: boolean;
    readonly toleranceMeters: number;
    readonly maxKeptPathsPerRoot: number;
  };
  readonly stepOptions?: DynamicGeometryStepOptions;
  readonly nowMs?: () => number;
}

const defaultStepOptions: DynamicGeometryStepOptions = {
  maxStepMeters: 0.08,
  snapToleranceMeters: 1e-6,
};

export function createWorldGeometrySession(options: CreateWorldGeometrySessionOptions): WorldGeometrySession {
  const familyRegistry = options.familyRegistry ?? createDefaultWorldDeformationFamilyRegistry();
  const buildClient = options.buildClient ?? createDefaultWorldGeometryBuildClient();
  const nowMs = options.nowMs ?? defaultNowMs;
  const stepOptions = options.stepOptions ?? defaultStepOptions;
  let currentSnapshot = options.initialSnapshot;
  let current = currentSnapshot.deformation;
  let target = currentSnapshot.deformation;
  let buildInFlight = false;
  let activeRequestId: number | undefined;
  let nextRequestId = 1;
  let readySnapshot: WorldGeometrySnapshot | undefined;
  let lastBuildMs: number | undefined;
  let lastCommitMs: number | undefined;
  let lastError: string | undefined;
  let disposed = false;
  let canceled = false;

  function scheduleNextBuild(): void {
    if (
      disposed ||
      canceled ||
      buildInFlight ||
      readySnapshot ||
      deformationStatesEqual(current, target)
    ) {
      return;
    }

    try {
      const family = getWorldDeformationFamilyOrThrow(familyRegistry, target.kind);
      if (current.kind !== target.kind) {
        current = family.normalizeState(options.baseSpec, target as never);
      }
      const next = family.nextStep(current as never, target as never, stepOptions);
      if (deformationStatesEqual(current, next)) {
        target = current;
        return;
      }

      const requestId = nextRequestId++;
      const requestedAtMs = nowMs();
      activeRequestId = requestId;
      buildInFlight = true;
      lastError = undefined;

      void buildClient.buildSnapshot({
        requestId,
        baseSpec: options.baseSpec,
        deformation: next,
        portalPathOptions: options.portalPathOptions,
      }).then((response) => {
        if (disposed || canceled || response.requestId !== activeRequestId) {
          return;
        }

        buildInFlight = false;
        activeRequestId = undefined;

        if (response.kind === "failed") {
          lastError = response.message;
          return;
        }

        const validationErrors = family.validateSnapshot(currentSnapshot.world, response.world);
        if (validationErrors.length > 0) {
          lastError = validationErrors.join("\n");
          return;
        }

        lastBuildMs = response.completedAtMs - requestedAtMs;
        readySnapshot = {
          version: currentSnapshot.version + 1,
          deformation: next,
          spec: response.spec,
          world: response.world,
          staticCull: response.staticCull,
          buildStats: {
            requestedAtMs,
            completedAtMs: response.completedAtMs,
            worker: buildClient.worker,
          },
        };
      }).catch((error: unknown) => {
        if (disposed || canceled || requestId !== activeRequestId) {
          return;
        }

        buildInFlight = false;
        activeRequestId = undefined;
        lastError = error instanceof Error ? error.message : String(error);
      });
    } catch (error) {
      buildInFlight = false;
      activeRequestId = undefined;
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const session: WorldGeometrySession = {
    setTarget(nextTarget) {
      if (disposed) {
        return;
      }

      const family = getWorldDeformationFamilyOrThrow(familyRegistry, nextTarget.kind);
      if (!family.canApplyToSpec(options.baseSpec)) {
        lastError = `World deformation family "${nextTarget.kind}" cannot apply to this world spec.`;
        return;
      }

      target = family.normalizeState(options.baseSpec, nextTarget as never);
      canceled = false;
      scheduleNextBuild();
    },
    nudge(request) {
      if (request.kind !== current.kind) {
        lastError = `Cannot nudge "${request.kind}" while current deformation is "${current.kind}".`;
        return;
      }

      session.setTarget(request.target);
    },
    cancel() {
      canceled = true;
      target = current;
      readySnapshot = undefined;
      activeRequestId = undefined;
      buildInFlight = false;
    },
    pollReadySnapshot() {
      const snapshot = readySnapshot;
      if (!snapshot) {
        return undefined;
      }

      readySnapshot = undefined;
      currentSnapshot = snapshot;
      current = snapshot.deformation;
      lastCommitMs = nowMs();
      scheduleNextBuild();
      return snapshot;
    },
    get state() {
      return {
        version: currentSnapshot.version,
        deformationKind: current.kind,
        current,
        target,
        buildInFlight,
        lastBuildMs,
        lastCommitMs,
        lastError,
      };
    },
    dispose() {
      disposed = true;
      readySnapshot = undefined;
      buildClient.dispose();
    },
  };

  return session;
}

function defaultNowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

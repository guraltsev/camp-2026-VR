import { compileCellComplex, type CompiledCellComplex } from "../cell-complex/compileCellComplex";
import {
  buildStaticallyCulledPortalPathTables,
  type StaticPortalPathCullResult,
} from "../cell-complex/staticPortalPathCull";
import type { CellComplexSpec } from "../cell-complex/specs";
import {
  createDefaultWorldDeformationFamilyRegistry,
  getWorldDeformationFamilyOrThrow,
} from "./worldGeometryDeformationFamilies";
import type { WorldDeformationState } from "./worldGeometryDeformations";

export interface BuildWorldGeometrySnapshotRequest {
  readonly requestId: number;
  readonly baseSpec: CellComplexSpec;
  readonly deformation: WorldDeformationState;
  readonly portalPathOptions: {
    readonly maxDepth: number;
    readonly skipImmediateReverse: boolean;
    readonly toleranceMeters: number;
    readonly maxKeptPathsPerRoot: number;
  };
}

export type BuildWorldGeometrySnapshotResponse =
  | {
      readonly kind: "built";
      readonly requestId: number;
      readonly spec: CellComplexSpec;
      readonly world: CompiledCellComplex;
      readonly staticCull: StaticPortalPathCullResult;
      readonly completedAtMs: number;
    }
  | {
      readonly kind: "failed";
      readonly requestId: number;
      readonly message: string;
    };

export function buildWorldGeometrySnapshotForRequest(
  request: BuildWorldGeometrySnapshotRequest,
): BuildWorldGeometrySnapshotResponse {
  try {
    const registry = createDefaultWorldDeformationFamilyRegistry();
    const family = getWorldDeformationFamilyOrThrow(registry, request.deformation.kind);
    if (!family.canApplyToSpec(request.baseSpec)) {
      throw new Error(`World deformation family "${request.deformation.kind}" cannot apply to this world spec.`);
    }

    const baseWorld = compileCellComplex(request.baseSpec);
    const deformation = family.normalizeState(request.baseSpec, request.deformation as never);
    const spec = family.applyToSpec(request.baseSpec, deformation);
    const world = compileCellComplex(spec);
    const validationErrors = family.validateSnapshot(baseWorld, world);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.map((error) => `- ${error}`).join("\n"));
    }

    const staticCull = buildStaticallyCulledPortalPathTables(world, request.portalPathOptions);

    return {
      kind: "built",
      requestId: request.requestId,
      spec,
      world,
      staticCull,
      completedAtMs: nowMs(),
    };
  } catch (error) {
    return {
      kind: "failed",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

const workerSelf = typeof self === "undefined" || typeof document !== "undefined"
  ? undefined
  : self as {
      addEventListener(
        type: "message",
        listener: (event: MessageEvent<BuildWorldGeometrySnapshotRequest>) => void,
      ): void;
      postMessage(response: BuildWorldGeometrySnapshotResponse): void;
    };

workerSelf?.addEventListener("message", (event: MessageEvent<BuildWorldGeometrySnapshotRequest>) => {
  workerSelf.postMessage(buildWorldGeometrySnapshotForRequest(event.data));
});

function nowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

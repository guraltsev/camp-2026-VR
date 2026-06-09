import type { Vec3 } from "../../math/vec3";

export interface RuntimeInputFrame {
  readonly localDisplacement: Vec3;
  readonly yawDeltaRadians: number;
  readonly pitchDeltaRadians: number;
  readonly resetRequested: boolean;
  readonly source: "desktop" | "xr";
}

export interface XrDebugRenderState {
  readonly secureContext: boolean;
  readonly sessionStatus: string;
  readonly activeInputSource: RuntimeInputFrame["source"];
  readonly inputMode?: string;
  readonly currentCellId: string;
  readonly playerPosition: Vec3;
  readonly yawRadians: number;
  readonly lastMovementBlocked: boolean;
  readonly lastBlockingReason?: string;
  readonly lastCrossedPortalId?: string;
  readonly sharedRenderRootCellId?: string;
  readonly visiblePortalPathCount?: number;
}

export interface RenderState {
  readonly frameCount: number;
  readonly visiblePortalPaths?: VisiblePortalPathRenderState;
  readonly portalInstances?: PortalInstanceRenderState;
}

export interface VisiblePortalPathRenderState {
  readonly candidatePathCount: number;
  readonly keptPathCount: number;
  readonly visiblePathCount: number;
  readonly visiblePathCountByDepth: readonly { readonly depth: number; readonly count: number }[];
  readonly maxVisibleDepth: number;
  readonly clippedByCameraCount: number;
  readonly clippedByAreaCount: number;
  readonly clippedByBudgetCount: number;
  readonly budgetExhausted: boolean;
}

export interface PortalInstanceRenderState {
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

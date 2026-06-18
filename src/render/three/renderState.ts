import type { Vec3 } from "../../math/vec3";

export interface RuntimeInputFrame {
  readonly localDisplacement: Vec3;
  readonly yawDeltaRadians: number;
  readonly pitchDeltaRadians: number;
  readonly palettePointerDeltaPixels?: { readonly x: number; readonly y: number };
  readonly paletteSelectPressed?: boolean;
  readonly paletteSelectRequested?: boolean;
  readonly resetRequested: boolean;
  readonly primaryActionRequested: boolean;
  readonly interactRequested: boolean;
  readonly carryActionRequested: boolean;
  readonly source: "desktop" | "xr";
}

export interface XrDebugRenderState {
  readonly secureContext: boolean;
  readonly sessionStatus: string;
  readonly activeInputSource: RuntimeInputFrame["source"];
  readonly inputMode?: string;
  readonly frameRateFps?: number;
  readonly framePerformance?: FramePerformanceRenderState;
  readonly webGlRenderInfo?: WebGlRenderInfoState;
  readonly currentCellId: string;
  readonly playerPosition: Vec3;
  readonly yawRadians: number;
  readonly lastMovementBlocked: boolean;
  readonly lastBlockingReason?: string;
  readonly lastCrossedPortalId?: string;
  readonly sharedRenderRootCellId?: string;
  readonly visiblePortalPathCount?: number;
  readonly visiblePortalPaths?: VisiblePortalPathRenderState;
  readonly portalInstances?: PortalInstanceRenderState;
  readonly portalEyes?: readonly PortalEyeRenderDebugState[];
}

export interface RenderState {
  readonly frameCount: number;
  readonly visiblePortalPaths?: VisiblePortalPathRenderState;
  readonly portalInstances?: PortalInstanceRenderState;
}

export interface FramePerformanceRenderState {
  readonly totalMs: number;
  readonly inputMs: number;
  readonly moveMs: number;
  readonly objectsMs: number;
  readonly cameraMs: number;
  readonly portalMs: number;
  readonly uiMs: number;
  readonly renderMs: number;
}

export interface WebGlRenderInfoState {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly points: number;
  readonly viewportPixels: {
    readonly width: number;
    readonly height: number;
  };
  readonly pixelRatio: number;
}

export interface PortalEyeRenderDebugState {
  readonly eyeIndex: number;
  readonly rootCellId: string;
  readonly visiblePathCount: number;
  readonly maxVisibleDepth: number;
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

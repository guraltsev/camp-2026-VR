/** Window-level debug helpers, dump shapes, and number/portal-word formatting. */
import * as THREE from "three";
import { checkPortalPathString, createPortalPathDebugState } from "../../cell-complex/portalPathDebug";
import { type PortalPathTablesByRootCell, type PortalRenderPath } from "../../cell-complex/portalPaths";
import { type StaticPortalPathCullResult } from "../../cell-complex/staticPortalPathCull";
import { type Vec3 } from "../../math/vec3";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import { type PlayerPose } from "../../movement/playerPose";
import { type RuntimeToolId } from "../../runtime/runtimeMenuState";
import { type LiveGeometryDebugState } from "../../runtime/worldGeometrySession";
import {
  type GeodesicCarryPortalTransition,
  type GeodesicPortalTraversal,
  geodesicRayBeamHeightMeters,
  getGeodesicConnection,
} from "../../world-objects/geodesicCannon";
import { type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { type GeodesicCreatureDebugDump } from "./geodesicCreatureDebug";
import { type PortalInstanceRenderDebugState } from "./renderPortalInstances";
import { type RenderQualityState, createRenderQualityState } from "./renderQuality";
import { type VisiblePortalPathRenderState } from "./renderState";
import {
  type ComputeVisiblePortalPathsResult,
  type VisiblePortalPath,
  type VisiblePortalPathDebugSummary,
  type VisiblePortalPathLookupResult,
  describeVisiblePortalPath,
} from "./visiblePortalPaths";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export interface PortalDebugHelpers {
  CheckCellPath(pathText: string): PortalPathCheckResultWithVisibility;
  ShowCellPath(pathText: string): {
    readonly ok: boolean;
    readonly reason?: string;
    readonly check: ReturnType<typeof checkPortalPathString>;
    readonly pathId?: number;
    readonly destinationCellId?: string;
    readonly survivedStaticCull: boolean;
    readonly currentlyVisible: boolean;
    readonly screenAreaPixels?: number;
    readonly clipRectNdc?: VisiblePortalPath["clipRectNdc"];
    readonly objectCount: number;
  };
  HideCellPaths(): void;
  ShowCellPathClipPolygon(pathText: string): {
    readonly ok: boolean;
    readonly reason?: string;
    readonly pathId?: number;
    readonly destinationCellId?: string;
    readonly trackedPathTexts: readonly string[];
    readonly currentlyVisible: boolean;
    readonly clipPolygonNdc?: readonly { readonly x: number; readonly y: number }[];
  };
  HideCellPathClipPolygon(pathText?: string): {
    readonly trackedPathTexts: readonly string[];
  };
  HideClipPolygons(): {
    readonly trackedPathTexts: readonly string[];
  };
  DumpCameraPose(): CameraPoseDebugDump;
  ShowCellPathRendersInstances: boolean;
  readonly state: ReturnType<typeof createPortalPathDebugState> & {
    readonly visiblePortalPaths?: VisiblePortalPathDebugSummary;
    readonly portalInstances: PortalInstanceRenderDebugState;
    readonly renderQuality: RenderQualityState;
    readonly ShowCellPathRendersInstances: boolean;
  };
  readonly candidateTables: PortalPathTablesByRootCell;
  readonly staticCull: StaticPortalPathCullResult;
}

export interface GeneralDebugHelpers {
  debug_help(): void;
  dump_geodesic_creatures(): GeodesicCreatureDebugDump;
  DumpGeodesicCreatures(): GeodesicCreatureDebugDump;
  dump_all_geodesics(): AllGeodesicsDebugDump;
  DumpAllGeodesics(): AllGeodesicsDebugDump;
  dump_geodesic_path(geodesicId?: string): GeodesicPathDebugDump | undefined;
  DumpGeodesicPath(geodesicId?: string): GeodesicPathDebugDump | undefined;
  dump_locked_geodesic_words(): readonly GeodesicWordDebugDump[];
  DumpLockedGeodesicWords(): readonly GeodesicWordDebugDump[];
}

export interface GeneralDebugHelperCallbacks {
  readonly debugHelp: () => void;
  readonly dumpGeodesicCreatures: () => GeodesicCreatureDebugDump;
  readonly dumpAllGeodesics: () => AllGeodesicsDebugDump;
  readonly dumpGeodesicPath: (geodesicId?: string) => GeodesicPathDebugDump | undefined;
  readonly dumpLockedGeodesicWords: () => readonly GeodesicWordDebugDump[];
}

export type WindowWithGeneralDebugHelpers = typeof window & {
  debug_help?: () => void;
  dump_geodesic_creatures?: () => GeodesicCreatureDebugDump;
  dump_all_geodesics?: () => AllGeodesicsDebugDump;
  dump_geodesic_path?: (geodesicId?: string) => GeodesicPathDebugDump | undefined;
  dump_locked_geodesic_words?: () => readonly GeodesicWordDebugDump[];
  noneuclidDebug?: GeneralDebugHelpers;
};

export interface GeometryDebugHelpers {
  SetTorusSkew(skewXMeters: number): void;
  StepTorusSkew(deltaXMeters: number): void;
  Cancel(): void;
  readonly state: LiveGeometryDebugState;
}

export type WindowWithGeometryDebugHelpers = typeof window & {
  noneuclidGeometry?: GeometryDebugHelpers;
};

export type PortalPathCheckResultWithVisibility = ReturnType<typeof checkPortalPathString> & VisiblePortalPathLookupResult;

export interface CameraPoseDebugDump {
  readonly rootCellId: string;
  readonly playerPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly eyePosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly forward: { readonly x: number; readonly y: number; readonly z: number };
  readonly lookAtWorld: { readonly x: number; readonly y: number; readonly z: number };
  readonly yawRadians: number;
  readonly yawDegrees: number;
  readonly pitchRadians: number;
  readonly pitchDegrees: number;
  readonly threeCameraPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly threeCameraQuaternion: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly threeCameraEulerRadians: { readonly x: number; readonly y: number; readonly z: number; readonly order: string };
  readonly projection: {
    readonly type: string;
    readonly near?: number;
    readonly far?: number;
    readonly fovDegrees?: number;
    readonly aspect?: number;
    readonly zoom?: number;
  };
  readonly viewportPixels: { readonly width: number; readonly height: number };
  readonly renderQuality: RenderQualityState;
  readonly matrixWorld: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly projectionMatrix: readonly number[];
}

export interface GeodesicPathDebugDump {
  readonly geodesicId: string;
  readonly locked: boolean;
  readonly connection: ReturnType<typeof getGeodesicConnection>;
  readonly startCellId?: string;
  readonly start?: string;
  readonly word: readonly GeodesicPortalTraversal[];
  readonly wordText: string;
  readonly carrySessionWord?: readonly GeodesicPortalTraversal[];
  readonly carrySessionWordText?: string;
  readonly reverseWordText: string;
  readonly latestPlayerPortalTransition?: GeodesicCarryPortalTransition;
  readonly segments: readonly {
    readonly id: string;
    readonly cellId: string;
    readonly index: number;
    readonly lengthMeters: number;
    readonly start: string;
    readonly direction: string;
    readonly terminal: string;
    readonly connectionState: string;
  }[];
}

export interface GeodesicWordDebugDump {
  readonly geodesicId: string;
  readonly locked: boolean;
  readonly connection: ReturnType<typeof getGeodesicConnection>;
  readonly startCellId?: string;
  readonly start?: string;
  readonly word: readonly GeodesicPortalTraversal[];
  readonly wordText: string;
  readonly transitions: readonly {
    readonly index: number;
    readonly sourceCellId: string;
    readonly sourcePortalId: string;
    readonly targetCellId: string;
    readonly targetPortalId: string;
  }[];
}

export interface AllGeodesicsDebugDump {
  readonly worldId: string;
  readonly visibleCellId?: string;
  readonly selectedTool: RuntimeToolId;
  readonly activeGeodesicCannonToolState: unknown;
  readonly geodesicIds: readonly string[];
  readonly intervals: readonly {
    readonly id: string;
    readonly cellId: string;
    readonly startCellId: string;
    readonly motionState: string;
    readonly start: EndpointDebugDump;
    readonly end: EndpointDebugDump;
    readonly portalWordText: string;
    readonly portalWord: readonly GeodesicPortalTraversal[];
    readonly connection: ReturnType<typeof getGeodesicConnection>;
    readonly locked: boolean;
    readonly segmentCount: number;
    readonly totalSegmentLengthMeters: number;
    readonly segmentCells: readonly string[];
  }[];
  readonly segments: readonly {
    readonly id: string;
    readonly geodesicId: string;
    readonly cellId: string;
    readonly index: number;
    readonly halfRole?: string;
    readonly lengthMeters: number;
    readonly start: string;
    readonly end: string;
    readonly direction: string;
    readonly terminal: string;
    readonly connectionState: string;
    readonly highlightState?: string;
  }[];
  readonly anchors: readonly {
    readonly id: string;
    readonly kind: string;
    readonly cellId: string;
    readonly point: string;
    readonly attachedEndpoints: readonly string[];
  }[];
  readonly curveShorteningPairs: readonly {
    readonly id: string;
    readonly state: string;
    readonly freeEndAnchorId: string;
    readonly first: string;
    readonly second: string;
    readonly previousTotalLengthMeters?: number;
    readonly lastGoodFreeEndCellId: string;
    readonly lastGoodFreeEndPoint: string;
  }[];
}

export interface EndpointDebugDump {
  readonly geodesicId: string;
  readonly role: string;
  readonly anchorObjectId: string;
  readonly anchorKind?: string;
  readonly anchorCellId?: string;
  readonly anchorPoint?: string;
}

export function installPortalDebugHelpers(helpers: PortalDebugHelpers): void {
  (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug = helpers;
}

export function uninstallPortalDebugHelpers(): void {
  delete (window as typeof window & { noneuclidPortalDebug?: PortalDebugHelpers }).noneuclidPortalDebug;
}

export function installGeneralDebugHelpers(callbacks: GeneralDebugHelperCallbacks): void {
  const target = window as WindowWithGeneralDebugHelpers;
  const helpers: GeneralDebugHelpers = {
    debug_help: callbacks.debugHelp,
    dump_geodesic_creatures: callbacks.dumpGeodesicCreatures,
    DumpGeodesicCreatures: callbacks.dumpGeodesicCreatures,
    dump_all_geodesics: callbacks.dumpAllGeodesics,
    DumpAllGeodesics: callbacks.dumpAllGeodesics,
    dump_geodesic_path: callbacks.dumpGeodesicPath,
    DumpGeodesicPath: callbacks.dumpGeodesicPath,
    dump_locked_geodesic_words: callbacks.dumpLockedGeodesicWords,
    DumpLockedGeodesicWords: callbacks.dumpLockedGeodesicWords,
  };

  target.debug_help = helpers.debug_help;
  target.dump_geodesic_creatures = helpers.dump_geodesic_creatures;
  target.dump_all_geodesics = helpers.dump_all_geodesics;
  target.dump_geodesic_path = helpers.dump_geodesic_path;
  target.dump_locked_geodesic_words = helpers.dump_locked_geodesic_words;
  target.noneuclidDebug = helpers;
}

export function uninstallGeneralDebugHelpers(): void {
  const target = window as WindowWithGeneralDebugHelpers;

  delete target.debug_help;
  delete target.dump_geodesic_creatures;
  delete target.dump_all_geodesics;
  delete target.dump_geodesic_path;
  delete target.dump_locked_geodesic_words;
  delete target.noneuclidDebug;
}

export function uninstallGeometryDebugHelpers(): void {
  delete (window as WindowWithGeometryDebugHelpers).noneuclidGeometry;
}

export function liveVisibilityFields(
  pathId: number | undefined,
  latestVisibleResult: ComputeVisiblePortalPathsResult | undefined,
): {
  readonly currentlyVisible: boolean;
  readonly screenAreaPixels?: number;
  readonly clipRectNdc?: VisiblePortalPath["clipRectNdc"];
} {
  return describeVisiblePortalPath(pathId, latestVisibleResult);
}

export function pathToThreeMatrix(path: PortalRenderPath): THREE.Matrix4 {
  return rigidTransformToThreeMatrix(path.rootFromDestination);
}

export function dumpCameraPose(
  playerPose: PlayerPose,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  renderQualityEnabled: boolean,
): CameraPoseDebugDump {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const eyePosition = {
    x: playerPose.position.x,
    y: playerPose.position.y,
    z: playerPose.position.z + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
  };
  const forward = {
    x: -Math.sin(playerPose.yawRadians) * Math.cos(playerPose.pitchRadians),
    y: Math.cos(playerPose.yawRadians) * Math.cos(playerPose.pitchRadians),
    z: Math.sin(playerPose.pitchRadians),
  };
  const lookAtWorld = {
    x: eyePosition.x + forward.x,
    y: eyePosition.y + forward.y,
    z: eyePosition.z + forward.z,
  };
  const renderQuality = createRenderQualityState(renderer, renderer.getPixelRatio(), renderQualityEnabled);
  const dump: CameraPoseDebugDump = {
    rootCellId: playerPose.cellId,
    playerPosition: roundVec3(playerPose.position),
    eyePosition: roundVec3(eyePosition),
    forward: roundVec3(forward),
    lookAtWorld: roundVec3(lookAtWorld),
    yawRadians: roundNumber(playerPose.yawRadians),
    yawDegrees: roundNumber(THREE.MathUtils.radToDeg(playerPose.yawRadians)),
    pitchRadians: roundNumber(playerPose.pitchRadians),
    pitchDegrees: roundNumber(THREE.MathUtils.radToDeg(playerPose.pitchRadians)),
    threeCameraPosition: roundThreeVector3(camera.position),
    threeCameraQuaternion: roundQuaternion(camera.quaternion),
    threeCameraEulerRadians: {
      x: roundNumber(camera.rotation.x),
      y: roundNumber(camera.rotation.y),
      z: roundNumber(camera.rotation.z),
      order: camera.rotation.order,
    },
    projection: {
      type: camera.type,
      near: roundNumber(camera.near),
      far: roundNumber(camera.far),
      fovDegrees: roundNumber(camera.fov),
      aspect: roundNumber(camera.aspect),
      zoom: roundNumber(camera.zoom),
    },
    viewportPixels: {
      width: renderQuality.portalViewportPixels.width,
      height: renderQuality.portalViewportPixels.height,
    },
    renderQuality,
    matrixWorld: roundMatrix(camera.matrixWorld),
    matrixWorldInverse: roundMatrix(camera.matrixWorldInverse),
    projectionMatrix: roundMatrix(camera.projectionMatrix),
  };

  console.info("Current portal visibility camera pose:", dump);
  console.table({
    rootCellId: dump.rootCellId,
    playerPosition: formatVec3(dump.playerPosition),
    eyePosition: formatVec3(dump.eyePosition),
    forward: formatVec3(dump.forward),
    lookAtWorld: formatVec3(dump.lookAtWorld),
    yaw: `${dump.yawRadians} rad / ${dump.yawDegrees} deg`,
    pitch: `${dump.pitchRadians} rad / ${dump.pitchDegrees} deg`,
    threeCameraPosition: formatVec3(dump.threeCameraPosition),
    viewportPixels: `${dump.viewportPixels.width} x ${dump.viewportPixels.height}`,
    cssCanvasSize: `${dump.renderQuality.cssCanvasSize.width} x ${dump.renderQuality.cssCanvasSize.height}`,
    drawingBufferSize: `${dump.renderQuality.drawingBufferSize.width} x ${dump.renderQuality.drawingBufferSize.height}`,
    pixelRatio: dump.renderQuality.pixelRatio,
    antialiasRequested: dump.renderQuality.antialiasRequested,
    projection: `fov=${dump.projection.fovDegrees}, aspect=${dump.projection.aspect}, near=${dump.projection.near}, far=${dump.projection.far}`,
  });

  return dump;
}

export function mergeStaticPathCounts(
  summary: VisiblePortalPathDebugSummary,
  staticCull: StaticPortalPathCullResult,
  rootCellId: string,
): VisiblePortalPathDebugSummary {
  const staticSummary = staticCull.summariesByRootCellId.get(rootCellId);

  return {
    ...summary,
    candidatePathCount: staticSummary?.inputPathCount ?? summary.candidatePathCount,
    keptPathCount: staticSummary?.keptPathCount ?? summary.keptPathCount,
  };
}

export function visibleSummaryToRenderState(summary: VisiblePortalPathDebugSummary): VisiblePortalPathRenderState {
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

export function formatInspectedPathLine(
  pathText: string | undefined,
  check: PortalPathCheckResultWithVisibility | undefined,
  latestVisibleResult: ComputeVisiblePortalPathsResult | undefined,
): string | undefined {
  if (!pathText || !check || check.matchedPathId === undefined || !check.destinationCellId) {
    return undefined;
  }

  const visibility = describeVisiblePortalPath(check.matchedPathId, latestVisibleResult);
  const visibilityLabel = visibility.currentlyVisible ? "Vis" : "Invis";

  return `Path ${pathText} -> ${check.destinationCellId} ${visibilityLabel}`;
}

export function clipPolygonColorForIndex(index: number): string {
  const palette = ["#ff5252", "#3dd9b6", "#ffe066", "#5da9ff", "#ff8fab", "#b892ff"];
  return palette[index % palette.length];
}

export function roundVec3(point: { readonly x: number; readonly y: number; readonly z: number }): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    z: roundNumber(point.z),
  };
}

export function roundThreeVector3(point: THREE.Vector3): { readonly x: number; readonly y: number; readonly z: number } {
  return roundVec3(point);
}

export function roundQuaternion(quaternion: THREE.Quaternion): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
} {
  return {
    x: roundNumber(quaternion.x),
    y: roundNumber(quaternion.y),
    z: roundNumber(quaternion.z),
    w: roundNumber(quaternion.w),
  };
}

export function roundMatrix(matrix: THREE.Matrix4): readonly number[] {
  return matrix.toArray().map(roundNumber);
}

export function matricesNearlyEqual(left: THREE.Matrix4, right: THREE.Matrix4, tolerance = 1e-5): boolean {
  const leftElements = left.elements;
  const rightElements = right.elements;

  for (let index = 0; index < leftElements.length; index += 1) {
    if (Math.abs(leftElements[index] - rightElements[index]) > tolerance) {
      return false;
    }
  }

  return true;
}

export function roundNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function formatGeodesicPortalWord(word: readonly GeodesicPortalTraversal[]): string {
  return word.length === 0
    ? "(root)"
    : word
      .map((step) => `${step.sourceCellId}:${step.sourcePortalId}->${step.targetCellId}:${step.targetPortalId}`)
      .join(" ");
}

export function reverseGeodesicPortalTraversal(step: GeodesicPortalTraversal): GeodesicPortalTraversal {
  return {
    sourceCellId: step.targetCellId,
    sourcePortalId: step.targetPortalId,
    targetCellId: step.sourceCellId,
    targetPortalId: step.sourcePortalId,
  };
}

export function formatEndpointRef(endpoint: { readonly geodesicId: string; readonly role: string }): string {
  return `${endpoint.geodesicId}.${endpoint.role}`;
}

export function roundedMeters(value: number): number {
  return Number(value.toFixed(4));
}

export function totalGeodesicLengthFromDebugSegments(
  segments: readonly { readonly lengthMeters: number }[],
): number {
  return segments.reduce((total, segment) => total + segment.lengthMeters, 0);
}

export function getGeodesicDebugAnchorPoint(
  anchor: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
): Vec3 {
  return {
    x: anchor.localPose.translation.x,
    y: anchor.localPose.translation.y,
    z: anchor.localPose.translation.z + geodesicRayBeamHeightMeters,
  };
}

export function formatVec3(point: { readonly x: number; readonly y: number; readonly z: number }): string {
  return `(${point.x}, ${point.y}, ${point.z})`;
}

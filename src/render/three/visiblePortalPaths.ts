import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { PortalPathTable, PortalRenderPath } from "../../cell-complex/portalPaths";
import { transformPoint3, type RigidTransform3 } from "../../math/rigidTransform3";
import { vec3, type Vec3 } from "../../math/vec3";
import { rigidTransformToThreeMatrix, worldPointToThree } from "./worldAxes";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Rect2 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ComputeVisiblePortalPathsInput {
  readonly world: CompiledCellComplex;
  readonly rootCellId: string;
  readonly pathTable: PortalPathTable;
  readonly camera: THREE.Camera;
  readonly viewportPixels: { readonly width: number; readonly height: number };
  readonly options: VisiblePortalPathOptions;
}

export interface VisiblePortalPathOptions {
  readonly maxDepth: number;
  readonly maxVisiblePaths: number;
  readonly minPortalScreenAreaPixels: number;
  readonly includeRootCell: boolean;
  readonly sortMode: "depth-then-area" | "area-then-depth";
}

export interface VisiblePortalPath {
  readonly pathId: number;
  readonly destinationCellId: string;
  readonly depth: number;
  readonly rootFromDestinationMatrix: THREE.Matrix4;
  readonly clipPolygonNdc: readonly Vec2[];
  readonly clipRectNdc: Rect2;
  readonly screenAreaPixels: number;
}

export interface VisiblePortalPathDebugSummary {
  readonly rootCellId: string;
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

export interface ComputeVisiblePortalPathsResult {
  readonly paths: readonly VisiblePortalPath[];
  readonly visiblePathById: ReadonlyMap<number, VisiblePortalPath>;
  readonly summary: VisiblePortalPathDebugSummary;
}

export interface VisiblePortalPathLookupResult {
  readonly currentlyVisible: boolean;
  readonly screenAreaPixels?: number;
  readonly clipRectNdc?: Rect2;
}

interface InternalVisiblePath extends VisiblePortalPath {
  readonly sourcePath: PortalRenderPath;
}

const fullScreenPolygonNdc: readonly Vec2[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

const polygonTolerance = 1e-9;

export function computeVisiblePortalPaths(input: ComputeVisiblePortalPathsInput): ComputeVisiblePortalPathsResult {
  const rootPath = input.pathTable.pathsById.get(0);

  if (!rootPath) {
    throw new Error(`Visible portal path table for root "${input.rootCellId}" has no root path.`);
  }

  input.camera.updateMatrixWorld(true);
  if ("updateProjectionMatrix" in input.camera && typeof input.camera.updateProjectionMatrix === "function") {
    input.camera.updateProjectionMatrix();
  }

  const rootVisiblePath = createVisiblePath(rootPath, fullScreenPolygonNdc, input.viewportPixels);
  const visibleBeforeBudgetById = new Map<number, InternalVisiblePath>([[rootPath.id, rootVisiblePath]]);
  const discovered: InternalVisiblePath[] = input.options.includeRootCell ? [rootVisiblePath] : [];
  let clippedByCameraCount = 0;
  let clippedByAreaCount = 0;

  for (const path of input.pathTable.paths) {
    if (path.depth === 0 || path.depth > input.options.maxDepth) {
      continue;
    }

    const parentPathId = path.parentPathId;
    const parentVisible = parentPathId === undefined ? undefined : visibleBeforeBudgetById.get(parentPathId);

    if (!parentVisible) {
      continue;
    }

    const portalPolygon = projectNewestPortalApertureToNdc(input.world, path, parentVisible.sourcePath, input.camera);

    if (!portalPolygon) {
      clippedByCameraCount += 1;
      continue;
    }

    const clippedPolygon = clipConvexPolygonByConvexPolygon(portalPolygon, parentVisible.clipPolygonNdc);
    const screenAreaPixels = ndcPolygonAreaPixels(clippedPolygon, input.viewportPixels);

    if (clippedPolygon.length < 3 || screenAreaPixels < input.options.minPortalScreenAreaPixels) {
      clippedByAreaCount += 1;
      continue;
    }

    const visiblePath = createVisiblePath(path, clippedPolygon, input.viewportPixels);
    visibleBeforeBudgetById.set(path.id, visiblePath);
    discovered.push(visiblePath);
  }

  const sorted = [...discovered].sort((a, b) => compareVisiblePaths(a, b, input.options.sortMode));
  const maxVisiblePaths = Math.max(0, input.options.maxVisiblePaths);
  const paths = sorted.slice(0, maxVisiblePaths);
  const clippedByBudgetCount = Math.max(0, sorted.length - paths.length);
  const visiblePathById = new Map(paths.map((path) => [path.pathId, path]));

  return {
    paths,
    visiblePathById,
    summary: {
      rootCellId: input.rootCellId,
      candidatePathCount: input.pathTable.paths.length,
      keptPathCount: input.pathTable.paths.length,
      visiblePathCount: paths.length,
      visiblePathCountByDepth: summarizeVisiblePathCountByDepth(paths),
      maxVisibleDepth: Math.max(0, ...paths.map((path) => path.depth)),
      clippedByCameraCount,
      clippedByAreaCount,
      clippedByBudgetCount,
      budgetExhausted: clippedByBudgetCount > 0,
    },
  };
}

export function buildPortalApertureCorners(
  world: CompiledCellComplex,
  cellId: string,
  sideIndex: number,
): readonly Vec3[] {
  const cell = world.cellsById.get(cellId);
  const side = cell?.sides[sideIndex];

  if (!cell || !side) {
    throw new Error(`Cannot build portal aperture for missing side "${cellId}:${sideIndex}".`);
  }

  return [
    vec3(side.start.x, side.start.y, 0),
    vec3(side.end.x, side.end.y, 0),
    vec3(side.end.x, side.end.y, cell.heightMeters),
    vec3(side.start.x, side.start.y, cell.heightMeters),
  ];
}

export function transformApertureCornersToRoot(
  apertureCorners: readonly Vec3[],
  rootFromSource: RigidTransform3,
): readonly Vec3[] {
  return apertureCorners.map((point) => transformPoint3(rootFromSource, point));
}

export function projectRootSpacePointsToNdc(
  rootSpacePoints: readonly Vec3[],
  camera: THREE.Camera,
): readonly Vec2[] | undefined {
  const cameraSpacePoints = rootSpacePoints.map((point) =>
    worldPointToThree(point).applyMatrix4(camera.matrixWorldInverse),
  );
  const near = "near" in camera && typeof camera.near === "number" ? camera.near : 0.01;
  const nearCoplanarPolygon = projectNearCoplanarPortalToNdc(cameraSpacePoints, camera, near);

  if (nearCoplanarPolygon) {
    return nearCoplanarPolygon;
  }

  const clippedCameraSpacePoints = clipCameraSpacePolygonAgainstNearPlane(cameraSpacePoints, near);

  if (clippedCameraSpacePoints.length >= 3) {
    return projectCameraSpacePointsToNdc(clippedCameraSpacePoints, camera);
  }

  if (cameraSpacePoints.every((point) => point.z < -polygonTolerance)) {
    return projectCameraSpacePointsToNdc(cameraSpacePoints, camera);
  }

  return undefined;
}

function projectNearCoplanarPortalToNdc(
  points: readonly THREE.Vector3[],
  camera: THREE.Camera,
  near: number,
): readonly Vec2[] | undefined {
  if (points.length < 3 || !points.some((point) => point.z < -polygonTolerance)) {
    return undefined;
  }

  const normal = new THREE.Vector3()
    .subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0]));
  const normalLength = normal.length();

  if (normalLength <= polygonTolerance) {
    return undefined;
  }

  normal.divideScalar(normalLength);
  const planeDistanceFromCamera = Math.abs(normal.dot(points[0]));

  if (planeDistanceFromCamera >= near) {
    return undefined;
  }

  const cameraPlaneClipped = clipCameraSpacePolygonAgainstNearPlane(points, Math.min(near, 1e-4));

  return cameraPlaneClipped.length >= 3 ? projectCameraSpacePointsToNdc(cameraPlaneClipped, camera) : undefined;
}

function projectCameraSpacePointsToNdc(
  cameraSpacePoints: readonly THREE.Vector3[],
  camera: THREE.Camera,
): readonly Vec2[] {
  return cameraSpacePoints.map((point) => {
    const projected = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(camera.projectionMatrix);
    const w = projected.w || 1;

    return {
      x: projected.x / w,
      y: projected.y / w,
    };
  });
}

export function clipConvexPolygonByConvexPolygon(
  candidatePolygon: readonly Vec2[],
  clipPolygon: readonly Vec2[],
): Vec2[] {
  if (candidatePolygon.length === 0 || clipPolygon.length < 3) {
    return [];
  }

  let clipped = [...candidatePolygon];
  const clipSign = Math.sign(signedPolygonArea(clipPolygon)) || 1;

  for (let index = 0; index < clipPolygon.length; index += 1) {
    const start = clipPolygon[index];
    const end = clipPolygon[(index + 1) % clipPolygon.length];

    clipped = clipPolygonByEdgeHalfPlane(clipped, start, end, clipSign);

    if (clipped.length === 0) {
      return [];
    }
  }

  return dedupePolygonVertices(clipped);
}

export function ndcRectForPolygon(polygon: readonly Vec2[]): Rect2 {
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    maxY: Math.max(...polygon.map((point) => point.y)),
  };
}

export function ndcPolygonAreaPixels(
  polygon: readonly Vec2[],
  viewportPixels: { readonly width: number; readonly height: number },
): number {
  const ndcArea = Math.abs(signedPolygonArea(polygon));

  return ndcArea * viewportPixels.width * viewportPixels.height / 4;
}

export function summarizeVisiblePathCountByDepth(
  paths: readonly { readonly depth: number }[],
): readonly { readonly depth: number; readonly count: number }[] {
  const counts = new Map<number, number>();

  for (const path of paths) {
    counts.set(path.depth, (counts.get(path.depth) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, count]) => ({ depth, count }));
}

export function describeVisiblePortalPath(
  pathId: number | undefined,
  latestVisibleResult: Pick<ComputeVisiblePortalPathsResult, "visiblePathById"> | undefined,
): VisiblePortalPathLookupResult {
  const visiblePath = pathId === undefined ? undefined : latestVisibleResult?.visiblePathById.get(pathId);

  return {
    currentlyVisible: visiblePath !== undefined,
    ...(visiblePath
      ? {
          screenAreaPixels: visiblePath.screenAreaPixels,
          clipRectNdc: visiblePath.clipRectNdc,
        }
      : {}),
  };
}

function projectNewestPortalApertureToNdc(
  world: CompiledCellComplex,
  path: PortalRenderPath,
  parentPath: PortalRenderPath,
  camera: THREE.Camera,
): readonly Vec2[] | undefined {
  const newestStep = path.steps[path.steps.length - 1];

  if (!newestStep) {
    return fullScreenPolygonNdc;
  }

  const apertureCorners = buildPortalApertureCorners(world, newestStep.sourceCellId, newestStep.sourcePortalSideIndex);
  const apertureInRoot = transformApertureCornersToRoot(apertureCorners, parentPath.rootFromDestination);

  return projectRootSpacePointsToNdc(apertureInRoot, camera);
}

function createVisiblePath(
  path: PortalRenderPath,
  clipPolygonNdc: readonly Vec2[],
  viewportPixels: { readonly width: number; readonly height: number },
): InternalVisiblePath {
  return {
    pathId: path.id,
    destinationCellId: path.destinationCellId,
    depth: path.depth,
    rootFromDestinationMatrix: rigidTransformToThreeMatrix(path.rootFromDestination),
    clipPolygonNdc,
    clipRectNdc: ndcRectForPolygon(clipPolygonNdc),
    screenAreaPixels: ndcPolygonAreaPixels(clipPolygonNdc, viewportPixels),
    sourcePath: path,
  };
}

function compareVisiblePaths(
  a: VisiblePortalPath,
  b: VisiblePortalPath,
  sortMode: VisiblePortalPathOptions["sortMode"],
): number {
  if (sortMode === "area-then-depth") {
    return b.screenAreaPixels - a.screenAreaPixels || a.depth - b.depth || a.pathId - b.pathId;
  }

  return a.depth - b.depth || b.screenAreaPixels - a.screenAreaPixels || a.pathId - b.pathId;
}

function clipPolygonByEdgeHalfPlane(
  polygon: readonly Vec2[],
  edgeStart: Vec2,
  edgeEnd: Vec2,
  clipSign: number,
): Vec2[] {
  const clipped: Vec2[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentValue = clipSign * orient2(edgeStart, edgeEnd, current);
    const nextValue = clipSign * orient2(edgeStart, edgeEnd, next);
    const currentInside = currentValue >= -polygonTolerance;
    const nextInside = nextValue >= -polygonTolerance;

    if (currentInside && nextInside) {
      clipped.push(next);
      continue;
    }

    if (currentInside !== nextInside) {
      clipped.push(intersectEdge(current, next, currentValue, nextValue));
    }

    if (!currentInside && nextInside) {
      clipped.push(next);
    }
  }

  return clipped;
}

function intersectEdge(start: Vec2, end: Vec2, startValue: number, endValue: number): Vec2 {
  const alpha = startValue / (startValue - endValue);

  return {
    x: start.x + (end.x - start.x) * alpha,
    y: start.y + (end.y - start.y) * alpha,
  };
}

function clipCameraSpacePolygonAgainstNearPlane(
  polygon: readonly THREE.Vector3[],
  near: number,
): readonly THREE.Vector3[] {
  const clipped: THREE.Vector3[] = [];
  const nearPlaneZ = -near;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = current.z <= nearPlaneZ + polygonTolerance;
    const nextInside = next.z <= nearPlaneZ + polygonTolerance;

    if (currentInside && nextInside) {
      clipped.push(next.clone());
      continue;
    }

    if (currentInside !== nextInside) {
      clipped.push(intersectCameraSpaceNearPlane(current, next, nearPlaneZ));
    }

    if (!currentInside && nextInside) {
      clipped.push(next.clone());
    }
  }

  return dedupeCameraSpaceVertices(clipped);
}

function intersectCameraSpaceNearPlane(
  start: THREE.Vector3,
  end: THREE.Vector3,
  nearPlaneZ: number,
): THREE.Vector3 {
  const alpha = (nearPlaneZ - start.z) / (end.z - start.z);

  return new THREE.Vector3(
    start.x + (end.x - start.x) * alpha,
    start.y + (end.y - start.y) * alpha,
    nearPlaneZ,
  );
}

function dedupeCameraSpaceVertices(vertices: readonly THREE.Vector3[]): THREE.Vector3[] {
  const deduped: THREE.Vector3[] = [];

  for (const vertex of vertices) {
    const previous = deduped[deduped.length - 1];

    if (!previous || previous.distanceTo(vertex) > polygonTolerance) {
      deduped.push(vertex);
    }
  }

  const first = deduped[0];
  const last = deduped[deduped.length - 1];

  if (first && last && deduped.length > 1 && first.distanceTo(last) <= polygonTolerance) {
    deduped.pop();
  }

  return deduped;
}

function dedupePolygonVertices(vertices: readonly Vec2[]): Vec2[] {
  const deduped: Vec2[] = [];

  for (const vertex of vertices) {
    const previous = deduped[deduped.length - 1];

    if (!previous || Math.hypot(vertex.x - previous.x, vertex.y - previous.y) > polygonTolerance) {
      deduped.push(vertex);
    }
  }

  const first = deduped[0];
  const last = deduped[deduped.length - 1];

  if (first && last && deduped.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) <= polygonTolerance) {
    deduped.pop();
  }

  return deduped;
}

function signedPolygonArea(polygon: readonly Vec2[]): number {
  let twiceArea = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }

  return twiceArea / 2;
}

function orient2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

import * as THREE from "three";
import type { Vec2, VisiblePortalPath } from "./visiblePortalPaths";

export const defaultMaxClipVerticesPerPath = 8;

export interface PortalClipData {
  readonly texture: THREE.DataTexture;
  readonly maxVisiblePaths: number;
  readonly maxClipVerticesPerPath: number;
  readonly clipIndexByPathId: ReadonlyMap<number, number>;
  readonly pathIdByClipIndex: readonly number[];
  readonly polygonVertexCountsByPathId: ReadonlyMap<number, number>;
  readonly polygonVertexOverflowPathIds: readonly number[];
  readonly visiblePathOverflowCount: number;
  update(paths: readonly VisiblePortalPath[]): void;
  dispose(): void;
}

export function createPortalClipData(options: {
  readonly maxVisiblePaths: number;
  readonly maxClipVerticesPerPath?: number;
}): PortalClipData {
  const maxVisiblePaths = Math.max(0, options.maxVisiblePaths);
  const maxClipVerticesPerPath = options.maxClipVerticesPerPath ?? defaultMaxClipVerticesPerPath;
  const data = new Float32Array(Math.max(1, maxVisiblePaths) * maxClipVerticesPerPath * 4);
  const texture = new THREE.DataTexture(
    data,
    maxClipVerticesPerPath,
    Math.max(1, maxVisiblePaths),
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.name = "portal-clip-data";

  let clipIndexByPathId = new Map<number, number>();
  let pathIdByClipIndex: number[] = [];
  let polygonVertexCountsByPathId = new Map<number, number>();
  let polygonVertexOverflowPathIds: number[] = [];
  let visiblePathOverflowCount = 0;

  return {
    texture,
    maxVisiblePaths,
    maxClipVerticesPerPath,
    get clipIndexByPathId() {
      return clipIndexByPathId;
    },
    get pathIdByClipIndex() {
      return pathIdByClipIndex;
    },
    get polygonVertexCountsByPathId() {
      return polygonVertexCountsByPathId;
    },
    get polygonVertexOverflowPathIds() {
      return polygonVertexOverflowPathIds;
    },
    get visiblePathOverflowCount() {
      return visiblePathOverflowCount;
    },
    update(paths) {
      data.fill(0);
      clipIndexByPathId = new Map();
      pathIdByClipIndex = [];
      polygonVertexCountsByPathId = new Map();
      polygonVertexOverflowPathIds = [];
      visiblePathOverflowCount = Math.max(0, paths.length - maxVisiblePaths);

      const acceptedPaths = paths.slice(0, maxVisiblePaths);

      for (const path of acceptedPaths) {
        polygonVertexCountsByPathId.set(path.pathId, path.clipPolygonNdc.length);

        if (path.clipPolygonNdc.length > maxClipVerticesPerPath) {
          polygonVertexOverflowPathIds.push(path.pathId);
          continue;
        }

        const clipIndex = pathIdByClipIndex.length;
        clipIndexByPathId.set(path.pathId, clipIndex);
        pathIdByClipIndex.push(path.pathId);
        writePolygonRow(data, maxClipVerticesPerPath, clipIndex, path.pathId, path.clipPolygonNdc);
      }

      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
    },
  };
}

function writePolygonRow(
  data: Float32Array,
  maxClipVerticesPerPath: number,
  clipIndex: number,
  pathId: number,
  polygon: readonly Vec2[],
): void {
  for (let vertexIndex = 0; vertexIndex < maxClipVerticesPerPath; vertexIndex += 1) {
    const vertex = polygon[vertexIndex] ?? { x: 0, y: 0 };
    const offset = (clipIndex * maxClipVerticesPerPath + vertexIndex) * 4;
    data[offset] = vertex.x;
    data[offset + 1] = vertex.y;
    data[offset + 2] = polygon.length;
    data[offset + 3] = pathId;
  }
}

import * as THREE from "three";
import type { Vec2, VisiblePortalPath } from "./visiblePortalPaths";

export const defaultMaxClipVerticesPerPath = 8;

export interface PortalClipData {
  readonly texture: THREE.DataTexture;
  readonly maxVisiblePaths: number;
  readonly maxClipVerticesPerPath: number;
  readonly maxClipTextureEyes: number;
  readonly clipTextureRows: number;
  readonly clipIndexByPathId: ReadonlyMap<number, number>;
  readonly pathIdByClipIndex: readonly number[];
  readonly polygonVertexCountsByPathId: ReadonlyMap<number, number>;
  readonly polygonVertexOverflowPathIds: readonly number[];
  readonly visiblePathOverflowCount: number;
  update(paths: readonly VisiblePortalPath[]): void;
  updateStereo(pathsByEye: readonly (readonly VisiblePortalPath[])[]): void;
  dispose(): void;
}

export function createPortalClipData(options: {
  readonly maxVisiblePaths: number;
  readonly maxClipVerticesPerPath?: number;
  readonly maxClipTextureEyes?: number;
}): PortalClipData {
  const maxVisiblePaths = Math.max(0, options.maxVisiblePaths);
  const maxClipVerticesPerPath = options.maxClipVerticesPerPath ?? defaultMaxClipVerticesPerPath;
  const maxClipTextureEyes = Math.max(1, options.maxClipTextureEyes ?? 2);
  const clipTextureRows = Math.max(1, maxVisiblePaths) * maxClipTextureEyes;
  const data = new Float32Array(clipTextureRows * maxClipVerticesPerPath * 4);
  const texture = new THREE.DataTexture(
    data,
    maxClipVerticesPerPath,
    clipTextureRows,
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
    maxClipTextureEyes,
    clipTextureRows,
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
      this.updateStereo([paths]);
    },
    updateStereo(pathsByEye) {
      data.fill(0);
      clipIndexByPathId = new Map();
      pathIdByClipIndex = [];
      polygonVertexCountsByPathId = new Map();
      polygonVertexOverflowPathIds = [];
      const unionPathsById = new Map<number, VisiblePortalPath>();

      for (const paths of pathsByEye) {
        for (const path of paths) {
          if (!unionPathsById.has(path.pathId)) {
            unionPathsById.set(path.pathId, path);
          }

          polygonVertexCountsByPathId.set(
            path.pathId,
            Math.max(polygonVertexCountsByPathId.get(path.pathId) ?? 0, path.clipPolygonNdc.length),
          );
        }
      }

      const unionPaths = [...unionPathsById.values()].sort((left, right) => left.pathId - right.pathId);
      visiblePathOverflowCount = Math.max(0, unionPaths.length - maxVisiblePaths);
      const acceptedPaths = unionPaths.slice(0, maxVisiblePaths);

      for (const path of acceptedPaths) {
        if ((polygonVertexCountsByPathId.get(path.pathId) ?? 0) > maxClipVerticesPerPath) {
          polygonVertexOverflowPathIds.push(path.pathId);
          continue;
        }

        const clipIndex = pathIdByClipIndex.length;
        clipIndexByPathId.set(path.pathId, clipIndex);
        pathIdByClipIndex.push(path.pathId);
      }

      const acceptedPathIds = new Set(pathIdByClipIndex);

      for (let eyeIndex = 0; eyeIndex < Math.min(pathsByEye.length, maxClipTextureEyes); eyeIndex += 1) {
        const rowOffset = eyeIndex * Math.max(1, maxVisiblePaths);

        for (const path of pathsByEye[eyeIndex]) {
          if (!acceptedPathIds.has(path.pathId)) {
            continue;
          }

          const clipIndex = clipIndexByPathId.get(path.pathId);

          if (clipIndex === undefined || path.clipPolygonNdc.length > maxClipVerticesPerPath) {
            continue;
          }

          writePolygonRow(data, maxClipVerticesPerPath, rowOffset + clipIndex, path.pathId, path.clipPolygonNdc);
        }
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

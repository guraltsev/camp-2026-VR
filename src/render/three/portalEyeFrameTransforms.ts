/** Re-expresses per-eye visible-portal results in one shared render frame for stereo (VR) rendering. */
import * as THREE from "three";
import { ComputeVisiblePortalPathsResult, VisiblePortalPath } from "./visiblePortalPaths";

export interface PortalEyeRenderState {
  readonly camera: THREE.Camera;
  readonly result: ComputeVisiblePortalPathsResult;
  readonly eyeIndex: number;
  readonly rootCellId: string;
}

export function buildUnionVisiblePathById(
  results: readonly ComputeVisiblePortalPathsResult[],
): ReadonlyMap<number, VisiblePortalPath> {
  const visiblePathById = new Map<number, VisiblePortalPath>();

  for (const result of results) {
    for (const path of result.paths) {
      if (!visiblePathById.has(path.pathId)) {
        visiblePathById.set(path.pathId, path);
      }
    }
  }

  return visiblePathById;
}

export function transformVisiblePortalResultToRenderFrame(
  result: ComputeVisiblePortalPathsResult,
  renderFromRootMatrix: THREE.Matrix4,
): ComputeVisiblePortalPathsResult {
  const paths = result.paths.map((path) => ({
    ...path,
    rootFromDestinationMatrix: renderFromRootMatrix.clone().multiply(path.rootFromDestinationMatrix),
  }));

  return {
    ...result,
    paths,
    visiblePathById: new Map(paths.map((path) => [path.pathId, path])),
  };
}

export function remapStereoPortalPathIds(states: readonly PortalEyeRenderState[]): readonly PortalEyeRenderState[] {
  const pathIdByRootPathKey = new Map<string, number>();
  let nextPathId = 0;

  return states.map((state) => {
    const remappedPaths = state.result.paths.map((path) => {
      const key = `${state.rootCellId}:${path.pathId}`;
      let pathId = pathIdByRootPathKey.get(key);

      if (pathId === undefined) {
        pathId = nextPathId;
        nextPathId += 1;
        pathIdByRootPathKey.set(key, pathId);
      }

      return {
        ...path,
        pathId,
      };
    });
    const visiblePathById = new Map(remappedPaths.map((path) => [path.pathId, path]));

    return {
      ...state,
      result: {
        ...state.result,
        paths: remappedPaths,
        visiblePathById,
      },
    };
  });
}

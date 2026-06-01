import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { CompiledPortal } from "../../cell-complex/specs";
import { projectPointAlongSide, signedDistanceToSide } from "../../movement/collision";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export interface XrPortalEyeRenderRoot {
  readonly rootCellId: string;
  readonly camera: THREE.Camera;
  readonly renderFromRootMatrix: THREE.Matrix4;
}

const portalPlaneToleranceMeters = 1e-5;

export function resolveXrPortalEyeRenderRoot(input: {
  readonly world: CompiledCellComplex;
  readonly sourceCellId: string;
  readonly camera: THREE.Camera;
}): XrPortalEyeRenderRoot {
  const sourceCell = input.world.cellsById.get(input.sourceCellId);

  if (!sourceCell) {
    return {
      rootCellId: input.sourceCellId,
      camera: input.camera,
      renderFromRootMatrix: new THREE.Matrix4(),
    };
  }

  input.camera.updateMatrixWorld(true);
  const eyePoint = threePointToWorld(new THREE.Vector3().setFromMatrixPosition(input.camera.matrixWorld));

  for (const side of sourceCell.sides) {
    if (!side.portal || signedDistanceToSide(side, eyePoint) >= -portalPlaneToleranceMeters) {
      continue;
    }

    const sideProjection = projectPointAlongSide(side, eyePoint);

    if (sideProjection < -portalPlaneToleranceMeters || sideProjection > side.lengthMeters + portalPlaneToleranceMeters) {
      continue;
    }

    if (eyePoint.z < -portalPlaneToleranceMeters || eyePoint.z > sourceCell.heightMeters + portalPlaneToleranceMeters) {
      continue;
    }

    return {
      rootCellId: side.portal.targetCellId,
      camera: transformCameraThroughPortal(input.camera, side.portal),
      renderFromRootMatrix: rigidTransformToThreeMatrix(side.portal.transformToTarget).invert(),
    };
  }

  return {
    rootCellId: input.sourceCellId,
    camera: input.camera,
    renderFromRootMatrix: new THREE.Matrix4(),
  };
}

function transformCameraThroughPortal(camera: THREE.Camera, portal: CompiledPortal): THREE.Camera {
  const transformedCamera = camera.clone();
  const portalMatrix = rigidTransformToThreeMatrix(portal.transformToTarget);
  const matrixWorld = portalMatrix.multiply(camera.matrixWorld);

  transformedCamera.matrixAutoUpdate = false;
  transformedCamera.matrix.copy(matrixWorld);
  transformedCamera.matrixWorld.copy(matrixWorld);
  transformedCamera.matrixWorldInverse.copy(matrixWorld).invert();
  transformedCamera.matrixWorldNeedsUpdate = false;
  matrixWorld.decompose(transformedCamera.position, transformedCamera.quaternion, transformedCamera.scale);
  transformedCamera.projectionMatrix.copy(camera.projectionMatrix);
  transformedCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

  return transformedCamera;
}

function threePointToWorld(point: THREE.Vector3): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x: point.x,
    y: -point.z,
    z: point.y,
  };
}

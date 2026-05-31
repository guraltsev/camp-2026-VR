import * as THREE from "three";
import type { MoveResult } from "../../movement/movePlayer";
import { DEFAULT_PLAYER_EYE_HEIGHT_METERS } from "../../movement/playerBody";
import type { PlayerPose } from "../../movement/playerPose";
import { vec3, type Vec3 } from "../../math/vec3";
import type { RuntimeInputFrame } from "./renderState";
import { computePhysicalRoomScaleDisplacement } from "./vrLocomotion";
import { worldPointToThree } from "./worldAxes";
import { defaultVrComfortOptions, type VrComfortOptions } from "./vrComfort";

export interface XrPlayerRig {
  readonly root: THREE.Group;
  reset(): void;
  syncDesktopCamera(pose: PlayerPose): void;
  syncXrRig(pose: PlayerPose, headLocalMeters?: Vec3): void;
  syncXrCullingCamera(camera: THREE.PerspectiveCamera, viewerPose: XRViewerPose | undefined): void;
  syncXrViewCullingCameras(cameras: readonly THREE.Camera[], viewerPose: XRViewerPose | undefined): readonly THREE.Camera[];
  consumePhysicalInput(headLocalMeters: Vec3 | undefined, yawRadians: number): RuntimeInputFrame;
  acceptPhysicalMove(result: MoveResult, currentHeadLocalMeters?: Vec3): void;
  getSharedRenderRootCellId(pose: PlayerPose): string;
}

export function createXrPlayerRig(camera: THREE.PerspectiveCamera, options: Partial<VrComfortOptions> = {}): XrPlayerRig {
  const comfort = { ...defaultVrComfortOptions, ...options };
  const root = new THREE.Group();
  root.name = "xr-player-rig";
  root.add(camera);
  let previousAcceptedHeadLocalMeters: Vec3 | undefined;

  return {
    root,
    reset() {
      previousAcceptedHeadLocalMeters = undefined;
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
    },
    syncDesktopCamera(pose) {
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      const eyePosition = {
        x: pose.position.x,
        y: pose.position.y,
        z: pose.position.z + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      };
      const forward = {
        x: -Math.sin(pose.yawRadians) * Math.cos(pose.pitchRadians),
        y: Math.cos(pose.yawRadians) * Math.cos(pose.pitchRadians),
        z: Math.sin(pose.pitchRadians),
      };
      camera.position.copy(worldPointToThree(eyePosition));
      camera.up.set(0, 1, 0);
      camera.lookAt(worldPointToThree({
        x: eyePosition.x + forward.x,
        y: eyePosition.y + forward.y,
        z: eyePosition.z + forward.z,
      }));
    },
    syncXrRig(pose, headLocalMeters) {
      const head = headLocalMeters ?? vec3(0, 0, DEFAULT_PLAYER_EYE_HEIGHT_METERS);
      const headThree = worldPointToThree(head);
      const playerEye = worldPointToThree({
        x: pose.position.x,
        y: pose.position.y,
        z: pose.position.z + DEFAULT_PLAYER_EYE_HEIGHT_METERS,
      });
      root.rotation.set(0, pose.yawRadians, 0);
      camera.position.copy(headThree);
      camera.rotation.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const rotatedHead = headThree.clone().applyQuaternion(root.quaternion);
      root.position.set(playerEye.x - rotatedHead.x, playerEye.y - rotatedHead.y, playerEye.z - rotatedHead.z);
      root.updateMatrixWorld(true);
    },
    syncXrCullingCamera(cullingCamera, viewerPose) {
      root.updateMatrixWorld(true);
      const localMatrix = viewerPose
        ? viewerPoseLocalMatrix(viewerPose)
        : new THREE.Matrix4().compose(
            new THREE.Vector3(0, DEFAULT_PLAYER_EYE_HEIGHT_METERS, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1),
          );
      const cullingWorldMatrix = root.matrixWorld.clone().multiply(localMatrix);

      cullingWorldMatrix.decompose(cullingCamera.position, cullingCamera.quaternion, cullingCamera.scale);
      cullingCamera.up.set(0, 1, 0);
      cullingCamera.updateMatrixWorld(true);
    },
    syncXrViewCullingCameras(cameras, viewerPose) {
      root.updateMatrixWorld(true);

      if (!viewerPose) {
        return [];
      }

      return viewerPose.views.slice(0, cameras.length).map((view, index) => {
        const cullingCamera = cameras[index];
        const cullingWorldMatrix = root.matrixWorld.clone().multiply(xrRigidTransformLocalMatrix(view.transform));

        cullingCamera.matrixAutoUpdate = false;
        cullingCamera.matrix.copy(cullingWorldMatrix);
        cullingCamera.matrixWorld.copy(cullingWorldMatrix);
        cullingCamera.matrixWorldInverse.copy(cullingWorldMatrix).invert();
        cullingCamera.matrixWorldNeedsUpdate = false;
        cullingWorldMatrix.decompose(cullingCamera.position, cullingCamera.quaternion, cullingCamera.scale);
        cullingCamera.projectionMatrix.fromArray(view.projectionMatrix);
        cullingCamera.projectionMatrixInverse.copy(cullingCamera.projectionMatrix).invert();
        return cullingCamera;
      });
    },
    consumePhysicalInput(headLocalMeters, _yawRadians) {
      const physical = computePhysicalRoomScaleDisplacement({
        previousHeadLocalMeters: previousAcceptedHeadLocalMeters,
        currentHeadLocalMeters: headLocalMeters,
        maxPhysicalStepMeters: comfort.maxPhysicalStepMeters,
      });
      const localDisplacement = physical.localDisplacement;

      return {
        localDisplacement,
        yawDeltaRadians: 0,
        pitchDeltaRadians: 0,
        resetRequested: false,
        source: "xr",
      };
    },
    acceptPhysicalMove(result, currentHeadLocalMeters) {
      if (!currentHeadLocalMeters) {
        return;
      }

      if (!result.blocked) {
        previousAcceptedHeadLocalMeters = currentHeadLocalMeters;
      }
    },
    getSharedRenderRootCellId(pose) {
      return resolveSharedXrRenderRootCellId(pose);
    },
  };
}

export function resolveSharedXrRenderRootCellId(pose: PlayerPose): string {
  return pose.cellId;
}

export function globalHorizontalDeltaToPlayerLocal(delta: Vec3, yawRadians: number): Vec3 {
  const sinYaw = Math.sin(yawRadians);
  const cosYaw = Math.cos(yawRadians);

  return vec3(
    cosYaw * delta.x + sinYaw * delta.y,
    -sinYaw * delta.x + cosYaw * delta.y,
    delta.z,
  );
}

export function headLocalMetersFromViewerPose(pose: XRViewerPose | undefined): Vec3 | undefined {
  if (!pose) {
    return undefined;
  }

  const position = pose.transform.position;

  return vec3(position.x, -position.z, position.y);
}

export function viewerPoseLocalMatrix(pose: XRViewerPose): THREE.Matrix4 {
  return xrRigidTransformLocalMatrix(pose.transform);
}

export function xrRigidTransformLocalMatrix(transform: Pick<XRRigidTransform, "position" | "orientation">): THREE.Matrix4 {
  const position = transform.position;
  const orientation = transform.orientation;

  return new THREE.Matrix4().compose(
    new THREE.Vector3(position.x, position.y, position.z),
    new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w),
    new THREE.Vector3(1, 1, 1),
  );
}

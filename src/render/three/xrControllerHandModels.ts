import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { publicAssetUrl } from "../../glue/assetUrls";
import { xrRigidTransformLocalMatrix } from "./xrPlayerRig";

export interface XrControllerHandModelsUpdate {
  readonly inputSources: readonly XRInputSource[];
  readonly xrFrame: XRFrame;
  readonly referenceSpace: XRReferenceSpace;
  readonly referenceSpaceToWorldMatrix: THREE.Matrix4;
}

export interface XrControllerHandModels {
  update(frame: XrControllerHandModelsUpdate): void;
  reset(): void;
  dispose(): void;
}

const lowPolyHandsAssetPath = "lowpolyhands/Lowpolyhands.glb";
const handScale = 0.42;
const baseHandMeshRotation = new THREE.Euler(THREE.MathUtils.degToRad(110), 0, Math.PI);
const handLocalLengthAxis = new THREE.Vector3(0, 1, 0);
const handLocalForwardBendAxis = new THREE.Vector3(1, 0, 0);
const handMeshQuaternion = createHandMeshQuaternion();
const handSideSplitEpsilon = 1e-5;

type XrFrameWithJointPose = XRFrame & {
  getJointPose?(jointSpace: XRSpace, baseSpace: XRReferenceSpace): Pick<XRPose, "transform"> | undefined;
};

type XrHandLike = {
  get?(jointName: string): XRSpace | undefined;
};

export function createXrControllerHandModels(scene: THREE.Scene): XrControllerHandModels {
  const loader = new GLTFLoader();
  const instances = new Map<"left" | "right", THREE.Object3D>();
  let templates: HandModelTemplates | undefined;
  let disposed = false;

  void loader.loadAsync(publicAssetUrl(lowPolyHandsAssetPath)).then((gltf) => {
    if (disposed) {
      disposeObject3D(gltf.scene);
      return;
    }

    templates = createHandModelTemplates(gltf.scene);
    for (const handedness of ["left", "right"] as const) {
      const model = cloneSkeleton(templates[handedness]);
      model.name = `xr-controller-${handedness}-hand`;
      model.visible = false;
      scene.add(model);
      instances.set(handedness, model);
    }
  }, () => {
    // The app should remain usable even if this optional cosmetic model fails.
  });

  return {
    update(frame) {
      const seenHands = new Set<"left" | "right">();

      for (const source of frame.inputSources) {
        const handedness = source.handedness === "left" || source.handedness === "right" ? source.handedness : undefined;
        if (!handedness) {
          continue;
        }

        const pose = getInputSourcePose(source, frame.xrFrame, frame.referenceSpace);
        const model = instances.get(handedness);
        if (!pose || !model) {
          continue;
        }

        seenHands.add(handedness);
        applyXrPoseToObject(model, pose.transform, frame.referenceSpaceToWorldMatrix);
        model.visible = true;
      }

      for (const [handedness, model] of instances) {
        if (!seenHands.has(handedness)) {
          model.visible = false;
        }
      }
    },
    reset() {
      hideInstances(instances);
    },
    dispose() {
      disposed = true;
      for (const model of instances.values()) {
        model.removeFromParent();
        disposeObject3D(model);
      }
      instances.clear();
      if (templates) {
        disposeObject3D(templates.left);
        disposeObject3D(templates.right);
      }
    },
  };
}

export interface HandModelTemplates {
  readonly left: THREE.Object3D;
  readonly right: THREE.Object3D;
}

export function createHandModelTemplates(sourceScene: THREE.Object3D): HandModelTemplates {
  const left = createCenteredTemplate(sourceScene, "left");
  const right = createCenteredTemplate(sourceScene, "right");

  return { left, right };
}

function collectMeshEntries(root: THREE.Object3D): readonly {
  readonly mesh: THREE.Mesh;
  readonly centerX: number;
}[] {
  const entries: Array<{ readonly mesh: THREE.Mesh; readonly centerX: number }> = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      entries.push({
        mesh,
        centerX: boxCenterX(mesh),
      });
    }
  });
  return entries;
}

function createCenteredTemplate(source: THREE.Object3D, handedness: "left" | "right"): THREE.Group {
  const template = new THREE.Group();
  template.name = `lowpoly-${handedness}-hand-template`;
  template.scale.setScalar(handScale);

  const model = cloneSkeleton(source);
  keepModelSide(model, handedness);
  model.quaternion.copy(handMeshQuaternion);
  model.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
    return createFallbackTemplate(handedness);
  }
  model.position.sub(center);
  template.add(model);

  return template;
}

function createHandMeshQuaternion(): THREE.Quaternion {
  const base = new THREE.Quaternion().setFromEuler(baseHandMeshRotation);
  const bend = new THREE.Quaternion().setFromAxisAngle(handLocalForwardBendAxis, Math.PI / 2);
  const bent = base.clone().multiply(bend);
  const rollAxis = handLocalLengthAxis.clone().applyQuaternion(bent).normalize();
  const roll = new THREE.Quaternion().setFromAxisAngle(rollAxis, Math.PI / 2);

  return roll.multiply(bent);
}

function createFallbackTemplate(handedness: "left" | "right"): THREE.Group {
  const template = new THREE.Group();
  template.name = `lowpoly-${handedness}-hand-template`;
  return template;
}

function boxCenterX(object: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).x;
}

function keepModelSide(model: THREE.Object3D, handedness: "left" | "right"): void {
  const entries = collectMeshEntries(model);
  if (entries.length <= 1) {
    return;
  }

  const minX = Math.min(...entries.map((entry) => entry.centerX));
  const maxX = Math.max(...entries.map((entry) => entry.centerX));
  const splitX = (minX + maxX) / 2;
  const meshesToRemove = entries
    .filter((entry) => handedness === "left"
      ? entry.centerX < splitX - handSideSplitEpsilon
      : entry.centerX > splitX + handSideSplitEpsilon)
    .map((entry) => entry.mesh);

  for (const mesh of meshesToRemove) {
    mesh.removeFromParent();
  }
}

function getInputSourcePose(
  source: XRInputSource,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
): Pick<XRPose, "transform"> | undefined {
  const handPose = source.hand
    ? getHandJointPose(source.hand as XrHandLike, frame, referenceSpace)
    : undefined;
  if (handPose) {
    return handPose;
  }

  return source.gripSpace
    ? frame.getPose(source.gripSpace, referenceSpace)
    : frame.getPose(source.targetRaySpace, referenceSpace);
}

function getHandJointPose(
  hand: XrHandLike,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
): Pick<XRPose, "transform"> | undefined {
  const getJointPose = (frame as XrFrameWithJointPose).getJointPose;
  const wrist = hand.get?.("wrist");
  if (!getJointPose || !wrist) {
    return undefined;
  }

  return getJointPose.call(frame, wrist, referenceSpace);
}

function applyXrPoseToObject(
  object: THREE.Object3D,
  transform: Pick<XRRigidTransform, "position" | "orientation">,
  referenceSpaceToWorldMatrix: THREE.Matrix4,
): void {
  const worldMatrix = referenceSpaceToWorldMatrix.clone().multiply(xrRigidTransformLocalMatrix(transform));
  worldMatrix.decompose(object.position, object.quaternion, object.scale);
  object.scale.multiplyScalar(handScale);
}

function hideInstances(instances: Map<"left" | "right", THREE.Object3D>): void {
  for (const model of instances.values()) {
    model.visible = false;
  }
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    disposeMaterial(mesh.material);
  });
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[] | undefined): void {
  if (!material) {
    return;
  }

  if ("dispose" in material) {
    material.dispose();
    return;
  }

  for (const item of material) {
    item.dispose();
  }
}

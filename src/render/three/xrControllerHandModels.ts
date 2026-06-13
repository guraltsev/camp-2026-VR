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
  dispose(): void;
}

const lowPolyHandsAssetPath = "lowpolyhands/Lowpolyhands.glb";
const handScale = 0.42;
const handMeshRotation = new THREE.Euler(THREE.MathUtils.degToRad(110), 0, Math.PI);

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
        if (!handedness || source.hand) {
          continue;
        }

        const pose = source.gripSpace
          ? frame.xrFrame.getPose(source.gripSpace, frame.referenceSpace)
          : frame.xrFrame.getPose(source.targetRaySpace, frame.referenceSpace);
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

interface HandModelTemplates {
  readonly left: THREE.Object3D;
  readonly right: THREE.Object3D;
}

function createHandModelTemplates(sourceScene: THREE.Object3D): HandModelTemplates {
  const meshes = collectMeshRoots(sourceScene);
  const sortedMeshes = meshes.sort((a, b) => boxCenterX(a) - boxCenterX(b));
  const left = sortedMeshes[sortedMeshes.length - 1]
    ? createCenteredTemplate(sortedMeshes[sortedMeshes.length - 1], "left")
    : createFallbackTemplate("left");
  const right = sortedMeshes[0]
    ? createCenteredTemplate(sortedMeshes[0], "right")
    : createFallbackTemplate("right");

  return { left, right };
}

function collectMeshRoots(root: THREE.Object3D): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      meshes.push(object);
    }
  });
  return meshes;
}

function createCenteredTemplate(source: THREE.Object3D, handedness: "left" | "right"): THREE.Group {
  const template = new THREE.Group();
  template.name = `lowpoly-${handedness}-hand-template`;
  template.scale.setScalar(handScale);

  const model = cloneSkeleton(source);
  model.rotation.copy(handMeshRotation);
  model.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.position.sub(center);
  template.add(model);

  return template;
}

function createFallbackTemplate(handedness: "left" | "right"): THREE.Group {
  const template = new THREE.Group();
  template.name = `lowpoly-${handedness}-hand-template`;
  return template;
}

function boxCenterX(object: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).x;
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

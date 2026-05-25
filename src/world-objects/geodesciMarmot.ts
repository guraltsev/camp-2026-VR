import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellObjectSpec, GeodesciMarmotObjectSpec } from "../cell-complex/specs";
import { publicAssetUrl } from "../glue/assetUrls";
import { yawRigidTransform3, transformDirection3, type RigidTransform3 } from "../math/rigidTransform3";
import { vec3 } from "../math/vec3";
import type { DynamicObjectState } from "../movement/dynamicObject";
import { moveDynamicObject } from "../movement/moveDynamicObject";

const gltfLoader = new GLTFLoader();
const defaultCollisionOffset = { x: 0, y: 0.22, z: 0 } as const;
const defaultAnimationClipName = "Armature|ArmatureAction";
const defaultScale = 0.42;

export interface CreateGeodesciMarmotOptions {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocity: { readonly x: number; readonly z: number };
  readonly scale?: number;
  readonly animationClipName?: string;
}

export interface GeodesciMarmotRuntime {
  readonly root: THREE.Object3D;
  readonly cellId: string;
  update(world: CompiledCellComplex, deltaSeconds: number): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  reset(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
}

export function createGeodesciMarmot(options: CreateGeodesciMarmotOptions): GeodesciMarmotObjectSpec {
  return {
    id: options.id,
    kind: "geodesci-marmot",
    assetPath: "racoon-animation/scene.gltf",
    position: options.position,
    scale: options.scale ?? defaultScale,
    yawRadians: yawFromVelocity(options.velocity),
    velocity: options.velocity,
    collision: {
      dx: 0.42,
      dy: 0.42,
      dz: 0.72,
      offset: defaultCollisionOffset,
    },
    animationClipName: options.animationClipName ?? defaultAnimationClipName,
  };
}

export function isGeodesciMarmotObjectSpec(objectSpec: CellObjectSpec): objectSpec is GeodesciMarmotObjectSpec {
  return objectSpec.kind === "geodesci-marmot";
}

export function createGeodesciMarmotRuntime(
  objectSpec: GeodesciMarmotObjectSpec,
  startCellId: string,
): GeodesciMarmotRuntime {
  const root = new THREE.Group();
  root.name = `geodesci-marmot:${objectSpec.id}`;

  const visual = new THREE.Group();
  visual.scale.setScalar(objectSpec.scale ?? defaultScale);
  root.add(visual);

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.24, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8c6a43, roughness: 0.95 }),
  );
  placeholder.position.y = 0.16;
  placeholder.name = `placeholder:${objectSpec.id}`;
  visual.add(placeholder);

  let mixer: THREE.AnimationMixer | undefined;
  const initialState = createDynamicObjectState(objectSpec, startCellId);
  let state = initialState;
  const forwardSpeedMetersPerSecond = Math.hypot(objectSpec.velocity.x, objectSpec.velocity.z);

  gltfLoader.load(
    publicAssetUrl(objectSpec.assetPath),
    (gltf) => {
      placeholder.removeFromParent();
      disposeObject3D(placeholder);

      const model = gltf.scene;
      model.name = `asset:${objectSpec.id}`;
      visual.add(model);

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const clip =
          gltf.animations.find((candidate) => candidate.name === objectSpec.animationClipName) ?? gltf.animations[0];
        mixer.clipAction(clip).play();
      }
    },
    undefined,
    () => {
      placeholder.name = `missing-asset:${objectSpec.id}`;
    },
  );

  applyObjectPose(root, state.localPose);

  return {
    root,
    get cellId() {
      return state.cellId;
    },
    update(world, deltaSeconds) {
      mixer?.update(deltaSeconds);

      if (forwardSpeedMetersPerSecond <= 0 || deltaSeconds <= 0) {
        return;
      }

      const displacement = transformDirection3(state.localPose, vec3(0, 0, forwardSpeedMetersPerSecond * deltaSeconds));
      const result = moveDynamicObject({
        world,
        object: state,
        displacement,
      });
      state = result.object;
      applyObjectPose(root, state.localPose);
    },
    syncParent(cellRoots) {
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
    reset(cellRoots) {
      state = initialState;
      applyObjectPose(root, state.localPose);
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
  };
}

function createDynamicObjectState(objectSpec: GeodesciMarmotObjectSpec, cellId: string): DynamicObjectState {
  return {
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.yawRadians ?? yawFromVelocity(objectSpec.velocity),
      vec3(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z),
    ),
    collision: objectSpec.collision,
  };
}

function yawFromVelocity(velocity: GeodesciMarmotObjectSpec["velocity"]): number {
  return Math.atan2(velocity.x, velocity.z);
}

function applyObjectPose(root: THREE.Object3D, pose: RigidTransform3): void {
  root.position.set(pose.translation.x, pose.translation.y, pose.translation.z);
  root.quaternion.setFromRotationMatrix(rotationMatrixFromRigidTransform(pose));
}

function rotationMatrixFromRigidTransform(transform: RigidTransform3): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    transform.rotation.m00,
    transform.rotation.m01,
    transform.rotation.m02,
    0,
    transform.rotation.m10,
    transform.rotation.m11,
    transform.rotation.m12,
    0,
    transform.rotation.m20,
    transform.rotation.m21,
    transform.rotation.m22,
    0,
    0,
    0,
    0,
    1,
  );
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}
